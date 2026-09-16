# Adventure Company

A mobile-first, installable browser prototype for a fantasy expedition company management game.

## Prototype 0.7.2

The current vertical slice is deliberately data-led and low-animation. It includes:

- solo or three-hero timed expeditions across four locations, including concurrent parties at different locations
- deterministic seeded combat, named class/enemy moves, retrospective logs and a 400-run danger forecast
- four approaches, weighted material loot tables, two expedition supply slots and automatic consumable use
- a spatial Town with timed Workshop, gradual Tavern recovery and injury-focused Infirmary treatment
- a four-hero roster with levels, traits, equipment, class growth, persistent condition and class moves through level five
- twelve-slot equipment storage, materials/consumables, three base weapons, dismantling and safe Workshop overflow
- an anti-softlock Forage expedition and conditional Emergency Treatment
- guided opening, administrative testing controls, local save import/export and an offline installable PWA shell

The current goal is to validate and balance the Town, expedition, recovery and equipment loop before adding recruitment, affixes, prestige or monetisation. See `WORK_CONTEXT.md` for the concise implementation map and current limitations.

## Run locally

Install Node.js 20 or later. The project has no package dependencies, so no install step is required. Run:

~~~bash
npm test
npm run build
npx serve dist
~~~

Open the local address shown by `serve`. A web server is required for service-worker and installation behaviour.

`npm test` includes syntax checks, deterministic engine checks and rendered-interface smoke checks. There is currently no separate lint or type-check command. `npm run build` recreates the ignored `dist/` directory.

## Contribution workflow

Remote `main` is the canonical release branch. Create a focused branch from current `origin/main` and open a pull request. Pull requests run the check/build workflow; merges to `main` also deploy the PWA through GitHub Pages. Coding agents must read `AGENTS.md` and `WORK_CONTEXT.md` first.

## Administrative controls

Open the circular `…` button in the lower-right corner to:

- view, copy or replace the world seed
- set the selected hero's level, experience and current condition
- reproduce the last encounter
- complete active prototype timers
- export or import the local save
- reset all progress

A reproduced encounter uses exactly the same party, equipment and encounter seed. Future runs use the world seed plus an incrementing run number, so results vary while remaining reproducible.

## Structure

- `index.html`: application shell and PWA metadata
- `styles.css`: responsive fantasy operations-desk interface
- `engine.js`: pure seeded combat and forecast engine
- `game.js`: local state, Town facilities, expeditions, tutorial and interface
- `manifest.webmanifest`: installable app metadata
- `sw.js`: offline asset cache
- `test-engine.js`: deterministic engine checks
- `test-ui.js`: interface rendering smoke checks
- `build.mjs`: creates the deployable `dist` directory
- `AGENTS.md`: agent workflow, repository conventions and verification expectations
- `WORK_CONTEXT.md`: concise current implementation and design state
- `.github/workflows/check.yml`: pull-request and `main` test/build checks
- `.github/workflows/pages.yml`: tests and deploys the public GitHub Pages build
