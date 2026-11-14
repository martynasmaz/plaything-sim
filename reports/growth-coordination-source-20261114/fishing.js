// Overlapping river-fishing traditions, not a universal chronological ladder.
export const fishingCrafts=['fishing spear','fish trap','hook and line','fishing pole','fishing net'];
export function hasFishingGear(v){return !!v.fishTrap||fishingCrafts.some(item=>v.practice?.gear[item]);}
export function fishingMethod(v,day){
  const gear=v.practice?.gear||{},methods=[];
  if(gear['fishing spear'])methods.push('spear');
  if(v.fishTrap||gear['fish trap'])methods.push('trap');
  if(gear['hook and line'])methods.push('line');
  if(gear['fishing pole'])methods.push('pole');
  if(gear['fishing net'])methods.push('net');
  return day===undefined?methods.at(-1):methods[(day+v.id)%methods.length];
}
export const fishingMethodNames={spear:'spearing in the shallows',trap:'lifting a wicker fish trap',
  line:'fishing with a bone hook and handline',pole:'fishing with a wooden pole',net:'hauling a fibre fishing net'};
export function fishingDependencies(s,name){
  const people=s.villagers||[];
  const cord=people.some(v=>v.practice?.known.cordage)||s.textiles?.includes('cordage');
  if(name==='fishing spear')return people.some(v=>v.practice?.known['crude tools']);
  if(name==='fish trap')return people.some(v=>v.practice?.known.gathering);
  if(name==='fishing net')return !!cord;
  if(name==='hook and line')return !!cord&&people.some(v=>v.practice?.known.knapping);
  if(name==='fishing pole')return people.some(v=>v.practice?.known.angling||v.practice?.gear['hook and line']);
  return false;
}
export function fishingPhase(leg,walking,wait){
  return leg===0?'approach':leg===1&&wait>0&&!walking?'work':leg===1?'carry':'delivered';
}
