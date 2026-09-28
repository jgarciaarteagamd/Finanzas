// Compila la versión web (fuera de Claude): Firebase + Gemini + login con Google.
// Uso: node build.web.mjs
// Variables de entorno que necesita (ver README.md y la guía):
//   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_APP_ID,
//   FIREBASE_STORAGE_BUCKET (opcional), FIREBASE_MESSAGING_SENDER_ID (opcional),
//   GEMINI_API_KEY, ALLOWED_EMAILS (correos separados por coma)
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.dirname(new URL(import.meta.url).pathname);
const FALTAN = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID', 'GEMINI_API_KEY', 'ALLOWED_EMAILS']
  .filter((k) => !process.env[k]);
if (FALTAN.length) {
  console.warn(`Aviso: faltan variables de entorno (${FALTAN.join(', ')}). La compilación sigue, pero esa función no funcionará hasta que las definas. Mira README.md.`);
}

const define = {};
['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'GEMINI_API_KEY', 'ALLOWED_EMAILS']
  .forEach((k) => { define[`process.env.${k}`] = JSON.stringify(process.env[k] || ''); });

const outdir = path.join(root, 'dist-web');
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });

const r = await esbuild.build({
  entryPoints: [path.join(root, 'src/web/entry.web.jsx')],
  bundle: true, minify: true, format: 'iife', write: false,
  target: ['es2019'], jsx: 'transform', legalComments: 'none', define,
  logLevel: 'warning',
});
fs.writeFileSync(path.join(outdir, 'app.js'), r.outputFiles[0].text);
fs.copyFileSync(path.join(root, 'src/template.web.html'), path.join(outdir, 'index.html'));
console.log('ok', outdir, (r.outputFiles[0].text.length / 1024).toFixed(1) + ' KB');
