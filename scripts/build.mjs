// Dependency-free single-file bundler for this deliberately tiny project.
// Sources remain ES modules. The double-click build has classic inline scripts,
// so browsers do not need file:// module requests (which CORS would prohibit).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');
const escapeScript = text => text.replace(/<\/script/gi, '<\\/script');
const files = ['src/config.js','src/sim.js','src/village-view.js','src/main.js'];
let code = '';
for (const file of files) {
  const source = (await read(file)).replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
  code += `\n// ---- ${file} ----\n${source}\n`;
}
let html = await read('index.html');
const css = await read('style.css');
const license = await read('vendor/PHASER-LICENSE.txt');
const phaser = (await read('vendor/phaser.min.js')).replace(/\/\/# sourceMappingURL=.*$/gm, '');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script src="vendor/phaser.min.js"></script>', () => `<!-- Phaser 3.90.0: ${license}\n-->\n<script>\n${escapeScript(phaser)}\n</script>`);
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script>\n(() => {\n${escapeScript(code)}\n})();\n</script>`);
await mkdir(path.join(root, 'dist'), { recursive: true });
await writeFile(path.join(root, 'dist/index.html'), html);
console.log(`Built dist/index.html (${Buffer.byteLength(html).toLocaleString()} bytes). No network or server needed.`);
