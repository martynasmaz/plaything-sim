import {paintWorker} from './villager-appearance.js';

export function familyPortraitPerson(s,record){
  const living=s.villagers?.find(v=>v.id===record.id),saved=record.appearance;
  const age=living?.age??saved?.age??(Number.isFinite(record.birthDay)?Math.max(0,(record.deathDay??s.day)-record.birthDay):60);
  const gender=living?.gender??saved?.gender??record.gender??'unknown';
  return {id:record.id,age,gender,tribe:living?.tribe??saved?.tribe??0,traits:[],
    practice:{gear:{'wool wrap':living?!!living.practice?.gear['wool wrap']:!!saved?.woolWrap}},
    furWraps:living?!!s.furWraps:saved?.furWraps??true,child:age<(s.config?.life.adult??20),
    placeholder:!!record.placeholder,approximate:!living&&!saved,dead:record.deathDay!==undefined,lifeUnknown:!living&&record.deathDay===undefined};
}
export function drawVillagerPortrait(g,person,width=96,height=96){
  g.save();g.clearRect(0,0,width,height);const cx=width/2,cy=height/2,r=Math.min(width,height)*.47;
  g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.clip();
  const light=g.createLinearGradient(0,0,width,height);light.addColorStop(0,person.dead?'#e4dfd0':'#eee7ce');light.addColorStop(1,person.dead?'#c7c2b2':'#b8c29b');g.fillStyle=light;g.fillRect(0,0,width,height);
  g.fillStyle='#8b967644';g.beginPath();g.ellipse(cx,height*.98,width*.6,height*.22,0,0,Math.PI*2);g.fill();
  if(person.placeholder){
    g.fillStyle='#a19a83';g.beginPath();g.arc(cx,height*.38,width*.16,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(cx,height*.84,width*.31,height*.25,0,0,Math.PI*2);g.fill();
    g.fillStyle='#f5eedb';g.font=`bold ${Math.round(width*.27)}px Georgia`;g.textAlign='center';g.fillText('?',cx,height*.7);
  }else{
    const scale=width/(person.child?27:37);g.translate(cx,height*.5+(person.child?18:26)*scale);g.scale(scale,scale);g.globalAlpha=person.dead?.8:1;
    paintWorker(g,person,0,0,person.child,false,false,0,'Portrait',0,[],person.furWraps);
  }
  g.restore();g.save();g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.strokeStyle=person.dead?'#aaa18a':'#9caa7a';g.lineWidth=Math.max(1,width*.018);g.stroke();g.restore();
}
