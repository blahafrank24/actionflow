# Architecture

## 1. The problem

UI event handlers do the same handful of things over and over: read a form, call an API, update a table, navigate. Written as code, each handler is a one-off. You can't inspect it, can't ship it from a server, can't render it in a debugger, and testing it means mocking the whole world.

`actionflow` turns those handlers into **data**: an ordered list of steps that a runner executes against a registry of typed actions.

```ts
const submitInvoice = flow.defineSequence([
  { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
  { action: 'api:POST /invoices', params: { body: '$draft' }, as: 'created' },
  { action: 'table.append', params: { table: 'invoices', row: '$created' } },
  { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
]);

await flow.run(submitInvoice, { signal });
```

### Where it fits

This package is the action module of **vue-schema-admin**, a config-driven Vue 3 admin framework. There, views, forms and tables are described as data, and buttons reference actions by name. `actionflow` makes those actions data too. vue-schema-admin depends on `actionflow`, never the reverse, which is why this package has no UI framework dependency at all. The Vue side (form, table and router actions, reactive run state) lives in vue-schema-admin. See §8.

## 2. Goals and non-goals

Goals:

- **Typed end to end.** Action names, params, refs between steps, and API bodies and responses are all checked by TypeScript when a sequence is written in TS.
- **Serializable.** A sequence is plain JSON. Sequences loaded at runtime are validated against the registry with readable errors.
- **No UI framework.** `actionflow` has zero runtime dependencies. OpenAPI support lives in an optional subpath entry. UI bindings belong to the app or framework that uses it.
- **Observable.** Every run emits a trace that a dev panel, a logger or a test can consume.

Non-goals: loops, parallel branches, a visual editor, persistence or resumable workflows. This is a UI action runner, not a workflow engine like Temporal or XState.

## 3. Package layout

One npm package with subpath exports. A single version and a single publish, with boundaries enforced by ESLint instead of package walls.

| Entry                 | Contents                                                     | Peers                 |
| --------------------- | ------------------------------------------------------------ | --------------------- |
| `actionflow`          | `action`, `createFlow`, runner, ref resolution, validation   | none                  |
| `actionflow/openapi`  | `apiActions(client)`: one typed action per OpenAPI operation | `openapi-fetch`       |

```
src/
  core/      pure TS: types, action(), createFlow(), run(), refs, validate
  openapi/   imports core only
demo/        "Invoices" Vue app + live trace panel (GitHub Pages)
  actions/   example form, table and router actions + useSequence composable
  api/       openapi.yaml, generated schema.d.ts, in-memory fake backend
tests/
```

## 4. Core concepts

### 4.1 Actions

An action is a named async function with typed params and a typed result. It can optionally define `undo`.

```ts
const tableActions = {
  'table.append': action(async ({ table, row }: { table: string; row: Row }, ctx) => {
    tables.get(table).push(row);
    return row;
  }, {
    undo: ({ table }, row) => tables.get(table).remove(row),
  }),
};
```

`ctx` is a single object: `{ signal, trace }`. Actions must respect `signal`.

### 4.2 Flow

`createFlow(registry)` binds a registry and returns `{ defineSequence, run, validate }`. Types flow from the registry, so there is no global declaration merging.

```ts
const flow = createFlow({ ...formActions(forms), ...apiActions(client), ...tableActions, ...routerActions(router) });
```

### 4.3 Steps

```ts
interface Step {
  action: string;          // key in the registry
  params?: object;         // literal values, refs or templates, nested anywhere
  as?: string;             // store the result in the run context under this name
  when?: Ref;              // skip the step unless the ref is truthy
  onError?: 'abort' | 'continue';
}
```

`params` is nested rather than flat, so step keywords (`as`, `when`, `onError`) can never collide with an action's own param names.

### 4.4 Refs and templates

- **Ref:** a string that is exactly `$name` or `$name.path.to.value`. It resolves to the value with its type intact (objects stay objects).
- **Template:** a string containing `{$name.path}` placeholders. It resolves to a string.
- `$$` escapes a literal leading `$`.

Typing (verified in a spike before M1): `defineSequence` takes the steps as a `const` tuple and walks it recursively, building up a context type from each `as`. For every ref it checks that:

1. the name was produced by an **earlier** step,
2. the path exists on that result type,
3. the resolved type is assignable to the param it's used for.

Each failure produces a targeted error on the offending step (`Unknown ref: $drafty`, `Ref $draft has the wrong type`).

