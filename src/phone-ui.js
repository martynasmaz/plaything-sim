// Presentation only. Both interfaces submit to the same command handler.
export const phoneLayoutQuery='(pointer: coarse) and (max-width: 900px), (pointer: coarse) and (max-width: 1100px) and (max-height: 550px)';
export function phoneLayoutEnabled(browser=globalThis.window){return !!browser?.matchMedia?.(phoneLayoutQuery).matches;}
export function phoneTimeCheck(s,words,{busy=false,hasUndo=false}={}){
  const match=/^(skip|back) (\d+)$/.exec(words);
  if(!match&&words!=='undo skip')return null;
  if(busy)return {ok:false,message:'Finishing the current time change.'};
  if(words==='undo skip')return {ok:hasUndo,message:'There is no earlier skip to undo.'};
  const count=Number(match[2]);
  if(!Number.isSafeInteger(count)||count<1)return {ok:false,message:'Choose a positive number of days.'};
  if(match[1]==='back')return {ok:s.day>=count,message:'Day 0 is the beginning of this world.'};
  return {ok:!s.ended&&Number.isSafeInteger(s.day+count),message:'Rewind to a living village first.'};
}
export const phonePowers=[
  {group:'Care',name:'Food',command:'harvest',description:'Give the camp a gift of provisions.'},
  {group:'Care',name:'Heal',command:'heal',description:'Cure everyone currently sick.'},
  {group:'Care',name:'Bless',command:'bless',description:'Raise health and happiness throughout the village.'},
  {group:'Nature',name:'Rain',command:'rain',description:'Bring rain to the valley.'},
  {group:'Knowledge',name:'Teach fire',command:'teach fire',description:'Teach fire making when the camp has enough wood.'},
  {group:'Knowledge',name:'Teach farming',command:'teach farming',description:'Teach the village to sow crops.'},
  {group:'People',name:'Call settlers',command:'spawn people 5',description:'Bring five adult settlers to the village.'},
  {group:'People',name:'Recall settlers',command:'recall settlers',description:'Bring the eastern household home with its supplies.'},
  ...[
    ['Dry spell','drought','Start a dry spell, reducing foraging yields.'],
    ['Flood','flood','Raise the river. Stored food on the low bank can wash away.'],
    ['Plague','plague','Spread sickness through the village.'],
    ['Earthquake','earthquake','Shake the camp, losing wood and lowering morale.'],
    ['Falling star','meteor','Strike the valley. Nearby shelters can catch fire.'],
    ['Volcano','volcano','Bury planted plots and spoil stored food.'],
    ['Split ground','earth crack','Damage bridge work and lose wood at the ford.'],
    ['Summon kaiju','godzilla','Summon a monster into the valley.']
  ].map(([name,command,description])=>({group:'Trouble',name,command,description,danger:true}))
];

// A little finger movement is still a tap. A second finger makes the whole
// gesture a pan/pinch, so releasing it cannot accidentally inspect something.
export function createPhoneGesture(){
  const touches=new Map();
  return {
    start(id,x,y){
      const multiple=touches.size>0;
      if(multiple)for(const t of touches.values())t.moved=true;
      touches.set(id,{x,y,moved:multiple});
    },
    move(id,x,y){const t=touches.get(id);if(!t)return true;t.moved||=Math.hypot(x-t.x,y-t.y)>8;return t.moved;},
    end(id){const t=touches.get(id);touches.delete(id);return !!t&&!t.moved;},
    cancel(id){touches.delete(id);}
  };
}

