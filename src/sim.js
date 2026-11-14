import {practices,availablePractices,materialSites,campSites,explorationSites,worldTrees,valleySeason,fellTree,wearCampPaths,maintainHouseholds,initPractice,initSettlement,beginSettlementDay,planLessons,practiceWork,completeMagicLessons,completeCerealLessons,finishOrdinaryWork,takeDeposit,settlementEvent,makePracticeProduct} from './practices.js';
import {hutBuildingSite,buildingSiteTree,canFellBuildingTree,clearBuildingTree} from './practices.js';
import {communityOf,familyFoodReady,mainFoodRequired,foodLedger,recordFoodBalance,familyFoodStable,winterStorageTarget} from './provisions.js';
import {neighborWork,crossVillageParents,recentVillagePartner,rememberFamilyVisit} from './neighbors.js';
// Pure, deterministic simulation. No Phaser, DOM, clock or I/O. The only
// "randomness" is a seeded dice generator stored IN the state, so the same
// seed + the same commands on the same days always replays the same run.
// Every transition returns a new state; failed command checks return the old one.
import { makeConfig } from './config.js';
import {assessNeeds} from './needs.js';
import {fishingCrafts,fishingDependencies,fishingMethod,hasFishingGear} from './fishing.js';
import {rememberHealerHome,healerBuildingRules,healerMedicineStore,healerTrainingRules,healerTrainingComplete,healerNeighbors,chooseQuietHealerSite,crowdedHealerSite} from './healer-home.js';
import { THEME, t, commandLabel } from './theme.js';
import {magicEnabled,awakenMagic,magicRecipes,magicDependencies,finishDivinations,coldOmen} from './magic.js';
import {boneHarvestBonus,wheatRules,cerealRecipes,cerealDependencies,cerealFoodWork,cerealStudyReady,gatherWildWheat,grainCapacity,cropRipeAt,ripePlot} from './farming.js';
import { normalizeWords, resolveCommand, matchCommand } from './commands.js';

const clamp = (n, max) => Math.max(0, Math.min(max, n));
const averageHappiness = s => s.villagers.length
  ? s.villagers.reduce((sum, v) => sum + v.happiness, 0) / s.villagers.length : 0;
const adult = (v, c) => v.age >= c.life.adult && v.age < c.life.elder;
export const unrelated = (a,b) => !a.parents?.includes(b.id) && !b.parents?.includes(a.id) &&
  !a.parents?.some(id=>b.parents?.includes(id));
const changeNeed = (v, key, amount, c) => { v[key] = clamp(v[key] + amount, c.limits.need); };
export function foodCapacity(s){
  const baskets=(s.textiles||[]).filter(name=>name.endsWith('basket')).length;
  return s.config.limits.stock+(s.local?.jars||0)*12+baskets*6+(s.pottery?.jars||0)*12+(s.fireTools?.includes('burn bowl')?8:0);
}
const changeStock = (s, key, amount) => { s[key] = clamp(s[key] + amount, key==='food'?foodCapacity(s):s.config.limits.stock); };
function log(s, text, type = 'info') {
  s.log.push({ day: s.day, text, type });
  s.log = s.log.slice(-s.config.limits.log);
}

// ---- Seeded dice (same generator as the reference sim) ----------------------
// Unsigned 32-bit LCG. A roll is a whole number 0..99.
const TWO_32 = 4294967296;
const lcg = n => (1664525 * n + 1013904223) % TWO_32;
function rollNight(s) {
  // Exactly three draws every night, even when a command will override the
  // weather or nobody can fall ill, so commands never shift later dice.
  const c = s.config;
  s.rng = lcg(s.rng); const weatherRoll = Math.floor(s.rng * 100 / TWO_32);
  s.rng = lcg(s.rng); const illnessRoll = Math.floor(s.rng * 100 / TWO_32);
  s.rng = lcg(s.rng); const target = s.rng;
  let weather = 'cold', total = 0;
  for (const [type, chance] of Object.entries(c.weather.chances)) {
    total += chance;
    if (weatherRoll < total) { weather = type; break; }
  }
  s.natural = { weather, illness: illnessRoll < c.illness.chance, target };
}
// Today's (or, between days, tomorrow's) weather: command weather wins.
export function forecastWeather(s) {
  return s.weather.daysLeft > 0 ? s.weather.type : s.natural.weather;
}

// What the HUD shows as tomorrow: a queued weather command that would pass
// today's checks overrides the natural roll, exactly as it will at day start.
export function tomorrowWeather(s) {
  const q = s.queuedCommand;
  if ((q === 'rain' || q === 'drought') && validateCommand(s, q).ok) return q;
  return forecastWeather(s);
}

// ---- Personality dice (v0.2) ------------------------------------------------
// A second generator, seeded with (run seed XOR 0x5EED7A17) and warmed up the
// same way. Only traits use it, so the three nightly rolls never move.
const traitStep = s => (s.traitRng = lcg(s.traitRng));
const traitRoll = s => Math.floor(traitStep(s) * 100 / TWO_32) + 1;
export const hasTrait = (s, v, trait) => s.config.traits && v.traits.includes(trait);
// Two steps per Gourdling: one of 10 traits, then one of the 8 left after
// removing the first and its opposite (pairs sit side by side in the list).
function assignTraits(s, v) {
  const list = s.config.personality.list;
  const first = Math.floor(traitStep(s) * list.length / TWO_32);
  const rest = list.filter((_, i) => i !== first && i !== (first ^ 1));
  v.traits = [list[first], rest[Math.floor(traitStep(s) * rest.length / TWO_32)]];
  if(s.config.settlement)v.outlook=spiritualOutlook(s.seed,v.id);
}
function spiritualOutlook(seed,id){
  const mixed=Math.imul(seed^Math.imul(id,2654435761),2246822519)>>>0;
  return ['Receptive','Questioning','Skeptical'][Math.floor(mixed/4294967296*3)];
}
function updateBelief(s,report){
  const intervention=report.command?.ok;
  if(s.local){
    const {known,total}=inventionProgress(s);
    if(known.length!==total)return;
    if(s.local.lastUnknownDay===undefined){
      s.local.lastUnknownDay=s.day;
      s.firstSignDay??=s.day;
      const message='Around the hearth, someone asks: “Who made the world?”';
      settlementEvent(s,message);
      log(s,message,'milestone');
    }
  }
  if(intervention&&s.firstSignDay===undefined){
    s.firstSignDay=s.day;
    log(s,'The camp began to wonder about the sign it had witnessed.','discovery');
  }
  if(s.firstSignDay===undefined)return;
  s.shrines??={};
  const groups=Array.from({length:s.tribeCount||1},(_,i)=>s.villagers.filter(v=>(v.tribe||0)===i));
  groups.forEach((members,camp)=>{
    const witnesses=members.filter(v=>v.conviction>=4);
    for(const v of members){
      v.outlook??=spiritualOutlook(s.seed,v.id);
      const open=v.outlook==='Receptive';
      let change=0;
      if(s.local?.lastUnknownDay!==undefined&&!intervention&&open)change=1;
      else if(intervention)change=open?2:v.outlook==='Questioning'?1:0;
      else if(s.day>s.firstSignDay&&s.day%3===v.id%3){
        const trusted=witnesses.some(peer=>peer.id!==v.id&&affinity(v,peer,s.config.personality.list)>0);
        if(open&&v.conviction>0&&s.day-s.firstSignDay<=6)change=1;
        else if(trusted&&v.outlook!=='Skeptical')change=1;
      }
      v.conviction=Math.min(6,(v.conviction||0)+change);
    }
    const followers=members.filter(v=>v.conviction>=4);
    if(followers.length>=2&&!s.shrines[camp]){
      s.shrines[camp]=true;
      log(s,followers.slice(0,2).map(v=>v.name).join(' and ')+' left stones at their camp to remember the sign.','discovery');
    }
  });
}
const isV02 = s => s.config.version === 'v0.2';
function affinity(a,b,traits){
  return a.traits.reduce((score,tr)=>{
    if(b.traits.includes(tr))return score+2;
    return score-Number(b.traits.includes(traits[traits.indexOf(tr)^1]));
  },0);
}
function campFit(person,residents,list){
  const peers=residents.filter(v=>v.id!==person.id);
  return peers.length?peers.reduce((sum,v)=>sum+affinity(person,v,list),0)/peers.length:0;
}
function bestHome(s,person){
  const homes=Array.from({length:s.tribeCount||1},(_,i)=>s.villagers.filter(v=>(v.tribe||0)===i&&v.id!==person.id));
  let best=0,score=-Infinity;
  homes.forEach((group,i)=>{
    if(!group.some(v=>v.age>=s.config.life.adult))return;
    const fit=campFit(person,group,s.config.personality.list);
    if(fit>score||(fit===score&&group.length<homes[best].length)){score=fit;best=i;}
  });
  return best;
}
// Population cap = Plank-shed places: 8, then 12 once the second shed stands.
const extraBeds = s => (s.huts||[]).filter((_,i)=>!s.hutDetails?.[i]?.ruined).length*(s.config.settlement?.bedsPerHut||0);
const wallTypes=['drystone wall','mud wall','wattle & daub wall'];
const hutTypes=['dome hut','gabled roof hut','A-frame hut','round hut','pyramidal hut'];
// A stable preference per camp and design, independent of menu order and weather rolls.
function craftPreference(s,camp,name){
  let hash=(s.seed^Math.imul(camp+1,0x9e3779b9))>>>0;
  for(const ch of name)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  hash=Math.imul(hash^(hash>>>16),2246822519);
  return ((hash^(hash>>>13))>>>0)/4294967296;
}
function favoredCraft(s,choices,camp=0){
  return choices.reduce((best,name)=>!best||craftPreference(s,camp,name)>craftPreference(s,camp,best)?name:best,null);
}
function crowdedCamp(s,camp){
  const people=s.villagers.filter(v=>(v.tribe||0)===camp).length;
  const huts=(s.huts||[]).filter(home=>home===camp).length;
  return people-huts*s.config.settlement.bedsPerHut>=(s.shelterIdeas?.length?5:8);
}
export function shouldPlanHut(s){
  return !!s.config.learning&&s.settlementWork>=s.config.settlement.shelterWork&&
    populationCap(s)-s.villagers.length<=2;
}
export function sleepingHut(s,v){
  const camp=v.tribe||0;
  const residents=s.villagers.filter(person=>!person.herbalist?.home&&(person.tribe||0)===camp&&!person.outdoors);
  residents.sort((a,b)=>(a.household??a.id)-(b.household??b.id)||a.id-b.id);
  const place=residents.findIndex(person=>person.id===v.id);
  if(place<0||!s.huts?.length)return -1;
  const local=Math.floor(place/s.config.settlement.bedsPerHut);
  return s.huts.map((home,i)=>home===camp&&!s.hutDetails?.[i]?.ruined?i:-1).filter(i=>i>=0)[local]??-1;
}
function learnShelter(s,v,idea,report){
  s.shelterIdeas??=[];
  if(s.shelterIdeas.includes(idea))return;
  s.shelterIdeas.push(idea);
  report.discovery=`${v.name} helped the camp discover the ${idea}.`;
  log(s,report.discovery,'discovery');
}
function nextHutImprovement(s,camp=0){
  if(!s.huts?.length)return null;
  const ideas=s.shelterIdeas||[];
  const designs=[...wallTypes,...hutTypes].filter(name=>!ideas.includes(name));
  if(designs.length)return favoredCraft(s,designs,camp);
  if(!s.fireKnown)return null;
  if(s.huts.some((_,i)=>!s.hutDetails?.[i]?.chimney))return 'chimney';
  if(readyToInvent(s,'ondol')&&s.huts.some((_,i)=>!s.hutDetails?.[i]?.ondol))return 'ondol';
  return null;
}
export const shelterPlaces = s => s.config.limits.shelter + (s.shed.built ? s.config.shed.places : 0) + extraBeds(s);
export const populationCap = s => s.config.limits.population + (s.shed.built ? s.config.shed.places : 0) + extraBeds(s);
// Fuel target: 20 while saving for the second shed, otherwise 6.
export function fuelTarget(s, n = s.villagers.length) {
  const c = s.config;
  return isV02(s) && s.farming.known && !s.shed.built && !s.shed.pending && n >= c.shed.population
    ? c.shed.woodTarget : c.work.woodTarget + ((s.tribeCount||1)-1)*c.fire.dailyFuel;
}
export function campFireLit(s,camp=0){
  return camp===0?s.fireLit:!!s.campFires?.[camp];
}
function unlockFarming(s) {
  s.farming.known = true; s.farming.plots = Array(s.config.farming.plots).fill(null); s.stats.farmDay = s.day;
}

// Lithuania's 2000 birth-name rankings (Tėvų Darželis, via Behind the Name).
const lithuanianNames={
  male:['Lukas','Mantas','Rokas','Deividas','Tomas','Karolis','Paulius','Dovydas','Matas','Martynas','Edvinas','Dominykas','Ignas','Justas','Laurynas','Ernestas','Arnas','Tadas','Domantas','Mindaugas'],
  female:['Gabrielė','Gabija','Viktorija','Karolina','Greta','Ieva','Erika','Evelina','Monika','Emilija','Kamilė','Ugnė','Agnė','Aistė','Deimantė','Laura','Paulina','Miglė','Simona','Gintarė']
};
export function assignIdentity(s,v){
  if(!s.config.settlement||v.gender)return;
  const balance=s.villagers.reduce((sum,p)=>sum+Number(p.gender==='male')-Number(p.gender==='female'),0);
  v.gender=balance<=0?'male':'female';
  const pool=lithuanianNames[v.gender];
  const assigned=new Set(s.villagers.filter(p=>p!==v&&p.gender===v.gender).map(p=>p.name));
  const start=Math.floor((v.id-1)/2)%pool.length;
  const ranked=pool.slice(start).concat(pool.slice(0,start));
  v.name=ranked.find(name=>!assigned.has(name))??ranked[0];
}
function villager(id, name, age, values, c) {
  return { id, name, age, ...values, safety: c.needs.safe, traits: [],
    illnessDays: 0, illToday: false, activity: 'Waiting', gained: 0, reaction: '' };
}
export function createState(overrides = {}, seed = 0) {
  const c = makeConfig(overrides);
  const s = {
    config: c, day: 0, age: 'Stone', food: c.start.food, wood: c.start.wood, ...(c.power ? {power:c.start.power} : {}),
    villagers: c.start.ages.map((age, i) => villager(i + 1, THEME.names[i] || t('labels.nameFallback', {id:i+1}),
      age, { fullness: c.start.fullness, warmth: c.start.warmth,
        health: c.start.health, happiness: c.start.happiness }, c)),
    nextId: c.start.ages.length + 1,
    seed: seed >>> 0, rng: seed >>> 0, natural: null,
    // `weather` is command weather only; natural weather lives in `natural`.
    weather: { type: 'normal', daysLeft: 0 }, fireKnown: false, fireLit: false,
    stats: { peak: c.start.ages.length, births: 0, deaths: 0, fireDay: null, farmDay: null, shedDay: null, traitEvents: {} },
    // v0.2: plots are null (empty) or a growth number 0..ripeAt.
    farming: { known: false, counter: 0, plots: [] }, shed: { pending: false, built: false },
    traitRng: (seed ^ c.personality.seedXor) >>> 0, traitLog: [],
    birthCounter: 0, fireCounter: 0, lastUsed: {}, queuedCommand: null,
    speed: 0, elapsedMs: 0, ended: false, milestoneReached: false, lastDay: null,
    log: [{ day: 0, text: t('log.start', {seed: seed >>> 0}), type: 'info' }]
  };
  if(c.settlement)s.furWraps=true;
  initSettlement(s);
  if(s.local)s.local.terrain='kaunas';
  for(const person of s.villagers)assignIdentity(s,person);
  for (let i = 0; i < c.rng.warmupSteps; i++) s.rng = lcg(s.rng);
  rollNight(s); // Day 1's weather is rolled and shown before play starts.
  if (c.traits) {
    for (let i = 0; i < c.rng.warmupSteps; i++) traitStep(s);
    for (const v of s.villagers) {
      assignTraits(s, v);
      devLog(s, v, 'start', t('traitLog.start', {name:v.name,traits:traitNames(v)}));
    }
  }
  findHomesteadHealer(s);
  return s;
}
export function availableCommands(state) {
  const c = state.config;
  return Object.keys(c.commands).filter(k => (k !== 'plague' || c.enablePlague)
    && (!c.commands[k].since || c.commands[k].since === c.version));
}
// Minimal UI: keyword matching (design section 11) for this run's commands.
export const matchText = (state, text) => matchCommand(text, availableCommands(state));
const traitNames = v => v.traits.map(tr => t('labels.traits.'+tr)).join(t('labels.separators.traits'));
// Internal (developer) log: trait effects, at most `logPerDay` lines a day,
// plus the starters' and newborns' traits. Never shown to players.
function devLog(s, v, trait, text) {
  s.traitLog.push({ day: s.day, id: v.id, trait, text });
}
// A trait effect: counted, and offered as a candidate internal-log line.
// flushTraitLog keeps at most `logPerDay` a day by the design's priority.
function traitEvent(s, report, v, key, text) {
  s.stats.traitEvents[key] = (s.stats.traitEvents[key] || 0) + 1;
  report.traitEvents.push({ id: v.id, trait: key });
  report.traitCandidates.push({ priority: s.config.personality.logPriority[key.split('-')[0].replace(/[+]$/, '')],
    seq: report.traitCandidates.length, id: v.id, trait: key, text });
}
// Priority: Generous, Grabby, Smart, Scatterbrained, Brave/Timid, then the
// Sociable/Loner rest lines; ties keep the order they happened in.
export const pickLogLines = (candidates, perDay) =>
  [...candidates].sort((a, b) => a.priority - b.priority || a.seq - b.seq).slice(0, perDay);
function flushTraitLog(s, report) {
  const kept = pickLogLines(report.traitCandidates, s.config.personality.logPerDay);
  for (const e of kept) s.traitLog.push({ day: s.day, id: e.id, trait: e.trait, text: e.text });
  report.traitLines = kept.length;
}
// The trait that decided the final job, or null (design: log rules, credit).
export function creditTrait(s, v, weather, die, action, plain) {
  if (action === plain) return null;
  const P = s.config.personality, has = tr => hasTrait(s, v, tr);
  const wandered = action !== 'warm' && has('Scatterbrained') && die <= P.scatterbrained.chance;
  if ((weather === 'rain' || weather === 'cold') && (has('Brave') || has('Timid'))) {
    const below = has('Brave') ? P.braveWarmUpBelow : P.timidWarmUpBelow;
    // Only when the different threshold itself changed whether it warmed up.
    if ((v.warmth < below) !== (v.warmth < s.config.needs.warmUpBelow) && !wandered) return has('Brave') ? 'Brave' : 'Timid';
  }
  if (wandered) return 'Scatterbrained';
  return has('Smart') ? 'Smart' : null;
}
export const normalizeCommand = normalizeWords;
export function nextAllowedDay(state, command) {
  if (!state.config.power) return 0;
  const last = state.lastUsed[command];
  if (last === undefined) return 1;
  const cooldown = state.config.commands[command]?.cooldown;
  return cooldown === null ? Infinity : last + cooldown;
}

