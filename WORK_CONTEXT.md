# Adventure Company: Work Context

Read this first for implementation work. Treat the code as authoritative if this summary disagrees with it. Keep this file compact and replace obsolete statements rather than appending history.

## Current product

- **Prototype:** 0.7.0, save schema 7, deployed as a static installable PWA on GitHub Pages.
- **Premise:** manage a persistent fantasy adventuring company. Prepare one to three heroes, equipment, approach and supplies; send them on autonomous timed expeditions; review the seeded combat account; then recover, craft and improve the company.
- **Product direction:** fun-first, low-animation and system-led, with modest development scope. Avoid exploitative gacha and intrusive advertising. The current slice validates the Town, expedition, recovery, equipment and supply loop.

## Architecture and system map

```text
index.html + styles.css
        |
game.js: state, saves, timers, tutorial, Town and all UI/actions
        |
engine.js: data-led heroes, moves, encounters, seeded combat and forecasts
        |
localStorage save + service worker cache
        |
build.mjs -> dist/ -> GitHub Pages
```

- No framework, server or account system. State is local to the browser and may be exported/imported as JSON.
- `game.js` uses `window.AdventureEngine`; `engine.js` is also CommonJS-compatible for Node tests.
- Activities store absolute end times, so expeditions, crafting and recovery resolve after the game is closed.
- `npm test` performs syntax, engine and rendered-interface smoke checks; `npm run build` packages the static PWA.

## Implemented systems

- **Heroes and progression:** four fixed heroes/classes, class-specific stat growth, XP/levels, multi-trait display/effects, class moves through level 5, physical/magical damage, Armour/Ward, Speed/Evasion/Accuracy/Critical and Fire Resistance.
- **Combat:** deterministic seeded automatic combat with named hero/enemy moves, action order, misses, criticals, mitigation, healing and retrospective logs. Zero Health causes Injury, never death.
- **Forecasting:** 400 simulations using current condition, equipment, approach and supplies; reports serious-outcome danger, success, injury chance and expected Health loss.
- **Expeditions:** Abandoned Road, Briar Den and Cinder Watch; staged unlocks, Favoured explanations, one active party per location and concurrent expeditions at different locations. Party size is 1–3. Approaches are Careful, Standard, Aggressive and Scavenge.
- **Condition and recovery:** Health, persistent Mana and Readiness. Tavern has two slots and gradually restores all three; leaving early preserves accrued recovery. Infirmary has one slot, restores Health faster and clears persistent Injury only when treatment completes; it restores neither Mana nor Readiness. No passive recovery.
- **Supplies:** two-slot party pouch. Field Tonics and Mana Draughts are reserved on departure, used automatically at defined thresholds and returned if unused. Forecasts and logs include them.
- **Town:** spatial hub with Tavern, Workshop and Infirmary active; Guild Hall and Temple are labelled future facilities. Persistent roster rail/drawer shows live condition and activity.
- **Crafting and inventory:** timed Workshop, Craft XP, Iron Sword, Field Tonic and Mana Draught recipes. Twelve equipment-storage slots, safe Workshop overflow, filtering by hero/slot, equip/unequip and dismantling. Consumables stack separately.
- **Equipment:** nine visible slots: main hand, off hand, head, neck, chest, legs, feet, ring and trinket. Only the Iron Sword is currently implemented; it gives +4 Attack and is usable by Vanguard, Ranger and Skirmisher. Engine support exists for future equipment loot modifiers.
- **Tutorial/admin/PWA:** guided opening with interaction locking/highlights, context-sensitive recovery recommendation, five-second first expedition and first Iron Sword craft, seed controls, timer completion, hero condition/level controls, encounter replay, save import/export, offline shell and install prompt.

## Design invariants

