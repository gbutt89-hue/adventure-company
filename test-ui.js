'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('./engine.js');
const source = fs.readFileSync('./game.js', 'utf8');

assert.doesNotMatch(source, /state\.resultClaimed \|\| !state\.currentResult/, 'A stale claim flag must not block an unclaimed visible result');
assert.match(source, /active\.scrollIntoView/, 'Tutorial targets must be moved clear of the fixed guidance card');

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

const roster = renderState(playing({ view: 'roster' }));
assert.match(roster, />Ward</);
assert.match(roster, />Accuracy</);
assert.match(roster, />Critical</);
assert.match(roster, /Main hand/);
assert.doesNotMatch(roster, /title=/, 'Help terms must not trigger duplicate native tooltips');

const preparation = renderState(playing({ view: 'expeditions', expeditionScreen: 'prepare' }));
assert.match(preparation, />WARD</);
assert.match(preparation, /Select an underlined term/);
assert.match(preparation, /Vanguard/);

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
