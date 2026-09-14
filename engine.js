(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AdventureEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HEROES = {
    elara: { name: 'Elara Voss', role: 'Vanguard', maxHealth: 44, attack: 9, armour: 5, speed: 8, damageType: 'physical', trait: 'Protective' },
    fen: { name: 'Fen Alder', role: 'Ranger', maxHealth: 32, attack: 8, armour: 2, speed: 16, damageType: 'physical', trait: 'Eagle-eyed' },
    orin: { name: 'Orin Vale', role: 'Acolyte', maxHealth: 30, attack: 7, armour: 1, speed: 11, damageType: 'magical', trait: 'Studious' }
  };

  const ENEMIES = [
    { key: 'cutpurse', name: 'Road Cutpurse', maxHealth: 18, attack: 6, armour: 1, speed: 13 },
    { key: 'bruiser', name: 'Bandit Bruiser', maxHealth: 24, attack: 7, armour: 3, speed: 7 }
  ];

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

  function simulateBattle(options) {
    const party = (options.party || []).filter(key => HEROES[key]);
    if (!party.length) return { success: false, invalid: true, log: [], heroes: {}, rounds: 0, potionUsed: false };
    const rng = randomFrom(options.seed);
    const sword = Boolean(options.swordEquipped);
    const includeLog = options.includeLog !== false;
    const log = [];
    const heroUnits = party.map(key => ({
      key, side: 'hero', name: HEROES[key].name, hp: HEROES[key].maxHealth,
      maxHp: HEROES[key].maxHealth, attack: HEROES[key].attack + (key === 'elara' && sword ? 4 : 0),
      armour: HEROES[key].armour, speed: HEROES[key].speed,
      magical: HEROES[key].damageType === 'magical', potion: true
    }));
    const enemyUnits = ENEMIES.map(enemy => ({ ...enemy, side: 'enemy', hp: enemy.maxHealth }));
    const write = line => { if (includeLog) log.push(line); };

    write(pick([
      'Fen notices fresh boot prints circling the overturned cart.',
      'A snapped axle blocks the road. Two figures rise from the ditch.',
      'The company finds the merchants’ cart stripped and abandoned.',
      'A warning arrow strikes the earth at Elara’s feet.'
    ], rng));

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
          const hitChance = actor.key === 'fen' ? 0.91 : 0.84;
          if (rng() > hitChance) {
            write(actor.name + ' attacks ' + target.name + ' but misses.');
            continue;
          }
          const critical = rng() < (actor.key === 'fen' ? 0.18 : 0.11);
          const variance = Math.floor(rng() * 4) - 1;
          const base = actor.attack + variance + (critical ? Math.ceil(actor.attack * 0.7) : 0);
          const damage = Math.max(1, base - (actor.magical ? 0 : target.armour));
          target.hp = Math.max(0, target.hp - damage);
          const skill = actor.key === 'elara' ? pick(['Shield Bash', 'Measured Strike', 'Guarded Lunge'], rng)
            : actor.key === 'fen' ? pick(['Quick Shot', 'Barbed Arrow', 'Deadeye Shot'], rng)
            : pick(['Guiding Spark', 'Radiant Word', 'Searing Sign'], rng);
          write(actor.name + ' uses ' + skill + '. ' + target.name + ' takes ' + damage + (actor.magical ? ' magical' : '') + ' damage' + (critical ? ' — critical hit.' : '.'));
          if (target.hp === 0) write(target.name + ' falls.');
        } else {
          let targets = heroUnits.filter(unit => unit.hp > 0);
          if (!targets.length) break;
          let target = pick(targets, rng);
          const elara = heroUnits.find(unit => unit.key === 'elara' && unit.hp > 0);
          if (elara && target.key !== 'elara' && rng() < 0.38) {
            write('Elara intercepts a strike meant for ' + target.name + '.');
            target = elara;
          }
          if (rng() > 0.79) {
            write(actor.name + ' swings at ' + target.name + ' and misses.');
            continue;
          }
          const critical = rng() < 0.1;
          const base = actor.attack + Math.floor(rng() * 4) + (critical ? 4 : 0);
          const damage = Math.max(1, base - target.armour);
          target.hp = Math.max(0, target.hp - damage);
          write(actor.name + ' hits ' + target.name + ' for ' + damage + ' damage' + (critical ? ' — a vicious blow.' : '.'));
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
    write(success ? pick([
      'The surviving bandits flee. The company searches the wreckage.',
      'The road falls quiet. A careful search reveals usable supplies.',
      'The last threat is driven off and the merchants’ route is secure.'
    ], rng) : 'The company withdraws. Its fallen heroes return injured rather than dead.');

    const heroResults = {};
    heroUnits.forEach(unit => {
      heroResults[unit.key] = {
        remainingHealth: Math.max(1, unit.hp),
        healthPercent: Math.max(3, Math.round(unit.hp / unit.maxHp * 100)),
        injured: unit.hp <= 0,
        potionUsed: !unit.potion
      };
    });

    return {
      success, invalid: false, log, heroes: heroResults, rounds: round,
      potionUsed: heroUnits.some(unit => !unit.potion),
      rewards: success ? { gold: 14 + Math.floor(rng() * 8), scrap: 2 + Math.floor(rng() * 3), herbs: rng() < 0.55 ? 1 : 0, xp: 20 + round } : { gold: 0, scrap: 0, herbs: 0, xp: 8 }
    };
  }

  function forecast(options) {
    const party = (options.party || []).filter(key => HEROES[key]);
    if (!party.length) return null;
    let successes = 0;
    let injuries = 0;
    let healthLoss = 0;
    const samples = options.samples || 400;
    for (let i = 0; i < samples; i += 1) {
      const result = simulateBattle({
        party,
        swordEquipped: options.swordEquipped,
        seed: String(options.seed) + '|forecast|' + i,
        includeLog: false
      });
      if (result.success) successes += 1;
      const values = Object.values(result.heroes);
      if (values.some(hero => hero.injured)) injuries += 1;
      healthLoss += values.reduce((sum, hero) => sum + (100 - hero.healthPercent), 0) / values.length;
    }
    const successChance = Math.round(successes / samples * 100);
    const injuryChance = Math.round(injuries / samples * 100);
    return {
      successChance,
      injuryChance,
      expectedHealthLoss: Math.round(healthLoss / samples),
      danger: Math.min(99, Math.max(1, Math.round((100 - successChance) * 0.7 + injuryChance * 0.3)))
    };
  }

  function encounterSeed(saveSeed, runNumber, party, swordEquipped) {
    return [saveSeed, 'abandoned-road', runNumber, party.slice().sort().join(','), swordEquipped ? 'iron' : 'training'].join('|');
  }

  return { HEROES, ENEMIES, hashSeed, randomFrom, simulateBattle, forecast, encounterSeed };
});
