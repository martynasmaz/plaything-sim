// Explicit, disjoint suites. Newly added test files always enter the routine suite.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {build} from './build.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const reference=new Set(['balance.test.js','v02.test.js','docs.test.js']);
const analysis=new Set(['multi-village-experiment.test.js']);
const [suite='gameplay',...options]=process.argv.slice(2);
if(!['gameplay','reference','analysis','all'].includes(suite))throw Error('Choose gameplay, reference, analysis or all.');
const files=readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.js')).sort().filter(f=>
  suite==='all'||(suite==='reference'?reference.has(f):suite==='analysis'?analysis.has(f):!reference.has(f)&&!analysis.has(f)));
if(options.includes('--list')){console.log(`${suite}: ${files.length} files\n${files.join('\n')}`);}
else{
  if(suite==='gameplay'||suite==='all')await build(); // Shelter checks exercise the current bundle as well as source.
  console.log(`Running ${suite}: ${files.length} test files (two concurrent processes).`);
  const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...options,...files.map(f=>'tests/'+f)],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
}
