// Material/knowledge gates for the live village's shared equipment. These
// supplement personal recipes; old reference simulations keep their rules.
const equipmentRecipes={
  'hammer stone':{requires:['crude tools'],cost:{stone:1}},
  'stone blades':{requires:['knapping'],tool:'hammer stone',cost:{stone:2}},
  'digging stick':{requires:['crude tools'],skills:{wood:2},cost:{wood:1}},
  'hand axe':{requires:['hafting'],cost:{stone:1,wood:1,fibre:1,resin:1}},
  'mallet & chisel':{requires:['knapping','cordage'],tool:'hammer stone',skills:{wood:3},cost:{wood:2,stone:2,fibre:1}},
  'fire stick':{requires:['fire tending'],skills:{wood:2},cost:{wood:2}},
  'bow drill':{requires:['fire tending','cordage'],skills:{wood:4},cost:{wood:2,fibre:1}},
  blowpipe:{requires:['fire tending'],skills:{wood:3},cost:{wood:1}},
  'wooden tongs':{requires:['fire tending','crude tools'],skills:{wood:3},cost:{wood:1}},
  'burn bowl':{requires:['fire tending'],skills:{wood:4},cost:{wood:2}},
  sling:{requires:['cordage'],cost:{fibre:2,hide:1}},
  bow:{requires:['cordage','crude tools'],skills:{wood:3},cost:{wood:2,fibre:2}},
  'spear thrower':{requires:['crude tools'],skills:{wood:3},cost:{wood:2,stone:1}},
  cordage:{requires:['cordage'],cost:{fibre:2}},
  'standard weave basket':{requires:['cordage','baskets'],cost:{fibre:2}},
  'coil weave basket':{requires:['cordage','baskets'],cost:{fibre:2}},
  'twining weave basket':{requires:['cordage','baskets'],cost:{fibre:2}},
  'drop spindle':{requires:['cordage'],skills:{wood:2,fibre:3},cost:{fibre:2,wood:1}},
  loom:{requires:['cordage','housing'],tool:'mallet & chisel',skills:{wood:4,fibre:4},cost:{wood:2,fibre:4}},
  sandals:{requires:['cordage','knapping'],skills:{hide:2},cost:{hide:1,fibre:2}},
  'drystone wall':{requires:['housing','knapping'],skills:{stone:3},cost:{stone:4,wood:1}},
  'mud wall':{requires:['housing','shaping'],cost:{clay:3,wood:1}},
  'wattle & daub wall':{requires:['housing','cordage','shaping'],cost:{wood:2,fibre:2,clay:2}},
  'dome hut':{requires:['housing','cordage'],cost:{wood:2,fibre:1}},
  'gabled roof hut':{requires:['housing','hafting'],tool:'mallet & chisel',cost:{wood:3,fibre:2}},
  'A-frame hut':{requires:['housing','hafting'],cost:{wood:3,fibre:1}},
  'round hut':{requires:['housing','cordage'],cost:{wood:2,fibre:2}},
  'pyramidal hut':{requires:['housing','cordage'],cost:{wood:3,fibre:2}},
  chimney:{requires:['housing','fire tending'],cost:{stone:3,clay:2,wood:1}},
  ondol:{requires:['housing','fire tending','shaping'],cost:{stone:4,clay:3,wood:2}}
};
export const equipmentCost=name=>equipmentRecipes[name]?.cost;
export function equipmentRecipe(s,v,name){
  const r=equipmentRecipes[name];
  if(!r||!r.requires.every(id=>v.practice?.known[id])||r.tool&&!s.toolkit?.includes(r.tool)||
    !Object.entries(r.skills||{}).every(([id,n])=>(v.practice.skills[id]||0)>=n))return null;
  return r;
}
export function equipmentAffordable(s,r){return !!r&&Object.entries(r.cost).every(([id,n])=>(id==='wood'?s.wood:s.local.stock[id]||0)>=n);}
export function payEquipment(s,r){for(const [id,n] of Object.entries(r.cost))(id==='wood'?s:s.local.stock)[id]-=n;}
