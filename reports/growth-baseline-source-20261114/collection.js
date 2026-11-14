export function rememberCollection(s,recipes){
  if(!s.local)return;
  const made=s.local.collection??={};
  const mark=name=>{if(name)made[name]??={recordedDay:s.day};};
  for(const key of ['toolkit','fireTools','textiles'])for(const name of s[key]||[])mark(name);
  for(const h of s.hutDetails||[]){mark(h.shape);mark(h.wall);if(h.chimney)mark('chimney');if(h.ondol)mark('ondol');}
  for(const v of s.villagers){
    mark(v.gear);if(v.fishTrap)mark('fish trap');
    for(const name of Object.keys(v.practice?.gear||{}))if(v.practice.gear[name])mark(name);
    for(const r of Object.values(recipes))if(v.practice?.gear[r.product]||(v.practice?.made?.[r.id]||0)>0){mark(r.name);mark(r.product);}
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
  return made;
}
