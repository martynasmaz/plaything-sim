import { createState, stepDay, queueCommand, cancelCommand, setSpeed, advanceTime,
  restart, availableCommands, validateCommand, nextAllowedDay, tomorrowWeather } from './sim.js';
import { makeVillageScene } from './village-view.js';
import { THEME, t, commandLabel } from './theme.js';

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
let state=createState({},seedParam!==null&&/^\d+$/.test(seedParam)?Number(seedParam)>>>0:randomSeed()),selectedId=1;
function feedback(text,error=false){$('#feedback').textContent=text;$('#feedback').classList.toggle('error',error);}
function select(id){selectedId=id;render();}
const Scene=makeVillageScene(()=>state,select);
new Phaser.Game({type:Phaser.CANVAS,...THEME.layout.canvas,parent:'village',
  backgroundColor:THEME.palette.cream,banner:false,audio:{noAudio:true},
  scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:Scene});

function render(){
  const c=state.config;
  $('#age-label').textContent=t('labels.ages.'+state.age);
  $('#day').textContent=t('hud.day',{day:state.day});
  $('#status').textContent=state.ended?t('hud.ended'):state.speed===0?t('hud.paused'):t('hud.speed',{speed:state.speed,seconds:c.dayMs/1000/state.speed});
  $('#stats').innerHTML=[['population',state.villagers.length,c.limits.population],['food',state.food,c.limits.stock],['wood',state.wood,c.limits.stock],['power',state.power,c.limits.power]]
    .map(([key,value,max])=>`<div class="stat"><small>${htmlText('labels.resources.'+key)}</small><strong>${value}</strong><em>${htmlText('hud.cap',{max})}</em></div>`).join('');
  const weather=state.weather;
  $('#weather-summary').textContent=state.lastDay?t('hud.weather',{today:t('labels.weather.'+state.lastDay.weather),remaining:weather.daysLeft?t('hud.remaining',{days:weather.daysLeft}):''}):'';
  $('#forecast').hidden=state.ended;
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
    const gainKey={Forage:'food','Gather wood':'wood','Warm up':'warmth',Rest:'happiness'}[v.activity];
    const illness=v.illnessDays?t('hud.ill',{days:v.illnessDays}):t(v.illToday?'hud.lastIllDay':'hud.notIll');
    $('#villager-detail').innerHTML=`<div class="person-title"><strong>${escapeHtml(v.name)}</strong><span>${htmlText('hud.person',{id:v.id,stage,age:v.age})}</span></div><div class="activity">${htmlText('labels.activities.'+v.activity)}${gainKey?htmlText('hud.gain',{amount:v.gained,unit:t('labels.units.'+gainKey)}):''}</div>`+
      ['fullness','warmth','health','safety','happiness'].map(key=>`<div class="need"><span>${htmlText('labels.needs.'+key)}</span><div class="need-track"><div class="need-fill" style="width:${v[key]}%;background:${v[key]<THEME.layout.needs.badBelow?'var(--red)':v[key]<THEME.layout.needs.warningBelow?'var(--mustard)':'var(--green)'}"></div></div><strong>${v[key]}</strong></div>`).join('')+
      `<div class="person-status">${escapeHtml(illness)}<br>${htmlText('hud.personStatus',{shelter:t('labels.resources.shelter'),places:c.limits.shelter,counter:state.birthCounter,required:c.birth.consecutiveDays})}</div>`;
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
  $('#command-help').innerHTML=availableCommands(state).map(command=>`<p><strong>${escapeHtml(commandLabel(command))}</strong> — ${htmlText('help.'+command,{...c.commands[command],damage:c.needs.illnessDamage,mood:c.needs.illnessHappinessLoss})}</p>`).join('');
  for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>{$('#command-input').value=b.dataset.command;$('#command-input').focus();};
  $('#queued').textContent=state.queuedCommand?t('hud.queued',{day:state.day+1,command:commandLabel(state.queuedCommand)}):t('hud.noneQueued');
  $('#cancel').disabled=!state.queuedCommand;$('#command-input').disabled=state.ended;$('#queue').disabled=state.ended;
  $('#latest-label').textContent=t('ui.latest',{count:c.limits.log});
  $('#log').innerHTML=[...state.log].reverse().map(e=>`<li data-type="${e.type}"><small>${htmlText('hud.logDay',{day:e.day})}</small>${escapeHtml(e.text)}</li>`).join('');
  $('#milestone').hidden=!state.milestoneReached;
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
}
function renderProgress(){
  $('#progress').style.width=`${state.elapsedMs/state.config.dayMs*100}%`;
  const seconds=Math.ceil((state.config.dayMs-state.elapsedMs)/1000/(state.speed||1));
  $('#day-progress').textContent=t(state.ended?'hud.stopped':state.speed?'hud.nextIn':'hud.pausedNext',{seconds});
}
$('#command-form').addEventListener('submit',e=>{
  e.preventDefault();const result=queueCommand(state,$('#command-input').value);
  state=result.state;feedback(result.message,!result.ok);if(result.ok)$('#command-input').value='';render();
});
$('#cancel').onclick=()=>{state=cancelCommand(state);feedback(t('feedback.canceled'));render();};
for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{state=setSpeed(state,Number(b.dataset.speed));render();};
$('#next-day').onclick=()=>{state=stepDay(state);showCommandResult();render();};
function reset(){state=restart(state,randomSeed());selectedId=1;$('#command-input').value='';feedback(t('feedback.reset'));render();}
$('#restart').onclick=reset;$('#restart-ended').onclick=reset;
function showCommandResult(){const r=state.lastDay?.command;if(r)feedback(r.ok?t('feedback.applied',{command:commandLabel(r.command),day:state.day}):r.message,!r.ok);}
let lastTime=performance.now();
function frame(now){
  const dt=document.hidden?0:Math.min(now-lastTime,1000);lastTime=now;
  const oldDay=state.day;state=advanceTime(state,dt);
  if(state.day!==oldDay){showCommandResult();render();}else renderProgress();
  requestAnimationFrame(frame);
}
render();requestAnimationFrame(frame);
window.plaything=Object.freeze({getState:()=>structuredClone(state)});
