// A flexible Maslow-inspired agenda for the live homestead. These are motives,
// not technology unlocks: meals already available and local caches count as
// security, and personality still chooses how a villager pursues that security.
import {foodDaysFor,communityMembers,communityOf} from './provisions.js';
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
  if(s.fireKnown&&(post?post.wood:s.wood)<c.settlement.fuelReserve+(s.tribeCount||1)*c.fire.dailyFuel)
    return result(1,'fuel','Keep the hearth supplied for tomorrow');
  if(v.outdoors)return result(1,'shelter','Secure a warm sleeping place');
  const companyInterval=v.traits?.includes('Sociable')?4:v.traits?.includes('Loner')?14:7;
  if(v.happiness<N.happyMin||residents>1&&s.day-(v.lastCompanyDay??0)>=companyInterval)
    return result(2,'belonging','Spend time with people in my camp');
  if(!Object.values(v.practice?.used||{}).some(count=>count>=3))
    return result(3,'esteem','Become skilled and useful through practice');
  return result(4,'growth','Learn, teach, and try something new');
}