// `day` is the day the command would affect, not the day it was typed.
export function validateCommand(s, text, day = s.day + 1, instant = false) {
  const command = resolveCommand(text) || normalizeCommand(text);
  const commands = availableCommands(s);
  const fail = message => ({ ok: false, command, message });
  if (!commands.includes(command)) return fail(t('errors.unknown', {commands:commands.map(commandLabel).join(t('labels.separators.list'))}));
  if (s.ended || !s.villagers.length) return fail(t('errors.ended'));
  const c = s.config;
  const rule = c.commands[command];
  const allowed = instant && s.lastUsed[command] === undefined ? day : nextAllowedDay(s, command);
  const conditionFail = message => !c.power ? fail(message) : fail(t('errors.condition', {reason:message,day:Math.max(day,allowed)}));
  if (day < allowed) return fail(allowed === Infinity ? t('errors.once', {command:commandLabel(command)})
    : t('errors.cooldown', {command:commandLabel(command),allowed,day}));
  if (c.power && s.power < rule.cost) return fail(t('errors.power', {command:commandLabel(command),cost:rule.cost,power:s.power,day:Math.max(day,allowed)}));
  if (['rain', 'drought'].includes(command) && (instant ? currentWeather(s) : forecastWeather(s)) === command)
    return !c.power ? fail('That weather is already active.') : fail(t('errors.weather', {command:commandLabel(command),day:Math.max(day,allowed)}));
  if (command === 'plague' && s.villagers.some(v => v.illnessDays > 0))
    return !c.power ? fail('Illness is already spreading.') : fail(t('errors.illness', {day:Math.max(day,allowed)}));
  if (command === 'harvest' && s.food >= foodCapacity(s)) return conditionFail(t('errors.foodFull'));
  if (command === 'teach fire' && s.fireKnown) return fail(t('errors.fireKnown'));
  if (command === 'teach fire' && s.wood < c.fire.minWood) return conditionFail(t('errors.fireWood', {min:c.fire.minWood,learn:c.fire.discoveryCost,burn:c.fire.dailyFuel}));
  if (command === 'bless' && s.villagers.every(v => v.health === c.limits.need && v.happiness === c.limits.need))
    return conditionFail(t('errors.blessFull'));
  if (command === 'heal' && !s.villagers.some(v => v.illnessDays > 0)) return conditionFail(t('errors.nobodyIll'));
  if (command === 'teach farming' && s.farming.known) return fail(t('errors.farmingKnown'));
  return { ok: true, command, message: t('feedback.canApply', {command:commandLabel(command),day}) };
}
export function queueCommand(s, text) {
  const result = validateCommand(s, text);
  if (!result.ok) return { ...result, state: s };
  const state = structuredClone(s);
  state.queuedCommand = result.command;
  return { ...result, state, message: t('feedback.queued', {command:commandLabel(result.command),day:s.day+1}) };
}
// Typed text (design section 11, on every screen): keywords anywhere pick one
// command, then the normal checks run. No match → { matched: false } and the
// state is untouched. A refusal or no match never clears the queued command;
// only a newly accepted command replaces it.
// `hooks.onUnmatched(text)` fires only when no keyword matched (section 11:
// the screen may answer with a gust); a match, accepted or refused, never fires it.
export function queueText(s, text, hooks = {}) {
  const command = matchText(s, text);
  if (command === null) { hooks.onUnmatched?.(text); return { ok: false, matched: false, command: null, message: '', state: s }; }
  return { ...queueCommand(s, command), matched: true };
}
export function currentWeather(s) {
  return s.liveWeather?.day === s.day ? s.liveWeather.type : (s.lastDay?.weather ?? s.weather.type);
}
export function castText(s, text, hooks = {}) {
  if(normalizeWords(text)==='magic'){
    const refuse=message=>({ok:false,matched:true,command:'magic',state:s,message});
    if(!s.config.learning||!s.local)return refuse('Folk magic belongs to the live homestead.');
    if(s.ended||!s.villagers.length)return refuse('Rewind to a living village first.');
    if(magicEnabled(s))return {ok:true,matched:true,command:'magic',state:s,effect:'Magic is already awake in this world.'};
    const state=structuredClone(s);awakenMagic(state);state.castCount=(state.castCount||0)+1;
    state.castAt??={};state.castAt.magic=state.day*state.config.dayMs+state.elapsedMs;state.lastUsed.magic=state.day;
    const effect='Magic has awakened. Villagers may learn casting bones, foretelling, hearth charms, mending rites and store wards.';
    log(state,effect,'command');
    return {ok:true,matched:true,command:'magic',state,effect,message:effect};
  }
  if(s.config.settlement&&/^(?:spawn\s+)?food(?:\s|$)/i.test(text.trim())){
    const match=/^(?:spawn\s+)?food(?:\s+(\d+))?$/i.exec(text.trim());
    const n=match?Number(match[1]??10):0;
    if(!Number.isSafeInteger(n)||n<1||s.ended)return {ok:false,matched:true,state:s,message:s.ended?'Rewind to a living village first.':'Use food 20 with a positive whole number.'};
    const state=structuredClone(s);changeStock(state,'food',n);state.castCount=(state.castCount||0)+1;
    const effect='Added '+(state.food-s.food)+' food · stores '+state.food+'/'+foodCapacity(state)+'.';
    return {ok:true,matched:true,command:'food',effect,message:effect,state};
  }
  const command = matchText(s, text);
  if (command === null) { hooks.onUnmatched?.(text); return { ok:false, matched:false, state:s }; }
  let settlers;
  if(command==='spawn people'){
    const phrase=text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/\s+/g,' ').trim();
    const count=phrase.match(/\b\d+\b/g);
    const defaultRequest=/^(?:please )?(?:spawn(?: people)?|call settlers|summon people|more people|new settlers|populate)(?: please)?$/.test(phrase);
    if(count?.length===1 && !/[+\-.,]\s*\d|\d\s*[.,]\s*\d/.test(phrase)){
      settlers=Number(count[0]);
    }
    if(settlers===undefined?!defaultRequest:settlers<1||settlers>1000)
      return {ok:false,matched:true,command,state:s,message:'Use “spawn people 100” with one whole number from 1 to 1000.'};
  }
  const check = validateCommand(s, command, s.day, true);
  if (!check.ok) return { ...check, matched:true, state:s };
  const state = structuredClone(s), report = {command:check};
  applyPower(state, report, command, true,hooks.impactScene,settlers);
  state.castAt ??= {};
  state.castAt[command] = state.day * state.config.dayMs + state.elapsedMs;
  state.castCount = (state.castCount || 0) + 1;
  if (state.config.settlement) updateBelief(state, report);
  return { ...report.command, matched:true, state };
}
export function cancelCommand(s) {
  return { ...s, queuedCommand: null };
}
export function setSpeed(s, speed) {
  if (!s.config.speeds.includes(speed)) throw new RangeError(t('errors.speed'));
  return { ...s, speed: s.ended ? 0 : speed };
}
// Restart is a fresh day-0 run with a NEW seed (the page passes a random one).
export function restart(s, seed = (s.seed + 1) >>> 0) {
  return createState(s.config, seed === s.seed ? (seed + 1) >>> 0 : seed);
}

function applyQueued(s, report) {
  if (!s.queuedCommand) return;
  const command = s.queuedCommand;
  // Revalidation is intentional: queuing neither reserves resources nor guarantees success.
  const check = validateCommand(s, command, s.day);
  s.queuedCommand = null;
  report.command = check;
  if (!check.ok) { log(s, t('log.rejected', {reason:check.message}), 'failure'); return; }
  applyPower(s, report, command);
}
function applyPower(s, report, command, instant = false, scene, settlers) {
  const c = s.config, rule = c.commands[command];
  if (c.power) s.power -= rule.cost;
  s.lastUsed[command] = s.day;
  let details = '';
  if(command==='spawn people'){
    const number=settlers??rule.settlers;
    for(let i=0;i<number;i++){
      const id=s.nextId++,person=villager(id,t('labels.nameFallback',{id}),c.life.adult,c.newborn,c);
      assignIdentity(s,person);
      if(c.learning)person.travelMeals=3;
      if(s.config.learning)initPractice(s,person);
      if(c.traits)assignTraits(s,person);
      person.tribe=bestHome(s,person);s.villagers.push(person);
    }
    s.stats.peak=Math.max(s.stats.peak,s.villagers.length);
    details=number===1?'One adult settler joined the village.':number+' adult settlers joined the village.';
    details+=' Population: '+s.villagers.length+'.';
    if(c.learning)details+=' Each brought three travel meals.';
    const shortfall=s.villagers.length-shelterPlaces(s);
    if(shortfall>0)details+=` The village is short ${shortfall} sleeping ${shortfall===1?'place':'places'}.`;
  }else if(command==='flood'){
    const lost=Math.min(s.food,s.bankFood||0);
    changeStock(s,'food',-lost);
    s.bankFood=0;s.floodCatchLost=lost;
    if(lost)s.storesUphill=true;
    details=lost?'The river swept away the bank basket with '+lost+' provisions. Fishers will carry future catches uphill.':'The river covered the low bank. The uphill cache stayed dry; no food was lost.';
  }else if(command==='earthquake'){
    const lost=Math.min(s.wood,rule.woodLoss);
    changeStock(s,'wood',-lost);
    for(const v of s.villagers)changeNeed(v,'happiness',-rule.moodLoss,s.config);
    details=t('log.earthquake',{lost,mood:rule.moodLoss});
  }else if(command==='meteor'){
    const now=s.day*s.config.dayMs+s.elapsedMs;
    const previous=s.meteors?.at(-1);
    const x=((previous?.u??(s.seed%997)/997)+.618034)%1;
    const v=((previous?.v??(s.seed%541)/541)+.381966)%1;
    const y=v<.5?.14+v*.32:.70+(v-.5)*.32;
    s.meteors=(s.meteors||[]).filter(hit=>now-hit.time<s.config.dayMs).slice(-31);
    s.meteors.push({u:x,v,x:.08+x*.84,y,time:now});
    const lost=Math.min(s.wood,rule.woodLoss);changeStock(s,'wood',-lost);
    details=`A meteor struck the ${y<.5?'north':'south'} bank and burned ${lost} wood.`;
    if(scene){
      const hit=s.meteors.at(-1);
      const target=scene.sites.map(h=>({...h,d:Math.hypot((h.x-hit.x)*scene.width,(h.y-hit.y)*scene.height-10)})).filter(h=>h.d<40).sort((a,b)=>a.d-b.d)[0];
      if(target){
        const px=target.x*scene.width,py=target.y*scene.height;
        const helpers=scene.walkers.filter(p=>p.side===scene.bankAt(px,py)&&Math.hypot(p.x-px,p.y-py)<650).sort((a,b)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py)).slice(0,3);
        const start=now+2800;
        s.hutFires=(s.hutFires||[]).filter(f=>f.slot!==target.slot);
        s.hutFires.push({slot:target.slot,x:target.x,y:target.y,start,end:start+(helpers.length?15000:22000),helpers:helpers.map(p=>p.id)});
        details+=' Sparks are falling on the shelter!';
      }
    }
  }else if(command==='volcano'){
    const lost=Math.min(s.food,rule.foodLoss);changeStock(s,'food',-lost);
    const plots=s.farming.plots.filter(p=>p!==null).length;s.farming.plots.fill(null);
    if(s.farming.wheatRemaining)s.farming.wheatRemaining={};
    details=`The volcano erupted. Ash spoiled ${lost} provisions${plots?' and buried '+plots+' planted plots':''}.`;
  }else if(command==='earth crack'){
    const bridgeWork=Math.max(0,(s.settlementWork||0)-(c.settlement?.shelterWork||0));
    const damaged=Math.min(bridgeWork,rule.bridgeLoss);
    if(damaged)s.settlementWork-=damaged;
    const lost=Math.min(s.wood,rule.woodLoss);changeStock(s,'wood',-lost);
    details=`The ground split at the ford. ${lost} wood fell in${damaged?' and part of the bridge collapsed':''}.`;
  }else if(command==='godzilla'){
    const defenders=s.villagers.filter(v=>v.age>=c.life.adult&&!v.illnessDays&&v.traits.includes('Brave')&&huntingWeapons.includes(v.gear));
    s.godzillaDefenders=defenders.map(v=>v.id);
    const atRisk=Math.min(s.food,rule.foodLoss);
    const saved=Math.min(atRisk,defenders.length*3);
    const lost=atRisk-saved;changeStock(s,'food',-lost);
    if(c.hunting)s.gameAnimals=0;
    for(const v of s.villagers)v.reaction=s.godzillaDefenders.includes(v.id)?'Defending the camp':'Frightened';
    details=`Godzilla trampled ${lost} provisions${c.hunting?' and scattered the hares':''}. `;
    details+=defenders.length?`${defenders.map(v=>v.name).join(', ')} stood against him, saving ${saved} provisions.`:'The villagers ran for cover.';
    if(defenders.length){
      const fighter=defenders[(s.castCount||0)%defenders.length];
      fighter.health=Math.max(1,fighter.health-12);
      details+=` A tail swipe bruised ${fighter.name}.`;
    }
    const shelterWork=c.settlement?.shelterWork||0;
    if(s.settlementWork>shelterWork){
      s.settlementWork-=Math.min(s.settlementWork-shelterWork,Math.max(1,5-defenders.length));
      details+=' He tore planks from the footbridge.';
    }else if(s.huts?.length){
      s.huts.pop();
      if(s.hutFires)s.hutFires=s.hutFires.filter(f=>f.slot<s.huts.length);
      if(s.hutDetails)s.hutDetails.length=s.huts.length;
      details+=' He flattened a sleeping hut.';
    }else if(s.pottery?.kiln){
      s.pottery.kiln=false;
      details+=' He crushed the clay kiln.';
    }else if(s.settlementWork>0){
      s.settlementWork=Math.max(0,s.settlementWork-Math.max(1,4-defenders.length));
      details+=' He knocked down part of the lean-to.';
    }
  }else if (command === 'rain' || command === 'drought') {
    s.weather = { type: command, daysLeft: rule.duration - (instant ? 1 : 0) };
    if (instant) s.liveWeather = {day:s.day, type:command};
    details = t('log.weather', {command:commandLabel(command),duration:rule.duration,effect:t('log.'+command)});
  } else if (command === 'plague') {
    for (const v of s.villagers) { v.illnessDays = rule.duration; v.reaction = 'Sick'; }
    details = t('log.plague', {duration:rule.duration});
  } else if (command === 'bless') {
    details = s.villagers.map(v => {
      const h = v.health, happy = v.happiness;
      changeNeed(v, 'health', rule.health, c); changeNeed(v, 'happiness', rule.happiness, c);
      v.reaction = 'Grateful';
      return t('log.blessPerson', {name:v.name,health:v.health-h,happiness:v.happiness-happy});
    }).join(t('labels.separators.detail')) + t('log.blessEnd');
  } else if (command === 'harvest') {
    const before = s.food; changeStock(s, 'food', rule.food);
    details = t('log.harvest', {food:s.food-before});
  } else if (command === 'teach fire') {
    s.fireKnown = true; s.fireCounter = 0; s.wood -= c.fire.discoveryCost; s.stats.fireDay = s.day;
    if (instant && s.wood >= c.fire.dailyFuel) { s.fireLit = true; s.wood -= c.fire.dailyFuel; }
    for (const v of s.villagers) v.reaction = 'Learned fire';
    details = t('log.teach', {wood:c.fire.discoveryCost});
  } else if (command === 'heal') {
    for (const v of s.villagers) if (v.illnessDays) { v.illnessDays = 0; if (instant) v.illToday = false; v.reaction = 'Cured'; }
    details = t('log.heal');
  } else if (command === 'teach farming') {
    unlockFarming(s);
    details = t('log.sow', {plots:c.farming.plots});
  }
  log(s, c.power ? t('log.command', {command:commandLabel(command),cost:rule.cost,details}) : details, 'command');
  if(['spawn people','earthquake','flood','meteor','volcano','earth crack','godzilla'].includes(command))report.command.effect=details;
}

