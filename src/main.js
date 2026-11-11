import { createSaveSlot, createFreshStart } from './save.js';
import { CONFIG } from './config.js';
import { createState, stepDay, queueCommand, cancelCommand, setSpeed, advanceTime,
  restart, availableCommands, validateCommand, nextAllowedDay, tomorrowWeather, queueText, populationCap, shelterPlaces } from './sim.js';
import { makeVillageScene } from './village-view.js';
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
const ui=resolveUi(new URLSearchParams(location.search).get('ui'));
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
const slot=createSaveSlot(storage,CONFIG.save.key);
const explicitSeed=seedParam!==null&&/^\d+$/.test(seedParam);
let state=(!explicitSeed&&slot.load())||createState({},explicitSeed?Number(seedParam)>>>0:randomSeed()),selectedId=1;
state=withUiSpeed(state);slot.save(state);
const freshStart=createFreshStart(CONFIG.freshStart);
function feedback(text,error=false){clearFaint();$('#feedback').textContent=text;$('#feedback').classList.toggle('error',error);}
// The faint "say it again" line: the feedback line, or (where that is hidden,
// as in ?ui=minimal) the input's placeholder. It fades on cancel or timeout.
const input=$('#command-input'),placeholder=input.getAttribute('placeholder');
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
const Scene=makeVillageScene(()=>state,select);
const game=new Phaser.Game({type:Phaser.CANVAS,...THEME.layout.canvas,parent:'village',
  backgroundColor:THEME.palette.cream,banner:false,audio:{noAudio:true},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Scene});

