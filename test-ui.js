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
assert.match(styles, /info-wrap>\.info-popover[^}]*display:none/, 'Nested identity styles must not force contextual tooltips open');
assert.doesNotMatch(source, /function helpPanel/, 'Help must be contextual rather than occupying a permanent panel');
assert.match(source, /craftDuration = state\.tutorial === 'forge' \? 10 : 30/, 'The guided first craft must be shortened to ten seconds');

function renderState(savedState, storageKey) {
  const app = { innerHTML: '' };
  const storage = new Map();
  if (savedState) storage.set(storageKey || 'adventure-company-prototype-v3', JSON.stringify(savedState));
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
    saveVersion: 3,
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

const tavern = renderState(playing({ activeBuilding: 'tavern' }));
assert.match(tavern, /2 configurable recovery slots|Slot 2/);
assert.match(tavern, /Place selected hero/);

const busyTavern = renderState(playing({
  activeBuilding: 'tavern',
  selectedHero: 'orin',
  activities: { expedition: null, craft: null, facilities: { tavern: [{ hero: 'orin', endsAt: Date.now() + 30000, effects: { readiness: 25, mana: 20 } }, null], infirmary: [null] } }
}));
assert.match(busyTavern, /Selected hero is busy/);
assert.doesNotMatch(busyTavern, /Assign Orin Vale/);

const roster = renderState(playing({ view: 'roster' }));
assert.match(roster, />Ward</);
assert.match(roster, />Accuracy</);
assert.match(roster, />Critical</);
assert.match(roster, /Main hand/);
assert.match(roster, />Traits</);
assert.doesNotMatch(roster, /title=/, 'Help terms must not trigger duplicate native tooltips');

const equipment = renderState(playing({
  view: 'inventory',
  equipmentSlot: 'mainHand',
  inventory: [{ id: 'test-sword', key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Test' }]
}));
assert.match(equipment, /Choose Main hand/);
assert.match(equipment, /Showing equipment compatible with this hero and slot/);
assert.match(equipment, /data-action="equip-item"/);
assert.match(equipment, /data-action="cancel-equipment-choice"/);

const preparation = renderState(playing({ view: 'expeditions', expeditionScreen: 'prepare' }));
assert.match(preparation, />WARD</);
assert.match(preparation, /class="info-popover"/);
assert.match(preparation, /Vanguard/);

const inventory = renderState(playing({
  view: 'inventory',
  inventory: [{ id: 'test-sword', key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Forged in the Company Workshop' }]
}));
assert.match(inventory, /Usable by/);
assert.match(inventory, /Forged in the Company Workshop/);
assert.match(inventory, /1\/12 occupied/);
assert.equal((inventory.match(/inventory-empty-slot/g) || []).length, 11);
assert.match(inventory, /Dismantle for 1 scrap/);
assert.doesNotMatch(inventory, /View Elara/);
assert.doesNotMatch(inventory, /data-action="equip-item"/);

const fullItems = Array.from({ length: 12 }, (_, index) => ({ id: 'sword-' + index, key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Test' }));
const fullWorkshop = renderState(playing({ view: 'town', activeBuilding: 'workshop', gold: 999, scrap: 999, inventory: fullItems }));
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
