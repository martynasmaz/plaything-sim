import {practices,availablePractices} from './practices.js';
import {healerMedicineStore} from './healer-home.js';
import {magicEnabled,magicPracticeIds} from './magic.js';
import {observeEvents} from './village-events.js';
import {visibleResources} from './resources.js';
import {createEncyclopedia} from './encyclopedia.js';
import {drawRockRecord} from './paintings-view.js';
import {SCENARIO} from './scenario.js';
import {createLivestockNotebook} from './husbandry-notebook.js';
import {storageCapacity,granaryRules,granaryFinished} from './storage.js';
import {bridgeUpgradeRules} from './river.js';
import {familyDescription} from './family-motivation.js';
import {hearthRules,ovenFinished} from './hearths.js';

const resourceIcons={food:'🍲',wood:'🪵',stone:'🪨',fibre:'🌾',clay:'🏺',resin:'💧',hide:'🦌',charcoal:'🔥',fish:'🐟',berries:'🫐',bone:'🦴',herbs:'🌿',boneMeal:'🌱',wheat:'🌾',flour:'🥣',quernStone:'🪨',hay:'🌾',milk:'🥛',curds:'🥣',wool:'🐑',woolYarn:'🧶',woolCloth:'🧵',manure:'🌱',compost:'🌱',fodderGrain:'🌾'};

function notebookResources(host,title){
  const heading=document.createElement('h3'),grid=document.createElement('dl');
  heading.textContent=title;
  grid.setAttribute('aria-label',title);
  host.append(heading,grid);
  const cells=new Map();
  return amounts=>{
    for(const [key,value] of cells)value.parentNode.hidden=!(key in amounts);
    for(const [key,amount] of Object.entries(amounts)){
      if(!cells.has(key)){
        const row=document.createElement('div'),label=document.createElement('dt');
        const icon=document.createElement('span'),value=document.createElement('dd');
        icon.setAttribute('aria-hidden','true');
        icon.textContent=resourceIcons[key]||'•';
        const names={boneMeal:'Bone meal',quernStone:'Grinding stone',woolYarn:'Wool yarn',woolCloth:'Wool cloth',fodderGrain:'Fodder grain'};
        label.append(icon,names[key]||key[0].toUpperCase()+key.slice(1));
        row.append(label,value);grid.append(row);cells.set(key,value);
      }
      const value=cells.get(key),count=key==='food'||key==='charcoal'?Math.round(amount*100)/100:Math.floor(amount);
      value.parentNode.hidden=false;
      value.textContent=String(count);
      value.classList.toggle('empty-stock',count===0);
    }
  };
}

