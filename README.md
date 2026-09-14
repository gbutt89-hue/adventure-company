# Adventure Company

A mobile-first, installable browser prototype for a fantasy expedition company management game.

## Prototype 0.2

The current slice covers:

- flexible solo or party expeditions
- deterministic seeded combat with variable retrospective logs
- a danger forecast calculated from 400 simulated encounters
- timed crafting and recovery that resolve after closing the game
- a guided opening tutorial
- administrative seed, replay and timer controls
- local save export and import
- installable PWA and offline application shell

The game is deliberately data-led and low-animation. The current goal is to validate the expedition, recovery and equipment loop before adding recruitment, affixes, prestige or monetisation.

## Run locally

Install Node.js 20 or later, then run:

~~~bash
npm test
npm run build
npx serve dist
~~~

Open the local address shown by `serve`. A web server is required for service-worker and installation behaviour.

## Administrative controls

Open the circular `…` button in the lower-right corner to:

- view, copy or replace the world seed
- reproduce the last encounter
- complete active prototype timers
- export or import the local save
- reset all progress

A reproduced encounter uses exactly the same party, equipment and encounter seed. Future runs use the world seed plus an incrementing run number, so results vary while remaining reproducible.

## Structure

- `index.html`: application shell and PWA metadata
- `styles.css`: responsive fantasy operations-desk interface
- `engine.js`: pure seeded combat and forecast engine
- `game.js`: local state, assignments, tutorial and interface
- `manifest.webmanifest`: installable app metadata
- `sw.js`: offline asset cache
- `test-engine.js`: deterministic engine checks
- `build.mjs`: creates the deployable `dist` directory
- `.github/workflows/pages.yml`: tests and deploys the public GitHub Pages build
