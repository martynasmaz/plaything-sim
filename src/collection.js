import {husbandryIds,livestockBuildingRules} from './husbandry.js';
import {granaryFinished} from './storage.js';
import {bridgeUpgradeRules} from './river.js';
export function rememberCollection(s,recipes){
  if(!s.local)return;
  const made=s.local.collection??={};
  const mark=name=>{if(name)made[name]??={recordedDay:s.day};};
  for(const key of ['toolkit','fireTools','textiles'])for(const name of s[key]||[])mark(name);
  for(const h of s.hutDetails||[]){mark(h.shape);mark(h.wall);if(h.chimney)mark('chimney');if(h.ondol)mark('ondol');}
  for(const v of s.villagers){
    mark(v.gear);if(v.fishTrap)mark('fish trap');
    for(const name of Object.keys(v.practice?.gear||{}))if(v.practice.gear[name])mark(name);
    for(const r of Object.values(recipes))if(v.practice?.gear[r.product]||(v.practice?.made?.[r.id]||0)>0){
      if(husbandryIds.includes(r.id)&&['penbuilding','stockshelter','oxtraining'].includes(r.id))continue;
      mark(r.name);mark(r.product);
    }
  }
  if(s.fireLit||s.fireKnown&&s.stats.fireDay!==null)mark('controlled fire');
  if(s.farming.known&&(s.local.harvests||s.farming.plots.some(p=>p!==null)))mark('farming');
  if(s.farming.querns?.length){mark('saddle quern');mark('Saddle-quern making');}
  if(s.farming.milled){mark('wholemeal flour');mark('Whole-grain milling');}
  if(s.local.first.wheatSown!==undefined){mark('wheat cultivation');mark('Wheat cultivation');}
  if(s.farming.breadBaked){mark('hearth flatbread');mark('Hearth flatbread');}
  const work=s.settlementWork||0,r=s.config.settlement;
  if(work>=r.shelterWork)mark('communal shelter');
  if(work>=r.shelterWork+r.bridgeWork)mark('footbridge');
  if(s.shed.built)mark('plank shed');if(s.pottery?.kiln)mark('camp kiln');
  const h=s.local.healerHome;
  if(h?.work>=6)mark('healer hut');if(h?.rackWork>=2)mark('herb drying rack');if(h?.markerWork>=2)mark('healer marker');
  if(s.local.paintings?.length){mark('rock painting');mark('Rock paintings');}
  if(s.farming.fieldHistory?.length)mark('cultivated field');
  if(Object.values(s.local.campStores||{}).some(r=>r.built))mark('drying rack');
  if(Object.values(s.local.campStores||{}).some(granaryFinished))mark('raised granary');
  if((s.local.bridgeUpgrade?.railWork||0)>=bridgeUpgradeRules.railWork)mark('bridge handrails');
  if((s.local.bridgeUpgrade?.braceWork||0)>=bridgeUpgradeRules.braceWork)mark('braced footbridge');
  const livestock=s.local.husbandry;
  if(livestock){
    if(livestock.pens.some(p=>p.enclosureDay!==undefined||p.work>=livestockBuildingRules.enclosure.work)){mark('animal enclosure');mark('Livestock enclosures');}
    if(livestock.pens.some(p=>p.shelterDay!==undefined||p.shelterWork>=livestockBuildingRules.shelter.work)){mark('livestock shelter');mark('Livestock shelters');}
    if(livestock.animals.some(a=>a.yoked)){mark('wooden cattle yoke');mark('Cattle traction');}
    for(const kind of ['sheep','pig','cattle'])if(livestock.animals.some(a=>a.location==='village'&&a.species===kind))mark(kind==='sheep'?'sheep flock':kind==='pig'?'pig herd':'cattle herd');
  }
  return made;
}
