import {familyTreeLayout,familyConnectorPaths} from './family-tree-layout.js';
import {familyPortraitPerson,drawVillagerPortrait} from './villager-portrait.js';

const familyTreeStyles=`
.family-atlas{margin:14px 0;color:#3c3a2c;font-family:Georgia,serif}
.family-atlas summary{cursor:pointer;font-weight:bold}
.family-atlas-panel{margin-top:10px}
.family-atlas-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:9px}
.family-atlas-toolbar label{display:flex;gap:6px;align-items:center;font-size:13px;max-width:100%}
.family-atlas-toolbar select{min-width:0;max-width:210px;padding:7px;border:1px solid #b4a17c;border-radius:7px;background:#fff9ec;color:#403c2e;font:inherit}
.family-atlas-toolbar button,.family-atlas-dialog>header button{min-height:36px;min-width:36px;padding:6px 10px;border:1px solid #a99c7a;border-radius:7px;background:#f9f1dd;color:#494c35;font:14px Georgia,serif;cursor:pointer}
.family-atlas-toolbar button:focus-visible,.family-person:focus-visible{outline:3px solid #628673;outline-offset:3px}
.family-atlas-caption{font-size:13px;line-height:1.5;margin:7px 0 11px;min-height:20px}
.family-atlas-viewport{height:440px;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y;border:1px solid #bcac87;border-radius:12px;background:radial-gradient(ellipse at top,#f8f0db,#e8dec3);cursor:grab;position:relative;scrollbar-color:#a99d7b #e8dec3;scrollbar-width:thin}
.family-atlas-spacer{position:relative;min-width:100%;min-height:100%}
.family-atlas-chart{position:absolute;left:0;top:0;transform-origin:0 0}
.family-atlas-chart>svg{position:absolute;inset:0;overflow:visible;pointer-events:none}
.family-person{box-sizing:border-box;position:absolute;width:136px;height:154px;border:1px solid #c2b390;border-radius:12px;background:#fff9e9;box-shadow:0 3px 9px #6d603016;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:8px 5px 6px;color:#403a2d;cursor:pointer;font-family:Georgia,serif;overflow:hidden}
.family-person:hover{border-color:#759074;background:#fffdf3;box-shadow:0 4px 13px #52624824}
.family-person[aria-pressed="true"]{border:2px solid #5d7d62;background:#f2f5e5;box-shadow:0 0 0 3px #849a6526,0 4px 14px #52624822}
.family-person canvas{width:66px;height:66px;flex-shrink:0}
.family-person strong{font-size:14px;line-height:17px;max-width:124px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.family-person small{font-size:11px;line-height:14px;color:#786e55;max-width:124px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.family-person .family-person-status{font:10px/15px Georgia,serif;letter-spacing:.02em;padding:0 7px;border-radius:10px;background:#e6edda;color:#526347}
.family-person.is-dead{background:#f5efdf;border-color:#c7bc9e}
.family-person.is-dead .family-person-status{background:#e8e0cf;color:#7d715a}
.family-person.is-unknown{border-style:dashed}
.family-atlas-note{font-size:12px;color:#776e55;line-height:1.5;margin:9px 2px}
.family-atlas-dialog{box-sizing:border-box;width:min(1160px,96vw);max-width:96vw;max-height:96dvh;border:1px solid #8e8865;border-radius:16px;padding:16px;background:#f1e8d0;color:#393a2c;box-shadow:0 22px 80px #171b1540}
.family-atlas-dialog::backdrop{background:#27332b99}
.family-atlas-dialog>header{display:flex;align-items:center;justify-content:space-between;gap:10px;font:20px Georgia,serif}
.family-atlas-dialog .family-atlas-viewport{height:min(68dvh,720px)}
@media(max-width:600px){.family-atlas-dialog{padding:10px;width:98vw;max-width:98vw;border-radius:12px}.family-atlas-toolbar{gap:5px}.family-atlas-toolbar select{max-width:170px}.family-atlas-dialog .family-atlas-viewport{height:64dvh}.family-atlas-viewport{height:420px}}
`;
const familySvgNS='http://www.w3.org/2000/svg';
function familyLifeText(person){
  const origin={founder:'Founding villager',arrival:'Arriving settler',born:'Born in the valley',unknown:'Earlier life unknown'}[person.origin]||'Family record';
  const birth=Number.isFinite(person.birthDay)?(person.birthDay<0?'born '+(-person.birthDay)+' days before the founding':'born day '+person.birthDay):'birth date unknown';
  return origin+' · '+birth+(person.arrivalDay!==undefined?' · arrived day '+person.arrivalDay:'')+
    (person.deathDay!==undefined?' · died day '+person.deathDay+((person.causes||[]).length?' ('+person.causes.join(', ')+')':''):'')+(person.ancestryIncomplete?' · some earlier parent links are missing':'');
}
export function createFamilyTreeView(host,readState){
  const make=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text)element.textContent=text;return element;};
  const details=make('details','family-atlas'),summary=make('summary','','Family tree'),style=make('style');style.textContent=familyTreeStyles;
  const panel=make('section','family-atlas-panel'),toolbar=make('div','family-atlas-toolbar'),personLabel=make('label','','Person'),select=make('select'),modeLabel=make('label','','Show'),mode=make('select');
  select.setAttribute('aria-label','Person in family tree');mode.setAttribute('aria-label','Family tree branches');
  for(const [value,label] of [['family','Family'],['ancestors','Ancestors'],['descendants','Descendants']])mode.append(new Option(label,value));
  personLabel.append(select);modeLabel.append(mode);toolbar.append(personLabel,modeLabel);
  const button=(label,title)=>{const b=make('button','',label);b.type='button';b.setAttribute('aria-label',title||label);toolbar.append(b);return b;};
  const back=button('←','Previous person'),minus=button('−','Zoom out family tree'),plus=button('+','Zoom in family tree'),fit=button('Fit'),center=button('Center'),expand=button('Expand');
  const caption=make('p','family-atlas-caption'),viewport=make('div','family-atlas-viewport'),spacer=make('div','family-atlas-spacer'),chart=make('div','family-atlas-chart'),note=make('p','family-atlas-note');
  viewport.tabIndex=0;viewport.setAttribute('aria-label','Family tree. Scroll or drag to explore; select a portrait to follow that person.');
  spacer.append(chart);viewport.append(spacer);panel.append(toolbar,caption,viewport,note);details.append(summary,style,panel);host.append(details);
  const dialog=make('dialog','family-atlas-dialog'),header=make('header'),heading=make('strong','','The village family album'),close=make('button','','Close');close.type='button';close.setAttribute('aria-label','Close expanded family tree');header.append(heading,close);dialog.append(header);host.append(dialog);
  let selectedId=null,renderKey='',optionsKey='',scale=.85,layout=null,history=[],drag=null,lastSeed=null,offsetX=0,offsetY=0;
  const cards=new Map();
  function syncSeed(s){if(lastSeed!==s.seed){selectedId=null;history=[];optionsKey='';renderKey='';lastSeed=s.seed;}}
  function position(){
    if(!layout?.nodes.length)return;
    spacer.style.width=Math.max(viewport.clientWidth||0,layout.width*scale)+'px';spacer.style.height=Math.max(viewport.clientHeight||0,layout.height*scale)+'px';
    offsetX=Math.max(0,((viewport.clientWidth||0)-layout.width*scale)/2);offsetY=Math.max(0,((viewport.clientHeight||0)-layout.height*scale)/2);
    chart.style.left=offsetX+'px';chart.style.top=offsetY+'px';
    chart.style.width=layout.width+'px';chart.style.height=layout.height+'px';chart.style.transform='scale('+scale+')';
  }
  function centerPerson(){
    if(!layout)return;const node=layout.nodes.find(n=>n.id===selectedId);if(!node)return;
    viewport.scrollLeft=Math.max(0,offsetX+(node.x+layout.metrics.cardWidth/2)*scale-(viewport.clientWidth||360)/2);
    viewport.scrollTop=Math.max(0,offsetY+(node.y+layout.metrics.cardHeight/2)*scale-(viewport.clientHeight||420)/2);
  }
  function zoom(next){
    const x=(viewport.scrollLeft+(viewport.clientWidth||360)/2-offsetX)/scale,y=(viewport.scrollTop+(viewport.clientHeight||420)/2-offsetY)/scale;
    scale=Math.max(.04,Math.min(1.8,next));position();viewport.scrollLeft=Math.max(0,offsetX+x*scale-(viewport.clientWidth||360)/2);viewport.scrollTop=Math.max(0,offsetY+y*scale-(viewport.clientHeight||420)/2);
  }
  function fitTree(){if(!layout?.nodes.length)return;scale=Math.max(.005,Math.min(1,(viewport.clientWidth||360)/layout.width,(viewport.clientHeight||420)/layout.height));position();viewport.scrollLeft=viewport.scrollTop=0;}
  function choose(id,push=true){syncSeed(readState());if(push&&selectedId!==null&&id!==selectedId)history.push(selectedId);selectedId=Number(id);renderKey='';draw(true);}
  function draw(recenter=false){
    if(!details.open&&!dialog.open)return;const s=readState(),records=s.local?.genealogy?.people||{},people=Object.values(records);
    syncSeed(s);
    const listKey=people.map(p=>p.id+':'+p.name+':'+p.deathDay).join('|');
    if(listKey!==optionsKey){optionsKey=listKey;select.replaceChildren(...people.sort((a,b)=>(a.birthDay??0)-(b.birthDay??0)||a.id-b.id).map(p=>new Option(p.name+' · #'+p.id+(p.deathDay!==undefined?' †':''),p.id)));}
    if(!records[selectedId])selectedId=s.villagers?.find(v=>records[v.id])?.id??people[0]?.id??null;
    if(selectedId!==null)select.value=String(selectedId);back.disabled=!history.length;
    const person=records[selectedId];
    if(!person){caption.textContent='No family records yet.';chart.replaceChildren();note.textContent='Family records appear as villagers live in the valley.';return;}
    caption.textContent=person.name+' · '+familyLifeText(person);
    const key=s.seed+'/'+s.day+'/'+selectedId+'/'+mode.value+'/'+listKey;
    if(renderKey===key){if(recenter)centerPerson();return;}renderKey=key;
    layout=familyTreeLayout(records,selectedId,{mode:mode.value});chart.replaceChildren();cards.clear();
    const svg=document.createElementNS(familySvgNS,'svg');svg.setAttribute('width',layout.width);svg.setAttribute('height',layout.height);svg.setAttribute('viewBox','0 0 '+layout.width+' '+layout.height);svg.setAttribute('aria-hidden','true');
    for(const union of layout.unions){
      const emphasized=union.parents.includes(selectedId)||union.children.includes(selectedId);
      for(const outline of [true,false])for(const d of familyConnectorPaths(union)){const path=document.createElementNS(familySvgNS,'path');path.setAttribute('d',d);path.setAttribute('fill','none');path.setAttribute('stroke',outline?'#eee5cd':emphasized?'#65836a':'#a59e7d');path.setAttribute('stroke-width',outline?'6':emphasized?'2.5':'1.7');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);}
    }
    chart.append(svg);
    for(const node of layout.nodes){
      const p=node.person,portrait=familyPortraitPerson(s,p),card=make('button','family-person'+(portrait.dead?' is-dead':'')+(p.placeholder?' is-unknown':''));card.type='button';
      card.style.left=node.x+'px';card.style.top=node.y+'px';card.dataset.personId=String(p.id);card.setAttribute('aria-pressed',String(p.id===selectedId));card.setAttribute('aria-label',p.name+' · #'+p.id+' · '+familyLifeText(p)+'. Follow this person’s family.');
      const canvas=make('canvas');canvas.width=canvas.height=144;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',p.placeholder?'Unknown ancestor':p.name+' · in-game portrait'+(portrait.approximate?' reconstructed from available records':''));drawVillagerPortrait(canvas.getContext('2d'),portrait,144,144);
      const name=make('strong','',p.name),dates=make('small','',Number.isFinite(p.birthDay)?(p.birthDay<0?'Before founding':'Day '+p.birthDay)+(p.deathDay!==undefined?' – '+p.deathDay:''):'Dates unknown');
      const status=make('span','family-person-status',p.placeholder?'Unknown':portrait.dead?'Remembered':portrait.lifeUnknown?'Life unknown':p.origin==='founder'?'Founder':p.origin==='arrival'?'Arrival':'Living');
      const id=make('small','','#'+p.id+(p.id===selectedId?' · selected':''));card.append(canvas,name,dates,status,id);card.onclick=()=>choose(p.id);chart.append(card);cards.set(p.id,card);
    }
    note.textContent='Parents above, children below. '+(mode.value==='family'?'Showing ancestors, siblings, co-parents and two generations below. ':'')+
      'Tap a portrait to follow another branch. Scroll or drag to explore.'+(layout.omitted?' More relatives exist outside this view; select a person to explore farther.':'')+
      (layout.cycle?' A conflicting old family link was omitted from the drawing.':'')+' Older portraits use available records; unknown ancestors stay unknown.';
    position();if(recenter)centerPerson();
  }
  select.onchange=()=>choose(Number(select.value));mode.onchange=()=>{renderKey='';draw(true);};back.onclick=()=>{if(history.length)choose(history.pop(),false);};
  minus.onclick=()=>zoom(scale/1.2);plus.onclick=()=>zoom(scale*1.2);fit.onclick=fitTree;center.onclick=()=>{if(scale<.6){scale=.85;position();}centerPerson();};
  expand.onclick=()=>{dialog.append(panel);expand.hidden=true;dialog.showModal();draw(true);};
  close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{details.append(panel);expand.hidden=false;position();centerPerson();expand.focus();});
  details.ontoggle=()=>{if(details.open)draw(true);};
  viewport.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'||event.button!==0||event.target.closest('button'))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(event.pointerId);viewport.style.cursor='grabbing';event.preventDefault();});
  viewport.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY;});
  const endDrag=()=>{drag=null;viewport.style.cursor='grab';};for(const name of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(name,endDrag);
  return {draw,setPerson(id){syncSeed(readState());selectedId=Number(id);renderKey='';if(details.open||dialog.open)draw(true);},open(id){details.open=true;if(id!==undefined)choose(Number(id));else draw(true);},close(){if(dialog.open)dialog.close();},isExpanded:()=>dialog.open};
}
