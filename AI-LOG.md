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

### M2: Runner (2026-10-07)

- **Asked:** `resolve.ts` and `run.ts` per ARCHITECTURE §4.5, with `rollback`, abort and trace events. I asked for a plan first and approved it, plus three decisions the doc left open: unresolved refs fail the step, rollback also runs after an abort, and no `ctx.trace` handle.
- **Went wrong (draft):** the agent's own rollback test expected a completed step *not* to be undone, which contradicted the rule it had just implemented. The runner was right and the test was wrong. A `sed` edit to add imports silently failed on macOS, which the typecheck caught.
- **Changed (draft):** ARCHITECTURE §4.5 now states the four rules the steps left open, so the next session doesn't re-derive them.

### M3: Runtime validation (2026-10-07)

- **Asked:** `flow.validate(json)` with issues per step index. I asked for a plan first and approved it with three additions to §4.6: an `input` option, rejecting unknown step keys, and a `path` on every issue.
- **Why those:** without `input`, a sequence reading a value passed to `run` could never validate. Without rejecting unknown keys, a typo like `onerror` would be dropped by the runner without a word.
- **Went wrong (draft):** the agent's `collectRefs` test treated `'${$b}'` as "not a ref". The code was right: a leading `$` makes it a ref, same as in the runner and the types. The test was wrong again, as in M2.
- **Changed (draft):** ref syntax is parsed in one place (`collectRefs`), so the validator and runner can't drift apart. ARCHITECTURE §4.6 now documents `input`, issue shape and the checks.

### M4: OpenAPI adapter (2026-10-07)

- **Asked:** `apiActions` mapping a `paths` type to `api:METHOD /path` actions, with `HttpError` and tests against a small fixture spec. The plan found a hole in ARCHITECTURE §5 before any code: it said no extra input is needed because the key encodes method and path, but a registry needs real keys at runtime (core uses `Object.hasOwn`, apps spread registries) and `paths` is a type. I approved an explicit operation list, `apiActions(client, ['POST /invoices'])`, over a `Proxy` that would have forced core changes.
- **Went wrong (draft):** the first types gave `GET /invoices/{id}` a phantom optional `body`, because `requestBody?: never` made `never extends { content: ... }` true. Then an optional `requestBody` came out as a required `body`, since under `exactOptionalPropertyTypes` an `infer` on an optional key drops the `undefined`. Both showed up only as `toEqualTypeOf` failures, so the type tests pin the exact params of every fixture operation. A test also assumed an empty error response gives `body: undefined`, and openapi-fetch gives `""`.
- **Changed (draft):** body optionality is read from whether the `requestBody` key itself is required. `HttpError.body` passes openapi-fetch's value through, and ARCHITECTURE §5 says so. §3, §4.2 and §5 now describe the operation list and why it exists.

### M5a: Demo foundations (2026-10-07)

- **Asked:** the headless half of the demo: the API contract, a fake backend behind a custom `fetch`, form, table, router and domain actions, `useSequence`, and a pure `stepStates` for the trace panel, with the UI left for M5b. The plan split M5 in two because it is the biggest milestone, and flagged a rule conflict before touching any config: the generated `schema.d.ts` can't pass Prettier or ESLint. I approved ignoring that one file, which leaves the hand-written demo code fully checked.
- **Why it's a good test:** the demo is the first real consumer of the library, and `src/` needed no changes. The three sequences typecheck against what `openapi-typescript` actually emits, which the hand-written M4 fixture only approximated. The rollback story had to go through domain actions, since M4 deliberately gave raw API actions no `undo`.
- **Went wrong (draft):** only the lint rule that `form.read` ignored its `form` param. The fix was to pass the name through to the reader, which is more realistic anyway, not to prefix it with an underscore or silence the rule.
- **Changed (draft):** `actionflow` and `actionflow/openapi` resolve to `src/` through `tsconfig` paths and the Vite and Vitest aliases, so the demo reads like code written against the published package. ARCHITECTURE §6 now describes the real `useSequence` signature. The earlier "path-level parameters aren't read" limit turned out not to matter in practice, since the generator copies them into each operation.

### M5b: Demo UI and trace panel (2026-10-07)

