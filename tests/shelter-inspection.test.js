import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {drawHealerHome} from '../src/settlement-view.js';

// Exercise both delivery paths: module sources and the file opened directly
// from dist. The unfinished branch previously had its own floating label.
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const bundledSection=html.split('// ---- src/settlement-view.js ----')[1]?.split('// ---- src/clearing.js ----')[0];
assert.ok(bundledSection,'built game contains the shelter renderer');
const bundledDraw=new vm.Script(bundledSection+'\ndrawHealerHome;').runInNewContext();
for(const [delivery,draw] of [['source',drawHealerHome],['local build',bundledDraw]]){
  test(delivery+': no construction stage or occupancy adds a label to the shelter artwork',()=>{
    for(let work=0;work<=6;work++)for(const occupied of [false,true])for(const legacy of [false,true]){
      let operations=0;
      const context=new Proxy({}, {get:(_,key)=>{
        if(key==='fillText'||key==='strokeText')return text=>assert.fail('Floating label at '+work+'/6: '+text);
        return ()=>{operations++;};
      }});
      const project={work,rackWork:2,markerWork:2,legacy},before=structuredClone(project);
      draw(context,120,180,2,occupied,project);
      assert.deepEqual(project,before);
      if(work>0)assert.ok(operations>0,'the physical shelter is still drawn');
    }
  });
}
