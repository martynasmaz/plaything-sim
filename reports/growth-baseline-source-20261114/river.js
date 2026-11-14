// A separate saved accident sequence leaves nightly weather/illness dice alone.
// Each fall gets a fresh deterministic draw with a one-in-1,000 fatal chance.
export function riverFallOutcome(seed,count){
  let h=Math.imul(seed^Math.imul(count,1597334677)^0x5c71,2246822519);
  h=Math.imul(h^(h>>>16),3266489917);
  return ((h^(h>>>16))>>>0)%1000===0;
}
export function riverLandingFraction(seed,id,count){
  let h=Math.imul(seed^Math.imul(id+1,1597334677)^Math.imul(count+1,2246822519),3266489917);
  return ((h^(h>>>16))>>>0)/4294967296;
}
