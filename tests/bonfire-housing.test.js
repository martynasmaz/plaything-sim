import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,stepDay,sleepingHut} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {campSites,worldTrees,hutBuildingSite} from '../src/practices.js';
import {campHearths,rememberCampHearth,nearestHearthCamp,initCampHearths} from '../src/camp-hearths.js';
import {chooseHousingSite,housingSiteOnLand} from '../src/housing-sites.js';
import {settleBuiltHouse} from '../src/settlement-layout.js';
import {journeyHome} from '../src/journeys.js';
import {serialize,deserialize} from '../src/save.js';

test('housing can cross either river and reach distant ground without an existing chain of houses',()=>{
  for(const destination of [[850,150],[850,550]]){
    const s=createState(HOMESTEAD_RULES,60);s.farming.sites={};let id=0;
    // Fill the rest of the map, leaving only a far, disconnected rectangle.
    for(let x=40;x<=960;x+=24)for(let y=65;y<=590;y+=20)
      if(Math.abs(x-destination[0])>100||Math.abs(y-destination[1])>65)s.farming.sites[id++]=[x,y];
    const site=chooseHousingSite(s,campSites,0,0);
    assert.ok(site);assert.ok(housingSiteOnLand(site));
    assert.ok(site[0]>700);assert.ok(Math.abs(site[1]-destination[1])<65);
    assert.ok(Math.hypot(site[0]-227,site[1]-222)>450);
  }
  for(const site of [[39,200],[961,200],[200,64],[200,591]])assert.equal(housingSiteOnLand(site),false);
});

test('only established bonfires allocate houses, including when extinguished and after reload',()=>{
  const s=createState(HOMESTEAD_RULES,60);s.fireKnown=true;initCampHearths(s,campSites);
  s.campFires={1:false};initCampHearths(s,campSites);
  assert.equal(nearestHearthCamp(s,campSites,[850,500]),0,'a prospective camp is not a hearth');
  rememberCampHearth(s,campSites,1);assert.equal(nearestHearthCamp(s,campSites,[850,500]),1);
  const loaded=deserialize(serialize(s),s.config);loaded.villagers=[];
  assert.equal(nearestHearthCamp(loaded,campSites,[850,500]),1);
  assert.equal(campHearths(loaded,campSites).length,2);
  const legacy=createState(HOMESTEAD_RULES,4);delete legacy.local.hearthRegistryVersion;
  legacy.campFires={2:false};initCampHearths(legacy,campSites);
  assert.ok(campHearths(legacy,campSites).some(h=>h.camp===2),'preserve old extinguished markers');
});

test('households move to the new home without duplicating beds or moving unrelated helpers',()=>{
  const s=createState(HOMESTEAD_RULES,60),[founder,partner,child,helper]=s.villagers;
  founder.household=partner.household=child.household=99;helper.household=100;
  s.huts=[0,1];s.hutDetails=[{site:[150,150]},{site:[850,500]}];
  const food=s.food;settleBuiltHouse(s,1,founder);
  assert.equal(founder.tribe,1);assert.equal(partner.tribe,1);assert.equal(child.tribe,1);
  assert.equal(helper.tribe||0,0);assert.equal(s.food,food);
  for(const p of [founder,partner,child]){
    assert.equal(sleepingHut(s,p),1);assert.deepEqual(journeyHome(s,p),[850,500]);
  }
  helper.tribe=1;assert.equal(sleepingHut(s,helper),-1,'three reserved beds cannot also house a fourth person');
  const loaded=deserialize(serialize(s),s.config);
  assert.deepEqual(journeyHome(loaded,loaded.villagers[0]),[850,500]);
});

test('paid construction assigns the finished house to the closest bonfire and moves its founder',()=>{
  const rules={...HOMESTEAD_RULES,traits:false,illness:{chance:0},learning:{...HOMESTEAD_RULES.learning,experimentChance:0,seasonLength:1000},weather:{chances:{normal:100,rain:0,drought:0,cold:0}}};
  let s=createState(rules,4),v=s.villagers[0];s.villagers=[v];
  s.wood=40;s.food=100;s.settlementWork=5;s.tribeCount=3;
  s.fireKnown=true;rememberCampHearth(s,campSites,1);
  v.fullness=v.warmth=v.health=v.happiness=v.practice.energy=100;v.practice.curiosity=0;
  v.gear='spear';v.fishTrap=true;v.practice.gear['hafted tool']=1;
  s.toolkit=['hammer stone','stone blades','digging stick','hand axe','mallet & chisel'];
  s.fireTools=['fire stick','bow drill','blowpipe','wooden tongs','burn bowl'];
  const site=[850,500];s.hutProject={camp:0,index:0,work:4,site,founder:v.id};
  s.local.stumps=Object.fromEntries(worldTrees(s).map((t,i)=>[i,s.day]));
  assert.equal(hutBuildingSite(s,v).camp,0,'paid project retains its saved ownership until completion');
  s=stepDay(s);
  assert.equal(s.hutProject,null);assert.deepEqual(s.huts,[1]);assert.equal(s.villagers[0].tribe,1);
  assert.deepEqual(s.hutDetails[0].site,site);assert.equal(sleepingHut(s,s.villagers[0]),0);
  assert.ok(s.lastDay.actions.some(a=>a.action.startsWith('Build')));
  assert.ok(s.wood<40,'completion consumes timber');
});
