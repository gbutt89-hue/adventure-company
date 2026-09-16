'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('./engine.js');
const source = fs.readFileSync('./game.js', 'utf8');
const styles = fs.readFileSync('./styles.css', 'utf8');

assert.doesNotMatch(source, /state\.resultClaimed \|\| !state\.currentResult/, 'A stale claim flag must not block an unclaimed visible result');
assert.match(source, /active\.scrollIntoView/, 'Tutorial targets must be moved clear of the fixed guidance card');
assert.match(source, /tutorial-active/, 'Tutorial pages must reserve enough room to reveal highlighted controls');
assert.match(source, /function tutorialAllows/, 'The tutorial must gate interactions to its current target');
assert.match(styles, /primary-nav\.tutorial-layer/, 'Top navigation must be lifted above the tutorial shade');
assert.match(styles, /\.tooltip-popover\{[^}]*position:fixed[^}]*display:none/, 'Contextual tooltips must use one hidden, viewport-positioned popover');
assert.match(source, /function bindTooltips/, 'All contextual help must share viewport-aware tooltip positioning');
assert.doesNotMatch(source, /function helpPanel/, 'Help must be contextual rather than occupying a permanent panel');
assert.match(source, /first \? 5 : encounter\.duration/, 'The guided first expedition must be shortened to five seconds');
assert.match(source, /state\.tutorial === 'forge' && recipe\.key === 'iron-sword' \? 5 : recipe\.duration/, 'The guided first craft must be shortened to five seconds');
assert.match(source, /data-tutorial-target="send-expedition"/, 'The whole forecast panel must lift above the tutorial shade so Send party remains clear');

function renderState(savedState, storageKey) {
  const app = { innerHTML: '' };
  const storage = new Map();
  if (savedState) storage.set(storageKey || 'adventure-company-prototype-v4', JSON.stringify(savedState));
  const document = {
    modelContext: null,
    getElementById(id) { return id === 'app' ? app : null; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const window = { AdventureEngine: E, addEventListener() {} };
  const context = {
    window,
    document,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); }
    },
    navigator: {},
    crypto: require('node:crypto').webcrypto,
    Blob,
    URL,
    setInterval() {}
  };
  vm.runInNewContext(source, context, { filename: 'game.js' });
  return app.innerHTML;
}

function playing(overrides) {
  return Object.assign({
    saveVersion: 4,
    stage: 'playing',
    companyName: 'Test Company',
    view: 'town',
    expeditionScreen: 'list',
    selectedHero: 'elara',
    selectedParty: ['elara', 'fen', 'orin'],
    tutorialSkipped: true,
    tutorial: null
  }, overrides || {});
}

const intro = renderState(null);
assert.match(intro, /Found a company/);

const town = renderState(playing());
assert.match(town, />Town</);
assert.match(town, /<strong>Tavern<\/strong>/);
assert.match(town, /<strong>Workshop<\/strong>/);
assert.match(town, /Company roster/);
assert.match(town, /Sable Reed/);
assert.match(town, /aria-label="Health: 44 of 44"/);
assert.doesNotMatch(town, /aria-label="Mana: 0 of 0"/);

const wornRail = renderState(playing({ heroes: { elara: { health: 50, mana: 0, readiness: 40, xp: 25 } } }));
assert.match(wornRail, /aria-label="Health: 22 of 44"/);
assert.match(wornRail, /aria-label="Readiness: 40 of 100"/);
assert.match(wornRail, /aria-label="Experience: 25 of 100"/);
assert.match(wornRail, /class="mini-meter health"[^>]*>[\s\S]*?--meter-percent:50%/, 'Rail Health must render its actual percentage');
assert.match(wornRail, /class="mini-meter ready"[^>]*>[\s\S]*?--meter-percent:40%/, 'Rail Readiness must render its actual percentage');
assert.match(wornRail, /class="mini-meter xp"[^>]*>[\s\S]*?--meter-percent:25%/, 'Rail Experience must render its actual percentage');
assert.match(wornRail, /class="tooltip-wrap meter-tooltip"[\s\S]*?<strong>Health<\/strong><span>22 \/ 44<\/span>/, 'Rail meters must expose current and maximum values through the shared tooltip');
assert.match(styles, /\.meter\.health i,\.result-meter\.health \.after/, 'Large meter colours must be scoped so they cannot overwrite rail gradients');
assert.doesNotMatch(styles, /\}\.health i,\.result-meter\.health/, 'Unscoped condition colours must not make every rail bar appear full');
assert.match(styles, /rail-copy>em/,'Rail status styling must not override meter fills');

