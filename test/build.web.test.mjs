// Compila la versión web con Firebase y Gemini simulados, para
// probarla con Playwright sin necesitar un proyecto real.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const outdir = path.join(root, 'test/dist-web-test');
fs.rmSync(outdir, { recursive: true, force: true });
fs.mkdirSync(outdir, { recursive: true });
const define = {};
['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'GEMINI_API_KEY']
  .forEach((k) => { define[`process.env.${k}`] = JSON.stringify('test'); });
define['process.env.ALLOWED_EMAILS'] = JSON.stringify('permitido@gmail.com, otro@gmail.com');
const r = await esbuild.build({
  entryPoints: [path.join(root, 'src/web/entry.web.jsx')],
  bundle: true, minify: false, format: 'iife', write: false,
  target: ['es2019'], jsx: 'transform', logLevel: 'warning', define,
  alias: {
    'firebase/app': path.join(root, 'test/webmocks/firebase-app.mjs'),
    'firebase/firestore': path.join(root, 'test/webmocks/firebase-firestore.mjs'),
    'firebase/auth': path.join(root, 'test/webmocks/firebase-auth.mjs'),
  },
});
fs.writeFileSync(path.join(outdir, 'app.js'), r.outputFiles[0].text);
fs.copyFileSync(path.join(root, 'src/template.web.html'), path.join(outdir, 'index.html'));
console.log('ok', outdir, (r.outputFiles[0].text.length / 1024).toFixed(1) + ' KB');
