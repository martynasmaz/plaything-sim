// EDIT THIS FILE to tune the playable homestead.
// Then: npm run scenario:check; npm run build. Reload the LOCAL game.
// Starting ages/supplies affect NEW villages. Other rules affect future days
// in loaded saves too; existing animals, buildings and discoveries remain.
// Same settings + same ?seed=123 URL parameter = the same fresh simulation.
// Probabilities use 0..1 unless labelled percent. Feed units are game rations,
// not kilograms. Livestock years follow four seasons; human ages use game days.
export const SCENARIO={
  name:'River valley',revision:22, // Increment revision when you change the balance.
  defaultSeed:null, // null = random new worlds; an integer fixes the starting seed. URL ?seed= wins.
  simulation:{
    limits:{stock:100}, // Base fresh pantry; jars and baskets add their existing capacity.
    dayMs:240000,
    // Hybrid pacing: the tested adult founder ages, fast childhood, long adult life.
    // Existing saves retain their recorded ages; these ages apply to new founders.
    start:{food:38,wood:22,ages:[1745,1898,2051,2204,2356,2509],fullness:75,warmth:70,health:100,happiness:60},
    life:{adult:20,elder:4800,death:6400}, // Elder at 60 seasonal years; maximum 80. Childhood stays accelerated.
    childhood:{infantUntil:4,helperUntil:12,careFromAge:5,infantAppetite:.5,helperYield:.5},
    // Winter meals use a quarter ration for the same fullness and health rules.
    // Set winterMealFraction to 1 to restore year-round full portions.
    // Yes/no switches: true = yes, false = no. Keep food production active.
    needs:{eatsFood:true,hungerDeathsEnabled:true,fullnessLoss:25,mealFullness:100,mealCost:1,winterMealFraction:.25,warmthLoss:10,hungerDamage:10,coldDamage:10,recovery:4},
    // consecutiveDays is each prospective family's readiness check, never a
    // delay between births across a camp. Many ready families may give birth together.
    // Births use mutual willingness (happiness and wantsChildren), health and
    // illness, not food reserves or separate fullness/warmth thresholds.
    // Per mother: 158 recovery days + two further readiness checks = at least
    // 160 days (two seasonal years) between births. This is not gestation.
    birth:{consecutiveDays:3,healthyParentsOnly:true,health:70,happiness:50,recoveryDays:158},
    illness:{chance:9,duration:3}, // Percent per village day.
    learning:{
      seasonLength:20,abundance:1,spoilage:.035,workCost:8,restGain:24,
      experimentChance:48, // Percent before curiosity/experience bonuses.
      discoveryMultiplier:1.25, // 1 = previous odds; 1.25 = 25% higher eligible experiment chance; 0 = no independent experiments.
      progress:1,lessonDays:2,husbandry:true,
      housingLookAheadDays:12,housingExpectedChildren:3, // Forecast demand, never force births or create beds.
      development:{fields:true,planning:true,roles:true,families:true}
    },
    settlement:{bedsPerHut:3,shelterWork:5,bridgeWork:10,fuelReserve:3,shelterBonus:4},
    hunting:{herdSize:3,provisions:5,returnEvery:3},
    tribeThresholds:[8,12]
  },
  // Kaunas normals provide the seasonal shape. These are scenario modifiers,
  // not claims about a different measured historical climate.
  familyMotivation:{enabled:true,driveMultiplier:1,willingnessThreshold:.22,additionalChildReluctance:.07,
    fatigueInfluence:.3,fatigueRecovery:.025,careFatigue:.08,griefDays:8,familiarity:2,
    socialReserveDays:3,socialInterval:6,reserveDays:3,learningBias:2},
  weather:{model:'kaunas',wetDayMultiplier:1,heavyDayMultiplier:1,rainAmountMultiplier:1,temperatureOffsetC:0,simpleChances:{normal:31,rain:30,drought:25,cold:14}},
  wildlife:{passingChance:.52,deerShare:.45,maxPassingGroup:3},
  storage:{rackCapacity:24,jarCapacity:12,granaryCapacity:96,granaryBinCapacity:48,houseCapacity:12},
  coordination:{enabled:true,constructionCrew:2,harvestCrew:1}, // Internal logic, no player-facing task board.
  foodYields:{multiplier:2}, // Primary food acquisition only; processing ratios stay unchanged.
  nutrition:{enabled:true,recoveryFedDays:3,recoveryFullness:30,recoveryWarmth:40,
    winterRationing:true,rationHealthyHealth:70,rationReserveFullness:50,rationExperienceDays:3,rationSafetyDays:2,rationIncomeConfidence:.5},
  hearths:{charcoalWood:4,charcoalYield:1,improvedCharcoalYield:2,charcoalHeat:2,reserveDays:6,
    ovenBakesBeforeStudy:1,ovenDryingBeforeStudy:2,ovenClayExperience:1,ovenTrialClay:1,
    ovenWork:4,ovenCost:{clay:6,stone:0,wood:2},ovenFuelMultiplier:.5},
  landUse:{clearance:8,abandonedAfterSeasons:12,ruinAfterSeasons:24,regrowthDays:30},
  river:{fatalFallChance:.001,floodCrossingChance:{deck:.02,rails:.005,braced:.001},
    fords:{main:{work:6,stone:12},tributary:{work:4,stone:8}},
    tributaryBridge:{work:6,cost:{wood:6,stone:2,fibre:2}}}, // Fatality is per recorded fall, not per crossing; flood risks are gameplay settings.
  inspiration:{naturalChance:1/400,durationDays:5,topicCooldownDays:20,experimentBonus:8},
  progression:{
    // Safe workday opportunities, not an automatic unlock after a date/famine.
    familyPlanning:{reflectionChance:.12,shortageDays:8,childShortageDays:3,careDays:4},
    fields:{work:3,maxPlots:44},
    // One workday handles up to 8 grain/flour; a full bake uses 2 wood.
    // Smaller batches pay proportional ingredients/fuel and retain seed.
    wheat:{earliestDay:360,seedFindFromDay:240,seedFindEvery:8,observedSeasons:6,ripeAt:24,harvest:24,batch:8,bread:16,fuel:2,peoplePerQuern:8}
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
  const nonnegative=(n,path)=>{if(!Number.isFinite(n)||n<0)errors.push(path+' must be a finite nonnegative number');};
  const integer=(n,path,min=1)=>{if(!Number.isInteger(n)||n<min)errors.push(path+' must be an integer of at least '+min);};
  try{
    const sim=settings.simulation,h=settings.livestock;
    const family=settings.familyMotivation;
    if(typeof family.enabled!=='boolean')errors.push('familyMotivation.enabled must be boolean');
    for(const key of ['driveMultiplier','additionalChildReluctance','fatigueInfluence','fatigueRecovery','careFatigue','learningBias'])nonnegative(family[key],'familyMotivation.'+key);
    probability(family.willingnessThreshold,'familyMotivation.willingnessThreshold');
    positive(family.familiarity,'familyMotivation.familiarity');
    for(const key of ['griefDays','socialInterval'])integer(family[key],'familyMotivation.'+key);
    for(const key of ['socialReserveDays','reserveDays'])positive(family[key],'familyMotivation.'+key);
    if(settings.defaultSeed!==null&&(!Number.isInteger(settings.defaultSeed)||settings.defaultSeed<0||settings.defaultSeed>4294967295))errors.push('defaultSeed must be null or a 32-bit nonnegative integer');
    positive(sim.dayMs,'simulation.dayMs');positive(sim.learning.seasonLength,'simulation.learning.seasonLength');positive(sim.learning.lessonDays,'simulation.learning.lessonDays');
    nonnegative(sim.learning.discoveryMultiplier,'learning.discoveryMultiplier');
    positive(sim.needs.mealCost,'needs.mealCost');positive(sim.needs.mealFullness,'needs.mealFullness');nonnegative(sim.needs.fullnessLoss,'needs.fullnessLoss');
    for(const key of ['eatsFood','hungerDeathsEnabled'])if(typeof sim.needs[key]!=='boolean')errors.push('needs.'+key+' must be boolean');
    if(sim.needs.winterMealFraction!==undefined){positive(sim.needs.winterMealFraction,'needs.winterMealFraction');probability(sim.needs.winterMealFraction,'needs.winterMealFraction');}
    if(sim.childhood){integer(sim.childhood.infantUntil,'childhood.infantUntil',0);integer(sim.childhood.helperUntil,'childhood.helperUntil');
      if(sim.childhood.careFromAge!==undefined){integer(sim.childhood.careFromAge,'childhood.careFromAge',sim.childhood.infantUntil);
        if(sim.childhood.careFromAge>sim.life.adult)errors.push('childhood.careFromAge cannot exceed adult age');}
      if(!(sim.childhood.infantUntil<sim.childhood.helperUntil&&sim.childhood.helperUntil<sim.life.adult))errors.push('childhood ages must satisfy infantUntil < helperUntil < adult');
      probability(sim.childhood.infantAppetite,'childhood.infantAppetite');probability(sim.childhood.helperYield,'childhood.helperYield');}
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
    integer(settings.river.tributaryBridge.work,'river.tributaryBridge.work');
    for(const [channel,ford] of Object.entries(settings.river.fords||{})){integer(ford.work,'river.fords.'+channel+'.work');integer(ford.stone,'river.fords.'+channel+'.stone');}
    if(settings.landUse){nonnegative(settings.landUse.clearance,'landUse.clearance');
      positive(settings.landUse.abandonedAfterSeasons,'landUse.abandonedAfterSeasons');positive(settings.landUse.regrowthDays,'landUse.regrowthDays');
      if(!(settings.landUse.ruinAfterSeasons>settings.landUse.abandonedAfterSeasons))errors.push('landUse.ruinAfterSeasons must exceed abandonedAfterSeasons');}
    if(settings.coordination){
      if(typeof settings.coordination.enabled!=='boolean')errors.push('coordination.enabled must be boolean');
      for(const key of ['constructionCrew','harvestCrew']){positive(settings.coordination[key],'coordination.'+key);integer(settings.coordination[key],'coordination.'+key);}
    }
    if(settings.foodYields)positive(settings.foodYields.multiplier,'foodYields.multiplier');
    for(const kind of ['deck','rails','braced'])probability(settings.river.floodCrossingChance[kind],'river.floodCrossingChance.'+kind);
    probability(settings.progression.familyPlanning.reflectionChance,'familyPlanning.reflectionChance');
    for(const key of ['shortageDays','childShortageDays','careDays'])integer(settings.progression.familyPlanning[key],'familyPlanning.'+key);
    integer(sim.learning.housingLookAheadDays,'learning.housingLookAheadDays',0);
    integer(sim.learning.housingExpectedChildren,'learning.housingExpectedChildren',0);
    for(const material of ['wood','stone','fibre'])nonnegative(settings.river.tributaryBridge.cost[material],'river.tributaryBridge.cost.'+material);
    for(const key of ['targetPeoplePerAnimal','hayBundle','hayDryDays','hayWetSpoilDays','winterFeedMargin','compostManure','compostOutput','compostSeasons','compostHarvests'])positive(h[key],'livestock.'+key);
    for(const key of ['pastureCapacity','hayMeadowCapacity'])positive(h[key],'livestock.'+key);
    for(const key of ['safeReserveDays','tradeIntervalSeasons','compostYieldBonus'])nonnegative(h[key],'livestock.'+key);
    for(const key of ['minimumTarget','maximumTarget','journeyRations'])integer(h[key],'livestock.'+key,0);
    for(const key of ['compostHarvests'])integer(h[key],'livestock.'+key);
    for(const key of ['pastureRegrowth','hayMeadowRegrowth'])if(!Array.isArray(h[key])||h[key].length!==4||h[key].some(n=>!Number.isFinite(n)||n<0))errors.push('livestock.'+key+' must contain four nonnegative seasonal rates');
    for(const [path,n] of [['seasonLength',sim.learning.seasonLength],['maxPassingGroup',settings.wildlife.maxPassingGroup],['hayDryDays',h.hayDryDays],['hayWetSpoilDays',h.hayWetSpoilDays],['seedFindEvery',settings.progression.wheat.seedFindEvery]])if(!Number.isInteger(n)||n<1)errors.push(path+' must be a positive integer');
    for(const key of ['minimumCompletedWinters','minimumHarvests','minimumExploredReaches'])if(!Number.isInteger(h[key])||h[key]<0)errors.push('livestock.'+key+' must be a nonnegative integer');
    for(const [kind,rules] of Object.entries(h.buildings)){integer(rules.work,kind+'.work');positive(rules.capacity,kind+'.capacity');for(const [material,n] of Object.entries(rules.cost))nonnegative(n,kind+'.cost.'+material);}
    for(const [kind,rules] of Object.entries(h.species)){
      for(const key of ['adult','life','gestation','interval','feed','space','litter'])positive(rules[key],kind+'.'+key);
      if(rules.adult>=rules.life)errors.push(kind+' must reach adulthood before old age');
      if(!Number.isInteger(rules.litter)||rules.litter>12)errors.push(kind+'.litter must be an integer from 1 to 12');
      for(const key of ['price','meat','hide','bone','milk'])nonnegative(rules[key],kind+'.'+key);
    }
    if(h.minimumTarget>h.maximumTarget)errors.push('minimumTarget cannot exceed maximumTarget');
    positive(settings.progression.fields.work,'fields.work');positive(settings.progression.fields.maxPlots,'fields.maxPlots');
    for(const key of ['ripeAt','batch','harvest','bread','fuel','peoplePerQuern'])positive(settings.progression.wheat[key],'wheat.'+key);
    if(settings.storage)for(const key of ['rackCapacity','jarCapacity','granaryCapacity','granaryBinCapacity','houseCapacity']){positive(settings.storage[key],'storage.'+key);integer(settings.storage[key],'storage.'+key);}
    if(sim.limits)positive(sim.limits.stock,'simulation.limits.stock');
    if(settings.nutrition){const n=settings.nutrition;
      for(const key of ['enabled','winterRationing'])if(typeof n[key]!=='boolean')errors.push('nutrition.'+key+' must be boolean');
      for(const key of ['recoveryFedDays','rationExperienceDays','rationSafetyDays']){positive(n[key],'nutrition.'+key);integer(n[key],'nutrition.'+key);}
      for(const key of ['recoveryFullness','recoveryWarmth','rationHealthyHealth','rationReserveFullness']){positive(n[key],'nutrition.'+key);if(n[key]>100)errors.push('nutrition.'+key+' must not exceed 100');}
      probability(n.rationIncomeConfidence,'nutrition.rationIncomeConfidence');
    }
    if(settings.hearths){const h=settings.hearths;
      for(const key of ['charcoalWood','charcoalYield','improvedCharcoalYield','charcoalHeat','reserveDays','ovenWork','ovenFuelMultiplier','ovenBakesBeforeStudy','ovenDryingBeforeStudy','ovenClayExperience','ovenTrialClay'])positive(h[key],'hearths.'+key);
      for(const key of ['ovenBakesBeforeStudy','ovenDryingBeforeStudy','ovenClayExperience'])integer(h[key],'hearths.'+key);
      integer(h.ovenWork,'hearths.ovenWork');probability(h.ovenFuelMultiplier,'hearths.ovenFuelMultiplier');
      for(const key of ['clay','wood'])positive(h.ovenCost[key],'hearths.ovenCost.'+key);
      nonnegative(h.ovenCost.stone,'hearths.ovenCost.stone');
      if(Math.max(h.charcoalYield,h.improvedCharcoalYield)*h.charcoalHeat>h.charcoalWood)errors.push('hearths: charcoal cannot create more fuel heat than its wood input');
    }
  }catch{errors.push('a required settings section is missing');}
  return errors;
}
export function scenarioStartSeed(random,requested=null){return (requested??SCENARIO.defaultSeed??random())>>>0;}
const invalidScenario=validateScenario();
if(invalidScenario.length)throw new RangeError('Invalid scenario settings:\n'+invalidScenario.join('\n'));
