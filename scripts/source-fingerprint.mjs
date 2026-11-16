import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Retain the existing population-1000-audit convention; list it explicitly in
// new reports. Every JS source, including scenario/families/provisions, counts.
export function sourceFingerprint(root=new URL('../src/',import.meta.url)){
  const files=readdirSync(root).filter(f=>f.endsWith('.js')).sort(),h=createHash('sha256');
  for(const file of files)h.update(file).update(readFileSync(new URL(file,root)));
  return {sha256:h.digest('hex'),files,format:'sha256(sorted bare filename + file bytes, for every src/*.js)'};
}