const recoveringRail = renderState(playing({
  heroes: { elara: { health: 50, mana: 0, readiness: 40, xp: 25 } },
  activities: { expeditions: {}, craft: null, facilities: { tavern: [{ hero: 'elara', title: 'Room and board', startedAt: Date.now() - 10000, endsAt: Date.now() + 40000, duration: 50, rates: { health: 1, mana: 2, readiness: 2 }, startState: { health: 50, mana: 0, readiness: 40, xp: 25, injured: false } }, null], infirmary: [null] } }
}));
assert.match(recoveringRail, /aria-label="Health: 26 of 44"/, 'The roster rail must show recovery accrued so far');
assert.match(recoveringRail, /aria-label="Readiness: 60 of 100"/, 'The roster rail must project live Tavern Readiness recovery');

const tavern = renderState(playing({ activeBuilding: 'tavern' }));
assert.match(tavern, /2 configurable recovery slots|Slot 2/);
assert.match(tavern, /Place selected hero/);
assert.match(tavern, /Health, Mana and Readiness/);

const busyTavern = renderState(playing({
  activeBuilding: 'tavern',
  selectedHero: 'orin',
  activities: { expedition: null, craft: null, facilities: { tavern: [{ hero: 'orin', endsAt: Date.now() + 30000, effects: { readiness: 25, mana: 20 } }, null], infirmary: [null] } }
}));
assert.match(busyTavern, /Selected hero is busy/);
assert.doesNotMatch(busyTavern, /Assign Orin Vale/);

const infirmary = renderState(playing({
  activeBuilding: 'infirmary', selectedHero: 'elara',
  heroes: { elara: { health: 40, mana: 0, readiness: 25, xp: 0, injured: true } },
  activities: { expeditions: {}, craft: null, facilities: { tavern: [null, null], infirmary: [{ hero: 'elara', title: 'Receive treatment', startedAt: Date.now(), endsAt: Date.now() + 30000, duration: 30, rates: { health: 3 }, startState: { health: 40, mana: 0, readiness: 25, xp: 0, injured: true } }] } }
}));
assert.match(infirmary, /does not restore Mana or Readiness/);
assert.match(infirmary, /On completion: 100% Health · Injury treated/);
assert.match(infirmary, /Leave early/);
assert.doesNotMatch(infirmary, /On completion:[^<]*Readiness/, 'Infirmary recovery must not include Readiness');

const injuredForInfirmary = renderState(playing({
  activeBuilding: 'infirmary', selectedHero: 'elara', gold: 20,
  heroes: { elara: { health: 40, mana: 0, readiness: 25, xp: 0, injured: true } }
}));
assert.match(injuredForInfirmary, /Assign Elara Voss/);
assert.match(injuredForInfirmary, /data-action="assign-facility" data-facility="infirmary" data-slot="0" >Place selected hero/, 'An injured available hero with enough gold must be assignable to the Infirmary');
const injuredForTavern = renderState(playing({
  activeBuilding: 'tavern', selectedHero: 'elara', gold: 20,
  heroes: { elara: { health: 40, mana: 0, readiness: 25, xp: 0, injured: true } }
}));
assert.match(injuredForTavern, /Injured heroes require treatment at the Infirmary/);
assert.match(injuredForTavern, /data-action="assign-facility" data-facility="tavern" data-slot="0" disabled/, 'An injured hero must not use the Tavern instead of treatment');

const softlockedInfirmary = renderState(playing({
  activeBuilding: 'infirmary', selectedHero: 'fen', gold: 0,
  heroes: {
    elara: { health: 3, injured: true }, fen: { health: 8, injured: true },
    orin: { health: 10, injured: true }, sable: { health: 5, injured: true }
  }
}));
assert.match(softlockedInfirmary, /Emergency Treatment/);
assert.match(softlockedInfirmary, /data-action="emergency-treatment" data-hero="fen"/, 'The player-selected injured hero must be the explicit emergency-treatment target');
assert.match(softlockedInfirmary, /25% Health/);
assert.match(softlockedInfirmary, /0 gold/);
const affordableInfirmary = renderState(playing({
  activeBuilding: 'infirmary', selectedHero: 'fen', gold: 15,
  heroes: {
    elara: { health: 3, injured: true }, fen: { health: 8, injured: true },
    orin: { health: 10, injured: true }, sable: { health: 5, injured: true }
  }
}));
assert.doesNotMatch(affordableInfirmary, /Emergency Treatment/, 'Emergency Treatment must disappear when normal treatment is affordable');
const rewardsAvailableInfirmary = renderState(playing({
  activeBuilding: 'infirmary', selectedHero: 'fen', gold: 0,
  heroes: {
    elara: { health: 3, injured: true }, fen: { health: 8, injured: true },
    orin: { health: 10, injured: true }, sable: { health: 5, injured: true }
  },
  expeditionResults: { 'abandoned-road': { rewards: { gold: 20, materials: {}, xp: 0 } } }
}));
assert.doesNotMatch(rewardsAvailableInfirmary, /Emergency Treatment/, 'Unclaimed affordable treatment money must prevent free stabilisation');