// The daily priority list for one Gourdling. Pure: returns an action name.
// useTraits=false gives the plain v0.1/v0.2 choice, used to log trait effects.
function chooseAction(s, v, weather, n, die, useTraits) {
  const c = s.config, N = c.needs, P = c.personality, has = tr => useTraits && hasTrait(s, v, tr);
  if(c.learning){
    const motive=assessNeeds(s,v);
    if(motive.need==='warmth')return 'warm';
    if(motive.need==='recovery'||motive.need==='energy')return 'rest';
    if(motive.need==='food')return s.farming.known&&ripePlot(s)>=0?'harvest':'forage';
    if(motive.need==='fuel')return 'wood';
    if(motive.need==='belonging')return 'rest';
    if(motive.level>=2&&coldOmen(s,v)&&s.wood<fuelTarget(s)+2)return 'wood';
    if(motive.need==='provisions'&&(!s.farming.known||ripePlot(s)<0))return 'forage';
  }
  if(c.learning && s.farming.known && ripePlot(s)>=0 &&
    v.fullness<N.emergencyFullness && s.food<N.mealCost)return 'harvest';
  if (v.fullness < N.emergencyFullness && s.food < N.mealCost) return 'forage';
  let warmBelow = N.warmUpBelow;
  if (weather === 'rain' || weather === 'cold') {
    if (has('Brave')) warmBelow = P.braveWarmUpBelow;
    else if (has('Timid')) warmBelow = P.timidWarmUpBelow;
  }
  if (v.warmth < warmBelow) return 'warm';
  if(c.settlement&&(!c.learning||s.settlementWork>=c.settlement.shelterWork||s.hutProject||s.huts?.length)&&
    (s.hutProject||s.hutDetails?.some(h=>h?.ruined)||n>shelterPlaces(s)||crowdedCamp(s,v.tribe||0)||shouldPlanHut(s))&&v.age>=c.life.adult&&!v.illnessDays&&
    (c.learning?s.food>=mainFoodRequired(s,v.tribe||0,2,0):s.food>=n*c.needs.mealCost)){
    const site=hutBuildingSite(s,v).site;
    if(!c.learning||buildingSiteTree(s,site)===null||canFellBuildingTree(s,v))
      return s.wood>c.settlement.fuelReserve?'hut':'wood';
  }
  if (has('Scatterbrained') && die <= P.scatterbrained.chance)
    return die <= P.scatterbrained.forageUpTo ? 'forage' : die <= P.scatterbrained.woodUpTo ? 'wood' : 'rest';
  const v02 = isV02(s), F = c.farming;
  if (v02 && ripePlot(s)>=0) return 'harvest';
  // Established growers keep fields in use while there is food for supper and
  // seed. Waiting for the full foraging target can leave every plot empty.
  if (v02 && c.learning && s.local.season!=='Winter' && s.farming.known &&
    v.age>=c.life.adult && !v.illnessDays && s.farming.plots.includes(null) &&
    s.food>=F.plantCost&&s.food-F.plantCost>=mainFoodRequired(s,v.tribe||0,1,0)) return 'plant';
  const foodTarget = c.work.foodTargetPerPerson * n, woodTarget = fuelTarget(s, n), smart = has('Smart');
  if (smart) {
    // Compare each stock's gap as a share of its target; provisions win a tie.
    const foodGap = s.food < foodTarget ? (foodTarget - s.food) / foodTarget : 0;
    const woodGap = s.wood < woodTarget ? (woodTarget - s.wood) / woodTarget : 0;
    if (foodGap > 0 || woodGap > 0) return foodGap >= woodGap ? 'forage' : 'wood';
  } else if (s.food < foodTarget) return 'forage';
  if (v02 && s.local?.season!=='Winter' && s.farming.known && v.age >= c.life.adult && s.farming.plots.includes(null)
    && (c.learning?s.food>=F.plantCost&&s.food-F.plantCost>=mainFoodRequired(s,v.tribe||0,1,0):s.food >= F.plantFoodPerPerson * n + F.plantExtraFood)) return 'plant';
  if (!smart && s.wood < woodTarget) return 'wood';
  const project=c.settlement;
  if(project&&v.age>=c.life.adult&&!v.illnessDays){
    const built=s.settlementWork||0;
    if(built<project.shelterWork+project.bridgeWork){
      if(s.wood<=project.fuelReserve)return 'wood';
      return built<project.shelterWork?'shelter':'bridge';
    }
  }
  return 'rest';
}
const ACTIVITY = { hut:'Build hut',hunt:'Hunt',forage: 'Forage', warm: 'Warm up', wood: 'Gather wood', harvest: 'Harvest', plant: 'Plant', rest: 'Rest', shelter:'Build shelter',bridge:'Build bridge' };
const actionWord = action => t('traitLog.actions.'+action);
const stoneTools=[
  {name:'hammer stone',wood:0,use:'The camp can shape other stone tools.'},
  {name:'stone blades',wood:0,use:'Hunters can recover more food from each hare.'},
  {name:'digging stick',wood:1,use:'Foragers can dig up edible roots.'},
  {name:'hand axe',wood:1,use:'Wood gatherers can bring back more firewood.'},
  {name:'mallet & chisel',wood:2,use:'Builders can fit timbers faster.'}
];
function nextStoneTool(s){
  return stoneTools.find(tool=>!s.toolkit?.includes(tool.name));
}
const heatTools=[
  {name:'fire stick',wood:2,use:'The camp can kindle its hearth.'},
  {name:'bow drill',wood:2,use:'The camp can rekindle a cold hearth even in the rain.'},
  {name:'blowpipe',wood:1,use:'Stoked embers give villagers more warmth when they visit the fire.'},
  {name:'wooden tongs',wood:1,use:'Potters can lift a single fired jar from the kiln without waiting for a full batch.'},
  {name:'burn bowl',wood:2,use:'The hollow wooden bowl holds eight extra provisions.'}
];
const textileCrafts=[
  'standard weave basket','coil weave basket','cordage','twining weave basket','drop spindle','loom','sandals'
];
// Cross-craft prerequisites supplement the individual learning rules in practices.js.
// These express material dependencies in this village, not universal historical dates.
function readyToInvent(s,name){
  if(cerealRecipes.some(r=>r[7]===name))return cerealDependencies(s,name);
  if(name==='bone meal')return s.farming.known&&s.toolkit?.includes('hammer stone');
  if(magicRecipes.some(r=>r[7]===name))return magicDependencies(s,name);
  if(name==='healer hut')return s.settlementWork>=s.config.settlement.shelterWork&&
    s.villagers.some(v=>v.practice?.known.housing&&v.practice.known.cordage);
  if(name==='herb drying rack')return s.local.healerHome?.work>=healerBuildingRules.hutWork;
  if(name==='healer marker')return s.local.healerHome?.rackWork>=healerBuildingRules.rackWork;
  if(fishingCrafts.includes(name))return fishingDependencies(s,name);
  switch(name){
    case 'drop spindle':return s.textiles?.includes('cordage');
    case 'loom':return s.textiles?.includes('drop spindle')&&s.toolkit?.includes('mallet & chisel');
    case 'ondol':return s.fireKnown&&s.shelterIdeas?.includes('drystone wall')&&s.shelterIdeas.includes('chimney');
    default:return true;
  }
}
function nextTextileCraft(s,camp=0){
  const candidates=textileCrafts.filter(name=>!s.textiles?.includes(name)&&readyToInvent(s,name));
  return favoredCraft(s,candidates,camp);
}
const huntingWeapons=['sling','bow','spear thrower'];
function migrationTime(herd,position){
  return herd.duration*position+herd.stops.reduce((delay,stop)=>delay+(stop.position<position?stop.pause:0),0);
}
export function animalBehavior(herd,index,fraction){
  const elapsed=fraction-herd.start-index*.008;
  let moving=elapsed;
  for(const stop of herd.stops){
    const arrival=herd.duration*stop.position;
    if(moving<arrival)break;
    if(moving<arrival+stop.pause){
      return {position:stop.position,state:moving-arrival>stop.pause*.77?'alert':'feeding'};
    }
    moving-=stop.pause;
  }
  return {position:moving/herd.duration,state:'walking'};
}
function passingWildlife(s){
  if(!s.local||s.lastUsed.godzilla>=s.day-1)return null;
  let roll=(Math.imul(s.day,2654435761)^Math.imul(s.seed+1,1597334677))>>>0;
  const random=()=>((roll=Math.imul(1664525,roll)+1013904223>>>0)/4294967296);
  if(random()>.52)return null;
  const species=random()<.45?'deer':'hare';
  return {species,count:1+Math.floor(random()*3),east:random()<.5,
    y:(random()<.65?120:440)+random()*90,start:.015+random()*.035,
    width:3000,origin:-1000,duration:.32+random()*.06,
    stops:[.20,.42,.60,.80].map(n=>({position:n+random()*.055,pause:(species==='deer'?.045:.025)+random()*.025})),attempts:[]};
}

function planWildlifeHunts(s,herd,adults,report,busy){
  if(!herd)return;
  for(const v of adults){
    if(s.config.learning){const motive=assessNeeds(s,v);if(motive.level===0&&motive.need!=='food')continue;}
    if(busy.has(v.id)||(v.huntWear||0)>=6||!huntingWeapons.includes(v.gear)||v.warmth<35||v.practice.energy<30||s.food>=foodCapacity(s))continue;
    const [cx,cy]=report.fieldCamp?.members.includes(v.id)?report.fieldCamp.site:campSites[v.tribe||0];
    const distance=Math.abs(cy-herd.y);
    if(distance>82||herd.attempts.length>=herd.count)continue;
    const animal=herd.attempts.length;
    const x=cx+(herd.east?1:-1)*22;
    const along=(x-herd.origin)/herd.width;
    const position=herd.east?along:1-along;
    const firstSight=position-Math.sqrt(82**2-distance**2)/herd.width;
    const stop=herd.stops.find(stop=>stop.position>=firstSight&&stop.position<=position);
    const departure=stop?stop.position:position;
    const encounter=herd.start+migrationTime(herd,departure)+(stop?stop.pause*.77:0)+animal*.008;
    const sight=herd.start+migrationTime(herd,firstSight)+animal*.008;
    const speed=430+(v.practice.energy*5)+(s.textiles?.includes('sandals')?110:0);
    const reach=v.gear==='bow'?42:30;
    const targetX=herd.origin+herd.width*(herd.east?departure:1-departure);
    const travel=Math.max(0,Math.hypot(targetX-cx,distance)-reach)/speed;
    const success=travel<=encounter-sight;
    herd.attempts.push({id:v.id,animal,sight,encounter,x:targetX,success});
    busy.add(v.id);
    v.huntWear=(v.huntWear||0)+1;
    v.activity='Track '+herd.species;
    const before=s.food;
    if(success){
      changeStock(s,'food',(herd.species==='deer'?8:3)+Number(!!s.toolkit?.includes('stone blades')));
      if(s.local)s.local.stock.bone=(s.local.stock.bone||0)+1;
    }
    v.gained=s.food-before;report.gatheredFood+=v.gained;
    finishOrdinaryWork(s,v,'hunt');
    report.actions.push({id:v.id,action:v.activity,gained:v.gained});
    settlementEvent(s,v.name+(success?' caught a passing ':' lost sight of a passing ')+herd.species+'.');
  }
}
export function inventionProgress(s){
  const rules=s.config.settlement;
  const catalog=[
    ...stoneTools.map(t=>[t.name,s.toolkit?.includes(t.name)]),
    ...heatTools.map(t=>[t.name,s.fireTools?.includes(t.name)]),
    ...textileCrafts.map(t=>[t,s.textiles?.includes(t)]),
    ...[...wallTypes,...hutTypes,'chimney','ondol'].map(t=>[t,s.shelterIdeas?.includes(t)]),
    ...availablePractices(s).map(r=>[r.name,s.local.first[r.id]!==undefined||s.villagers.some(v=>v.practice?.known[r.id])]),
    ...huntingWeapons.map(t=>[t,s.villagers.some(v=>v.gear===t)]),
    ...fishingCrafts.map(item=>[item,s.villagers.some(v=>item==='fish trap'?v.fishTrap||v.practice?.gear[item]:v.practice?.gear[item])]),['controlled fire',s.fireKnown],
    ['farming',s.farming.known],['communal shelter',s.settlementWork>=rules.shelterWork],
    ['footbridge',s.settlementWork>=rules.shelterWork+rules.bridgeWork],['plank shed',s.shed.built],
    ['camp kiln',s.pottery?.kiln]
  ];
  const history=new Set(s.local.inventions||[]);
  const known=catalog.filter(([name,achieved])=>achieved||history.has(name)).map(([name])=>name);
  return {known,total:catalog.length,missing:catalog.map(([name])=>name).filter(name=>!known.includes(name))};
}
function nextHeatTool(s){return heatTools.find(tool=>!s.fireTools?.includes(tool.name));}

// Short afternoon chores use the village's discoveries between work and supper.
const weeklyChores={
  'hammer stone':['Crack nuts','berries'], 'stone blades':['Cut roots for supper','berries'],
  'digging stick':['Dig edible roots','berries'], 'hand axe':['Split firewood','wood'],
  'mallet & chisel':['Fit a timber joint','wood'], 'fire stick':['Light tinder','wood'],
  'bow drill':['Kindle a cooking fire','wood'], blowpipe:['Stoke the embers','wood'],
  'wooden tongs':['Turn coals with tongs','wood'], 'burn bowl':['Serve food in a bowl','berries'],
  'standard weave basket':['Carry berries','berries'], 'coil weave basket':['Sort nuts','berries'],
  'twining weave basket':['Carry reeds','fibre'], cordage:['Bind a bundle','fibre'],
  'drop spindle':['Spin fibre','fibre'], loom:['Weave a strip of cloth','fibre'],
  sandals:['Walk the gathering trail','berries'], sling:['Practice sling aim','stone'],
  bow:['Practice bow aim','hide'], 'spear thrower':['Practice a throw','hide'],
  'fish trap':['Check the fish trap','fish'], 'controlled fire':['Tend the hearth','wood'],
  'fishing spear':['Practice spearing fish','fish'],'hook and line':['Check the handline','fish'],
  'fishing pole':['Fish with a wooden pole','fish'],'fishing net':['Check the fishing net','fish'],
  farming:['Tend the field','berries'], 'footbridge':['Carry supplies across the ford','wood'],
  'plank shed':['Stack supplies under cover','wood'], 'communal shelter':['Prepare sleeping places','hide'],
  'camp kiln':['Tend the pottery kiln','clay'], chimney:['Clear the chimney','wood'],ondol:['Tend the heated floor','wood']
};
const techniqueChores={
  bonemeal:'Inspect treated soil',
  herbalism:'Practice preparing plant remedies',
  fishtraps:'Practice weaving a funnel trap',fishspears:'Sharpen a wooden fishing spear',
  angling:'Carve a bone hook',fishingpoles:'Fit a fixed fishing line',fishnets:'Mend a fibre fishing net',
  knapping:'Retouch a cutting edge',cordage:'Twist a length of cord',hafting:'Refit a tool handle',
  baskets:'Weave a basket rim',housing:'Line a sleeping place',drying:'Lay food out to dry',
  shaping:'Shape a clay cup',pottery:'Practice forming a storage jar',charcoal:'Bank wood for charcoal',
  kilns:'Adjust the kiln draft'
};
function weeklyWork(s,report){
  const history=s.local.weeklyUses??={};
  const known=inventionProgress(s).known;
  const people=s.villagers.filter(v=>assessNeeds(s,v).level>0&&v.age>=s.config.life.adult&&!v.illnessDays&&!v.campJourney&&!report.daughter?.members.includes(v.id)&&!report.fieldCamp?.members.includes(v.id)&&!report.outing?.members.includes(v.id)&&!v.herbalist?.home&&!v.activity.startsWith('Care for '));
  if(!people.length)return;
  const sessions=report.weeklyWork=[];
  const recipes=Object.values(practices);
  const due=s.local.nextPractice??={};
  for(const [i,item] of known.entries()){
    const previous=history[item];
    due[item]??=s.day+i%7;
    if(previous?s.day-previous.day<7:s.day<due[item])continue;
    const recipe=recipes.find(r=>r.name===item);
    if(recipe?.magic)continue; // Rites have real costs; no free weekly casts or proficiency.
    const eligible=people.filter(v=>recipe?v.practice.known[recipe.id]:
      huntingWeapons.includes(item)?v.gear===item&&(v.huntWear||0)<6:fishingCrafts.includes(item)?
        item==='fish trap'?v.fishTrap||v.practice.gear[item]:v.practice.gear[item]:item==='hand axe'?(v.axeWear||0)<4:true);
    if(!eligible.length)continue;
    const activeCount=v=>sessions.filter(task=>task.id===v.id).length;
    eligible.sort((a,b)=>activeCount(a)-activeCount(b));
    const worker=eligible[0];
    let [action,skill]=recipe?[techniqueChores[recipe.id],recipe.skill]:
      weeklyChores[item]||[wallTypes.includes(item)?'Repair a wall section':'Fit shelter poles',wallTypes.includes(item)?'stone':'wood'];
    if(fishingCrafts.includes(item)&&(valleySeason(s).frozen||s.lastUsed.flood>=s.day-1))action='Maintain '+item;
    let result='practiced '+skill+' work';
    if(['Crack nuts','Cut roots for supper','Dig edible roots','Carry berries','Check the fish trap','Practice spearing fish','Check the handline','Fish with a wooden pole','Check the fishing net'].includes(action)){
      const source=fishingCrafts.includes(item)?'fish':'berries';
      const qty=Math.min(1,Math.max(0,foodCapacity(s)-s.food),Math.floor(s.local.deposits[source]));
      if(qty){s.food+=takeDeposit(s,source,qty);report.gatheredFood+=qty;result='stored one provision';}
      else if(source==='fish')result='checked the trap';
    }else if(recipe?.id==='drying'&&s.food>s.local.dried){
      s.local.dried++;result='preserved one provision';
    }else if(item==='hand axe'&&s.wood<s.config.limits.stock&&s.local.deposits.wood>=1){
      s.wood+=takeDeposit(s,'wood',1);report.gatheredWood++;result='stacked one firewood';
    }
    worker.practice.skills[skill]=Math.min(30,(worker.practice.skills[skill]||0)+1);
    if(recipe)worker.practice.used[recipe.id]=(worker.practice.used[recipe.id]||0)+1;
    const task={id:worker.id,name:worker.name,day:s.day,item,action,skill,result};
    history[item]=task;sessions.push(task);
  }
}

