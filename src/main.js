import {createNotebook} from './notebook.js';
import { createSaveSlot, createFreshStart, serialize, deserialize } from './save.js';
import { CONFIG, HOMESTEAD_RULES } from './config.js';
import { createState, stepDay, cancelCommand, setSpeed, advanceTime,
  bringSettlersHome, restart, availableCommands, validateCommand, tomorrowWeather, currentWeather, castText, foodCapacity, populationCap, shelterPlaces } from './sim.js';
import { makeVillageScene } from './village-view.js';
import { createClearing } from './clearing.js';
import { THEME, t, commandLabel, resolveUi, uiHiddenClasses } from './theme.js';

const $=selector=>document.querySelector(selector);
const escapeHtml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const htmlText=(key,values)=>escapeHtml(t(key,values));
// All CSS, system fonts, colors, static labels, ARIA and placeholder copy come
// from the same theme file. No old-skin stylesheet is left behind.
const style=document.createElement('style');style.textContent=THEME.css;document.head.append(style);
for(const [name,color] of Object.entries(THEME.palette))document.documentElement.style.setProperty('--'+name,color);
document.documentElement.style.setProperty('--body-font',THEME.fonts.body);
document.documentElement.style.setProperty('--heading-font',THEME.fonts.heading);
document.documentElement.style.setProperty('--canvas-ratio',`${THEME.layout.canvas.width}/${THEME.layout.canvas.height}`);
for(const attr of ['copy','copy-aria','copy-placeholder'])for(const node of document.querySelectorAll(`[data-${attr}]`)) {
  const value=t(node.getAttribute('data-'+attr));
  if(attr==='copy')node.textContent=value;else node.setAttribute(attr==='copy-aria'?'aria-label':'placeholder',value);
}
document.title=t('ui.title')+t('ui.titleSuffix');
// Each run has a seed (the dice's starting number). ?seed=123 in the address
// replays a run exactly; otherwise the page picks a fresh one.
const randomSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const seedParam=new URLSearchParams(location.search).get('seed');
// UI switches (THEME.ui): ?ui=minimal previews a preset. Hiding is applied
// once here; render() keeps writing to hidden elements, which is harmless.
const uiMode=new URLSearchParams(location.search).get('ui') || 'clearing';
const immersive=uiMode==='clearing';
const ui=resolveUi(immersive?'minimal':uiMode);
document.documentElement.classList.toggle('clearing',immersive);
function applyUi(){
  const root=document.documentElement;
  for(const [flag,selectors] of Object.entries(THEME.ui.targets))if(ui[flag]===false)
    for(const selector of selectors)for(const node of document.querySelectorAll(selector))node.hidden=true;
  // Repeat until nothing changes, so nested wrappers close from the inside out.
  for(let changed=true;changed;){changed=false;
    for(const [name,selector] of Object.entries(THEME.ui.containers))for(const node of document.querySelectorAll(selector)){
      if(!node.hidden&&node.children.length&&[...node.children].every(child=>child.hidden)){node.hidden=true;root.classList.add('ui-empty-'+name);changed=true;}
    }
  }
  root.classList.add(...uiHiddenClasses(ui));
}
applyUi();
const withUiSpeed=s=>ui.autoPlaySpeed===null?s:setSpeed(s,ui.autoPlaySpeed);
// Save and load (design section 10): one local-storage slot. Opening the page
// resumes the saved run (an ended one shows its end screen); with no save, an
// unreadable one or an older format a new run starts and replaces it. An
// explicit ?seed= always starts that seed fresh.
const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
// A fresh save for the single permanent settlement.
const slot=createSaveSlot(storage,CONFIG.save.key+'.homestead');
const explicitSeed=seedParam!==null&&/^\d+$/.test(seedParam);
let state=(!explicitSeed&&slot.load(HOMESTEAD_RULES))||createState(HOMESTEAD_RULES,explicitSeed?Number(seedParam)>>>0:randomSeed()),selectedId=1;
state=withUiSpeed(state);
const recentDays=new Map();
const undoKey=CONFIG.save.key+'.beforeSkip';
let beforeSkip=null;try{beforeSkip=storage?.getItem(undoKey);}catch{}
function skipCheckpoint(){
  if(!beforeSkip)return null;
  const saved=deserialize(beforeSkip,HOMESTEAD_RULES);
  return saved&&saved.timeline===state.timeline&&saved.day<=state.day?saved:null;
}
function undoSkip(){
  if(skipping)return;
  const saved=skipCheckpoint();if(!saved){feedback('There is no earlier skip to undo in this world.',true);return;}
  state=setSpeed(saved,0);recentDays.clear();rememberDay();slot.save(state);beforeSkip=null;
  try{storage?.removeItem(undoKey);}catch{}
  input.value='';render();feedback('Skip undone. Back to day '+state.day+'.');
}
const archive=new Promise(resolve=>{
  try{
    const request=indexedDB.open('plaything-daily-history',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('days');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=request.onblocked=()=>resolve(null);
  }catch{resolve(null);}
});
function rememberDay(){
  state.timeline??=crypto.randomUUID();
  const snapshot=serialize(state),key=[state.timeline,state.day];
  recentDays.set(state.day,snapshot);
  if(recentDays.size>64)recentDays.delete(recentDays.keys().next().value);
  archive.then(db=>{if(db)db.transaction('days','readwrite').objectStore('days').put(snapshot,key);}).catch(()=>{});
}
if(!state.timeline)rememberDay();slot.save(state);
const freshStart=createFreshStart(CONFIG.freshStart);
let feedbackTimeout;
function feedback(text,error=false){
  clearFaint();
  const line=$('#feedback');
  line.textContent=text;line.classList.toggle('error',error);
  if(immersive){
    line.hidden=false;
    clearTimeout(feedbackTimeout);
    feedbackTimeout=setTimeout(()=>{line.hidden=true;},6500);
    clearing.signal(error);
  }
}
// The faint "say it again" line: the feedback line, or (where that is hidden,
// as in ?ui=minimal) the input's placeholder. It fades on cancel or timeout.
const input=$('#command-input'),placeholder=immersive?'Speak to the homestead…':input.getAttribute('placeholder');
let faintTimer=null,fadeTimer=null;
function showFaint(text){
  clearFaint();
  if(ui.showFeedback){const f=$('#feedback');f.textContent=text;f.classList.remove('error','fading');f.classList.add('faint');}
  else{input.setAttribute('placeholder',text);input.classList.add('faint-placeholder');}
  faintTimer=setTimeout(fadeFaint,CONFIG.freshStart.confirmSeconds*1000);
}
function fadeFaint(){
  clearTimeout(faintTimer);faintTimer=null;freshStart.cancel();
  const f=$('#feedback');if(!f.classList.contains('faint')&&!input.classList.contains('faint-placeholder'))return;
  f.classList.add('fading');input.classList.add('fading');
  fadeTimer=setTimeout(clearFaint,THEME.ui.fadeMs);
}
function clearFaint(){
  clearTimeout(faintTimer);clearTimeout(fadeTimer);faintTimer=fadeTimer=null;
  const f=$('#feedback');if(f.classList.contains('faint')){f.textContent='';f.classList.remove('faint','fading');}
  if(input.classList.contains('faint-placeholder')){input.setAttribute('placeholder',placeholder);input.classList.remove('faint-placeholder','fading');}
}
function select(id){selectedId=id;render();}
const clearing=immersive?createClearing($('#village'),()=>state):null;
const game=immersive?null:new Phaser.Game({type:Phaser.CANVAS,...THEME.layout.canvas,parent:'village',
  backgroundColor:THEME.palette.cream,banner:false,audio:{noAudio:true},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:makeVillageScene(()=>state,select)});
if(immersive)input.placeholder='Speak to the homestead…';

const notebook=createNotebook(()=>state,speed=>{state=setSpeed(state,speed);render();});
function render(){
  notebook.draw();
  const c=state.config;
  $('#age-label').textContent=t('labels.ages.'+state.age);
  $('#day').textContent=t('hud.day',{day:state.day});
  $('#status').textContent=state.ended?t('hud.ended'):state.speed===0?t('hud.paused'):t('hud.speed',{speed:state.speed,seconds:c.dayMs/1000/state.speed});
  $('#stats').innerHTML=[['population',state.villagers.length,populationCap(state)],['food',state.food,foodCapacity(state)],['wood',state.wood,c.limits.stock]]
    .map(([key,value,max])=>`<div class="stat"><small>${htmlText('labels.resources.'+key)}</small><strong>${value}</strong><em>${htmlText('hud.cap',{max})}</em></div>`).join('');
  const weather=state.weather;
  $('#weather-summary').textContent=t('hud.weather',{today:t('labels.weather.'+currentWeather(state)),remaining:weather.daysLeft?t('hud.remaining',{days:weather.daysLeft}):''});
  $('#forecast').hidden=state.ended||!ui.showForecast;
  // "Tomorrow" is live text BESIDE the tag; the forecast icon sits in the tag's
  // icon slot (theme CSS, only when that art loaded), then the weather word.
  const tomorrow=tomorrowWeather(state);
  $('#forecast').dataset.weather=tomorrow;
  $('#forecast').innerHTML=`<span class="forecast-word">${htmlText('hud.tomorrow')}</span><span class="forecast-sep">${htmlText('hud.tomorrowSeparator')}</span><span class="forecast-tag" aria-hidden="true"><span class="forecast-icon" data-weather="${tomorrow}"></span></span><span class="forecast-weather">${htmlText('labels.weather.'+tomorrow)}</span>`;
  $('#fire-summary').textContent=state.fireKnown?t('hud.fireKnown',{fire:t('labels.resources.fire'),state:t(state.fireLit?'hud.burning':'hud.unlit')}):
    t('hud.fireUnknown',{fire:t('labels.resources.fire'),counter:state.fireCounter,required:c.fire.consecutiveDays,day:c.fire.fromDay});
  for(const b of document.querySelectorAll('[data-speed]')){b.setAttribute('aria-pressed',Number(b.dataset.speed)===state.speed);b.disabled=state.ended;}
  $('#next-day').disabled=state.ended;
  $('#population-label').textContent=t('hud.population',{count:state.villagers.length});
  if(!state.villagers.some(v=>v.id===selectedId))selectedId=state.villagers[0]?.id;
  $('#roster').innerHTML=state.villagers.map(v=>`<button data-person="${v.id}" aria-pressed="${selectedId===v.id}">${escapeHtml(v.name)}</button>`).join('');
  for(const b of document.querySelectorAll('[data-person]'))b.onclick=()=>select(Number(b.dataset.person));
  const v=state.villagers.find(v=>v.id===selectedId);
  if(v){
    const stage=t('labels.life.'+(v.age<c.life.adult?'child':v.age<c.life.elder?'adult':'elder'));
    const gainKey={Hunt:'food',Forage:'food',Harvest:'food','Gather wood':'wood','Warm up':'warmth',Rest:'happiness'}[v.activity];
    const illness=v.illnessDays?t('hud.ill',{days:v.illnessDays}):t(v.illToday?'hud.lastIllDay':'hud.notIll');
    $('#villager-detail').innerHTML=`<div class="person-title"><strong>${escapeHtml(v.name)}</strong><span>${escapeHtml(v.gender)} · ${htmlText('hud.person',{id:v.id,stage,age:v.age})}</span></div>${v.traits.length?`<div class="person-traits">${htmlText('hud.traits',{traits:v.traits.map(tr=>t('labels.traits.'+tr)).join(t('labels.separators.traits'))})}</div>`:''}<div class="activity">${escapeHtml(THEME.copy.labels.activities[v.activity]??v.activity)}${gainKey?htmlText('hud.gain',{amount:v.gained,unit:t('labels.units.'+gainKey)}):''}</div>`+
      ['fullness','warmth','health','safety','happiness'].map(key=>`<div class="need"><span>${htmlText('labels.needs.'+key)}</span><div class="need-track"><div class="need-fill" style="width:${v[key]}%;background:${v[key]<THEME.layout.needs.badBelow?'var(--red)':v[key]<THEME.layout.needs.warningBelow?'var(--mustard)':'var(--green)'}"></div></div><strong>${v[key]}</strong></div>`).join('')+
      `<div class="person-status">${escapeHtml(illness)}<br>${htmlText('hud.personStatus',{shelter:t('labels.resources.shelter'),places:shelterPlaces(state),counter:state.birthCounter,required:c.birth.consecutiveDays})}</div>`;
  }else $('#villager-detail').textContent=t('hud.empty');
  $('#command-list').innerHTML=availableCommands(state).map(command=>{
    const check=validateCommand(state,command,state.day,true);
    const label=t('labels.commandNames.'+command);
    // Keywords are immutable rule vocabulary. A reskin may add a friendly label
    // but cannot disguise or silently replace the text the parser accepts.
    const display=commandLabel(command);
    return `<button type="button" class="command-chip" data-command="${command}" title="${escapeHtml(check.message)}">${escapeHtml(display)}</button>`;
  }).join('');
  $('#command-help').innerHTML=availableCommands(state).map(command=>`<p><strong>${escapeHtml(commandLabel(command))}</strong> — ${htmlText('help.'+command,{...c.commands[command],damage:c.needs.illnessDamage,mood:c.needs.illnessHappinessLoss,plots:c.farming.plots})}</p>`).join('');
  for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>{$('#command-input').value=b.dataset.command;$('#command-input').focus();};
  $('#queued').parentElement.hidden=!state.queuedCommand;
  $('#queued').textContent=state.queuedCommand?t('hud.queued',{day:state.day+1,command:commandLabel(state.queuedCommand)}):t('hud.noneQueued');
  $('#cancel').disabled=!state.queuedCommand;$('#command-input').disabled=false;$('#queue').disabled=false;
  $('#latest-label').textContent=t('ui.latest',{count:c.limits.log});
  $('#log').innerHTML=[...state.log].reverse().map(e=>`<li data-type="${e.type}"><small>${htmlText('hud.logDay',{day:e.day})}</small>${escapeHtml(e.text)}</li>`).join('');
  $('#milestone').hidden=!state.milestoneReached||!ui.showMilestone;
  $('#milestone').textContent=t('hud.milestone',{day:c.milestone.day,population:c.milestone.population,fire:t('labels.resources.fire')});
  $('#goal').textContent=t('ui.goal',{day:c.milestone.day,population:c.milestone.population,fire:t('labels.resources.fire')});
  $('#ended').hidden=!state.ended;
  if(state.ended){
    const S=state.stats;
    $('#end-body').textContent='The last villager died on day '+state.day+'. Rewind to keep playing this world, or start a new one.';
    $('#undo-skip').hidden=!skipCheckpoint();
    $('#end-stats').innerHTML=[['days',state.day],['peak',S.peak],['births',S.births],['deaths',S.deaths],['fire',S.fireDay===null?t('hud.endStats.fireNo'):t('hud.endStats.fireYes',{day:S.fireDay})]]
      .map(([key,value])=>`<div><dt>${htmlText('hud.endStats.'+key)}</dt><dd>${htmlText('hud.endStats.value',{value})}</dd></div>`).join('');
    $('#end-seed').textContent=t('hud.endStats.seed',{seed:state.seed});
  }
  renderProgress();
  if(dev)renderDev();
}
// Developer-only overlay (?dev=1): stats and the internal log. Off by default
// and never part of the player screen; it is created only when asked for.
const dev=new URLSearchParams(location.search).get('dev')==='1'||ui.devOverlay;
let devNode=null;
function renderDev(){
  if(!devNode){devNode=document.createElement('aside');devNode.id='dev-overlay';devNode.className='dev-overlay';document.body.append(devNode);}
  const S=state.stats,none=t('dev.none'),yn=b=>t(b?'dev.yes':'dev.no');
  const lines=[t('dev.title'),
    t('dev.stats',{day:state.day,seed:state.seed,population:state.villagers.length,cap:populationCap(state),food:state.food,wood:state.wood}),
    t('dev.more',{weather:t('labels.weather.'+(state.lastDay?.weather??'normal')),days:state.weather.daysLeft,tomorrow:t('labels.weather.'+tomorrowWeather(state)),
      fire:yn(state.fireKnown),farming:yn(state.farming.known),plots:state.farming.plots.map(x=>x===null?'·':x).join(' ')||none,
      shed:state.shed.built?t('dev.built'):state.shed.pending?t('dev.pending'):none}),
    t('dev.end',{peak:S.peak,births:S.births,deaths:S.deaths,fireDay:S.fireDay??none,farmDay:S.farmDay??none}),
    ...state.villagers.map(v=>t('dev.person',{id:v.id,name:v.name,traits:v.traits.join('+')||none,activity:THEME.copy.labels.activities[v.activity]??v.activity,
      fullness:v.fullness,warmth:v.warmth,health:v.health,happiness:v.happiness,ill:v.illnessDays?t('dev.ill',{days:v.illnessDays}):''})),
    ...state.traitLog.slice(-THEME.ui.devLogLines).map(e=>t('dev.line',{day:e.day,text:e.text}))];
  devNode.innerHTML=lines.map((line,i)=>`<div${i===0?' class="dev-title"':''}>${escapeHtml(line)}</div>`).join('');
}
function renderProgress(){
  $('#progress').style.width=`${state.elapsedMs/state.config.dayMs*100}%`;
  const seconds=Math.ceil((state.config.dayMs-state.elapsedMs)/1000/(state.speed||1));
  $('#day-progress').textContent=t(state.ended?'hud.stopped':state.speed?'hud.nextIn':'hud.pausedNext',{seconds});
}
let skipping=false;
async function backDays(raw){
  const match=/^back\s+(\d+)$/i.exec(raw),count=match?Number(match[1]):0;
  if(!Number.isSafeInteger(count)||count<1){feedback('Use a positive whole number, like “back 5”.',true);return;}
  const target=state.day-count;
  if(target<0){feedback('Day 0 is the beginning of this world.',true);return;}
  skipping=true;
  try{
    let snapshot=recentDays.get(target);
    if(!snapshot){
      const db=await archive;
      if(db)snapshot=await new Promise((resolve,reject)=>{
        const read=db.transaction('days').objectStore('days').get([state.timeline,target]);
        read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);
      });
    }
    const restored=deserialize(snapshot,HOMESTEAD_RULES);
    if(!restored){feedback('No recorded history for day '+target+'. This world started recording when you opened the update.',true);return;}
    const speed=state.ended?0:state.speed;
    state=setSpeed(restored,speed);state.elapsedMs=0;
    for(const day of recentDays.keys())if(day>target)recentDays.delete(day);
    selectedId=state.villagers[0]?.id??1;input.value='';
    slot.save(state);render();
    feedback('Back to day '+target+' · '+state.villagers.length+' villagers.');
  }catch{feedback('Could not read that day from saved history.',true);}
  finally{skipping=false;lastTime=null;}
}
async function skipDays(raw){
  const match=/^skip\s+(\d+)$/i.exec(raw);
  const count=match?Number(match[1]):0;
  if(count<1||!Number.isSafeInteger(state.day+count)){
    feedback('Use a positive whole number, like “skip 5”.',true);return;
  }
  if(state.ended){feedback('This village has ended.');return;}
  const from=state.day,target=from+count;
  beforeSkip=serialize(state);try{storage?.setItem(undoKey,beforeSkip);}catch{}
  input.value='';skipping=true;
  try{
    while(state.day<target&&!state.ended){
      const until=performance.now()+24;
      do{state=stepDay(state);state.elapsedMs=0;rememberDay();}while(state.day<target&&!state.ended&&performance.now()<until);
      state.elapsedMs=0;
      if(state.day<target&&!state.ended){
        feedback('Skipping to day '+target+' · day '+state.day);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    const days=state.day-from;
    feedback('Skipped '+days+' '+(days===1?'day':'days')+'. Day '+state.day+' · '+state.villagers.length+' villagers.'+(state.ended?' The village has ended.':''));
  }finally{skipping=false;lastTime=null;slot.save(state);render();}
}
const guideGroups={
  'People and provisions':[
    ['spawn people 5','Bring 5 adult settlers. Replace 5 with any number from 1 to 1000.'],
    ['food 20','Give 20 food, up to the storage limit. Change the number, or type food alone for 10.'],
    ['harvest','Give the camp a fixed gift of provisions.'],['bless','Raise health and happiness throughout the village.'],
    ['heal','Cure everyone currently sick.'],['teach fire','Teach fire making if the village has enough wood.'],
    ['teach farming','Teach the village to sow crops.'],['recall settlers','Bring the eastern settlement home with its supplies.']],
  'Weather and disasters':[
    ['rain','Bring rain.'],['drought','Start a dry spell.'],['flood','Raise the river; catches stored on the low bank can wash away.'],
    ['plague','Make the villagers sick.'],['earthquake','Shake the camp, lose wood and lower morale.'],
    ['meteor','Strike the valley; nearby shelters can catch fire.'],['volcano','Bury planted plots and spoil stored food.'],
    ['earth crack','Split the ground at the ford, damaging bridge work and losing wood.'],
    ['godzilla','Summon a monster. Armed, brave villagers can try to defend the camp.']],
  'Time and worlds':[
    ['pause','Stop the clock.'],['resume','Continue at normal speed.'],['speed up','Run time three times faster.'],
    ['normal speed','Return to normal speed.'],['skip 5','Simulate 5 days, stopping early if the village dies out.'],
    ['back 5','Go back 5 days in this world’s recorded history.'],['undo skip','Restore the village as it was before the most recent skip.'],
    ['begin anew','Start a new world. Type the command twice within 10 seconds to confirm.']],
  'Observation':[
    ['observe','Open the notebook: people, stores, discoveries and the death log.'],['tools','List discovered basic tools.'],
    ['heat tools','List discoveries for heat and fire.'],['weapons','List hunting equipment in use.'],
    ['textiles','List clothing and textile discoveries.'],['shelter','List known shelter designs.'],
    ['disasters','Show a quick list of disasters.'],['help','Open this searchable list. You can also type commands.']]
};
const guide=document.createElement('dialog');
guide.id='god-guide';guide.setAttribute('aria-labelledby','guide-title');
guide.innerHTML='<button type="button" aria-label="Close god commands">Close</button><h2 id="guide-title">God commands</h2><p>Choose a command to put it in the text field. Press Enter when you’re ready.</p><input type="search" aria-label="Search commands" placeholder="Search commands or effects…"><div data-results></div>';
document.body.append(guide);
const searchGuide=guide.querySelector('input'),guideResults=guide.querySelector('[data-results]');
function drawGuide(){
  const query=searchGuide.value.trim().toLowerCase();guideResults.replaceChildren();
  for(const [group,rows] of Object.entries(guideGroups)){
    const matches=rows.filter(([cmd,desc])=>(cmd!=='plague'||state.config.enablePlague)&&[group,cmd,desc].join(' ').toLowerCase().includes(query));
    if(!matches.length)continue;
    const title=document.createElement('h3');title.textContent=group;guideResults.append(title);
    for(const [cmd,desc] of matches){
      const row=document.createElement('button'),name=document.createElement('strong'),detail=document.createElement('span');
      name.textContent=cmd;detail.textContent=desc;row.append(name,detail);
      row.onclick=()=>{guide.close();input.value=cmd;input.focus();input.select();};guideResults.append(row);
    }
  }
  if(!guideResults.childElementCount)guideResults.textContent='No matching commands.';
}
function openGuide(){searchGuide.value='';drawGuide();if(!guide.open)guide.showModal();searchGuide.focus();}
$('#open-guide').onclick=openGuide;searchGuide.oninput=drawGuide;guide.querySelector('button').onclick=()=>guide.close();
$('#command-form').addEventListener('submit',e=>{
  e.preventDefault();
  if(skipping)return;
  const raw=input.value.trim();
  if(/^(help|commands|god commands|\?)$/i.test(raw)){input.value='';openGuide();return;}
  if(/^undo skip$/i.test(raw)){undoSkip();return;}
  if(/^back(?:\s+(?!to normal\b)|$)/i.test(raw)){void backDays(raw);return;}
  if(/^skip\b/i.test(raw)){void skipDays(raw);return;}
  // Enter on the end screen starts a fresh run with a new seed (and saves it).
  if(state.ended&&!/^(observe|notebook|knowledge|begin anew)$/i.test(raw)){feedback('Try back 1 or undo skip to return to this world.');return;}
  // "begin anew" is checked before keyword matching and costs nothing.
  const fresh=freshStart.handle(input.value);
  if(fresh==='ask'){input.value='';showFaint(t('feedback.beginAnew'));return;}
  if(fresh==='restart'){reset();return;}
  if(fresh==='cancel')fadeFaint();
  const words=input.value.trim().toLowerCase().replace(/[.!?]+$/,'').replace(/\s+/g,' ');
  if(['observe','notebook','knowledge'].includes(words)){input.value='';notebook.open();return;}
  if(words==='recall settlers'){
    input.value='';
    const returned=bringSettlersHome(state);
    feedback(returned?'The household returned safely with its supplies.':'All settlers are already home.');
    if(returned){state.castCount=(state.castCount||0)+1;slot.save(state);render();}return;
  }
  if(words==='pause'||words==='resume'){input.value='';state=setSpeed(state,words==='pause'?0:1);feedback(words==='pause'?'Time paused.':'Time resumed.');render();return;}
  const fast=['speed up','speed up time','fast forward','3x','3×'].includes(words);
  const normal=['normal speed','normal time','back to normal','go back to normal','slow down','1x','1×'].includes(words);
  if(fast||normal){
    state=setSpeed(state,fast?3:1);
    input.value='';
    const message=fast?'Time is running at 3×. Type “normal speed” to return.':'Time is back to normal (1×).';
    if(ui.showFeedback||immersive)feedback(message);
    else showFaint(message);
    render();return;
  }
  if(['shelter','shelters','housing'].includes(words)){
    const ideas=state.shelterIdeas||[];
    const message='Shelter ('+ideas.length+'/10): '+(ideas.join(', ')||'no designs discovered yet')+'.';
    input.value='';if(ui.showFeedback||immersive)feedback(message);else showFaint(message);return;
  }
  if(['textiles','clothing','clothing and textiles'].includes(words)){
    const crafts=state.textiles||[];
    const message='Clothing and textiles ('+crafts.length+'/7): '+(crafts.join(', ')||'none yet')+'.';
    input.value='';if(ui.showFeedback||immersive)feedback(message);else showFaint(message);return;
  }
  if(['heat tools','fire tools','fire progression','hunting kit','hunting tools','weapons'].includes(words)){
    const hunting=['hunting kit','hunting tools','weapons'].includes(words);
    const owned=hunting?[...new Set(state.villagers.flatMap(v=>[v.gear,v.fishTrap?'fish trap':null]).filter(item=>['sling','bow','spear thrower','fish trap'].includes(item)))]:state.fireTools||[];
    const message=(hunting?'Hunting kit':'Heat and fire')+' ('+owned.length+'/'+(hunting?4:5)+'): '+(owned.join(', ')||'none yet')+'.';
    input.value='';if(ui.showFeedback||immersive)feedback(message);else showFaint(message);return;
  }
  if(['tools','toolkit','basic toolkit'].includes(words)){
    input.value='';
    const known=state.toolkit||[];
    const message=known.length?'Basic toolkit ('+known.length+'/5): '+known.join(', ')+'.':'The camp has yet to discover its first basic tool.';
    if(ui.showFeedback||immersive)feedback(message);else showFaint(message);
    return;
  }
  if(words==='disasters'){
    input.value='';
    const choices='Try meteor, volcano, earth crack, Godzilla, flood, earthquake, drought, or plague.';
    if(ui.showFeedback||immersive)feedback(choices);
    else showFaint(choices);
    return;
  }
  const result=castText(state,input.value,{onUnmatched,impactScene:clearing?.impactScene()});
  if(!result.matched){render();return;}
  state=result.state;
  showCommandResult(result);
  if(result.ok){input.value='';slot.save(state);}
  render();
});
// Unmatched input (no keyword): a 'plaything:unmatched' event always, and with
// THEME.ui.unmatchedFeedback 'gust' (minimal preset) the placeholder gust.
function onUnmatched(text){
  window.dispatchEvent(new CustomEvent('plaything:unmatched',{detail:{text}}));
  if(clearing){
    clearing.gust();
    feedback('The village didn’t recognize that. Try “give them food” or “teach fire”.',true);
  }
  else if(ui.unmatchedFeedback==='gust')game.scene.getScene('village')?.gust?.();
}
// The end screen also restarts on Enter when the command box is switched off.
document.addEventListener('keydown',e=>{
  // The focused control handles Enter, including rewind commands.
});
$('#cancel').onclick=()=>{state=cancelCommand(state);feedback(t('feedback.canceled'));slot.save(state);render();};
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{state=setSpeed(state,Number(b.dataset.speed));render();};
$('#next-day').onclick=()=>{state=stepDay(state);rememberDay();slot.save(state);showCommandResult();render();};
// A new run with a new seed; it replaces the save at once.
function reset(){freshStart.cancel();state=withUiSpeed(restart(state,randomSeed()));recentDays.clear();rememberDay();slot.save(state);selectedId=1;$('#command-input').value='';feedback(t('feedback.reset'));render();}
$('#undo-skip').onclick=undoSkip;$('#rewind-ended').onclick=()=>{if(!skipping)void backDays('back 1');};
$('#restart').onclick=reset;$('#restart-ended').onclick=reset;
function showCommandResult(result=state.lastDay?.command){
  if(!result){if(state.lastDay?.discovery)feedback(state.lastDay.discovery);return;}
  if(!result.ok){feedback(result.message,true);return;}
  const effects={
    rain:'Rain is falling.',drought:'A dry spell has begun.',bless:'The village received your blessing.',
    plague:'Sickness has spread through the village.',harvest:'Your gift of provisions reached the pantry.',
    heal:'Your remedy cleared the illness.','teach fire':'The Gourdlings learned to make fire.',
    'teach farming':'The Gourdlings learned to sow crops.'
  };
  feedback(immersive?`Day ${state.day} · ${result.effect||effects[result.command]}`:t('feedback.applied',{command:commandLabel(result.command),day:state.day}));
}
let lastTime=null;
function frame(now){
  if(skipping){requestAnimationFrame(frame);return;}
  const dt=document.hidden||lastTime===null?0:Math.min(1000,Math.max(0,now-lastTime));
  lastTime=now;
  const fireRevision=state.fireRevision;
  const oldDay=state.day,prevEnded=state.ended;state=advanceTime(state,dt);
  if(state.fireRevision!==fireRevision){slot.save(state);feedback(state.fireNotice);render();}
  if(clearing&&!document.hidden)clearing.draw(dt);
  // Autosave at every day end (after the nightly rolls).
  if(state.day!==oldDay||state.ended!==prevEnded){rememberDay();slot.save(state);showCommandResult();render();}else renderProgress();
  requestAnimationFrame(frame);
}
render();
clearing?.draw(0);
requestAnimationFrame(frame);
window.plaything=Object.freeze({getState:()=>structuredClone(state),getUi:()=>({...ui})});
