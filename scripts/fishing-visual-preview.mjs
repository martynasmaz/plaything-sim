// A local contact sheet using the same equipment renderer and worker painter
// as the game. No simulation state or saved world is changed by this preview.
import {readFileSync,writeFileSync} from 'node:fs';
const view=readFileSync(new URL('../src/fishing-view.js',import.meta.url),'utf8').replace(/^export /gm,'');
const clearing=readFileSync(new URL('../src/clearing.js',import.meta.url),'utf8');
const worker=clearing.slice(clearing.indexOf('function paintWorker('),clearing.indexOf('function bankY('));
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>River fishing equipment preview</title>
<style>body{margin:20px;background:#e8ddc2;color:#382d24;font-family:Georgia,serif}h1{font-size:25px}p{max-width:1000px}canvas{max-width:100%;border:1px solid #a28c63}button{font:inherit;padding:6px 14px}</style>
<h1>River fishing — local visual check</h1><p>Stone Age materials: wooden spears, wicker traps, bone hooks, fixed-line poles, and plant-fibre nets with bark floats and stone sinkers. The equipment and people use the game's actual drawing functions.</p>
<button id="toggle">Pause animation</button> <span id="status">Live animation</span><br><br><canvas id="sheet" width="1200" height="660"></canvas>
<script>
${view}
function ellipse(g,x,y,rx,ry,fill){g.beginPath();g.ellipse(x,y,rx,ry,0,0,2*Math.PI);g.fillStyle=fill;g.fill();}
function line(g,x,y,ex,ey,color,width){g.beginPath();g.moveTo(x,y);g.lineTo(ex,ey);g.strokeStyle=color;g.lineWidth=width;g.stroke();}
const tribeColors=['#9c5139','#446c72','#806a96'];
${worker}
const g=document.getElementById('sheet').getContext('2d'),methods=['spear','trap','line','pole','net'];
let paused=false,clock=2.8,previous=performance.now();
document.getElementById('toggle').onclick=()=>{paused=!paused;document.getElementById('toggle').textContent=paused?'Resume animation':'Pause animation';document.getElementById('status').textContent=paused?'Paused':'Live animation';};
function panel(x,y,w,h,method,time,label){
 g.save();g.translate(x,y);g.fillStyle='#f0e4c6';g.fillRect(0,0,w,h);
 g.fillStyle='#496f73';g.beginPath();g.moveTo(0,128);g.quadraticCurveTo(w/2,117,w,134);g.lineTo(w,h);g.lineTo(0,h);g.fill();
 for(let i=0;i<6;i++)line(g,5+i*39,169+i%2*24,27+i*39,169+i%2*24,'#b4c7b94d',1);
 for(let i=0;i<4;i++){line(g,w-25+i*5,130,w-27+i*5,99+i%3*7,'#727e48',1.6);}
 g.font='18px Georgia';g.fillStyle='#382d24';g.fillText(label,12,26);
 g.save();g.translate(45,112);g.scale(1.6,1.6);
 paintWorker(g,{id:2,age:65,gender:'female',tribe:0,traits:[]},0,0,false,false,false,0,'Fish',time,[],false);
 drawRiverFishing(g,{x:0,y:0,method,clock:time,id:0,caught:2});g.restore();g.restore();
}
function frame(now){if(!paused)clock+=(now-previous)/1000;previous=now;g.clearRect(0,0,1200,660);
 const labels=['Wooden fishing spear','Wicker funnel trap','Bone hook + handline','Fixed-line wooden pole','Fibre net + floats/weights'];
 for(let i=0;i<5;i++)panel(i*240,0,234,290,methods[i],clock,labels[i]);
 for(let i=0;i<4;i++)panel(i*300,320,294,300,'net',[1.1,4.3,6,7.6][i],['Net set in the shallows','Watching / soaking','Hauling toward the bank','Lifting out the catch'][i]);
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
</script></html>`;
writeFileSync(new URL('../reports/fishing-preview.html',import.meta.url),html);
console.log('Wrote reports/fishing-preview.html');
