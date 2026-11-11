import { createState, stepDay, queueCommand, cancelCommand, setSpeed, advanceTime,
  restart, availableCommands, validateCommand, nextAllowedDay } from './sim.js';
import { makeVillageScene } from './village-view.js';

let state = createState();
let selectedId = 1;
const $ = selector => document.querySelector(selector);
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function feedback(text, error = false) { $('#feedback').textContent = text; $('#feedback').classList.toggle('error', error); }
function select(id) { selectedId = id; render(); }
const Scene = makeVillageScene(() => state, select);
// CANVAS avoids a GPU requirement and works offline/from file:// too.
new Phaser.Game({ type: Phaser.CANVAS, width: 900, height: 480, parent: 'village',
  backgroundColor: '#263f38', banner: false, audio: { noAudio: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: Scene });

function render() {
  $('#day').textContent = `Day ${state.day}`;
  $('#status').textContent = state.ended ? 'Village ended' : state.speed === 0 ? 'Paused · time is still' : `${state.speed}× · ${state.config.dayMs / 1000 / state.speed}s per day`;
  $('#stats').innerHTML = [ ['People',state.villagers.length,`/ ${state.config.limits.population}`],
    ['Food',state.food,'/ 100'], ['Wood',state.wood,'/ 100'], ['Power',state.power,'/ 100'] ]
    .map(([label,value,cap]) => `<div class="stat"><small>${label}</small><strong>${value}</strong><em>${cap}</em></div>`).join('');
  const weather = state.weather;
  $('#weather-summary').textContent = `Today: ${state.lastDay?.weather || 'normal'} · Next: ${weather.type}${weather.daysLeft ? ` (${weather.daysLeft} days left)` : ''}`;
  $('#fire-summary').textContent = state.fireKnown ? `Fire known · ${state.fireLit ? 'burning today' : 'unlit today'}` : `Fire unknown · discovery ${state.fireCounter}/${state.config.fire.consecutiveDays} (from day ${state.config.fire.fromDay})`;
  for (const b of document.querySelectorAll('[data-speed]')) {
    b.setAttribute('aria-pressed', Number(b.dataset.speed) === state.speed);
    b.disabled = state.ended;
  }
  $('#next-day').disabled = state.ended;
  $('#population-label').textContent = `${state.villagers.length} villagers`;
  if (!state.villagers.some(v => v.id === selectedId)) selectedId = state.villagers[0]?.id;
  $('#roster').innerHTML = state.villagers.map(v => `<button data-person="${v.id}" aria-pressed="${selectedId === v.id}">${escapeHtml(v.name)}</button>`).join('');
  for (const b of document.querySelectorAll('[data-person]')) b.onclick = () => select(Number(b.dataset.person));
  const v = state.villagers.find(v => v.id === selectedId);
  if (v) {
    const stage = v.age < state.config.life.adult ? 'Child' : v.age < state.config.life.elder ? 'Adult' : 'Elder';
    const gainUnit = { Forage: 'food', 'Gather wood': 'wood', 'Warm up': 'warmth', Rest: 'happiness' }[v.activity];
    const illness = v.illnessDays ? `Ill · ${v.illnessDays} illness days left for upcoming turns` : v.illToday ? 'Sick today · illness ends tonight' : 'Not ill';
    $('#villager-detail').innerHTML = `<div class="person-title"><strong>${escapeHtml(v.name)}</strong><span>#${v.id} · ${stage} · ${v.age} days old</span></div><div class="activity">${escapeHtml(v.activity)}${gainUnit ? ` · +${v.gained} ${gainUnit}` : ''}</div>` +
      ['fullness','warmth','health','safety','happiness'].map(key => `<div class="need"><span>${key[0].toUpperCase()+key.slice(1)}</span><div class="need-track"><div class="need-fill" style="width:${v[key]}%;background:${v[key]<40?'var(--red)':v[key]<60?'var(--orange)':'var(--mint)'}"></div></div><strong>${v[key]}</strong></div>`).join('') +
      `<div class="person-status">${illness}<br>Shelter: ${state.config.limits.shelter} places · Birth counter: ${state.birthCounter}/${state.config.birth.consecutiveDays}</div>`;
  } else $('#villager-detail').textContent = 'Nobody remains in the clearing.';
  $('#command-list').innerHTML = availableCommands(state).map(command => {
    const rule=state.config.commands[command], check=validateCommand(state,command);
    const next=nextAllowedDay(state,command);
    return `<button type="button" class="command-chip" data-command="${command}" title="${escapeHtml(check.message)} Cost ${rule.cost}. ${rule.cooldown===null?'Once per run.':`Cooldown ${rule.cooldown} days.`}">${command}<span>${rule.cost}⚡</span>${next>state.day+1?` <small>${next===Infinity?'known':`day ${next}`}</small>`:''}</button>`;
  }).join('');
  for (const b of document.querySelectorAll('[data-command]')) b.onclick = () => { $('#command-input').value=b.dataset.command; $('#command-input').focus(); };
  $('#queued').textContent = state.queuedCommand ? `Queued for day ${state.day+1}: ${state.queuedCommand} · Enter another to replace` : 'Nothing queued.';
  $('#cancel').disabled = !state.queuedCommand;
  $('#command-input').disabled = state.ended; $('#queue').disabled = state.ended;
  $('#log').innerHTML = [...state.log].reverse().map(e => `<li data-type="${e.type}"><small>DAY ${e.day}</small>${escapeHtml(e.text)}</li>`).join('');
  $('#milestone').hidden = !state.milestoneReached;
  $('#milestone').textContent = `Milestone reached: through day ${state.config.milestone.day}, with ${state.config.milestone.population}+ lives and the knowledge of fire. Life goes on.`;
  $('#ended').hidden = !state.ended;
  renderProgress();
}
function renderProgress() {
  $('#progress').style.width = `${state.elapsedMs/state.config.dayMs*100}%`;
  const seconds=Math.ceil((state.config.dayMs-state.elapsedMs)/1000/(state.speed||1));
  $('#day-progress').textContent = state.ended ? 'Time has stopped.' : state.speed ? `Next day in ${seconds}s` : `Paused · next day in ${seconds}s at 1×`;
}
$('#command-form').addEventListener('submit', e => {
  e.preventDefault();
  const result = queueCommand(state, $('#command-input').value);
  state = result.state; feedback(result.message, !result.ok);
  if (result.ok) $('#command-input').value='';
  render();
});
$('#cancel').onclick = () => { state=cancelCommand(state); feedback('Command canceled. No power spent.'); render(); };
for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { state=setSpeed(state,Number(b.dataset.speed)); render(); };
$('#next-day').onclick = () => { state=stepDay(state); showCommandResult(); render(); };
function reset() { state=restart(state); selectedId=1; $('#command-input').value=''; feedback('A fresh village. Paused at day 0; no saved game.'); render(); }
$('#restart').onclick=reset; $('#restart-ended').onclick=reset;
function showCommandResult() {
  const r=state.lastDay?.command;
  if(r) feedback(r.ok ? `${r.command} applied on day ${state.day}. See the journal for its effect.` : r.message,!r.ok);
}
let lastTime=performance.now();
function frame(now) {
  // No background catch-up: hidden tabs freeze; large rendering hiccups are capped.
  const dt=document.hidden?0:Math.min(now-lastTime,1000); lastTime=now;
  const oldDay=state.day;
  state=advanceTime(state,dt);
  if(state.day!==oldDay) { showCommandResult(); render(); } else renderProgress();
  requestAnimationFrame(frame);
}
render(); requestAnimationFrame(frame);
// Read-only snapshot for manual diagnostics (no hidden console-only controls).
window.plaything = Object.freeze({ getState: () => structuredClone(state) });
