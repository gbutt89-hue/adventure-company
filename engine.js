(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AdventureEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HEROES = {
    elara: { name: 'Elara Voss', role: 'Vanguard', combatStyle: 'Melee', maxHealth: 44, maxMana: 0, attack: 9, armour: 5, ward: 3, speed: 8, accuracy: 84, evasion: 8, critical: 11, resistances: { fire: 20 }, damageType: 'physical', traits: ['Protective'] },
    fen: { name: 'Fen Alder', role: 'Ranger', combatStyle: 'Ranged', maxHealth: 32, maxMana: 0, attack: 8, armour: 2, ward: 2, speed: 16, accuracy: 91, evasion: 18, critical: 18, resistances: { fire: 10 }, damageType: 'physical', traits: ['Eagle-eyed'] },
    orin: { name: 'Orin Vale', role: 'Acolyte', combatStyle: 'Caster', maxHealth: 30, maxMana: 45, attack: 7, armour: 1, ward: 6, speed: 11, accuracy: 84, evasion: 10, critical: 11, resistances: { fire: 25 }, damageType: 'magical', traits: ['Studious'] },
    sable: { name: 'Sable Reed', role: 'Skirmisher', combatStyle: 'Melee', maxHealth: 31, maxMana: 0, attack: 8, armour: 2, ward: 3, speed: 17, accuracy: 89, evasion: 22, critical: 17, resistances: { fire: 10 }, damageType: 'physical', traits: ['Elusive', 'Cinder-born'] }
  };

  const TRAITS = {
    Protective: '38% chance to intercept an attack aimed at an ally.',
    'Eagle-eyed': '+7 percentage points to hit chance and critical-hit chance.',
    Studious: 'Gains 25% more experience from expeditions.',
    Elusive: '+8 Evasion is included in this hero’s combat statistics.',
    'Cinder-born': '+10 percentage points to Fire Resistance, included in this hero’s resistances.'
  };

  const ROLES = {
    Vanguard: 'Melee · Physical. A durable fighter suited to armour, shields and protecting allies.',
    Ranger: 'Ranged · Physical. A fast attacker with greater accuracy and critical-hit chance.',
    Acolyte: 'Caster · Magical. A spellcaster whose attacks test Ward and consume Mana.',
    Skirmisher: 'Melee · Physical. A light-armoured attacker who relies on Speed and Evasion rather than Armour.'
  };

  // Class moves are data rather than combat-log flavour. Every move below has
  // an unlock level and modifiers that are read directly by the simulator.
  const MOVES = {
    Vanguard: [
      { key: 'measured-strike', name: 'Measured Strike', level: 1, power: 1, accuracy: 6, critical: 0, damageType: 'physical', description: 'A dependable attack with +6 hit chance.' },
      { key: 'shield-bash', name: 'Shield Bash', level: 1, power: 0.85, accuracy: 11, critical: -2, damageType: 'physical', description: 'A lighter blow with +11 hit chance.' },
      { key: 'guarded-lunge', name: 'Guarded Lunge', level: 2, power: 1.1, accuracy: 0, critical: 2, damageType: 'physical', description: 'A stronger thrust with +2 critical chance.' },
      { key: 'sundering-blow', name: 'Sundering Blow', level: 3, power: 1.15, accuracy: -5, critical: 3, armourPiercing: 2, damageType: 'physical', description: 'A heavy attack that ignores 2 Armour, but has −5 hit chance.' },
      { key: 'pommel-break', name: 'Pommel Break', level: 4, power: 1.05, accuracy: 8, critical: 0, damageType: 'physical', description: 'A controlled close-range blow with +8 hit chance.' },
      { key: 'company-edge', name: 'Company’s Edge', level: 5, power: 1.3, accuracy: -8, critical: 6, damageType: 'physical', description: 'A punishing veteran strike with −8 hit chance and +6 critical chance.' }
    ],
    Ranger: [
      { key: 'quick-shot', name: 'Quick Shot', level: 1, power: 0.9, accuracy: 9, critical: 0, damageType: 'physical', description: 'A swift arrow with +9 hit chance.' },
      { key: 'barbed-arrow', name: 'Barbed Arrow', level: 1, power: 1, accuracy: 3, critical: 3, damageType: 'physical', description: 'A barbed shot with +3 hit and critical chance.' },
      { key: 'deadeye-shot', name: 'Deadeye Shot', level: 2, power: 1.15, accuracy: -4, critical: 9, damageType: 'physical', description: 'A patient shot with −4 hit chance and +9 critical chance.' },
      { key: 'bodkin-arrow', name: 'Bodkin Arrow', level: 3, power: 1.05, accuracy: 1, critical: 2, armourPiercing: 3, damageType: 'physical', description: 'A narrow arrowhead that ignores 3 Armour.' },
      { key: 'hunters-aim', name: 'Hunter’s Aim', level: 4, power: 1.2, accuracy: 6, critical: 4, damageType: 'physical', description: 'A practised shot with +6 hit and +4 critical chance.' },
      { key: 'heartseeker', name: 'Heartseeker', level: 5, power: 1.4, accuracy: -8, critical: 12, damageType: 'physical', description: 'A high-risk shot with −8 hit and +12 critical chance.' }
    ],
    Acolyte: [
      { key: 'staff-strike', name: 'Staff Strike', level: 1, power: 0.65, accuracy: 4, critical: 0, manaCost: 0, damageType: 'physical', fallback: true, description: 'A modest physical attack used when conserving Mana or unable to cast.' },
      { key: 'guiding-spark', name: 'Guiding Spark', level: 1, power: 0.95, accuracy: 9, critical: 0, manaCost: 7, damageType: 'magical', description: 'A reliable spell costing 7 Mana, with +9 hit chance.' },
      { key: 'radiant-word', name: 'Radiant Word', level: 1, power: 1.05, accuracy: 1, critical: 2, manaCost: 8, damageType: 'magical', description: 'A balanced spell costing 8 Mana.' },
      { key: 'searing-sign', name: 'Searing Sign', level: 2, power: 1.15, accuracy: -2, critical: 6, manaCost: 10, damageType: 'magical', description: 'A forceful sign costing 10 Mana, with +6 critical chance.' },
      { key: 'warding-ray', name: 'Warding Ray', level: 3, power: 1.05, accuracy: 10, critical: 0, wardPiercing: 2, manaCost: 9, damageType: 'magical', description: 'A precise ray costing 9 Mana that ignores 2 Ward.' },
      { key: 'sun-lance', name: 'Sun Lance', level: 4, power: 1.3, accuracy: -5, critical: 5, manaCost: 12, damageType: 'magical', description: 'A powerful spell costing 12 Mana, with −5 hit chance.' },
      { key: 'judgement', name: 'Judgement', level: 5, power: 1.45, accuracy: -8, critical: 10, manaCost: 14, damageType: 'magical', description: 'A costly finishing spell with +10 critical chance.' }
    ],
    Skirmisher: [
      { key: 'feinting-slash', name: 'Feinting Slash', level: 1, power: 0.9, accuracy: 10, critical: 2, damageType: 'physical', description: 'A deceptive cut with +10 hit and +2 critical chance.' },
      { key: 'low-sweep', name: 'Low Sweep', level: 1, power: 1, accuracy: 5, critical: 0, damageType: 'physical', description: 'A low, controlled attack with +5 hit chance.' },
      { key: 'passing-cut', name: 'Passing Cut', level: 2, power: 1.1, accuracy: 0, critical: 5, damageType: 'physical', description: 'A mobile attack with +5 critical chance.' },
      { key: 'gapfinder', name: 'Gapfinder', level: 3, power: 1.05, accuracy: 4, critical: 3, armourPiercing: 3, damageType: 'physical', description: 'A precise cut that ignores 3 Armour.' },
      { key: 'reversal', name: 'Reversal', level: 4, power: 1.2, accuracy: -3, critical: 8, damageType: 'physical', description: 'A risky counterattack with +8 critical chance.' },
      { key: 'vanishing-point', name: 'Vanishing Point', level: 5, power: 1.35, accuracy: -5, critical: 12, damageType: 'physical', description: 'A veteran finishing move with +12 critical chance.' }
    ]
  };

  const APPROACHES = {
    careful: { name: 'Careful', duration: 1.35, enemyAttack: 0.9, reward: 0.9, materials: 1, readiness: 0.75, description: 'Longer, with lower Readiness use and less avoidable danger.' },
    standard: { name: 'Standard', duration: 1, enemyAttack: 1, reward: 1, materials: 1, readiness: 1, description: 'Baseline duration, rewards and risk.' },
    aggressive: { name: 'Aggressive', duration: 0.75, enemyAttack: 1.1, reward: 1.2, materials: 1.15, readiness: 1.25, description: 'Faster and more rewarding, with greater injury and Readiness risk.' },
    scavenge: { name: 'Scavenge', duration: 1.4, enemyAttack: 1.05, reward: 1, materials: 1.55, readiness: 1.15, description: 'Longer and more exposed, with better material opportunities.' }
  };

  const ENCOUNTERS = {
    'abandoned-road': {
      key: 'abandoned-road', name: 'Abandoned Road', region: 'North Road', level: 1, duration: 25,
      description: 'Merchants report bandits and strange lights along the old north road. Clear the obstruction and recover anything useful.',
      tags: ['Physical threats', 'Bandits'], rewardLabel: ['14–21 gold', '3–4 scrap', 'Possible herb', 'Combat XP'],
      rewards: { gold: [14, 21], scrap: [3, 4], herbs: [0, 1], herbChance: 0.55, xp: 20 },
      opening: ['Fen notices fresh boot prints circling the overturned cart.', 'A snapped axle blocks the road. Two figures rise from the ditch.', 'The company finds the merchants’ cart stripped and abandoned.', 'A warning arrow strikes the earth at Elara’s feet.'],
      victory: ['The surviving bandits flee. The company searches the wreckage.', 'The road falls quiet. A careful search reveals usable supplies.', 'The last threat is driven off and the merchants’ route is secure.'],
      enemies: [
        { key: 'cutpurse', name: 'Road Cutpurse', maxHealth: 18, attack: 6, armour: 1, ward: 0, speed: 13, accuracy: 88, evasion: 8, damageType: 'physical' },
        { key: 'bruiser', name: 'Bandit Bruiser', maxHealth: 24, attack: 7, armour: 3, ward: 0, speed: 7, accuracy: 88, evasion: 3, damageType: 'physical' }
      ],
      favoured: [{ stat: 'armour', minimum: 5, reason: 'High Armour reduces the road bandits’ physical damage.' }]
    },
    'briar-den': {
      key: 'briar-den', name: 'Briar Den', region: 'Greenward', level: 2, duration: 32,
      description: 'Something has driven the briar wolves onto the herb-gatherers’ paths. Thin the pack and search the den.',
      tags: ['Evasive beasts', 'Herb source'], rewardLabel: ['12–18 gold', '1–2 scrap', '1–3 herbs', 'Combat XP'],
      rewards: { gold: [12, 18], scrap: [1, 2], herbs: [1, 3], xp: 24 },
      opening: ['Yellow eyes track the company through the briars.', 'A low growl passes between the thorn-choked trees.', 'The herbalists’ baskets lie scattered beside fresh paw prints.'],
      victory: ['The pack scatters, leaving the herb beds accessible once more.', 'The den falls quiet. Useful herbs grow thick beneath the thorns.'],
      enemies: [
        { key: 'briar-wolf', name: 'Briar Wolf', maxHealth: 17, attack: 7, armour: 1, ward: 1, speed: 16, accuracy: 69, evasion: 22, damageType: 'physical', armourPiercing: 5 },
        { key: 'thorn-alpha', name: 'Thorn Alpha', maxHealth: 21, attack: 8, armour: 2, ward: 1, speed: 12, accuracy: 71, evasion: 17, damageType: 'physical', armourPiercing: 5 }
      ],
      favoured: [{ stat: 'accuracy', minimum: 89, reason: 'High Accuracy helps connect against the den’s evasive beasts.' }]
    },
    'cinder-watch': {
      key: 'cinder-watch', name: 'Cinder Watch', region: 'Old March', level: 3, duration: 40,
      description: 'Embers move inside a ruined watchtower where no fire has burned for years. Investigate the disturbance.',
      tags: ['Magical threats', 'Fire damage'], rewardLabel: ['18–26 gold', '2–4 scrap', 'Possible herb', 'Combat XP'],
      rewards: { gold: [18, 26], scrap: [2, 4], herbs: [0, 1], herbChance: 0.35, xp: 30 },
      opening: ['Ash lifts from the floor and gathers into hostile shapes.', 'The old brazier flares as the company enters the watchtower.', 'Heat shimmers around figures formed from soot and ember.'],
      victory: ['The last ember gutters out, leaving strange metal among the ashes.', 'Cool air returns to the tower. The company searches the scorched chamber.'],
      enemies: [
        { key: 'ash-wisp', name: 'Ash Wisp', maxHealth: 19, attack: 7, armour: 0, ward: 0, speed: 15, accuracy: 90, evasion: 12, damageType: 'magical', fire: true },
        { key: 'cinder-guard', name: 'Cinder Guard', maxHealth: 27, attack: 8, armour: 3, ward: 1, speed: 8, accuracy: 88, evasion: 5, damageType: 'magical', fire: true }
      ],
      favoured: [{ stat: 'fire', minimum: 20, reason: 'Fire Resistance reduces the watch’s fire-tagged magical damage.' }, { stat: 'ward', minimum: 6, reason: 'High Ward reduces the watch’s magical attacks.' }]
    }
  };
  const ENEMIES = ENCOUNTERS['abandoned-road'].enemies;

  function hashSeed(text) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < String(text).length; i += 1) {
      h ^= String(text).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function randomFrom(seedText) {
    let a = hashSeed(seedText);
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, Number(value)));
  }

  function readinessModifier(readiness) {
    const value = clamp(readiness === undefined ? 100 : readiness, 0, 100);
    if (value >= 70) return 1;
    if (value >= 40) return 0.9;
    return 0.8;
  }

  function hasTrait(key, trait) {
    return Boolean(HEROES[key] && HEROES[key].traits.indexOf(trait) >= 0);
  }

  function effectiveStats(key, options) {
    const hero = HEROES[key];
    if (!hero) return null;
    const settings = options || {};
    const modifier = readinessModifier(settings.readiness);
    const weaponBonus = settings.weaponBonus === undefined ? (key === 'elara' && settings.swordEquipped ? 4 : 0) : Number(settings.weaponBonus) || 0;
    return {
      attack: Math.max(1, Math.round((hero.attack + weaponBonus) * modifier)),
      armour: hero.armour,
      ward: hero.ward,
      speed: Math.max(1, Math.round(hero.speed * modifier)),
      accuracy: hero.accuracy,
      evasion: hero.evasion,
      critical: hero.critical,
      readinessModifier: modifier
    };
  }

  function experienceGain(key, baseExperience) {
    return hasTrait(key, 'Studious') ? Math.ceil(baseExperience * 1.25) : baseExperience;
  }

  function levelFromExperience(experience) {
    return Math.floor(Math.max(0, Number(experience) || 0) / 100) + 1;
  }

  function movesForRole(role, level, includeLocked) {
    const currentLevel = Math.max(1, Number(level) || 1);
    const moves = MOVES[role] || [];
    return includeLocked ? moves.slice() : moves.filter(move => move.level <= currentLevel);
  }

  function chooseMove(actor, rng) {
    const unlocked = movesForRole(actor.role, actor.level).filter(move => !move.fallback && (move.manaCost || 0) <= actor.mana);
    if (unlocked.length) return pick(unlocked, rng);
    const fallback = movesForRole(actor.role, actor.level).find(move => move.fallback);
    return fallback || { name: 'Basic Attack', power: 1, accuracy: 0, critical: 0, manaCost: 0, damageType: actor.magical ? 'magical' : 'physical' };
  }

  function simulateBattle(options) {
    const party = (options.party || []).filter(key => HEROES[key]);
    if (!party.length) return { success: false, invalid: true, log: [], heroes: {}, rounds: 0, potionUsed: false };
    const encounter = ENCOUNTERS[options.encounterKey] || ENCOUNTERS['abandoned-road'];
    const approach = APPROACHES[options.approach] || APPROACHES.standard;
    const rng = randomFrom(options.seed);
    const sword = Boolean(options.swordEquipped);
    const equipmentAttack = options.equipmentAttack || {};
    const heroStates = options.heroStates || {};
    const includeLog = options.includeLog !== false;
    const log = [];
    const heroUnits = party.map(key => {
      const condition = heroStates[key] || {};
      const healthPercent = clamp(condition.health === undefined ? 100 : condition.health, 1, 100);
      const mana = clamp(condition.mana === undefined ? HEROES[key].maxMana : condition.mana, 0, HEROES[key].maxMana);
      const readiness = clamp(condition.readiness === undefined ? 100 : condition.readiness, 0, 100);
      const level = levelFromExperience(condition.xp);
      const stats = effectiveStats(key, { readiness, swordEquipped: sword, weaponBonus: equipmentAttack[key] });
      const hp = Math.max(1, Math.round(HEROES[key].maxHealth * healthPercent / 100));
      return {
        key, side: 'hero', name: HEROES[key].name, role: HEROES[key].role, level, hp, startingHp: hp,
        startingHealthPercent: Math.round(healthPercent), maxHp: HEROES[key].maxHealth,
        attack: stats.attack, armour: stats.armour, ward: stats.ward, speed: stats.speed,
        accuracy: stats.accuracy, evasion: stats.evasion, critical: stats.critical,
        readinessModifier: stats.readinessModifier, mana, startingMana: mana,
        magical: HEROES[key].damageType === 'magical', potion: true
      };
    });
    const enemyUnits = encounter.enemies.map(enemy => ({ ...enemy, attack: Math.max(1, Math.round(enemy.attack * approach.enemyAttack)), side: 'enemy', hp: enemy.maxHealth }));
    const write = line => { if (includeLog) log.push(line); };

    write(pick(encounter.opening, rng));

    let round = 0;
    while (round < 10 && heroUnits.some(unit => unit.hp > 0) && enemyUnits.some(unit => unit.hp > 0)) {
      round += 1;
      write('Round ' + round + '.');
      const actors = heroUnits.concat(enemyUnits)
        .filter(unit => unit.hp > 0)
        .map(unit => ({ unit, order: unit.speed + rng() * 4 }))
        .sort((a, b) => b.order - a.order);

      for (const entry of actors) {
        const actor = entry.unit;
        if (actor.hp <= 0) continue;
        if (actor.side === 'hero') {
          const targets = enemyUnits.filter(unit => unit.hp > 0);
          if (!targets.length) break;
          const target = pick(targets, rng);
          const move = chooseMove(actor, rng);
          actor.mana -= move.manaCost || 0;
          const hitChance = clamp((actor.accuracy + (move.accuracy || 0) - (target.evasion || 0)) / 100, 0.35, 0.97);
          if (rng() > hitChance) {
            write(actor.name + ' uses ' + move.name + ', but misses ' + target.name + '.');
            continue;
          }
          const critical = rng() < clamp((actor.critical + (move.critical || 0)) / 100, 0, 0.75);
          const variance = Math.floor(rng() * 4) - 1;
          const magical = move.damageType === 'magical';
          const attack = move.fallback ? Math.max(1, Math.round(4 * actor.readinessModifier)) : actor.attack;
          const poweredAttack = Math.max(1, Math.round(attack * (move.power || 1)));
          const base = poweredAttack + variance + (critical ? Math.ceil(poweredAttack * 0.7) : 0);
          const defence = magical ? Math.max(0, (target.ward || 0) - (move.wardPiercing || 0)) : Math.max(0, (target.armour || 0) - (move.armourPiercing || 0));
          const damage = Math.max(1, base - defence);
          target.hp = Math.max(0, target.hp - damage);
          write(actor.name + ' uses ' + move.name + '. ' + target.name + ' takes ' + damage + (magical ? ' magical' : '') + ' damage' + (critical ? ' — critical hit.' : '.'));
          if (target.hp === 0) write(target.name + ' falls.');
        } else {
          let targets = heroUnits.filter(unit => unit.hp > 0);
          if (!targets.length) break;
          let target = pick(targets, rng);
          const elara = heroUnits.find(unit => unit.key === 'elara' && unit.hp > 0);
          if (elara && hasTrait('elara', 'Protective') && target.key !== 'elara' && rng() < 0.38) {
            write('Elara intercepts a strike meant for ' + target.name + '.');
            target = elara;
          }
          const hitChance = clamp(((actor.accuracy || 88) - (target.evasion || 0)) / 100, 0.35, 0.97);
          if (rng() > hitChance) {
            write(actor.name + ' swings at ' + target.name + ' and misses.');
            continue;
          }
          const critical = rng() < 0.1;
          const base = actor.attack + Math.floor(rng() * 4) + (critical ? 4 : 0);
          const mitigation = actor.damageType === 'magical' ? target.ward : Math.max(0, target.armour - (actor.armourPiercing || 0));
          let damage = Math.max(1, base - mitigation);
          if (actor.fire) damage = Math.max(1, Math.round(damage * (1 - (HEROES[target.key].resistances.fire || 0) / 100)));
          target.hp = Math.max(0, target.hp - damage);
          const damageLabel = actor.fire ? ' fire damage' : actor.damageType === 'magical' ? ' magical damage' : ' damage';
          write(actor.name + ' hits ' + target.name + ' for ' + damage + damageLabel + (critical ? ' — a vicious blow.' : '.'));
          if (target.hp === 0) write(target.name + ' is overwhelmed and will return injured.');
          if (target.hp > 0 && target.hp / target.maxHp <= 0.34 && target.potion) {
            const restored = Math.min(12, target.maxHp - target.hp);
            target.hp += restored;
            target.potion = false;
            write(target.name + ' drinks a Field Tonic and recovers ' + restored + ' health.');
          }
        }
      }
    }

    const success = !enemyUnits.some(unit => unit.hp > 0);
    write(success ? pick(encounter.victory, rng) : 'The company withdraws. Its fallen heroes return injured rather than dead.');

    const heroResults = {};
    heroUnits.forEach(unit => {
      heroResults[unit.key] = {
        remainingHealth: Math.max(1, unit.hp),
        healthPercent: Math.max(3, Math.round(unit.hp / unit.maxHp * 100)),
        startingHealthPercent: unit.startingHealthPercent,
        startingMana: unit.startingMana,
        remainingMana: unit.mana,
        manaSpent: unit.startingMana - unit.mana,
        injured: unit.hp <= 0,
        potionUsed: !unit.potion
      };
    });

    const rewards = encounter.rewards;
    const rollRange = range => range[0] + Math.floor(rng() * (range[1] - range[0] + 1));
    const baseHerbs = rewards.herbChance !== undefined ? (rng() < rewards.herbChance ? rewards.herbs[1] : rewards.herbs[0]) : rollRange(rewards.herbs);
    return {
      success, invalid: false, log, heroes: heroResults, rounds: round,
      potionUsed: heroUnits.some(unit => !unit.potion),
      encounterKey: encounter.key, approach: options.approach || 'standard',
      rewards: success ? {
        gold: Math.max(1, Math.round(rollRange(rewards.gold) * approach.reward)),
        scrap: Math.max(0, Math.round(rollRange(rewards.scrap) * approach.materials)),
        herbs: Math.max(0, Math.round(baseHerbs * approach.materials)),
        xp: Math.max(1, Math.round((rewards.xp + round) * approach.reward))
      } : { gold: 0, scrap: 0, herbs: 0, xp: Math.max(8, Math.round(rewards.xp * 0.35)) }
    };
  }

  function forecast(options) {
    const party = (options.party || []).filter(key => HEROES[key]);
    if (!party.length) return null;
    let successes = 0;
    let injuries = 0;
    let seriousOutcomes = 0;
    let healthLoss = 0;
    const samples = options.samples || 400;
    for (let i = 0; i < samples; i += 1) {
      const result = simulateBattle({
        party,
        swordEquipped: options.swordEquipped,
        equipmentAttack: options.equipmentAttack,
        heroStates: options.heroStates,
        encounterKey: options.encounterKey,
        approach: options.approach,
        seed: String(options.seed) + '|forecast|' + i,
        includeLog: false
      });
      if (result.success) successes += 1;
      const values = Object.values(result.heroes);
      const injury = values.some(hero => hero.injured);
      if (injury) injuries += 1;
      if (!result.success || injury) seriousOutcomes += 1;
      healthLoss += values.reduce((sum, hero) => sum + Math.max(0, hero.startingHealthPercent - hero.healthPercent), 0) / values.length;
    }
    const successChance = Math.round(successes / samples * 100);
    const injuryChance = Math.round(injuries / samples * 100);
    return {
      successChance,
      injuryChance,
      expectedHealthLoss: Math.round(healthLoss / samples),
      danger: Math.min(99, Math.max(1, Math.round(seriousOutcomes / samples * 100)))
    };
  }

  function encounterSeed(saveSeed, runNumber, party, swordEquipped, encounterKey, approach) {
    const equipment = typeof swordEquipped === 'string' ? swordEquipped : swordEquipped ? 'iron' : 'training';
    return [saveSeed, encounterKey || 'abandoned-road', runNumber, party.slice().sort().join(','), equipment, approach || 'standard'].join('|');
  }

  function heroAdvantages(key, encounterKey) {
    const hero = HEROES[key];
    const encounter = ENCOUNTERS[encounterKey];
    if (!hero || !encounter) return [];
    const stats = Object.assign({}, hero, { fire: hero.resistances.fire || 0 });
    return encounter.favoured.filter(rule => Number(stats[rule.stat]) >= rule.minimum).map(rule => rule.reason);
  }

  return {
    HEROES, TRAITS, ROLES, MOVES, ENEMIES, ENCOUNTERS, APPROACHES, hashSeed, randomFrom, readinessModifier,
    effectiveStats, experienceGain, levelFromExperience, movesForRole, simulateBattle, forecast, encounterSeed, heroAdvantages, hasTrait
  };
});
