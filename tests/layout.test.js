// Pure geometry check of THEME.layout: up to 8 Gourdlings never overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME, slotPosition } from '../src/theme.js';

const L=THEME.layout, LABEL_HALF_WIDTH=24, LABEL_HEIGHT=14;
// Worst case (adult art 40x60): sprite from feet-60 to feet, then the name label.
function personBox(grid,slot){
  const {x,y}=slotPosition(grid,slot),foot=y+L.people.footOffset,[w,h]=THEME.assetSpecs.villager.size;
  const half=Math.max(w/2,LABEL_HALF_WIDTH);
  return [x-half,foot-h,x+half,y+L.text.labelY+LABEL_HEIGHT];
}
const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const grids=Object.keys(L.slots.grids),max=8;

test('8 slots in every grid: no two Gourdlings overlap, in any mix of activities', () => {
  assert.equal(max,8);
  for(const a of grids)for(const b of grids)for(let r=0;r<max;r++)for(let s=0;s<max;s++){
    if(r===s)continue; // the same Gourdling cannot be in two places
    assert.ok(!overlap(personBox(a,r),personBox(b,s)),`${a}#${r} overlaps ${b}#${s}`);
  }
});

test('every slot is on the canvas and inside the green clearing', () => {
  const G=L.ground;
  for(const g of grids)for(let r=0;r<max;r++){
    const [x0,y0,x1,y1]=personBox(g,r),{x,y}=slotPosition(g,r);
    assert.ok(x0>=0&&y0>=0&&x1<=L.canvas.width&&y1<=L.canvas.height,`${g}#${r} off canvas`);
    assert.ok(x>=G.x&&x<=G.x+G.width&&y+L.people.footOffset<=G.y+G.height&&y>=G.y,`${g}#${r} off the clearing`);
  }
});

test('fence pieces sit on a 64 px grid with feet on the ground', () => {
  const xs=L.fence.filter(f=>f.key!=='fence_vertical').map(f=>f.x).sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)assert.equal(xs[i]-xs[i-1],64,'horizontal pieces touch');
  const top=L.fence.find(f=>f.key==='fence_tile').y;
  for(const f of L.fence.filter(f=>f.key!=='fence_vertical'))assert.equal(f.y,top);
  for(const f of L.fence.filter(f=>f.key==='fence_vertical')){
    assert.equal(f.y-top,64,'vertical piece joins the corner below it');
    const corner=L.fence.find(c=>c.key==='fence_corner'&&c.x===f.x);
    assert.ok(corner,'vertical piece hangs under a corner');assert.equal(!!corner.flipX,!!f.flipX);
  }
  const postFoot=top-32+56; // SVG posts end at tile y 56 (pivot 32,32)
  assert.ok(postFoot>L.ground.y&&top-32+16<L.ground.y+12,'post feet on the green, tops at its edge');
  const [left,right]=[xs[0]-32,xs.at(-1)+32];
  assert.ok(left>=L.ground.x+L.ground.radius&&right<=L.ground.x+L.ground.width-L.ground.radius,'fence over the straight top edge');
});
