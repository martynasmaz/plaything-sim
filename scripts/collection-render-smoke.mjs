// Native Canvas checks artwork without opening or changing a player save.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createState,encyclopediaCatalog} from '../src/sim.js';
import {HOMESTEAD_RULES} from '../src/config.js';
import {drawCollectionPicture} from '../src/encyclopedia.js';
import {drawHouseholdHut} from '../src/settlement-view.js';
const require=createRequire(import.meta.url),{createCanvas}=require(process.argv[2]||'@napi-rs/canvas');
const state=createState(HOMESTEAD_RULES,4),before=JSON.stringify(state),entries=encyclopediaCatalog(state),cols=5;
const sheet=createCanvas(1000,Math.ceil(entries.length/cols)*150),g=sheet.getContext('2d');g.fillStyle='#efe3c6';g.fillRect(0,0,sheet.width,sheet.height);
for(const [i,e] of entries.entries()){
  const tile=createCanvas(180,100);drawCollectionPicture(tile.getContext('2d'),e.product);
  const x=10+i%cols*200,y=10+Math.floor(i/cols)*150;g.drawImage(tile,x,y);
  g.fillStyle='#332e24';g.font='13px Arial';g.fillText(e.name.slice(0,29),x,y+120);
}
assert.equal(JSON.stringify(state),before);writeFileSync(new URL('../reports/encyclopedia-artwork-local.png',import.meta.url),sheet.toBuffer('image/png'));
const houses=createCanvas(1000,240),h=houses.getContext('2d');h.fillStyle='#677a4d';h.fillRect(0,0,1000,240);
for(const [i,shape] of ['A-frame hut','round hut','dome hut','gabled roof hut','pyramidal hut'].entries()){
  drawHouseholdHut(h,100+i*200,180,{shape,chimney:true,ondol:true},3.4,true);
  h.fillStyle='#fff1d5';h.font='16px Arial';h.textAlign='center';h.fillText(shape,100+i*200,222);
}
writeFileSync(new URL('../reports/houses-local.png',import.meta.url),houses.toBuffer('image/png'));
console.log('Rendered '+entries.length+' collection entries and all five hut shapes; world unchanged.');
