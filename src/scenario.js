// EDIT THIS FILE to tune the playable homestead.
// Then: npm run scenario:check; npm run build. Reload the LOCAL game.
// Starting ages/supplies affect NEW villages. Other rules affect future days
// in loaded saves too; existing animals, buildings and discoveries remain.
// Same settings + same ?seed=123 URL parameter = the same fresh simulation.
// Probabilities use 0..1 unless labelled percent. Feed units are game rations,
// not kilograms. Livestock years follow four seasons; human ages use game days.
export const SCENARIO={
  name:'River valley',revision:1, // Increment revision when you change the balance.
  defaultSeed:null, // null = random new worlds; an integer fixes the starting seed. URL ?seed= wins.
  simulation:{
    dayMs:240000,
    start:{food:38,wood:22,ages:[40,50,60,70,80,90],fullness:75,warmth:70,health:100,happiness:60},
    life:{adult:20,elder:240,death:300},
    needs:{fullnessLoss:25,mealFullness:30,mealCost:1,warmthLoss:10,hungerDamage:10,coldDamage:10,recovery:4},
    birth:{consecutiveDays:3,healthyParentsOnly:true,health:70,fullness:60,warmth:50,happiness:50,foodPerPerson:2,extraFood:4,recoveryDays:7},
    illness:{chance:9,duration:3}, // Percent per village day.
    learning:{
      seasonLength:20,abundance:1,spoilage:.035,workCost:8,restGain:24,
      experimentChance:48, // Percent before curiosity/experience bonuses.
      progress:1,lessonDays:2,husbandry:true,
      development:{fields:true,planning:true,roles:true,families:true}
    },
    settlement:{bedsPerHut:3,shelterWork:5,bridgeWork:10,fuelReserve:3,shelterBonus:4},
    hunting:{herdSize:3,provisions:5,returnEvery:3},
    tribeThresholds:[8,12]
  },
  // Kaunas normals provide the seasonal shape. These are scenario modifiers,
  // not claims about a different measured historical climate.
  weather:{model:'kaunas',wetDayMultiplier:1,heavyDayMultiplier:1,rainAmountMultiplier:1,temperatureOffsetC:0,simpleChances:{normal:31,rain:30,drought:25,cold:14}},
  wildlife:{passingChance:.52,deerShare:.45,maxPassingGroup:3},
  river:{fatalFallChance:.001}, // Default: one fatality per 1,000 recorded falls.
  inspiration:{naturalChance:1/400,durationDays:5,topicCooldownDays:20,experimentBonus:8},
  progression:{
    fields:{work:3,maxPlots:44},
    wheat:{earliestDay:360,seedFindFromDay:240,seedFindEvery:8,observedSeasons:6,ripeAt:24,harvest:24,batch:4,bread:8}
  },
  livestock:{
    // Raising odds NEVER bypasses knowledge, materials, food or infrastructure.
    contactChance:1,tradeChance:1,breedingChance:1,
    minimumCompletedWinters:1,minimumHarvests:2,minimumExploredReaches:2,
    safeReserveDays:2.5,journeyRations:3,tradeIntervalSeasons:1,
    targetPeoplePerAnimal:4,minimumTarget:2,maximumTarget:10,
    pastureCapacity:60,hayMeadowCapacity:120,pastureRegrowth:[3,5,3,0],hayMeadowRegrowth:[6,8,6,0],
    hayBundle:8,hayDryDays:3,hayWetSpoilDays:7,winterFeedMargin:1.15,
    compostManure:4,compostOutput:2,compostSeasons:1,compostHarvests:2,compostYieldBonus:1,
    risks:{illness:.0005,mudIllnessPerPoint:.0005,maxMudIllness:.006,escapeIntact:.002,escapeBroken:.03,predationUnattended:.001,cropDamageUnattended:.02},
    buildings:{enclosure:{work:4,cost:{wood:6,fibre:3},capacity:12},shelter:{work:5,cost:{wood:8,fibre:4,hide:1},capacity:12}},
    // adult/life/gestation/interval: fractions of the four-season game year.
    // price: food portions per animal, plus fibre and a paid journey.
    species:{
      sheep:{label:'Sheep',adult:.8,life:9,gestation:.4,interval:1,litter:1,feed:1,space:1,meat:12,hide:1,bone:2,milk:2,price:5},
      pig:{label:'Pig',adult:.6,life:7,gestation:.3,interval:.65,litter:3,feed:1.2,space:1,meat:18,hide:1,bone:3,milk:0,price:6},
      cattle:{label:'Cattle',adult:2,life:14,gestation:.7,interval:1.25,litter:1,feed:3,space:3,meat:40,hide:3,bone:6,milk:3,price:12}
    }
  }
};

