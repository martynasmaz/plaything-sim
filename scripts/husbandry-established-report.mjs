// Controlled integration fixture, NOT a fresh-village balance experiment.
// Supplies, existing objects and prior basic experience are stated explicitly.
import {createState,stepDay} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {SCENARIO} from '../src/scenario.js';
import {writeFileSync} from 'node:fs';
SCENARIO.livestock.minimumTarget=6;
const rules={...HOMESTEAD_RULES,start:{...HOMESTEAD_RULES.start,food:3000,wood:1500},limits:{stock:4000},life:{elder:1900,death:2000},birth:{consecutiveDays:10000},illness:{chance:0},
  tribeThresholds:[],learning:{...HOMESTEAD_RULES.learning,climate:false,spoilage:0,abundance:3},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
let s=createState(rules,51);s.day=101;s.tribeCount=3;s.settlementWork=15;s.fireKnown=s.fireLit=true;
s.huts=[0,0,1,1,2,2];s.hutDetails=s.huts.map(()=>({shape:'round hut',wall:'mud wall'}));
Object.assign(s.local,{reaches:2,harvests:6,lastWinterFood:{home:10},completedWinters:1,jars:8});Object.assign(s.local.stock,{fibre:300,hide:100,stone:200,resin:100,wheat:800,hay:1200});
s.toolkit=['hammer stone','stone blades','hand axe','mallet & chisel','digging stick'];s.textiles=['cordage','drop spindle','loom'];s.fireTools=['bow drill'];s.farming.known=true;s.farming.wheatHarvests=3;s.farming.plots=[3,3,3,3];
for(const [i,v] of s.villagers.entries()){
  v.tribe=Math.floor(i/2);v.lastCompanyDay=s.day;v.fullness=v.warmth=v.health=100;v.practice.energy=100;
  Object.assign(v.practice.known,{knapping:1,cordage:1,housing:1,hafting:1,shaping:1,herding:1,penbuilding:1,haymaking:1,stockshelter:1});
  v.practice.skills={berries:12,wood:12,stone:12,hide:12,fibre:12,clay:12};v.practice.properties=['perishable','rigid','flexible','insulating','fractures','sticky','mouldable'];
  Object.assign(v.practice.gear,{'clay vessel':true,'cutting tool':true,cord:true,'lined bed':true});v.practice.herderVisits=1;v.practice.husbandryDays=12;v.practice.farmingDays=10;v.practice.observedMilking=true;
}
const h=s.local.husbandry;h.contacts.herders={day:80};
for(const [camp,species] of ['sheep','pig','cattle'].entries()){
  const owner=s.villagers[camp*2],pen={id:'pen-'+camp,camp,site:[[332,174],[698,385],[598,105]][camp],ownerId:owner.id,keeperId:owner.id,work:4,shelterWork:5,enclosureDay:70,shelterDay:80,careDay:100,grass:60,mast:45,dung:0,mud:0,integrity:100};h.pens.push(pen);
  for(const sex of ['male','female']){const a=h.animals.find(a=>a.location==='regional'&&a.species===species&&a.sex===sex);Object.assign(a,{location:'village',penId:pen.id,ownerId:owner.id,keeperId:owner.id,acquiredDay:20,age:200});s.food-=SCENARIO.livestock.species[species].price;s.local.stock.fibre--;h.stats.traded++;}
}
const actions={};let days=0;
while(days<600&&!s.ended){s=stepDay(s);days++;for(const a of s.lastDay.actions)actions[a.action]=(actions[a.action]||0)+1;for(const [key,n] of Object.entries({food:s.food,wood:s.wood,...s.local.stock}))if(!Number.isFinite(n)||n<-.00001)throw Error('Invalid '+key+' '+n);}
const result={kind:'controlled established-world integration; not fresh-world odds',days,population:s.villagers.length,overrides:{food:3000,wood:1500,hay:1200,wheat:800,perishableSpoilage:0,weather:'normal',illnessChance:0,minimumHerdTarget:6,priorExperience:'basic husbandry, cordage, housing, knapping, hafting, pottery, farming',existingObjects:'paid fixture huts, enclosures, shelters, spindle, loom and six acquired animals'},
  people:s.villagers.map(v=>({name:v.name,camp:v.tribe,activity:v.activity,health:v.health,fullness:v.fullness,warmth:v.warmth})),pens:s.local.husbandry.pens,
  livestock:s.local.husbandry.stats,animals:s.local.husbandry.animals.filter(a=>a.location==='village').map(a=>({species:a.species,status:a.status,cause:a.deathCause,day:a.deathDay,health:a.health,condition:a.condition,yoked:!!a.yoked,motherId:a.motherId,fatherId:a.fatherId})),
  known:Object.fromEntries(['milking','curdling','fleeceworking','woolspinning','woolweaving','woolclothing','composting','oxtraining'].map(id=>[id,s.villagers.filter(v=>v.practice.known[id]).length])),wraps:s.villagers.filter(v=>v.practice.gear['wool wrap']).length,actions};
writeFileSync(process.argv[2]||'reports/husbandry-established-integration.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({days,stats:result.livestock,known:result.known,wraps:result.wraps,yoked:result.animals.filter(a=>a.yoked).length}));
