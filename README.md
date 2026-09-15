# Adventure Company

A mobile-first, installable browser prototype for a fantasy expedition company management game.

## Prototype 0.3.3

The current slice covers:

- flexible solo or party expeditions
- deterministic seeded combat with variable retrospective logs
- a danger forecast calculated from 400 simulated encounters
- a spatial Town hub with clickable facility vignettes
- a persistent desktop hero rail and mobile roster drawer
- configurable Tavern and Infirmary activity slots
- timed crafting and facility recovery that resolve after closing the game
- a guided opening tutorial
- administrative seed, replay and timer controls
- local save export and import
- installable PWA and offline application shell
- anchored tap, keyboard and hover explanations for classes, traits and statistics
- current-condition combat forecasting and per-hero consequence summaries
- real Craft XP progression and guided recovery hand-offs
- company Inventory and equipment management through a reusable character sheet
- Armour, Ward, Accuracy and Critical combat statistics

The game is deliberately data-led and low-animation. The current goal is to validate the Town, expedition, recovery and equipment loop before adding recruitment, affixes, prestige or monetisation.

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
- `game.js`: local state, Town facilities, expeditions, tutorial and interface
- `manifest.webmanifest`: installable app metadata
- `sw.js`: offline asset cache
- `test-engine.js`: deterministic engine checks
- `test-ui.js`: interface rendering smoke checks
- `build.mjs`: creates the deployable `dist` directory
- `.github/workflows/pages.yml`: tests and deploys the public GitHub Pages build
