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
- **Went wrong:** _(fill in)_
- **Changed:** _(fill in)_