export function validateScenario(settings=SCENARIO){
  const errors=[];
  function numbers(value,path='scenario'){
    if(typeof value==='number'&&!Number.isFinite(value))errors.push(path+' must be finite');
    if(value&&typeof value==='object')for(const [key,next] of Object.entries(value))numbers(next,path+'.'+key);
  }
  numbers(settings);
  const probability=(n,path)=>{if(!Number.isFinite(n)||n<0||n>1)errors.push(path+' must be between 0 and 1');};
  const positive=(n,path)=>{if(!Number.isFinite(n)||n<=0)errors.push(path+' must be greater than zero');};
  try{
    const sim=settings.simulation,h=settings.livestock;
    if(settings.defaultSeed!==null&&(!Number.isInteger(settings.defaultSeed)||settings.defaultSeed<0||settings.defaultSeed>4294967295))errors.push('defaultSeed must be null or a 32-bit nonnegative integer');
    positive(sim.dayMs,'simulation.dayMs');positive(sim.learning.seasonLength,'simulation.learning.seasonLength');positive(sim.learning.lessonDays,'simulation.learning.lessonDays');
    if(!(sim.life.adult<sim.life.elder&&sim.life.elder<sim.life.death))errors.push('life must satisfy adult < elder < death');
    if(!sim.start.ages.length||sim.start.ages.some(n=>!Number.isInteger(n)||n<0||n>=sim.life.death))errors.push('start.ages must contain living, nonnegative integer ages');
    for(const [key,n] of Object.entries(sim.start))if(key!=='ages'&&n<0)errors.push('start.'+key+' cannot be negative');
    for(const [path,n] of [['illness.chance',sim.illness.chance],['learning.experimentChance',sim.learning.experimentChance]])if(n<0||n>100)errors.push(path+' must be between 0 and 100 percent');
    for(const [key,n] of Object.entries(settings.weather))if(key!=='model'&&key!=='temperatureOffsetC'&&n<0)errors.push('weather.'+key+' cannot be negative');
    if(!['kaunas','simple'].includes(settings.weather.model))errors.push('weather.model must be kaunas or simple');
    const simple=Object.values(settings.weather.simpleChances);if(simple.some(n=>!Number.isFinite(n)||n<0)||Math.abs(simple.reduce((n,p)=>n+p,0)-100)>.00001)errors.push('weather.simpleChances must be nonnegative percentages summing to 100');
    for(const key of ['contactChance','tradeChance','breedingChance'])probability(h[key],'livestock.'+key);
    for(const [key,n] of Object.entries(h.risks))probability(n,'livestock.risks.'+key);
    probability(settings.river.fatalFallChance,'river.fatalFallChance');probability(settings.wildlife.passingChance,'wildlife.passingChance');probability(settings.wildlife.deerShare,'wildlife.deerShare');probability(settings.inspiration.naturalChance,'inspiration.naturalChance');
    for(const key of ['targetPeoplePerAnimal','hayBundle','hayDryDays','hayWetSpoilDays','winterFeedMargin','compostManure','compostOutput','compostSeasons','compostHarvests'])positive(h[key],'livestock.'+key);
    for(const key of ['pastureCapacity','hayMeadowCapacity'])positive(h[key],'livestock.'+key);
    for(const key of ['pastureRegrowth','hayMeadowRegrowth'])if(!Array.isArray(h[key])||h[key].length!==4||h[key].some(n=>!Number.isFinite(n)||n<0))errors.push('livestock.'+key+' must contain four nonnegative seasonal rates');
    for(const [path,n] of [['seasonLength',sim.learning.seasonLength],['maxPassingGroup',settings.wildlife.maxPassingGroup],['hayDryDays',h.hayDryDays],['hayWetSpoilDays',h.hayWetSpoilDays],['seedFindEvery',settings.progression.wheat.seedFindEvery]])if(!Number.isInteger(n)||n<1)errors.push(path+' must be a positive integer');
    for(const key of ['minimumCompletedWinters','minimumHarvests','minimumExploredReaches'])if(!Number.isInteger(h[key])||h[key]<0)errors.push('livestock.'+key+' must be a nonnegative integer');
    for(const [kind,rules] of Object.entries(h.buildings)){positive(rules.work,kind+'.work');positive(rules.capacity,kind+'.capacity');for(const [material,n] of Object.entries(rules.cost))if(n<0)errors.push(kind+'.cost.'+material+' cannot be negative');}
    for(const [kind,rules] of Object.entries(h.species)){
      for(const key of ['adult','life','gestation','interval','feed','space','litter'])positive(rules[key],kind+'.'+key);
      if(rules.adult>=rules.life)errors.push(kind+' must reach adulthood before old age');
      if(!Number.isInteger(rules.litter)||rules.litter>12)errors.push(kind+'.litter must be an integer from 1 to 12');
      for(const key of ['price','meat','hide','bone','milk'])if(rules[key]<0)errors.push(kind+'.'+key+' cannot be negative');
    }
    if(h.minimumTarget>h.maximumTarget)errors.push('minimumTarget cannot exceed maximumTarget');
    positive(settings.progression.fields.work,'fields.work');positive(settings.progression.fields.maxPlots,'fields.maxPlots');
    for(const key of ['ripeAt','batch','harvest','bread'])positive(settings.progression.wheat[key],'wheat.'+key);
  }catch{errors.push('a required settings section is missing');}
  return errors;
}
export function scenarioStartSeed(random,requested=null){return (requested??SCENARIO.defaultSeed??random())>>>0;}
const invalidScenario=validateScenario();
if(invalidScenario.length)throw new RangeError('Invalid scenario settings:\n'+invalidScenario.join('\n'));
