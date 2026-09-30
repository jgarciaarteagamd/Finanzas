const { chromium } = require(require.resolve('playwright', { paths: [process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || process.cwd()] }));
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
(async()=>{
 for(const width of [1280,390]){
 const browser=await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu','--use-gl=angle','--use-angle=swiftshader']} : {})});
 const page=await browser.newPage({viewport:{width,height:900}}); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const seed={config:{mesInicio:'2026-09',cuentas:[{id:'a',nombre:'Origen',titular:'Juan'},{id:'b',nombre:'Destino',titular:'Hijo'}],tarjetas:[],creditos:[],objetivos:[]},movimientos:[],meses:{}};
 await page.route('https://**/*',async r=>{const u=r.request().url(); if(u.includes('react-dom'))return r.fulfill({body:fs.readFileSync('node_modules/react-dom/umd/react-dom.production.min.js','utf8'),contentType:'application/javascript'}); if(u.includes('react.production'))return r.fulfill({body:fs.readFileSync('node_modules/react/umd/react.production.min.js','utf8'),contentType:'application/javascript'});return r.abort();});
 const html='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.__SEED__='+JSON.stringify(seed)+'</script><script>'+fs.readFileSync('test/mockdb.js','utf8')+'</script>'+fs.readFileSync('dist/finanzas.html','utf8');
 await page.route('http://test.local/**',r=>r.fulfill({body:html,contentType:'text/html; charset=utf-8'}));
 await page.goto('http://test.local/#cuentas');
 await page.getByRole('button',{name:'Nuevo traspaso',exact:true}).click();
 await page.locator('#f-nombre').fill('Ahorro niño');await page.locator('#f-cuentaOrigenId').selectOption('a');await page.locator('#f-cuentaDestinoId').selectOption('a');await page.locator('#f-importe').fill('15'); await page.locator('#f-area').selectOption('familia'); await page.locator('#f-sub').fill('Ahorros');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Elige dos cuentas distintas.').waitFor();
 await page.locator('#f-cuentaDestinoId').selectOption('b');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByText('Ahorro niño',{exact:true}).waitFor();await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>window.__store.get('app/movimientos').items[0].importe),15);
 await page.getByRole('button',{name:'Confirmar',exact:true}).click();await page.getByText('Realizado',{exact:true}).waitFor();await page.waitForTimeout(900);
 assert.equal(await page.evaluate(()=>[...window.__store.entries()].filter(([k])=>k.startsWith('meses/'))[0][1].reales[window.__store.get('app/movimientos').items[0].id]),15);
 seed.movimientos=await page.evaluate(()=>window.__store.get('app/movimientos').items);
 const etiquetasHtml='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.__SEED__='+JSON.stringify(seed)+'</script><script>'+fs.readFileSync('test/mockdb.js','utf8')+'</script>'+fs.readFileSync('dist/finanzas.html','utf8');
 await page.unroute('http://test.local/**');await page.route('http://test.local/**',r=>r.fulfill({body:etiquetasHtml,contentType:'text/html; charset=utf-8'}));
 await page.evaluate(()=>{location.hash='etiquetas'});await page.reload();
 await page.getByRole('button',{name:'Nueva categoría',exact:true}).click();await page.locator('#f-nombre').fill('Pruebas');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.getByRole('button',{name:'Editar categoría Pruebas'}).waitFor();
 await page.getByRole('button',{name:'Editar categoría Pruebas',exact:true}).click();await page.getByRole('button',{name:'Eliminar',exact:true}).click();await page.getByRole('button',{name:'Sí, eliminar',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Editar categoría Pruebas',exact:true}).count(),0);
 await page.getByRole('button',{name:'Editar categoría Familia',exact:true}).click();await page.locator('#f-nombre').fill('Mi familia');await page.getByRole('button',{name:'Guardar',exact:true}).click();
 await page.getByRole('button',{name:'Editar subcategoría Ahorros de Mi familia'}).click();await page.locator('#f-nombre').fill('Ahorro infantil');await page.getByRole('button',{name:'Guardar',exact:true}).click();await page.waitForTimeout(800);
 // Reseed from the mocked persisted store to verify renamed data after reload.
 const persisted=await page.evaluate(()=>({config:window.__store.get('app/config'),movimientos:window.__store.get('app/movimientos').items,meses:Object.fromEntries([...window.__store.entries()].filter(([k])=>k.startsWith('meses/')).map(([k,v])=>[k.slice(6),v]))}));
 assert.equal(persisted.movimientos[0].sub,'Ahorro infantil');
 const updated='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.__SEED__='+JSON.stringify(persisted)+'</script><script>'+fs.readFileSync('test/mockdb.js','utf8')+'</script>'+fs.readFileSync('dist/finanzas.html','utf8');
 await page.unroute('http://test.local/**');await page.route('http://test.local/**',r=>r.fulfill({body:updated,contentType:'text/html; charset=utf-8'}));
 await page.evaluate(()=>{location.hash='resumen'});await page.reload();await page.getByText('Mi familia / Ahorro infantil',{exact:true}).waitFor();
 assert.equal(await page.locator('path[stroke-dasharray]').count(),1);
 await page.screenshot({path:'/tmp/finanzas-flujo-'+width+'.png'});
 for(const section of ['gastos','mes','historial','importar']){await page.evaluate((s)=>{location.hash=s},section);await page.reload();await page.waitForTimeout(100);}
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 console.log('PASS UI '+width+': creación, confirmación, etiquetas, renombrado, guardado y gráfico');await browser.close();
 }
})().catch(e=>{console.error(e);process.exit(1)});