const roster = renderState(playing({ view: 'roster' }));
assert.match(roster, />Ward</);
assert.match(roster, />Evasion</);
assert.match(roster, />Fire</);
assert.match(roster, />Accuracy</);
assert.match(roster, />Critical</);
assert.match(roster, /Main hand/);
assert.match(roster, />Traits</);
assert.match(roster, /Combat moves/);
assert.match(roster, /Measured Strike/);
assert.match(roster, /Guarded Lunge/);
assert.doesNotMatch(roster, /title=/, 'Help terms must not trigger duplicate native tooltips');

const levelledRoster = renderState(playing({
  view: 'roster',
  selectedHero: 'elara',
  heroes: { elara: { health: 100, mana: 0, readiness: 100, xp: 100 } }
}));
assert.match(levelledRoster, /aria-label="Health" aria-valuenow="48"[^>]*aria-valuemax="48"/, 'Character-sheet Health capacity must scale with level');
assert.match(levelledRoster, /9 base · \+1 level/, 'Character-sheet statistics must explain their level contribution');
assert.match(levelledRoster, /From levels: \+4 maximum Health/, 'Level-derived capacity must be visible');

const levelUpResult = renderState(playing({
  view: 'expeditions',
  expeditionScreen: 'results',
  selectedExpedition: 'abandoned-road',
  expeditionResults: {
    'abandoned-road': {
      encounterKey: 'abandoned-road', success: true, approach: 'standard', rounds: 2, potionUsed: false,
      rewards: { gold: 16, materials: { 'iron-ore': 3 }, xp: 20 },
      heroes: { elara: { injured: false } }, log: ['The road is clear.'],
      changes: { elara: { before: { health: 100, mana: 0, readiness: 100, xp: 90 }, after: { health: 92, mana: 0, readiness: 80, xp: 110 }, xpGain: 20, beforeLevel: 1, afterLevel: 2, levelsGained: 1, unlockedMoves: ['Guarded Lunge'] } }
    }
  }
}));
assert.match(levelUpResult, /Level up · Level 2/);
assert.match(levelUpResult, /Unlocked Guarded Lunge/);

const adminHero = renderState(playing({
  view: 'roster', selectedHero: 'orin', devOpen: true,
  heroes: { orin: { health: 70, mana: 55, readiness: 65, xp: 100 } }
}));
assert.match(adminHero, /Editing the selected roster hero: <strong>Orin Vale<\/strong>/);
assert.match(adminHero, /id="hero-level"[^>]*value="2"/);
assert.match(adminHero, /Mana \/ 55/);
assert.match(adminHero, /data-action="set-hero-state"/);

