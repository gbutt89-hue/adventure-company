# Adventure Company agent guide

## Start here

- Read this file and `WORK_CONTEXT.md` before substantial work.
- Inspect the relevant implementation and tests before making assumptions. The code is authoritative for current behaviour; `WORK_CONTEXT.md` is the concise current-state map.
- If intended game behaviour is unclear and is not settled by the task, code or tests, ask rather than inventing a design decision.

## Change discipline

- Prefer the smallest coherent change that satisfies the task.
- Reuse existing data structures, rendering patterns and architecture before adding abstractions.
- Do not redesign, rebalance or refactor unrelated systems.
- Preserve gameplay behaviour unless the task explicitly changes it.
- Preserve save compatibility unless explicitly told otherwise. Changes to persisted state belong in `fresh()`, `normalise()` and, where relevant, `migrate()` in `game.js`, with migration coverage in `test-ui.js`.
- Add or update focused tests for material gameplay changes and bug fixes. `test-engine.js` covers simulation/data invariants; `test-ui.js` covers save normalisation and rendered-interface smoke checks.
- Fix failures introduced by your change. Do not silently broaden the task to repair unrelated pre-existing issues.
- Update `WORK_CONTEXT.md` only when a material change alters the repository's current state, architecture, invariants, limitations or agreed next work. Replace stale text; do not append a diary.

## Development workflow

The project has no third-party runtime or development dependencies and no install step. Use Node.js 20 or later (CI uses Node.js 22).

```bash
npm test
npm run build
npx serve dist
```

- `npm test` runs JavaScript syntax checks, deterministic engine checks and VM-based rendered-UI smoke checks.
- `npm run build` recreates the ignored `dist/` directory from the static application files.
- `npx serve dist` serves the built PWA locally; use the URL printed by `serve`. A web server is required to exercise service-worker and install behaviour.
- There is no separate linter, formatter or type checker. Do not claim those checks ran.
- For UI, timer, offline or install changes, also perform the relevant browser playtest and report anything not manually verified.

## Git, releases and deployment

- Remote `main` is the canonical release branch. Fetch it before starting work.
- Create a focused branch or worktree from current `origin/main` (use a short name such as `codex/<task>`), keep one task per branch, and open a pull request back to `main`.
- Pull-request CI is defined in `.github/workflows/check.yml`. A push to `main` also runs `.github/workflows/pages.yml`, which tests, builds and deploys the static site to GitHub Pages.
- The displayed prototype version must stay aligned across `package.json`, `game.js`, the cache-busting URLs in `index.html`, the cache name/assets in `sw.js`, `README.md` and `WORK_CONTEXT.md` when a release changes it.
- Save schema is separate from the prototype version. The current schema is documented in `WORK_CONTEXT.md`; bump `saveVersion` only when persistence changes require it, and add normalisation/migration coverage.
- There is no standalone changelog. Put task/release history in commits and pull requests; keep `README.md` as the public overview and `WORK_CONTEXT.md` as current state. Add a changelog only if the project adopts formal historical release notes.

## Sources of truth and handoff

When information conflicts, use this order:

1. Current implementation and executable tests.
2. Workflow and package configuration for commands/deployment.
3. `WORK_CONTEXT.md` for the current system/design summary.
4. `README.md` for the public overview.
5. Project conversations for design rationale; confirm unresolved choices with the user.

At handoff, report assumptions, files changed, tests/builds run, unresolved risks, pre-existing failures and any manual playtesting still required.
