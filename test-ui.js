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
assert.match(styles, /rail-copy>em/,'Rail status styling must not override meter fills');

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
assert.match(roster, />Evasion</);
assert.match(roster, />Fire</);
assert.match(roster, />Accuracy</);
assert.match(roster, />Critical</);
assert.match(roster, /Main hand/);
assert.match(roster, />Traits</);
assert.doesNotMatch(roster, /title=/, 'Help terms must not trigger duplicate native tooltips');

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
assert.match(preparation, /class="info-popover"/);
assert.match(preparation, /Vanguard/);
assert.match(preparation, /How should they proceed/);
assert.match(preparation, />Careful</);
assert.match(preparation, />Scavenge</);
assert.match(preparation, /Favoured/);

const expeditionBoard = renderState(playing({ view: 'expeditions', firstExpeditionComplete: true, completedExpeditions: { 'briar-den': 1 } }));
assert.match(expeditionBoard, /Abandoned Road/);
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
