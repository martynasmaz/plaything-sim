// Development is earned through work. Flags allow matched-seed experiments
// without changing the original reference rules or erasing saved discoveries.
export const developmentEnabled=(s,feature)=>!!s.config.learning?.development?.[feature];
export const fieldRules={work:3,maxPlots:44};
export function fieldSite(s,index){
  if(s.farming.sites?.[index])return s.farming.sites[index];
  if(index<4)return [650+index*19,522+index%2*6];
  return [635+(index-4)%8*29,548+Math.floor((index-4)/8)*17];
}
export function fieldPlanningReady(s,v){
  return developmentEnabled(s,'fields')&&s.farming.known&&(s.local.harvests||0)>=2&&
    s.toolkit?.includes('digging stick')&&(v.practice.farmingDays||0)>=5&&(v.practice.skills.wood||0)>=2;
}
export const fieldRecipe=['fieldplanning','Field layout','berries','perishable',['gathering','crude tools'],
  {wood:1,fibre:1},'plot markers',(s,v)=>fieldPlanningReady(s,v)];
export function fieldTarget(s){
  return Math.min(fieldRules.maxPlots,Math.max(s.config.farming.plots,Math.ceil(s.villagers.length/2)));
}
export function regularWorkSafe(s,v){
  return !!s.config.learning&&!!v.practice&&v.age>=s.config.life.adult&&!v.illnessDays&&v.health>=50&&v.fullness>=40&&v.warmth>=45&&v.practice.energy>=32;
}
const workRole=action=>/^(Harvest|Plant|Sow wheat|Prepare a field|Clear field)/.test(action)?'farmer':
  action==='Grind wheat into flour'?'miller':action==='Bake hearth flatbread'?'baker':action==='Fish'?'fisher':
  /^(Hunt|Track )/.test(action)?'hunter':/^(Build |Clear hut|Clear herb)/.test(action)?'builder':
  /^(Teach |Learn healing)/.test(action)?'teacher':/^(Shape jar|Fire jar|Make storage jar|Make clay vessel)/.test(action)?'potter':
  /^(Craft .*weave|Make basket|Make cord|Weave)/.test(action)?'weaver':/^(Craft |Make cutting tool|Make hafted)/.test(action)?'toolmaker':null;
export function recordOccupations(s,report){
  if(!developmentEnabled(s,'roles'))return;
  for(const {id,action} of report.actions){
    const v=s.villagers.find(v=>v.id===id);if(!v||v.age<s.config.life.adult)continue;
    const p=v.practice,history=p.workHistory??=[];
    history.push({day:s.day,role:workRole(action)});
    while(history.length&&history[0].day<s.day-19)history.shift();
    const counts={};for(const h of history)if(h.role)counts[h.role]=(counts[h.role]||0)+1;
    const best=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    if(v.herbalist){p.occupation={role:'healer',since:p.occupation?.role==='healer'?p.occupation.since:s.day};continue;}
    if(best&&best[1]>=4&&best[1]>=history.length*.3&&
      (!p.occupation||p.occupation.role===best[0]||best[1]>=(counts[p.occupation.role]||0)+2)){
      if(p.occupation?.role!==best[0])p.occupation={role:best[0],since:s.day};
    }
  }
}
