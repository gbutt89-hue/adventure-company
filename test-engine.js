'use strict';
const assert=require('node:assert/strict');
const E=require('./engine.js');

const options={party:['elara','fen','orin'],swordEquipped:false,seed:'test-seed',includeLog:true};
const first=E.simulateBattle(options);
const second=E.simulateBattle(options);
assert.deepEqual(first,second,'Identical inputs must reproduce the same encounter');
assert.ok(first.log.length>4,'Encounter should produce a descriptive log');
assert.equal(E.forecast({party:[],seed:'x'}),null,'An empty party must not receive a forecast');

const forecastA=E.forecast({party:['elara'],seed:'forecast',swordEquipped:true,samples:100});
const forecastB=E.forecast({party:['elara'],seed:'forecast',swordEquipped:true,samples:100});
assert.deepEqual(forecastA,forecastB,'Forecast must be deterministic');
assert.ok(forecastA.successChance>=0&&forecastA.successChance<=100);
assert.ok(forecastA.danger>=1&&forecastA.danger<=99);
assert.ok(forecastA.expectedHealthLoss>=0&&forecastA.expectedHealthLoss<=100,'Expected wear must measure loss during the expedition');

assert.equal(E.effectiveStats('elara',{readiness:100,swordEquipped:false}).armour,E.HEROES.elara.armour,'Displayed and simulated Armour must share one source');
assert.equal(E.effectiveStats('orin',{readiness:100}).ward,E.HEROES.orin.ward,'Displayed Ward must share the combat data source');
assert.equal(E.effectiveStats('sable',{readiness:100}).evasion,E.HEROES.sable.evasion,'Displayed Evasion must share the combat data source');
assert.equal(E.effectiveStats('fen',{readiness:100,weaponBonus:4}).attack,E.HEROES.fen.attack+4,'A compatible weapon bonus must apply to its actual wearer');
assert.equal(E.HEROES.orin.combatStyle,'Caster','The Acolyte must be identified as a caster');
assert.ok(E.effectiveStats('fen',{readiness:35}).speed<E.effectiveStats('fen',{readiness:100}).speed,'Low Readiness must reduce effective Speed');
assert.equal(E.experienceGain('orin',20),25,'Studious must grant 25% additional expedition XP');
assert.match(E.TRAITS.Protective,/38%/,'Protective must expose its exact effect');
assert.ok(Array.isArray(E.HEROES.sable.traits)&&E.HEROES.sable.traits.length===2,'Heroes must support multiple traits');
assert.equal(E.HEROES.orin.maxMana,45,'Caster Mana must have an explicit maximum');
assert.equal(E.HEROES.elara.maxMana,0,'Non-casters must not carry a redundant Mana pool');
assert.deepEqual(Object.keys(E.MOVES),['Vanguard','Ranger','Acolyte','Skirmisher'],'Every current class must own an explicit move progression');
Object.keys(E.MOVES).forEach(role=>{
  for(let level=1;level<=5;level+=1) assert.ok(E.MOVES[role].some(move=>move.level===level),role+' must gain at least one defined move at level '+level);
  E.MOVES[role].forEach(move=>{
    assert.equal(typeof move.power,'number',move.name+' must define a damage multiplier');
    assert.ok(move.description,move.name+' must explain its mechanical effect');
  });
});
assert.ok(!E.movesForRole('Skirmisher',1).some(move=>move.name==='Passing Cut'),'Level-two moves must remain locked at level one');
assert.ok(E.movesForRole('Skirmisher',2).some(move=>move.name==='Passing Cut'),'A move must enter the combat pool at its stated level');

const fullCondition={
  elara:{health:100,mana:30,readiness:100},
  fen:{health:100,mana:20,readiness:100},
  orin:{health:100,mana:45,readiness:100}
};
const wornCondition={
  elara:{health:20,mana:30,readiness:30},
  fen:{health:20,mana:20,readiness:30},
  orin:{health:20,mana:0,readiness:30}
};
const healthyForecast=E.forecast({party:['elara','fen','orin'],heroStates:fullCondition,seed:'condition-test',samples:400});
const wornForecast=E.forecast({party:['elara','fen','orin'],heroStates:wornCondition,seed:'condition-test',samples:400});
assert.ok(wornForecast.danger>healthyForecast.danger,'Poor company condition must increase predicted danger');

const emptyMana=E.simulateBattle({party:['orin'],heroStates:{orin:{health:100,mana:0,readiness:100}},seed:'empty-mana',includeLog:true});
assert.ok(emptyMana.log.some(line=>line.includes('Staff Strike')),'An Acolyte without Mana must use a basic attack');
assert.equal(emptyMana.heroes.orin.manaSpent,0,'An Acolyte cannot spend Mana they do not have');

const definedMoveNames=new Set(Object.values(E.MOVES).flat().map(move=>move.name));
for(const key of Object.keys(E.HEROES)){
  const result=E.simulateBattle({party:[key],heroStates:{[key]:{health:100,mana:E.HEROES[key].maxMana,readiness:100,xp:500}},seed:'defined-moves-'+key,includeLog:true});
  result.log.filter(line=>line.startsWith(E.HEROES[key].name+' uses ')).forEach(line=>{
    const moveName=line.slice((E.HEROES[key].name+' uses ').length).split(/[.,]/)[0];
    assert.ok(definedMoveNames.has(moveName),'Every move named in the log must exist in class data: '+moveName);
  });
}

const logs=new Set();
for(let i=0;i<12;i+=1){
  const result=E.simulateBattle({party:['elara','fen','orin'],seed:'variation-'+i,includeLog:true});
  assert.equal(result.invalid,false);
  logs.add(result.log.join('\n'));
}
assert.ok(logs.size>1,'Different seeds should produce variable encounter logs');

assert.deepEqual(Object.keys(E.APPROACHES),['careful','standard','aggressive','scavenge'],'The four agreed expedition approaches must remain available');
assert.deepEqual(Object.keys(E.ENCOUNTERS),['abandoned-road','briar-den','cinder-watch'],'The expedition foundation should expose three distinct locations');
assert.ok(E.heroAdvantages('elara','abandoned-road').length>0,'Elara’s Armour should favour her on the physical road');
assert.ok(E.heroAdvantages('fen','briar-den').length>0,'Fen’s Accuracy should favour him against evasive beasts');
assert.ok(E.heroAdvantages('orin','cinder-watch').length>0,'Orin’s Ward and Fire Resistance should favour him at Cinder Watch');
const carefulForecast=E.forecast({party:['elara'],encounterKey:'abandoned-road',approach:'careful',seed:'approach-test',samples:400});
const aggressiveForecast=E.forecast({party:['elara'],encounterKey:'abandoned-road',approach:'aggressive',seed:'approach-test',samples:400});
assert.ok(carefulForecast.danger<=aggressiveForecast.danger,'Careful must not be more dangerous than Aggressive for identical inputs');

const tutorialSeed=E.encounterSeed('731942',1,['elara','fen','orin'],false);
const tutorial=E.simulateBattle({party:['elara','fen','orin'],heroStates:fullCondition,swordEquipped:false,seed:tutorialSeed,includeLog:true});
assert.equal(tutorial.success,true,'The default opening party should complete the tutorial expedition');
assert.ok(tutorial.rewards.scrap>=3,'A successful opening expedition must fund the first Iron Sword');
console.log('Adventure Company engine checks passed.');
