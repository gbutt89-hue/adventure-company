(function () {
  'use strict';

  var E = window.AdventureEngine;
  var SAVE_KEY = 'adventure-company-prototype-v4';
  var LEGACY_KEYS = ['adventure-company-prototype-v3', 'adventure-company-prototype-v2', 'adventure-company-prototype-v1'];
  var DEFAULT_INVENTORY_CAPACITY = 12;
  var installPrompt = null;
  var draggedHero = null;

  var HERO_UI = {
    elara: { initials: 'EV', colour: 'rust' },
    fen: { initials: 'FA', colour: 'green' },
    orin: { initials: 'OV', colour: 'violet' },
    sable: { initials: 'SR', colour: 'blue' }
  };

  var STAT_INFO = {
    attack: 'Base damage before variation and mitigation. Low Readiness can reduce it.',
    armour: 'Reduces incoming physical damage. It does not protect against magical damage.',
    ward: 'Reduces incoming magical damage. It does not protect against physical damage.',
    speed: 'Influences action order each round. Low Readiness can reduce it.',
    accuracy: 'The chance that an attack connects, reduced by the target’s Evasion.',
    evasion: 'Reduces an attacker’s chance to hit. It does not change action order.',
    critical: 'The base chance that a successful attack becomes a critical hit.',
    fire: 'Reduces the fire-tagged portion of incoming damage. It does not affect ordinary physical or magical damage.',
    health: 'Physical condition. A hero begins the next expedition at their current Health.',
    mana: 'Powers magical actions. A Caster without enough Mana uses a weaker basic attack.',
    readiness: 'Fatigue and preparation. Below 70 reduces Attack and Speed; below 40 reduces them further.'
  };

  var SLOT_LABELS = {
    mainHand: 'Main hand', offHand: 'Off hand', head: 'Head', neck: 'Neck', chest: 'Chest',
    legs: 'Legs', feet: 'Feet', ring: 'Ring', trinket: 'Trinket'
  };

  var FACILITIES = {
    tavern: {
      name: 'The Lantern Tavern', shortName: 'Tavern', icon: '♨', slots: 2, working: true,
      description: 'A warm meal and an undisturbed bed restore a hero’s Readiness. Casters also recover some Mana.',
      activity: 'Room and board', cost: 5, duration: 30, effects: { readiness: 25, mana: 20 }
    },
    infirmary: {
      name: 'Company Infirmary', shortName: 'Infirmary', icon: '✚', slots: 1, working: true,
      description: 'The company chirurgeon treats wounds and returns heroes to fighting condition.',
      activity: 'Receive treatment', cost: 8, duration: 40, effects: { health: 35 }
    },
    workshop: {
      name: 'Company Workshop', shortName: 'Workshop', icon: '⚒', working: true,
      description: 'Recovered materials become dependable equipment. Finished items go into company inventory.'
    },
    guild: {
      name: 'Guild Hall', shortName: 'Guild Hall', icon: '⚑', working: false,
      description: 'Future recruits will answer notices here. Training and individual prestige may also belong here.'
    },
    temple: {
      name: 'Old Temple', shortName: 'Temple', icon: '✦', working: false,
      description: 'A future home for resurrection, purification and the treatment of supernatural afflictions.'
    }
  };

  function emptyEquipment() {
    return { mainHand: null, offHand: null, head: null, neck: null, chest: null, legs: null, feet: null, ring: null, trinket: null };
  }

  function emptyFacilities() { return { tavern: [null, null], infirmary: [null] }; }

  function fresh() {
    return {
      saveVersion: 5, stage: 'intro', view: 'town', expeditionScreen: 'list', activeBuilding: null,
      companyName: '', gold: 20, scrap: 0, herbs: 0, seed: '731942', runNumber: 0,
      selectedParty: ['elara', 'fen', 'orin'], selectedHero: 'elara', selectedExpedition: 'abandoned-road', selectedApproach: 'standard', firstExpeditionComplete: false,
      tutorial: 'town-expeditions', tutorialSkipped: false, rosterOpen: false, devOpen: false, notice: null,
      currentResult: null, lastResult: null, resultContext: null, resultClaimed: false, expeditionResults: {}, completedExpeditions: {},
      selectedInventoryItem: null, equipmentSlot: null, showIncompatibleItems: false, pendingDismantleId: null, completedActivity: null,
      inventoryCapacity: DEFAULT_INVENTORY_CAPACITY, workshopOutput: null,
      craftXp: 0, lastCraftXpGain: 0, nextItemId: 1, inventory: [],
      equipment: { elara: emptyEquipment(), fen: emptyEquipment(), orin: emptyEquipment(), sable: emptyEquipment() },
      activities: { expeditions: {}, craft: null, facilities: emptyFacilities() },
      heroes: {
        elara: { health: 100, mana: 0, readiness: 100, xp: 0 },
        fen: { health: 100, mana: 0, readiness: 100, xp: 0 },
        orin: { health: 100, mana: 45, readiness: 100, xp: 0 },
        sable: { health: 100, mana: 0, readiness: 100, xp: 0 }
      }
    };
  }

  function migrate(old) {
    var next = fresh();
    if (!old || typeof old !== 'object') return next;
    ['companyName', 'gold', 'scrap', 'herbs', 'seed', 'runNumber', 'craftXp', 'lastCraftXpGain', 'tutorialSkipped', 'resultContext', 'resultClaimed'].forEach(function (key) {
      if (old[key] !== undefined) next[key] = old[key];
    });
    if (old.heroes) next.heroes = Object.assign(next.heroes, old.heroes);
    if (old.companyName) next.stage = 'playing';
    next.firstExpeditionComplete = Boolean(old.swordCrafted || old.swordEquipped || old.runNumber > 0);
    if (old.swordEquipped) next.equipment.elara.mainHand = ironSword('legacy-iron-sword');
    else if (old.swordCrafted) next.inventory.push(ironSword('legacy-iron-sword'));
    if (old.activities) {
      if (old.activities.expedition) next.activities.expeditions['abandoned-road'] = old.activities.expedition;
      next.activities.craft = old.activities.craft || null;
      if (old.activities.recovery) next.activities.facilities.tavern[0] = old.activities.recovery;
    }
    if (old.currentResult) next.currentResult = old.currentResult;
    if (old.lastResult) next.lastResult = old.lastResult;
    if (old.stage === 'results') { next.view = 'expeditions'; next.expeditionScreen = 'results'; }
    else if (Object.keys(next.activities.expeditions).length) { next.view = 'expeditions'; next.expeditionScreen = 'list'; }
    next.tutorial = next.tutorialSkipped ? null : (next.firstExpeditionComplete ? null : 'town-expeditions');
    return next;
  }

  function normalise(value) {
    var base = fresh();
    var next = Object.assign(base, value || {});
    next.saveVersion = 5;
    next.heroes = Object.assign(base.heroes, next.heroes || {});
    next.equipment = Object.assign(base.equipment, next.equipment || {});
    Object.keys(E.HEROES).forEach(function (key) { next.equipment[key] = Object.assign(emptyEquipment(), next.equipment[key] || {}); });
    next.activities = Object.assign(base.activities, next.activities || {});
    next.activities.expeditions = Object.assign({}, next.activities.expeditions || {});
    if (next.activities.expedition) {
      next.activities.expeditions['abandoned-road'] = next.activities.expedition;
      delete next.activities.expedition;
    }
    Object.keys(next.activities.expeditions).forEach(function (key) {
      if (!E.ENCOUNTERS[key]) { delete next.activities.expeditions[key]; return; }
      next.activities.expeditions[key] = Object.assign({ encounterKey: key, title: E.ENCOUNTERS[key].name, approach: 'standard' }, next.activities.expeditions[key]);
    });
    next.expeditionResults = Object.assign({}, next.expeditionResults || {});
    next.completedExpeditions = Object.assign({}, next.completedExpeditions || {});
    if (next.currentResult && next.resultContext !== 'admin' && next.expeditionScreen === 'results' && !next.expeditionResults['abandoned-road']) {
      next.expeditionResults['abandoned-road'] = next.currentResult;
      next.currentResult = null;
    }
    next.activities.facilities = Object.assign(emptyFacilities(), next.activities.facilities || {});
    Object.keys(emptyFacilities()).forEach(function (key) {
      var required = FACILITIES[key].slots;
      var slots = Array.isArray(next.activities.facilities[key]) ? next.activities.facilities[key].slice(0, required) : [];
      while (slots.length < required) slots.push(null);
      next.activities.facilities[key] = slots;
    });
    next.inventory = Array.isArray(next.inventory) ? next.inventory : [];
    next.inventory = next.inventory.map(normaliseItem);
    next.inventoryCapacity = Math.max(DEFAULT_INVENTORY_CAPACITY, Number(next.inventoryCapacity) || 0, next.inventory.length);
    next.workshopOutput = normaliseItem(next.workshopOutput);
    Object.keys(E.HEROES).forEach(function (key) {
      next.heroes[key] = Object.assign({}, base.heroes[key], next.heroes[key] || {});
      next.heroes[key].health = Math.max(1, Math.min(100, Number(next.heroes[key].health) || 100));
      next.heroes[key].readiness = Math.max(0, Math.min(100, Number(next.heroes[key].readiness) || 0));
      next.heroes[key].mana = Math.max(0, Math.min(E.HEROES[key].maxMana, Number(next.heroes[key].mana) || 0));
      next.heroes[key].xp = Math.max(0, Number(next.heroes[key].xp) || 0);
      Object.keys(next.equipment[key]).forEach(function (slot) {
        if (next.equipment[key][slot]) next.equipment[key][slot] = normaliseItem(next.equipment[key][slot]);
      });
    });
    next.selectedParty = (Array.isArray(next.selectedParty) ? next.selectedParty : ['elara', 'fen', 'orin']).filter(function (key, index, list) { return E.HEROES[key] && list.indexOf(key) === index; }).slice(0, 3);
    if (!E.HEROES[next.selectedHero]) next.selectedHero = 'elara';
    if (!E.ENCOUNTERS[next.selectedExpedition]) next.selectedExpedition = 'abandoned-road';
    if (!E.APPROACHES[next.selectedApproach]) next.selectedApproach = 'standard';
    return next;
  }

  function load() {
    try {
      var current = localStorage.getItem(SAVE_KEY);
      if (current) return normalise(JSON.parse(current));
      for (var i = 0; i < LEGACY_KEYS.length; i += 1) {
        var legacy = localStorage.getItem(LEGACY_KEYS[i]);
        if (legacy) {
          var parsed = JSON.parse(legacy);
          return parsed.saveVersion >= 3 ? normalise(parsed) : normalise(migrate(parsed));
        }
      }
    } catch (_) {}
    return fresh();
  }

  var state = load();

  function ironSword(id) {
    return { id: id, key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger', 'Skirmisher'], source: 'Forged in the Company Workshop' };
  }

  function normaliseItem(item) {
    if (!item) return item;
    if (item.key === 'iron-sword') return Object.assign(ironSword(item.id), item, { allowedRoles: ['Vanguard', 'Ranger', 'Skirmisher'] });
    return item;
  }

  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  function esc(value) { return String(value).replace(/[&<>'"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]; }); }
  function set(patch) { state = normalise(Object.assign({}, state, patch)); save(); render(); }
  function remaining(activity) { return activity ? Math.max(0, Math.ceil((activity.endsAt - Date.now()) / 1000)) : 0; }
  function inventoryFull() { return state.inventory.length >= state.inventoryCapacity; }
  function timeText(total) { return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0'); }
  function activityProgress(activity) { return activity ? Math.max(0, Math.min(100, (1 - remaining(activity) / activity.duration) * 100)) : 0; }
  function hasIronSword(key) { return Boolean(state.equipment[key] && state.equipment[key].mainHand && state.equipment[key].mainHand.key === 'iron-sword'); }
  function equipmentAttack() {
    var bonuses = {};
    Object.keys(E.HEROES).forEach(function (key) { bonuses[key] = Object.keys(state.equipment[key]).reduce(function (total, slot) { return total + Number(state.equipment[key][slot] && state.equipment[key][slot].attack || 0); }, 0); });
    return bonuses;
  }
  function equipmentSignature() { var bonuses = equipmentAttack(); return Object.keys(bonuses).sort().map(function (key) { return key + ':' + bonuses[key]; }).join(','); }
  function effectiveHeroStats(key) { return E.effectiveStats(key, { readiness: state.heroes[key].readiness, weaponBonus: equipmentAttack()[key] }); }

  function allFacilityActivities() {
    var list = [];
    Object.keys(state.activities.facilities).forEach(function (facility) {
      state.activities.facilities[facility].forEach(function (activity, index) {
        if (activity) list.push({ facility: facility, index: index, activity: activity });
      });
    });
    return list;
  }

  function allExpeditionActivities() {
    return Object.keys(state.activities.expeditions).map(function (key) { return { key: key, activity: state.activities.expeditions[key] }; }).filter(function (entry) { return Boolean(entry.activity); });
  }

  function expeditionUnlocked(key) {
    if (key === 'abandoned-road') return true;
    if (key === 'briar-den') return state.firstExpeditionComplete;
    return Number(state.completedExpeditions['briar-den'] || 0) > 0;
  }

  function heroActivity(key) {
    var expedition = allExpeditionActivities().find(function (entry) { return entry.activity.party.indexOf(key) >= 0; });
    if (expedition) return { title: E.ENCOUNTERS[expedition.key].name, remaining: remaining(expedition.activity) };
    var found = allFacilityActivities().find(function (entry) { return entry.activity.hero === key; });
    return found ? { title: FACILITIES[found.facility].shortName, remaining: remaining(found.activity) } : null;
  }

  function heroBusy(key) { return Boolean(heroActivity(key)); }

  function forecast() {
    return E.forecast({ party: state.selectedParty, heroStates: state.heroes, seed: state.seed, equipmentAttack: equipmentAttack(), encounterKey: state.selectedExpedition, approach: state.selectedApproach, samples: 400 });
  }

  function completeActivities() {
    var changed = false;
    var now = Date.now();
    allExpeditionActivities().forEach(function (entry) {
      var expeditionKey = entry.key, expedition = entry.activity;
      if (expedition.endsAt > now) return;
      var beforeStates = expedition.heroStates || state.heroes;
      var result = E.simulateBattle({ party: expedition.party, heroStates: beforeStates, equipmentAttack: expedition.equipmentAttack, seed: expedition.seed, encounterKey: expeditionKey, approach: expedition.approach, includeLog: true });
      if (expedition.context === 'first') result.rewards.scrap = Math.max(3, result.rewards.scrap);
      result.changes = {};
      expedition.party.forEach(function (key) {
        var outcome = result.heroes[key];
        var before = Object.assign({}, beforeStates[key]);
        var hero = Object.assign({}, state.heroes[key]);
        hero.health = outcome.healthPercent;
        var readinessScale = (E.APPROACHES[expedition.approach] || E.APPROACHES.standard).readiness;
        hero.readiness = Math.max(0, hero.readiness - Math.round((18 + result.rounds * 2) * readinessScale));
        hero.mana = outcome.remainingMana;
        var xpGain = E.experienceGain(key, result.rewards.xp);
        hero.xp += xpGain;
        result.changes[key] = { before: before, after: { health: hero.health, mana: hero.mana, readiness: hero.readiness, xp: hero.xp }, xpGain: xpGain };
        state.heroes[key] = hero;
      });
      state.expeditionResults[expeditionKey] = result;
      state.lastResult = { inputs: { party: expedition.party, heroStates: beforeStates, equipmentAttack: expedition.equipmentAttack, seed: expedition.seed, encounterKey: expeditionKey, approach: expedition.approach }, result: result };
      delete state.activities.expeditions[expeditionKey];
      if (!state.tutorialSkipped && expedition.context === 'first') {
        state.view = 'expeditions'; state.selectedExpedition = expeditionKey; state.expeditionScreen = 'results'; state.tutorial = 'claim-rewards';
      } else state.notice = E.ENCOUNTERS[expeditionKey].name + ' is complete. Its outcome is ready to review.';
      changed = true;
    });
    var craft = state.activities.craft;
    if (craft && craft.endsAt <= now) {
      state.activities.craft = null;
      var finishedItem = ironSword('item-' + state.nextItemId);
      state.nextItemId += 1;
      state.craftXp = Math.min(100, state.craftXp + 18);
      state.lastCraftXpGain = 18;
      if (inventoryFull()) {
        state.workshopOutput = finishedItem;
        state.notice = 'The Iron Sword is ready, but company inventory is full. It is waiting safely at the Workshop.';
      } else {
        state.inventory.push(finishedItem);
        state.notice = 'The Iron Sword is ready and has been placed in company inventory.';
      }
      state.completedActivity = { type: 'craft', label: 'Workshop: item ready' };
      if (!state.tutorialSkipped && state.tutorial === 'crafting') state.tutorial = 'open-roster';
      changed = true;
    }
    allFacilityActivities().forEach(function (entry) {
      if (entry.activity.endsAt > now) return;
      var recovered = Object.assign({}, state.heroes[entry.activity.hero]);
      var effects = entry.activity.effects || FACILITIES[entry.facility].effects || {};
      Object.keys(effects).forEach(function (stat) {
        var maximum = stat === 'mana' ? E.HEROES[entry.activity.hero].maxMana : 100;
        recovered[stat] = Math.min(maximum, recovered[stat] + effects[stat]);
      });
      state.heroes[entry.activity.hero] = recovered;
      state.activities.facilities[entry.facility][entry.index] = null;
      state.notice = E.HEROES[entry.activity.hero].name + ' has returned from ' + FACILITIES[entry.facility].shortName + '.';
      changed = true;
    });
    if (changed) save();
    return changed;
  }

  function updateLiveActivities() {
    document.querySelectorAll('[data-countdown-key]').forEach(function (element) {
      var key = element.dataset.countdownKey;
      var activity = key.indexOf('expedition:') === 0 ? state.activities.expeditions[key.split(':')[1]] : key === 'craft' ? state.activities.craft : null;
      if (activity) element.textContent = timeText(remaining(activity));
    });
    document.querySelectorAll('[data-facility-countdown]').forEach(function (element) {
      var parts = element.dataset.facilityCountdown.split(':');
      var activity = state.activities.facilities[parts[0]][Number(parts[1])];
      if (activity) element.textContent = timeText(remaining(activity));
    });
    document.querySelectorAll('[data-progress-key]').forEach(function (element) {
      var key = element.dataset.progressKey;
      var activity = key.indexOf('expedition:') === 0 ? state.activities.expeditions[key.split(':')[1]] : state.activities.craft;
      if (activity) element.style.width = activityProgress(activity) + '%';
    });
    document.querySelectorAll('[data-hero-timer]').forEach(function (element) {
      var activity = heroActivity(element.dataset.heroTimer);
      if (activity) element.textContent = activity.title + ' ' + timeText(activity.remaining);
    });
    document.querySelectorAll('[data-busy-hero]').forEach(function (element) {
      var busyActivity = heroActivity(element.dataset.busyHero);
      if (busyActivity) element.textContent = E.HEROES[element.dataset.busyHero].name + ' · ' + busyActivity.title + ' ' + timeText(busyActivity.remaining);
    });
    document.querySelectorAll('[data-activity-countdown]').forEach(function (element) {
      var activityKey = element.dataset.activityCountdown;
      var activeActivity = activityKey.indexOf('expedition:') === 0 ? state.activities.expeditions[activityKey.split(':')[1]] : state.activities.craft;
      if (activeActivity) element.textContent = timeText(remaining(activeActivity));
    });
  }

  function tooltip(label, description, trigger, modifier, focusable) {
    return '<span class="tooltip-wrap ' + (modifier || '') + '"><span class="tooltip-trigger" ' + (focusable ? 'tabindex="0" ' : '') + 'aria-label="' + esc(label + ': ' + description) + '">' + trigger + '</span><span class="tooltip-popover" role="tooltip"><strong>' + esc(label) + '</strong><span>' + esc(description) + '</span></span></span>';
  }

  function infoTerm(label, description) {
    return tooltip(label, description, esc(label), 'info-wrap', true);
  }

  function heroLevel(condition) { return Math.floor((condition.xp || 0) / 100) + 1; }
  function xpWithinLevel(condition) { return Math.max(0, (condition.xp || 0) % 100); }

  function meter(name, value, kind, maximum, display) {
    var max = maximum || 100;
    var width = max ? Math.max(0, Math.min(100, value / max * 100)) : 0;
    return '<div class="meter-row"><span>' + infoTerm(name, STAT_INFO[name.toLowerCase()]) + '</span><span class="meter ' + (kind || '') + '" role="meter" aria-label="' + esc(name) + '" aria-valuenow="' + value + '" aria-valuemin="0" aria-valuemax="' + max + '"><i style="width:' + width + '%"></i></span><b>' + esc(display === undefined ? value : display) + '</b></div>';
  }

  function miniMeter(label, value, maximum, kind, symbol) {
    var max = maximum || 100;
    var width = max ? Math.max(0, Math.min(100, value / max * 100)) : 0;
    return '<span class="mini-meter ' + kind + '" role="meter" aria-label="' + esc(label + ': ' + value + ' of ' + max) + '" aria-valuenow="' + value + '" aria-valuemin="0" aria-valuemax="' + max + '"><b aria-hidden="true">' + symbol + '</b><i style="--meter-percent:' + width + '%"></i></span>';
  }

  function conditionMeters(key, compact) {
    var hero = E.HEROES[key], condition = state.heroes[key];
    var healthNow = Math.max(1, Math.round(hero.maxHealth * condition.health / 100));
    var values = [miniMeter('Health', healthNow, hero.maxHealth, 'health', '♥')];
    if (hero.maxMana) values.push(miniMeter('Mana', condition.mana, hero.maxMana, 'mana', '◆'));
    values.push(miniMeter('Readiness', condition.readiness, 100, 'ready', '●'));
    values.push(miniMeter('Experience', xpWithinLevel(condition), 100, 'xp', '✦'));
    return '<span class="mini-meters">' + values.join('') + '</span>';
  }

  function traitTerms(key) {
    return E.HEROES[key].traits.map(function (trait) { return infoTerm(trait, E.TRAITS[trait]); }).join('');
  }

  function favouredBadge(key) {
    var reasons = E.heroAdvantages(key, state.selectedExpedition);
    if (!reasons.length) return '';
    return tooltip('Favoured', reasons.join(' '), '<b aria-hidden="true">↑</b> Favoured', 'favoured-badge', false);
  }

  function heroIdentity(key, plain) {
    var hero = E.HEROES[key], level = heroLevel(state.heroes[key]);
    return '<div class="hero-identity"><strong>' + esc(hero.name) + '</strong><span>' + (plain ? esc(hero.role) : infoTerm(hero.role, E.ROLES[hero.role])) + '</span><span>Level ' + level + '</span></div>';
  }

  function heroCompact(key, options) {
    options = options || {};
    var hero = E.HEROES[key];
    var ui = HERO_UI[key];
    var condition = state.heroes[key];
    var chosen = state.selectedParty.indexOf(key) >= 0;
    var busy = heroBusy(key);
    var activity = heroActivity(key);
    return '<article class="party-hero-card ' + (chosen && options.selectable ? 'selected ' : '') + (busy ? 'busy ' : '') + '">' +
      '<div class="hero-card-head"><span class="portrait ' + ui.colour + '">' + ui.initials + '</span>' + heroIdentity(key, false) +
      (options.selectable ? '<button class="party-remove" type="button" data-action="toggle-party" data-hero="' + key + '" aria-label="Remove ' + esc(hero.name) + ' from party">×</button>' : '') + '</div>' +
      '<div class="combat-line"><span>' + hero.combatStyle + '</span><span>' + (hero.damageType === 'magical' ? 'Magical damage' : 'Physical damage') + '</span>' + favouredBadge(key) + '</div>' +
      '<div class="party-traits"><span class="label">Traits</span>' + traitTerms(key) + '</div>' +
      conditionMeters(key, false) +
      (activity ? '<div class="away-label" data-hero-timer="' + key + '">' + activity.title + ' ' + timeText(activity.remaining) + '</div>' : '') + '</article>';
  }

  function emptyPartySlot(index) {
    return '<article class="party-slot-empty"><span>' + (index + 1) + '</span><strong>Open company slot</strong><p>Select an available hero below.</p></article>';
  }

  function rosterChoice(key) {
    var hero = E.HEROES[key], ui = HERO_UI[key], selected = state.selectedParty.indexOf(key) >= 0, busy = heroBusy(key), activity = heroActivity(key);
    return '<button class="roster-choice ' + (selected ? 'selected ' : '') + (busy ? 'busy' : '') + '" data-action="toggle-party" data-hero="' + key + '" aria-pressed="' + selected + '" ' + (busy ? 'disabled' : '') + '><span class="portrait small ' + ui.colour + '">' + ui.initials + '</span><span><strong>' + esc(hero.name) + '</strong><em>' + esc(hero.role) + ' · Level ' + heroLevel(state.heroes[key]) + '</em><small>' + (activity ? activity.title + ' ' + timeText(activity.remaining) : selected ? 'In company' : 'Available') + '</small>' + favouredBadge(key) + '</span></button>';
  }

  function heroRail() {
    return '<aside class="hero-rail ' + (state.rosterOpen ? 'open' : '') + '" aria-label="Company roster"><div class="rail-heading"><div><span class="label">Company roster</span><strong>Heroes</strong></div><button class="rail-close" data-action="toggle-roster" aria-label="Close roster">×</button></div>' +
      Object.keys(E.HEROES).map(function (key) {
        var hero = E.HEROES[key], ui = HERO_UI[key], condition = state.heroes[key], busy = heroBusy(key), activity = heroActivity(key);
        return '<button class="rail-hero ' + (state.selectedHero === key ? 'selected ' : '') + (busy ? 'busy' : '') + '" data-action="select-hero" data-hero="' + key + '" draggable="' + (!busy) + '" data-draggable-hero="' + key + '">' +
          '<span class="portrait ' + ui.colour + '">' + ui.initials + '</span><span class="rail-copy"><strong>' + esc(hero.name) + '</strong><span>' + hero.role + ' · Level ' + heroLevel(condition) + '</span>' + conditionMeters(key, false) +
          (activity ? '<em data-hero-timer="' + key + '">' + activity.title + ' ' + timeText(activity.remaining) + '</em>' : '<em>Available</em>') + '</span></button>';
      }).join('') + '<p class="rail-hint">Select a hero, or drag an available hero into a facility slot.</p></aside>';
  }

  function activityStrip() {
    var chips = [];
    allExpeditionActivities().forEach(function (entry) { chips.push('<button data-action="open-activity" data-activity="expedition" data-expedition="' + entry.key + '"><span>' + esc(E.ENCOUNTERS[entry.key].name) + '</span><strong data-activity-countdown="expedition:' + entry.key + '">' + timeText(remaining(entry.activity)) + '</strong></button>'); });
    Object.keys(state.expeditionResults).forEach(function (key) { chips.push('<button class="ready" data-action="open-activity" data-activity="expedition-result" data-expedition="' + key + '"><span>' + esc(E.ENCOUNTERS[key].name) + '</span><strong>Outcome ready</strong></button>'); });
    if (state.activities.craft) chips.push('<button data-action="open-activity" data-activity="craft"><span>Workshop</span><strong data-activity-countdown="craft">' + timeText(remaining(state.activities.craft)) + '</strong></button>');
    if (state.completedActivity && state.completedActivity.type === 'craft') chips.push('<button class="ready" data-action="open-activity" data-activity="craft-ready"><span>Workshop</span><strong>Item ready</strong></button>');
    return chips.length ? '<div class="activity-strip" aria-label="Company activities">' + chips.join('') + '</div>' : '';
  }

  function resources() {
    return '<div class="resources"><span><b>' + state.gold + '</b> Gold</span><span><b>' + state.scrap + '</b> Scrap</span><span><b>' + state.herbs + '</b> Herbs</span>' +
      (installPrompt ? '<button class="install-button" data-action="install">Install</button>' : '') + '</div>';
  }

  function navigation() {
    var items = [['town', 'Town'], ['expeditions', 'Expeditions'], ['roster', 'Roster'], ['inventory', 'Inventory']];
    return '<nav class="primary-nav" aria-label="Main navigation">' + items.map(function (item) {
      return '<button data-view="' + item[0] + '" data-tutorial-target="nav-' + item[0] + '" class="' + (state.view === item[0] ? 'active' : '') + '">' + item[1] + '</button>';
    }).join('') + '</nav>';
  }

  function heading(kicker, title, copy) {
    return '<header class="page-heading"><span class="eyebrow">' + kicker + '</span><h1>' + title + '</h1>' + (copy ? '<p>' + copy + '</p>' : '') + '</header>';
  }

  function intro() {
    return '<main class="intro"><section class="intro-card"><div class="crest">⚔</div><div class="eyebrow">Found a company</div><h1>Adventure Company</h1><p>Build a roster, prepare expeditions and turn hard-won materials into better equipment.</p><form id="company-form" class="name-row"><label class="sr-only" for="company-name">Company name</label><input id="company-name" maxlength="28" placeholder="Name your company" value="' + esc(state.companyName) + '" autocomplete="off"><button class="primary" type="submit">Open the doors</button></form></section></main>';
  }

  function buildingOccupancy(key) {
    var slots = state.activities.facilities[key];
    if (!slots) return '';
    return '<span class="building-status">' + slots.filter(Boolean).length + '/' + slots.length + ' occupied</span>';
  }

  function townScene() {
    return heading('Company headquarters', 'Town', 'Manage the company between expeditions. Select a building to inspect its services.') +
      '<section class="town-scene" aria-label="Town facilities"><div class="town-skyline"><span></span><span></span><span></span></div>' + Object.keys(FACILITIES).map(function (key) {
        var facility = FACILITIES[key];
        return '<button class="building building-' + key + ' ' + (!facility.working ? 'future' : '') + '" data-building="' + key + '" data-tutorial-target="building-' + key + '"><span class="building-vignette"><i>' + facility.icon + '</i></span><strong>' + facility.shortName + '</strong>' + buildingOccupancy(key) + (!facility.working ? '<span class="building-status">Future facility</span>' : '') + '</button>';
      }).join('') + '</section>';
  }

  function effectText(effects) {
    return Object.keys(effects).map(function (key) { return '+' + effects[key] + ' ' + key.charAt(0).toUpperCase() + key.slice(1); }).join(' · ');
  }

  function facilitySlot(facilityKey, index) {
    var facility = FACILITIES[facilityKey];
    var activity = state.activities.facilities[facilityKey][index];
    if (activity) {
      return '<article class="facility-slot occupied"><span class="slot-number">Slot ' + (index + 1) + '</span><div class="slot-hero"><span class="portrait ' + HERO_UI[activity.hero].colour + '">' + HERO_UI[activity.hero].initials + '</span>' + heroIdentity(activity.hero, true) + '</div><strong>' + activity.title + '</strong><div class="timer small" data-facility-countdown="' + facilityKey + ':' + index + '">' + timeText(remaining(activity)) + '</div><div class="projected-condition">Expected: ' + effectText(activity.effects) + '</div></article>';
    }
    var selected = state.selectedHero;
    var selectedActivity = selected ? heroActivity(selected) : null;
    var unavailable = !selected || Boolean(selectedActivity) || state.gold < facility.cost;
    var slotTitle = !selected ? 'Select a hero' : selectedActivity ? 'Selected hero is busy' : 'Assign ' + E.HEROES[selected].name;
    var slotCopy = selectedActivity ? E.HEROES[selected].name + ' · ' + selectedActivity.title + ' ' + timeText(selectedActivity.remaining) : facility.activity + ' · ' + facility.cost + ' gold · ' + facility.duration + ' sec';
    return '<article class="facility-slot empty" data-drop-facility="' + facilityKey + '" data-drop-slot="' + index + '" data-tutorial-target="facility-slot-' + index + '"><span class="slot-number">Slot ' + (index + 1) + '</span><div class="empty-slot-mark">+</div><strong>' + slotTitle + '</strong><span' + (selectedActivity ? ' data-busy-hero="' + selected + '"' : '') + '>' + slotCopy + '</span><button class="secondary" data-action="assign-facility" data-facility="' + facilityKey + '" data-slot="' + index + '" ' + (unavailable ? 'disabled' : '') + '>Place selected hero</button></article>';
  }

  function facilityFrame(key, content) {
    var facility = FACILITIES[key];
    return '<section class="facility-panel"><button class="back-link" data-action="close-building">← Back to Town</button><header><span class="facility-icon">' + facility.icon + '</span><div><span class="eyebrow">Town facility</span><h1>' + facility.name + '</h1><p>' + facility.description + '</p></div></header>' + content + '</section>';
  }

  function workshopPanel() {
    var craft = state.activities.craft;
    var duration = state.tutorial === 'forge' ? 10 : 30;
    var storage = '<span class="storage-count ' + (inventoryFull() ? 'full' : '') + '">' + state.inventory.length + '/' + state.inventoryCapacity + ' inventory slots occupied</span>';
    var body;
    if (craft) body = '<article class="craft-card"><div class="item-icon">⚔</div><div><span class="label">In progress</span><h3>Iron Sword</h3><div class="timer small" data-countdown-key="craft">' + timeText(remaining(craft)) + '</div><div class="progress"><i data-progress-key="craft" style="width:' + activityProgress(craft) + '%"></i></div></div></article>';
    else if (state.workshopOutput) body = '<article class="craft-card output-ready"><div class="item-icon">⚔</div><div><span class="label">Craft complete</span><h3>' + state.workshopOutput.name + '</h3><p>' + (inventoryFull() ? 'Company inventory is full. The item will remain safely here until space is available.' : 'A space is available in company inventory.') + '</p>' + storage + '<div class="craft-actions"><button class="primary" data-action="store-workshop-output" ' + (inventoryFull() ? 'disabled' : '') + '>Store in Inventory</button><button class="secondary" data-view="inventory">Manage Inventory</button></div></div></article>';
    else body = '<article class="craft-card"><div class="item-icon">⚔</div><div><span class="label">Common main-hand weapon</span><h3>Iron Sword</h3><p>Attack +4. Usable by a Vanguard, Ranger or Skirmisher.</p><div class="costs"><span>15 gold</span><span>3 scrap</span><span>' + duration + ' sec</span><span>+18 Craft XP</span></div>' + storage + '<button class="primary" data-action="craft" data-tutorial-target="forge" ' + (state.gold < 15 || state.scrap < 3 || inventoryFull() ? 'disabled' : '') + '>Forge</button>' + (inventoryFull() ? '<button class="secondary manage-storage" data-view="inventory">Manage Inventory</button>' : '') + '</div></article>';
    return facilityFrame('workshop', body + '<aside class="workshop-level"><span class="label">Crafting level 1</span><strong>' + state.craftXp + ' / 100 Craft XP</strong><div class="progress"><i style="width:' + state.craftXp + '%"></i></div><p>Finished items enter Inventory. If storage fills unexpectedly, completed work remains safely at the Workshop.</p></aside>');
  }

  function facilityPanel(key) {
    var facility = FACILITIES[key];
    if (key === 'workshop') return workshopPanel();
    if (!facility.working) return facilityFrame(key, '<article class="locked-facility"><span class="label">Not yet operating</span><h3>' + facility.shortName + ' will open in a later prototype</h3><p>The building is visible now so the Town can grow without changing its basic geography.</p></article>');
    var selected = state.selectedHero;
    var selectedCopy = selected ? '<div class="selected-hero-banner"><span>Selected for placement</span><strong>' + E.HEROES[selected].name + '</strong>' + (heroBusy(selected) ? '<em>Currently unavailable</em>' : '<em>Drag the hero or choose an empty slot</em>') + '</div>' : '';
    return facilityFrame(key, selectedCopy + '<div class="facility-slots">' + state.activities.facilities[key].map(function (_, index) { return facilitySlot(key, index); }).join('') + '</div>');
  }

  function town() { return state.activeBuilding ? facilityPanel(state.activeBuilding) : townScene(); }

  function expeditionList() {
    var cards = Object.keys(E.ENCOUNTERS).map(function (key) {
      var encounter = E.ENCOUNTERS[key], activity = state.activities.expeditions[key], result = state.expeditionResults[key], unlocked = expeditionUnlocked(key);
      var status;
      if (!unlocked) status = '<div class="mission-locked">Complete ' + (key === 'briar-den' ? 'the Abandoned Road' : 'the Briar Den') + ' to unlock.</div>';
      else if (result) status = '<button class="primary outcome-ready" data-action="review-expedition" data-expedition="' + key + '">Review outcome</button>';
      else if (activity) status = '<div class="mission-progress"><div><span>' + esc((E.APPROACHES[activity.approach] || E.APPROACHES.standard).name) + ' approach</span><strong data-countdown-key="expedition:' + key + '">' + timeText(remaining(activity)) + '</strong></div><div class="progress"><i data-progress-key="expedition:' + key + '" style="width:' + activityProgress(activity) + '%"></i></div><span>' + activity.party.map(function (heroKey) { return E.HEROES[heroKey].name.split(' ')[0]; }).join(', ') + (activity.party.length === 1 ? ' is' : ' are') + ' away</span></div>';
      else status = '<button class="primary" data-action="prepare-expedition" data-expedition="' + key + '"' + (key === 'abandoned-road' ? ' data-tutorial-target="mission-prepare"' : '') + '>Prepare company</button>';
      var listedDuration = key === 'abandoned-road' && !state.firstExpeditionComplete ? '45 sec opening' : encounter.duration + ' sec standard';
      return '<section class="mission-card ' + (!unlocked ? 'locked' : '') + '"><div class="mission-banner"><span>' + esc(encounter.region) + '</span><strong>Level ' + encounter.level + '</strong></div><h2>' + esc(encounter.name) + '</h2><p>' + esc(encounter.description) + '</p><div class="tags">' + encounter.tags.map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '<span>' + listedDuration + '</span><span>Repeatable</span></div><div class="reward-strip">' + encounter.rewardLabel.map(function (reward) { return '<span>' + esc(reward) + '</span>'; }).join('') + '</div>' + status + '</section>';
    }).join('');
    return heading('Operations', 'Expeditions', 'Each location has one expedition slot. Different locations can run at the same time, but a hero can only undertake one activity.') + '<div class="mission-board">' + cards + '</div>';
  }

  function preparation() {
    var encounter = E.ENCOUNTERS[state.selectedExpedition];
    var approach = E.APPROACHES[state.selectedApproach] || E.APPROACHES.standard;
    var baseDuration = state.selectedExpedition === 'abandoned-road' && !state.firstExpeditionComplete ? 45 : encounter.duration;
    var expectedDuration = Math.max(8, Math.round(baseDuration * approach.duration));
    var result = forecast();
    var danger = result ? '<aside class="danger-panel"><span class="label">Serious outcome risk</span><strong class="danger-value">' + result.danger + '%</strong><div class="risk"><i style="width:' + result.danger + '%"></i></div><h3>' + (result.danger <= 10 ? 'Low risk' : result.danger <= 30 ? 'Viable' : result.danger <= 55 ? 'Manageable' : 'Risky') + '</h3><p class="danger-explainer">Chance of failure or an injury serious enough to require treatment.</p><dl><div><dt>Approach</dt><dd>' + approach.name + '</dd></div><div><dt>Duration</dt><dd>' + expectedDuration + ' sec</dd></div><div><dt>Success</dt><dd>' + result.successChance + '%</dd></div><div><dt>Injury</dt><dd>' + result.injuryChance + '%</dd></div><div class="wear-row"><dt>Expected wear</dt><dd>' + result.expectedHealthLoss + '% Health</dd></div></dl><button class="primary" data-action="send-expedition" data-tutorial-target="send-expedition">Send party</button><button class="secondary" data-action="cancel-preparation">Back</button></aside>' : '<aside class="danger-panel empty"><span class="label">Serious outcome risk</span><strong class="danger-value">—</strong><h3>No party selected</h3><p>Select at least one available hero.</p><button class="primary" disabled>Send party</button><button class="secondary" data-action="cancel-preparation">Back</button></aside>';
    var partySlots = [0, 1, 2].map(function (index) { var key = state.selectedParty[index]; return key ? heroCompact(key, { selectable: true }) : emptyPartySlot(index); }).join('');
    var approaches = Object.keys(E.APPROACHES).map(function (key) { var approach = E.APPROACHES[key]; return '<button class="approach-option ' + (state.selectedApproach === key ? 'selected' : '') + '" data-action="select-approach" data-approach="' + key + '" aria-pressed="' + (state.selectedApproach === key) + '"><strong>' + approach.name + '</strong><span>' + approach.description + '</span></button>'; }).join('');
    return heading('Expedition preparation', encounter.name, 'The forecast runs 400 seeded simulations using current condition, equipment and approach.') + '<section class="approach-picker"><div class="section-heading"><div><span class="label">Approach</span><h2>How should they proceed?</h2></div><span>Assignment-level choice</span></div><div class="approach-grid">' + approaches + '</div></section><div class="preparation-grid"><section><div class="section-heading"><h2>Selected company</h2><span>' + state.selectedParty.length + '/3 selected</span></div><div class="party-slot-grid">' + partySlots + '</div><div class="available-roster"><div class="section-heading"><div><span class="label">Company roster</span><h3>Choose adventurers</h3></div><span>' + Object.keys(E.HEROES).length + ' heroes</span></div><div class="roster-choice-grid">' + Object.keys(E.HEROES).map(rosterChoice).join('') + '</div></div></section>' + danger + '</div>';
  }

  function resultMeter(name, before, after, kind, maximum) {
    var max = maximum || 100;
    var delta = after - before;
    return '<div class="result-stat"><div><span>' + infoTerm(name, STAT_INFO[name.toLowerCase()]) + '</span><strong>' + before + ' → ' + after + ' <em class="' + (delta < 0 ? 'negative' : 'positive') + '">' + (delta > 0 ? '+' : '') + delta + '</em></strong></div><div class="result-meter ' + kind + '"><i class="before" style="width:' + Math.max(0, Math.min(100, before / max * 100)) + '%"></i><i class="after" style="width:' + Math.max(0, Math.min(100, after / max * 100)) + '%"></i><b style="left:' + Math.max(0, Math.min(100, before / max * 100)) + '%"></b></div></div>';
  }

  function results() {
    var key = state.selectedExpedition;
    var result = state.resultContext === 'admin' ? state.currentResult : state.expeditionResults[key];
    if (!result) return expeditionList();
    var encounter = E.ENCOUNTERS[result.encounterKey || key] || E.ENCOUNTERS['abandoned-road'];
    var changes = result.changes || {}, party = Object.keys(changes);
    var averageLoss = party.length ? party.reduce(function (total, key) { return total + Math.max(0, changes[key].before.health - changes[key].after.health); }, 0) / party.length : 0;
    var injuries = party.filter(function (key) { return result.heroes[key] && result.heroes[key].injured; }).length;
    var verdict = !result.success ? 'The company limped home, but every name remains on the roster.' : injuries ? 'The road exacted a heavy price. Everyone made it back.' : averageLoss <= 10 ? 'The company returned barely scuffed.' : averageLoss <= 25 ? 'A few bruises, but everyone walked home.' : 'A costly victory. The company will feel this one tomorrow.';
    var resultAction = state.resultContext === 'admin' ? '<button class="primary" data-action="leave-replay">Return</button>' : '<button class="primary" data-action="claim-rewards" data-expedition="' + encounter.key + '" data-tutorial-target="claim-rewards">Take rewards</button>';
    return heading('Expedition complete', result.success ? encounter.name + ' secured' : 'Company withdrawn', verdict) + '<section class="outcome-summary"><div><span class="label">Company outcome · ' + esc((E.APPROACHES[result.approach] || E.APPROACHES.standard).name) + '</span><h2>' + verdict + '</h2><p>' + result.rounds + ' combat rounds · ' + (result.potionUsed ? 'At least one Field Tonic was consumed.' : 'No Field Tonics were needed.') + '</p></div><aside><h3>Recovered</h3><div class="reward-strip"><span>' + result.rewards.gold + ' gold</span><span>' + result.rewards.scrap + ' scrap</span><span>' + result.rewards.herbs + ' herb</span><span>' + result.rewards.xp + ' base XP</span></div></aside></section><section class="results-panel"><div class="section-heading"><h2>Company condition</h2><span>Before → after</span></div><div class="hero-results">' + party.map(function (key) {
      var change = changes[key];
      return '<article><div class="result-hero-head"><span class="portrait ' + HERO_UI[key].colour + '">' + HERO_UI[key].initials + '</span><div><h3>' + E.HEROES[key].name + '</h3><span>+' + change.xpGain + ' XP</span></div></div>' + resultMeter('Health', change.before.health, change.after.health, 'health') + (E.HEROES[key].maxMana ? resultMeter('Mana', change.before.mana, change.after.mana, 'mana', E.HEROES[key].maxMana) : '') + resultMeter('Readiness', change.before.readiness, change.after.readiness, 'ready') + '</article>';
    }).join('') + '</div>' + resultAction + '</section><details class="encounter-log"><summary>Show encounter log <span>' + result.rounds + ' rounds · Seeded</span></summary><ol>' + result.log.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ol></details>';
  }

  function expeditions() {
    if (state.expeditionScreen === 'prepare') return preparation();
    if (state.expeditionScreen === 'results') return results();
    return expeditionList();
  }

  function equippedItem(key, slot) { return state.equipment[key] && state.equipment[key][slot]; }

  function itemRoles(item) { return item.allowedRoles && item.allowedRoles.length ? item.allowedRoles.join(' or ') : 'Any class'; }
  function itemCompatible(item, heroKey, slot) { return item.slot === slot && (!item.allowedRoles || item.allowedRoles.indexOf(E.HEROES[heroKey].role) >= 0); }

  function itemCard(item, options) {
    options = options || {};
    var action = options.selectable ? ' data-action="select-inventory-item" data-item-id="' + item.id + '"' : '';
    var selected = options.selected ? ' selected' : '';
    var tag = options.selectable ? 'button' : 'div';
    return '<' + tag + ' class="inventory-item-card' + selected + '"' + action + '><span class="item-icon">⚔</span><span class="item-card-copy"><span class="label">' + (item.rarity || 'Common') + ' ' + SLOT_LABELS[item.slot].toLowerCase() + ' weapon</span><strong>' + item.name + '</strong><span>Attack +' + item.attack + ' · ' + itemRoles(item) + '</span></span></' + tag + '>';
  }

  function moveProgression(key) {
    var hero = E.HEROES[key], level = heroLevel(state.heroes[key]);
    var moves = E.movesForRole(hero.role, level, true).map(function (move) {
      var unlocked = move.level <= level;
      var resource = move.manaCost ? move.manaCost + ' Mana' : 'No Mana';
      var type = move.damageType === 'magical' ? 'Magical' : 'Physical';
      return '<article class="move-card ' + (unlocked ? 'unlocked' : 'locked') + '"><header><strong>' + esc(move.name) + '</strong><span>' + (move.fallback ? 'Fallback' : unlocked ? 'Available' : 'Level ' + move.level) + '</span></header><p>' + esc(move.description) + '</p><small>' + type + ' · ' + resource + '</small></article>';
    }).join('');
    return '<section class="move-progression"><div class="section-heading"><div><span class="label">Combat moves</span><h2>' + esc(hero.role) + ' progression</h2></div><span>Level ' + level + '</span></div><p class="move-intro">The simulator chooses among available moves. Locked moves enter that pool when the hero reaches their listed level.</p><div class="move-grid">' + moves + '</div></section>';
  }

  function characterSheet(key) {
    var hero = E.HEROES[key], ui = HERO_UI[key], condition = state.heroes[key], stats = effectiveHeroStats(key);
    var healthNow = Math.max(1, Math.round(hero.maxHealth * condition.health / 100));
    var traits = hero.traits.map(function (trait) { return '<article><strong>' + infoTerm(trait, E.TRAITS[trait]) + '</strong><p>' + esc(E.TRAITS[trait]) + '</p></article>'; }).join('');
    return '<section class="character-sheet"><header><span class="portrait large ' + ui.colour + '">' + ui.initials + '</span>' + heroIdentity(key, false) + '<div class="combat-identity"><span>' + hero.combatStyle + '</span><span>' + (hero.damageType === 'magical' ? 'Magical damage' : 'Physical damage') + '</span></div></header><div class="character-overview"><section class="sheet-condition"><span class="label">Condition</span>' + meter('Health', healthNow, 'health', hero.maxHealth, healthNow + '/' + hero.maxHealth) + (hero.maxMana ? meter('Mana', condition.mana, 'mana', hero.maxMana, condition.mana + '/' + hero.maxMana) : '') + meter('Readiness', condition.readiness, 'ready') + '<div class="xp-block"><div><span>Level ' + heroLevel(condition) + '</span><strong>' + xpWithinLevel(condition) + '/100 XP</strong></div><span class="meter xp" role="meter" aria-label="Experience towards next level" aria-valuenow="' + xpWithinLevel(condition) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + xpWithinLevel(condition) + '%"></i></span></div></section><section class="sheet-stat-groups"><div class="stat-group"><span class="label">Offence</span><div class="full-stats"><span>' + infoTerm('Attack', STAT_INFO.attack) + '<b>' + stats.attack + '</b></span><span>' + infoTerm('Accuracy', STAT_INFO.accuracy) + '<b>' + stats.accuracy + '%</b></span><span>' + infoTerm('Critical', STAT_INFO.critical) + '<b>' + stats.critical + '%</b></span></div></div><div class="stat-group"><span class="label">Defence</span><div class="full-stats"><span>' + infoTerm('Armour', STAT_INFO.armour) + '<b>' + stats.armour + '</b></span><span>' + infoTerm('Ward', STAT_INFO.ward) + '<b>' + stats.ward + '</b></span><span>' + infoTerm('Evasion', STAT_INFO.evasion) + '<b>' + stats.evasion + '%</b></span></div></div><div class="stat-group tempo-group"><span class="label">Tempo</span><div class="full-stats"><span>' + infoTerm('Speed', STAT_INFO.speed) + '<b>' + stats.speed + '</b></span></div></div><div class="resistance-row"><span class="label">Resistances</span><span>' + infoTerm('Fire', STAT_INFO.fire) + '<b>' + hero.resistances.fire + '%</b></span></div></section></div><div class="sheet-lower"><section><span class="label">Equipment</span><div class="equipment-grid">' + Object.keys(SLOT_LABELS).map(function (slot) {
      var item = equippedItem(key, slot);
      return '<button class="equipment-slot ' + (item ? 'filled ' : '') + '" data-action="open-equipment-slot" data-slot="' + slot + '" data-hero="' + key + '"' + (slot === 'mainHand' ? ' data-tutorial-target="main-hand-slot"' : '') + '><span>' + SLOT_LABELS[slot] + '</span><strong>' + (item ? item.name : 'Empty') + '</strong>' + (item ? '<em>Attack +' + item.attack + '</em>' : '<em>Choose item</em>') + '</button>';
    }).join('') + '</div></section><section class="trait-list"><span class="label">Traits</span>' + traits + '</section></div>' + moveProgression(key) + '</section>';
  }

  function roster() {
    return heading('Company', 'Roster', 'Select a hero to inspect their condition, traits, combat statistics and equipment.') + '<div class="mobile-hero-tabs">' + Object.keys(E.HEROES).map(function (key) { return '<button data-action="select-hero" data-hero="' + key + '" class="' + (state.selectedHero === key ? 'active' : '') + '">' + E.HEROES[key].name.split(' ')[0] + '</button>'; }).join('') + '</div>' + characterSheet(state.selectedHero || 'elara');
  }

  function inventory() {
    var choosing = Boolean(state.equipmentSlot && state.selectedHero);
    var heroKey = state.selectedHero;
    var slot = state.equipmentSlot;
    var compatible = choosing ? state.inventory.filter(function (item) { return itemCompatible(item, heroKey, slot); }) : state.inventory;
    var incompatible = choosing ? state.inventory.filter(function (item) { return !itemCompatible(item, heroKey, slot); }) : [];
    var items = choosing && !state.showIncompatibleItems ? compatible : state.inventory;
    var selected = items.find(function (item) { return item.id === state.selectedInventoryItem; }) || items[0];
    var selectedCompatible = selected && (!choosing || itemCompatible(selected, heroKey, slot));
    var dismantleConfirm = selected && state.pendingDismantleId === selected.id;
    var actions = selected ? (choosing ? '<button class="primary" data-action="equip-item" data-item-id="' + selected.id + '" data-hero="' + heroKey + '" data-tutorial-target="equip-sword" ' + (!selectedCompatible ? 'disabled' : '') + '>Equip ' + E.HEROES[heroKey].name.split(' ')[0] + '</button>' : dismantleConfirm ? '<div class="dismantle-confirm"><p>Dismantle this item for 1 scrap? This cannot be undone.</p><button class="danger-button" data-action="confirm-dismantle" data-item-id="' + selected.id + '">Dismantle item</button><button class="secondary" data-action="cancel-dismantle">Keep item</button></div>' : '<button class="secondary" data-action="request-dismantle" data-item-id="' + selected.id + '">Dismantle for 1 scrap</button>') : '';
    var detail = selected ? '<aside class="inventory-detail"><span class="item-icon">⚔</span><span class="label">' + selected.rarity + ' equipment</span><h2>' + selected.name + '</h2><dl><div><dt>Slot</dt><dd>' + SLOT_LABELS[selected.slot] + '</dd></div><div><dt>Attack</dt><dd>+' + selected.attack + '</dd></div><div><dt>Usable by</dt><dd>' + itemRoles(selected) + '</dd></div><div><dt>Source</dt><dd>' + selected.source + '</dd></div></dl>' + actions + '</aside>' : (!choosing ? '<aside class="inventory-detail empty-detail"><span class="label">Company stores</span><h2>No equipment stored</h2><p>Forge equipment at the Workshop, then return here to inspect or dismantle it.</p><button class="secondary" data-action="open-building" data-building="workshop">Open Workshop</button></aside>' : '');
    var current = choosing ? equippedItem(heroKey, slot) : null;
    var chooser = choosing ? '<header class="equipment-choice-header"><div><span class="eyebrow">Equipping ' + E.HEROES[heroKey].name + '</span><h1>Choose ' + SLOT_LABELS[slot] + '</h1><p>Showing equipment compatible with this hero and slot.</p></div><button class="secondary" data-action="cancel-equipment-choice">Cancel</button></header>' + (current ? '<div class="current-equipment"><span>Currently equipped</span><strong>' + current.name + '</strong><button class="secondary small-button" data-action="unequip-item" data-hero="' + heroKey + '" data-slot="' + slot + '" ' + (inventoryFull() ? 'disabled' : '') + '>Unequip</button></div>' : '') + (incompatible.length ? '<button class="filter-toggle" data-action="toggle-incompatible">' + (state.showIncompatibleItems ? 'Hide' : 'Show') + ' ' + incompatible.length + ' incompatible item' + (incompatible.length === 1 ? '' : 's') + '</button>' : '') : heading('Company stores', 'Inventory', 'Browse company equipment. To equip an item, begin from a hero’s equipment slot in the Roster.');
    var cells = items.map(function (item) { return itemCard(item, { selectable: true, selected: selected && selected.id === item.id }); }).join('');
    if (!choosing) for (var empty = state.inventory.length; empty < state.inventoryCapacity; empty += 1) cells += '<div class="inventory-empty-slot"><span>Empty</span></div>';
    var emptyCopy = choosing ? '<div class="empty-state"><h3>No compatible equipment</h3><p>There are no ' + SLOT_LABELS[slot].toLowerCase() + ' items that ' + E.HEROES[heroKey].name + ' can use.</p></div>' : '<div class="empty-state"><h3>The stores are empty</h3><p>Visit the Workshop in Town to forge equipment.</p><button class="secondary" data-action="open-building" data-building="workshop">Open Workshop</button></div>';
    return chooser + '<section class="inventory-panel"><div class="section-heading"><h2>' + (choosing ? 'Compatible equipment' : 'Equipment stores') + '</h2><span class="capacity-count ' + (inventoryFull() ? 'full' : '') + '">' + state.inventory.length + '/' + state.inventoryCapacity + ' occupied</span></div>' + (items.length || !choosing ? '<div class="inventory-layout"><div class="inventory-slot-grid">' + cells + '</div>' + detail + '</div>' : emptyCopy) + '</section>';
  }

  function mainView() {
    if (state.view === 'expeditions') return expeditions();
    if (state.view === 'roster') return roster();
    if (state.view === 'inventory') return inventory();
    return town();
  }

  function tutorial() {
    if (!state.tutorial) return '';
    var steps = {
      'town-expeditions': { title: 'Begin with an expedition', copy: 'Open Expeditions to see the company’s available work.' },
      'expedition-prepare': { title: 'Prepare the company', copy: 'Open the Abandoned Road and choose who will go.' },
      'party-send': { title: 'Review the forecast', copy: 'The current party is viable. Send them when you are ready.' },
      'claim-rewards': { title: 'Take the rewards', copy: 'Collect the outcome, then decide how to use the recovered materials.' },
      'return-town-workshop': { title: 'Return to Town', copy: 'The Workshop can turn the recovered scrap into equipment.' },
      'town-workshop': { title: 'Open the Workshop', copy: 'Select the Workshop building in the Town.' },
      forge: { title: 'Forge an Iron Sword', copy: 'This is an ordinary craft. The item will enter company inventory.' },
      crafting: { title: 'The forge is working', copy: 'The timer continues while the game is closed. The next step will appear when the sword is ready.' },
      'open-roster': { title: 'Open the Roster', copy: 'Equipment is fitted from a hero’s normal character sheet.' },
      'open-main-hand': { title: 'Choose an equipment slot', copy: 'Open Elara’s Main hand slot to filter company inventory to suitable items.' },
      'equip-sword': { title: 'Equip Elara', copy: 'The Inventory is filtered for Elara’s Main hand. Equip the Iron Sword.' },
      'town-tavern': { title: 'Open the Tavern', copy: 'Orin needs time to recover. The Tavern has two configurable recovery slots.' },
      'assign-orin': { title: 'Assign Orin', copy: 'Orin is selected in the roster. Choose this slot, or drag Orin here from the right.' },
      'expeditions-next': { title: 'Keep the company working', copy: 'Orin is unavailable, but any remaining combination of heroes can take the next expedition.' }
    };
    var step = steps[state.tutorial];
    return step ? '<div class="tutorial-shade"></div><aside class="tutorial-card" role="status"><span class="label">Guided opening</span><h3>' + step.title + '</h3><p>' + step.copy + '</p><button class="ghost" data-action="skip-tutorial">Skip tutorial</button></aside>' : '';
  }

  function devPanel() {
    if (!state.devOpen) return '';
    var resourceControls = ['gold', 'scrap', 'herbs'].map(function (resource) {
      return '<div class="admin-resource"><label for="resource-' + resource + '">' + resource.charAt(0).toUpperCase() + resource.slice(1) + '</label><input id="resource-' + resource + '" type="number" min="0" step="1" value="10"><button class="secondary" data-action="change-resource" data-resource="' + resource + '" data-mode="add">Add</button><button class="secondary" data-action="change-resource" data-resource="' + resource + '" data-mode="set">Set</button></div>';
    }).join('');
    return '<aside class="dev-panel"><span class="label">Administrative controls</span><h3>Primary resources</h3><div class="admin-resources">' + resourceControls + '</div><hr><h3>Inventory capacity</h3><div class="admin-capacity"><input id="inventory-capacity" type="number" min="12" max="60" step="1" value="' + state.inventoryCapacity + '" aria-label="Inventory capacity"><button class="secondary" data-action="set-inventory-capacity">Set capacity</button></div><hr><h3>World seed</h3><input id="seed-input" value="' + esc(state.seed) + '" aria-label="World seed"><div class="admin-grid"><button class="secondary" data-action="apply-seed">Apply seed</button><button class="secondary" data-action="random-seed">Randomise</button></div><button class="secondary" data-action="copy-seed">Copy seed</button><button class="secondary" data-action="replay" ' + (!state.lastResult ? 'disabled' : '') + '>Re-run last encounter</button><button class="secondary" data-action="skip-timers">Finish active timers</button><hr><button class="secondary" data-action="export">Export save</button><label class="file-label">Import save<input class="sr-only" id="import-save" type="file" accept="application/json"></label><button class="secondary" data-action="restart">Reset all progress</button></aside>';
  }

  function tutorialTarget() {
    var map = {
      'town-expeditions': 'nav-expeditions', 'expedition-prepare': 'mission-prepare', 'party-send': 'send-expedition', 'claim-rewards': 'claim-rewards',
      'return-town-workshop': 'nav-town', 'town-workshop': 'building-workshop', forge: 'forge', 'open-roster': 'nav-roster',
      'open-main-hand': 'main-hand-slot', 'equip-sword': 'equip-sword', 'town-tavern': 'building-tavern', 'assign-orin': 'facility-slot-0', 'expeditions-next': 'nav-expeditions'
    };
    return map[state.tutorial] || null;
  }

  function tutorialAllows(element) {
    if (!state.tutorial) return true;
    if (element.closest && element.closest('.tutorial-card')) return true;
    var target = tutorialTarget();
    return Boolean(target && element.closest && element.closest('[data-tutorial-target="' + target + '"]'));
  }

  function applyTutorialSpotlight() {
    var target = tutorialTarget();
    if (target) {
      var active = document.querySelector('[data-tutorial-target="' + target + '"]');
      if (active) {
        active.classList.add('spotlight');
        var navigationLayer = active.closest('.primary-nav');
        if (navigationLayer) navigationLayer.classList.add('tutorial-layer');
        if (target.indexOf('nav-') !== 0 && active.scrollIntoView) active.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
    }
    document.querySelectorAll('button, input, select, textarea, [tabindex]').forEach(function (element) {
      if (!tutorialAllows(element)) { element.setAttribute('tabindex', '-1'); element.setAttribute('aria-disabled', 'true'); }
    });
  }

  function render() {
    completeActivities();
    var app = document.getElementById('app');
    if (state.stage === 'intro') { app.innerHTML = intro(); bind(); return; }
    var notice = state.notice ? '<div class="notice">' + esc(state.notice) + '</div>' : '';
    app.innerHTML = '<div class="app-shell' + (state.tutorial ? ' tutorial-active' : '') + '"><header class="topbar"><div class="brand"><span class="brand-mark">A</span><div><strong>' + esc(state.companyName) + '</strong><span>Chartered adventure company · Prototype 0.5</span></div></div>' + activityStrip() + resources() + '<button class="roster-toggle" data-action="toggle-roster">Heroes</button></header>' + navigation() + '<div class="workspace"><main class="content">' + notice + mainView() + '</main>' + heroRail() + '</div><button class="dev-toggle" data-action="dev" aria-label="Administrative controls">⋯</button>' + devPanel() + tutorial() + '</div>';
    bind(); applyTutorialSpotlight();
  }

  function bindTooltips() {
    document.querySelectorAll('.tooltip-wrap').forEach(function (wrapper) {
      var popover = wrapper.querySelector('.tooltip-popover');
      var trigger = wrapper.querySelector('.tooltip-trigger');
      if (!popover || !trigger) return;
      function openTooltip() {
        wrapper.classList.add('tooltip-open');
        popover.style.left = '0px';
        popover.style.top = '0px';
        var triggerRect = trigger.getBoundingClientRect();
        var popoverRect = popover.getBoundingClientRect();
        var viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        var viewportHeight = document.documentElement.clientHeight || window.innerHeight;
        var gutter = 8;
        var left = Math.max(gutter, Math.min(triggerRect.left, viewportWidth - popoverRect.width - gutter));
        var top = triggerRect.bottom + gutter;
        if (top + popoverRect.height > viewportHeight - gutter) top = Math.max(gutter, triggerRect.top - popoverRect.height - gutter);
        popover.style.left = Math.round(left) + 'px';
        popover.style.top = Math.round(top) + 'px';
      }
      function closeTooltip() { wrapper.classList.remove('tooltip-open'); }
      wrapper.addEventListener('pointerenter', openTooltip);
      wrapper.addEventListener('pointerleave', closeTooltip);
      wrapper.addEventListener('focusin', openTooltip);
      wrapper.addEventListener('focusout', function (event) { if (!wrapper.contains(event.relatedTarget)) closeTooltip(); });
    });
  }

  function bind() {
    document.querySelectorAll('[data-view]').forEach(function (button) { button.addEventListener('click', function () { if (tutorialAllows(button)) openView(button.dataset.view); }); });
    document.querySelectorAll('[data-building]').forEach(function (button) { button.addEventListener('click', function () { if (tutorialAllows(button)) openBuilding(button.dataset.building); }); });
    document.querySelectorAll('[data-action]').forEach(function (button) { button.addEventListener('click', function () { if (tutorialAllows(button)) act(button.dataset.action, button.dataset); }); });
    document.querySelectorAll('[data-draggable-hero]').forEach(function (element) {
      element.addEventListener('dragstart', function (event) { if (state.tutorial && !(state.tutorial === 'assign-orin' && element.dataset.draggableHero === 'orin')) { event.preventDefault(); return; } draggedHero = element.dataset.draggableHero; event.dataTransfer.setData('text/plain', draggedHero); });
      element.addEventListener('dragend', function () { draggedHero = null; });
    });
    document.querySelectorAll('[data-drop-facility]').forEach(function (slot) {
      slot.addEventListener('dragover', function (event) { if (!tutorialAllows(slot)) return; event.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('dragleave', function () { slot.classList.remove('drag-over'); });
      slot.addEventListener('drop', function (event) { event.preventDefault(); if (tutorialAllows(slot)) assignFacility(draggedHero || event.dataTransfer.getData('text/plain'), slot.dataset.dropFacility, Number(slot.dataset.dropSlot)); });
    });
    var form = document.getElementById('company-form');
    if (form) form.addEventListener('submit', function (event) { event.preventDefault(); var name = document.getElementById('company-name').value.trim(); if (name) set({ companyName: name, stage: 'playing', view: 'town' }); });
    var importer = document.getElementById('import-save');
    if (importer) importer.addEventListener('change', importSave);
    bindTooltips();
  }

  function openView(view) {
    var patch = { view: view, activeBuilding: null, notice: null, rosterOpen: false, equipmentSlot: null, showIncompatibleItems: false, pendingDismantleId: null };
    if (state.tutorial === 'town-expeditions' && view === 'expeditions') patch.tutorial = 'expedition-prepare';
    if (state.tutorial === 'return-town-workshop' && view === 'town') patch.tutorial = 'town-workshop';
    if (state.tutorial === 'open-roster' && view === 'roster') { patch.tutorial = 'open-main-hand'; patch.selectedHero = 'elara'; }
    if (state.tutorial === 'expeditions-next' && view === 'expeditions') patch.tutorial = null;
    if (view === 'inventory' && !state.workshopOutput && state.completedActivity && state.completedActivity.type === 'craft') patch.completedActivity = null;
    set(patch);
  }

  function openBuilding(key) {
    var patch = { view: 'town', activeBuilding: key, notice: null };
    if (state.tutorial === 'town-workshop' && key === 'workshop') patch.tutorial = 'forge';
    if (state.tutorial === 'town-tavern' && key === 'tavern') { patch.tutorial = 'assign-orin'; patch.selectedHero = 'orin'; }
    set(patch);
  }

  function startExpedition() {
    var encounterKey = state.selectedExpedition, encounter = E.ENCOUNTERS[encounterKey], approach = E.APPROACHES[state.selectedApproach] || E.APPROACHES.standard;
    if (!state.selectedParty.length || !encounter || state.activities.expeditions[encounterKey] || state.expeditionResults[encounterKey]) return;
    var run = state.runNumber + 1, attackBonuses = equipmentAttack();
    var seed = E.encounterSeed(state.seed, run, state.selectedParty, equipmentSignature(), encounterKey, state.selectedApproach), heroStates = {};
    state.selectedParty.forEach(function (key) { heroStates[key] = Object.assign({}, state.heroes[key]); });
    var first = encounterKey === 'abandoned-road' && !state.firstExpeditionComplete;
    var baseDuration = first ? 45 : encounter.duration;
    var duration = Math.max(8, Math.round(baseDuration * approach.duration));
    state.activities.expeditions[encounterKey] = { type: 'expedition', title: encounter.name, encounterKey: encounterKey, approach: state.selectedApproach, party: state.selectedParty.slice(), heroStates: heroStates, startedAt: Date.now(), endsAt: Date.now() + duration * 1000, duration: duration, seed: seed, equipmentAttack: attackBonuses, context: first ? 'first' : 'repeat' };
    set({ runNumber: run, expeditionScreen: 'list', currentResult: null, tutorial: null, notice: encounter.name + ' is under way. Other locations remain available.' });
  }

  function claimRewards(expeditionKey) {
    var result = state.expeditionResults[expeditionKey];
    if (!result) return;
    var rewards = result.rewards, first = expeditionKey === 'abandoned-road' && !state.firstExpeditionComplete;
    state.gold += rewards.gold; state.scrap += rewards.scrap; state.herbs += rewards.herbs;
    state.completedExpeditions[expeditionKey] = Number(state.completedExpeditions[expeditionKey] || 0) + 1;
    delete state.expeditionResults[expeditionKey];
    set({ firstExpeditionComplete: state.firstExpeditionComplete || first, expeditionScreen: 'list', view: 'expeditions', tutorial: first && !state.tutorialSkipped ? 'return-town-workshop' : null, notice: 'Rewards added to company stores.' });
  }

  function assignFacility(hero, facilityKey, index) {
    var facility = FACILITIES[facilityKey];
    if (!hero || !facility || !facility.working || !facility.slots || heroBusy(hero) || state.activities.facilities[facilityKey][index] || state.gold < facility.cost) return;
    state.gold -= facility.cost;
    state.activities.facilities[facilityKey][index] = { type: 'facility', title: facility.activity, hero: hero, startedAt: Date.now(), endsAt: Date.now() + facility.duration * 1000, duration: facility.duration, effects: facility.effects };
    var patch = { selectedHero: hero, notice: E.HEROES[hero].name + ' has begun ' + facility.activity + '.' };
    if (state.tutorial === 'assign-orin' && hero === 'orin') patch.tutorial = 'expeditions-next';
    set(patch);
  }

  function equipItem(hero, itemId) {
    var index = state.inventory.findIndex(function (item) { return item.id === itemId; });
    if (index < 0) return;
    var item = state.inventory[index], equipment = Object.assign(emptyEquipment(), state.equipment[hero]);
    if (!itemCompatible(item, hero, item.slot)) return;
    if (equipment[item.slot]) state.inventory.push(equipment[item.slot]);
    equipment[item.slot] = item; state.equipment[hero] = equipment; state.inventory.splice(index, 1);
    var patch = { view: 'roster', notice: item.name + ' equipped by ' + E.HEROES[hero].name + '.', equipmentSlot: null, selectedInventoryItem: null, showIncompatibleItems: false, completedActivity: null };
    if (state.tutorial === 'equip-sword') { patch.view = 'town'; patch.tutorial = 'town-tavern'; patch.activeBuilding = null; }
    set(patch);
  }

  function act(action, data) {
    if (action === 'toggle-roster') set({ rosterOpen: !state.rosterOpen });
    if (action === 'select-hero' && data.hero) set({ selectedHero: data.hero, view: state.activeBuilding ? state.view : 'roster', activeBuilding: state.activeBuilding, rosterOpen: false, equipmentSlot: null });
    if (action === 'toggle-party' && data.hero && !heroBusy(data.hero)) {
      var selected = state.selectedParty.indexOf(data.hero) >= 0 ? state.selectedParty.filter(function (key) { return key !== data.hero; }) : state.selectedParty.length < 3 ? state.selectedParty.concat(data.hero) : state.selectedParty;
      set({ selectedParty: selected });
    }
    if (action === 'prepare-expedition' && data.expedition && expeditionUnlocked(data.expedition) && !state.activities.expeditions[data.expedition] && !state.expeditionResults[data.expedition]) set({ expeditionScreen: 'prepare', selectedExpedition: data.expedition, selectedApproach: 'standard', selectedParty: Object.keys(E.HEROES).filter(function (key) { return !heroBusy(key); }).slice(0, 3), tutorial: state.tutorial === 'expedition-prepare' ? 'party-send' : state.tutorial });
    if (action === 'cancel-preparation') set({ expeditionScreen: 'list' });
    if (action === 'select-approach' && data.approach && E.APPROACHES[data.approach]) set({ selectedApproach: data.approach });
    if (action === 'send-expedition') startExpedition();
    if (action === 'review-expedition' && data.expedition && state.expeditionResults[data.expedition]) set({ selectedExpedition: data.expedition, expeditionScreen: 'results' });
    if (action === 'claim-rewards' && data.expedition) claimRewards(data.expedition);
    if (action === 'leave-replay') set({ currentResult: null, resultContext: null, expeditionScreen: 'list' });
    if (action === 'close-building') set({ activeBuilding: null });
    if (action === 'open-building' && data.building) openBuilding(data.building);
    if (action === 'assign-facility') assignFacility(state.selectedHero, data.facility, Number(data.slot));
    if (action === 'craft' && !state.activities.craft && !state.workshopOutput && !inventoryFull() && state.gold >= 15 && state.scrap >= 3) {
      state.gold -= 15; state.scrap -= 3;
      var craftDuration = state.tutorial === 'forge' ? 10 : 30;
      state.activities.craft = { type: 'craft', title: 'Iron Sword', startedAt: Date.now(), endsAt: Date.now() + craftDuration * 1000, duration: craftDuration };
      set({ tutorial: state.tutorial === 'forge' ? 'crafting' : state.tutorial, notice: null, completedActivity: null });
    }
    if (action === 'open-equipment-slot' && data.hero && data.slot) {
      var firstCompatible = state.inventory.find(function (item) { return itemCompatible(item, data.hero, data.slot); });
      set({ view: 'inventory', selectedHero: data.hero, equipmentSlot: data.slot, selectedInventoryItem: firstCompatible ? firstCompatible.id : null, showIncompatibleItems: false, pendingDismantleId: null, tutorial: state.tutorial === 'open-main-hand' && data.slot === 'mainHand' ? 'equip-sword' : state.tutorial });
    }
    if (action === 'cancel-equipment-choice') set({ view: 'roster', equipmentSlot: null, selectedInventoryItem: null, showIncompatibleItems: false });
    if (action === 'toggle-incompatible') set({ showIncompatibleItems: !state.showIncompatibleItems, selectedInventoryItem: null });
    if (action === 'equip-item') equipItem(data.hero, data.itemId);
    if (action === 'unequip-item' && data.hero && data.slot) {
      var worn = state.equipment[data.hero][data.slot];
      if (worn && !inventoryFull()) { state.inventory.push(worn); state.equipment[data.hero][data.slot] = null; set({ equipmentSlot: data.slot, notice: worn.name + ' returned to company inventory.' }); }
    }
    if (action === 'select-inventory-item') set({ selectedInventoryItem: data.itemId, pendingDismantleId: null });
    if (action === 'request-dismantle' && data.itemId) set({ pendingDismantleId: data.itemId });
    if (action === 'cancel-dismantle') set({ pendingDismantleId: null });
    if (action === 'confirm-dismantle' && data.itemId && state.pendingDismantleId === data.itemId) {
      var dismantleIndex = state.inventory.findIndex(function (item) { return item.id === data.itemId; });
      if (dismantleIndex >= 0) {
        var dismantled = state.inventory[dismantleIndex];
        state.inventory.splice(dismantleIndex, 1); state.scrap += 1;
        set({ selectedInventoryItem: null, pendingDismantleId: null, notice: dismantled.name + ' dismantled. 1 scrap recovered.' });
      }
    }
    if (action === 'store-workshop-output' && state.workshopOutput && !inventoryFull()) {
      state.inventory.push(state.workshopOutput); state.workshopOutput = null;
      set({ completedActivity: null, notice: 'The finished item has been stored in company inventory.' });
    }
    if (action === 'open-activity') {
      if (data.activity === 'expedition') set({ view: 'expeditions', expeditionScreen: 'list', selectedExpedition: data.expedition || state.selectedExpedition, activeBuilding: null });
      if (data.activity === 'expedition-result') set({ view: 'expeditions', expeditionScreen: 'results', selectedExpedition: data.expedition, activeBuilding: null });
      if (data.activity === 'craft') set({ view: 'town', activeBuilding: 'workshop' });
      if (data.activity === 'craft-ready') set(state.workshopOutput ? { view: 'town', activeBuilding: 'workshop' } : { view: 'inventory', activeBuilding: null, completedActivity: null });
    }
    if (action === 'skip-tutorial') set({ tutorial: null, tutorialSkipped: true });
    if (action === 'dev') set({ devOpen: !state.devOpen });
    if (action === 'change-resource' && data.resource) {
      var resourceInput = document.getElementById('resource-' + data.resource);
      var resourceValue = resourceInput ? Math.floor(Number(resourceInput.value)) : NaN;
      if (['gold', 'scrap', 'herbs'].indexOf(data.resource) >= 0 && Number.isFinite(resourceValue) && resourceValue >= 0) {
        var resourcePatch = {};
        resourcePatch[data.resource] = data.mode === 'set' ? resourceValue : state[data.resource] + resourceValue;
        resourcePatch.notice = data.resource.charAt(0).toUpperCase() + data.resource.slice(1) + ' adjusted by administrative control.';
        set(resourcePatch);
      }
    }
    if (action === 'set-inventory-capacity') {
      var capacityInput = document.getElementById('inventory-capacity');
      var capacity = capacityInput ? Math.floor(Number(capacityInput.value)) : NaN;
      if (Number.isFinite(capacity) && capacity >= DEFAULT_INVENTORY_CAPACITY && capacity <= 60 && capacity >= state.inventory.length) set({ inventoryCapacity: capacity, notice: 'Inventory capacity set to ' + capacity + ' slots.' });
      else set({ notice: 'Capacity must be between 12 and 60 and cannot be below the number of stored items.' });
    }
    if (action === 'skip-timers') {
      allExpeditionActivities().forEach(function (entry) { entry.activity.endsAt = Date.now(); });
      if (state.activities.craft) state.activities.craft.endsAt = Date.now();
      allFacilityActivities().forEach(function (entry) { entry.activity.endsAt = Date.now(); });
      completeActivities(); render();
    }
    if (action === 'apply-seed') { var input = document.getElementById('seed-input'); if (input && input.value.trim()) set({ seed: input.value.trim(), runNumber: 0, notice: 'World seed changed. Future expeditions will use the new sequence.' }); }
    if (action === 'random-seed') { var bytes = new Uint32Array(1); crypto.getRandomValues(bytes); set({ seed: String(bytes[0]), runNumber: 0, notice: 'A new world seed has been generated.' }); }
    if (action === 'copy-seed') { if (navigator.clipboard) navigator.clipboard.writeText(state.seed); set({ notice: 'Seed copied: ' + state.seed }); }
    if (action === 'replay' && state.lastResult) set({ currentResult: E.simulateBattle(Object.assign({}, state.lastResult.inputs, { includeLog: true })), resultContext: 'admin', selectedExpedition: state.lastResult.inputs.encounterKey || 'abandoned-road', view: 'expeditions', expeditionScreen: 'results' });
    if (action === 'export') exportSave();
    if (action === 'install' && installPrompt) installPrompt.prompt().then(function () { installPrompt = null; render(); });
    if (action === 'restart') { state = fresh(); save(); render(); }
  }

  function exportSave() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'adventure-company-save-v5.json'; link.click(); URL.revokeObjectURL(url); set({ notice: 'Save exported.' });
  }

  function importSave(event) {
    var file = event.target.files && event.target.files[0]; if (!file) return;
    file.text().then(function (text) {
      var incoming = JSON.parse(text);
      if (!incoming || !incoming.heroes || !incoming.activities) throw new Error('This is not a valid Adventure Company save.');
      state = incoming.saveVersion >= 3 ? normalise(incoming) : normalise(migrate(incoming)); save(); render();
    }).catch(function (error) { set({ notice: 'Import failed: ' + error.message }); });
  }

  window.addEventListener('beforeinstallprompt', function (event) { event.preventDefault(); installPrompt = event; render(); });
  window.addEventListener('appinstalled', function () { installPrompt = null; set({ notice: 'Adventure Company has been installed.' }); });
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });

  var context = document.modelContext;
  if (context && context.registerTool) {
    var schema = { type: 'object', properties: {}, additionalProperties: false };
    Promise.resolve(context.registerTool({ name: 'get_company_state', title: 'Get company state', description: 'Read current Adventure Company progress, activities and resources.', inputSchema: schema, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: function () { return { view: state.view, seed: state.seed, runNumber: state.runNumber, resources: { gold: state.gold, scrap: state.scrap, herbs: state.herbs }, activities: state.activities }; } })).catch(function () {});
    Promise.resolve(context.registerTool({ name: 'finish_current_prototype_timers', title: 'Finish current timers', description: 'Finish all active prototype timers.', inputSchema: schema, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: function () { allExpeditionActivities().forEach(function (entry) { entry.activity.endsAt = Date.now(); }); if (state.activities.craft) state.activities.craft.endsAt = Date.now(); allFacilityActivities().forEach(function (entry) { entry.activity.endsAt = Date.now(); }); completeActivities(); render(); return { finished: true, view: state.view }; } })).catch(function () {});
  }

  setInterval(function () {
    var active = Boolean(allExpeditionActivities().length || state.activities.craft || allFacilityActivities().length);
    if (!active) return;
    if (completeActivities()) render(); else updateLiveActivities();
  }, 1000);
  render();
})();