function render(){
  const c=state.config;
  $('#age-label').textContent=t('labels.ages.'+state.age);
  $('#day').textContent=t('hud.day',{day:state.day});
  $('#status').textContent=state.ended?t('hud.ended'):state.speed===0?t('hud.paused'):t('hud.speed',{speed:state.speed,seconds:c.dayMs/1000/state.speed});
  $('#stats').innerHTML=[['population',state.villagers.length,populationCap(state)],['food',state.food,c.limits.stock],['wood',state.wood,c.limits.stock],['power',state.power,c.limits.power]]
    .map(([key,value,max])=>`<div class="stat"><small>${htmlText('labels.resources.'+key)}</small><strong>${value}</strong><em>${htmlText('hud.cap',{max})}</em></div>`).join('');
  const weather=state.weather;
  $('#weather-summary').textContent=state.lastDay?t('hud.weather',{today:t('labels.weather.'+state.lastDay.weather),remaining:weather.daysLeft?t('hud.remaining',{days:weather.daysLeft}):''}):'';
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
    const gainKey={Forage:'food',Harvest:'food','Gather wood':'wood','Warm up':'warmth',Rest:'happiness'}[v.activity];
    const illness=v.illnessDays?t('hud.ill',{days:v.illnessDays}):t(v.illToday?'hud.lastIllDay':'hud.notIll');
    $('#villager-detail').innerHTML=`<div class="person-title"><strong>${escapeHtml(v.name)}</strong><span>${htmlText('hud.person',{id:v.id,stage,age:v.age})}</span></div>${v.traits.length?`<div class="person-traits">${htmlText('hud.traits',{traits:v.traits.map(tr=>t('labels.traits.'+tr)).join(t('labels.separators.traits'))})}</div>`:''}<div class="activity">${htmlText('labels.activities.'+v.activity)}${gainKey?htmlText('hud.gain',{amount:v.gained,unit:t('labels.units.'+gainKey)}):''}</div>`+
      ['fullness','warmth','health','safety','happiness'].map(key=>`<div class="need"><span>${htmlText('labels.needs.'+key)}</span><div class="need-track"><div class="need-fill" style="width:${v[key]}%;background:${v[key]<THEME.layout.needs.badBelow?'var(--red)':v[key]<THEME.layout.needs.warningBelow?'var(--mustard)':'var(--green)'}"></div></div><strong>${v[key]}</strong></div>`).join('')+
      `<div class="person-status">${escapeHtml(illness)}<br>${htmlText('hud.personStatus',{shelter:t('labels.resources.shelter'),places:shelterPlaces(state),counter:state.birthCounter,required:c.birth.consecutiveDays})}</div>`;
  }else $('#villager-detail').textContent=t('hud.empty');
  $('#command-list').innerHTML=availableCommands(state).map(command=>{
    const rule=c.commands[command],check=validateCommand(state,command),next=nextAllowedDay(state,command);
    const cooldown=rule.cooldown===null?t('hud.once'):t('hud.cooldown',{days:rule.cooldown});
    const label=t('labels.commandNames.'+command);
    // Keywords are immutable rule vocabulary. A reskin may add a friendly label
    // but cannot disguise or silently replace the text the parser accepts.
    const display=commandLabel(command);
    return `<button type="button" class="command-chip" data-command="${command}" title="${htmlText('hud.commandTitle',{message:check.message,cost:rule.cost,cooldown})}">${escapeHtml(display)}<span>${rule.cost}${htmlText('labels.powerGlyph')}</span>${next>state.day+1?` <small>${htmlText(next===Infinity?'hud.known':'hud.shortDay',{day:next})}</small>`:''}</button>`;
  }).join('');
  $('#command-help').innerHTML=availableCommands(state).map(command=>`<p><strong>${escapeHtml(commandLabel(command))}</strong> — ${htmlText('help.'+command,{...c.commands[command],damage:c.needs.illnessDamage,mood:c.needs.illnessHappinessLoss,plots:c.farming.plots})}</p>`).join('');
  for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>{$('#command-input').value=b.dataset.command;$('#command-input').focus();};
  $('#queued').textContent=state.queuedCommand?t('hud.queued',{day:state.day+1,command:commandLabel(state.queuedCommand)}):t('hud.noneQueued');
  $('#cancel').disabled=!state.queuedCommand;$('#command-input').disabled=state.ended&&!ui.enterRestarts;$('#queue').disabled=state.ended;
  $('#latest-label').textContent=t('ui.latest',{count:c.limits.log});
  $('#log').innerHTML=[...state.log].reverse().map(e=>`<li data-type="${e.type}"><small>${htmlText('hud.logDay',{day:e.day})}</small>${escapeHtml(e.text)}</li>`).join('');
  $('#milestone').hidden=!state.milestoneReached||!ui.showMilestone;
  $('#milestone').textContent=t('hud.milestone',{day:c.milestone.day,population:c.milestone.population,fire:t('labels.resources.fire')});
  $('#goal').textContent=t('ui.goal',{day:c.milestone.day,population:c.milestone.population,fire:t('labels.resources.fire')});
  $('#ended').hidden=!state.ended;
  if(state.ended){
    const S=state.stats;
    $('#end-body').textContent=t('ui.endBody',{days:state.day});
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
    t('dev.stats',{day:state.day,seed:state.seed,population:state.villagers.length,cap:populationCap(state),food:state.food,wood:state.wood,power:state.power}),
    t('dev.more',{weather:t('labels.weather.'+(state.lastDay?.weather??'normal')),days:state.weather.daysLeft,tomorrow:t('labels.weather.'+tomorrowWeather(state)),
      fire:yn(state.fireKnown),farming:yn(state.farming.known),plots:state.farming.plots.map(x=>x===null?'·':x).join(' ')||none,
      shed:state.shed.built?t('dev.built'):state.shed.pending?t('dev.pending'):none}),
    t('dev.end',{peak:S.peak,births:S.births,deaths:S.deaths,fireDay:S.fireDay??none,farmDay:S.farmDay??none}),
    ...state.villagers.map(v=>t('dev.person',{id:v.id,name:v.name,traits:v.traits.join('+')||none,activity:t('labels.activities.'+v.activity),
      fullness:v.fullness,warmth:v.warmth,health:v.health,happiness:v.happiness,ill:v.illnessDays?t('dev.ill',{days:v.illnessDays}):''})),
    ...state.traitLog.slice(-THEME.ui.devLogLines).map(e=>t('dev.line',{day:e.day,text:e.text}))];
  devNode.innerHTML=lines.map((line,i)=>`<div${i===0?' class="dev-title"':''}>${escapeHtml(line)}</div>`).join('');
}
function renderProgress(){
  $('#progress').style.width=`${state.elapsedMs/state.config.dayMs*100}%`;
  const seconds=Math.ceil((state.config.dayMs-state.elapsedMs)/1000/(state.speed||1));
  $('#day-progress').textContent=t(state.ended?'hud.stopped':state.speed?'hud.nextIn':'hud.pausedNext',{seconds});
}
$('#command-form').addEventListener('submit',e=>{
  e.preventDefault();
  // Enter on the end screen starts a fresh run with a new seed (and saves it).
  if(state.ended&&ui.enterRestarts){reset();return;}
  // "begin anew" is checked before keyword matching and costs nothing.
  const fresh=freshStart.handle(input.value);
  if(fresh==='ask'){input.value='';showFaint(t('feedback.beginAnew'));return;}
  if(fresh==='restart'){reset();return;}
  if(fresh==='cancel')fadeFaint();
  // Keyword matcher on every screen (design section 11). No keyword: nothing
  // queued, nothing spent, no message. A match runs the normal checks and the
  // feedback line shows the queued message or the refusal reason as before.
  const result=queueText(state,$('#command-input').value,{onUnmatched});
  if(!result.matched){render();return;}
  const queued=state.queuedCommand;
  state=result.state;feedback(result.message,!result.ok);if(result.ok)$('#command-input').value='';
  if(state.queuedCommand!==queued)slot.save(state);
  render();
});
// Unmatched input (no keyword): a 'plaything:unmatched' event always, and with
// THEME.ui.unmatchedFeedback 'gust' (minimal preset) the placeholder gust.
function onUnmatched(text){
  window.dispatchEvent(new CustomEvent('plaything:unmatched',{detail:{text}}));
  if(ui.unmatchedFeedback==='gust')game.scene.getScene('village')?.gust?.();
}
// The end screen also restarts on Enter when the command box is switched off.
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&state.ended&&!ui.enterRestarts&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();reset();}
});
$('#cancel').onclick=()=>{state=cancelCommand(state);feedback(t('feedback.canceled'));slot.save(state);render();};
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{state=setSpeed(state,Number(b.dataset.speed));render();};
$('#next-day').onclick=()=>{state=stepDay(state);slot.save(state);showCommandResult();render();};
// A new run with a new seed; it replaces the save at once.
function reset(){freshStart.cancel();state=withUiSpeed(restart(state,randomSeed()));slot.save(state);selectedId=1;$('#command-input').value='';feedback(t('feedback.reset'));render();}
$('#restart').onclick=reset;$('#restart-ended').onclick=reset;
function showCommandResult(){const r=state.lastDay?.command;if(r)feedback(r.ok?t('feedback.applied',{command:commandLabel(r.command),day:state.day}):r.message,!r.ok);}
let lastTime=performance.now();
function frame(now){
  const dt=document.hidden?0:Math.min(now-lastTime,1000);lastTime=now;
  const oldDay=state.day,prevEnded=state.ended;state=advanceTime(state,dt);
  // Autosave at every day end (after the nightly rolls).
  if(state.day!==oldDay||state.ended!==prevEnded){slot.save(state);showCommandResult();render();}else renderProgress();
  requestAnimationFrame(frame);
}
render();requestAnimationFrame(frame);
window.plaything=Object.freeze({getState:()=>structuredClone(state),getUi:()=>({...ui})});
