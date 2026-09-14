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

const logs=new Set();
for(let i=0;i<12;i+=1){
  const result=E.simulateBattle({party:['elara','fen','orin'],seed:'variation-'+i,includeLog:true});
  assert.equal(result.invalid,false);
  logs.add(result.log.join('\n'));
}
assert.ok(logs.size>1,'Different seeds should produce variable encounter logs');

const tutorialSeed=E.encounterSeed('731942',1,['elara','fen','orin'],false);
const tutorial=E.simulateBattle({party:['elara','fen','orin'],swordEquipped:false,seed:tutorialSeed,includeLog:true});
assert.equal(tutorial.success,true,'The default opening party should complete the tutorial expedition');
\nconsole.log('Adventure Company engine checks passed.');
