export function familyTreeFixture(){
  const people={};
  const add=(id,name,gender,birthDay,parents=[],deathDay)=>people[id]={id,name,gender,birthDay,parents,origin:parents.length?'born':'founder',
    ...(deathDay!==undefined?{deathDay,causes:['old age']}:{})};
  add(1,'Paulius','male',-70,[],230);add(2,'Gabrielė','female',-50,[],250);
  add(3,'Lukas','male',-60,[],240);add(4,'Viktorija','female',-45,[],255);
  add(5,'Rokas','male',-40,[],260);add(6,'Ieva','female',-35,[],265);
  add(7,'Matas','male',45,[1,2]);add(8,'Austėja','female',50,[3,4]);
  add(9,'Jonas','male',105,[7,8]);add(10,'Emilija','female',125,[7,8]);add(11,'Monika','female',65,[1,2]);
  add(12,'Ugnė','female',110,[5,6]);add(13,'Ąžuolas','male',263,[9,12]);add(14,'Liepa','female',275,[9,12]);
  add(15,'Dovydas','male',95,[5,6]);add(16,'Saulė','female',272,[10,15]);
  for(const p of Object.values(people))p.appearance={age:(p.deathDay??280)-p.birthDay,gender:p.gender,tribe:p.id%3,furWraps:true,woolWrap:p.id===8};
  return {seed:41,day:280,furWraps:true,config:{life:{adult:20}},local:{genealogy:{people}},villagers:Object.values(people).filter(p=>p.deathDay===undefined).map(p=>({id:p.id,name:p.name,age:280-p.birthDay,gender:p.gender,tribe:p.appearance.tribe,practice:{gear:{'wool wrap':p.appearance.woolWrap}}}))};
}
