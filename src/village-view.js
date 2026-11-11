// ALL village art lives here. The artist can replace this file later without
// touching the simulation, command reader, controls, or needs UI.
const COLORS = [0xeec98c, 0xa5c9a0, 0xccaacf, 0x95c7c8, 0xe1a58f, 0xc4c784, 0xb7b6e0, 0xe9be9d];
const SPOTS = { shelter: { x: 185, y: 160 }, fire: { x: 445, y: 255 },
  food: { x: 725, y: 150 }, wood: { x: 738, y: 320 }, rest: { x: 235, y: 295 } };
const TEXT = { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#c3d3bf' };
export function makeVillageScene(getState, onSelect) {
  return class VillageScene extends Phaser.Scene {
    constructor() { super('village'); this.people = new Map(); this.lastState = null; }
    create() {
      this.land = this.add.graphics();
      this.cues = this.add.graphics();
      this.weatherLabel = this.add.text(450, 24, '', { ...TEXT, fontSize: '11px' }).setOrigin(.5);
      this.add.text(185, 71, 'SHARED SHELTER', { ...TEXT, fontSize: '10px' }).setOrigin(.5);
      this.add.text(185, 86, '8 places · always open', { ...TEXT, fontSize: '10px', color: '#8eaa90' }).setOrigin(.5);
      this.add.text(725, 76, 'WILD FOOD', { ...TEXT, fontSize: '10px' }).setOrigin(.5);
      this.add.text(745, 448, 'WOODLAND', { ...TEXT, fontSize: '10px' }).setOrigin(.5);
      this.add.text(235, 432, 'RESTING PLACE', { ...TEXT, fontSize: '10px' }).setOrigin(.5);
      this.fireLabel = this.add.text(445, 301, '', { ...TEXT, fontSize: '10px' }).setOrigin(.5);
      this.add.text(22, 451, 'SELECT A LITTLE LIFE TO SEE ITS NEEDS', { ...TEXT, fontSize: '9px', color: '#8da88f' });
      this.drawLand();
      // Useful for accessibility/test readiness. No hidden game rules here.
      document.querySelector('#village').dataset.ready = 'true';
    }
    drawLand() {
      const g = this.land;
      g.fillStyle(0x263f38).fillRect(0, 0, 900, 480);
      g.fillStyle(0x304d3b).fillEllipse(444, 252, 770, 385);
      g.fillStyle(0x38543d).fillEllipse(447, 267, 625, 305);
      // Fixed positions, not random decoration: every render is repeatable.
      for (const [x, y, size] of [[58,98,28],[96,38,22],[830,69,29],[855,238,25],[63,367,30],[112,443,19],[800,453,19],[660,38,18]]) {
        g.fillStyle(0x203a32).fillRoundedRect(x - 4, y, 8, size * 1.6, 3);
        g.fillStyle(0x456547).fillCircle(x, y, size);
        g.fillStyle(0x50764e).fillCircle(x - size / 3, y - 8, size * .6);
      }
      g.lineStyle(26, 0x60704b, .42);
      for (const key of ['shelter', 'food', 'wood', 'rest']) {
        g.beginPath().moveTo(445, 255).lineTo(SPOTS[key].x, SPOTS[key].y).strokePath();
      }
      // Shelter: a geometric roof and doorway, deliberately not final artwork.
      g.fillStyle(0x1d332d).fillEllipse(185, 203, 166, 30);
      g.fillStyle(0xb6a278).fillRoundedRect(122, 140, 126, 63, 4);
      g.fillStyle(0xd5bc89).fillTriangle(103, 147, 185, 95, 267, 147);
      g.lineStyle(3, 0x8c795c).strokeTriangle(103, 147, 185, 95, 267, 147);
      g.fillStyle(0x314337).fillRoundedRect(165, 159, 40, 45, { tl: 20, tr: 20, bl: 0, br: 0 });
      // Food store / berries.
      g.fillStyle(0x21392f).fillEllipse(725, 176, 112, 29);
      g.fillStyle(0x6f8c50).fillCircle(697, 132, 23).fillCircle(733, 126, 29).fillCircle(758, 142, 21);
      for (const [x,y] of [[687,130],[705,140],[725,117],[740,137],[750,151]]) g.fillStyle(0xe6b88b).fillCircle(x,y,4);
      g.fillStyle(0x9c855f).fillRoundedRect(700, 164, 50, 22, 4);
      g.fillStyle(0xe8c883).fillCircle(711,166,7).fillCircle(728,164,8).fillCircle(740,167,6);
      // Wood stack.
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0x9c805c).fillRoundedRect(703+i*3, 332+i*12, 80-i*8, 12, 6);
        g.fillStyle(0xc0a376).fillCircle(708+i*3,338+i*12,5);
      }
      // A few rocks and tufts; shapes only, no external assets.
      for (let i = 0; i < 18; i++) {
        const x = 90 + (i * 137) % 725, y = 50 + (i * 73) % 370;
        g.lineStyle(2, 0x6a8253, .6).lineBetween(x,y,x-3,y-7).lineBetween(x,y,x+4,y-6);
      }
      g.lineStyle(3, 0x87907a).strokeEllipse(445, 267, 84, 47);
      for (let i=0;i<8;i++) {
        const a = i * Math.PI / 4;
        g.fillStyle(0x8d927b).fillEllipse(445+Math.cos(a)*41,267+Math.sin(a)*23,13,9);
      }
    }
    update() {
      const s = getState();
      const element = document.querySelector('#village');
      element.dataset.walking = String(this.tweens.getTweens().length > 0);
      if (s === this.lastState) return;
      // Time progress creates lightweight states. Redraw only on meaningful changes.
      const key = `${s.day}|${s.queuedCommand}|${s.speed}|${s.ended}`;
      if (key === this.lastKey) { this.lastState = s; return; }
      this.lastKey = key; this.lastState = s;
      element.dataset.simDay = String(s.day);
      this.cues.clear();
      const g = this.cues;
      const weather = s.lastDay?.weather || s.weather.type;
      this.weatherLabel.setText(weather === 'rain' ? 'RAIN · GOOD FOR FOOD, COLD FOR LITTLE LIVES' : weather === 'drought' ? 'DROUGHT · A SMALLER GATHERING' : 'A QUIET DAY IN THE CLEARING');
      if (weather === 'rain') {
        g.fillStyle(0x8bb0be,.08).fillRect(0,0,900,480);
        g.lineStyle(1,0xa5d7e0,.45);
        for(let i=0;i<60;i++) { const x=(i*139)%900,y=(i*79)%470; g.lineBetween(x,y,x-4,y+13); }
      } else if (weather === 'drought') {
        g.fillStyle(0xddb76a,.12).fillEllipse(450,255,780,370);
        g.fillStyle(0xe7c783,.8).fillCircle(825,40,16);
        g.lineStyle(1,0xb69c68,.6);
        for(let i=0;i<12;i++) {const x=70+i*63,y=310+(i%3)*35;g.lineBetween(x,y,x+10,y+7).lineBetween(x+10,y+7,x+15,y-4);}
      }
      g.lineStyle(6,0x8b6547).lineBetween(426,272,464,253).lineBetween(428,254,462,272);
      if(s.fireLit) {
        g.fillStyle(0xf4b478,.12).fillCircle(445,255,58);
        g.fillStyle(0xe99b56).fillTriangle(426,266,446,219,464,266);
        g.fillStyle(0xf5d891).fillTriangle(436,266,446,238,454,266);
      }
      this.fireLabel.setText(s.fireKnown ? (s.fireLit ? 'FIRE · BURNING TODAY' : 'FIRE KNOWN · UNLIT TODAY') : 'FIRE · NOT YET KNOWN');
      const livingIds = new Set(s.villagers.map(v=>v.id));
      for (const [id,p] of this.people) if(!livingIds.has(id)) { p.container.destroy(); this.people.delete(id); }
      for (const v of s.villagers) {
        let p=this.people.get(v.id);
        if(!p) {
          const body=this.add.circle(0,0,v.age<s.config.life.adult?10:13,COLORS[(v.id-1)%COLORS.length]).setStrokeStyle(2,0x1e332b);
          const eyes=this.add.graphics().fillStyle(0x263e34).fillCircle(-4,-1,1.5).fillCircle(4,-1,1.5);
          const label=this.add.text(0,19,v.name,{...TEXT,fontSize:'10px',color:'#f1eed9'}).setOrigin(.5,0);
          const status=this.add.text(0,-32,'',{...TEXT,fontSize:'9px',color:'#f4c48f',backgroundColor:'#263e34'}).setOrigin(.5);
          const container=this.add.container(400+(v.id%3)*42,340+Math.floor((v.id-1)/3)*42,[body,eyes,label,status]);
          body.setInteractive({useHandCursor:true}).on('pointerdown',()=>onSelect(v.id));
          p={container,body,status}; this.people.set(v.id,p);
        }
        p.body.setRadius(v.age<s.config.life.adult?10:13);
        const labels=[];
        if(v.illnessDays>0||v.illToday) labels.push('sick');
        if(v.health<s.config.needs.unwellBelow) labels.push('unwell');
        if(v.happiness<s.config.needs.unhappyBelow) labels.push('unhappy');
        if(v.safety===s.config.needs.unsafe) labels.push('uneasy');
        if(v.reaction) labels.push(v.reaction);
        p.status.setText(labels.join(' · '));
        p.body.setStrokeStyle(2,v.illnessDays>0||v.illToday?0xe39488:0x1e332b);
        if(s.day===0) continue;
        let spot=SPOTS.rest;
        if(v.activity==='Forage') spot=SPOTS.food;
        else if(v.activity==='Gather wood') spot=SPOTS.wood;
        else if(v.activity==='Warm up') spot=s.fireLit?SPOTS.fire:SPOTS.shelter;
        else if(v.activity==='Newborn') spot=SPOTS.shelter;
        // Fixed offset per permanent ID prevents villagers sitting on each other.
        const offset=(v.id-1)%4;
        const x=spot.x-61+offset*41,y=spot.y+48+Math.floor((v.id-1)/4)*43;
        this.tweens.killTweensOf(p.container);
        if (v.reaction === 'Learned fire') {
          // Brief shared learning reaction, then the normal activity destination.
          // This animation never performs work or advances simulation time.
          this.tweens.chain({ targets:p.container, tweens:[
            {x:SPOTS.fire.x-61+offset*41,y:SPOTS.fire.y+40+Math.floor((v.id-1)/4)*40,duration:600,ease:'Sine.easeInOut'},
            {x,y,duration:1000,delay:350,ease:'Sine.easeInOut'}
          ]});
        } else this.tweens.add({targets:p.container,x,y,duration:1000,ease:'Sine.easeInOut'});
      }
    }
  };
}
