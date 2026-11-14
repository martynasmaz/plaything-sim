// A small event-capable DOM fixture for the phone controller. No layout engine
// or simulated game rules: commands in the tests use the real simulation.
export function phoneDom(width=390,height=844,coarse=true){
  const doc={activeElement:null,focusedInputs:0};
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.events=new Map();this.className='';this.open=false;this.hidden=false;this.value='';this.disabled=false;
      const properties=new Map();this.style={setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k),getPropertyValue:k=>properties.get(k)||''};
      this.classList={contains:c=>this.className.split(' ').includes(c),toggle:(c,on)=>{const names=new Set(this.className.split(' ').filter(Boolean));on??=!names.has(c);if(on)names.add(c);else names.delete(c);this.className=[...names].join(' ');return on;}};
    }
    set textContent(value){this.text=String(value);this.children=[];}
    get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.text='';this.children=[...nodes];}
    setAttribute(name,value){this.attributes[name]=String(value);}
    getAttribute(name){return this.attributes[name]??null;}
    addEventListener(name,handler){const handlers=this.events.get(name)||[];handlers.push(handler);this.events.set(name,handlers);}
    emit(name,event={}){for(const fn of this.events.get(name)||[])fn({target:this,...event});}
    querySelectorAll(selector){const matches=node=>selector.startsWith('.')?node.classList.contains(selector.slice(1)):
      selector==='[data-phone-rate]'?node.dataset.phoneRate!==undefined:node.tagName.toLowerCase()===selector;
      return this.children.flatMap(c=>[...(matches(c)?[c]:[]),...c.querySelectorAll(selector)]);
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
    focus(){doc.activeElement=this;if(this.tagName==='INPUT'&&this.type==='text')doc.focusedInputs++;}
    blur(){if(doc.activeElement===this)doc.activeElement=null;}
    click(){if(!this.disabled)this.onclick?.({target:this});}
    showModal(){this.open=true;this.querySelector('button')?.focus();}
    close(){this.open=false;queueMicrotask(()=>this.emit('close'));}
    getBoundingClientRect(){return {left:8,right:width-8,top:height/3,bottom:height-8};}
  }
  doc.createElement=tag=>new Element(tag);doc.documentElement=new Element('html');doc.body=new Element('body');
  const media={matches:coarse&&(width<=900||width<=1100&&height<=550),addEventListener(name,fn){this.listener=fn;}};
  const visualViewport={height,offsetTop:0,addEventListener(name,fn){this[name]=fn;}};
  const browser={innerHeight:height,visualViewport,matchMedia:()=>media,addEventListener(){}};
  const findButton=text=>doc.body.querySelectorAll('button').find(b=>b.textContent===text);
  return {doc,browser,media,findButton,resize(w,h,touch=coarse){width=w;height=h;media.matches=touch&&(w<=900||w<=1100&&h<=550);media.listener?.();}};
}
