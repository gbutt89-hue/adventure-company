(function () {
  'use strict';

  var E = window.AdventureEngine;
  var SAVE_KEY = 'adventure-company-prototype-v3';
  var LEGACY_KEYS = ['adventure-company-prototype-v2', 'adventure-company-prototype-v1'];
  var installPrompt = null;
  var draggedHero = null;

  var HERO_UI = {
    elara: { initials: 'EV', colour: 'rust' },
    fen: { initials: 'FA', colour: 'green' },
    orin: { initials: 'OV', colour: 'violet' }
  };

  var STAT_INFO = {
    attack: 'Base damage before variation and mitigation. Low Readiness can reduce it.',
    armour: 'Reduces incoming physical damage. It does not protect against magical damage.',
    ward: 'Reduces incoming magical damage. It does not protect against physical damage.',
    speed: 'Influences action order each round. Low Readiness can reduce it.',
    accuracy: 'The base chance that an attack connects before encounter modifiers are applied.',
    critical: 'The base chance that a successful attack becomes a critical hit.',
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
      saveVersion: 3, stage: 'intro', view: 'town', expeditionScreen: 'list', activeBuilding: null,
      companyName: '', gold: 20, scrap: 0, herbs: 0, seed: '731942', runNumber: 0,
      selectedParty: ['elara', 'fen', 'orin'], selectedHero: 'elara', firstExpeditionComplete: false,
      tutorial: 'town-expeditions', tutorialSkipped: false, rosterOpen: false, devOpen: false, notice: null,
      currentResult: null, lastResult: null, resultContext: null, resultClaimed: false,
      selectedInventoryItem: null, equipmentSlot: null, completedActivity: null,
      craftXp: 0, lastCraftXpGain: 0, nextItemId: 1, inventory: [],
      equipment: { elara: emptyEquipment(), fen: emptyEquipment(), orin: emptyEquipment() },
      activities: { expedition: null, craft: null, facilities: emptyFacilities() },
      heroes: {
        elara: { health: 100, mana: 30, readiness: 100, xp: 0 },
        fen: { health: 100, mana: 20, readiness: 100, xp: 0 },
        orin: { health: 100, mana: 45, readiness: 100, xp: 0 }
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
      next.activities.expedition = old.activities.expedition || null;
      next.activities.craft = old.activities.craft || null;
      if (old.activities.recovery) next.activities.facilities.tavern[0] = old.activities.recovery;
    }
    if (old.currentResult) next.currentResult = old.currentResult;
    if (old.lastResult) next.lastResult = old.lastResult;
    if (old.stage === 'results') { next.view = 'expeditions'; next.expeditionScreen = 'results'; }
    else if (next.activities.expedition) { next.view = 'expeditions'; next.expeditionScreen = 'active'; }
    next.tutorial = next.tutorialSkipped ? null : (next.firstExpeditionComplete ? null : 'town-expeditions');
    return next;
  }

  function normalise(value) {
    var base = fresh();
    var next = Object.assign(base, value || {});
    next.saveVersion = 3;
    next.heroes = Object.assign(base.heroes, next.heroes || {});
    next.equipment = Object.assign(base.equipment, next.equipment || {});
    Object.keys(E.HEROES).forEach(function (key) { next.equipment[key] = Object.assign(emptyEquipment(), next.equipment[key] || {}); });
    next.activities = Object.assign(base.activities, next.activities || {});
    next.activities.facilities = Object.assign(emptyFacilities(), next.activities.facilities || {});
    Object.keys(emptyFacilities()).forEach(function (key) {
      var required = FACILITIES[key].slots;
      var slots = Array.isArray(next.activities.facilities[key]) ? next.activities.facilities[key].slice(0, required) : [];
      while (slots.length < required) slots.push(null);
      next.activities.facilities[key] = slots;
    });
    next.inventory = Array.isArray(next.inventory) ? next.inventory : [];
    next.inventory = next.inventory.map(normaliseItem);
    Object.keys(E.HEROES).forEach(function (key) {
      Object.keys(next.equipment[key]).forEach(function (slot) {
        if (next.equipment[key][slot]) next.equipment[key][slot] = normaliseItem(next.equipment[key][slot]);
      });
    });
    next.selectedParty = Array.isArray(next.selectedParty) ? next.selectedParty : ['elara', 'fen', 'orin'];
    return next;
  }

  function load() {
    try {
      var current = localStorage.getItem(SAVE_KEY);
      if (current) return normalise(JSON.parse(current));
      for (var i = 0; i < LEGACY_KEYS.length; i += 1) {
        var legacy = localStorage.getItem(LEGACY_KEYS[i]);
        if (legacy) return normalise(migrate(JSON.parse(legacy)));
      }
    } catch (_) {}
    return fresh();
  }

  var state = load();

  function ironSword(id) {
    return { id: id, key: 'iron-sword', name: 'Iron Sword', slot: 'mainHand', attack: 4, rarity: 'Common', allowedRoles: ['Vanguard', 'Ranger'], source: 'Forged in the Company Workshop' };
  }

  function normaliseItem(item) {
    if (!item) return item;
    if (item.key === 'iron-sword') return Object.assign(ironSword(item.id), item, { allowedRoles: item.allowedRoles || ['Vanguard', 'Ranger'] });
    return item;
  }

  function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  function esc(value) { return String(value).replace(/[&<>'"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]; }); }
  function set(patch) { state = normalise(Object.assign({}, state, patch)); save(); render(); }
  function remaining(activity) { return activity ? Math.max(0, Math.ceil((activity.endsAt - Date.now()) / 1000)) : 0; }
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

  function heroActivity(key) {
    var expedition = state.activities.expedition;
    if (expedition && expedition.party.indexOf(key) >= 0) return { title: 'Abandoned Road', remaining: remaining(expedition) };
    var found = allFacilityActivities().find(function (entry) { return entry.activity.hero === key; });
    return found ? { title: FACILITIES[found.facility].shortName, remaining: remaining(found.activity) } : null;
  }

  function heroBusy(key) { return Boolean(heroActivity(key)); }

  function forecast() {
    return E.forecast({ party: state.selectedParty, heroStates: state.heroes, seed: state.seed, equipmentAttack: equipmentAttack(), samples: 400 });
  }

  function completeActivities() {
    var changed = false;
    var now = Date.now();
    var expedition = state.activities.expedition;
    if (expedition && expedition.endsAt <= now) {
      var beforeStates = expedition.heroStates || state.heroes;
      var result = E.simulateBattle({ party: expedition.party, heroStates: beforeStates, swordEquipped: expedition.swordEquipped, equipmentAttack: expedition.equipmentAttack, seed: expedition.seed, includeLog: true });
      if (expedition.context === 'first') result.rewards.scrap = Math.max(3, result.rewards.scrap);
      result.changes = {};
      expedition.party.forEach(function (key) {
        var outcome = result.heroes[key];
        var before = Object.assign({}, beforeStates[key]);
        var hero = Object.assign({}, state.heroes[key]);
        hero.health = outcome.healthPercent;
        hero.readiness = Math.max(0, hero.readiness - (18 + result.rounds * 2));
        hero.mana = outcome.remainingMana;
        var xpGain = E.experienceGain(key, result.rewards.xp);
        hero.xp += xpGain;
        result.changes[key] = { before: before, after: { health: hero.health, mana: hero.mana, readiness: hero.readiness, xp: hero.xp }, xpGain: xpGain };
        state.heroes[key] = hero;
      });
      state.currentResult = result;
      state.lastResult = { inputs: { party: expedition.party, swordEquipped: expedition.swordEquipped, equipmentAttack: expedition.equipmentAttack, seed: expedition.seed }, result: result };
      state.resultContext = expedition.context;
      state.resultClaimed = false;
      state.activities.expedition = null;
      state.view = 'expeditions';
      state.expeditionScreen = 'results';
      if (!state.tutorialSkipped && expedition.context === 'first') state.tutorial = 'claim-rewards';
      changed = true;
    }
    var craft = state.activities.craft;
    if (craft && craft.endsAt <= now) {
      state.activities.craft = null;
      state.inventory.push(ironSword('item-' + state.nextItemId));
      state.nextItemId += 1;
      state.craftXp = Math.min(100, state.craftXp + 18);
      state.lastCraftXpGain = 18;
      state.notice = 'The Iron Sword is ready and has been placed in company inventory.';
      state.completedActivity = { type: 'craft', label: 'Workshop: item ready' };
      if (!state.tutorialSkipped && state.tutorial === 'crafting') state.tutorial = 'open-roster';
      changed = true;
    }
    allFacilityActivities().forEach(function (entry) {
      if (entry.activity.endsAt > now) return;
      var recovered = Object.assign({}, state.heroes[entry.activity.hero]);
      var effects = entry.activity.effects || FACILITIES[entry.facility].effects || {};
      Object.keys(effects).forEach(function (stat) { recovered[stat] = Math.min(100, recovered[stat] + effects[stat]); });
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
      var activity = key === 'expedition' ? state.activities.expedition : key === 'craft' ? state.activities.craft : null;
      if (activity) element.textContent = timeText(remaining(activity));
    });
    document.querySelectorAll('[data-facility-countdown]').forEach(function (element) {
      var parts = element.dataset.facilityCountdown.split(':');
      var activity = state.activities.facilities[parts[0]][Number(parts[1])];
      if (activity) element.textContent = timeText(remaining(activity));
    });
    document.querySelectorAll('[data-progress-key]').forEach(function (element) {
      var key = element.dataset.progressKey;
      var activity = key === 'expedition' ? state.activities.expedition : state.activities.craft;
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
      var activeActivity = activityKey === 'expedition' ? state.activities.expedition : state.activities.craft;
      if (activeActivity) element.textContent = timeText(remaining(activeActivity));
    });
  }

  function infoTerm(label, description) {
    return '<span class="info-wrap"><button type="button" class="info-term" aria-label="' + esc(label + ': ' + description) + '">' + esc(label) + '</button><span class="info-popover" role="tooltip"><strong>' + esc(label) + '</strong><span>' + esc(description) + '</span></span></span>';
  }

  function meter(name, value, kind) {
    return '<div class="meter-row"><span>' + infoTerm(name, STAT_INFO[name.toLowerCase()]) + '</span><span class="meter ' + (kind || '') + '"><i style="width:' + Math.max(0, Math.min(100, value)) + '%"></i></span><b>' + value + '</b></div>';
  }

  function heroIdentity(key, plain) {
    var hero = E.HEROES[key];
    return '<div class="hero-identity"><strong>' + esc(hero.name) + '</strong><span>' + (plain ? esc(hero.role) : infoTerm(hero.role, E.ROLES[hero.role])) + '</span><span>Level 1</span></div>';
  }

  function heroCompact(key, options) {
    options = options || {};
    var hero = E.HEROES[key];
    var ui = HERO_UI[key];
    var condition = state.heroes[key];
    var stats = effectiveHeroStats(key);
    var chosen = state.selectedParty.indexOf(key) >= 0;
    var busy = heroBusy(key);
    var activity = heroActivity(key);
    return '<article class="hero-card ' + (chosen && options.selectable ? 'selected ' : '') + (busy ? 'busy ' : '') + '">' +
      '<div class="hero-card-head"><span class="portrait ' + ui.colour + '">' + ui.initials + '</span>' + heroIdentity(key, false) +
      (options.selectable ? '<button class="hero-choice" type="button" data-action="toggle-party" data-hero="' + key + '" ' + (busy ? 'disabled' : '') + ' aria-pressed="' + chosen + '">' + (chosen ? 'Selected' : 'Select') + '</button>' : '') + '</div>' +
      '<div class="combat-tags"><span>' + hero.combatStyle + '</span><span>' + (hero.damageType === 'magical' ? 'Magical' : 'Physical') + '</span><span>' + infoTerm(hero.trait, E.TRAITS[hero.trait]) + '</span></div>' +
      '<div class="stat-chips"><span>' + infoTerm('ATK', STAT_INFO.attack) + '<b>' + stats.attack + '</b></span><span>' + infoTerm('ARM', STAT_INFO.armour) + '<b>' + stats.armour + '</b></span><span>' + infoTerm('WARD', STAT_INFO.ward) + '<b>' + stats.ward + '</b></span><span>' + infoTerm('SPD', STAT_INFO.speed) + '<b>' + stats.speed + '</b></span></div>' +
      '<div class="condition-bars">' + meter('Health', condition.health, 'health') + meter('Mana', condition.mana, 'mana') + meter('Readiness', condition.readiness, 'ready') + '</div>' +
      (activity ? '<div class="away-label" data-hero-timer="' + key + '">' + activity.title + ' ' + timeText(activity.remaining) + '</div>' : '') + '</article>';
  }

  function heroRail() {
    return '<aside class="hero-rail ' + (state.rosterOpen ? 'open' : '') + '" aria-label="Company roster"><div class="rail-heading"><div><span class="label">Company roster</span><strong>Heroes</strong></div><button class="rail-close" data-action="toggle-roster" aria-label="Close roster">×</button></div>' +
      Object.keys(E.HEROES).map(function (key) {
        var hero = E.HEROES[key], ui = HERO_UI[key], condition = state.heroes[key], busy = heroBusy(key), activity = heroActivity(key);
        return '<button class="rail-hero ' + (state.selectedHero === key ? 'selected ' : '') + (busy ? 'busy' : '') + '" data-action="select-hero" data-hero="' + key + '" draggable="' + (!busy) + '" data-draggable-hero="' + key + '">' +
          '<span class="portrait ' + ui.colour + '">' + ui.initials + '</span><span class="rail-copy"><strong>' + esc(hero.name) + '</strong><span>' + hero.role + ' · Level 1</span><span class="rail-condition"><i class="health" style="width:' + condition.health + '%"></i></span>' +
          (activity ? '<em data-hero-timer="' + key + '">' + activity.title + ' ' + timeText(activity.remaining) + '</em>' : '<em>Available</em>') + '</span></button>';
      }).join('') + '<p class="rail-hint">Select a hero, or drag an available hero into a facility slot.</p></aside>';
  }

  function activityStrip() {
    var chips = [];
    if (state.activities.expedition) chips.push('<button data-action="open-activity" data-activity="expedition"><span>Expedition</span><strong data-activity-countdown="expedition">' + timeText(remaining(state.activities.expedition)) + '</strong></button>');
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
    var body = craft ? '<article class="craft-card"><div class="item-icon">⚔</div><div><span class="label">In progress</span><h3>Iron Sword</h3><div class="timer small" data-countdown-key="craft">' + timeText(remaining(craft)) + '</div><div class="progress"><i data-progress-key="craft" style="width:' + activityProgress(craft) + '%"></i></div></div></article>' :
      '<article class="craft-card"><div class="item-icon">⚔</div><div><span class="label">Common main-hand weapon</span><h3>Iron Sword</h3><p>Attack +4. Usable by a Vanguard or Ranger.</p><div class="costs"><span>15 gold</span><span>3 scrap</span><span>' + duration + ' sec</span><span>+18 Craft XP</span></div><button class="primary" data-action="craft" data-tutorial-target="forge" ' + (state.gold < 15 || state.scrap < 3 ? 'disabled' : '') + '>Forge</button></div></article>';
    return facilityFrame('workshop', body + '<aside class="workshop-level"><span class="label">Crafting level 1</span><strong>' + state.craftXp + ' / 100 Craft XP</strong><div class="progress"><i style="width:' + state.craftXp + '%"></i></div><p>Finished items enter Inventory. Equipment is managed from a hero’s character sheet.</p></aside>');
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
    return heading('Operations', 'Expeditions', 'Choose an expedition, assemble any available combination of heroes and review its forecast.') + '<section class="mission-card"><div class="mission-banner"><span>North Road</span><strong>Level 1</strong></div><h2>Abandoned Road</h2><p>Merchants report bandits and strange lights along the old north road. Clear the obstruction and recover anything useful.</p><div class="tags"><span>Physical threats</span><span>' + (state.firstExpeditionComplete ? '25 sec' : '45 sec tutorial') + '</span><span>Repeatable</span></div><div class="reward-strip"><span>14–21 gold</span><span>3–4 scrap</span><span>Possible herb</span><span>Combat XP</span></div><button class="primary" data-action="prepare-expedition" data-tutorial-target="mission-prepare">Prepare company</button></section>';
  }

  function preparation() {
    var result = forecast();
    var danger = result ? '<aside class="danger-panel"><span class="label">Predicted danger</span><strong class="danger-value">' + result.danger + '%</strong><div class="risk"><i style="width:' + result.danger + '%"></i></div><h3>' + (result.danger <= 20 ? 'Comfortable' : result.danger <= 45 ? 'Manageable' : 'Risky') + '</h3><dl><div><dt>Success</dt><dd>' + result.successChance + '%</dd></div><div><dt>Injury</dt><dd>' + result.injuryChance + '%</dd></div><div><dt>Expected health loss</dt><dd>' + result.expectedHealthLoss + '%</dd></div></dl><button class="primary" data-action="send-expedition" data-tutorial-target="send-expedition">Send party</button><button class="secondary" data-action="cancel-preparation">Back</button></aside>' : '<aside class="danger-panel empty"><span class="label">Predicted danger</span><strong class="danger-value">—</strong><h3>No party selected</h3><p>Select at least one available hero.</p><button class="primary" disabled>Send party</button><button class="secondary" data-action="cancel-preparation">Back</button></aside>';
    return heading('Expedition preparation', 'Abandoned Road', 'The forecast runs 400 seeded simulations using current condition and equipment.') + '<div class="preparation-grid"><section><div class="section-heading"><h2>Your party</h2><span>' + state.selectedParty.length + '/3 selected</span></div><div class="hero-grid">' + Object.keys(E.HEROES).map(function (key) { return heroCompact(key, { selectable: true }); }).join('') + '</div></section>' + danger + '</div>';
  }

  function activeExpedition() {
    var activity = state.activities.expedition;
    if (!activity) return expeditionList();
    return heading('Expedition under way', 'The party is on the road', 'Your company is away. Progress continues if you leave this page.') + '<section class="timer-card active-expedition-card"><span class="label">Time remaining</span><div class="timer" data-countdown-key="expedition">' + timeText(remaining(activity)) + '</div><div class="progress"><i data-progress-key="expedition" style="width:' + activityProgress(activity) + '%"></i></div><div class="party-portraits">' + activity.party.map(function (key) { return '<span class="portrait ' + HERO_UI[key].colour + '">' + HERO_UI[key].initials + '</span>'; }).join('') + '</div><p>The outcome will be ready when the timer ends.</p></section>';
  }

  function resultMeter(name, before, after, kind) {
    var delta = after - before;
    return '<div class="result-stat"><div><span>' + infoTerm(name, STAT_INFO[name.toLowerCase()]) + '</span><strong>' + before + ' → ' + after + ' <em class="' + (delta < 0 ? 'negative' : 'positive') + '">' + (delta > 0 ? '+' : '') + delta + '</em></strong></div><div class="result-meter ' + kind + '"><i class="before" style="width:' + before + '%"></i><i class="after" style="width:' + after + '%"></i><b style="left:' + before + '%"></b></div></div>';
  }

  function results() {
    var result = state.currentResult;
    if (!result) return expeditionList();
    var changes = result.changes || {}, party = Object.keys(changes);
    var averageLoss = party.length ? party.reduce(function (total, key) { return total + Math.max(0, changes[key].before.health - changes[key].after.health); }, 0) / party.length : 0;
    var injuries = party.filter(function (key) { return result.heroes[key] && result.heroes[key].injured; }).length;
    var verdict = !result.success ? 'The company limped home, but every name remains on the roster.' : injuries ? 'The road exacted a heavy price. Everyone made it back.' : averageLoss <= 10 ? 'The company returned barely scuffed.' : averageLoss <= 25 ? 'A few bruises, but everyone walked home.' : 'A costly victory. The company will feel this one tomorrow.';
    var resultAction = state.resultContext === 'admin' ? '<button class="primary" data-action="leave-replay">Return</button>' : '<button class="primary" data-action="claim-rewards" data-tutorial-target="claim-rewards">Take rewards</button>';
    return heading('Expedition complete', result.success ? 'Road secured' : 'Company withdrawn', verdict) + '<section class="outcome-summary"><div><span class="label">Company outcome</span><h2>' + verdict + '</h2><p>' + result.rounds + ' combat rounds · ' + (result.potionUsed ? 'At least one Field Tonic was consumed.' : 'No Field Tonics were needed.') + '</p></div><aside><h3>Recovered</h3><div class="reward-strip"><span>' + result.rewards.gold + ' gold</span><span>' + result.rewards.scrap + ' scrap</span><span>' + result.rewards.herbs + ' herb</span><span>' + result.rewards.xp + ' base XP</span></div></aside></section><section class="results-panel"><div class="section-heading"><h2>Company condition</h2><span>Before → after</span></div><div class="hero-results">' + party.map(function (key) {
      var change = changes[key];
      return '<article><div class="result-hero-head"><span class="portrait ' + HERO_UI[key].colour + '">' + HERO_UI[key].initials + '</span><div><h3>' + E.HEROES[key].name + '</h3><span>+' + change.xpGain + ' XP</span></div></div>' + resultMeter('Health', change.before.health, change.after.health, 'health') + resultMeter('Mana', change.before.mana, change.after.mana, 'mana') + resultMeter('Readiness', change.before.readiness, change.after.readiness, 'ready') + '</article>';
    }).join('') + '</div>' + resultAction + '</section><details class="encounter-log"><summary>Show encounter log <span>' + result.rounds + ' rounds · Seeded</span></summary><ol>' + result.log.map(function (line) { return '<li>' + esc(line) + '</li>'; }).join('') + '</ol></details>';
  }

  function expeditions() {
    if (state.expeditionScreen === 'prepare') return preparation();
    if (state.expeditionScreen === 'active') return activeExpedition();
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

  function equipmentPicker(heroKey, slot) {
    if (!slot || state.equipmentSlot !== slot) return '';
    var current = equippedItem(heroKey, slot);
    var compatible = state.inventory.filter(function (item) { return itemCompatible(item, heroKey, slot); });
    var items = compatible.length ? compatible.map(function (item) {
      return '<article class="picker-item">' + itemCard(item) + '<button class="primary small-button" data-action="equip-item" data-item-id="' + item.id + '" data-hero="' + heroKey + '" data-tutorial-target="equip-sword">Equip</button></article>';
    }).join('') : '<p class="picker-empty">No compatible ' + SLOT_LABELS[slot].toLowerCase() + ' items are in company inventory.</p>';
    return '<aside class="slot-picker"><header><div><span class="label">Choose equipment</span><h3>' + SLOT_LABELS[slot] + '</h3></div><button class="secondary small-button" data-action="close-equipment-picker">Close</button></header>' +
      (current ? '<div class="current-equipment"><span>Currently equipped</span><strong>' + current.name + '</strong><button class="secondary small-button" data-action="unequip-item" data-hero="' + heroKey + '" data-slot="' + slot + '">Unequip</button></div>' : '') +
      '<div class="picker-grid">' + items + '</div></aside>';
  }

  function characterSheet(key) {
    var hero = E.HEROES[key], ui = HERO_UI[key], condition = state.heroes[key], stats = effectiveHeroStats(key);
    return '<section class="character-sheet"><header><span class="portrait large ' + ui.colour + '">' + ui.initials + '</span>' + heroIdentity(key, false) + '<div class="combat-tags"><span>' + hero.combatStyle + '</span><span>' + (hero.damageType === 'magical' ? 'Magical' : 'Physical') + '</span></div></header><div class="sheet-columns"><section><span class="label">Condition</span>' + meter('Health', condition.health, 'health') + meter('Mana', condition.mana, 'mana') + meter('Readiness', condition.readiness, 'ready') + '<div class="xp-line"><span>Experience</span><strong>' + condition.xp + ' XP</strong></div><span class="label sheet-label">Combat statistics</span><div class="full-stats"><span>' + infoTerm('Attack', STAT_INFO.attack) + '<b>' + stats.attack + '</b></span><span>' + infoTerm('Armour', STAT_INFO.armour) + '<b>' + stats.armour + '</b></span><span>' + infoTerm('Ward', STAT_INFO.ward) + '<b>' + stats.ward + '</b></span><span>' + infoTerm('Speed', STAT_INFO.speed) + '<b>' + stats.speed + '</b></span><span>' + infoTerm('Accuracy', STAT_INFO.accuracy) + '<b>' + stats.accuracy + '%</b></span><span>' + infoTerm('Critical', STAT_INFO.critical) + '<b>' + stats.critical + '%</b></span></div><article class="trait-detail"><span class="label">Traits</span><strong>' + infoTerm(hero.trait, E.TRAITS[hero.trait]) + '</strong><p>' + E.TRAITS[hero.trait] + '</p></article></section><section><span class="label">Equipment</span><div class="equipment-grid">' + Object.keys(SLOT_LABELS).map(function (slot) {
      var item = equippedItem(key, slot);
      return '<button class="equipment-slot ' + (item ? 'filled ' : '') + (state.equipmentSlot === slot ? 'selected' : '') + '" data-action="open-equipment-slot" data-slot="' + slot + '" data-hero="' + key + '"' + (slot === 'mainHand' ? ' data-tutorial-target="main-hand-slot"' : '') + '><span>' + SLOT_LABELS[slot] + '</span><strong>' + (item ? item.name : 'Empty') + '</strong>' + (item ? '<em>Attack +' + item.attack + '</em>' : '<em>Choose item</em>') + '</button>';
    }).join('') + '</div>' + equipmentPicker(key, state.equipmentSlot) + '</section></div></section>';
  }

  function roster() {
    return heading('Company', 'Roster', 'Select a hero to inspect their condition, traits, combat statistics and equipment.') + '<div class="mobile-hero-tabs">' + Object.keys(E.HEROES).map(function (key) { return '<button data-action="select-hero" data-hero="' + key + '" class="' + (state.selectedHero === key ? 'active' : '') + '">' + E.HEROES[key].name.split(' ')[0] + '</button>'; }).join('') + '</div>' + characterSheet(state.selectedHero || 'elara');
  }

  function inventory() {
    var items = state.inventory;
    var selected = items.find(function (item) { return item.id === state.selectedInventoryItem; }) || items[0];
    var detail = selected ? '<aside class="inventory-detail"><span class="item-icon">⚔</span><span class="label">' + selected.rarity + ' equipment</span><h2>' + selected.name + '</h2><dl><div><dt>Slot</dt><dd>' + SLOT_LABELS[selected.slot] + '</dd></div><div><dt>Attack</dt><dd>+' + selected.attack + '</dd></div><div><dt>Usable by</dt><dd>' + itemRoles(selected) + '</dd></div><div><dt>Source</dt><dd>' + selected.source + '</dd></div></dl><p>Equipment changes are made from the relevant hero’s character sheet.</p></aside>' : '';
    return heading('Company stores', 'Inventory', 'Browse the equipment owned by the company. Equip it through a hero’s character sheet.') + '<section class="inventory-panel"><div class="section-heading"><h2>Equipment</h2><span>' + items.length + ' stored</span></div>' + (items.length ? '<div class="inventory-layout"><div class="inventory-grid">' + items.map(function (item) { return itemCard(item, { selectable: true, selected: selected && selected.id === item.id }); }).join('') + '</div>' + detail + '</div>' : '<div class="empty-state"><h3>The stores are empty</h3><p>Visit the Workshop in Town to forge equipment.</p><button class="secondary" data-action="open-building" data-building="workshop">Open Workshop</button></div>') + '</section>';
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
      'open-main-hand': { title: 'Choose an equipment slot', copy: 'Open Elara’s Main hand slot to see suitable items in company inventory.' },
      'equip-sword': { title: 'Equip Elara', copy: 'Choose the Iron Sword for Elara’s Main hand.' },
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
    return '<aside class="dev-panel"><span class="label">Administrative controls</span><h3>Primary resources</h3><div class="admin-resources">' + resourceControls + '</div><hr><h3>World seed</h3><input id="seed-input" value="' + esc(state.seed) + '" aria-label="World seed"><div class="admin-grid"><button class="secondary" data-action="apply-seed">Apply seed</button><button class="secondary" data-action="random-seed">Randomise</button></div><button class="secondary" data-action="copy-seed">Copy seed</button><button class="secondary" data-action="replay" ' + (!state.lastResult ? 'disabled' : '') + '>Re-run last encounter</button><button class="secondary" data-action="skip-timers">Finish active timers</button><hr><button class="secondary" data-action="export">Export save</button><label class="file-label">Import save<input class="sr-only" id="import-save" type="file" accept="application/json"></label><button class="secondary" data-action="restart">Reset all progress</button></aside>';
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
    app.innerHTML = '<div class="app-shell' + (state.tutorial ? ' tutorial-active' : '') + '"><header class="topbar"><div class="brand"><span class="brand-mark">A</span><div><strong>' + esc(state.companyName) + '</strong><span>Chartered adventure company · Prototype 0.3.4</span></div></div>' + activityStrip() + resources() + '<button class="roster-toggle" data-action="toggle-roster">Heroes</button></header>' + navigation() + '<div class="workspace"><main class="content">' + notice + mainView() + '</main>' + heroRail() + '</div><button class="dev-toggle" data-action="dev" aria-label="Administrative controls">⋯</button>' + devPanel() + tutorial() + '</div>';
    bind(); applyTutorialSpotlight();
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
  }

  function openView(view) {
    var patch = { view: view, activeBuilding: null, notice: null, rosterOpen: false, equipmentSlot: null };
    if (state.tutorial === 'town-expeditions' && view === 'expeditions') patch.tutorial = 'expedition-prepare';
    if (state.tutorial === 'return-town-workshop' && view === 'town') patch.tutorial = 'town-workshop';
    if (state.tutorial === 'open-roster' && view === 'roster') { patch.tutorial = 'open-main-hand'; patch.selectedHero = 'elara'; }
    if (state.tutorial === 'expeditions-next' && view === 'expeditions') patch.tutorial = null;
    if (view === 'inventory' && state.completedActivity && state.completedActivity.type === 'craft') patch.completedActivity = null;
    set(patch);
  }

  function openBuilding(key) {
    var patch = { view: 'town', activeBuilding: key, notice: null };
    if (state.tutorial === 'town-workshop' && key === 'workshop') patch.tutorial = 'forge';
    if (state.tutorial === 'town-tavern' && key === 'tavern') { patch.tutorial = 'assign-orin'; patch.selectedHero = 'orin'; }
    set(patch);
  }

  function startExpedition() {
    if (!state.selectedParty.length) return;
    var run = state.runNumber + 1, attackBonuses = equipmentAttack();
    var seed = E.encounterSeed(state.seed, run, state.selectedParty, equipmentSignature()), heroStates = {};
    state.selectedParty.forEach(function (key) { heroStates[key] = Object.assign({}, state.heroes[key]); });
    var duration = state.firstExpeditionComplete ? 25 : 45;
    state.activities.expedition = { type: 'expedition', title: 'Abandoned Road', party: state.selectedParty.slice(), heroStates: heroStates, startedAt: Date.now(), endsAt: Date.now() + duration * 1000, duration: duration, seed: seed, equipmentAttack: attackBonuses, context: state.firstExpeditionComplete ? 'repeat' : 'first' };
    set({ runNumber: run, expeditionScreen: 'active', currentResult: null, tutorial: null });
  }

  function claimRewards() {
    if (!state.currentResult) return;
    var rewards = state.currentResult.rewards, first = state.resultContext === 'first';
    state.gold += rewards.gold; state.scrap += rewards.scrap; state.herbs += rewards.herbs; state.resultClaimed = true; state.currentResult = null;
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
    var patch = { notice: item.name + ' equipped by ' + E.HEROES[hero].name + '.', equipmentSlot: null, completedActivity: null };
    if (state.tutorial === 'equip-sword') { patch.view = 'town'; patch.tutorial = 'town-tavern'; patch.activeBuilding = null; }
    set(patch);
  }

  function act(action, data) {
    if (action === 'toggle-roster') set({ rosterOpen: !state.rosterOpen });
    if (action === 'select-hero' && data.hero) set({ selectedHero: data.hero, rosterOpen: false, equipmentSlot: null });
    if (action === 'toggle-party' && data.hero && !heroBusy(data.hero)) {
      var selected = state.selectedParty.indexOf(data.hero) >= 0 ? state.selectedParty.filter(function (key) { return key !== data.hero; }) : state.selectedParty.concat(data.hero);
      set({ selectedParty: selected });
    }
    if (action === 'prepare-expedition') set({ expeditionScreen: 'prepare', selectedParty: Object.keys(E.HEROES).filter(function (key) { return !heroBusy(key); }), tutorial: state.tutorial === 'expedition-prepare' ? 'party-send' : state.tutorial });
    if (action === 'cancel-preparation') set({ expeditionScreen: 'list' });
    if (action === 'send-expedition') startExpedition();
    if (action === 'claim-rewards') claimRewards();
    if (action === 'leave-replay') set({ currentResult: null, resultContext: null, expeditionScreen: 'list' });
    if (action === 'close-building') set({ activeBuilding: null });
    if (action === 'open-building' && data.building) openBuilding(data.building);
    if (action === 'assign-facility') assignFacility(state.selectedHero, data.facility, Number(data.slot));
    if (action === 'craft' && !state.activities.craft && state.gold >= 15 && state.scrap >= 3) {
      state.gold -= 15; state.scrap -= 3;
      var craftDuration = state.tutorial === 'forge' ? 10 : 30;
      state.activities.craft = { type: 'craft', title: 'Iron Sword', startedAt: Date.now(), endsAt: Date.now() + craftDuration * 1000, duration: craftDuration };
      set({ tutorial: state.tutorial === 'forge' ? 'crafting' : state.tutorial, notice: null, completedActivity: null });
    }
    if (action === 'open-equipment-slot' && data.hero && data.slot) set({ selectedHero: data.hero, equipmentSlot: data.slot, tutorial: state.tutorial === 'open-main-hand' && data.slot === 'mainHand' ? 'equip-sword' : state.tutorial });
    if (action === 'close-equipment-picker') set({ equipmentSlot: null });
    if (action === 'equip-item') equipItem(data.hero, data.itemId);
    if (action === 'unequip-item' && data.hero && data.slot) {
      var worn = state.equipment[data.hero][data.slot];
      if (worn) { state.inventory.push(worn); state.equipment[data.hero][data.slot] = null; set({ equipmentSlot: data.slot, notice: worn.name + ' returned to company inventory.' }); }
    }
    if (action === 'select-inventory-item') set({ selectedInventoryItem: data.itemId });
    if (action === 'open-activity') {
      if (data.activity === 'expedition') set({ view: 'expeditions', expeditionScreen: state.activities.expedition ? 'active' : state.expeditionScreen, activeBuilding: null });
      if (data.activity === 'craft') set({ view: 'town', activeBuilding: 'workshop' });
      if (data.activity === 'craft-ready') set({ view: 'inventory', activeBuilding: null, completedActivity: null });
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
    if (action === 'skip-timers') {
      if (state.activities.expedition) state.activities.expedition.endsAt = Date.now();
      if (state.activities.craft) state.activities.craft.endsAt = Date.now();
      allFacilityActivities().forEach(function (entry) { entry.activity.endsAt = Date.now(); });
      completeActivities(); render();
    }
    if (action === 'apply-seed') { var input = document.getElementById('seed-input'); if (input && input.value.trim()) set({ seed: input.value.trim(), runNumber: 0, notice: 'World seed changed. Future expeditions will use the new sequence.' }); }
    if (action === 'random-seed') { var bytes = new Uint32Array(1); crypto.getRandomValues(bytes); set({ seed: String(bytes[0]), runNumber: 0, notice: 'A new world seed has been generated.' }); }
    if (action === 'copy-seed') { if (navigator.clipboard) navigator.clipboard.writeText(state.seed); set({ notice: 'Seed copied: ' + state.seed }); }
    if (action === 'replay' && state.lastResult) set({ currentResult: state.lastResult.result, resultContext: 'admin', view: 'expeditions', expeditionScreen: 'results' });
    if (action === 'export') exportSave();
    if (action === 'install' && installPrompt) installPrompt.prompt().then(function () { installPrompt = null; render(); });
    if (action === 'restart') { state = fresh(); save(); render(); }
  }

  function exportSave() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'adventure-company-save-v3.json'; link.click(); URL.revokeObjectURL(url); set({ notice: 'Save exported.' });
  }

  function importSave(event) {
    var file = event.target.files && event.target.files[0]; if (!file) return;
    file.text().then(function (text) {
      var incoming = JSON.parse(text);
      if (!incoming || !incoming.heroes || !incoming.activities) throw new Error('This is not a valid Adventure Company save.');
      state = incoming.saveVersion === 3 ? normalise(incoming) : normalise(migrate(incoming)); save(); render();
    }).catch(function (error) { set({ notice: 'Import failed: ' + error.message }); });
  }

  window.addEventListener('beforeinstallprompt', function (event) { event.preventDefault(); installPrompt = event; render(); });
  window.addEventListener('appinstalled', function () { installPrompt = null; set({ notice: 'Adventure Company has been installed.' }); });
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });

  var context = document.modelContext;
  if (context && context.registerTool) {
    var schema = { type: 'object', properties: {}, additionalProperties: false };
    Promise.resolve(context.registerTool({ name: 'get_company_state', title: 'Get company state', description: 'Read current Adventure Company progress, activities and resources.', inputSchema: schema, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: function () { return { view: state.view, seed: state.seed, runNumber: state.runNumber, resources: { gold: state.gold, scrap: state.scrap, herbs: state.herbs }, activities: state.activities }; } })).catch(function () {});
    Promise.resolve(context.registerTool({ name: 'finish_current_prototype_timers', title: 'Finish current timers', description: 'Finish all active prototype timers.', inputSchema: schema, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: function () { if (state.activities.expedition) state.activities.expedition.endsAt = Date.now(); if (state.activities.craft) state.activities.craft.endsAt = Date.now(); allFacilityActivities().forEach(function (entry) { entry.activity.endsAt = Date.now(); }); completeActivities(); render(); return { finished: true, view: state.view }; } })).catch(function () {});
  }

  setInterval(function () {
    var active = Boolean(state.activities.expedition || state.activities.craft || allFacilityActivities().length);
    if (!active) return;
    if (completeActivities()) render(); else updateLiveActivities();
  }, 1000);
  render();
})();