- **Asked:** the Vue app on top of the M5a modules, with the trace panel as the centrepiece. The plan fixed the scope first: hand-written CSS, no UI library, the failing variant turning the backend's failure on by itself, and `build:demo` added to CI. The reason for the CI step was that only the Pages workflow built the demo, so a broken demo would have surfaced after merge.
- **Verified:** DOM tests mount the real app with a memory router and drive it like a user, covering all three variants, skip, rollback, abort and reset. I also served the demo and looked at it in the built-in browser, in dark and light mode and at phone width, since tests can't judge whether a rolled-back step reads clearly.
- **Went wrong (draft):** the first component test run failed on every `.vue` import, because the Vitest config had no Vue plugin; only the demo's Vite config did. The fix was one line in the config. Two design slips came up while building. Switching variant would have shown the old trace laid over the new steps, so `useSequence` got a `reset()`. And the form reader had to return a copy: handing out the reactive form would let later edits rewrite a finished trace, which a test now pins.
- **Changed (draft):** `Variant` has a `description` the UI shows under the picker. CI builds the demo. ARCHITECTURE needed no change. I did not touch repo settings: enabling GitHub Pages, going public and pinning stay with the author.

### M6: README (2026-10-07)

- **Asked:** pick up the README branch, check it against what exists, and prepare the release. I asked for a plan first and approved it, with the `v0.1.0` release and `npm publish` left to me.
- **Verified:** the README's example is quoted from `docs/examples/quickstart.ts`, and a test pins that the two match and that the example runs and ends `ok`. Another test requires absolute links, so the page renders on npm. The `~~~` error messages match the `Fail` messages in `core/types.ts`.
- **Went wrong (draft):** `npm pack --dry-run` showed the type-test fixture `openapi/fixture.d.ts` shipping in the tarball. The declaration build only excluded test files. It is now excluded in the Vite config.
- **Changed (draft):** Changesets is set up with a `minor` changeset for the first release, plus `version` and `release` scripts. The agent was first blocked from adding the public-access release config and went ahead only after I approved it. The `0.1.0` version bump, GitHub Release and `npm publish` are still mine.
- **Media (draft):** the agent captured the trace-panel GIF from the running demo, one successful run and one failing run that rolls back, and stitched the frames with ffmpeg. It can't see the editor, so the IDE-error screenshot is mine: I removed the `@ts-expect-error` line in `types.test-d.ts`, hovered the error and took it, and the agent cropped it to the message. Both are in `docs/assets/` and embedded with absolute URLs.
- **Went wrong (draft):** the screenshot needed that one line deleted, and the agent finished with it still deleted. The stop hook caught the red typecheck and the agent restored it with `git checkout`, so the green-tree hook did its job. A push was also rejected because the remote branch had commits from another session, so the agent rebased onto it and re-ran the checks, with no force-push.

### Release 0.1.0 (2026-10-09)

- **Asked:** open the release PR. I approved a plan first: npm metadata, an Install section and badge, the Changesets version bump, and this entry. Merging, the tag, the GitHub Release and `npm publish` stay with me.
- **Verified:** besides lint, typecheck and tests, the agent packed the tarball, installed it into an empty project and ran both entries in Node.
- **Went wrong:** that install check found the published types were broken for two kinds of consumer. Relative imports in `src/` had no extensions, which the declaration build copied into `dist`, so under `nodenext` every type resolved to `any` and an unknown action was no longer rejected. Separately, `'../core'` in the OpenAPI adapter resolved to the bundle file `dist/core.js` and not the `core/` directory, so `@yung_papa/actionflow/openapi` lost its types even under `bundler`. Every test imports from `src/`, so none of them could see it. It is fixed in its own PR, with a test that builds the package and type-checks a consumer under both resolution modes, and I confirmed that the test fails without the fix.
- **Went wrong:** a failed install made `npx tsc` download an unrelated package named `tsc`. It only printed a banner, but the agent now calls the local TypeScript binary directly.
- **Changed:** no `engines` field, because only Node 22 is tested and a range nobody tested would be a false claim.
- **Went wrong:** `npm publish` was rejected with a 403: `actionflow` is too similar to an existing, unrelated package (`action-flow`), and the agent's earlier check that the name was free (a 404 on `npm view`) can't see npm's similarity rule. The package is now scoped as `@yung_papa/actionflow`. The rename touches the package name, the import specifiers, the `tsconfig` paths and the Vite and Vitest aliases, and the docs, and the packaging test installs it under the scoped name. A `v0.1.0` tag pushed before the failed publish had to be moved.
- **Result:** `@yung_papa/actionflow@0.1.0` is on npm, tagged `v0.1.0` and released on GitHub. Merging, tagging, publishing and the release were mine, and the agent checked each step after I did it: the tag against the merged commit, then the published package, installed from the registry and type-checked under both resolution modes, then the README badge. The registry took a few minutes to show the new package, so the first checks reported a 404 that was only lag.