export function createPhoneControls({readState,runCommand,checkCommand,changeSpeed,openNotebook,closeNotebook,
  notebookOpen,recenter,otherMenuOpen=()=>false,enabled=true,browser=window,doc=document,storage=null}){
  const root=doc.documentElement,media=browser.matchMedia(phoneLayoutQuery);
  const make=(tag,text,className)=>{
    const node=doc.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;
  };
  const button=(text,action)=>{const b=make('button',text);b.type='button';b.onclick=action;return b;};
  const toolbar=make('nav',null,'phone-toolbar');toolbar.setAttribute('aria-label','Village controls');toolbar.hidden=true;
  const powers=button('Powers',()=>open('powers')),observe=button('Observe',()=>{close();openNotebook();refresh();});
  const time=button('Time',()=>open('time')),speak=button('Speak',()=>open('speak'));
  for(const b of [powers,observe,time,speak])b.setAttribute('aria-haspopup','dialog');
  toolbar.append(powers,observe,time,speak);
  const repeat=button('',()=>{
    if(!active||casting||!lastPower||view||notebookOpen()||otherMenuOpen())return;
    castPower(lastPower);
  });repeat.className='phone-repeat';repeat.hidden=true;
  const home=button('⌂',()=>{recenter();});home.className='phone-home';home.setAttribute('aria-label','Return to village');home.hidden=true;
  const pause=button('Pause',()=>{
    const s=readState();if(s.ended)return;
    if(s.speed){resumeSpeed=s.speed;changeSpeed(0);}else changeSpeed(resumeSpeed);
    refresh();
  });pause.className='phone-pause';pause.hidden=true;
  const toast=make('p',null,'phone-feedback');toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;
  const tray=make('dialog',null,'phone-tray');tray.setAttribute('aria-labelledby','phone-tray-title');
  const header=make('header'),heading=make('h2');heading.id='phone-tray-title';
  const dismiss=button('Close',()=>close());dismiss.setAttribute('aria-label','Close phone menu');header.append(heading,dismiss);
  const body=make('div',null,'phone-tray-body'),reading=make('p',null,'phone-reading');tray.append(header,body,reading);
  doc.body.append(toolbar,repeat,home,pause,toast,tray);
  let active=false,view=null,chosen=null,confirming=false,castButton=null,reason=null,draft='',resumeSpeed=readState().speed||1,noticeTimer;
  let lastPower=null,casting=false;
  let pauseMenus=true;
  try{pauseMenus=storage?.getItem('plaything.phone.pauseMenus')!=='false';}catch{}
  const persistPause=()=>{try{storage?.setItem('plaything.phone.pauseMenus',String(pauseMenus));}catch{}};
  function castPower(power){
    if(casting)return;
    const check=checkCommand(power.command);
    if(!check.ok){if(reason)reason.textContent=check.message;refresh();return;}
    close();
    casting=true;refresh();
    const finish=ok=>{if(ok)lastPower=power;casting=false;refresh();};
    let result;
    try{result=runCommand(power.command);}catch(error){finish(false);throw error;}
    if(result&&typeof result.then==='function')result.then(finish,()=>finish(false));
    else finish(result);
  }
  function close(){if(tray.open)tray.close();view=null;chosen=null;castButton=reason=null;refresh();}
  tray.addEventListener('close',()=>{if(tray.open)return;view=null;chosen=null;castButton=reason=null;refresh();});
  tray.addEventListener('click',event=>{if(event.target===tray){const r=tray.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();
  }});
  function open(next){
    if(!active)return;
    closeNotebook();view=next;chosen=null;confirming=false;draw();
    if(!tray.open)tray.showModal();
    if(next==='speak')body.querySelector('input').focus();
    refresh();
  }
  function draw(){
    body.replaceChildren();castButton=reason=null;
    heading.textContent=view==='powers'?'Powers':view==='time'?'Time and camera':'Speak to the homestead';
    for(const b of [powers,time,speak])b.setAttribute('aria-expanded',String(view===({Powers:'powers',Time:'time',Speak:'speak'}[b.textContent])));
    if(view==='powers'){
      if(chosen){
        body.append(button('‹ All powers',()=>{chosen=null;confirming=false;draw();refresh();}),make('h3',chosen.name),make('p',chosen.description));
        if(confirming)body.append(make('p','This will bring '+chosen.name.toLowerCase()+' to this village.','phone-warning'));
        reason=make('p',null,'phone-reason');reason.setAttribute('role','status');
        castButton=button(chosen.danger&&!confirming?'Continue':confirming?'Cast '+chosen.name:'Cast',()=>{
          if(!checkCommand(chosen.command).ok){refresh();return;}
          if(chosen.danger&&!confirming){confirming=true;draw();refresh();return;}
          castPower(chosen);
        });
        castButton.className=confirming?'phone-cast phone-warning':'phone-cast';body.append(reason,castButton);
      }else{
        body.append(make('p','Choose a power to read its effect before casting.'));
        for(const group of [...new Set(phonePowers.map(p=>p.group))]){
          const items=phonePowers.filter(p=>p.group===group&&(p.command!=='plague'||readState().config.enablePlague));
          if(!items.length)continue;
          const grid=make('div',null,'phone-power-grid');body.append(make('h3',group),grid);
          for(const power of items)grid.append(button(power.name,()=>{chosen=power;confirming=false;draw();refresh();}));
        }
      }
    }else if(view==='time'){
      const rates=make('div',null,'phone-rates');
      for(const [label,rate] of [['Pause',0],['1×',1],['3×',3]]){
        const b=button(label,()=>{if(rate)resumeSpeed=rate;changeSpeed(rate);refresh();});b.dataset.phoneRate=String(rate);rates.append(b);
      }
      const steps=make('div',null,'phone-power-grid');
      for(const [label,command] of [['Next day','skip 1'],['Skip 5 days','skip 5'],['Back one day','back 1'],['Back 5 days','back 5'],['Undo last skip','undo skip']])
        steps.append(button(label,()=>castPower({name:label,command,time:true})));
      reason=make('p',null,'phone-reason');reason.setAttribute('role','status');
      body.append(rates,make('h3','Move through time'),steps,reason,button('Return to village',()=>{recenter();close();}));
      const setting=make('label',null,'phone-pause-setting'),checkbox=make('input');checkbox.type='checkbox';checkbox.checked=pauseMenus;
      checkbox.onchange=()=>{pauseMenus=checkbox.checked;persistPause();refresh();};setting.append(checkbox,make('span','Pause while menus are open'));body.append(setting);
    }else if(view==='speak'){
      body.append(make('p','Type any command. Other controls work without the keyboard.'));
      const form=make('form'),label=make('label','Your words'),input=make('input'),send=make('button','Speak');
      input.id='phone-spoken';label.htmlFor=input.id;input.type='text';input.value=draft;input.maxLength=100;
      input.autocomplete='off';input.spellcheck=false;input.setAttribute('autocapitalize','off');input.setAttribute('enterkeyhint','send');
      input.oninput=()=>{draft=input.value;};send.type='submit';form.append(label,input,send);
      form.onsubmit=event=>{event.preventDefault();const words=input.value.trim();if(!words)return;
        draft=words;input.blur();close();if(runCommand(words))draft='';};body.append(form);
    }
  }
  function refresh(){
    if(!active)return;
    const s=readState();if(s.speed)resumeSpeed=s.speed;
    pause.textContent=s.speed?'Pause':'Play';pause.disabled=s.ended;pause.setAttribute('aria-label',s.speed?'Pause time':'Resume time');
    pause.setAttribute('aria-pressed',String(!s.speed));time.textContent='Time';time.setAttribute('aria-label','Time controls, '+(s.speed?s.speed+' times speed':'paused'));
    repeat.hidden=!lastPower||!!view||notebookOpen()||otherMenuOpen();
    root.style.setProperty('--phone-repeat-space',repeat.hidden?'0px':'56px');
    if(lastPower){
      const check=checkCommand(lastPower.command);
      repeat.textContent=(lastPower.time?'↻ ':'↻ Cast ')+lastPower.name;repeat.disabled=casting||!check.ok;
      repeat.setAttribute('aria-busy',String(casting));
      repeat.title=check.ok?'Repeat '+lastPower.name:check.message;
      repeat.setAttribute('aria-label','Repeat '+lastPower.name+(check.ok?'':': '+check.message));
    }
    reading.textContent=!s.speed?'Time is paused.':pauseMenus?'Time pauses while this menu is open.':'The village keeps running while menus are open.';
    for(const b of body.querySelectorAll('[data-phone-rate]')){b.setAttribute('aria-pressed',String(Number(b.dataset.phoneRate)===s.speed));b.disabled=s.ended;}
    if(chosen&&castButton){const check=checkCommand(chosen.command);castButton.disabled=!check.ok;reason.textContent=check.ok?'':check.message;}
    if(!view)for(const b of [powers,time,speak])b.setAttribute('aria-expanded','false');
  }
  function viewport(){
    if(!active)return;
    root.style.setProperty('--phone-height',(browser.visualViewport?.height||browser.innerHeight)+'px');
    root.style.setProperty('--phone-top',(browser.visualViewport?.offsetTop||0)+'px');
  }
  function update(){
    const wasActive=active;active=enabled&&media.matches;root.classList.toggle('phone-ui',active);
    toolbar.hidden=home.hidden=pause.hidden=!active;
    if(!active){close();repeat.hidden=true;toast.hidden=true;root.style.removeProperty('--phone-height');root.style.removeProperty('--phone-top');root.style.removeProperty('--phone-repeat-space');if(wasActive)closeNotebook();}
    else{viewport();refresh();}
  }
  media.addEventListener('change',update);browser.visualViewport?.addEventListener('resize',viewport);browser.visualViewport?.addEventListener('scroll',viewport);
  browser.addEventListener('resize',viewport);update();
  return {
    get active(){return active;},open,close,refresh,
    holdClock(){return active&&pauseMenus&&(!!view||notebookOpen()||otherMenuOpen());},
    notify(text,error=false){if(!active)return;clearTimeout(noticeTimer);toast.textContent=text;toast.classList.toggle('error',error);toast.hidden=false;
      noticeTimer=setTimeout(()=>{toast.hidden=true;},6500);}
  };
}
