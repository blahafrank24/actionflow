# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repo is

`actionflow` is a small TypeScript library for typed, serializable **action sequences**: an ordered list of steps (read a form, call an API, update a table, navigate) that a runner executes against a registry of typed actions. It has no UI framework dependency. There's one optional entry, `@yung_papa/actionflow/openapi`. The demo is a Vue app.

It's the action module of vue-schema-admin, the author's config-driven Vue admin framework, extracted so it stays usable on its own. Never add a dependency on vue-schema-admin. It depends on this package, not the other way round.

It's a **portfolio piece**. It shows API design and type-level TypeScript in a deliberately small codebase. Read `docs/ARCHITECTURE.md` for the design and `docs/PLAN.md` for the build order.

## Hard rules

1. **Clean room.** Write everything from scratch. Don't copy code from any other repository, including the author's previous work. The ideas are portable. The code isn't.
2. **Minimal by design.** If a feature isn't shown in the demo or covered by a test, it doesn't ship. Target: `src/` under ~1,500 LOC excluding tests.
3. **No company or domain names** anywhere: code, comments, commits, demo data.
4. **Boundaries** (enforced by ESLint):
   - `src/core/` imports nothing outside `src/core/`: no Vue, no openapi-fetch, no runtime dependencies.
   - `src/openapi/` imports only from `src/core/`.
   - No UI framework code in `src/`. UI bindings live in the demo (`demo/actions/`). Don't add an adapter entry unless the author asks for it.
   - No `fetch` in `src/`. HTTP goes through the openapi-fetch client the app passes in. In the demo, only `demo/api/` may use `fetch`.
5. **Types are the product.** Every public type change comes with a type test (`*.test-d.ts`) covering the error case, not only the happy path.
6. **Never weaken a check to get green.** Don't use `eslint-disable`, `@ts-ignore` or `any` in public types, don't add `.skip`, and don't loosen `tsconfig`. `@ts-expect-error` is allowed **only** in type tests. If a check seems wrong, stop and ask.

## Stack

- TypeScript **strict** (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). ESM only.
- Vite 6 library mode (multiple entries) + `vite-plugin-dts`.
- Vitest 3 (`happy-dom` for demo components), type tests via `vitest --typecheck`.
- Peer (optional): `openapi-fetch`. Demo: Vue 3.5, Vue Router 4, `openapi-typescript` for codegen.
- No lodash, no axios, no zod in the library.

## Layout

```
src/
  core/        index.ts, types.ts, action.ts, flow.ts, resolve.ts, run.ts, validate.ts
  openapi/     index.ts, apiActions.ts
demo/          Vue "Invoices" app + trace panel
  actions/     form, table, router actions + useSequence (reference code)
  api/         openapi.yaml, schema.d.ts (generated), fake backend
tests/         cross-cutting tests (lint guardrails)
docs/          ARCHITECTURE.md, PLAN.md
```

## Conventions

- Default to no comments. Comment only a non-obvious *why*. Complex type utilities get a one-line example in a comment.
- Discriminated unions with exhaustive `switch` and a `never` check.
- Validate at the boundary (`flow.validate`, adapter options). Trust internal callers.
- No backwards-compat shims. This is v0, so delete cleanly.
- One concern per commit.
- **Commit messages**: an English one-liner with a conventional-commit prefix and a backtick-wrapped scope. No body besides the `Co-Authored-By` trailer. Examples: `` feat(`core`): add ref resolution ``, `` test(`types`): cover use-before-define ``, `` chore(`ci`): add pages deploy ``.

## Commands

```bash
npm run dev         # demo app
npm run build       # library -> dist/
npm run build:demo  # demo -> demo/dist (GitHub Pages)
npm run gen:api     # demo/api/openapi.yaml -> demo/api/schema.d.ts
npm run test        # vitest run (runtime + type tests)
npm run typecheck   # vue-tsc --noEmit
npm run lint        # eslint + prettier --check
```

## Working here

- Follow `docs/PLAN.md`, one milestone per session. Start by writing a plan and wait for approval before writing code.
- If the plan needs to deviate from ARCHITECTURE.md, say so explicitly. When the design changes, update ARCHITECTURE.md in the same commit.
- Done means `npm run lint && npm run typecheck && npm run test` are green. A hook checks this when you finish.
- Propose commits. The author approves them. Push only the session's feature branch (never `main`, never force-push) so cloud sessions can hand work back. The author reviews and merges.
- Keep the README honest: only document what exists.
- At the end of a milestone, draft an `AI-LOG.md` entry. The author edits it.
