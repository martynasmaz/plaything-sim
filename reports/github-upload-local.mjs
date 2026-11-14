// Local transport helper: read the prepared Git commit, never credentials.
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{maxBuffer:30_000_000});
const names=git('diff','--name-only','origin/main','HEAD').toString('utf8').trim().split('\n');
const rows=git('ls-tree','-rl','HEAD').toString('utf8').trim().split('\n').map(line=>{
  const [meta,path]=line.split('\t'),[mode,type,sha,bytes]=meta.trim().split(/\s+/);return {mode,type,sha,bytes:Number(bytes),path};
}).filter(row=>names.includes(row.path));
const [op,path,offsetText]=process.argv.slice(2);
const read=row=>{const data=git('show','HEAD:'+row.path);return {...row,encoding:row.path.endsWith('.png')?'base64':'utf-8',content:data.toString(row.path.endsWith('.png')?'base64':'utf8')};};
if(op==='manifest')process.stdout.write(JSON.stringify(rows));
else if(op==='batch')process.stdout.write(JSON.stringify(rows.filter(r=>r.bytes<90_000&&!r.path.endsWith('.png')).slice(Number(path),Number(path)+15).map(read)));
else if(op==='chunk'){
  const row=rows.find(r=>r.path===path);if(!row)throw Error('Not part of prepared commit');
  const value=read(row);process.stdout.write(JSON.stringify({chunk:value.content.slice(Number(offsetText),Number(offsetText)+200_000),length:value.content.length,encoding:value.encoding}));
}else throw Error('Unknown operation');