### 4.5 Runner

`run(sequence, options)` → `Promise<RunResult>`

```ts
interface RunOptions { signal?: AbortSignal; input?: Record<string, unknown>; onEvent?: (e: TraceEvent) => void; rollback?: boolean }
interface RunResult { status: 'ok' | 'failed' | 'aborted'; ctx: Record<string, unknown>; trace: TraceEvent[]; error?: StepError }
```

Pipeline per step:

1. **Abort check.** If the signal is aborted, stop with `aborted`.
2. **`when`.** If the ref is falsy, emit `step:skip`.
3. **Resolve.** Refs and templates resolve against `ctx`. The resolved params go into the trace.
4. **Execute.** Call the action with the params and `{ signal }`. Emit `step:start`, then `step:done` with the result and duration.
5. **Store.** If `as` is set, `ctx[as] = result`.
6. **Errors.** With `onError: 'continue'`, record the error and move on. Otherwise stop with `failed`. If `rollback: true`, call `undo` on completed steps in reverse order and emit `step:undo` for each.

`run` never throws for step failures. It returns a result. It throws only for programmer errors, such as an unknown action in an unvalidated sequence.

### 4.6 Runtime validation

`flow.validate(json)` checks a sequence loaded from outside TypeScript: action names exist, refs point to earlier `as` names, and `as` names are unique. It returns `{ ok: true, sequence } | { ok: false, issues }` with a step index and a message per issue. Param **shapes** aren't validated at runtime in v0, because that would need a schema per action. Documented as a known limit.

## 5. OpenAPI adapter

The pipeline is `openapi.yaml` → `openapi-typescript` → `paths` type → `openapi-fetch` client → `apiActions(client)`.

`apiActions` maps the `paths` type to one action per operation, keyed `api:METHOD /path`:

```ts
{ action: 'api:GET /invoices/{id}', params: { path: { id: '$created.id' } }, as: 'invoice' }
```

Params are `{ path?, query?, body? }`, matching openapi-fetch. The result is the typed 2xx body. A non-2xx response throws a `HttpError` carrying the status and the error body, so `onError` and `rollback` apply.

No extra codegen is needed: the key encodes the method and path, which the runtime parses and the type system derives from `paths`.

## 6. UI bindings (not in the package)

The package ships no UI bindings. A UI integration is small, and it's best owned by the app or framework that knows its own state:

- **Actions:** `form.*`, `table.*` and `router.*` are a few lines each over state the app already has, registered with `action()`.
- **Run state:** a reactive wrapper such as `useSequence(flow, seq)` → `{ run, abort, status, trace }` is about 30 lines over `run()` and `onEvent`.

The demo contains both in `demo/actions/` as reference code, and the README shows the composable as a recipe. A published `actionflow/vue` (or `/react`) entry gets added only if real users need one.

## 7. Design decisions

- **Data, not closures.** Lambdas give better inference, but they kill serialization and inspection. String refs plus recursive tuple types get most of the inference back. The cost: the types are more complex and live in one file (`core/types.ts`) with type tests.
- **Bound factory over global registry.** `createFlow(registry)` lets two flows with different registries coexist (app vs tests) and keeps types local.
- **Endpoint actions vs domain actions.** `apiActions` exposes raw endpoints, which is fine when the OpenAPI spec is a stable contract. When the backend is unstable or legacy, register **domain actions** instead (`invoices.create`) over a mapping module, so sequences never mention endpoints. The demo shows both.
- **Result, not exceptions.** UI callers need `status` and a trace far more often than a stack unwind.
- **No UI adapter in v0.** Form, table and router actions depend on how an app holds its state, so a generic adapter would either be trivial or duplicate vue-schema-admin. Keeping them out means the package does one thing.
- **No parallel steps, no loops.** Each would double the type and runtime complexity. A sequence that needs them is a sign the logic belongs in a single action.

## 8. Integration with vue-schema-admin

vue-schema-admin dispatches named actions to handlers. Through `actionflow`, a handler can be a sequence:

```ts
defineActions({
  'invoices.submit': (ctx) => flow.run(submitInvoice, { input: ctx }),
});
```

The admin framework supplies the `form.*` and `table.*` actions from its own view state, and the app supplies `api:*` from its OpenAPI client. Every admin action then becomes configurable, inspectable and traceable as data. This package has no code specific to the integration. It stays a plain dependency.
