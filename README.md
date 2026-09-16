# Adventure Company

A mobile-first, installable browser prototype for a fantasy expedition company management game.

## Prototype 0.7.1

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
- twelve-slot company storage, filtered equipment selection, dismantling and safe Workshop overflow
- a three-slot expedition company with a scalable compact roster picker
- a Darkest Dungeon-inspired character information hierarchy
- a fourth light-armoured hero, Sable Reed
- separate Speed and Evasion statistics, plus visible Fire resistance
- explicit caster Mana pools and clearer Health, Mana, Readiness and XP indicators
- multi-trait hero data and presentation
- separate serious-outcome risk and expected-wear forecasts
- three expedition locations with staged unlocks and distinct physical, evasive and magical/fire threats
- concurrent expeditions across different locations, with one activity slot per location
- Careful, Standard, Aggressive and Scavenge expedition approaches
- encounter-specific Favoured indicators with exact explanations
- live Health, Mana, Readiness and XP meters in the hero rail
- data-driven class moves with level-one choices and new unlocks through level five
- character-sheet move progression with real Mana, accuracy, critical and defence-piercing effects
- class-specific attribute growth at every hero level, reflected across combat and the interface
- data-driven enemy moves with named attacks and encounter-specific mechanics
- level-up outcome cards with newly unlocked moves
- transparent base, level, equipment and Readiness contributions on the character sheet
- administrative hero level and condition controls for rapid balance testing
- five-second guided expedition and first craft timings with explicit tutorial explanations
- a two-slot expedition supply pouch with reserved stock, automatic conditional use and unused-item returns
- Field Tonic and Mana Draught crafting, storage, forecasting and encounter-log integration
- explicit Trigger and On use descriptions for expedition supplies
- condition-based Tavern recovery for Health, Mana and Readiness, including early departure with partial benefit
- a faster Health-focused Infirmary that treats persistent Injuries without restoring Mana or Readiness
- live recovery projections in the roster rail and enforced Infirmary treatment for Injured heroes
- approach-adjusted reward previews and weighted per-expedition loot tables
- Iron Ore and Common Herbs stored as inventory materials rather than global resources
- no XP when every dispatched hero returns Injured

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
- `.github/workflows/pages.yml`: tests and deploys the public GitHub Pages build