const equipment = renderState(playing({
  view: 'inventory',
  selectedHero: 'sable',
  equipmentSlot: 'mainHand',
  inventory: [{ id: 'test-sword', key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Test' }]
}));
assert.match(equipment, /Choose Main hand/);
assert.match(equipment, /Showing equipment compatible with this hero and slot/);
assert.match(equipment, /data-action="equip-item"/);
assert.match(equipment, /data-action="cancel-equipment-choice"/);
assert.match(equipment, /Equip Sable/);
assert.match(equipment, /Vanguard or Ranger or Skirmisher/,'Old Iron Swords must migrate to current class compatibility');

const preparation = renderState(playing({ view: 'expeditions', expeditionScreen: 'prepare' }));
assert.match(preparation, /Selected company/);
assert.match(preparation, /Choose adventurers/);
assert.match(preparation, /Sable Reed/);
assert.match(preparation, /Serious outcome risk/);
assert.match(preparation, /Expected wear/);
assert.doesNotMatch(preparation, />ATK</);
assert.match(preparation, /class="tooltip-popover"/);
assert.match(preparation, /Vanguard/);
assert.match(preparation, /How should they proceed/);
assert.match(preparation, />Careful</);
assert.match(preparation, />Scavenge</);
assert.match(preparation, /Favoured/);
assert.match(preparation, /Party pouch/);
assert.match(preparation, /Field Tonic/);
assert.match(preparation, /Mana Draught/);
assert.match(preparation, /<b>Trigger:<\/b>/);
assert.match(preparation, /<b>On use:<\/b>/);
assert.match(preparation, /All expeditions/);
assert.match(preparation, /Expected rewards/);
assert.ok(preparation.indexOf('Selected company') < preparation.indexOf('Party pouch'), 'Supplies must sit beneath company selection');
assert.ok(preparation.indexOf('Packed supplies') < preparation.indexOf('Available supplies'), 'Chosen supplies must be shown before available stock');
assert.match(preparation, /returned if unused/);
assert.doesNotMatch(preparation, /favoured-popover/, 'Favoured must use the shared tooltip implementation');

const expeditionBoard = renderState(playing({ view: 'expeditions', firstExpeditionComplete: true, completedExpeditions: { 'briar-den': 1 } }));
assert.match(expeditionBoard, /Abandoned Road/);
assert.match(expeditionBoard, /Forage the Outskirts/);
assert.match(expeditionBoard, /Very Easy/);
assert.match(expeditionBoard, /Briar Den/);
assert.match(expeditionBoard, /Cinder Watch/);

const concurrentBoard = renderState(playing({
  view: 'expeditions', firstExpeditionComplete: true,
  activities: { expeditions: {
    'abandoned-road': { party: ['elara'], approach: 'standard', duration: 25, endsAt: Date.now()+25000 },
    'briar-den': { party: ['fen'], approach: 'scavenge', duration: 45, endsAt: Date.now()+45000 }
  }, craft: null, facilities: { tavern: [null,null], infirmary: [null] } }
}));
assert.match(concurrentBoard, /Elara is away/);
assert.match(concurrentBoard, /Fen is away/);
assert.match(concurrentBoard, /Scavenge approach/);

const inventory = renderState(playing({
  view: 'inventory',
  inventory: [{ id: 'test-sword', key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Forged in the Company Workshop' }]
}));
assert.match(inventory, /Usable by/);
assert.match(inventory, /Forged in the Company Workshop/);
assert.match(inventory, /1\/12 occupied/);
assert.equal((inventory.match(/inventory-empty-slot/g) || []).length, 11);
assert.match(inventory, /Dismantle for 1 Iron Ore/);
assert.doesNotMatch(inventory, /View Elara/);
assert.doesNotMatch(inventory, /data-action="equip-item"/);
assert.match(inventory, /Company supplies/);
assert.match(inventory, /Recovered materials/);
assert.match(inventory, /2 available/);

const expandedWorkshop = renderState(playing({ view: 'town', activeBuilding: 'workshop', gold: 99, materials: { 'iron-ore': 9, 'common-herb': 9, ashwood: 9, 'tanned-hide': 9 } }));
assert.match(expandedWorkshop, /Ashwood Club/);
assert.match(expandedWorkshop, /Hunting Bow/);
assert.match(expandedWorkshop, /2 Ashwood/);

const craftingTutorial = renderState(playing({ view: 'town', activeBuilding: 'workshop', tutorialSkipped: false, tutorial: 'crafting', activities: { expeditions: {}, craft: { recipeKey: 'iron-sword', title: 'Iron Sword', startedAt: Date.now(), endsAt: Date.now() + 5000, duration: 5 }, facilities: { tavern: [null, null], infirmary: [null] } } }));
assert.doesNotMatch(craftingTutorial, /class="tutorial-shade"/, 'The guided craft wait must keep the game screen light');
assert.match(craftingTutorial, /tutorial-card passive/);
const tutorialComplete = renderState(playing({ tutorialSkipped: false, tutorial: 'tutorial-complete' }));
assert.match(tutorialComplete, /Guided opening complete/);
assert.match(tutorialComplete, /data-action="finish-tutorial"/);

const fullItems = Array.from({ length: 12 }, (_, index) => ({ id: 'sword-' + index, key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Test' }));
const fullWorkshop = renderState(playing({ view: 'town', activeBuilding: 'workshop', gold: 999, materials: { 'iron-ore': 999, 'common-herb': 999 }, inventory: fullItems }));
assert.match(fullWorkshop, /12\/12 inventory slots occupied/);
assert.match(fullWorkshop, /data-action="craft"[^>]*disabled/);
assert.match(fullWorkshop, /Manage Inventory/);

const waitingWorkshop = renderState(playing({ view: 'town', activeBuilding: 'workshop', inventory: fullItems, workshopOutput: { id: 'waiting', key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4 } }));
assert.match(waitingWorkshop, /remain safely here/);
assert.match(waitingWorkshop, /data-action="store-workshop-output"[^>]*disabled/);

const migrated = renderState({
  saveVersion: 2,
  stage: 'headquarters',
  companyName: 'Old Company',
  gold: 42,
  scrap: 3,
  swordCrafted: true,
  heroes: { elara: { health: 80, mana: 30, readiness: 70, xp: 12 } },
  activities: { expedition: null, craft: null, recovery: null }
}, 'adventure-company-prototype-v2');
assert.match(migrated, /Old Company/);
assert.match(migrated, />Town</);

console.log('Adventure Company interface smoke checks passed.');
