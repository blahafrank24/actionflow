# Plan

One milestone per session. Each one ends green (`lint`, `typecheck`, `test`) with an AI-LOG entry.

**Public cut: after M5.** That's the core, OpenAPI and a demo with the trace panel, which is enough to pin. M6–M7 come after it's already public.

## M0: Scaffold

- ✅ Design docs and a type spike (`docs/spike/`: typed refs verified with `tsc --strict`). Removed in M1.

- npm package with `actionflow` and `actionflow/openapi` entries. Vite library mode + `vite-plugin-dts`.
- TS strict, ESLint boundary rules (core imports no framework, entries don't import each other, no `fetch` in `src/`), Prettier.
- Vitest with type tests (`*.test-d.ts`). CI: lint → typecheck → test → build. Pages workflow for the demo.
- CLAUDE.md, ARCHITECTURE.md, PLAN.md, AI-LOG.md, and Claude hooks (lint on edit, green tree on stop).

## M1: Core types

- `core/types.ts`: `ActionDef`, `action()`, `Step`, refs, templates, `Validate<>`, and context accumulation.
- `createFlow(registry).defineSequence` returns the sequence unchanged (identity at runtime).
- Type tests: valid sequence, unknown action, unknown ref, use-before-define, wrong ref type, nested path, template names, `$$` escape.
- Make sure the error lands on the offending step and the message reads well. Screenshot the IDE error for the README.

## M2: Runner

- `core/resolve.ts`: ref and template resolution (pure, unit-tested).
- `core/run.ts`: sequential execution, `as`, `when`, `onError`, AbortSignal, `TraceEvent`s, `RunResult`.
- `rollback` with `undo` in reverse order.
- Tests: happy path, skip, continue, failure, abort mid-step, rollback order, trace contents.

## M3: Runtime validation

- `flow.validate(json)` with issues per step index. Tests with hand-written bad JSON.

## M4: OpenAPI adapter

- `openapi/apiActions.ts`: a type-level map from `paths` to `api:METHOD /path` actions, plus runtime key parsing and calls through the openapi-fetch client. `HttpError`.
- Type tests against a small fixture spec. Runtime tests with a custom `fetch` passed to the client.

## M5: Demo

- Vue app. `demo/actions/`: form, table and router actions plus a `useSequence` composable as reference code (not exported from the package).
- Demo "Invoices": a create form → `api:POST /invoices` → table append → navigate to detail. A failing variant shows rollback. A domain-action variant (`invoices.create`) shows the mapping layer.
- **Trace panel:** a timeline of steps that light up as they run, with resolved params, result, duration, and skip/error/undo states. This is the thing people will click.
- `demo/api/openapi.yaml` → `npm run gen:api` → `schema.d.ts`. An in-memory fake backend sits behind a custom `fetch`.
- Deploy to Pages. **Go public, pin the repo.**

## M6: README and release

- README: GIF of the trace panel, a 10-line example, an IDE error screenshot, "why" and "when not to use it".
- Changesets, `v0.1.0` GitHub Release with changelog, `npm publish`.

## M7: vue-schema-admin integration

- Done in the vue-schema-admin repo: its action handlers accept sequences, and form and table actions are backed by its view state.
- In this repo: only README links, once vue-schema-admin is public.