function doWork(s, v, action, report, fishingMethodOverride) {
  const c = s.config, n = c.needs;
  v.activity = ACTIVITY[action]; v.gained = 0;
  if(action==='seed trial'){
    v.activity='Sow wild seeds';
    s.food--;s.local.seedTrial={day:s.day,growth:0};
    settlementEvent(s,v.name+' buried saved seeds in a small patch of bare ground.');
  }else if(action==='explore'){
    v.activity='Scout upriver';
    if(report.outing.packedMeals)v.travelMeals-=2;
    else s.food-=2;
    s.local.scouting=(s.local.scouting||0)+1;
    settlementEvent(s,v.name+' set out. '+report.outing.reason);
    if(s.local.scouting>=3){
      s.local.reaches=(s.local.reaches||0)+1;s.local.scouting=0;s.local.surplusDays=0;
      (s.local.wildPatches??=[]).push(18);
      v.rememberedPatch=s.local.reaches-1;
      report.discovery=v.name+' charted new gathering grounds in the valley.';
      settlementEvent(s,report.discovery);
    }
  }else if(action==='Gather fibre'){
    v.activity=action;
    const cut=s.textiles?.includes('drop spindle')?3:2;
    s.fibre=(s.fibre||0)+(c.learning?takeDeposit(s,'fibre',cut):cut);
  }else if(action==='weave'){
    const craft=nextTextileCraft(s,v.tribe||0);
    s.fibre-=2;
    if(craft==='loom')s.wood-=2;
    (s.textiles??=[]).push(craft);
    v.activity='Craft '+craft;
    report.discovery=v.name+' discovered '+craft+'.';
    log(s,report.discovery,'discovery');
  }else if(['Gather clay','Shape jar','Fire jar','Build kiln'].includes(action)){
    const workshop=s.pottery;
    v.activity=action;
    if(action==='Gather clay')workshop.clay+=c.learning?takeDeposit(s,'clay',2):2;
    if(action==='Shape jar'){workshop.clay--;workshop.unfired++;}
    if(action==='Fire jar'){
      const batch=workshop.kiln?workshop.unfired:1;
      workshop.unfired-=batch;workshop.jars+=batch;s.wood--;
      v.spareJars=(v.spareJars||0)+batch;
      if(workshop.jars===1)report.discovery=`${v.name} fired the camp’s first storage jar. It holds 12 provisions.`;
    }
    if(action==='Build kiln'){
      workshop.clay-=2;s.wood-=2;workshop.kiln=true;
      report.discovery=`${v.name} built a clay kiln. The camp can now fire two jars together.`;
    }
    if(report.discovery&&(action==='Fire jar'||action==='Build kiln'))log(s,report.discovery,'discovery');
  }else if(action==='reeds'){
    if(c.learning)s.local.stock.fibre+=takeDeposit(s,'fibre',1);
    v.reedBundle=true;
    v.activity='Gather reeds';
    if(!s.pottery){
      s.pottery={clay:0,unfired:0,jars:0,kiln:false};
      report.discovery=`${v.name} noticed that the clay beneath the reeds held a thumbprint.`;
      log(s,report.discovery,'discovery');
    }
  }else if(action==='trap'){
    if(!c.learning||readyToInvent(s,'fish trap')&&makePracticeProduct(s,v,'fishtraps')){
      delete v.reedBundle;v.fishTrap=true;v.activity='Weave trap';
      log(s,`${v.name} wove flexible shoots and bark ties into a funnel fish trap.`,'discovery');
    }else v.activity='Prepare trap materials';
  }else if(action==='fish'){
    v.activity='Fish';
    const before=s.food;
    const method=fishingMethodOverride||fishingMethod(v,s.day)||'trap';
    const base={spear:2,line:2,pole:3,trap:4,net:5}[method];
    const catchSize=Math.max(1,base-(report.weather==='drought'?2:0))+Number((v.practice?.skills.fish||0)>=3);
    changeStock(s,'food',c.learning?takeDeposit(s,'fish',catchSize):catchSize);
    v.gained=s.food-before;report.gatheredFood+=v.gained;
    (report.fishing??={})[v.id]={method,caught:v.gained};
    if(!s.storesUphill)s.bankFood=Math.min(8,(s.bankFood||0)+v.gained);
  }else if(action==='invent'||action==='invent heat tool'){
    const heat=action==='invent heat tool';
    const tool=heat?nextHeatTool(s):nextStoneTool(s);
    s.wood-=tool.wood;
    const collection=heat?'fireTools':'toolkit';
    (s[collection]??=[]).push(tool.name);
    if(tool.name==='fire stick'&&!s.fireKnown){
      s.fireKnown=true;s.fireCounter=0;s.stats.fireDay=s.day;
      report.discoveredFire=true;
    }
    v.activity='Craft '+tool.name;
    report.discovery=`${v.name} discovered how to use ${tool.name==='stone blades'?'stone blades':'the '+tool.name}. ${tool.use}`;
    log(s,report.discovery,'discovery');
  }else if(action==='craft'){
    const counts=huntingWeapons.map(name=>s.villagers.filter(person=>person.gear===name).length);
    v.gear=favoredCraft(s,huntingWeapons.filter((name,i)=>counts[i]===Math.min(...counts)),v.tribe||0);
    s.wood-=2;
    v.activity='Craft '+v.gear;
    log(s,`${v.name} made a ${v.gear} at camp.`,'discovery');
  }else if(action==='hunt'){
    s.gameAnimals--;v.huntWear=(v.huntWear||0)+1;
    const prepared=!!(v.practice?.gear['cutting tool']||s.toolkit?.includes('stone blades'));
    const before=s.food;changeStock(s,'food',c.hunting.provisions+Number(huntingWeapons.includes(v.gear))+Number(prepared));
    v.gained=s.food-before;report.gatheredFood+=v.gained;
    if(s.local)s.local.stock.bone=(s.local.stock.bone||0)+1;
  }else if (action === 'forage') {
    const yields = v.age < c.life.adult ? c.work.childFood : c.work.adultFood;
    let yieldAmount=yields[report.weather]+Number(v.gear==='digging stick'||!!s.toolkit?.includes('digging stick'));
    if(c.learning){
      yieldAmount+=Number(!!v.practice.gear['cutting tool']);
      const limit=v.practice.gear.basket?6:3;
      if(Math.min(yieldAmount+1,s.local.deposits.berries)>limit)v.practice.limitedTrips++;
      const patch=s.local.wildPatches?.findIndex(q=>q>=1)??-1;
      if(patch>=0&&(s.local.deposits.berries<1||v.id%3===0)){
        yieldAmount=Math.min(s.local.wildPatches[patch],limit,yieldAmount+1);
        s.local.wildPatches[patch]-=yieldAmount;
        (report.foragingPatches??={})[v.id]=patch;
      }else yieldAmount=takeDeposit(s,'berries',Math.min(limit,yieldAmount+1));
    }
    const before=s.food;changeStock(s,'food',yieldAmount);
    v.gained = s.food - before; report.gatheredFood += v.gained;
    if(s.local&&v.gained>0){s.local.seedFinds=(s.local.seedFinds||0)+1;gatherWildWheat(s,v,report);}
  } else if (action === 'warm') {
    const before = v.warmth;
    const stoked=s.fireTools?.includes('blowpipe')?4:0;
    changeNeed(v, 'warmth', campFireLit(s,v.tribe) ? n.warmUpWithFire+stoked : n.warmUp, c);
    v.gained = v.warmth - before;
  } else if (action === 'wood') {
    const before = s.wood;
    const axe=v.gear==='hand axe'||s.toolkit?.includes('hand axe')||v.practice?.gear['hafted tool'];
    const adult=v.age>=c.life.adult;
    const tree=c.learning&&adult&&axe&&(v.axeWear||0)<4&&s.wood<c.limits.stock?fellTree(s,v):null;
    let woodYield=adult?c.work.adultWood:c.work.childWood;
    if(tree!==null){
      v.axeWear=(v.axeWear||0)+1;
      if(v.axeWear===4)settlementEvent(s,v.name+' stopped using a damaged axe.');
      (report.felledTrees??={})[v.id]=tree;
      woodYield+=v.practice.gear['hafted tool']?4:2;
    }else if(c.learning)woodYield=takeDeposit(s,'wood',woodYield);
    changeStock(s,'wood',woodYield);
    v.gained = s.wood - before; report.gatheredWood += v.gained;
  } else if (action === 'harvest') {
    const plot=ripePlot(s);
    const wheat=s.farming.crops?.[plot]==='wheat';
    const remaining=s.farming.wheatRemaining?.[plot];
    const bonus=wheat&&remaining!==undefined?0:boneHarvestBonus(s,plot);s.farming.plots[plot]=null;
    const before = s.food;
    if(wheat){
      const total=remaining??wheatRules.harvest+bonus;
      const amount=Math.max(0,Math.min(total,grainCapacity(s)-s.local.stock.wheat));
      s.farming.wheatRemaining??={};
      if(amount<total){s.farming.wheatRemaining[plot]=total-amount;s.farming.plots[plot]=wheatRules.ripeAt;}
      else delete s.farming.wheatRemaining[plot];
      s.local.stock.wheat+=amount;s.farming.wheatHarvests=(s.farming.wheatHarvests||0)+1;
      (report.wheatHarvests??=[]).push({id:v.id,plot,grain:amount});
      v.activity='Harvest wheat';
    }else changeStock(s, 'food', c.farming.harvestFood+bonus);
    if(bonus)(report.boneFertilizerHarvests??=[]).push({id:v.id,plot,bonus});
    if(s.local)s.local.harvests=(s.local.harvests||0)+1;
    v.gained = s.food - before; report.gatheredFood += v.gained; report.harvests += 1;
  } else if(action==='improve hut'){
    const idea=nextHutImprovement(s,v.tribe||0);
    const heating=idea==='chimney'||idea==='ondol';
    const i=heating?s.huts.findIndex((_,i)=>!s.hutDetails?.[i]?.[idea]):(s.shelterIdeas?.length||0)%s.huts.length;
    s.hutDetails??=[];
    const detail=s.hutDetails[i]??={wall:wallTypes[0],shape:hutTypes[0]};
    if(heating)detail[idea]=true;
    else if(wallTypes.includes(idea))detail.wall=idea;
    else detail.shape=idea;
    s.wood-=2;
    v.activity='Build '+idea;
    report.hutSites??={};
    report.hutSites[v.id]={camp:s.huts[i],index:s.huts.slice(0,i).filter(camp=>camp===s.huts[i]).length};
    learnShelter(s,v,idea,report);
  } else if(action==='hut'){
    const {camp,index,repairSlot,site}=hutBuildingSite(s,v);
    s.hutProject??={camp,index,work:0};
    s.hutProject.camp=camp;
    if(repairSlot>=0)s.hutProject.repairSlot=repairSlot;
    s.hutProject.index??=index;
    if(c.learning&&buildingSiteTree(s,site)!==null){
      if(clearBuildingTree(s,v,s.hutProject,site,report)){
        v.activity='Clear hut site';
        report.actions.push({id:v.id,action:v.activity,site,gained:v.gained});
      }
      return;
    }
    s.wood--;s.hutProject.work+=(s.toolkit?.includes('mallet & chisel')?2:1)+Number(!!v.practice?.gear['lined bed']);
    report.hutSites??={};
    report.hutSites[v.id]={camp,index};
    if(s.hutProject.work>=c.settlement.shelterWork){
      const ruin=s.hutProject.repairSlot??-1;
      if(ruin>=0){s.hutDetails[ruin].ruined=false;s.hutDetails[ruin].scorched=false;s.hutProject=null;log(s,'A burned hut has been rebuilt.','discovery');}
      else{
      const clearedTrees=s.hutProject.clearedTrees||[];
      s.huts??=[];s.huts.push(s.hutProject.camp);s.hutProject=null;
      const camp=s.huts.at(-1);
      const wall=favoredCraft(s,wallTypes,camp);
      const shape=favoredCraft(s,hutTypes,camp);
      (s.hutDetails??=[])[s.huts.length-1]={wall,shape,clearedTrees};
      learnShelter(s,v,wall,report);
      learnShelter(s,v,shape,report);
      log(s,`The villagers finished a hut with ${c.settlement.bedsPerHut} sleeping places.`,'discovery');
      }
    }
  } else if (action==='shelter'||action==='bridge'){
    s.wood-=1;
    const {shelterWork,bridgeWork}=c.settlement;
    const finish=action==='shelter'?shelterWork:shelterWork+bridgeWork;
    s.settlementWork=Math.min(finish,(s.settlementWork||0)+(s.toolkit?.includes('mallet & chisel')?2:1));
    if(s.settlementWork===shelterWork)log(s,'The village finished a communal lean-to. It keeps the camp warmer.','discovery');
    if(s.settlementWork===shelterWork+bridgeWork)log(s,'The village finished a footbridge across the ford.','discovery');
  } else if (action === 'plant') {
    const plot=s.farming.plots.indexOf(null);s.farming.plots[plot]=0;
    if(c.learning&&v.practice.known.wheatgrowing&&s.local.stock.wheat>=1){
      s.local.stock.wheat--;s.farming.crops[plot]='wheat';v.activity='Sow wheat';
      v.practice.used.wheatgrowing=(v.practice.used.wheatgrowing||0)+1;
      s.local.first.wheatSown??=s.day;
    }else{if(s.farming.crops)delete s.farming.crops[plot];s.food-=c.farming.plantCost;}
    report.plantings += 1;
  }
  report.actions.push({ id: v.id, action: v.activity, gained: v.gained });
}

function planStandingStones(s, adults, report) {
  const crew = new Set();
  if (!s.local || s.local.lastUnknownDay === undefined || s.firstSignDay === undefined) return crew;
  const willing = adults.filter(v => v.fullness >= 40 && v.warmth >= 35 && v.health >= 45);
  let project = s.local.standingStones;
  if (!project) {
    const founder = willing.find(v => v.conviction >= 4 && s.shrines?.[v.tribe || 0]);
    if (!founder) return crew;
    founder.shrineVisits = (founder.shrineVisits || 0) + 1;
    if (founder.shrineVisits < 2) return crew;
    project = s.local.standingStones = {camp: founder.tribe || 0, raised: 0, work: 0};
    founder.stoneIdea = 'I want to raise a stone where we remember the sign.';
    settlementEvent(s, founder.name + ' proposed raising a stone at the shrine.');
  }
  if (project.raised >= 5) return crew;
  const supporters = willing.filter(v => v.stoneIdea);
  const speaker = supporters[0];
  if (speaker) {
    const listener = willing.find(v => !v.stoneIdea && (v.conviction >= 4 || v.traits.includes('Sociable')) &&
      (v.tribe === speaker.tribe || s.day % 3 === 0));
    if (listener) {
      listener.stoneIdea = 'I want to help raise the stones after talking with ' + speaker.name + '.';
      settlementEvent(s, listener.name + ' agreed to help ' + speaker.name + ' with the stones.');
    }
  } else if (!s.villagers.some(v => v.stoneIdea)) {
    const successor = willing.find(v => v.conviction >= 4 && (v.tribe || 0) === project.camp);
    if (successor) successor.stoneIdea = 'I want to finish the stones our camp began.';
  }
  if (supporters.length < 2 || s.food < s.villagers.length * 2 || s.local.season === 'Winter') return crew;
  const partner = supporters.find(v => v.tribe !== speaker.tribe) || supporters[1];
  if (project.raised && partner.tribe === speaker.tribe) return crew;
  if (project.work === 0) {
    if (s.wood < 3 || s.local.deposits.stone < 1) return crew;
    s.wood -= 2;
    s.local.deposits.stone -= 1;
  }
  report.stoneWork = {...project};
  for (const v of [speaker, partner]) {
    crew.add(v.id);
    v.activity = project.work < 4 ? 'Haul standing stone' : 'Raise standing stone';
    v.gained = 0;
    report.actions.push({id:v.id, action:v.activity, gained:0});
  }
  if (++project.work === 6) {
    project.work = 0;
    project.raised++;
    settlementEvent(s, project.raised === 5 ? 'The camps finished their circle of five standing stones.' :
      speaker.name + ' and ' + partner.name + ' raised standing stone ' + project.raised + '.');
  }
  return crew;
}

