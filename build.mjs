import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.dirname(new URL(import.meta.url).pathname);
const r = await esbuild.build({
  entryPoints: [path.join(root, 'src/entry.artifact.jsx')], bundle: true, minify: true, format: 'iife', write: false,
  target: ['es2019'], jsx: 'transform', legalComments: 'none',
  alias: { react: path.join(root, 'src/shims/react.js'), 'react-dom/client': path.join(root, 'src/shims/react-dom-client.js') },
  logLevel: 'warning',
});
let js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync(path.join(root, 'src/template.html'), 'utf8');
const html = tpl.replace('/*__APP__*/', () => js);
fs.writeFileSync(path.join(root, 'dist/finanzas.html'), html);
console.log('ok', (html.length / 1024).toFixed(1) + ' KB', 'js', (js.length / 1024).toFixed(1) + ' KB');
