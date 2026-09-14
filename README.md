# Adventure Company

A mobile-first, installable browser prototype for a fantasy expedition company management game.

## Prototype 0.2

The current slice covers:

- flexible solo or party expeditions
- deterministic seeded combat with variable retrospective logs
- simulated danger forecasting
- timed crafting and recovery that resolve after closing the game
- a guided opening tutorial
- local save export and import
- installable PWA and offline shell
- administrative seed and timer controls

The game is deliberately data-led and low-animation. The current goal is to validate the expedition, recovery and equipment loop before adding recruitment, affixes, prestige or monetisation.

## Run locally

Serve the repository root over HTTP. For example:

~~~bash
+python -m http.server 8080
~~~

Then open http://localhost:8080. A web server is required for service-worker and installation behaviour.

## Structure

- `index.html`: application shell and PWA metadata
- `styles.css`: responsive fantasy operations-desk interface
- `engine.js`: pure seeded combat and forecast engine
- `game.js`: state, timers, tutorial and interface
- `manifest.webmanifest`: installable app metadata
- `sw.js`: offline asset cache
- `.openai/hosting.json`: link to the existing private Sites project