function rememberHelp(person,helper){
  if(helper.id===person.id)return;
  person.favors??={};
  person.favors[helper.id]=Math.min(12,(person.favors[helper.id]||0)+1);
}
function trustedPartner(person,options){
  return options.slice().sort((a,b)=>(person.favors?.[b.id]||0)-(person.favors?.[a.id]||0))[0];
}
function campVisits(s,adults,busy,report){
  if(!s.local)return;
  const available=()=>adults.filter(v=>!busy.has(v.id)&&assessNeeds(s,v).level>0&&v.fullness>=35&&v.warmth>=30);
  const assign=(v,action,site)=>{
    busy.add(v.id);v.activity=action;v.gained=0;
    report.actions.push({id:v.id,action,site,gained:0});
  };
  for(const owner of available().filter(v=>v.axeWear>=4)){
    if(busy.has(owner.id))continue;
    const smith=trustedPartner(owner,available().filter(v=>v.tribe===owner.tribe&&
      (v.practice.known.cordage||s.textiles?.includes('cordage')||s.toolkit?.includes('hammer stone'))));
    if(!smith||s.local.stock.stone<1)continue;
    const hafted=owner.practice.gear['hafted tool'];
    if(hafted&&(!s.local.stock.fibre||!(smith.practice.known.cordage||s.textiles?.includes('cordage'))))continue;
    s.local.stock.stone--;if(hafted)s.local.stock.fibre--;
    owner.axeWear=0;rememberHelp(owner,smith);
    assign(smith,hafted?'Rebind axe head':'Retouch hand axe',campSites[owner.tribe||0]);
    settlementEvent(s,smith.name+' repaired '+owner.name+'’s axe.');
  }
  for(const owner of available().filter(v=>v.huntWear>=6)){
    if(busy.has(owner.id))continue;
    const mender=trustedPartner(owner,available().filter(v=>(v.tribe||0)===(owner.tribe||0)&&
      (v.practice.known.cordage||s.textiles?.includes('cordage'))));
    if(!mender||s.local.stock.fibre<1)continue;
    s.local.stock.fibre--;owner.huntWear=0;rememberHelp(owner,mender);
    assign(mender,'Repair '+owner.name+'’s '+owner.gear,campSites[owner.tribe||0]);
    settlementEvent(s,mender.name+' repaired '+owner.name+'’s '+owner.gear+'.');
  }
  for(const potter of available().filter(v=>v.spareJars>0)){
    const home=s.local.campStores[potter.tribe||0];
    if(!home||home.saved>=6)continue;
    const buyer=trustedPartner(potter,available().filter(v=>{
      const stock=s.local.campStores[v.tribe||0];
      return (v.tribe||0)!==(potter.tribe||0)&&stock?.saved>=6&&
        (stock.tradeJars||0)<Math.ceil(s.villagers.filter(p=>(p.tribe||0)===(v.tribe||0)).length/4);
    }));
    if(!buyer||busy.has(potter.id))continue;
    const store=s.local.campStores[buyer.tribe||0];
    potter.spareJars--;store.tradeJars=(store.tradeJars||0)+1;
    store.saved-=3;home.saved+=3;
    rememberHelp(buyer,potter);rememberHelp(potter,buyer);
    assign(potter,'Trade a jar for dried food',campSites[buyer.tribe||0]);
    assign(buyer,'Exchange dried food for a jar',campSites[buyer.tribe||0]);
    settlementEvent(s,potter.name+' exchanged a jar for three dried provisions with '+buyer.name+'.');
  }
  const season=valleySeason(s);
  let camp=s.local.fieldCamp;
  const hunters=available().filter(v=>!v.herbalist&&(v.huntWear||0)<6&&huntingWeapons.includes(v.gear)&&
    !s.villagers.some(child=>child.illnessDays&&child.carers?.includes(v.id)));
  if(camp&&(camp.until<s.day||season.name==='Winter'||!camp.members.every(id=>hunters.some(v=>v.id===id))||s.wood<1)){
    settlementEvent(s,'The hunting party left its seasonal camp and returned home.');
    delete s.local.fieldCamp;camp=null;
  }
  if(!camp&&s.fireKnown&&s.local.reaches&&s.food>=s.villagers.length*2+4&&s.wood>=4&&season.name!=='Winter'&&
     s.local.deerTracks?.day>=s.day-2&&s.local.lastHuntSeason!==season.index){
    const lead=hunters.find(v=>v.rememberedPatch!=null);
    const partner=lead&&trustedPartner(lead,hunters.filter(v=>v!==lead));
    if(partner){
      const site=lead.huntingSite||[explorationSites[lead.rememberedPatch][0],s.local.deerTracks.y];
      lead.huntingSite=partner.huntingSite=site;
      camp=s.local.fieldCamp={site,members:[lead.id,partner.id],until:s.day+2};
      s.local.lastHuntSeason=season.index;s.food-=4;
      settlementEvent(s,lead.name+' and '+partner.name+' set up a seasonal hunting camp.');
    }
  }
  if(camp){s.wood--;report.fieldCamp=camp;}
}
export function findHomesteadHealer(s){
  if(!s.local||s.villagers.some(v=>v.herbalist))return;
  const candidates=s.villagers.filter(v=>adult(v,s.config)&&v.practice?.known.herbalism&&
    (v.practice.known.herbalism>=2||v.remedyDoses>0)&&v.practice.skills.berries>=3&&
    (!v.healerApprentice||healerTrainingComplete(v))&&
    (healerTrainingComplete(v)||v.traits.includes('Loner')||v.traits.includes('Generous')||v.practice.curiosity>=.5)&&
    assessNeeds(s,v).level>=2&&!s.local.daughter?.members.includes(v.id)&&!s.local.fieldCamp?.members.includes(v.id));
  const score=v=>(v.practice.careExperience||0)+v.practice.curiosity+Number(v.traits.includes('Loner'));
  const v=candidates.sort((a,b)=>Number(healerTrainingComplete(b))-Number(healerTrainingComplete(a))||score(b)-score(a)||a.id-b.id)[0];
  if(!v)return;
  s.local.healerId=v.id;
  const training=v.healerApprentice;
  v.herbalist={leaves:0,doses:v.remedyDoses||0,visits:0};v.remedyDoses=0;
  if(training){
    v.herbalist.trainedBy=training.mentorName;v.herbalist.trainedById=training.mentorId;delete v.healerApprentice;
    settlementEvent(s,v.name+' succeeded '+training.mentorName+' as the village healer after their apprenticeship.');
  }else settlementEvent(s,v.name+' began preparing plant remedies for sick neighbors.');
}
function medicalTrainingSafe(s,v){
  return !v.illnessDays&&v.health>=60&&v.fullness>=45&&v.warmth>=40&&v.practice.energy>=35&&
    assessNeeds(s,v).level>=2&&s.food>=s.villagers.length*2&&
    !s.local.daughter?.members.includes(v.id)&&!s.local.fieldCamp?.members.includes(v.id)&&
    !s.villagers.some(child=>child.illnessDays&&child.carers?.includes(v.id));
}
function chooseHealerApprentice(s,teacher,order){
  if(!medicalTrainingSafe(s,teacher)||
    (teacher.practice.used.herbalism||0)<2&&teacher.herbalist.visits<2)return null;
  const r=healerTrainingRules;
  // Keep one place reserved even when its student is hungry, ill, or absent.
  const current=s.villagers.find(v=>v.healerApprentice?.mentorId===teacher.id);
  if(current)return order.includes(current)&&medicalTrainingSafe(s,current)?current:null;
  const candidates=order.filter(v=>v!==teacher&&!v.herbalist&&v.age>=r.minAge&&v.age<=teacher.age-r.ageGap&&
    v.practice.known.gathering&&(v.practice.skills.berries||0)>=1&&medicalTrainingSafe(s,v)&&
    !s.local.daughter?.members.includes(v.id)&&!s.local.fieldCamp?.members.includes(v.id)&&
    (!v.healerApprentice||!s.villagers.some(t=>t.id===v.healerApprentice.mentorId&&t.herbalist))&&
    (v.healerApprentice||v.traits.includes('Generous')||v.traits.includes('Loner')||v.practice.curiosity>=.5));
  candidates.sort((a,b)=>Number(!!b.healerApprentice)-Number(!!a.healerApprentice)||
    (b.practice.careExperience||0)-(a.practice.careExperience||0)||b.practice.curiosity-a.practice.curiosity||a.id-b.id);
  const pupil=candidates[0];if(!pupil)return null;
  const previous=pupil.healerApprentice;
  pupil.healerApprentice={...previous,mentorId:teacher.id,mentorName:teacher.name,startedDay:previous?.startedDay??s.day,
    plantDays:previous?.plantDays||0,remedyDays:previous?.remedyDays||0,patientDays:previous?.patientDays||0};
  settlementEvent(s,pupil.name+(previous?' continued their healing apprenticeship with ':' began a healing apprenticeship with ')+teacher.name+'.');
  return pupil;
}
function teachHealing(s,teacher,pupil,stage,site,report){
  if(!pupil||healerTrainingComplete(pupil))return;
  const a=pupil.healerApprentice,p=pupil.practice,r=healerTrainingRules;
  if(stage==='plants'){
    a.plantDays=Math.min(r.plantDays,a.plantDays+1);
    finishOrdinaryWork(s,pupil,'forage');
    if(!p.properties.includes('perishable'))p.properties.push('perishable');
  }else if(stage==='patient'){
    a.patientDays=Math.min(r.patientDays,a.patientDays+1);
    p.careExperience=(p.careExperience||0)+1;finishOrdinaryWork(s,pupil,'care');
  }else if(stage==='remedy'&&a.plantDays>=r.plantDays&&a.patientDays>=r.patientDays&&
    p.properties.includes(practices.herbalism.property)&&practices.herbalism.requires.every(id=>p.known[id])&&practices.herbalism.need(s,pupil)){
    a.remedyDays=Math.min(r.remedyDays,a.remedyDays+1);
    p.known.herbalism=(p.known.herbalism||0)+1;p.used.herbalism=(p.used.herbalism||0)+1;
    s.local.first.herbalism??=s.day;finishOrdinaryWork(s,pupil,'forage');
  }else return;
  teacher.lastCompanyDay=pupil.lastCompanyDay=s.day;
  pupil.activity='Learn healing from '+teacher.name;pupil.gained=0;
  report.actions.push({id:pupil.id,action:pupil.activity,mentor:teacher.id,site,gained:0,healingLesson:stage});
  if(healerTrainingComplete(pupil)){
    a.readyDay=s.day;
    settlementEvent(s,pupil.name+' completed their healing apprenticeship with '+teacher.name+' and can succeed them.');
  }
  return pupil.id;
}
function healerBuildingWork(s,v,report,order){
  const c=s.config,p=v.practice,h=v.herbalist;
  const pause=reason=>{report.healerProject={ownerId:v.id,reason};return false;};
  if(assessNeeds(s,v).level<2||v.fullness<50||v.warmth<50||v.health<65||p.energy<32||s.food<s.villagers.length)
    return pause('Meeting food, warmth, health or energy needs before building.');
  const quiet=v.traits.includes('Loner')||p.curiosity>=.65&&h.visits>=3;
  const aloneWithChild=s.villagers.some(child=>child.age<c.life.adult&&child.carers?.includes(v.id)&&
    !child.carers.some(id=>id!==v.id&&s.villagers.some(other=>other.id===id&&other.age>=c.life.adult&&!other.herbalist?.home)));
  const skilled=worker=>worker.practice.known.housing&&worker.practice.known.cordage&&(worker.practice.skills.wood||0)>=3;
  const helper=order.find(worker=>worker!==v&&worker.age>=c.life.adult&&!worker.practice.lessonToday&&skilled(worker)&&
    medicalTrainingSafe(s,worker)&&Math.hypot(...campSites[worker.tribe||0].map((x,i)=>x-campSites[v.tribe||0][i]))<320);
  const worker=skilled(v)?v:helper;
  const complete=(action,site,skill='hut',builder=v)=>{
    finishOrdinaryWork(s,builder,skill);builder.activity=action;builder.gained=0;
    report.actions.push({id:builder.id,action,site,gained:0});
    if(builder!==v){
      finishOrdinaryWork(s,v,skill);v.activity='Help '+builder.name+' with the herb shelter';v.gained=0;
      v.lastCompanyDay=builder.lastCompanyDay=s.day;
      report.actions.push({id:v.id,action:v.activity,site,mentor:builder.id,gained:0});report.healerBuilder=builder.id;
    }
    report.healerProject={ownerId:v.id,reason:action+'.'};return true;
  };
  let home=s.local.healerHome;
  if(!home){
    if(!quiet)return pause('Working from camp; no separate workspace planned.');
    if(!readyToInvent(s,'healer hut')||!worker)return pause('Waiting for a villager with shelter construction, cordage and wood-working experience.');
    const site=chooseQuietHealerSite(campSites[v.tribe||0],healerNeighbors(s,campSites,true),worldTrees(s));
    if(!site)return pause('Looking for a quiet clearing with room away from other huts.');
    home=s.local.healerHome={home:[...site],ownerId:v.id,founderId:v.id,founderName:v.name,
      plannedDay:s.day,work:0,rackWork:0,markerWork:0,stock:{leaves:0,doses:0},spent:{}};
    settlementEvent(s,v.name+' chose a quiet place near the trees for an herb shelter.');
    return complete('Choose a quiet herb site',site,'explore');
  }
  if(home.ownerId!==v.id){
    if(s.villagers.some(other=>other.id===home.ownerId&&other.herbalist))return pause('The shelter already has an owner.');
    home.ownerId=v.id;
    return complete('Inspect the old herb shelter',home.home,'explore');
  }
  // Old early frames can be moved through actual planning and dismantling,
  // never by changing their drawing coordinates or moving completed houses.
  if(home.work<3&&(home.relocation||crowdedHealerSite(home.home,healerNeighbors(s,campSites)))){
    if(!worker)return pause('Waiting for a skilled builder to move the crowded frame.');
    if(!home.relocation){
      const site=chooseQuietHealerSite(campSites[v.tribe||0],healerNeighbors(s,campSites,true),worldTrees(s));
      if(site&&Math.hypot(site[0]-home.home[0],site[1]-home.home[1])>30){
        home.relocation={home:site,plannedDay:s.day};
        return complete('Choose a quieter herb site',home.home,'explore');
      }
    }else{
      const salvage={};
      for(const [material,n] of Object.entries(home.spent)){
        const recovered=material==='stone'?n:Math.floor(n*.75);salvage[material]=recovered;
        if(material==='wood')s.wood+=recovered;else s.local.stock[material]+=recovered;
      }
      for(const [material,n] of Object.entries(home.materials||{})){
        salvage[material]=(salvage[material]||0)+n;
        if(material==='wood')s.wood+=n;else s.local.stock[material]+=n;
      }
      (home.previousSites??=[]).push({home:[...home.home],work:home.work,spent:{...home.spent},salvage,day:s.day,status:'dismantled'});
      const oldSite=[...home.home];home.home=[...home.relocation.home];home.work=0;home.clearingWork=0;home.clearedTrees=[];home.spent={};home.materials={};delete home.relocation;
      settlementEvent(s,v.name+' salvaged the early herb shelter frame to rebuild at a quieter clearing.');
      return complete('Dismantle and salvage the herb frame',oldSite,'hut',worker);
    }
  }
  if(home.work>=healerBuildingRules.hutWork&&!h.home){
    if(aloneWithChild)return pause('Keeping the family home until a dependent child has another caregiver.');
    h.home=[...home.home];v.household=-v.id;
    home.stock.leaves+=h.leaves;home.stock.doses+=h.doses;h.leaves=0;h.doses=0;
    settlementEvent(s,v.name+' moved into the herb hut after finishing its walls and roof.');
    return complete('Move into the herb hut',home.home,'explore');
  }
  let field,limit,cost,action;
  if(home.work<healerBuildingRules.hutWork){
    if(!readyToInvent(s,'healer hut')||!worker)return pause('Waiting for a villager with shelter construction, cordage and wood-working experience.');
    field='work';limit=healerBuildingRules.hutWork;cost={wood:1};
    if(home.work===2||home.work===4)cost.fibre=1;
    if(home.work===5)cost.stone=1;
    action='Build the herb hut';
  }else if((home.rackWork||0)<healerBuildingRules.rackWork){
    if(!readyToInvent(s,'herb drying rack')||!worker||h.visits<2)return pause('Drying rack waits for a skilled builder and experience treating two patients.');
    field='rackWork';limit=healerBuildingRules.rackWork;cost={wood:1,fibre:1};action='Build an herb drying rack';
  }else if((home.markerWork||0)<healerBuildingRules.markerWork){
    if(!readyToInvent(s,'healer marker')||!worker||h.visits<3||(worker.practice.skills.wood||0)<4)return pause('Sign and herb thatch wait for further patient care and wood-working experience.');
    field='markerWork';limit=healerBuildingRules.markerWork;cost={wood:1,fibre:1};action='Fit a leaf sign and herb thatch';
  }else return pause('Hut and fittings complete.');
  if(field==='work'&&buildingSiteTree(s,home.home,'healer')!==null){
    const cutter=canFellBuildingTree(s,worker)?worker:order.find(other=>other!==v&&other.age>=c.life.adult&&
      !other.practice.lessonToday&&skilled(other)&&medicalTrainingSafe(s,other)&&canFellBuildingTree(s,other)&&
      (other.tribe||0)===(v.tribe||0));
    if(!cutter)return pause('Waiting for a usable hand axe or hafted tool to clear the small building patch.');
    clearBuildingTree(s,cutter,home,home.home,report,'healer');
    const gained=cutter.gained;
    complete('Clear herb site',home.home,'wood',cutter);
    cutter.gained=gained;report.actions.findLast(a=>a.id===cutter.id).gained=gained;
    return true;
  }
  // Collect missing resources as a separate workday, preserving the hearth's
  // fuel reserve. Construction never receives materials from its renderer.
  const fuelReserve=c.settlement.fuelReserve+(s.tribeCount||1)*c.fire.dailyFuel;
  const held=material=>home.materials?.[material]||0;
  const free=material=>material==='wood'?Math.max(0,s.wood-fuelReserve):s.local.stock[material];
  const reserveMaterials=()=>{
    home.materials??={};
    for(const [material,n] of Object.entries(cost)){
      const qty=Math.min(n-held(material),free(material));if(qty<=0)continue;
      home.materials[material]=(home.materials[material]||0)+qty;
      if(material==='wood')s.wood-=qty;else s.local.stock[material]-=qty;
    }
  };
  if(free('wood')+held('wood')<cost.wood){
    if(s.local.deposits.wood<1)return pause('Waiting for timber while preserving the hearth fuel reserve.');
    finishOrdinaryWork(s,worker,'wood');doWork(s,worker,'wood',report);
    reserveMaterials();
    if(worker!==v){
      finishOrdinaryWork(s,v,'wood');v.activity='Help '+worker.name+' gather shelter timber';v.gained=0;
      report.actions.push({id:v.id,action:v.activity,mentor:worker.id,gained:0});report.healerBuilder=worker.id;
    }
    report.healerProject={ownerId:v.id,reason:'Gathering timber for the shelter while keeping fuel for the hearth.'};return true;
  }
  for(const material of ['fibre','stone'])if(cost[material]&&free(material)+held(material)<cost[material]){
    if(s.local.deposits[material]<1||material==='fibre'&&(valleySeason(s).frozen||s.lastUsed.flood>=s.day-1))return pause('Waiting for safe access to '+material+'.');
    s.local.stock[material]+=takeDeposit(s,material,2);
    reserveMaterials();
    return complete('Collect '+material,materialSites[material].site,material==='fibre'?'reeds':'invent',worker);
  }
  reserveMaterials();
  for(const [material,qty] of Object.entries(cost)){
    home.materials[material]-=qty;
    home.spent[material]=(home.spent[material]||0)+qty;
  }
  home[field]=(home[field]||0)+1;
  worker.practice.used.housing=(worker.practice.used.housing||0)+1;
  if(cost.fibre)worker.practice.used.cordage=(worker.practice.used.cordage||0)+1;
  if(home[field]===limit)settlementEvent(s,v.name+' finished '+(field==='work'?'the herb hut':field==='rackWork'?'the herb drying rack':'the leaf sign and herb thatch')+'.');
  return complete(action,home.home,'hut',worker);
}
function healerWork(s,order,report){
  const v=order.find(p=>p.herbalist),h=v?.herbalist;
  const busy=new Set();
  if(!h)return busy;
  if(assessNeeds(s,v).level===0||v.illnessDays||v.health<45||v.fullness<32||v.warmth<30){
    report.healerProject={ownerId:v.id,reason:'Meeting food, warmth, health or energy needs before building.'};return busy;
  }
  const supplies=healerMedicineStore(s,v),home=s.local.healerHome;
  const capacity=home?.ownerId===v.id&&home.rackWork>=healerBuildingRules.rackWork?4:2;
  const patient=order.filter(p=>p!==v&&p.illnessDays>0).sort((a,b)=>a.health-b.health||a.id-b.id)[0];
  const pupil=chooseHealerApprentice(s,v,order);
  let action,lesson,site=h.home||campSites[v.tribe||0];
  if(patient&&supplies.doses){
    supplies.doses--;h.visits++;patient.illnessDays--;changeNeed(patient,'health',4,s.config);rememberHelp(patient,v);
    v.practice.careExperience=(v.practice.careExperience||0)+1;
    v.lastCompanyDay=patient.lastCompanyDay=s.day;
    action='Care for '+patient.name;site=null;lesson='patient';finishOrdinaryWork(s,v,'care');
    settlementEvent(s,v.name+' brought a plant remedy to '+patient.name+'. Their illness shortened by a day.');
  }else if(supplies.leaves&&supplies.doses<capacity&&v.practice.known.herbalism){
    supplies.leaves--;supplies.doses++;action='Crush leaves for a remedy';finishOrdinaryWork(s,v,'forage');
    v.practice.used.herbalism=(v.practice.used.herbalism||0)+1;v.practice.known.herbalism++;
    lesson='remedy';
  }else if(!supplies.leaves&&supplies.doses<capacity&&v.practice.known.gathering&&s.local.deposits.berries>0){
    takeDeposit(s,'berries',1);supplies.leaves++;finishOrdinaryWork(s,v,'forage');action='Gather healing leaves';site=materialSites.berries.site;lesson='plants';
  }else if(pupil&&!healerTrainingComplete(pupil)&&pupil.healerApprentice.plantDays<healerTrainingRules.plantDays&&
    supplies.leaves<healerTrainingRules.plantDays&&s.local.deposits.berries>=1){
    takeDeposit(s,'berries',1);supplies.leaves++;finishOrdinaryWork(s,v,'forage');
    action='Teach medicinal plant gathering';site=materialSites.berries.site;lesson='plants';
  }else if(healerBuildingWork(s,v,report,order)){busy.add(v.id);if(report.healerBuilder!=null)busy.add(report.healerBuilder);return busy;}
  else return busy;
  v.activity=action;v.gained=0;
  report.actions.push({id:v.id,action,site,patient:site?undefined:patient.id,gained:0});
  report.healerProject={ownerId:v.id,reason:lesson==='patient'?'Treating a sick neighbor before optional building.':
    'Gathering or preparing remedies before optional building.'};
  busy.add(v.id);
  const studentId=teachHealing(s,v,pupil,lesson,site||h.home||campSites[v.tribe||0],report);
  if(studentId!=null)busy.add(studentId);
  return busy;
}
function householdCare(s,order,report){
  const busy=new Set();
  if(!s.local)return busy;
  for(const patient of order.filter(v=>v.illnessDays||v.health<45)){
    const helper=order.find(v=>v!==patient&&!busy.has(v.id)&&assessNeeds(s,v).level>0&&!v.illnessDays&&v.age>=5&&v.health>=50&&
      v.household===patient.household&&(v.tribe||0)===(patient.tribe||0));
    if(!helper)continue;
    busy.add(helper.id);
    rememberHelp(patient,helper);
    if(patient.illnessDays)helper.practice.careExperience=(helper.practice.careExperience||0)+1;
    let meal=false;
    const store=s.local.campStores[patient.tribe||0];
    if(patient.fullness<=s.config.needs.eatAtOrBelow){
      if(s.food>=1){changeStock(s,'food',-1);meal=true;}
      else if(store?.saved>0){store.saved--;meal=true;}
    }
    if(meal)changeNeed(patient,'fullness',s.config.needs.mealFullness,s.config);
    changeNeed(patient,'warmth',6,s.config);
    changeNeed(patient,'health',4,s.config);
    helper.activity='Care for '+patient.name;
    report.actions.push({id:helper.id,action:helper.activity,patient:patient.id,meal,gained:0});
    settlementEvent(s,helper.name+(meal?' brought a meal to ':' stayed to care for ')+patient.name+'.');
  }
  return busy;
}
function seasonalStores(s,report){
  for(let camp=0;camp<(s.tribeCount||1);camp++){
    const residents=s.villagers.filter(v=>(v.tribe||0)===camp&&!s.local.daughter?.members.includes(v.id));
    const store=s.local.campStores[camp]??={rack:0,saved:0};
    store.saved+=store.rack;store.rack=0;
    const haul=report.actions.filter(a=>residents.some(v=>v.id===a.id)&&a.gained>0&&
      (a.action==='Fish'||a.action==='Hunt'||a.action==='Forage'||a.action.startsWith('Track ')));
    const dryer=residents.find(v=>v.practice?.known.drying&&!v.illnessDays&&
      !report.outing?.members.includes(v.id)&&!v.activity.startsWith('Care for '));
    if(!dryer||!haul.length||s.local.season==='Winter')continue;
    const spareFresh=Math.max(0,s.food-Math.max(s.local.dried+(s.bankFood||0),s.villagers.length*2));
    if(!spareFresh)continue;
    // A successful batch builds a local habit. Remembering hunger also gives
    // a knowledgeable resident a reason to put food aside on the next trip.
    const leanMemory=store.lastHungryDay!==undefined&&s.day-store.lastHungryDay<=40;
    const chance=.18+dryer.practice.curiosity*.24+(dryer.traits.includes('Timid')?.15:0)
      +(leanMemory?.28:0)+Math.min(.2,(store.batches||0)*.04)+(s.local.season==='Autumn'?.12:0);
    let h=Math.imul(s.day+1,2654435761)^Math.imul(camp+1,1597334677)^s.seed;
    h=Math.imul(h^(h>>>16),2246822519);
    if(((h^(h>>>13))>>>0)/4294967296>chance){
      if(store.lastKeptFresh===undefined||s.day-store.lastKeptFresh>=7){
        settlementEvent(s,'Camp '+(camp+1)+' kept today’s haul for fresh meals.');
        store.lastKeptFresh=s.day;
      }
      continue;
    }
    let racks=store.racks||1;
    const storageTarget=winterStorageTarget(s,residents,foodCapacity(s));
    if(store.saved>=24*racks+12*(store.tradeJars||0) && storageTarget>24*racks+12*(store.tradeJars||0) && spareFresh>0 &&
       s.wood>=s.config.settlement.fuelReserve+3){
      s.wood-=3;store.racks=++racks;
      settlementEvent(s,dryer.name+' built another drying rack and food cache at Camp '+(camp+1)+'.');
    }
    const batch=Math.min(4*racks,haul.reduce((sum,a)=>sum+a.gained,0),spareFresh,24*racks+12*(store.tradeJars||0)-store.saved);
    if(batch>0){
      store.built=true;store.rack=batch;changeStock(s,'food',-batch);
      store.batches=(store.batches||0)+1;
      settlementEvent(s,dryer.name+' hung '+batch+' provisions on the drying rack at Camp '+(camp+1)+'.');
    }
  }
}
export function bringSettlersHome(s,reason='They were called home.'){
  const post=s.local?.daughter;
  if(!post?.members.length)return false;
  const names=s.villagers.filter(v=>post.members.includes(v.id)).map(v=>v.name);
  changeStock(s,'food',post.food+post.returnFood);changeStock(s,'wood',post.wood);
  post.food=0;post.wood=0;post.returnFood=0;post.members=[];post.closed=s.day;
  settlementEvent(s,names.join(', ')+' returned by the marked trail. '+reason);
  return true;
}
function tendDaughter(s,order,report){
  if(!s.local)return new Set();
  let post=s.local.daughter;
  const healthy=v=>adult(v,s.config)&&!v.illnessDays&&v.health>=55;
  if(!post?.members.length&&(!post||s.day-post.closed>=20)&&s.fireKnown&&s.farming.known&&
    s.local.season!=='Winter'&&s.wood>=12&&!s.local.fieldCamp){
    for(const guide of order.filter(v=>healthy(v)&&v.rememberedPatch!=null&&v.huntingSite)){
      const family=order.filter(v=>v.household===guide.household);
      const others=order.filter(v=>!family.includes(v));
      const patch=guide.rememberedPatch;
      if(family.filter(healthy).length<2||family.some(v=>v.illnessDays||v.health<55)||
        others.filter(healthy).length<4||s.food<others.length*3+family.length*6||
        !(s.local.wildPatches?.[patch]>=8))continue;
      const ids=family.map(v=>v.id);
      if(others.some(v=>v.age<s.config.life.adult&&v.carers?.some(id=>ids.includes(id))))continue;
      post=s.local.daughter={site:[explorationSites[patch][0],explorationSites[patch][1]-17],patch,origin:guide.tribe||0,
        members:ids,household:guide.household,food:family.length*5,returnFood:family.length,
        wood:6,started:s.day,shelter:0,field:0,settled:false};
      s.food-=post.food+post.returnFood;s.wood-=post.wood;
      settlementEvent(s,guide.name+' marked the way home and moved with the household to the eastern grove.');
      break;
    }
  }
  if(!post?.members.length)return new Set();
  const family=order.filter(v=>post.members.includes(v.id));
  const rear=order.filter(v=>!post.members.includes(v.id));
  const patchFood=s.local.wildPatches?.[post.patch]||0;
  if(family.filter(healthy).length<2||rear.filter(healthy).length<3||s.food<rear.length||
     post.food+patchFood<family.length*2||family.some(v=>v.health<45)||post.wood<1){
    bringSettlersHome(s,'The household used its return plan before supplies or helpers ran out.');
    return new Set();
  }
  post.wood--;report.daughter=post;
  const winter=s.local.season==='Winter';
  if(!winter&&post.field>0)post.field++;
  for(const v of family){
    let action='Rest at the eastern shelter';
    if(healthy(v)){
      if(post.shelter<3&&post.wood>=2){post.wood--;post.shelter++;action='Build eastern shelter';}
      else if(post.wood<=3){post.wood+=3;action='Gather eastern firewood';}
      else if(post.field>=7){post.food+=8;post.field=0;action='Harvest eastern plot';}
      else if(!winter&&!post.field&&post.food>family.length*2){post.food--;post.field=1;action='Sow eastern plot';}
      else if(s.local.wildPatches[post.patch]>=1){
        const picked=Math.min(3,s.local.wildPatches[post.patch]);
        s.local.wildPatches[post.patch]-=picked;post.food+=picked;action='Gather eastern berries';
      }
    }
    v.activity=action;v.gained=0;v.outdoors=post.shelter<3;
    report.actions.push({id:v.id,action,site:post.site,gained:0});
  }
  if(!post.settled&&post.shelter>=3&&s.day-post.started>=7){
    post.settled=true;settlementEvent(s,'The household made the eastern grove its village.');
  }
  return new Set(post.members);
}
function work(s, order, report) {
  const c = s.config, P = c.personality, n = s.villagers.length, weather = report.weather;
  // Exactly one behaviour roll per living Gourdling, in work order, always taken.
  const dice = c.traits ? order.map(() => traitRoll(s)) : [];
  report.behaviourRolls = dice;
  const resters = [];
  if(c.learning)for(const v of order)v.motivation=assessNeeds(s,v);
  // One adult can spend the day making equipment while the others work.
  const visitors=c.learning?neighborWork(s,order,report,{unrelated,readyToInvent}):new Set();
  const settlers=tendDaughter(s,order.filter(v=>!v.herbalist&&!visitors.has(v.id)),report);
  const healer=healerWork(s,order.filter(v=>!settlers.has(v.id)&&!visitors.has(v.id)),report);
  const carers=householdCare(s,order.filter(v=>!settlers.has(v.id)&&!healer.has(v.id)&&!visitors.has(v.id)),report);
  for(const id of visitors)carers.add(id);
  for(const id of healer)carers.add(id);
  for(const id of settlers)carers.add(id);
  const adults=c.settlement?order.filter(v=>v.age>=c.life.adult&&!v.illnessDays&&!carers.has(v.id)):[];
  const stoneCrew = planStandingStones(s, c.learning?adults.filter(v=>assessNeeds(s,v).level>=3):adults, report);
  campVisits(s,adults,stoneCrew,report);
  report.wildlife=passingWildlife(s);
  planWildlifeHunts(s,report.wildlife,adults,report,stoneCrew);
  for(const id of report.fieldCamp?.members||[]){
    if(stoneCrew.has(id))continue;
    const hunter=adults.find(v=>v.id===id);
    stoneCrew.add(id);hunter.activity='Watch the deer trail';hunter.gained=0;
    report.actions.push({id,action:hunter.activity,site:report.fieldCamp.site,gained:0});
  }
  const available=adults.filter(v=>!stoneCrew.has(v.id)&&(!c.learning||assessNeeds(s,v).level>0)&&v.fullness>=40&&v.warmth>=35&&
    !s.villagers.some(child=>child.age<c.life.adult&&child.illnessDays&&child.carers?.includes(v.id)));
  if(s.local&&s.food>=n*2+4&&available.length>=2){
    const guide=available.find(v=>v.rememberedPatch!=null&&
      (s.local.wildPatches?.[v.rememberedPatch]||0)>=2);
    const pupil=guide&&trustedPartner(guide,available.filter(v=>v!==guide&&v.rememberedPatch!==guide.rememberedPatch&&(v.tribe||0)===(guide.tribe||0)));
    if(pupil&&s.day%4===0){
      const patch=guide.rememberedPatch;
      const before=s.food;
      const picked=Math.min(4,s.local.wildPatches[patch],foodCapacity(s)-s.food);
      s.local.wildPatches[patch]-=picked;changeStock(s,'food',picked);report.gatheredFood+=s.food-before;
      pupil.rememberedPatch=patch;
      report.outing={members:[guide.id,pupil.id],x:explorationSites[patch][0],y:explorationSites[patch][1],reason:guide.name+' remembers berries here and is showing '+pupil.name+' the way.'};
      for(const v of [guide,pupil]){
        stoneCrew.add(v.id);finishOrdinaryWork(s,v,'forage');v.activity='Visit remembered grove';v.gained=v===guide?picked:0;
        report.actions.push({id:v.id,action:v.activity,gained:v.gained});
      }
      settlementEvent(s,report.outing.reason);
    }
  }
  const scouts=available.filter(v=>!stoneCrew.has(v.id)).sort((a,b)=>b.practice.curiosity-a.practice.curiosity);
  const scout=scouts.find(v=>!v.traits.includes('Timid')||scouts.length>=2);
  const needGatheringGround=s.local && s.local.season!=='Winter' && s.food<n &&
    s.local.deposits.berries<n && !s.local.wildPatches?.some(q=>q>=n);
  if(s.local&&scout&&!report.outing&&(s.local.reaches||0)<explorationSites.length&&
     (s.food>=n*2+4 || needGatheringGround && (s.food>=3 || scout.travelMeals>=2))){
    const tracks=s.local.deerTracks;
    const cutTrees=Object.keys(s.local.stumps||{}).filter(id=>{
      const [x,y]=worldTrees(s)[id],home=campSites[scout.tribe||0];
      return Math.hypot(x-home[0],y-home[1])<150;
    }).length;
    const region=s.local.reaches||0;
    let reason;
    if(needGatheringGround)reason='There is too little food here. I am looking for another gathering ground.';
    else if(tracks&&s.day-tracks.day<=2&&scout.gear&&Math.abs(campSites[scout.tribe||0][1]-tracks.y)<100)reason='Fresh deer tracks lead beyond our familiar ground.';
    else if(cutTrees>=3&&s.wood<fuelTarget(s,n)+4)reason='The nearest trees are stumps. I want to look farther for timber.';
    else if(s.local.surplusDays>=3)reason='We have food for the journey. I want to see what grows beyond camp.';
    if(reason){
      const partner=scout.traits.includes('Timid')?trustedPartner(scout,scouts.filter(v=>v!==scout&&(s.food>=3||v.travelMeals>=1))):null;
      if(scout.traits.includes('Timid')&&!partner)reason=null;
      if(reason){
      report.outing={members:[scout.id],x:explorationSites[region][0],y:explorationSites[region][1],reason};
      if(s.food<3)report.outing.packedMeals=true;
      finishOrdinaryWork(s,scout,'explore');doWork(s,scout,'explore',report);stoneCrew.add(scout.id);
      if(partner){
        report.outing.members.push(partner.id);stoneCrew.add(partner.id);
        if(report.outing.packedMeals)partner.travelMeals--;else s.food--;
        partner.activity='Scout upriver';partner.gained=0;finishOrdinaryWork(s,partner,'explore');
        report.actions.push({id:partner.id,action:partner.activity,gained:0});
        if(scout.rememberedPatch!=null)partner.rememberedPatch=scout.rememberedPatch;
      }
      }
    }
  }
  if(report.wildlife?.species==='deer')s.local.deerTracks={day:s.day,y:report.wildlife.y};
  const pioneer=adults.filter(v=>!stoneCrew.has(v.id)&&v.fullness>=40&&v.warmth>=35)
    .sort((a,b)=>(b.practice?.curiosity||0)-(a.practice?.curiosity||0))[0];
  const unarmed=adults.filter(v=>!v.gear);
  const weaponMaker=unarmed.find(v=>v.traits.includes('Brave'))??unarmed[0];
  const tool=nextStoneTool(s);
  const heatTool=!tool?nextHeatTool(s):null;
  const maker=weaponMaker??(tool||heatTool?(adults.find(v=>v.traits.includes('Smart'))??adults[0]):null);
  const observers=[];
  const trapMakers=adults.filter(v=>!hasFishingGear(v));
  const trapMaker=adults.filter(v=>hasFishingGear(v)).length<Math.ceil(n/6)
    ? trapMakers.find(v=>v.reedBundle)??trapMakers.find(v=>v!==maker)??trapMakers[0] : null;
  const riverSafe=(s.lastUsed.flood===undefined||s.lastUsed.flood<s.day-1)&&!valleySeason(s).frozen;
  const artisans=adults.filter(v=>v!==trapMaker&&v!==maker);
  const potter=artisans.find(v=>v.traits.includes('Smart'))??artisans[0];
  const nextTextile=nextTextileCraft(s,potter?.tribe||0);
  // A set net is checked at the start of the workday, before individual
  // spear fishers exhaust the same shallow-water stock. One haul uses one
  // workday and the same finite deposit; it does not create extra fish.
  if(c.learning&&riverSafe&&s.food<n*c.work.foodTargetPerPerson&&s.local.deposits.fish>=1){
    const netFisher=adults.find(v=>!stoneCrew.has(v.id)&&v.practice.gear['fishing net']&&
      v.warmth>=40&&v.health>=50&&v.practice.energy>=22&&
      (assessNeeds(s,v).level>0||assessNeeds(s,v).need==='food'));
    if(netFisher){
      finishOrdinaryWork(s,netFisher,'fish');doWork(s,netFisher,'fish',report,'net');stoneCrew.add(netFisher.id);
    }
  }
  order.forEach((v, i) => {
    if (stoneCrew.has(v.id)||carers.has(v.id)) return;
    const motive=c.learning?assessNeeds(s,v):null;
    if(motive)v.motivation=motive;
    const preparingCold=c.learning&&coldOmen(s,v)&&s.wood<fuelTarget(s)+2;
    const develop=(!motive||motive.level>=3)&&!preparingCold;
    if(c.learning && v.outdoors && v.age>=c.life.adult && !v.illnessDays &&
      !(v.beddingUntil>=s.day) && v.practice.known.gathering && s.local.deposits.wood>=1 &&
      (v.travelMeals>0 || v.fullness>=35) && motive.level>0){
      takeDeposit(s,'wood',1);
      finishOrdinaryWork(s,v,'wood');
      v.beddingUntil=s.day+5;
      changeNeed(v,'warmth',c.needs.warmUp,c);
      v.activity='Gather branches for bedding';v.gained=0;
      report.actions.push({id:v.id,action:v.activity,gained:0});
      return;
    }
    if(c.learning && v.outdoors && v.warmth<=c.needs.damageAtOrBelow &&
      (v.travelMeals>0 || s.food<1 && s.local.deposits.berries<1 && !s.local.wildPatches?.some(q=>q>=1))){
      finishOrdinaryWork(s,v,'warm');doWork(s,v,'warm',report);return;
    }
    const die = c.traits ? dice[i] : 101;
    let action = chooseAction(s, v, weather, n, die, true);
    if(c.learning&&motive.level>0&&action!=='warm'&&action!=='rest'&&action!=='wood'&&action!=='hut'){
      const foodWork=cerealFoodWork(s,v,makePracticeProduct,report);
      if(foodWork){
        finishOrdinaryWork(s,v,foodWork==='Grind wheat into flour'?'harvest':'warm');
        v.activity=foodWork;v.gained=foodWork==='Bake hearth flatbread'?wheatRules.bread:0;
        report.actions.push({id:v.id,action:foodWork,gained:v.gained,site:foodWork==='Grind wheat into flour'?campSites[v.tribe||0]:[campSites[v.tribe||0][0]+32,campSites[v.tribe||0][1]+18]});
        return;
      }
    }
    if (c.traits) {
      const plain = chooseAction(s, v, weather, n, die, false);
      const trait = creditTrait(s, v, weather, die, action, plain);
      if (trait) {
        traitEvent(s, report, v, trait, t('traitLog.'+trait, {name:v.name,action:actionWord(action),plain:actionWord(plain),
          weather:t('labels.weather.'+weather),place:t(s.fireLit?'labels.resources.fire':'labels.resources.shelter')}));
      }
    }
    if(action==='forage'&&c.hunting&&s.gameAnimals>0&&(v.huntWear||0)<6&&huntingWeapons.includes(v.gear)&&v.age>=c.life.adult&&!v.illnessDays)action='hunt';
    if(develop&&v===maker&&!['warm','hut'].includes(action)&&(!c.learning||!['plant','harvest'].includes(action))&&s.food>=n*c.needs.mealCost){
      if(weaponMaker&&s.wood>=c.settlement.fuelReserve+2)action='craft';
      else if(tool&&(tool.wood===0||s.wood>=c.settlement.fuelReserve+tool.wood))action='invent';
      else if(heatTool&&s.wood>=c.settlement.fuelReserve+heatTool.wood&&(heatTool.name!=='burn bowl'||s.fireLit))action='invent heat tool';
    }
    if(develop&&v===trapMaker&&!['warm','hut'].includes(action)&&(!c.learning||!['plant','harvest'].includes(action))&&s.food>=n*c.needs.mealCost){
      if(v.reedBundle&&(!c.learning||v.practice.known.fishtraps&&readyToInvent(s,'fish trap')&&s.wood>=1&&s.local.stock.fibre>=2))action='trap';
      else if(riverSafe)action='reeds';
    }
    if(hasFishingGear(v)&&adults.includes(v)&&riverSafe&&['forage','hunt'].includes(action))action='fish';
    const workshop=s.pottery;
    if(develop&&v===potter&&(!c.learning||v.practice.known.shaping)&&workshop&&s.food>=n*c.needs.mealCost*2&&!['warm','hut'].includes(action)&&(!c.learning||!['plant','harvest'].includes(action))&&(!workshop.kiln||workshop.jars<Math.ceil(n/4)+1)){
      const fuel=s.wood-c.settlement.fuelReserve;
      if(workshop.jars&&!workshop.kiln){
        if(workshop.clay<2&&riverSafe)action='Gather clay';
        else if(workshop.clay>=2&&s.fireLit&&fuel>=2&&(!c.learning||v.practice.known.kilns))action='Build kiln';
      }else if(workshop.unfired>=(workshop.kiln&&(workshop.clay>0||!s.fireTools?.includes('wooden tongs'))?2:1)){
        if(s.fireLit&&fuel>=1&&(!c.learning||v.practice.known.pottery))action='Fire jar';
      }else if(workshop.clay)action='Shape jar';
      else if(riverSafe)action='Gather clay';
    }
    if(develop&&nextTextile&&s.pottery&&v===potter&&['rest','forage','wood','hunt'].includes(action)&&s.food>=n*c.needs.mealCost*2){
      if((s.fibre||0)<2){if(riverSafe)action='Gather fibre';}
      else if(nextTextile!=='loom'||s.wood>=c.settlement.fuelReserve+2)action='weave';
    }
    const weaving=['weave','Gather fibre'].includes(action);
    const prefersHousing=weaving&&craftPreference(s,v.tribe||0,'housing before textiles')>.5;
    if(develop&&v===potter&&(prefersHousing||['rest','wood','forage','hunt'].includes(action))&&nextHutImprovement(s,v.tribe||0)&&s.food>=n*c.needs.mealCost*2&&s.wood>=c.settlement.fuelReserve+2)action='improve hut';
    if(c.learning){
      if(develop&&v===pioneer&&s.food>=n*2+2){
        let outing;
        if(s.local.season!=='Winter'&&!s.farming.known&&!s.local.seedTrial&&s.local.seedFinds>=3)outing='seed trial';
        if(outing){finishOrdinaryWork(s,v,outing);doWork(s,v,outing,report);return;}
      }
      if(v.age>=4&&v.age<c.life.adult&&!v.practice.lessonToday&&v.fullness>=45&&v.warmth>=45&&!v.illnessDays&&v.practice.energy>=32&&s.food>=n*2){observers.push(v);return;}
      if(action==='fish'&&s.local.deposits.fish<1)action='forage';
      const essential=motive.level<2||action==='warm'||action==='harvest'||action==='plant'&&!v.practice.lessonToday&&!cerealStudyReady(s,v)||action==='hut'&&(s.hutProject||shouldPlanHut(s))||preparingCold&&action==='wood'||
        action==='wood'&&s.wood<(s.tribeCount||1)*c.fire.dailyFuel;
      const chosen=essential?null:practiceWork(s,v,die,report);
      if(chosen){
        const ritual=report.magic?.find(r=>r.id===v.id),site=chosen==='Work ground bone into soil'?[680,539]:chosen==='Make saddle quern'?[campSites[v.tribe||0][0]-25,campSites[v.tribe||0][1]+25]:ritual?.spell==='hearthcharms'?campSites[v.tribe||0]:
          chosen==='Collect a grinding stone'?materialSites.quernStone.site:ritual?.spell==='storewards'?[310,168]:v.herbalist?.home;
        v.activity=chosen;v.gained=0;
        report.actions.push({id:v.id,action:chosen,gained:0,...(site?{site}:{}),...(ritual?.targetId!=null?{patient:ritual.targetId}:{})});return;
      }
      if(v.fullness<=28&&motive.need==='food'&&action!=='harvest')action='forage';
      if(v.practice.energy<22&&motive.need!=='food'&&action!=='warm')action='rest';
      if((action==='reeds'||action==='Gather fibre')&&s.local.deposits.fibre<1)action='forage';
      if(action==='Gather clay'&&s.local.deposits.clay<1)action='forage';
      if(action==='wood'&&s.local.deposits.wood<1&&!s.toolkit?.includes('hand axe')&&!v.practice.gear['hafted tool'])action='forage';
      if(action==='forage'&&s.local.deposits.berries<1&&!s.local.wildPatches?.some(q=>q>=1)){
        action=hasFishingGear(v)&&riverSafe&&s.local.deposits.fish>=1?'fish':
          s.gameAnimals>0&&(v.huntWear||0)<6&&huntingWeapons.includes(v.gear)?'hunt':
          v.warmth<c.needs.warmUpBelow?'warm':
          s.wood<fuelTarget(s,n)&&s.local.deposits.wood>=1?'wood':'rest';
      }
      finishOrdinaryWork(s,v,action);
    }
    doWork(s, v, action, report);
    if (action === 'rest') resters.push(v);
  });
  for(const child of observers){
    const skillByJob={Fish:'fish',Forage:'berries','Gather wood':'wood','Experiment with stone':'stone','Craft hammer stone':'stone','Craft stone blades':'stone','Make cutting tool':'stone',
      'Make saddle quern':'stone','Shape a grinding stone':'stone','Grind wheat into flour':'stone','Bake hearth flatbread':'berries','Sow wheat':'berries','Harvest wheat':'berries'};
    const mentors=adults.filter(v=>(child.tribe||0)===(v.tribe||0)&&skillByJob[v.activity]);
    const mentor=mentors.find(v=>v.activity==='Fish')||mentors[(s.day+child.id)%mentors.length];
    if(!mentor){finishOrdinaryWork(s,child,'rest');doWork(s,child,'rest',report);resters.push(child);continue;}
    const skill=skillByJob[mentor.activity];
    const p=child.practice;p.site=mentor.practice.site;p.currentSkill=skill;
    p.skills[skill]=Math.min(30,(p.skills[skill]||0)+1);p.energy-=2;
    if(skill==='stone'&&p.skills.stone>=3&&!p.properties.includes('fractures'))p.properties.push('fractures');
    if(p.skills[skill]===3)settlementEvent(s,child.name+' learned the basics of '+({fish:'checking fish traps',berries:'finding berries',wood:'selecting firewood',stone:'reading how stone flakes'})[skill]+' by watching '+mentor.name+'.');
    child.activity='Watch '+mentor.name;child.gained=0;
    report.actions.push({id:child.id,action:child.activity,mentor:mentor.id,gained:0});
  }
  // Rest happiness for everyone comes after all actions are chosen.
  const together = resters.length >= 2;
  for (const v of resters) {
    if(c.learning){
      const peer=resters.find(p=>p!==v&&(p.tribe||0)===(v.tribe||0));
      if(peer){v.lastCompanyDay=s.day;rememberHelp(v,peer);}
      else if(v.traits.includes('Loner'))v.lastCompanyDay=s.day;
    }
    let gain = c.needs.restHappiness;
    if (hasTrait(s, v, 'Sociable')) {
      gain = together ? P.restTogether : P.restAlone;
      traitEvent(s, report, v, together ? 'Sociable+' : 'Sociable-', t('traitLog.'+(together?'sociableTogether':'sociableAlone'), {name:v.name,others:resters.length-1}));
    } else if (hasTrait(s, v, 'Loner')) {
      gain = together ? P.restAlone : P.restTogether;
      traitEvent(s, report, v, together ? 'Loner-' : 'Loner+', t('traitLog.'+(together?'lonerTogether':'lonerAlone'), {name:v.name}));
    }
    const before = v.happiness; changeNeed(v, 'happiness', gain, c);
    v.gained = v.happiness - before;
    report.actions.find(a => a.id === v.id).gained = v.gained;
  }
}

