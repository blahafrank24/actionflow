# actionflow

[![CI](https://github.com/blahafrank24/actionflow/actions/workflows/ci.yml/badge.svg)](https://github.com/blahafrank24/actionflow/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/@yung_papa/actionflow)](https://www.npmjs.com/package/@yung_papa/actionflow)

Typed, serializable action sequences for UI apps.

**[Live demo](https://blahafrank24.github.io/actionflow/)** · [Architecture](https://github.com/blahafrank24/actionflow/blob/main/docs/ARCHITECTURE.md) · [How it was built](https://github.com/blahafrank24/actionflow/blob/main/AI-LOG.md)

> **Status:** early release. The API may change before 1.0.

UI handlers keep doing the same few things: read a form, call an API, update a table, navigate. Written as code, each handler is a one-off: you can't inspect it, ship it from a server, or render it in a debugger. `actionflow` describes them as **data**: an ordered list of steps that a runner executes against a registry of typed actions.

- **Typed end to end.** Action names, params, refs between steps, and OpenAPI request and response types are checked by TypeScript.
- **Serializable.** A sequence is plain JSON, so it can come from config or a server, with runtime validation.
- **Observable.** Every run produces a trace: resolved params, results, timings, skips, errors and undo.
- **No UI framework.** Zero runtime dependencies, plus an optional `@yung_papa/actionflow/openapi` entry.

![The demo's trace panel running a sequence, then a failing one that rolls back](https://raw.githubusercontent.com/blahafrank24/actionflow/main/docs/assets/trace-panel.gif)

## Install

```bash
npm install @yung_papa/actionflow
```

The optional `@yung_papa/actionflow/openapi` entry needs [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) as a peer dependency (`npm install openapi-fetch`). The core entry has no dependencies. ESM only.

## Example

<!-- quickstart -->

```ts
import { action, createFlow } from '@yung_papa/actionflow';

const flow = createFlow({
  'form.read': action(() => ({ customer: 'Ada', amount: 120 })),
  'invoices.create': action(async (p: { draft: { customer: string; amount: number } }) => ({
    id: 'inv-1',
    ...p.draft,
  })),
  'router.push': action((p: { to: string }) => console.log('navigate to', p.to)),
});

const submit = flow.defineSequence([
  { action: 'form.read', as: 'draft' },
  { action: 'invoices.create', params: { draft: '$draft' }, as: 'created' },
  { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
]);

const result = await flow.run(submit);
console.log(result.status); // 'ok'
```

`as` stores a step's result under a name. `'$draft'` is a **ref**: it resolves to that value with its type intact. `'/invoices/{$created.id}'` is a **template**: it resolves to a string. `defineSequence` returns the steps unchanged, so `submit` is still plain data you can serialize.

## What the compiler tells you

The types check every ref, and the error lands on the value you wrote:

```ts
flow.defineSequence([
  { action: 'form.read', as: 'draft' },
  { action: 'invoices.create', params: { draft: '$drafty' } },
  //                                             ~~~~~~~~
  // Type '"$drafty"' is not assignable to type '"$drafty" & { readonly error: "Unknown ref: $drafty"; }'.
]);

{ action: 'router.push', params: { to: '$draft' } }
//                                    ~~~~~~~~
// Type '"$draft"' is not assignable to type '"$draft" & { readonly error: "Ref $draft has the wrong type"; }'.

{ action: 'invoices.creat', params: { /* … */ } }
//        ~~~~~~~~~~~~~~~~
// Type '"invoices.creat"' is not assignable to type '"invoices.creat" & { readonly error: "Unknown action: invoices.creat"; }'.
```

In the editor, the same error reads:

![VS Code hover: Unknown ref: $drafty](https://raw.githubusercontent.com/blahafrank24/actionflow/main/docs/assets/ide-error.png)

A ref to a step that comes later is reported as an unknown ref, because only earlier steps are in scope. Template placeholders, `when` refs and nested paths (`$draft.customer`) are checked the same way.

## Concepts

- **Actions** are named async functions with typed params and result, and an optional `undo`: `action(run, { undo })`.
- **`createFlow(registry)`** binds a registry and returns `{ defineSequence, run, validate }`. Types come from the registry, so there is no global declaration merging, and two flows with different registries can coexist.
- **Steps** are `{ action, params?, as?, when?, onError? }`. `params` is nested, so step keywords can never collide with an action's own param names.
- **Refs and templates:** `'$name.path'` is a ref and `'{$name.path}'` inside a longer string is a template. `'$$'` escapes a literal leading `$`.
- **`when: '$ref'`** skips the step unless the ref is truthy. **`onError: 'continue'`** records the error and moves on, and the default is to stop the run.
- **`flow.run(steps, options)`** never throws for a step failure. It returns `{ status, ctx, trace, error? }` with `status` one of `'ok' | 'failed' | 'aborted'`.
  - `options.signal` aborts the run, and the signal is passed to every action.
  - `options.input` seeds the context with values the steps can reference.
  - `options.onEvent` receives each trace event live.
  - `options.rollback: true` calls `undo` on the completed steps in reverse order after a failure or abort.
- **Trace events** are `step:start`, `step:done`, `step:skip`, `step:error` and `step:undo`, each with the step index and action name. Start and done carry the resolved params, and done adds the result and duration.

A ref that can't be resolved at runtime, for example one pointing at a step that was skipped, fails that step with `Unresolved ref: $name` before the action runs.

## Sequences from JSON

Types only help when a sequence is written in TypeScript. For one loaded from a file or a server, `flow.validate` checks it against the registry:

```ts
const checked = flow.validate(JSON.parse(text), { input: ['page'] });
if (checked.ok) await flow.run(checked.sequence, { input: { page: 'home' } });
else console.log(checked.issues); // [{ index: 1, path: 'params.draft', message: 'Unknown ref: $drafty' }]
```

It reports every issue at once: unknown actions, unknown step keys, bad `when` and `onError` values, duplicate `as` names, and refs to names that aren't defined by an earlier step. `input` lists the names you'll pass to `run`.

## OpenAPI

`@yung_papa/actionflow/openapi` turns the operations you list into typed actions over an [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) client, using the `paths` type from `openapi-typescript`:

```ts
import createClient from 'openapi-fetch';
import { apiActions } from '@yung_papa/actionflow/openapi';
import type { paths } from './schema'; // generated by openapi-typescript

const client = createClient<paths>({ baseUrl: '/api' });
const flow = createFlow({ ...apiActions(client, ['POST /invoices', 'GET /invoices/{id}']) });

// { action: 'api:GET /invoices/{id}', params: { path: { id: '$created.id' } }, as: 'invoice' }
```

Params are `{ path?, query?, body? }`, and the result is the typed 2xx JSON body. A non-2xx response throws `HttpError` with `operation`, `status` and `body`, so `onError` and `rollback` apply. The `AbortSignal` of the run is passed to the fetch. The operation list is type-checked against `paths`, and it exists because `paths` is a type and is gone at runtime, so the registry needs real keys. `openapi-fetch` is an optional peer dependency.

## Using it from a UI

The package ships no UI bindings: form, table and router actions depend on how your app holds its state. The [demo](https://github.com/blahafrank24/actionflow/tree/main/demo) shows how small that is. It has [form, table and router actions](https://github.com/blahafrank24/actionflow/tree/main/demo/actions), a [`useSequence` composable](https://github.com/blahafrank24/actionflow/blob/main/demo/actions/useSequence.ts) (`run`, `abort`, `status`, `trace`) and a [trace panel](https://github.com/blahafrank24/actionflow/blob/main/demo/components/TracePanel.vue) that renders each step as it runs, including rollback.

## Why

- **Data, not closures.** Lambdas give better inference, but they can't be serialized or inspected. String refs plus recursive tuple types get most of the inference back, and the cost is more complex types, which live in one file with type tests.
- **A result, not exceptions.** UI callers need a `status` and a trace far more often than a stack unwind.
- **Endpoint actions or domain actions.** `apiActions` exposes raw endpoints, which suits a stable spec. When the backend is unstable, register domain actions (`invoices.create`) instead, so sequences never mention endpoints. The demo shows both.

## When not to use it

This is a UI action runner, not a workflow engine. It deliberately has no loops, parallel branches, persistence, resumable runs or visual editor, and a sequence that needs them is a sign the logic belongs inside a single action. If you need durable or long-running workflows, use a tool built for that.

## Known limits

- Param **shapes** and ref **paths** (`$draft.nope`) are checked by the types, but not by `flow.validate` at runtime, which would need a schema per action.
- OpenAPI support covers JSON bodies and responses, and operations have to be listed. API actions have no `undo`, since an HTTP call has no generic inverse.
- Sequences are linear, apart from `when` and `onError`.
- It is pre-1.0, so the API may change.

## Development

```bash
npm run dev         # demo app
npm run test        # runtime and type tests
npm run lint && npm run typecheck && npm run build
```

`actionflow` is the action layer of **vue-schema-admin**, a config-driven Vue 3 admin framework that's in development and not yet public. It's published as a standalone package with no UI framework dependency.

## License

MIT
