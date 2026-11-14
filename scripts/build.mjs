// No build dependencies. Inline modules, CSS (in theme.js), Phaser and optional
// local art. Missing optional art becomes null, NOT a broken file:// request.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escapeScript=text=>text.replace(/<\/script/gi,'<\\/script');

export async function inlineAssets(manifest,root=projectRoot){
  const sprites={},inlined=[],missing=[];
  const assetsRoot=path.resolve(root,'assets');
  for(const [key,url] of Object.entries(manifest)){
    if(!url){sprites[key]=null;continue;}
    if(/^data:image\/(svg\+xml|png|jpeg|webp|gif)[;,]/i.test(url)){sprites[key]=url;inlined.push(key);continue;}
    try{
      const requested=path.resolve(root,url);
      if(!requested.startsWith(assetsRoot+path.sep))throw new Error('Asset must be under assets/');
      const actual=await realpath(requested);
      const relative=path.relative(await realpath(assetsRoot),actual);
      if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative))throw new Error('Asset symlink leaves assets/');
      const data=await readFile(actual),extension=path.extname(actual).toLowerCase();
      const mime={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'}[extension];
      if(!mime)throw new Error('Unsupported image format');
      if(extension==='.svg'){
        const svg=data.toString('utf8');
        if(!/<svg\b/i.test(svg)||/<(?:script|foreignObject|image)\b/i.test(svg)||/\son\w+\s*=/i.test(svg)||/@(?:import|font-face)/i.test(svg)
          ||/(?:href)\s*=\s*["'](?!#)/i.test(svg)||/url\(\s*["']?(?!#)[^)]/i.test(svg))throw new Error('SVG must be self-contained: no scripts, raster images, fonts or external links');
      }
      sprites[key]=`data:${mime};base64,${data.toString('base64')}`;inlined.push(key);
    }catch(error){sprites[key]=null;missing.push({key,path:url,reason:error.code==='ENOENT'?'missing optional file':error.message});}
  }
  return {sprites,inlined,missing};
}

export async function build({root=projectRoot,output=path.join(root,'dist/index.html')}={}){
  const read=name=>readFile(path.join(root,name),'utf8');
  const {THEME,spriteManifest}=await import(pathToFileURL(path.join(root,'src/theme.js')).href+`?build=${Date.now()}`);
  const art=await inlineAssets(spriteManifest(THEME),root);
  const files=['src/commands.js','src/theme.js','src/config.js','src/provisions.js','src/needs.js','src/fishing.js','src/healer-home.js','src/magic.js','src/farming.js','src/village-events.js','src/ecology.js','src/practices.js','src/neighbors.js','src/sim.js','src/save.js','src/village-view.js','src/fishing-view.js','src/farming-view.js','src/magic-view.js','src/weather-view.js','src/village-speech.js','src/phone-ui.js','src/settlement-layout.js','src/settlement-view.js','src/clearing.js','src/notebook.js','src/main.js'];
  let code='';
  for(const file of files){
    const source=(await read(file)).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export /gm,'');
    code+=`\n// ---- ${file} ----\n${source}\n`;
    if(file==='src/theme.js')code+=`\n// Build-time optional art: missing paths are deliberately not requested.\nTHEME.sprites=${JSON.stringify(art.sprites)};\n`;
  }
  let html=await read('index.html');
  const phaser=(await read('vendor/phaser.min.js')).replace(/\/\/# sourceMappingURL=.*$/gm,'');
  const license=(await read('vendor/PHASER-LICENSE.txt')).replace(/\r\n/g,'\n');
  html=html.replace('<script src="vendor/phaser.min.js"></script>',()=>`<!-- Phaser 3.90.0: ${license}\n-->\n<script>\n${escapeScript(phaser)}\n</script>`);
  html=html.replace('<script type="module" src="src/main.js"></script>',()=>`<script>\n(() => {\n${escapeScript(code)}\n})();\n</script>`);
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,html);
  const report={theme:THEME.id,inlined:art.inlined,missing:art.missing};
  await mkdir(path.join(root,'reports'),{recursive:true});
  await writeFile(path.join(root,'reports/build-assets.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Built ${path.relative(root,output)} (${Buffer.byteLength(html).toLocaleString()} bytes); ${art.inlined.length} images inlined, ${art.missing.length} optional fallbacks.`);
  return {output,...report};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