// One meal, without changing state: `order` serves in that order, `threshold`
// and `fullness` by id. Returns who ate and who went without as Generous.
export function mealPlan(order, threshold, fullness, food, generousOk) {
  const served = new Set(), fed = [], gave = [];
  for (const id of order) {
    // "Hungry and waiting": not yet served and at or below their own threshold, self included.
    const waiting = order.filter(q => !served.has(q) && fullness[q] <= threshold[q]).length;
    served.add(id);
    if (fullness[id] > threshold[id]) continue;
    if (generousOk(id) && food < waiting) { gave.push(id); continue; }
    if (food >= 1) { food -= 1; fed.push(id); }
  }
  return { fed, gave };
}
// Meals: Grabby Gourdlings first (in rotation order), then everyone else.
function meals(s, order, report) {
  const c = s.config, N = c.needs, P = c.personality, grabby = v => hasTrait(s, v, 'Grabby');
  if(c.learning){
    for(const v of order.filter(v=>v.campJourney))if(v.fullness<=N.eatAtOrBelow&&v.travelMeals>=N.mealCost){
      v.travelMeals-=N.mealCost;changeNeed(v,'fullness',N.mealFullness,c);report.meals.push(v.id);
    }
    order=order.filter(v=>!v.campJourney);
  }
  const post=s.local?.daughter;
  if(post?.members.length){
    for(const v of order.filter(v=>post.members.includes(v.id))){
      if(post.food>=N.mealCost&&v.fullness<=N.eatAtOrBelow){
        post.food-=N.mealCost;changeNeed(v,'fullness',N.mealFullness,c);report.meals.push(v.id);
      }
    }
    order=order.filter(v=>!post.members.includes(v.id));
  }
  const byId = Object.fromEntries(order.map(v => [v.id, v]));
  const fullness = Object.fromEntries(order.map(v => [v.id, v.fullness]));
  const generousOk = id => hasTrait(s, byId[id], 'Generous') && fullness[id] >= P.generousMinFullness;
  for (const v of order) report.beforeMeals.push({ id: v.id, fullness: v.fullness, warmth: v.warmth });
  const mealOrder = [...order.filter(grabby), ...order.filter(v => !grabby(v)&&!v.outdoors),
    ...order.filter(v=>!grabby(v)&&v.outdoors)].map(v => v.id);
  const threshold = Object.fromEntries(order.map(v => [v.id, grabby(v) ? P.grabbyEatAtOrBelow : N.eatAtOrBelow]));
  const foodBefore = s.food;
  const localFed=[];
  if(c.learning){
    let shortfall=Math.max(0,mealOrder.filter(id=>fullness[id]<=threshold[id]).length-s.food);
    for(const id of mealOrder){
      const v=byId[id],store=s.local.campStores[v.tribe||0];
      if(shortfall<=0)break;
      if(fullness[id]>threshold[id]||!store?.saved)continue;
      store.saved--;changeNeed(v,'fullness',N.mealFullness,c);localFed.push(id);report.meals.push(id);shortfall--;
    }
  }
  const sharedOrder=mealOrder.filter(id=>!localFed.includes(id));
  const plan=mealPlan(sharedOrder,threshold,fullness,s.food,generousOk),fed=[...localFed,...plan.fed],gave=plan.gave;
  for (const id of gave) traitEvent(s, report, byId[id], 'Generous', t('traitLog.Generous', {name:byId[id].name}));
  for (const id of plan.fed) {
    const v = byId[id];
    s.food -= N.mealCost; if(s.bankFood)s.bankFood=Math.min(s.bankFood,s.food); changeNeed(v, 'fullness', N.mealFullness, c); report.meals.push(id);
    // Eating early is counted, never logged (design: Grabby line rule).
    if (grabby(v) && fullness[id] > N.eatAtOrBelow) s.stats.traitEvents['Grabby-early'] = (s.stats.traitEvents['Grabby-early'] || 0) + 1;
  }
  if(s.local)for(const id of mealOrder){
    const v=byId[id],store=s.local.campStores[v.tribe||0];
    if(fed.includes(id)||!store?.saved||fullness[id]>threshold[id])continue;
    store.saved--;changeNeed(v,'fullness',N.mealFullness,c);report.meals.push(id);
  }
  if (c.traits && order.some(grabby)) {
    // Re-run the meal with every Grabby treated as normal (rotation order, eats
    // at 75 or below). Anyone fed there who went without here is named.
    const normal = Object.fromEntries(order.map(v => [v.id, N.eatAtOrBelow]));
    const counterfactual = mealPlan(order.map(v => v.id).filter(id=>!localFed.includes(id)), normal, fullness, foodBefore, generousOk).fed;
    const grabbyEaters = plan.fed.filter(id => grabby(byId[id]));
    for (const id of counterfactual) if (!fed.includes(id) && grabbyEaters.length && !grabbyEaters.includes(id)) {
      const g = byId[grabbyEaters[0]];
      traitEvent(s, report, g, 'Grabby-others-went-without', t('traitLog.grabbyOthers', {name:g.name,other:byId[id].name}));
    }
  }
  if(s.local)for(const v of order){
    if(v.travelMeals>0 && v.fullness<=N.eatAtOrBelow && !report.meals.includes(v.id)){
      v.travelMeals--;changeNeed(v,'fullness',N.mealFullness,c);report.meals.push(v.id);
    }
    if(v.fullness<35&&!report.meals.includes(v.id)){
      s.local.campStores[v.tribe||0].lastHungryDay=s.day;
    }
  }
  flushTraitLog(s, report);
}

