import {encyclopediaCatalog} from './sim.js';
import {drawHouseholdHut,drawHealerHome} from './settlement-view.js';
import {drawSaddleQuern,drawWheat} from './farming-view.js';
import {drawFishingMesh,drawWickerFishingTrap,drawCarriedFishingGear} from './fishing-view.js';
import {drawRockRecord} from './paintings-view.js';

export function drawCollectionPicture(g,name){
  g.clearRect(0,0,180,100);g.fillStyle='#e3d7b6';g.fillRect(0,0,180,100);
  if(/paint/.test(name))drawRockRecord(g,90,83,{topic:'hunting'});
  else if(/healer|herb drying/.test(name))drawHealerHome(g,78,77,2,true,{work:6,rackWork:name==='healer hut'?0:2,markerWork:name==='healer marker'?2:0});
  else if(/hut|wall|chimney|ondol/.test(name))drawHouseholdHut(g,90,78,{shape:name.includes('hut')?name:'round hut',wall:name.includes('wall')?name:'mud wall',chimney:name==='chimney',ondol:name==='ondol'},1.8,true);
  else if(/quern|flour|milling/i.test(name)){g.save();g.translate(90,70);g.scale(3,3);drawSaddleQuern(g,0,0);g.restore();}
  else if(/wheat|cultivation|farming/.test(name)){g.save();g.translate(90,80);g.scale(2.2,2.2);drawWheat(g,0,0,24,24);g.restore();}
  else if(/fish trap/.test(name)){g.save();g.translate(65,57);g.scale(1.6,1.6);drawWickerFishingTrap(g,0,0);g.restore();}
  else if(/net/.test(name))drawFishingMesh(g,50,25,80,50);
  else if(/fishing|hook and line/.test(name))drawCarriedFishingGear(g,80,68,name==='fishing pole'?'pole':name==='hook and line'?'line':'spear');
  else{
    const glyph=/bread/.test(name)?'🫓':/paint/.test(name)?'🦌':/bone/.test(name)?'🦴':/basket|weav/.test(name)?'🧺':/clay|jar|pottery|kiln/.test(name)?'🏺':/fire|ember|charcoal/.test(name)?'🔥':/bridge/.test(name)?'🪵':/shelter|shed|bed/.test(name)?'🛖':/herb|remedy/.test(name)?'🌿':/bow|sling|spear/.test(name)?'🏹':/spindle|cord|loom|sandals/.test(name)?'🧵':'🪓';
    g.font='46px "Segoe UI Emoji", sans-serif';g.textAlign='center';g.fillText(glyph,90,67);
  }
}
export function createEncyclopedia(host,readState){
  const details=document.createElement('details'),summary=document.createElement('summary'),note=document.createElement('p'),filter=document.createElement('select'),grid=document.createElement('div');
  summary.textContent='Encyclopedia & collection';note.textContent='Reference drawings. Collected means villagers have actually made or practised it; learning alone does not count. Materials shown are per craft or work step.';
  for(const [value,label] of [['all','Everything'],['missing','Still to collect'],['made','Collected']])filter.append(new Option(label,value));
  filter.setAttribute('aria-label','Collection filter');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(min(165px,100%),1fr));gap:8px;margin:12px 0';
  details.append(summary,note,filter,grid);host.append(details);let key='';
  function draw(){
    if(!details.open)return;
    const s=readState(),next=[s.seed,s.day,s.castCount,s.villagers.length,filter.value].join('/');if(key===next)return;key=next;
    const all=encyclopediaCatalog(s);summary.textContent='Encyclopedia · '+all.filter(e=>e.built).length+' / '+all.length+' collected';
    grid.replaceChildren(...all.filter(e=>filter.value==='all'||(filter.value==='made')===e.built).map(entry=>{
      const card=document.createElement('article'),canvas=document.createElement('canvas'),title=document.createElement('strong'),status=document.createElement('p'),needs=document.createElement('p'),materials=document.createElement('p');
      card.style.cssText='padding:8px;background:#f8efd9;border:1px solid #cebea1;border-radius:5px';
      canvas.width=180;canvas.height=100;canvas.style.cssText='width:100%;height:auto';canvas.setAttribute('role','img');canvas.setAttribute('aria-label',entry.name+' illustration');drawCollectionPicture(canvas.getContext('2d'),entry.product);
      title.textContent=entry.name;status.textContent=entry.built?'✓ Collected':entry.known?'Known · not yet made':'Not yet learned';
      needs.textContent='Needs: '+entry.needs.join('; ')+'.'+(!entry.available?' Earlier infrastructure is missing.':'')+(entry.experienced===false?' No villager currently has the required experience and opportunity.':'');
      materials.textContent=entry.cost?'Materials: '+Object.entries(entry.cost).filter(([,n])=>n>0).map(([k,n])=>k+' '+n+(((k==='wood'||k==='food')?s[k]:s.local.stock[k]||0)<n?' (short)':'')).join(', '):'Requires a real workday and the materials for the relevant building stage.';
      for(const p of [status,needs,materials])p.style.cssText='font-size:12px;margin:6px 0';
      card.append(canvas,title,status,materials,needs);return card;
    }));
  }
  details.ontoggle=draw;filter.onchange=()=>{key='';draw();};return {draw};
}
