# AI log

How this repo was built with an AI coding agent (Claude Code): what I asked for, where it went wrong, and what I changed in the setup so it couldn't happen again.

Design, architecture and review are mine. Code is written by the agent from `docs/ARCHITECTURE.md` and `docs/PLAN.md`, and every change is reviewed before it's committed.

## Setup

- `CLAUDE.md`: hard rules, stack, layout and conventions, loaded in every session.
- `docs/ARCHITECTURE.md` and `docs/PLAN.md`: the design and the build order.
- ESLint boundary rules: `core/` imports no framework, adapters don't import each other, no `fetch` in `src/`.
- Hooks (`.claude/`): format and lint every edited file; typecheck and tests must be green before the agent can call a task done.
- Permissions: the agent can't push, publish or edit its own guardrails.

## Entries

### M0: Design and scaffold (2026-10-07)

- **Asked:** extract the action layer of vue-schema-admin (my config-driven admin framework) into a standalone library design, check that the riskiest part (typed refs between steps) is feasible, then scaffold the repo. The spike lives in `docs/spike/` until M1 replaces it.
- **Spike:** a ~100-line prototype of `defineSequence` with recursive tuple validation. Unknown refs, use-before-define, wrong ref types and unknown actions all failed to compile as intended on the first pass. One finding: an unknown action name is reported on the whole call rather than on the step. Revisit in M1.
- **Went wrong (draft):** the scaffold's first typecheck failed on Node globals (`import.meta.dirname`, `node:path`) because `@types/node` was missing, and Vitest's type tests failed on `.vue` imports because they default to plain `tsc`.
- **Changed (draft):** added `@types/node`, and set `typecheck.checker` to `vue-tsc` in the Vitest config. No rule or `tsconfig` strictness was loosened. The ESLint boundary rules now have tests in `tests/lint-guardrails.test.ts`, so a config edit can't silently drop them.

### M1: Core types (2026-10-07)

- **Asked:** turn the spike into `core/types.ts`, `action.ts` and `flow.ts`, with type tests for the error cases, then delete the spike.
- **Went wrong (draft):** the spike's error messages never reached the editor. A bad ref was reported as `Type 'string' is not assignable to type 'never'`, because the message string was intersected with the inferred literal (`S & Validate<S>`). The spike's `@ts-expect-error` tests passed anyway, since they only check that an error exists, so this stayed hidden until I printed the real diagnostics. Also, a bad action name or `onError` value failed the whole call rather than the step, because the argument constraint rejected it first.
- **Changed (draft):** messages are now intersected into the written value (`"$drafty" & { error: "Unknown ref: $drafty" }`), and the call constraint is loosened to `{ action: string }` so every check happens per step in `Validate`. Action-name completion is kept with `string & {}`. `ctx` stays `{ signal }` until M2.
- **Open:** the README's IDE-error screenshot has to be taken by hand; the exact diagnostics are in the type test file.