function resolveNeeds(s, v, sheltered, report) {
  const c = s.config, n = c.needs;
  const causes = [];
  let damage = 0;
  if (v.fullness <= n.damageAtOrBelow) { damage += n.hungerDamage; causes.push('hunger'); }
  if (v.warmth <= n.damageAtOrBelow) { damage += n.coldDamage; causes.push('cold'); }
  if (v.illnessDays > 0) { damage += n.illnessDamage; causes.push('illness'); }
  changeNeed(v, 'health', -damage, c);
  if (!damage && !v.illnessDays && v.fullness >= n.recoveryMin && v.warmth >= n.recoveryMin)
    changeNeed(v, 'health', n.recovery, c);
  v.safety = sheltered && v.health >= n.safeHealth && !v.illnessDays ? n.safe : n.unsafe;
  if ([v.fullness, v.warmth, v.safety].every(value => value >= n.happyMin)) changeNeed(v, 'happiness', n.happyGain, c);
  else if ([v.fullness, v.warmth, v.safety].some(value => value < n.unhappyBelow)) changeNeed(v, 'happiness', -n.unhappyLoss, c);
  if (v.illnessDays) changeNeed(v, 'happiness', -n.illnessHappinessLoss, c);
  report.damage.push({ id: v.id, amount: damage, causes });
}

function resolveLivesAndDiscovery(s, report) {
  const c = s.config;
  for (const v of s.villagers) {
    v.age += 1;
    if (v.health > 0 && v.age < c.life.death) continue;
    const causes = [];
    if (v.health <= 0) causes.push(...report.damage.find(d => d.id === v.id).causes);
    if (v.health <= 0 && !causes.length) causes.push('poor health');
    if (v.age >= c.life.death) causes.push('old age');
    const death = { id: v.id, name: v.name, causes };
    report.deaths.push(death); s.stats.deaths += 1;
    log(s, t('log.death', {name:v.name,id:v.id,causes:causes.map(cause=>t('labels.causes.'+cause)).join(t('labels.separators.cause'))}), 'death');
  }
  s.villagers = s.villagers.filter(v => v.health > 0 && v.age < c.life.death);
  if (!s.villagers.length) {
    s.ended = true; s.speed = 0; s.elapsedMs = 0; s.queuedCommand = null; s.fireLit = false;
    log(s, t('log.ended'), 'end');
    return;
  }
  const eligibleAdults = s.villagers.filter(v => adult(v, c) && v.health >= c.birth.health
    && v.fullness >= c.birth.fullness && v.warmth >= c.birth.warmth && v.happiness >= c.birth.happiness
    && (!c.birth.healthyParentsOnly || !v.illnessDays)&&(!c.learning||!v.campJourney));
  const daughter=s.local?.daughter;
  const easternParents=eligibleAdults.filter(v=>daughter?.members.includes(v.id));
  function parentsAmong(group,requireFood=false,neighbors=[]){
    // Spread families across eligible adults instead of always choosing the
    // first father, which can leave the next generation entirely half-siblings.
    const children=v=>v.childrenBorn??s.villagers.filter(child=>child.parents?.includes(v.id)).length;
    const fewest=group.slice().sort((a,b)=>children(a)-children(b)||a.id-b.id);
    const fathers=[...group,...neighbors].sort((a,b)=>children(a)-children(b)||a.id-b.id);
    for(const mother of fewest.filter(v=>v.gender==='female'&&!(v.recoveryUntil>s.day))){
      const father=fathers.find(v=>v.gender==='male'&&(c.learning?communityOf(s,v)===communityOf(s,mother)||recentVillagePartner(s,mother,v):(v.tribe||0)===(mother.tribe||0))&&unrelated(mother,v));
      if(father&&(!requireFood||familyFoodReady(s,mother)&&familyFoodStable(s,mother)))return [mother,father];
    }
    return [];
  }
  const homeAdults=eligibleAdults.filter(v=>!daughter?.members.includes(v.id));
  const easternPair=parentsAmong(easternParents,false,c.learning?homeAdults:[]);
  const homePair=parentsAmong(homeAdults,false,c.learning?easternParents:[]);
  const readyHomePair=c.learning?parentsAmong(homeAdults,true,easternParents):homePair;
  const easternBirth=daughter?.settled&&easternPair.length===2&&
    daughter.food>=c.birth.foodPerPerson*(daughter.members.length+1)+c.birth.extraFood&&(!c.learning||familyFoodStable(s,easternPair[0]));
  const birthEligible = s.villagers.length < populationCap(s)
    && (c.learning?readyHomePair.length===2||easternBirth:s.food >= c.birth.foodPerPerson * s.villagers.length + c.birth.extraFood)
    && (c.birth.healthyParentsOnly || !s.villagers.some(v => v.illnessDays > 0))
    && ((c.settlement?homePair.length===2:homeAdults.length>=c.birth.adults)||easternBirth);
  s.birthCounter = birthEligible ? s.birthCounter + 1 : 0;
  if(s.local){
    const limits=[];
    if(s.villagers.length>=populationCap(s))limits.push('population cap reached');
    if(c.learning?(homePair.length>0||easternPair.length>0)&&!readyHomePair.length&&!easternBirth:s.food<c.birth.foodPerPerson*s.villagers.length+c.birth.extraFood)
      limits.push(c.learning&&[...homePair,...easternPair].some(v=>v.gender==='female'&&familyFoodReady(s,v))?'waiting for a sustained food surplus':'too little stored food');
    if(!homePair.length&&!easternBirth)limits.push('no eligible pair ready');
    if(!c.birth.healthyParentsOnly&&s.villagers.some(v=>v.illnessDays>0))limits.push('illness in the village');
    s.local.birthConditions=limits.length?limits.join('; '):'conditions met ('+s.birthCounter+'/'+c.birth.consecutiveDays+' consecutive days)';
  }
  if (s.birthCounter >= c.birth.consecutiveDays) {
    const id = s.nextId++;
    const child = villager(id, t('labels.newbornName', {id}), 0, c.newborn, c);
    assignIdentity(s,child);
    if(c.settlement){
      const [mother,father]=easternBirth?easternPair:readyHomePair;
      child.parents=[mother.id,father.id];
      child.parentNames=[mother.name,father.name];
      if(c.learning){
        const origins=crossVillageParents(mother,father);
        if(origins){child.parentCommunities=origins;report.crossVillageBirth=true;s.local.communication??={};s.local.communication.crossVillageBirths=(s.local.communication.crossVillageBirths||0)+1;rememberFamilyVisit(s,mother,father);}
      }
      child.carers=[mother.id,father.id];child.tribe=mother.tribe||0;child.household=mother.household;
      for(const parent of [mother,father])parent.childrenBorn=
        (parent.childrenBorn??s.villagers.filter(v=>v.parents?.includes(parent.id)).length)+1;
      mother.recoveryUntil=s.day+7;
    }
    if(easternBirth){
      child.household=daughter.household;daughter.members.push(id);
    }
    if(c.learning)initPractice(s,child);
    // Newborns are not in today's work/meal/age/timer loop.
    child.activity = 'Newborn';
    if (s.villagers.length >= shelterPlaces(s)) child.safety = c.needs.unsafe;
    s.villagers.push(child); s.birthCounter = 0;
    s.stats.births += 1; s.stats.peak = Math.max(s.stats.peak, s.villagers.length);
    report.birth = id;
    log(s, t('log.birth', {name:child.name}), 'birth');
    // Newborns roll both traits fresh (2 trait-dice steps), at birth.
    if (c.traits) { assignTraits(s, child); devLog(s, child, 'birth', t('traitLog.birth', {name:child.name,traits:traitNames(child)})); }
  }
  if (!s.fireKnown) {
    // Any Gourdling aged 20+ (elders too) counts; happiness is the average.
    const adults = s.villagers.filter(v => v.age >= c.life.adult);
    const eligible = s.day >= c.fire.fromDay && adults.length >= c.fire.adults
      && averageHappiness(s) >= c.fire.happiness && !s.villagers.some(v => v.illnessDays > 0)
      && s.wood >= c.fire.minWood;
    s.fireCounter = eligible ? s.fireCounter + 1 : 0;
    if (s.fireCounter >= c.fire.consecutiveDays) {
      s.fireKnown = true; s.wood -= c.fire.discoveryCost; s.fireCounter = 0; s.stats.fireDay = s.day;
      report.discoveredFire = true;
      log(s, t('log.discovery', {wood:c.fire.discoveryCost}), 'discovery');
    }
  }
  if (!isV02(s)) return;
  // v0.2 day end, after births and the Bonfire: farming discovery, the second
  // shed check, then crop growth (plots planted today grow today too).
  const F = c.farming, n = s.villagers.length;
  const growth=s.local?.season==='Winter'?0:F.growth[report.weather];
  if (!s.farming.known) {
    const trial=s.local?.seedTrial;
    if(trial&&s.day>trial.day)trial.growth=Math.max(0,trial.growth+growth);
    const eligible = s.day >= F.fromDay && s.fireKnown && s.villagers.filter(v => v.age >= c.life.adult).length >= F.adults
      && averageHappiness(s) >= F.happiness && s.food >= F.foodPerPerson * n && !s.villagers.some(v => v.illnessDays > 0);
    s.farming.counter = eligible ? s.farming.counter + 1 : 0;
    if (s.local ? trial?.growth>=F.ripeAt : s.farming.counter >= F.consecutiveDays) {
      unlockFarming(s); report.discoveredFarming = true;
      if(trial){s.farming.plots[0]=F.ripeAt;settlementEvent(s,'The saved seeds bore food. The camp began planting a field.');}
      log(s, t('log.farmingDiscovery', {plots:F.plots}), 'discovery');
    }
  }
  if (s.farming.known && !s.shed.built && !s.shed.pending && n >= c.shed.population && s.wood >= c.shed.wood) {
    s.wood -= c.shed.wood; s.shed.pending = true; report.shedPaid = true;
    log(s, t('log.shedPaid', {wood:c.shed.wood,places:c.shed.places}), 'discovery');
  }
  if(s.local)s.local.surplusDays=s.local.harvests>0&&s.food>=n*2+2?(s.local.surplusDays||0)+1:0;
  s.farming.plots = s.farming.plots.map((x,i) => x === null || x >= cropRipeAt(s,i) ? x : Math.min(cropRipeAt(s,i), Math.max(0, x + growth)));
}

