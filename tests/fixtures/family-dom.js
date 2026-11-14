// Event-capable DOM fixture for the family viewer. Canvas may be supplied by
// the visual smoke check; unit tests use a drawing-operation recorder.
export function familyDom(width=1100,height=640,createCanvas){
  const doc={activeElement:null};
  const fakeContext=()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(target,key){return target[key]??(()=>{});},set(target,key,value){target[key]=value;return true;}});
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.style={};this.dataset={};this.attributes={};this.events=new Map();this.className='';this.text='';this.value='';this.open=false;this.hidden=false;this.disabled=false;this.scrollLeft=0;this.scrollTop=0;this.width=144;this.height=144;}
    get clientWidth(){return this.className==='family-atlas-viewport'?width:this.width;}
    get clientHeight(){return this.className==='family-atlas-viewport'?height:this.height;}
    set textContent(value){this.text=String(value);this.children=[];}
    get textContent(){return this.text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
    append(...nodes){for(const node of nodes){if(typeof node!=='string'){if(node.parentNode)node.parentNode.children=node.parentNode.children.filter(n=>n!==node);node.parentNode=this;}this.children.push(node);}if(this.tagName==='SELECT'&&!this.value&&this.children.length)this.value=this.children[0].value;}
    replaceChildren(...nodes){for(const child of this.children)if(typeof child!=='string')child.parentNode=null;this.children=[];this.text='';this.value='';this.append(...nodes);}
    setAttribute(key,value){this.attributes[key]=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    addEventListener(name,fn){const list=this.events.get(name)||[];list.push(fn);this.events.set(name,list);}
    emit(name,event={}){for(const fn of this.events.get(name)||[])fn({target:this,...event});}
    matches(selector){return selector.startsWith('.')?this.className.split(' ').includes(selector.slice(1)):this.tagName.toLowerCase()===selector;}
    querySelectorAll(selector){return this.children.flatMap(c=>typeof c==='string'?[]:[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){for(let p=this;p;p=p.parentNode)if(p.matches(selector))return p;return null;}
    click(){if(!this.disabled)this.onclick?.({target:this});}
    focus(){doc.activeElement=this;}
    showModal(){this.open=true;}
    close(){this.open=false;this.emit('close');}
    setPointerCapture(id){this.capture=id;}
    getContext(){if(!this.context){this.canvas=createCanvas?.(this.width,this.height);this.context=this.canvas?this.canvas.getContext('2d'):fakeContext();}return this.context;}
  }
  doc.createElement=tag=>new Element(tag);doc.createElementNS=(ns,tag)=>new Element(tag);doc.body=new Element('body');
  const OptionClass=class extends Element{constructor(text,value){super('option');this.text=text;this.value=String(value);}};
  return {doc,OptionClass,resize(w,h){width=w;height=h;}};
}
