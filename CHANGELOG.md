# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/). Before 1.0, the API may change in any release.

## [0.1.1] - 2026-10-13

### Changed

- The package is now published as `@blahafrank24/actionflow`, replacing `@yung_papa/actionflow`. Update your imports, including `@blahafrank24/actionflow/openapi`. The API is the same as in 0.1.0.

## [0.1.0] - 2026-10-09

First release, published as `@yung_papa/actionflow`.

### Added

- **Sequences.** `createFlow(registry)` binds a registry of typed actions and returns `defineSequence`, `run` and `validate`. A sequence is plain data, and `defineSequence` returns it unchanged. Action names and params are checked by TypeScript, and the error is reported on the value you wrote.
- **Refs between steps.** `as` stores a step's result. `'$name.path'` resolves to that value with its type, and `'{$name.path}'` inside a string is a template. Unknown refs, refs to later steps and refs of the wrong type fail to compile. `when` skips a step, `onError: 'continue'` moves on after a failure, and `'$$'` escapes a literal `$`.
- **Rollback.** An action can declare `undo`. With `rollback: true`, a failed or aborted run undoes the completed steps in reverse order.
- **Traces.** `flow.run` returns `{ status, ctx, trace, error? }` and does not throw for a step failure. The trace records resolved params, results, durations, skips, errors and undo, and `onEvent` receives the events live. An `AbortSignal` stops the run and is passed to every action.
- **JSON sequences.** `flow.validate` checks a sequence loaded from JSON against the registry and reports every issue at once, with the step index and path.
- **OpenAPI adapter.** `@yung_papa/actionflow/openapi` provides `apiActions`, which turns listed operations into typed actions over an `openapi-fetch` client, and `HttpError` for non-2xx responses. `openapi-fetch` is an optional peer dependency.
- **Demo.** A Vue app with a live trace panel, covering a successful run, a failing run that rolls back, and a domain-action variant. Hosted at <https://blahafrank24.github.io/actionflow/>.

[0.1.1]: https://github.com/blahafrank24/actionflow/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/blahafrank24/actionflow/releases/tag/v0.1.0