// Explicit one-day tick. Useful for tests and the optional "Next day" button,
// even while paused. Automatic time MUST go through advanceTime (below).
export function stepDay(previous) {
  if (previous.ended) return previous;
  const s = structuredClone(previous), c = s.config;
  if (!s.villagers.length) {
    s.ended = true; s.speed = 0; s.elapsedMs = 0; s.queuedCommand = null;
    log(s, t('log.ended'), 'end');
    return s;
  }
  findHomesteadHealer(s);
  resolveShelterFires(s,(s.day+1)*c.dayMs);
  s.day += 1;
  const report = { day: s.day, command: null, visitOrder: [], actions: [], beforeMeals: [], meals: [],
    damage: [], deaths: [], birth: null, discoveredFire: false, gatheredFood: 0, gatheredWood: 0,
    harvests: 0, plantings: 0, traitEvents: [], traitCandidates: [], traitLines: 0, behaviourRolls: [] };
  // v0.2: a second shed paid for last night stands from today (cap 12).
  if (s.shed.pending) {
    s.shed.pending = false; s.shed.built = true; s.stats.shedDay = s.day;
    log(s, t('log.shedBuilt', {places:shelterPlaces(s)}), 'milestone');
  }
  for (const v of s.villagers) { v.reaction = ''; v.gained = 0; }
  // 1. Apply exactly one queued command.
  if(c.learning)report.foodAtDawn=foodLedger(s);
  applyQueued(s, report);
  // 2. Today's conditions: command weather, else last night's natural roll;
  // then last night's natural illness roll; then Bonfire fuel.
  report.weather = forecastWeather(s);
  report.naturalWeather = s.natural.weather;
  report.illness = null;
  if (s.natural.illness && s.villagers.length) {
    const targets = [...s.villagers].sort((a, b) => a.id - b.id);
    const v = targets[Math.floor(s.natural.target * targets.length / TWO_32)];
    // Someone already ill is not affected again (no stacking or refreshing).
    if (!v.illnessDays) {
      v.illnessDays = c.illness.duration; v.reaction = 'Sick'; report.illness = v.id;
      log(s, t('log.naturalIllness', {name:v.name,days:c.illness.duration}), 'illness');
    }
  }
  if(c.learning&&!s.fireKnown&&s.wood>=c.fire.minWood&&s.villagers.some(v=>v.practice?.known['fire tending']&&v.warmth<55)){s.fireKnown=true;s.stats.fireDay=s.day;}
  const wetTinder=report.weather==='rain'&&!s.fireLit&&s.fireTools?.includes('fire stick')&&!s.fireTools.includes('bow drill');
  s.fireLit = s.fireKnown && s.wood >= c.fire.dailyFuel&&!wetTinder;
  if (s.fireLit) s.wood -= c.fire.dailyFuel;
  report.fireLit = s.fireLit;
  report.burnedWood = s.fireLit ? c.fire.dailyFuel : 0;
  for(let camp=1;camp<(s.tribeCount||1);camp++){
    s.campFires??={};
    const wet=report.weather==='rain'&&!s.campFires[camp]&&s.fireTools?.includes('fire stick')&&!s.fireTools.includes('bow drill');
    const tended=s.villagers.some(v=>v.tribe===camp&&v.age>=c.life.adult);
    s.campFires[camp]=s.fireKnown&&tended&&!wet&&s.wood>=c.fire.dailyFuel;
    if(s.campFires[camp]){
      s.wood-=c.fire.dailyFuel;
      report.burnedWood+=c.fire.dailyFuel;
    }
  }
  // Number order, first place moved along one living Gourdling each day:
  // sorted living numbers rotated left by (day − 1) modulo the population.
  const sorted = [...s.villagers].sort((a, b) => a.id - b.id);
  const index = (s.day - 1) % sorted.length;
  const order = [...sorted.slice(index), ...sorted.slice(0, index)];
  report.visitOrder = order.map(v => v.id);
  const beds=shelterPlaces(s);
  let bedOrder=sorted;
  if(c.settlement&&sorted.length>beds){
    // Keep prior occupants where possible. Grabby adults claim first and
    // Generous adults yield first. Rotating work order breaks remaining ties.
    const priority=v=>(hasTrait(s,v,'Grabby')?4:0)-(hasTrait(s,v,'Generous')?4:0)
      +Number(v.age<c.life.adult)*2+Number(v.outdoors===false);
    bedOrder=[...order].sort((a,b)=>priority(b)-priority(a));
  }
  const shelteredIds = new Set(bedOrder.filter(v=>!v.herbalist?.home).slice(0,beds).map(v=>v.id));
  for(const v of order)if(v.herbalist?.home)shelteredIds.add(v.id);
  if(c.settlement)for(const v of order)v.outdoors=!shelteredIds.has(v.id);
  // 3. Lower everyone's needs, then recheck stocks after EACH person's one action.
  for (const v of order) {
    v.illToday = v.illnessDays > 0;
    changeNeed(v, 'fullness', -c.needs.fullnessLoss, c);
    // Sum ALL of today's warmth changes, then clamp once (design section 3).
    // Hardy: a smaller cold-snap loss. Shivery: extra loss in rain and cold snaps.
    const P = c.personality, shivery = hasTrait(s, v, 'Shivery') ? P.shiveryExtraLoss : 0;
    const weatherLoss = report.weather === 'rain' ? c.needs.rainWarmthLoss + shivery
      : report.weather === 'cold' ? (hasTrait(s, v, 'Hardy') ? P.hardyColdLoss : c.needs.coldWarmthLoss + shivery) : 0;
    const household=c.settlement?s.hutDetails?.[sleepingHut(s,v)]:null;
    const eastern=s.local?.daughter?.members.includes(v.id);
    const visiting=v.campJourney?.to;
    const localFire=v.herbalist?.home?false:visiting==='east'?s.local.daughter?.wood>0:
      visiting!==undefined?campFireLit(s,visiting):eastern?s.local.daughter.wood>0:campFireLit(s,v.tribe);
    const heated=localFire&&household?(household.ondol?6:household.chimney?2:0):0;
    const shelterBonus=(c.settlement&&s.settlementWork>=c.settlement.shelterWork?c.settlement.shelterBonus:0)+heated;
    const bedding=v.outdoors && v.beddingUntil>=s.day ? c.needs.shelterWarmth : 0;
    changeNeed(v, 'warmth', -c.needs.warmthLoss - weatherLoss + bedding + (s.textiles?.includes('loom')?2:0) + (shelteredIds.has(v.id)?shelterBonus:0)
      + (shelteredIds.has(v.id) ? c.needs.shelterWarmth : 0) + (localFire ? c.needs.fireWarmth : 0), c);
  }
  if(c.hunting){
    s.gameAnimals??=c.hunting.herdSize;
    if(s.lastUsed.godzilla!==s.day&&s.day%c.hunting.returnEvery===0)s.gameAnimals=Math.min(c.hunting.herdSize,s.gameAnimals+1);
  }
  if(c.learning){beginSettlementDay(s);planLessons(s,order);}
  work(s, order, report);
  if(s.local){
    completeMagicLessons(s,report);
    completeCerealLessons(s,report);
    seasonalStores(s,report);
    wearCampPaths(s,report);
    weeklyWork(s,report);
  }
  // 4. Work is all finished before any meals: meals (Grabby first), then
  // damage, recovery, safety and happiness in the rotated order.
  meals(s, order, report);
  if(s.local)s.local.inventions=inventionProgress(s).known;
  for (const v of order) resolveNeeds(s, v, shelteredIds.has(v.id), report);
  if(c.learning)recordFoodBalance(s,report);
  // 5. Age, deaths, birth, then natural fire discovery.
  resolveLivesAndDiscovery(s, report);
  if(s.local){
    const history=s.local.populationHistory??=[];
    let period=history.at(-1);
    if(!period||Math.floor((period.first-1)/20)!==Math.floor((s.day-1)/20)){
      period={first:s.day,last:s.day,births:0,deaths:0,oldAge:0,personDays:0};
      history.push(period);
    }
    period.last=s.day;period.personDays+=order.length;
    period.births+=Number(report.birth!=null);period.deaths+=report.deaths.length;
    period.oldAge+=report.deaths.filter(d=>d.causes.includes('old age')).length;
  }
  if(c.learning){
    if(s.bankFood)s.bankFood=Math.min(s.food,s.bankFood);
    s.local.dried=Math.min(s.food,s.local.dried);
    const lost=new Set();
    for(const dead of order.filter(v=>!s.villagers.includes(v))){
      const death=report.deaths.find(d=>d.id===dead.id);
      const entry={day:s.day,type:'death',text:dead.name+' died of '+death.causes.join(' and ')+'.'};
      (s.local.deathHistory??=[]).push(entry);
      settlementEvent(s,entry.text);s.local.events.at(-1).type='death';
      for(const id of Object.keys(dead.practice?.known||{})){
        if(s.local.first[id]!==undefined&&!s.villagers.some(v=>v.practice?.known[id]))lost.add(id);
      }
    }
    for(const id of lost)settlementEvent(s,'The last practitioner of '+id+' died.');
    if(report.birth!=null){
      const child=s.villagers.find(v=>v.id===report.birth),eastern=s.local.daughter?.members.includes(child.id);
      const text=child.name+' was born'+(child.parentNames?.length?' to '+child.parentNames.join(' and '):'')+
        (eastern?' in the eastern village':'')+'.';
      const entry={day:s.day,type:'birth',id:child.id,name:child.name,parentNames:[...(child.parentNames||[])],text};
      s.local.birthHistory.push(entry);settlementEvent(s,text);Object.assign(s.local.events.at(-1),entry);
    }
  }
  if(c.tribeThresholds&&s.villagers.length){
    const count=s.tribeCount||1;
    const members=Array.from({length:count},(_,i)=>s.villagers.filter(v=>(v.tribe||0)===i));
    const adultsByCamp=members.map(group=>group.filter(v=>v.age>=c.life.adult));
    if(report.birth){
      const newborn=s.villagers.find(v=>v.id===report.birth);
      if(!newborn.carers)newborn.tribe=bestHome(s,newborn);
      if(s.local&&!newborn.carers){
        const guardian=s.villagers.find(v=>adult(v,c)&&!v.illnessDays&&!s.local.daughter?.members.includes(v.id)&&(v.tribe||0)===newborn.tribe);
        if(guardian)newborn.carers=[guardian.id];
      }
    }
    if((s.settlementWork>=c.settlement.shelterWork||order.length>beds)&&s.villagers.length>=c.tribeThresholds[count-1]){
      let founders=null,highest=-Infinity;
      for(const adults of adultsByCamp.filter(group=>group.length>=4)){
        for(let i=0;i<adults.length;i++)for(const other of adults.slice(i+1)){
          const fit=affinity(adults[i],other,c.personality.list);
          if(fit>highest){highest=fit;founders=[adults[i],other];}
        }
      }
      if(founders){
        for(const founder of founders)founder.tribe=count;
        s.tribeCount=count+1;
        log(s,founders.map(v=>v.name).join(' and ')+' founded a new camp together.','discovery');
      }
    }else if(count>1&&!c.learning){
      let mover=null,destination=0,gain=.99;
      // Live homesteads move through paid neighbor visits. Preserve the
      // original personality migration for reference-rule replays only.
      for(const v of s.villagers){
        const from=v.tribe||0;
        if(v.age<c.life.adult||adultsByCamp[from].length<=2)continue;
        const to=bestHome(s,v);
        const improvement=campFit(v,members[to],c.personality.list)-campFit(v,members[from],c.personality.list);
        if(to!==from&&improvement>gain){mover=v;destination=to;gain=improvement;}
      }
      if(mover){mover.tribe=destination;log(s,mover.name+' joined camp '+(destination+1)+'.','info');}
    }
  }
  if(s.local){maintainHouseholds(s);s.local.inventions=inventionProgress(s).known;
    const post=s.local.daughter;
    if(post?.members.length){post.members=post.members.filter(id=>s.villagers.some(v=>v.id===id));if(!post.members.length)post.closed=s.day;}
  }
  if(c.settlement)updateBelief(s,report);
  s.lastDay = report;
  // Wipeout stops immediately: no wonder, timers or dice after the last death.
  if (s.ended) return s;
  // 6. Power, effect timers, milestones, and a compact daily explanation.
  const powerGain = c.power ? c.power.daily + (averageHappiness(s) >= c.power.happyAverage ? c.power.happyBonus : 0) : 0;
  if (c.power) s.power = clamp(s.power + powerGain, c.limits.power);
  if (s.weather.daysLeft > 0 && --s.weather.daysLeft === 0) s.weather.type = 'normal';
  for (const v of s.villagers) if (v.illnessDays > 0) v.illnessDays -= 1;
  rollNight(s); // Tomorrow's weather, illness and who falls ill.
  finishDivinations(s,tomorrowWeather(s));
  log(s, t(c.power ? 'log.day' : 'log.homesteadDay', {food:report.gatheredFood,wood:report.gatheredWood,meals:report.meals.length,
    fire:s.fireKnown ? (s.fireLit?t('log.fireLit',{wood:report.burnedWood}):t('log.fireOut')):t('log.fireUnknown'),
    power:powerGain,cap:c.limits.power}));
  if (!s.milestoneReached && s.day >= c.milestone.day && s.villagers.length >= c.milestone.population && s.fireKnown) {
    s.milestoneReached = true;
    log(s, t('log.milestone', {population:s.villagers.length,day:s.day}), 'milestone');
  }
  return s;
}

// Real time is an input, so playback is deterministic too. Pausing preserves the
// unfinished fraction of a day; it never advances weather, illness or cooldowns.
function resolveShelterFires(s,now){
  if(!s.hutFires?.length)return;
  const ongoing=[];
  for(const fire of s.hutFires){
    if(fire.end>now){ongoing.push(fire);continue;}
    if(fire.slot>=0&&fire.slot>=(s.huts?.length||0))continue;
    const saved=currentWeather(s)==='rain'||fire.helpers.some(id=>s.villagers.some(v=>v.id===id));
    if(fire.slot===-1)s.settlementWork=Math.max(0,Math.min(s.config.settlement.shelterWork,s.settlementWork)-(saved?1:s.config.settlement.shelterWork));
    else{
      s.hutDetails??=[];
      const hut=s.hutDetails[fire.slot]??={};hut.scorched=true;hut.ruined=!saved;
    }
    s.fireNotice=saved?'The shelter fire is out. The timbers are scorched.':'A shelter burned down. Its sleeping places are lost until it is rebuilt.';
    s.fireRevision=(s.fireRevision||0)+1;
    log(s,s.fireNotice,'disaster');
  }
  s.hutFires=ongoing;
}
export function advanceTime(previous, elapsedMs) {
  if (previous.speed === 0 || previous.ended) return previous;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError(t('errors.time'));
  let s = { ...previous, elapsedMs: previous.elapsedMs + elapsedMs * previous.speed };
  if(s.hutFires?.some(f=>f.end<=s.day*s.config.dayMs+s.elapsedMs)){
    s=structuredClone(s);resolveShelterFires(s,s.day*s.config.dayMs+s.elapsedMs);
  }
  while (s.elapsedMs >= s.config.dayMs && !s.ended) {
    s.elapsedMs -= s.config.dayMs;
    s = stepDay(s);
  }
  return s;
}