- Expeditions resolve from preparation; they must not require a mid-expedition decision or notification response.
- Forecasts and completed combat use the same underlying simulation rules. A dispatched encounter is fixed by its seed and recorded inputs.
- Heroes persist. No routine permadeath or capture system; defeat creates condition, recovery and resource consequences.
- No equipment durability or routine damage. Cursed items and purification may exist later as exceptional content.
- Readiness discourages repeatedly using the same heroes but should not become punitive busywork.
- Tavern recovery is gradual and interruptible; Infirmary treatment is specialised, binary for Injury, and never restores Readiness.
- Expedition supplies are a small loadout, not unlimited inventory access. Unused consumables return to stores.
- Multiple heroes may form a party, solo expeditions remain valid, and different locations may run concurrently.
- Equipment is changed through the hero character sheet; the general Inventory is for inspection/storage rather than direct hero-specific shortcuts.
- Content should be data-led so heroes, traits, moves, equipment and expeditions can be added without bespoke screens or combat-log fiction.
- Equipment compatibility and future affixes should be class/slot-smart. Best gear is intended to involve crafting and expedition materials; fixed legendary items may later be exceptions.
- Planned prestige is per hero, not a forced company-wide reset. Earlier heroes may support others before being prestiged. Intended level bands are 10/20/30/40, but these are not implemented.
- Authored/special heroes may exist later, but ordinary recruits and player-built identities remain useful. No paid random hero packs.
- Top-down browser layout is intentional; the visual hierarchy may borrow from Darkest Dungeon without copying its art or exact interface.

## Partial, deferred and temporary

- **Recruitment/Tavern roster generation:** not implemented. Current roster is fixed at four; daily tavern candidates, trait pairing and roster caps remain to design/build.
- **Prestige and higher progression bands:** not implemented. Current levelling continues every 100 XP and moves stop unlocking after level 5.
- **Items:** most slots, armour categories, affixes, rarity/quality rolls, fixed legendary items, enchantment and cursed/purified items are not implemented.
- **Crafting depth:** no crafting level/quality chance, smart affix rolls or broader material economy yet. Workshop capacity is one craft at a time.
- **Facilities/company growth:** no upgrades, slot expansion, jobs, research, scouting, shop, Temple service or Guild Hall function.
- **Conditions:** Injury is currently a single boolean; diseases, curses and richer injuries/quirks are deferred.
- **Expedition utility gear:** reward-modifier plumbing exists, but no loot-improving item is currently obtainable.
- **Balance/content:** the three encounters and four classes are test content, not final tuning. A formal progression/economy balance pass remains necessary.
- **Tutorial concessions:** the first Abandoned Road run and first sword craft are five seconds; the first expedition guarantees at least three scrap. Normal timings then apply.
- **Persistence:** saves are browser-local. Clearing site data removes progress unless the save was exported.

## Key files

| Area | Primary location |
|---|---|
| Hero, trait, move, growth, enemy, encounter, approach and supply data | `engine.js` constants |
| Battle resolution, rewards, forecasting and encounter seeds | `engine.js` simulation functions |
| Save schema/migration, inventory, facilities, timers and actions | `game.js` state and action functions |
| Town, expedition, roster, inventory, Workshop, tutorial and admin rendering | `game.js` render functions |
| Responsive layout, roster rail, meters, tooltips and tutorial mask | `styles.css` |
| PWA shell | `index.html`, `manifest.webmanifest`, `sw.js` |
| Packaging/deployment | `build.mjs`, `.github/workflows/check.yml`, `.github/workflows/pages.yml` |
| Regression checks | `test-engine.js`, `test-ui.js` |
| Player/developer overview | `README.md` |

## Immediate development state

- 0.7 is deployed and its checks pass. Recovery and expedition supplies are ready for focused playtesting.
- Next, validate recovery pacing, potion consumption/return behaviour, tutorial clarity and early gold/herb pressure. Fix concrete defects before broadening scope.
- Once this loop is stable, the next agreed major system is **recruitment and roster growth**, followed by prestige/progression bands and deeper item/crafting generation. Do not start these as incidental refactors.
