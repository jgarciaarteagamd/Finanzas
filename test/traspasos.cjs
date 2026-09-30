const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()] }));
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:900}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const seed={config:{mesInicio:'2026-09',cuentas:[{id:'a',nombre:'Origen',titular:'Juan'},{id:'b',nombre:'Destino',titular:'Hijo'}],tarjetas:[],creditos:[],objetivos:[]},movimientos:[],meses:{}};
 await page.route('https://**/*',async r=>{const u=r.request().url(); if(u.includes('react-dom'))return r.fulfill({body:fs.readFileSync('node_modules/react-dom/umd/react-dom.production.min.js','utf8'),contentType:'application/javascript'}); if(u.includes('react.production'))return r.fulfill({body:fs.readFileSync('node_modules/react/umd/react.production.min.js','utf8'),contentType:'application/javascript'});return r.abort();});
 const html='<script>window.__SEED__='+JSON.stringify(seed)+'</script><script>'+fs.readFileSync('test/mockdb.js','utf8')+'</script>'+fs.readFileSync('dist/finanzas.html','utf8');
 await page.route('http://test.local/**',r=>r.fulfill({body:html,contentType:'text/html'}));
 await page.goto('http://test.local/#cuentas');
 await page.getByRole('button',{name:'Nuevo traspaso',exact:true}).click();
 await page.locator('#f-nombre').fill('Ahorro niño');await page.locator('#f-cuentaOrigenId').selectOption('a');await page.locator('#f-cuentaDestinoId').selectOption('a');await page.locator('#f-importe').fill('15');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Elige dos cuentas distintas.').waitFor();
 await page.locator('#f-cuentaDestinoId').selectOption('b');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Ahorro niño',{exact:true}).waitFor();await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>window.__store.get('app/movimientos').items[0].importe),15);
 await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByText('Realizado',{exact:true}).waitFor();await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>[...window.__store.entries()].filter(([k])=>k.startsWith('meses/'))[0][1].reales[window.__store.get('app/movimientos').items[0].id]),15);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 console.log('PASS UI '+width+': validación, creación, confirmación y guardado');await page.close();
 }await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
