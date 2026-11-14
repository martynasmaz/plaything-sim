import {createRequire} from 'node:module';
import {writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createFamilyTreeView} from '../src/family-tree-view.js';
import {familyTreeFixture} from '../tests/fixtures/family-tree.js';
import {familyDom} from '../tests/fixtures/family-dom.js';
const require=createRequire(import.meta.url),{createCanvas,Path2D}=require(process.argv[2]||'@napi-rs/canvas');
function rounded(g,x,y,w,h,r,fill,stroke,line=1){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=line;g.stroke();}}
for(const [name,width,height,fit] of [['desktop',1120,760,true],['phone',350,520,false],['full',1328,1090,true]]){
  const dom=familyDom(width,height,createCanvas);globalThis.document=dom.doc;globalThis.Option=dom.OptionClass;
  const state=familyTreeFixture(),before=JSON.stringify(state),view=createFamilyTreeView(dom.doc.body,()=>state);view.open(7);
  if(fit)dom.doc.body.querySelectorAll('button').find(b=>b.textContent==='Fit').click();
  const viewport=dom.doc.body.querySelector('.family-atlas-viewport'),chart=dom.doc.body.querySelector('.family-atlas-chart'),scale=Number(chart.style.transform.match(/[\d.]+/)[0]);
  const canvas=createCanvas(width+40,height+135),g=canvas.getContext('2d');g.fillStyle='#efe5cd';g.fillRect(0,0,canvas.width,canvas.height);
  g.fillStyle='#3d4936';g.font='bold 23px Georgia';g.fillText('The village family album',20,33);g.font='13px Georgia';g.fillStyle='#7e735b';g.fillText('Matas · ancestors, co-parents, children & grandchildren',20,57);
  rounded(g,20,77,width,height,12,'#eee5cd','#bcac87');g.save();g.beginPath();g.roundRect(20,77,width,height,12);g.clip();g.translate(20+parseFloat(chart.style.left)-viewport.scrollLeft,77+parseFloat(chart.style.top)-viewport.scrollTop);g.scale(scale,scale);
  for(const path of chart.querySelectorAll('path')){g.strokeStyle=path.getAttribute('stroke');g.lineWidth=Number(path.getAttribute('stroke-width'));g.lineCap='round';g.stroke(new Path2D(path.getAttribute('d')));}
  for(const card of chart.querySelectorAll('.family-person')){
    const x=parseFloat(card.style.left),y=parseFloat(card.style.top),selected=card.getAttribute('aria-pressed')==='true',dead=card.className.includes('is-dead');
    rounded(g,x,y,136,154,12,selected?'#f2f5e5':dead?'#f5efdf':'#fff9e9',selected?'#5d7d62':'#c2b390',selected?2:1);
    g.drawImage(card.querySelector('canvas').canvas,x+35,y+8,66,66);g.textAlign='center';g.fillStyle='#403a2d';g.font='bold 14px Georgia';g.fillText(card.querySelector('strong').textContent,x+68,y+92,124);
    const small=card.querySelectorAll('small');g.fillStyle='#786e55';g.font='11px Georgia';g.fillText(small[0].textContent,x+68,y+109,124);
    const status=card.querySelector('span').textContent;rounded(g,x+32,y+116,72,16,8,dead?'#e8e0cf':'#e6edda');g.fillStyle=dead?'#7d715a':'#526347';g.font='10px Georgia';g.fillText(status,x+68,y+128,70);g.fillStyle='#786e55';g.font='11px Georgia';g.fillText(small[1].textContent,x+68,y+145,124);
  }
  g.restore();g.textAlign='left';g.font='12px Georgia';g.fillStyle='#776e55';g.fillText(name==='phone'?'Swipe to explore · tap a portrait to follow their family':'Select a portrait to follow another branch · zoom, fit or expand',20,height+104,width);
  assert.equal(JSON.stringify(state),before,'the family viewer cannot change ancestry or simulation state');writeFileSync(new URL('../reports/family-tree-'+name+'.png',import.meta.url),canvas.toBuffer('image/png'));
}
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('Rendered the actual family graph, cards and shared portraits at desktop/phone sizes; navigation remains display-only; offline bundle parsed.');
