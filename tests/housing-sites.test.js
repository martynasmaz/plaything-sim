import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createState} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {hutBuildingSite,campSites} from '../src/practices.js';
import {chooseHousingSite,housingSiteContext,housingSiteRules,housingSiteOnLand} from '../src/housing-sites.js';
import {riverHabitat} from '../src/ecology.js';
import {serialize,deserialize} from '../src/save.js';

function safe(s,camp,site){
  assert.ok(housingSiteOnLand(site));
  for(const p of housingSiteContext(s,campSites,camp).occupied)assert.ok(Math.hypot((site[0]-p.site[0])/p.rx,(site[1]-p.site[1])/p.ry)>=1,'clear '+p.site);
}
test('the actual117-person village finds an alternative to the blocked pen site without moving anything',()=>{
  const s=deserialize(readFileSync(new URL('../reports/no-eating-seed-61-day750-save.json',import.meta.url),'utf8'),HOMESTEAD_RULES),before=serialize(s);
  const result=hutBuildingSite(s,s.villagers[0]);assert.equal(result.blocked,false);safe(s,0,result.site);
  assert.notDeepEqual(result.site,[72.21908922062417,183.0543423026906]);assert.equal(serialize(s),before);
  const point=result.site.slice();result.site[0]=-100;assert.deepEqual(hutBuildingSite(s,s.villagers[0]).site,point,'cached result cannot be mutated by its caller');
});

test('completed homes extend the search beyond the original310-unit radius',()=>{
  const s=createState(HOMESTEAD_RULES,60);s.villagers.forEach(v=>v.tribe=1);
  s.huts=Array(6).fill(1);s.hutDetails=[740,672,604,536,468,400].map(x=>({site:[x,500],shape:'round hut'}));
  // Existing plots occupy the original neighbourhood, leaving the settled
  // western edge available. No hypothetical home reserves this land.
  s.farming.sites={};let id=0;
  for(let x=480;x<=960;x+=40)for(let y=65;y<=590;y+=30)s.farming.sites[id++]=[x,y];
  const site=chooseHousingSite(s,campSites,1,6);assert.ok(site);safe(s,1,site);
  assert.ok(Math.hypot(site[0]-campSites[1][0],site[1]-campSites[1][1])>310);
  s.huts.push(1);s.hutDetails.push({site:site.slice(),shape:'round hut'});
  assert.ok(housingSiteContext(s,campSites,1).anchors.some(p=>p.every((n,i)=>n===site[i])));
  const next=chooseHousingSite(s,campSites,1,7);assert.ok(next);safe(s,1,next);assert.notDeepEqual(next,site);
});

test('a fully occupied area stays blocked instead of placing a house in water or another structure',()=>{
  const s=createState(HOMESTEAD_RULES,4);s.farming.sites={};let id=0;
  for(let x=40;x<=960;x+=35)for(let y=65;y<=590;y+=25)s.farming.sites[id++]=[x,y];
  const before=serialize(s);assert.equal(hutBuildingSite(s,s.villagers[0]).blocked,true);assert.equal(serialize(s),before);
});

test('paid projects and ruined houses keep their saved sites through the new planner and reload',()=>{
  const s=createState(HOMESTEAD_RULES,4),site=[180,130];s.hutProject={camp:0,index:0,site,work:1,clearedTrees:[4]};
  s.local.husbandry.pens.push({id:'legacy-overlap',site:site.slice(),camp:0,work:4});
  assert.deepEqual(hutBuildingSite(s,s.villagers[0]).site,site);
  const loaded=deserialize(serialize(s),s.config);assert.deepEqual(hutBuildingSite(loaded,loaded.villagers[0]).site,site);
  loaded.hutProject=null;loaded.huts=[0];loaded.hutDetails=[{site:site.slice(),ruined:true}];
  const repair=hutBuildingSite(loaded,loaded.villagers[0]);assert.equal(repair.repairSlot,0);assert.deepEqual(repair.site,site);
});
