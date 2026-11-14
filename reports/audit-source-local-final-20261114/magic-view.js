// Small, transient ritual props and light. No names, counters, or floating UI.
export function drawFolkRite(g,x,y,spell,clock,id){
  g.save();
  const color=spell==='mendingrites'?'#91b586':spell==='foretelling'?'#c2b0d4':'#dfc17c';
  g.strokeStyle='#9c8d70';g.lineWidth=1;
  g.beginPath();g.ellipse(x,y-1,15,5,0,0,Math.PI*2);g.stroke();
  if(spell==='foretelling')for(let i=0;i<4;i++){
    const bx=x-9+i*6,by=y-5+(i%2)*3;
    g.strokeStyle='#ded2b5';g.lineWidth=2.5;g.beginPath();g.moveTo(bx-2,by-2);g.lineTo(bx+2,by+1);g.stroke();
    g.fillStyle='#4b453c';g.fillRect(bx,by-1,1,1);
  }
  for(let i=0;i<6;i++){
    const phase=(clock*.35+i/6+id*.13)%1;
    g.globalAlpha=Math.sin(phase*Math.PI)*.55;g.fillStyle=color;
    g.beginPath();g.ellipse(x+Math.sin(i*2.4+clock)*12,y-8-phase*22,1.3,1.3,0,0,Math.PI*2);g.fill();
  }
  g.restore();
}
