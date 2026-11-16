// A flexible Maslow-inspired agenda for the live homestead. These are motives,
// not technology unlocks: meals already available and local caches count as
// security, and personality still chooses how a villager pursues that security.
import {foodDaysFor,communityMembers,communityOf} from './provisions.js';
import {familyMotivationEnabled} from './family-motivation.js';
import {fuelHeat} from './hearths.js';
// Shared work is an expression of the current agenda, never a new desire or
// a reason to postpone a biological emergency, recovery or exhaustion.
export function sharedWorkFitsNeeds(s,v,need){
  const motive=assessNeeds(s,v);
  // Fuel can be the missing prerequisite for an actual meal, or useful work
  // when winter gathering is exhausted. Existing personal action selection
  // already orders security/belonging/family needs; don't add a second veto.
  if(motive.level===0)return motive.need==='food'&&['food','fuel'].includes(need);
  return true;
}
export function assessNeeds(s,v){
  const c=s.config,N=c.needs;
  const residents=Math.max(1,communityMembers(s,communityOf(s,v)).length);
  const post=s.local?.daughter?.members.includes(v.id)?s.local.daughter:null;
  const foodDays=foodDaysFor(s,v);
  const result=(level,need,reason)=>({level,need,reason,foodDays});
  if(v.fullness<N.emergencyFullness&&foodDays<1)return result(0,'food','Find something to eat today');
  if(v.warmth<N.warmUpBelow)return result(0,'warmth','Get warm before doing other work');
  if(v.illnessDays||v.health<N.unwellBelow)return result(0,'recovery','Rest and recover health');
  if(v.practice?.energy<22)return result(0,'energy','Recover strength for the next workday');
  if(foodDays<2)return result(1,'provisions','Build a reserve beyond tonight’s meal');
  if(s.fireKnown&&(post?post.wood:fuelHeat(s,v))<c.settlement.fuelReserve+(s.tribeCount||1)*c.fire.dailyFuel)
    return result(1,'fuel','Keep the hearth supplied for tomorrow');
  if(v.outdoors)return result(1,'shelter','Secure a warm sleeping place');
  const companyInterval=v.traits?.includes('Sociable')?4:v.traits?.includes('Loner')?14:7;
  if(v.happiness<N.happyMin||residents>1&&s.day-(v.lastCompanyDay??0)>=companyInterval)
    return result(2,'belonging','Spend time with people in my camp');
  // Aspirational family reserves must not turn a safe household into an
  // emergency forever and exclude the very lessons that improve food supply.
  if(familyMotivationEnabled(s)&&['provide','care','court','home','recover','grieving','seek'].includes(v.family?.goal)&&v.age>=c.life.adult)
    return result(3,'family',v.family.reason);
  if(!Object.values(v.practice?.used||{}).some(count=>count>=3))
    return result(3,'esteem','Become skilled and useful through practice');
  return result(4,'growth','Learn, teach, and try something new');
}
