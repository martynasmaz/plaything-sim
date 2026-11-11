// A tiny, read-only local server. No downloads, packages or internet needed.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.svg':'image/svg+xml; charset=utf-8','.png':'image/png','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const parts=pathname.split('/').filter(Boolean);
    // Do not expose git internals, dotfiles or anything outside this project.
    if(parts.some(p=>p.startsWith('.')||p.includes('\\')||p.includes('\0'))) throw new Error('Invalid path');
    const filename=path.join(root,...parts,pathname.endsWith('/')?'index.html':'');
    const data=await readFile(filename);
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Plaything Sim is ready: http://127.0.0.1:${port}\nKeep this window open. Press Ctrl+C to stop.`));
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