// A non-modal field notebook for the same save and clock as the clearing.
export function createNotebook(readState,changeSpeed,{isPhone=()=>false,changeNeeds=null}={}){
  const panel=document.createElement('dialog');
  panel.className='settlement-notebook';
  panel.setAttribute('aria-label','Settlement notebook');
  panel.style.cssText='position:fixed;inset:4vh 2vw auto auto;margin:0;width:min(430px,92vw);max-height:88vh;overflow:auto;z-index:30;background:#efe3c6;color:#332e24;border:2px solid #65533e;padding:16px;font:15px/1.4 Georgia,serif';
  panel.innerHTML='<button style="float:right" aria-label="Close notebook">Close</button><h2>Settlement notebook</h2><p data-clock></p><nav><button data-rate="0">Pause</button> <button data-rate="1">Resume</button> <button data-rate="3">3×</button></nav><p data-stocks></p><label>Villager <select></select></label><p data-person></p><details open><summary>Techniques · known / used by living villagers</summary><div data-ideas></div></details><details open><summary>Village events</summary><label>Show <select data-event-filter><option value="all">All events</option><option value="births">Births only</option><option value="deaths">Deaths only</option><option value="life">Births and deaths</option><option value="other">Hide deaths</option></select></label><ol data-events></ol></details>';
  document.body.append(panel);
  const el=q=>panel.querySelector(q),select=el('select');
  const needsSelectors=[];
  if(changeNeeds){
    const settings=document.createElement('details');settings.innerHTML='<summary>Simulation settings</summary><p>Food production continues when eating is off.</p>';
    for(const [key,title] of [['eatsFood','Eats food'],['hungerDeathsEnabled','Hunger deaths']]){
      const label=document.createElement('label'),choice=document.createElement('select');
      label.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0';label.textContent=title+' ';
      choice.setAttribute('aria-label',title);choice.innerHTML='<option value="yes">Yes</option><option value="no">No</option>';
      choice.onchange=()=>changeNeeds(key,choice.value==='yes');label.append(choice);settings.append(label);needsSelectors.push({key,choice});
    }
    panel.append(settings);
  }
  const census=document.createElement('details');
  census.innerHTML='<summary><strong>Population history</strong></summary><p data-totals></p><p data-conditions></p><p data-period-note></p><div style="overflow:auto;max-height:270px"><table style="width:100%;text-align:center"><caption>Natural population change by period</caption><thead><tr><th>Days</th><th>Births</th><th>Deaths</th><th>Old age¹</th><th>Net</th><th>Rate²</th></tr></thead><tbody></tbody></table></div><small>¹ Deaths involving old age, included in Deaths. ² Births per 100 villagers per day, based on the population at the start of each day. Net is births minus deaths; spawned settlers are not births.</small>';
  el('nav').after(census);
  const growthInfo=document.createElement('p'),familyChecks=document.createElement('details'),familyList=document.createElement('ul');
  const familyTitle=document.createElement('summary');familyTitle.textContent='Why families are waiting';
  familyChecks.append(familyTitle,familyList);census.append(growthInfo,familyChecks);
  const encyclopedia=createEncyclopedia(panel,readState);
  const livestockNotebook=createLivestockNotebook(panel,readState);
  const paintings=document.createElement('details');paintings.hidden=true;paintings.innerHTML='<summary>Discovered rock paintings</summary><div></div>';panel.append(paintings);
  let paintingKey='';
  function drawCensus(s){
    const h=s.local.populationHistory||[];
    census.querySelector('[data-totals]').textContent='Lifetime: '+s.stats.births+' births · '+s.stats.deaths+' deaths · '+s.villagers.length+' alive.';
    census.querySelector('[data-conditions]').textContent=s.ended?'No living villagers.':s.local.birthConditions?'Last daily birth check: '+s.local.birthConditions+'.':'Birth conditions will be checked at the next dawn.';
    const growth=s.local.growth,now=growth?.current;
    growthInfo.textContent=now?now.children+' children · '+now.workingAgeAdults+' adults of reproductive age · '+(now.dependents-now.children)+' elders. '+growth.matured+' reached adulthood ('+growth.bornMatured+' born since tracking began); '+growth.childDeaths+' child deaths. Tracking from day '+growth.sinceDay+'.':'';
    const reasonNames={parent_health:'recovering health',parent_unwilling:'does not want a child',parent_hunger:'parent needs food',parent_cold:'parent needs warmth',parent_happiness:'not feeling ready for a child',parent_illness:'parent is ill',parent_travel:'parent is traveling',parent_age:'outside reproductive age',maternal_recovery:'recovering after childbirth',no_unrelated_partner:'no unrelated partner',separated_partners:'partners have not met locally',housing_capacity:'more housing needed',insufficient_finished_food:'too little accessible finished food',recent_local_hunger:'recent hunger in this community',declining_food_reserves:'accessible food reserves are declining',learned_household_caution:'saving provisions for another child'};
    const diagnostics=s.local.familyDiagnostics;
    familyList.replaceChildren(...(diagnostics?.families||[]).map(row=>{
      const item=document.createElement('li'),name=s.villagers.find(v=>v.id===row.motherId)?.name||s.local.genealogy?.people?.[row.motherId]?.name||'Villager '+row.motherId;
      item.textContent=name+': '+(row.birthId?'welcomed a child':row.reasons.length?row.reasons.map(r=>reasonNames[r]||r).join('; '):'readiness '+row.days+'/'+s.config.birth.consecutiveDays)+(row.reset?' (readiness interrupted)':'');
      return item;
    }));
    familyChecks.hidden=!diagnostics?.families.length;
    census.querySelector('[data-period-note]').textContent=h.length?'Recorded from day '+h[0].first+'. Newest period first; each row covers up to 20 days.':'No dated records yet. Tracking starts on the next completed day.';
    census.querySelector('tbody').replaceChildren(...h.slice().reverse().map(p=>{
      const row=document.createElement('tr'),net=p.births-p.deaths;
      for(const value of [p.first===p.last?p.first:p.first+'–'+p.last,p.births,p.deaths,p.oldAge,(net>0?'+':'')+net,(100*p.births/p.personDays).toFixed(2)]){
        const td=document.createElement('td');td.textContent=value;row.append(td);
      }
      return row;
    }));
  }
  census.ontoggle=()=>{if(census.open)drawCensus(readState());};
  const supplies=document.createElement('section');
  supplies.className='notebook-supplies';
  el('[data-stocks]').replaceWith(supplies);
  const styles=document.createElement('style');
  styles.textContent=`
    .notebook-supplies{margin:16px 0 20px}
    .notebook-supplies h3{color:#485038;font: bold 16px Georgia,serif;margin:14px 0 6px;border-bottom:1px solid #ab9978;padding-bottom:4px}
    .notebook-supplies dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(114px,100%),1fr));gap:5px;margin:0}
    .notebook-supplies dl>div{display:flex;align-items:center;justify-content:space-between;gap:4px;background:#f8efd9;border:1px solid #cebea1;border-radius:4px;padding:5px 7px}
    .notebook-supplies dl>div[hidden]{display:none}
    .notebook-supplies dt{display:flex;align-items:center;gap:5px;font-size:14px}
    .notebook-supplies dt span{width:19px;text-align:center;font-family:"Segoe UI Emoji",sans-serif}
    .notebook-supplies dd{margin:0;font-weight:bold;font-variant-numeric:tabular-nums}
    .notebook-supplies .empty-stock{color:#893f2e;background:#eed7bc;border-radius:3px;padding:0 4px}
  `;
  panel.append(styles);
  const showStores=notebookResources(supplies,'Camp stores');
  const showDeposits=notebookResources(supplies,'Wild deposits');
  const winterStores=document.createElement('p');supplies.append(winterStores);
  const magicNotes=document.createElement('details');magicNotes.hidden=true;
  const magicTitle=document.createElement('summary'),magicInfo=document.createElement('p'),omens=document.createElement('ul');
  magicTitle.textContent='Omens and folk magic';magicNotes.append(magicTitle,magicInfo,omens);supplies.after(magicNotes);
  const uses=document.createElement('details'),summary=document.createElement('summary'),records=document.createElement('ul');
  summary.textContent='Weekly tool use';
  uses.append(summary,records);supplies.after(uses);
  el('button').onclick=()=>panel.close();
  for(const button of panel.querySelectorAll('[data-rate]'))button.onclick=()=>{changeSpeed(Number(button.dataset.rate));draw();};
  function draw(){
    for(const {key,choice} of needsSelectors)choice.value=readState().config.needs[key]===false?'no':'yes';
    if(!panel.open)return;
    const s=readState(),l=s.local;if(!l)return;
    encyclopedia.draw();
    livestockNotebook.draw();
    const found=(l.paintings||[]).filter(p=>p.discoveredDay!==undefined);
    paintings.hidden=!found.length;
    const nextPaintingKey=s.seed+'/'+found.map(p=>p.id+':'+p.readBy.length).join('/');
    if(nextPaintingKey!==paintingKey){paintingKey=nextPaintingKey;paintings.querySelector('div').replaceChildren(...found.map(p=>{
      const row=document.createElement('p'),image=document.createElement('canvas'),caption=document.createElement('span');image.width=180;image.height=100;image.style.width='130px';image.style.display='block';
      const g=image.getContext('2d');g.fillStyle='#e3d7b6';g.fillRect(0,0,180,100);drawRockRecord(g,90,83,p);
      caption.textContent=p.motif+' · painted by '+p.authorName+' on day '+p.day+' · '+p.readBy.length+' readers. Pictures offer clues; they do not replace practice.';row.append(image,caption);return row;
    }));}
    if(census.open)drawCensus(s);
    el('[data-clock]').textContent=SCENARIO.name+' r'+SCENARIO.revision+' · Seed '+s.seed+' · Day '+s.day+' · '+l.season+' · '+s.villagers.length+' people · '+(s.speed?s.speed+'×':'paused');
    const stocks={food:s.food,wood:s.wood,...l.stock};
    magicNotes.hidden=!magicEnabled(s);
    if(magicEnabled(s)){
      const m=l.magic,hearths=Object.values(m.hearths||{}).filter(w=>w.until>=s.day).length;
      magicInfo.textContent='Awakened on day '+m.enabledDay+' · '+m.casts+' completed rites · '+hearths+' active hearth charms'+
        (m.pantry?.until>=s.day?' · stores warded through day '+m.pantry.until:'')+'. Omens describe the next dawn; the god can still change events.';
      omens.replaceChildren(...(m.omens||[]).slice(-6).reverse().map(o=>{
        const item=document.createElement('li');item.textContent='Reading on day '+o.day+' for day '+o.forDay+': '+o.text;return item;
      }));
    }
    records.replaceChildren(...(l.inventions||[]).map(item=>{
      const li=document.createElement('li'),use=l.weeklyUses?.[item];
      li.textContent=use?item+' · Day '+use.day+' · '+use.name+' · '+use.action+' ('+use.result+')':item+' · awaiting practice';
      return li;
    }));
    showStores(visibleResources(s,stocks));
    showDeposits(visibleResources(s,l.deposits));
    winterStores.textContent=Object.entries(l.campStores||{}).filter(([,r])=>r.built||r.houseCapacity||r.granary)
      .map(([camp,r])=>'Camp '+(Number(camp)+1)+' · '+r.rack+' drying · '+r.saved+' / '+storageCapacity(r)+' stored for winter'+
        ' · reserve target '+Math.ceil((l.campPeakPopulation?.[camp]||0)*s.config.learning.seasonLength*s.config.needs.mealCost)+
        (r.houseCapacity?' · '+r.houseCapacity+' space in homes':'')+
        (r.granary?' · granary '+r.granary.work+'/'+granaryRules.work+(granaryFinished(r)?' · '+(r.granary.bins||0)+' extra bin sets': ' under construction'):'')).join(' | ');
    if(l.bridgeUpgrade)winterStores.textContent+=' Bridge: handrails '+l.bridgeUpgrade.railWork+'/'+bridgeUpgradeRules.railWork+' · bracing '+l.bridgeUpgrade.braceWork+'/'+bridgeUpgradeRules.braceWork+'.';
    for(const [camp,oven] of Object.entries(l.ovens||{}))winterStores.textContent+=' Camp '+(Number(camp)+1)+' oven: '+(ovenFinished(oven)?'completed · half baking fuel':oven.work+'/'+hearthRules.ovenWork+' workdays')+'.';
    const soil=Object.entries(s.farming.boneSoil||{}).filter(([,f])=>f.remaining>0);
    const composted=Object.entries(s.farming.manureSoil||{}).filter(([,f])=>f.remaining>0);
    if(composted.length)winterStores.textContent+=' Compost-fed plots: '+composted.map(([i,f])=>(Number(i)+1)+' ('+f.remaining+' harvests remaining)').join(', ')+'.';
    if(soil.length)winterStores.textContent+=' Bone-fed plots: '+soil.map(([i,f])=>(Number(i)+1)+' ('+
      (f.readyDay>s.day?'available from day '+f.readyDay:f.remaining+' harvests remaining')+')').join(', ')+'.';
    if(s.farming.querns?.length||s.farming.wheatHarvests)winterStores.textContent+=' Wheat: '+(s.farming.wheatHarvests||0)+
      ' harvest trips · '+(s.farming.querns?.length||0)+' saddle querns · '+(s.farming.breadBaked||0)+
      ' bread portions baked. Grain and flour need processing; finished bread enters the food stores.';
    const post=l.daughter;
    if(s.farming.known)winterStores.textContent+=' Fields: '+s.farming.plots.length+(s.farming.expansion?' · new field '+s.farming.expansion.work+'/3 prepared':'')+'.';
    if(post?.members.length){
      const names=s.villagers.filter(v=>post.members.includes(v.id)).map(v=>v.name);
      winterStores.textContent+=' Eastern '+(post.settled?'village':'outpost')+' · '+names.join(', ')+
        ' · '+post.food+' food · '+post.wood+' wood · '+post.returnFood+' return rations. Type “recall settlers” to bring them home.';
    }
    winterStores.hidden=!winterStores.textContent;
    const ids=s.villagers.map(v=>v.id).join(',');
    if(ids!==select.dataset.ids){
      const old=select.value;select.replaceChildren(...s.villagers.map(v=>new Option(v.name,v.id)));select.dataset.ids=ids;
      if([...select.options].some(o=>o.value===old))select.value=old;
    }
    const v=s.villagers.find(v=>v.id===Number(select.value));
    if(v){
      const p=v.practice,describe=obj=>Object.entries(obj).map(([k,n])=>(practices[k]?.name||k)+' '+Number(n.toFixed(1))).join(', ')||'none';
      el('[data-person]').textContent=v.name+' · '+v.activity+(v.motivation?' · Priority: '+v.motivation.need+' — '+v.motivation.reason:'')+' · age '+v.age+'/'+s.config.life.death+' · hunger '+(100-v.fullness)+' · energy '+p.energy+' · health '+v.health+' · curiosity '+p.curiosity.toFixed(2)+'. Skills: '+describe(p.skills)+'. Properties: '+(p.properties.join(', ')||'none')+'. Proficiency: '+describe(p.known)+'. Experiments: '+describe(p.progress)+'.';
      const family=s.villagers.filter(other=>other.id!==v.id&&other.household===v.household).map(other=>other.name);
      el('[data-person]').textContent+=' '+familyDescription(s,v);
      const friends=s.villagers.filter(other=>v.favors?.[other.id]).sort((a,b)=>v.favors[b.id]-v.favors[a.id]);
      if(v.herbalist){
        const supplies=healerMedicineStore(s,v),home=s.local.healerHome;
        el('[data-person]').textContent+=(v.herbalist.home?' Lives at the woodland herb shelter.':' Prepares remedies while living in camp.')+
          ' Gathers plants for sick neighbors. Remedies ready: '+supplies.doses+' · visits made: '+v.herbalist.visits+'.'+
          (home?.ownerId===v.id?' Herb hut: '+home.work+'/6 · drying rack: '+home.rackWork+'/2 · leaf sign and herb thatch: '+home.markerWork+'/2.':'');
        if(home?.ownerId===v.id&&s.lastDay?.healerProject?.ownerId===v.id)el('[data-person]').textContent+=' '+s.lastDay.healerProject.reason;
        const pupil=s.villagers.find(p=>p.healerApprentice?.mentorId===v.id);
        if(pupil)el('[data-person]').textContent+=' Apprentice: '+pupil.name+'.';
      }
      if(v.healerApprentice){
        const a=v.healerApprentice,mentor=s.villagers.find(p=>p.id===a.mentorId&&p.herbalist);
        el('[data-person]').textContent+=' Healing apprenticeship with '+a.mentorName+(mentor?'':' (mentor deceased)')+
          ': plant gathering '+a.plantDays+'/2 · remedy preparation '+a.remedyDays+'/3 · patient care '+a.patientDays+'/2.'+
          (a.readyDay!==undefined?' Trained; can become the healer when the position is vacant and they reach adulthood.':'');
      }
      if(magicEnabled(s)){
        const lore=magicPracticeIds.filter(id=>p.known[id]).map(id=>practices[id].name);
        if(lore.length)el('[data-person]').textContent+=' Folk lore: '+lore.join(', ')+'.'+
          (p.gear['casting bones']?' Carries a set of divining bones.':'')+
          (p.lastMagicDay!==undefined?' Last rite: day '+p.lastMagicDay+'.':'');
      }
      if(friends.length)el('[data-person]').textContent+=' Remembers help from '+friends.map(p=>p.name).join(', ')+'.';
      if(v.axeWear>=4)el('[data-person]').textContent+=' Axe needs repair.';
      if(v.practice.inspiration?.until>=s.day)el('[data-person]').textContent+=' Wonders: '+v.practice.inspiration.question+' Inspired through day '+v.practice.inspiration.until+'.';
      if(v.practice.occupation)el('[data-person]').textContent+=' Usual work: '+v.practice.occupation.role+' since day '+v.practice.occupation.since+'. Immediate needs still come first.';
      if(v.huntsWon)el('[data-person]').textContent+=' Successful game hunts: '+v.huntsWon+'.';
      if(family.length)el('[data-person]').textContent+=' Household: '+family.join(', ')+'.';
      if(v.parentNames)el('[data-person]').textContent+=' Parents: '+v.parentNames.join(' and ')+'.';
      if(v.parentCommunities)el('[data-person]').textContent+=' Family connections: '+v.parentCommunities.map(c=>c==='east'?'the eastern village':'camp '+(c+1)).join(' and ')+'.';
      const neighbors=Object.values(p.neighbors||{});
      if(neighbors.length)el('[data-person]').textContent+=' Visited or hosted: '+neighbors.slice(-4).map(n=>n.name).join(', ')+'.';
      if(v.recoveryUntil>s.day)el('[data-person]').textContent+=' Recovering after childbirth.';
      if(p.known.familyplanning){
        el('[data-person]').textContent+=' Knows household planning.';
        if(p.familyDecision)el('[data-person]').textContent+=' Day '+p.familyDecision.day+': '+p.familyDecision.reason+'.';
      }
      if(v.age<s.config.life.adult&&v.carers?.length)el('[data-person]').textContent+=' Caregivers: '+v.carers.map(id=>s.villagers.find(p=>p.id===id)?.name).filter(Boolean).join(' and ')+'.';
    }else el('[data-person]').textContent='No living villagers.';
    el('[data-ideas]').replaceChildren(...availablePractices(s).map(r=>{
      const row=document.createElement('div');
      row.textContent=r.name+': '+s.villagers.filter(v=>v.practice.known[r.id]).length+' / '+s.villagers.filter(v=>v.practice.used[r.id]).length+(l.first[r.id]===undefined?'':' · first day '+l.first[r.id]);return row;
    }));
    const mode=el('[data-event-filter]').value;
    el('[data-events]').replaceChildren(...observeEvents(l,mode).map(e=>{
      const li=document.createElement('li');li.textContent='Day '+e.day+' · '+e.text;return li;
    }));
  }
  select.onchange=draw;el('[data-event-filter]').onchange=draw;
  return {draw,close(){if(panel.open)panel.close();},isOpen:()=>panel.open,
    open(){if(!panel.open){if(isPhone())panel.showModal();else panel.show();}draw();}};
}
