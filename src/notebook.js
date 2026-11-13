import {practices} from './practices.js';

const resourceIcons={food:'🍲',wood:'🪵',stone:'🪨',fibre:'🌾',clay:'🏺',resin:'💧',hide:'🦌',charcoal:'🔥',fish:'🐟',berries:'🫐'};

function notebookResources(host,title){
  const heading=document.createElement('h3'),grid=document.createElement('dl');
  heading.textContent=title;
  grid.setAttribute('aria-label',title);
  host.append(heading,grid);
  const cells=new Map();
  return amounts=>{
    for(const [key,amount] of Object.entries(amounts)){
      if(!cells.has(key)){
        const row=document.createElement('div'),label=document.createElement('dt');
        const icon=document.createElement('span'),value=document.createElement('dd');
        icon.setAttribute('aria-hidden','true');
        icon.textContent=resourceIcons[key]||'•';
        label.append(icon,key[0].toUpperCase()+key.slice(1));
        row.append(label,value);grid.append(row);cells.set(key,value);
      }
      const value=cells.get(key),count=Math.floor(amount);
      value.textContent=String(count);
      value.classList.toggle('empty-stock',count===0);
    }
  };
}

// A non-modal field notebook for the same save and clock as the clearing.
export function createNotebook(readState,changeSpeed){
  const panel=document.createElement('dialog');
  panel.setAttribute('aria-label','Settlement notebook');
  panel.style.cssText='position:fixed;inset:4vh 2vw auto auto;margin:0;width:min(430px,92vw);max-height:88vh;overflow:auto;z-index:30;background:#efe3c6;color:#332e24;border:2px solid #65533e;padding:16px;font:15px/1.4 Georgia,serif';
  panel.innerHTML='<button style="float:right" aria-label="Close notebook">Close</button><h2>Settlement notebook</h2><p data-clock></p><nav><button data-rate="0">Pause</button> <button data-rate="1">Resume</button> <button data-rate="3">3×</button></nav><p data-stocks></p><label>Villager <select></select></label><p data-person></p><details open><summary>Techniques · known / used by living villagers</summary><div data-ideas></div></details><details open><summary>Village events</summary><label>Show <select data-event-filter><option value="all">All events</option><option value="deaths">Deaths only</option><option value="other">Hide deaths</option></select></label><ol data-events></ol></details>';
  document.body.append(panel);
  const el=q=>panel.querySelector(q),select=el('select');
  const census=document.createElement('details');
  census.innerHTML='<summary><strong>Population history</strong></summary><p data-totals></p><p data-conditions></p><p data-period-note></p><div style="overflow:auto;max-height:270px"><table style="width:100%;text-align:center"><caption>Natural population change by period</caption><thead><tr><th>Days</th><th>Births</th><th>Deaths</th><th>Old age¹</th><th>Net</th><th>Rate²</th></tr></thead><tbody></tbody></table></div><small>¹ Deaths involving old age, included in Deaths. ² Births per 100 villagers per day, based on the population at the start of each day. Net is births minus deaths; spawned settlers are not births.</small>';
  el('nav').after(census);
  function drawCensus(s){
    const h=s.local.populationHistory||[];
    census.querySelector('[data-totals]').textContent='Lifetime: '+s.stats.births+' births · '+s.stats.deaths+' deaths · '+s.villagers.length+' alive.';
    census.querySelector('[data-conditions]').textContent=s.ended?'No living villagers.':s.local.birthConditions?'Last daily birth check: '+s.local.birthConditions+'.':'Birth conditions will be checked at the next dawn.';
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
    .notebook-supplies dt{display:flex;align-items:center;gap:5px;font-size:14px}
    .notebook-supplies dt span{width:19px;text-align:center;font-family:"Segoe UI Emoji",sans-serif}
    .notebook-supplies dd{margin:0;font-weight:bold;font-variant-numeric:tabular-nums}
    .notebook-supplies .empty-stock{color:#893f2e;background:#eed7bc;border-radius:3px;padding:0 4px}
  `;
  panel.append(styles);
  const showStores=notebookResources(supplies,'Camp stores');
  const showDeposits=notebookResources(supplies,'Wild deposits');
  const winterStores=document.createElement('p');supplies.append(winterStores);
  const uses=document.createElement('details'),summary=document.createElement('summary'),records=document.createElement('ul');
  summary.textContent='Weekly tool use';
  uses.append(summary,records);supplies.after(uses);
  el('button').onclick=()=>panel.close();
  for(const button of panel.querySelectorAll('[data-rate]'))button.onclick=()=>{changeSpeed(Number(button.dataset.rate));draw();};
  function draw(){
    if(!panel.open)return;
    const s=readState(),l=s.local;if(!l)return;
    if(census.open)drawCensus(s);
    el('[data-clock]').textContent='Seed '+s.seed+' · Day '+s.day+' · '+l.season+' · '+s.villagers.length+' people · '+(s.speed?s.speed+'×':'paused');
    const stocks={food:s.food,wood:s.wood,...l.stock};
    records.replaceChildren(...(l.inventions||[]).map(item=>{
      const li=document.createElement('li'),use=l.weeklyUses?.[item];
      li.textContent=use?item+' · Day '+use.day+' · '+use.name+' · '+use.action+' ('+use.result+')':item+' · awaiting practice';
      return li;
    }));
    showStores(stocks);
    showDeposits(l.deposits);
    winterStores.textContent=Object.entries(l.campStores||{}).filter(([,r])=>r.built)
      .map(([camp,r])=>'Camp '+(Number(camp)+1)+' · '+r.rack+' drying · '+r.saved+' / '+(24*(r.racks||1)+12*(r.tradeJars||0))+' stored for winter').join(' | ');
    const post=l.daughter;
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
      el('[data-person]').textContent=v.name+' · '+v.activity+' · age '+v.age+'/'+s.config.life.death+' · hunger '+(100-v.fullness)+' · energy '+p.energy+' · health '+v.health+' · curiosity '+p.curiosity.toFixed(2)+'. Skills: '+describe(p.skills)+'. Properties: '+(p.properties.join(', ')||'none')+'. Proficiency: '+describe(p.known)+'. Experiments: '+describe(p.progress)+'.';
      const family=s.villagers.filter(other=>other.id!==v.id&&other.household===v.household).map(other=>other.name);
      const friends=s.villagers.filter(other=>v.favors?.[other.id]).sort((a,b)=>v.favors[b.id]-v.favors[a.id]);
      if(v.herbalist)el('[data-person]').textContent+=' Lives alone at the woodland lean-to. Some call her a witch. She gathers plants for sick neighbors. Remedies ready: '+v.herbalist.doses+' · visits made: '+v.herbalist.visits+'.';
      if(friends.length)el('[data-person]').textContent+=' Remembers help from '+friends.map(p=>p.name).join(', ')+'.';
      if(v.axeWear>=4)el('[data-person]').textContent+=' Axe needs repair.';
      if(family.length)el('[data-person]').textContent+=' Household: '+family.join(', ')+'.';
      if(v.parentNames)el('[data-person]').textContent+=' Parents: '+v.parentNames.join(' and ')+'.';
      if(v.recoveryUntil>s.day)el('[data-person]').textContent+=' Recovering after childbirth.';
      if(v.age<s.config.life.adult&&v.carers?.length)el('[data-person]').textContent+=' Caregivers: '+v.carers.map(id=>s.villagers.find(p=>p.id===id)?.name).filter(Boolean).join(' and ')+'.';
    }else el('[data-person]').textContent='No living villagers.';
    el('[data-ideas]').replaceChildren(...Object.values(practices).map(r=>{
      const row=document.createElement('div');
      row.textContent=r.name+': '+s.villagers.filter(v=>v.practice.known[r.id]).length+' / '+s.villagers.filter(v=>v.practice.used[r.id]).length+(l.first[r.id]===undefined?'':' · first day '+l.first[r.id]);return row;
    }));
    const mode=el('[data-event-filter]').value;
    const isDeath=e=>e.type==='death'||/^[^ ]+ died\.$/.test(e.text);
    const events=mode==='deaths'?[...l.events.filter(e=>!e.type&&isDeath(e)),...(l.deathHistory||[])]:l.events.filter(e=>mode==='all'||!isDeath(e)).slice(-16);
    el('[data-events]').replaceChildren(...events.reverse().map(e=>{const li=document.createElement('li');li.textContent='Day '+e.day+' · '+e.text;return li;}));
  }
  select.onchange=draw;el('[data-event-filter]').onchange=draw;
  return {draw,open(){if(!panel.open)panel.show();draw();}};
}
