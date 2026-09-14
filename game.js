(function () {
  'use strict';

  var E = window.AdventureEngine;
  var SAVE_KEY = 'adventure-company-prototype-v2';
  var OLD_SAVE_KEY = 'adventure-company-prototype-v1';
  var installPrompt = null;

  var heroUi = {
    elara:{initials:'EV',colour:'rust',trait:'Protective',armour:16,speed:8},
    fen:{initials:'FA',colour:'green',trait:'Eagle-eyed',armour:9,speed:16},
    orin:{initials:'OV',colour:'violet',trait:'Studious',armour:8,speed:11}
  };

  function fresh() {
    return {
      saveVersion:2,stage:'intro',view:'company',companyName:'',gold:20,scrap:0,herbs:0,
      seed:'731942',runNumber:0,selected:['elara','fen','orin'],swordCrafted:false,swordEquipped:false,
      tutorialFocus:null,tutorialSkipped:false,devOpen:false,notice:null,currentResult:null,lastResult:null,
      resultContext:null,resultClaimed:false,activities:{expedition:null,craft:null,recovery:null},
      heroes:{
        elara:{health:100,mana:30,readiness:100,xp:0},
        fen:{health:100,mana:20,readiness:100,xp:0},
        orin:{health:100,mana:45,readiness:100,xp:0}
      }
    };
  }

  function migrate(old) {
    var next=fresh();
    if(!old||typeof old!=='object') return next;
    ['companyName','gold','scrap','herbs','swordCrafted','swordEquipped'].forEach(function(key){
      if(old[key]!==undefined) next[key]=old[key];
    });
    if(old.heroes) next.heroes=Object.assign(next.heroes,old.heroes);
    if(old.companyName) next.stage=old.stage==='intro'?'intro':'headquarters';
    return next;
  }

  function load() {
    try {
      var current=localStorage.getItem(SAVE_KEY);
      if(current) return Object.assign(fresh(),JSON.parse(current));
      var old=localStorage.getItem(OLD_SAVE_KEY);
      return old?migrate(JSON.parse(old)):fresh();
    } catch (_) { return fresh(); }
  }

  var state=load();
  state.activities=Object.assign({expedition:null,craft:null,recovery:null},state.activities||{});
  state.heroes=Object.assign(fresh().heroes,state.heroes||{});

  function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(state));}
  function esc(value){return String(value).replace(/[&<>'"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function set(patch){state=Object.assign({},state,patch);save();render();}
  function remaining(activity){return activity?Math.max(0,Math.ceil((activity.endsAt-Date.now())/1000)):0;}
  function timeText(total){return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');}
  function heroAttack(key){return E.HEROES[key].attack+(key==='elara'&&state.swordEquipped?4:0);}
  function heroBusy(key){
    var expedition=state.activities.expedition;
    return Boolean((expedition&&expedition.party.indexOf(key)>=0)||(state.activities.recovery&&state.activities.recovery.hero===key));
  }
  function forecast(){return E.forecast({party:state.selected,seed:state.seed,swordEquipped:state.swordEquipped,samples:400});}
  function activityProgress(activity){return activity?Math.max(0,Math.min(100,(1-remaining(activity)/activity.duration)*100)):0;}

  function completeActivities() {
    var changed=false;
    var now=Date.now();
    var expedition=state.activities.expedition;
    if(expedition&&expedition.endsAt<=now){
      var result=E.simulateBattle({party:expedition.party,swordEquipped:expedition.swordEquipped,seed:expedition.seed,includeLog:true});
      expedition.party.forEach(function(key){
        var outcome=result.heroes[key];
        var hero=Object.assign({},state.heroes[key]);
        hero.health=outcome.healthPercent;
        hero.readiness=Math.max(0,hero.readiness-(18+result.rounds*2));
        if(key==='orin') hero.mana=Math.max(0,hero.mana-28);
        hero.xp+=result.rewards.xp;
        state.heroes[key]=hero;
      });
      state.currentResult=result;
      state.lastResult={inputs:{party:expedition.party,swordEquipped:expedition.swordEquipped,seed:expedition.seed},result:result};
      state.resultContext=expedition.context;
      state.resultClaimed=false;
      state.activities.expedition=null;
      state.stage='results';
      state.view='company';
      changed=true;
    }
    var craft=state.activities.craft;
    if(craft&&craft.endsAt<=now){
      state.activities.craft=null;
      state.swordCrafted=true;
      state.notice='The Iron Sword is ready to equip.';
      changed=true;
    }
    var recovery=state.activities.recovery;
    if(recovery&&recovery.endsAt<=now){
      var recovered=Object.assign({},state.heroes[recovery.hero]);
      recovered.mana=Math.min(100,recovered.mana+40);
      recovered.readiness=Math.min(100,recovered.readiness+15);
      state.heroes[recovery.hero]=recovered;
      state.activities.recovery=null;
      state.notice=E.HEROES[recovery.hero].name+' has returned from '+recovery.title+'.';
      changed=true;
    }
    if(changed) save();
    return changed;
  }

  function meter(name,value,kind){
    return '<div class="meter-row"><span>'+name+'</span><span class="meter '+(kind||'')+'"><i style="width:'+Math.max(0,Math.min(100,value))+'%"></i></span><b>'+value+'</b></div>';
  }

  function heroCard(key,selectable) {
    var h=E.HEROES[key],u=heroUi[key],s=state.heroes[key],chosen=state.selected.indexOf(key)>=0,busy=heroBusy(key);
    var attrs=selectable&&!busy?' data-action="toggle" data-hero="'+key+'"':' disabled';
    return '<button class="hero '+(selectable?'selectable ':'')+(chosen&&selectable?'selected ':'')+(busy?'busy':'')+'" '+attrs+' type="button">'+
      '<span class="hero-head"><span class="portrait '+u.colour+'">'+u.initials+'</span><span><span class="hero-name">'+h.name+'</span>'+
      '<span class="hero-role">'+h.role+' · Level 1</span><span class="trait">'+u.trait+'</span>'+(busy?'<span class="busy-label">Away</span>':'')+'</span></span>'+
      '<span class="stats"><span>ATK '+heroAttack(key)+'</span><span>ARM '+u.armour+'</span><span>SPD '+u.speed+'</span></span>'+
      meter('Health',s.health,'health')+meter('Mana',s.mana,'mana')+meter('Ready',s.readiness,'ready')+
      (chosen&&selectable?'<span class="check">✓</span>':'')+'</button>';
  }

  function resources(){
    return '<div class="resources"><span class="resource"><i></i>'+state.gold+'g</span><span class="resource scrap"><i></i>'+state.scrap+
      '</span><span class="resource herbs"><i></i>'+state.herbs+'</span>'+(installPrompt?'<button class="install-button" data-action="install">Install</button>':'')+'</div>';
  }

  function nav() {
    var recoveryText=state.activities.recovery?timeText(remaining(state.activities.recovery)):'Open';
    var items=[['company','Company','Assignments'],['roster','Roster','3 heroes'],['workshop','Workshop',state.activities.craft?'Forging':state.swordCrafted?'1 item':'Ready'],['recovery','Recovery',recoveryText]];
    var make=function(mobile){
      return items.map(function(x){
        var focus=state.tutorialFocus===x[0];
        return '<button class="'+(mobile?'':'nav-button ')+(state.view===x[0]?'active ':'')+(focus?'spotlight':'')+'" data-view="'+x[0]+'">'+x[1]+(mobile?'':'<small>'+x[2]+'</small>')+'</button>';
      }).join('');
    };
    return {side:'<nav class="side-nav" aria-label="Main navigation">'+make(false)+'</nav>',bottom:'<nav class="bottom-nav" aria-label="Mobile navigation">'+make(true)+'</nav>'};
  }

  function heading(kicker,title,copy){
    return '<div class="chapter"><span class="tick">✓</span>'+kicker+'</div><div class="heading-row"><div><h2>'+title+'</h2>'+(copy?'<p class="muted">'+copy+'</p>':'')+'</div></div>';
  }

  function intro(){
    return '<main class="intro"><section class="intro-card"><div class="crest">⚔</div><div class="eyebrow">Found a company</div><h1>Adventure Company</h1>'+
      '<p class="intro-copy">Build a roster, prepare expeditions and turn hard won materials into better equipment.</p>'+
      '<form id="company-form" class="name-row"><label class="sr-only" for="company-name">Company name</label>'+
      '<input id="company-name" maxlength="28" placeholder="Name your company" value="'+esc(state.companyName)+'" autocomplete="off">'+
      '<button class="primary" type="submit">Open the doors</button></form></section></main>';
  }

  function headquarters(){
    return heading('Chapter I','A modest beginning','Your charter is signed. '+esc(state.companyName)+' has three willing heroes and one overdue job.')+
      '<section class="panel mission-card"><div class="label">Available assignment</div><h3>Abandoned Road</h3>'+
      '<p class="muted">Merchants report bandits and strange lights along the old north road. Clear the obstruction and recover anything useful.</p>'+
      '<div class="tags"><span class="tag">Level 1</span><span class="tag">Physical threats</span><span class="tag">45 sec tutorial</span></div>'+
      '<div class="reward-strip"><span class="reward">Variable gold</span><span class="reward">2–4 scrap</span><span class="reward">Possible herb</span><span class="reward">Combat XP</span></div>'+
      '<div class="actions"><button class="primary" data-action="prepare">Prepare company</button></div></section>';
  }

  function preparation(){
    var f=forecast();
    var danger=f?'<aside class="danger"><div class="label">Predicted danger</div><div class="danger-value">'+f.danger+'%</div><div class="risk"><i style="width:'+f.danger+'%"></i></div>'+
      '<p>'+(f.danger<=20?'Comfortable':f.danger<=45?'Manageable':'Risky')+'</p><div class="forecast">'+
      '<div><strong>Success</strong><span>'+f.successChance+'% simulated</span></div><div><strong>Injury</strong><span>'+f.injuryChance+'% simulated</span></div>'+
      '<div><strong>Health loss</strong><span>'+f.expectedHealthLoss+'% expected</span></div><div><strong>Supplies</strong><span>1 Field Tonic each</span></div></div>'+
      '<div class="actions"><button class="primary" data-action="send">Send party</button><button class="secondary" data-action="back">Back</button></div></aside>'
      :'<aside class="danger empty"><div class="label">Predicted danger</div><div class="danger-value">—</div><h3>No party selected</h3><p>Select at least one available hero to calculate the forecast.</p><div class="actions"><button class="primary" disabled>Send party</button><button class="secondary" data-action="back">Back</button></div></aside>';
    return heading('Assignment preparation','Abandoned Road','Select any available combination. The forecast runs 400 seeded simulations; the real expedition still receives its own outcome.')+
      '<div class="mission-grid"><section class="panel"><div class="section-title"><h3>Your party</h3><span class="label">'+state.selected.length+'/3 selected</span></div>'+
      '<div class="hero-grid">'+Object.keys(E.HEROES).map(function(k){return heroCard(k,true);}).join('')+'</div></section>'+danger+'</div>';
  }

  function assignment(){
    var activity=state.activities.expedition;
    if(!activity) return headquarters();
    return heading('Expedition under way','The party is on the road','The encounter was fixed by its seed when the party departed. You may safely close the game.')+
      '<section class="panel timer-card"><div class="label">Time remaining</div><div class="timer">'+timeText(remaining(activity))+'</div>'+
      '<div class="progress"><i style="width:'+activityProgress(activity)+'%"></i></div><div class="party-row">'+activity.party.map(function(k){return '<span class="portrait '+heroUi[k].colour+'" title="'+E.HEROES[k].name+'">'+heroUi[k].initials+'</span>';}).join('')+
      '</div><p class="muted">Seed '+esc(activity.seed)+' · Combat resolves automatically.</p></section>';
  }

  function results(){
    var r=state.currentResult;
    if(!r) return headquarters();
    var rewards=r.rewards;
    var title=r.success?'Road secured':'Company withdrawn';
    var copy=r.success?'The report below was generated from the actual combat simulation.':'The party survived, but returns injured and without expedition materials.';
    var button=state.resultContext==='admin'?'<button class="primary" data-action="leave-replay">Return</button>':
      '<button class="primary" data-action="claim">'+(state.resultContext==='solo'?'Claim and finish prototype':'Take rewards')+'</button>';
    return heading('Assignment complete',title,copy)+'<div class="result-grid"><section class="panel"><div class="section-title"><h3>Encounter log</h3>'+
      '<span class="label">'+r.rounds+' rounds · Seeded</span></div><ol class="log">'+r.log.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ol></section>'+
      '<aside class="panel loot"><h3>'+(r.success?'Recovered':'Outcome')+'</h3><div class="reward-strip">'+
      '<span class="reward">'+rewards.gold+' gold</span><span class="reward">'+rewards.scrap+' scrap</span><span class="reward">'+rewards.herbs+' herb</span><span class="reward">'+rewards.xp+' XP each</span></div>'+
      '<p>'+(r.potionUsed?'At least one Field Tonic was consumed.':'No Field Tonics were needed.')+'</p>'+button+'</aside></div>';
  }

  function workshop(){
    var craft=state.activities.craft;
    var body;
    if(craft){
      body='<div class="panel working"><div class="item-icon">⚔</div><h3>Forging Iron Sword</h3><div class="timer">'+timeText(remaining(craft))+'</div>'+
        '<div class="progress"><i style="width:'+activityProgress(craft)+'%"></i></div><p class="muted">The timer continues while the game is closed.</p></div>';
    } else if(state.swordCrafted&&!state.swordEquipped){
      body='<section class="panel recipe"><div class="item"><div class="item-icon">⚔</div><div><div class="label">Common weapon</div><h3>Iron Sword</h3></div></div>'+
        '<div class="equipment-change"><div><b>Worn Training Sword</b><span>Attack +0</span></div><span>→</span><div><b>Iron Sword</b><span>Attack +4 · Vanguard</span></div></div>'+
        '<button class="primary" data-action="equip">Equip to Elara</button></section>';
    } else if(state.swordEquipped){
      body='<section class="panel recipe"><div class="item"><div class="item-icon">⚔</div><div><div class="label">Equipped by Elara</div><h3>Iron Sword</h3><p>Attack +4 · Elara now has '+heroAttack('elara')+' Attack.</p></div></div></section>';
    } else {
      body='<section class="panel recipe"><div class="item"><div class="item-icon">⚔</div><div><div class="label">Guaranteed first craft</div><h3>Iron Sword</h3>'+
        '<p class="muted">A simple weapon suitable for Vanguards. Better quality rolls will eventually depend on workshop skill.</p></div></div>'+
        '<div class="costs"><span class="cost '+(state.gold>=15?'met':'')+'">15 gold</span><span class="cost '+(state.scrap>=3?'met':'')+'">3 scrap</span><span class="cost met">30 sec</span></div>'+
        '<button class="primary" data-action="craft" '+(state.gold<15||state.scrap<3?'disabled':'')+'>Forge Iron Sword</button></section>';
    }
    return heading('Workshop','Company forge','Recovered materials become fixed equipment with sensible, item-specific bonuses.')+
      '<div class="facility-grid">'+body+'<aside class="panel"><h3>Crafting level 1</h3><p class="muted">Common items are reliable. Better quality chances will unlock as the workshop improves.</p>'+
      '<div class="progress"><i style="width:18%"></i></div><span class="label">18 / 100 craft XP</span></aside></div>';
  }

  function recoveryView(){
    var active=state.activities.recovery;
    var first;
    if(active){
      first='<article class="panel recovery-card violet recommended"><div class="label">Orin is away</div><h3>'+active.title+'</h3>'+
        '<div class="timer small">'+timeText(remaining(active))+'</div><div class="progress"><i style="width:'+activityProgress(active)+'%"></i></div>'+
        '<p class="muted">Orin cannot be assigned elsewhere until this completes.</p><button class="primary" disabled>In progress</button></article>';
    } else {
      first='<article class="panel recovery-card violet recommended"><div class="label">Recommended</div><h3>Quiet Study</h3><p class="muted">Recover 40 Mana and 15 readiness.</p>'+
        '<div class="costs"><span class="cost">5 gold</span><span class="cost">30 sec</span></div><button class="primary" data-action="study" '+(state.gold<5?'disabled':'')+'>Send Orin</button></article>';
    }
    return heading('Recovery','Send heroes somewhere useful','Recovery is a timed assignment, so progress does not stop when a hero needs rest.')+
      '<section class="panel"><div class="section-title"><h3>Orin Vale</h3><span class="label">'+(heroBusy('orin')?'Away':'Available')+'</span></div>'+heroCard('orin',false)+'</section>'+
      '<div class="recovery-grid" style="margin-top:16px">'+first+
      '<article class="panel recovery-card rust"><div class="label">Later prototype</div><h3>The Lantern Alehouse</h3><p class="muted">Recover readiness quickly. May inspire a rumour.</p><button class="ghost" disabled>Unavailable</button></article>'+
      '<article class="panel recovery-card gold"><div class="label">Later prototype</div><h3>Temple Rest</h3><p class="muted">Restore health and clear one injury.</p><button class="ghost" disabled>Unavailable</button></article></div>';
  }

  function nextAssignment(){
    var busy=heroBusy('elara');
    return heading('Next decision','Farm the Abandoned Road','Orin is studying. Elara can use the new sword to run the road alone while Fen remains available.')+
      '<div class="mission-grid"><section class="panel"><div class="section-title"><h3>Solo assignment</h3><span class="label">Repeatable</span></div>'+heroCard('elara',false)+
      '<div class="reward-strip"><span class="reward">Variable materials</span><span class="reward">Combat XP</span><span class="reward">New encounter seed</span></div>'+
      '<div class="actions"><button class="primary" data-action="solo" '+(busy?'disabled':'')+'>Prepare Elara solo</button></div></section>'+
      '<aside class="danger"><div class="label">Equipment change</div><div class="danger-value">+4</div><p>The Iron Sword improves Elara’s physical attacks. The forecast will recalculate for the solo party.</p></aside></div>';
  }

  function complete(){
    return '<section class="complete"><div class="crest">✓</div><div class="eyebrow">Prototype 0.2 loop complete</div><h2>The company is moving</h2>'+
      '<p>You have now seen two genuinely simulated encounters. Change the administrative seed and repeat the road to compare outcomes.</p>'+
      '<div class="actions" style="justify-content:center"><button class="primary" data-action="repeat">Run the road again</button><button class="secondary" data-view="roster">Review company</button></div></section>';
  }

  function roster(){
    return heading('Roster','Your first three heroes','Heroes grow individually. Traits, equipment, readiness and current assignments determine which work suits them.')+
      '<div class="hero-grid">'+Object.keys(E.HEROES).map(function(k){return heroCard(k,false);}).join('')+'</div>'+
      '<section class="panel" style="margin-top:16px"><h3>Tavern refreshes tomorrow</h3><p class="muted">Recruitment remains intentionally locked. Later candidates will have compatible trait pairings rather than purely random combinations.</p></section>';
  }

  function company(){
    if(state.stage==='headquarters')return headquarters();
    if(state.stage==='preparation')return preparation();
    if(state.stage==='assignment')return assignment();
    if(state.stage==='results')return results();
    if(state.stage==='next-assignment')return nextAssignment();
    if(state.stage==='complete')return complete();
    if(state.stage==='workshop')return heading('New facility','The forge is ready','Use the Workshop to turn recovered scrap into an Iron Sword.')+'<section class="panel"><button class="primary" data-view="workshop">Open Workshop</button></section>';
    if(state.stage==='recovery')return heading('A tired acolyte','Orin needs to recover','Send him to a useful recovery activity before the next assignment.')+'<section class="panel"><button class="primary" data-view="recovery">Open Recovery</button></section>';
    return headquarters();
  }

  function mainView(){if(state.view==='roster')return roster();if(state.view==='workshop')return workshop();if(state.view==='recovery')return recoveryView();return company();}

  function tutorial(){
    if(!state.tutorialFocus)return '';
    var place=state.tutorialFocus==='workshop'?'Workshop':'Recovery';
    var message=place==='Workshop'?'The recovered scrap can now become useful equipment. Open the Workshop.':'Orin spent most of his Mana on the road. Open Recovery and give him productive work.';
    return '<div class="tutorial-shade"></div><aside class="tutorial-card" role="dialog" aria-modal="true" aria-label="Tutorial"><div class="label">Next step</div><h3>Open '+place+'</h3><p>'+message+'</p>'+
      '<div class="actions"><button class="ghost" data-action="skip-tutorial">Skip tutorial</button></div></aside>';
  }

  function devPanel(){
    if(!state.devOpen)return '';
    return '<aside class="dev-panel"><div class="label">Administrative controls</div><h3>World seed</h3><input class="admin-input" id="seed-input" value="'+esc(state.seed)+'" aria-label="World seed">'+
      '<div class="admin-grid"><button class="secondary" data-action="apply-seed">Apply seed</button><button class="secondary" data-action="random-seed">Randomise</button></div>'+
      '<button class="secondary" data-action="copy-seed">Copy seed</button><button class="secondary" data-action="replay" '+(!state.lastResult?'disabled':'')+'>Re-run last encounter</button>'+
      '<button class="secondary" data-action="skip">Finish active timers</button><hr><button class="secondary" data-action="export">Export save</button>'+
      '<label class="file-label">Import save<input class="sr-only" id="import-save" type="file" accept="application/json"></label><button class="secondary" data-action="restart">Reset all progress</button></aside>';
  }

  function render(){
    completeActivities();
    var app=document.getElementById('app');
    if(state.stage==='intro'){app.innerHTML=intro();bind();return;}
    var n=nav();
    var notice=state.notice?'<div class="notice">'+esc(state.notice)+'</div>':'';
    app.innerHTML='<div class="shell"><header class="topbar"><div class="brand"><div class="brand-mark">A</div><div><strong>'+esc(state.companyName)+
      '</strong><span>Chartered adventure company</span></div></div>'+resources()+'</header><div class="layout">'+n.side+
      '<main class="content">'+notice+mainView()+'</main></div>'+n.bottom+'<button class="dev-toggle" data-action="dev" aria-label="Administrative controls">⋯</button>'+
      devPanel()+tutorial()+'</div>';
    bind();
  }

  function bind(){
    document.querySelectorAll('[data-view]').forEach(function(button){button.addEventListener('click',function(){openView(button.dataset.view);});});
    document.querySelectorAll('[data-action]').forEach(function(button){button.addEventListener('click',function(){act(button.dataset.action,button.dataset.hero);});});
    var form=document.getElementById('company-form');
    if(form)form.addEventListener('submit',function(event){event.preventDefault();var name=document.getElementById('company-name').value.trim();if(name)set({companyName:name,stage:'headquarters'});});
    var importer=document.getElementById('import-save');
    if(importer)importer.addEventListener('change',importSave);
  }

  function openView(view){
    var patch={view:view,notice:null};
    if(state.tutorialFocus===view)patch.tutorialFocus=null;
    set(patch);
  }

  function startExpedition(context,duration){
    if(!state.selected.length)return;
    var run=state.runNumber+1;
    var seed=E.encounterSeed(state.seed,run,state.selected,state.swordEquipped);
    state.activities.expedition={type:'expedition',title:'Abandoned Road',party:state.selected.slice(),startedAt:Date.now(),endsAt:Date.now()+duration*1000,duration:duration,seed:seed,swordEquipped:state.swordEquipped,context:context};
    set({stage:'assignment',view:'company',runNumber:run,resultContext:context,currentResult:null});
  }

  function claimResult(){
    if(state.resultClaimed||!state.currentResult)return;
    var rewards=state.currentResult.rewards;
    state.resultClaimed=true;
    state.gold+=rewards.gold;state.scrap+=rewards.scrap;state.herbs+=rewards.herbs;
    if(state.resultContext==='solo'){set({stage:'complete',currentResult:null});}
    else {
      var focus=state.tutorialSkipped?null:'workshop';
      set({stage:'workshop',view:'company',currentResult:null,tutorialFocus:focus});
    }
  }

  function act(action,hero){
    if(action==='prepare')set({stage:'preparation',selected:Object.keys(E.HEROES).filter(function(k){return !heroBusy(k);})});
    if(action==='back')set({stage:'headquarters'});
    if(action==='toggle'&&!heroBusy(hero)){
      var selected=state.selected.indexOf(hero)>=0?state.selected.filter(function(x){return x!==hero;}):state.selected.concat(hero);
      set({selected:selected});
    }
    if(action==='send')startExpedition(state.swordEquipped&&state.selected.length===1?'solo':'first',state.swordEquipped?25:45);
    if(action==='claim')claimResult();
    if(action==='craft'&&!state.activities.craft&&state.gold>=15&&state.scrap>=3){
      state.gold-=15;state.scrap-=3;
      state.activities.craft={type:'craft',title:'Iron Sword',startedAt:Date.now(),endsAt:Date.now()+30000,duration:30};
      set({notice:null});
    }
    if(action==='equip'&&state.swordCrafted){
      var focus=state.tutorialSkipped?null:'recovery';
      set({swordEquipped:true,stage:'recovery',view:'company',tutorialFocus:focus});
    }
    if(action==='study'&&!state.activities.recovery&&state.gold>=5&&!heroBusy('orin')){
      state.gold-=5;
      state.activities.recovery={type:'recovery',title:'Quiet Study',hero:'orin',startedAt:Date.now(),endsAt:Date.now()+30000,duration:30};
      set({stage:'next-assignment',view:'company',selected:['elara'],notice:'Orin has begun Quiet Study and is unavailable for 30 seconds.'});
    }
    if(action==='solo')set({stage:'preparation',view:'company',selected:['elara']});
    if(action==='repeat')set({stage:'preparation',view:'company',selected:Object.keys(E.HEROES).filter(function(k){return !heroBusy(k);})});
    if(action==='leave-replay')set({stage:'complete',currentResult:null,resultContext:null});
    if(action==='skip-tutorial')set({tutorialFocus:null,tutorialSkipped:true});
    if(action==='dev')set({devOpen:!state.devOpen});
    if(action==='skip'){
      Object.keys(state.activities).forEach(function(key){if(state.activities[key])state.activities[key].endsAt=Date.now();});
      completeActivities();render();
    }
    if(action==='apply-seed'){
      var input=document.getElementById('seed-input');
      if(input&&input.value.trim())set({seed:input.value.trim(),runNumber:0,notice:'World seed changed. Future expeditions will use the new sequence.'});
    }
    if(action==='random-seed'){
      var bytes=new Uint32Array(1);crypto.getRandomValues(bytes);set({seed:String(bytes[0]),runNumber:0,notice:'A new world seed has been generated.'});
    }
    if(action==='copy-seed'){navigator.clipboard&&navigator.clipboard.writeText(state.seed);set({notice:'Seed copied: '+state.seed});}
    if(action==='replay'&&state.lastResult){
      var inputs=state.lastResult.inputs;
      set({currentResult:E.simulateBattle({party:inputs.party,swordEquipped:inputs.swordEquipped,seed:inputs.seed,includeLog:true}),resultContext:'admin',stage:'results',view:'company'});
    }
    if(action==='export')exportSave();
    if(action==='install'&&installPrompt){installPrompt.prompt();installPrompt.userChoice.finally(function(){installPrompt=null;render();});}
    if(action==='restart'){state=fresh();save();render();}
  }

  function exportSave(){
    var blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    var url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='adventure-company-save.json';link.click();URL.revokeObjectURL(url);
    set({notice:'Save exported.'});
  }

  function importSave(event){
    var file=event.target.files&&event.target.files[0];if(!file)return;
    file.text().then(function(text){
      var incoming=JSON.parse(text);
      if(!incoming||incoming.saveVersion!==2||!incoming.heroes||!incoming.activities)throw new Error('This is not a valid prototype 0.2 save.');
      state=Object.assign(fresh(),incoming);save();render();
    }).catch(function(error){set({notice:'Import failed: '+error.message});});
  }

  window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();installPrompt=event;render();});
  window.addEventListener('appinstalled',function(){installPrompt=null;set({notice:'Adventure Company has been installed.'});});
  if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});

  var context=document.modelContext;
  if(context&&context.registerTool){
    var schema={type:'object',properties:{},additionalProperties:false};
    Promise.resolve(context.registerTool({name:'get_company_state',title:'Get company state',description:'Read current Adventure Company progress, activities and resources.',inputSchema:schema,annotations:{readOnlyHint:true,untrustedContentHint:false},execute:function(){return {stage:state.stage,view:state.view,seed:state.seed,runNumber:state.runNumber,resources:{gold:state.gold,scrap:state.scrap,herbs:state.herbs},activities:state.activities};}})).catch(function(){});
    Promise.resolve(context.registerTool({name:'finish_current_prototype_timers',title:'Finish current timers',description:'Finish all active prototype expedition, crafting and recovery timers.',inputSchema:schema,annotations:{readOnlyHint:false,untrustedContentHint:false},execute:function(){Object.keys(state.activities).forEach(function(key){if(state.activities[key])state.activities[key].endsAt=Date.now();});completeActivities();render();return {finished:true,stage:state.stage};}})).catch(function(){});
  }

  setInterval(function(){if(Object.values(state.activities).some(Boolean)){completeActivities();render();}},1000);
  render();
})();
