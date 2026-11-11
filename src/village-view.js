// Renderer only: every palette, primitive, image choice, label and dimension is
// supplied by theme.js. Rules and command keywords never depend on loaded art.
import { THEME, t, themeColor, spriteManifest, villagerTextureCandidates, slotPosition } from './theme.js';

export function makeVillageScene(getState, onSelect) {
  return class VillageScene extends Phaser.Scene {
    constructor() { super('village'); this.people=new Map(); this.lastState=null; this.optionalImages=new Map(); }
    preload() {
      this.manifest=spriteManifest();
      this.missing=[];
      // Missing files are optional, not a boot failure. Default map is empty:
      // today's asset-free build makes NO image/network requests at all.
      this.load.on('loaderror',file=>this.missing.push(file.key));
      for(const [key,url] of Object.entries(this.manifest))this.load.image(key,url);
    }
    has(key) { return this.textures.exists(key); }
    image(key,x,y,specKey=key) {
      const spec=THEME.assetSpecs[specKey];
      if(!spec||!this.has(key))return null;
      const image=spec.tile?this.add.tileSprite(x,y,THEME.layout.canvas.width,THEME.layout.canvas.height,key).setOrigin(...spec.origin)
        :this.add.image(x,y,key).setOrigin(...spec.origin).setDisplaySize(...spec.size);
      image.setAlpha(spec.alpha??1);
      if(spec.layer)image.setDepth(THEME.layout.depth[spec.layer]+(spec.layer==='world'?y:0));
      return image;
    }
    text(key,point,values={},size=THEME.layout.text.small,origin=.5) {
      return this.add.text(...point,t(key,values),{fontFamily:THEME.fonts.canvas,fontSize:`${size}px`,color:THEME.palette[THEME.layout.canvasText.color],backgroundColor:THEME.palette[THEME.layout.canvasText.background],padding:THEME.layout.canvasText.padding}).setOrigin(origin).setDepth(THEME.layout.depth.labels);
    }
    shadow(g,x,y,width,height) {
      const S=THEME.layout.shadow;
      const image=this.image('shadow',x+S.offsetX,y+S.offsetY);
      if(image)image.setDisplaySize(width,height);
      else THEME.fallbacks.shadow(g,x,y,width,height);
    }
    create() {
      const L=THEME.layout,s=getState();
      this.land=this.add.graphics();
      THEME.fallbacks.base(this.land);
      if(!this.image('background',0,0)) {
        THEME.fallbacks.terrain(this.land);
        if(this.has('ground_tile')) {
          const maskShape=this.make.graphics({x:0,y:0,add:false});
          // A theme-provided terrain mask keeps seamless square tiles in the clearing.
          THEME.fallbacks.groundMask(maskShape);
          const mask=maskShape.createGeometryMask(),[w,h]=THEME.assetSpecs.ground_tile.size;
          for(let x=0;x<L.canvas.width;x+=w)for(let y=0;y<L.canvas.height;y+=h)this.image('ground_tile',x,y).setMask(mask);
          const paths=this.add.graphics();THEME.fallbacks.paths(paths);
        }
      }
      this.land=this.add.graphics();
      for(const {key,x,y,angle=0,flipX=false} of L.fence){const image=this.image(key,x,y);if(image)image.setAngle(angle).setFlipX(flipX);else THEME.fallbacks[key](this.land,x,y,flipX);}
      for(const [x,y] of L.corn)if(!this.image('corn',x,y))THEME.fallbacks.corn(this.land,x,y);
      // Prop shadows are separate from prop SVGs and remain replaceable.
      for(const key of ['shelter','food_spot','wood_spot','pantry','lantern']) {
        const [x,y]=L.props[key],spec=THEME.assetSpecs[key];
        this.shadow(this.land,x,y,spec.size[0]*L.propShadow.width,spec.size[0]*L.propShadow.height);
        if(!this.image(key,x,y))THEME.fallbacks[key](this.land);
      }
      this.cues=this.add.graphics();
      for(const key of ['rain','drought']) {
        const image=this.image(key,0,0);if(image)this.optionalImages.set(key,image.setVisible(false));
      }
      for(const key of ['campfire_lit','campfire_out']) {
        const image=this.image(key,...L.props[key]);if(image)this.optionalImages.set(key,image.setVisible(false));
      }
      for(const key of ['rain_cue','drought_cue']) {
        const image=this.image(key,L.weatherCue.x,L.weatherCue.y);if(image)this.optionalImages.set(key,image.setVisible(false));
      }
      this.weatherLabel=this.text('scene.normal',L.labels.weather,{},L.text.weather);
      this.sceneLabels=[this.weatherLabel];
      for(const key of ['shelter','food','wood','rest','pantry'])this.sceneLabels.push(this.text(`scene.${key}`,L.labels[key]));
      this.sceneLabels.push(this.text('scene.shelterPlaces',L.labels.shelterPlaces,{places:s.config.limits.shelter}));
      this.fireLabel=this.text('scene.fireUnknown',L.labels.fire);
      this.sceneLabels.push(this.fireLabel,this.text('scene.hint',L.labels.hint,{},L.text.hint,0));
      const element=document.querySelector('#village');
      element.dataset.ready='true';
      element.dataset.loadedSprites=JSON.stringify(Object.keys(this.manifest).filter(key=>this.has(key)));
      element.dataset.missingSprites=JSON.stringify(this.missing);
      if(this.has('command_panel')){document.documentElement.style.setProperty('--command-panel-art',`url("${this.manifest.command_panel}")`);document.querySelector('#command-form').classList.add('has-art');}
    }
    makePerson(v,child,slot) {
      const L=THEME.layout,start=slotPosition('rest',slot);
      const shadow=this.add.graphics();
      const foot=child?L.people.childFootOffset:L.people.footOffset;
      const shadowSize=child?THEME.assetSpecs.shadow.childSize:THEME.assetSpecs.shadow.size;
      const shadowImage=this.image('shadow',L.shadow.offsetX,foot+L.shadow.offsetY);
      if(shadowImage)shadowImage.setDisplaySize(...shadowSize);
      else THEME.fallbacks.shadow(shadow,0,foot,...shadowSize);
      const {body,eyes}=THEME.fallbacks.villager(this,child);
      const label=this.text('labels.nameFallback',[0,L.text.labelY],{id:v.id},L.text.small).setText(v.name).setOrigin(.5,0);
      // Long names shrink to fit the slot instead of spilling onto a neighbour.
      if(label.width>L.text.labelMaxWidth)label.setScale(L.text.labelMaxWidth/label.width);
      const icons=this.add.container(0,0);
      // Everyone starts in their rest slot (also on day 0).
      const container=this.add.container(start.x,start.y,
        [shadow,...(shadowImage?[shadowImage]:[]),body,eyes,label,icons]);
      // Both an image and a shape share this same generous clickable area.
      const [w,h]=THEME.assetSpecs.villager.size;
      container.setInteractive(new Phaser.Geom.Rectangle(-w/2,L.fallback.adultRadius-h,w,h),Phaser.Geom.Rectangle.Contains);
      container.input.cursor='pointer';container.on('pointerdown',()=>onSelect(v.id));
      return {container,body,eyes,label,icons,shadow,shadowImage,sprite:null,child};
    }
    refreshPersonImage(p,v,time) {
      const foot=p.child?THEME.layout.people.childFootOffset:THEME.layout.people.footOffset;
      if(p.shadowImage)p.shadowImage.setPosition(THEME.layout.shadow.offsetX,foot+THEME.layout.shadow.offsetY).setDisplaySize(...(p.child?THEME.assetSpecs.shadow.childSize:THEME.assetSpecs.shadow.size));
      const walking=Math.hypot(p.container.x-(p.lastX??p.container.x),p.container.y-(p.lastY??p.container.y))>THEME.layout.animation.motionThreshold;
      p.lastX=p.container.x;p.lastY=p.container.y;
      const key=villagerTextureCandidates(v,p.child,walking,time).find(key=>this.has(key));
      if(!key){p.sprite?.setVisible(false);p.body.setVisible(true);p.eyes.setVisible(true);return;}
      const spec=THEME.assetSpecs[p.child?'villager_child':'villager'];
      if(!p.sprite) {
        p.sprite=this.add.image(0,0,key);p.container.addAt(p.sprite,2);
      }
      p.sprite.setTexture(key).setOrigin(...spec.origin).setDisplaySize(...spec.size)
        .setPosition(0,p.child?THEME.layout.people.childFootOffset:THEME.layout.people.footOffset).setVisible(true);
      p.body.setVisible(false);p.eyes.setVisible(false);
    }
    layoutBoxes() {
      const box=o=>{const b=o.getBounds();return [Math.round(b.x),Math.round(b.y),Math.round(b.right),Math.round(b.bottom)];};
      return {people:[...this.people].map(([id,p])=>({id,child:p.child,sprite:box(p.sprite?.visible?p.sprite:p.body),label:box(p.label)})),
        scene:this.sceneLabels.filter(o=>o.text).map(box)};
    }
    update(time) {
      const s=getState(),L=THEME.layout,element=document.querySelector('#village');
      element.dataset.walking=String(this.tweens.getTweens().length>0);
      for(const v of s.villagers){const p=this.people.get(v.id);if(p){p.container.setDepth(L.depth.world+p.container.y+(p.child?L.people.childFootOffset:L.people.footOffset));this.refreshPersonImage(p,v,time);}}
      element.dataset.spritePeople=String([...this.people.values()].filter(p=>p.sprite?.visible).length);
      // Read-only layout evidence for tests: on-canvas boxes once nobody moves.
      if(!this.tweens.getTweens().length&&this.boxesFor!==this.lastKey){this.boxesFor=this.lastKey;element.dataset.layoutBoxes=JSON.stringify(this.layoutBoxes());}
      if(s===this.lastState)return;
      const key=`${s.day}|${s.ended}`;
      if(key===this.lastKey){this.lastState=s;return;}
      this.lastKey=key;this.lastState=s;element.dataset.simDay=String(s.day);
      this.cues.clear();for(const image of this.optionalImages.values())image.setVisible(false);
      const weather=s.lastDay?.weather||s.weather.type;
      this.weatherLabel.setText(t(`scene.${weather}`));
      if(weather!=='normal') {
        const image=this.optionalImages.get(weather);
        if(image)image.setVisible(true);else THEME.fallbacks[weather](this.cues);
        const cue=this.optionalImages.get(weather+'_cue');
        if(cue)cue.setVisible(true);else THEME.fallbacks[weather+'_cue'](this.cues,L.weatherCue.x,L.weatherCue.y);
      }
      const fire=s.fireLit?'campfire_lit':'campfire_out';
      const fireImage=this.optionalImages.get(fire);
      if(fireImage)fireImage.setVisible(true);else THEME.fallbacks[fire](this.cues);
      this.fireLabel.setText(t(s.fireKnown?(s.fireLit?'scene.fireLit':'scene.fireOut'):'scene.fireUnknown'));
      const livingIds=new Set(s.villagers.map(v=>v.id));
      // Slot = place in villager-number order among the living (0..7).
      const slots=new Map([...s.villagers].sort((a,b)=>a.id-b.id).map((v,i)=>[v.id,i]));
      for(const [id,p] of this.people)if(!livingIds.has(id)){this.tweens.killTweensOf(p.container);p.container.destroy();this.people.delete(id);}
      for(const v of s.villagers) {
        let p=this.people.get(v.id),child=v.age<s.config.life.adult;
        if(!p){p=this.makePerson(v,child,slots.get(v.id));this.people.set(v.id,p);}
        p.child=child;p.body.setRadius(child?L.fallback.childRadius:L.fallback.adultRadius);
        const conditions=[];
        if(v.illnessDays>0||v.illToday)conditions.push('sick');
        if(v.health<s.config.needs.unwellBelow)conditions.push('unwell');
        if(v.happiness<s.config.needs.unhappyBelow)conditions.push('unhappy');
        if(v.safety===s.config.needs.unsafe)conditions.push('uneasy');
        // Conditions show as icons on the sprite (words are in the detail panel
        // and the accessible list), so nothing spills into a neighbour's slot.
        p.body.setStrokeStyle(L.fallback.outline,themeColor(conditions.includes('sick')?'red':'ink'));
        p.icons.removeAll(true);
        const icons=[...new Set(conditions.map(c=>(c==='unwell'?'sick':c)+'_icon'))];
        if(v.reaction==='Grateful')icons.push('hoedown_icon');
        if(v.activity==='Warm up')icons.push('warming_icon');
        icons.forEach((icon,index)=>{
          const x=L.icons.x,y=L.icons.y+index*L.icons.gap;
          const image=this.image(icon,x,y);
          if(image)p.icons.add(image.setDepth(0));
          else {
            const g=this.add.graphics().setPosition(x,y);THEME.fallbacks.statusIcon(g);
            const glyph=this.add.text(x,y,t('labels.statusGlyphs.'+icon),{fontFamily:THEME.fonts.canvas,fontSize:`${L.text.glyph}px`,color:THEME.palette.ink}).setOrigin(.5);
            p.icons.add([g,glyph]);
          }
        });
        if(s.day!==0) {
          let grid='rest';
          if(v.activity==='Forage')grid='food';
          else if(v.activity==='Gather wood')grid='wood';
          else if(v.activity==='Warm up'&&s.fireLit)grid='fire';
          const slot=slots.get(v.id),{x,y}=slotPosition(grid,slot);
          this.tweens.killTweensOf(p.container);
          const A=L.animation;
          if(v.reaction==='Learned fire')this.tweens.chain({targets:p.container,tweens:[
            {...slotPosition('fire',slot),duration:A.learnMs,ease:A.ease},
            {x,y,duration:A.walkMs,delay:A.learnWaitMs,ease:A.ease}]});
          else if(Math.hypot(p.container.x-x,p.container.y-y)>A.minTravel)this.tweens.add({targets:p.container,x,y,duration:A.walkMs,ease:A.ease});
        }
        this.refreshPersonImage(p,v,time);
      }
    }
  };
}
