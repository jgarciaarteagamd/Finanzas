import asyncio, pathlib, json, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/finanzas'); SCR = pathlib.Path(sys.argv[1]); SCR.mkdir(parents=True, exist_ok=True)
NM = ROOT / 'node_modules'
LIBS = {'react-dom': NM/'react-dom/umd/react-dom.production.min.js', 'react.production': NM/'react/umd/react.production.min.js',
        'pdf.worker.min.js': NM/'pdfjs-dist/build/pdf.worker.min.js', 'pdf.min.js': NM/'pdfjs-dist/build/pdf.min.js', 'xlsx.full.min.js': NM/'xlsx/dist/xlsx.full.min.js'}
html = (ROOT/'dist/finanzas.html').read_text(); seed = (ROOT/'test/seed.json').read_text()
mock = (ROOT/'test/mockdb.js').read_text() + '\n' + (ROOT/'test/mocksample.js').read_text()
page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + \
  f'<script>window.__SEED__={seed};</script><script>{mock}</script>' + html + '</body></html>'
(ROOT/'test/p2.html').write_text(page)
async def route(r):
    u = r.request.url
    for k, f in LIBS.items():
        if u.endswith(k) or (k in u and 'react' in k):
            await r.fulfill(body=f.read_text(), content_type='application/javascript'); return
    await r.abort()
async def shot(pg, name):
    await pg.evaluate("(()=>{const s=document.querySelector('.shell'); const m=document.querySelector('.main'); s.dataset.h=s.style.height; s.style.height='auto'; m.style.overflow='visible';})()")
    await pg.screenshot(path=str(SCR/name), full_page=True)
    await pg.evaluate("(()=>{const s=document.querySelector('.shell'); const m=document.querySelector('.main'); s.style.height=s.dataset.h||''; m.style.overflow='';})()")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        for vpn, vp in [('desk', {'width': 1440, 'height': 1000}), ('mob', {'width': 390, 'height': 844})]:
            ctx = await b.new_context(viewport=vp); pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
            pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
            await pg.route('https://**/*', route)
            await pg.goto('file://' + str(ROOT/'test/p2.html')); await pg.wait_for_timeout(700)
            await pg.evaluate("location.hash='importar'"); await pg.reload(); await pg.wait_for_timeout(700)
            await pg.screenshot(path=str(SCR/f'{vpn}-imp-inicio.png'), full_page=True)
            # 1. PDF de cuenta
            await pg.set_input_files('.dropzone input[type=file]', str(ROOT/'test/fixtures/santander-septiembre.pdf'))
            await pg.wait_for_selector('.applybar', timeout=15000)
            prompt = await pg.evaluate('window.__prompts[0]')
            print(vpn, 'prompt bytes', len(prompt.encode()), 'contiene PDF:', 'LIQUIDACION TARJETA MASTERCARD' in prompt, '| 812,40' in prompt or '812,40' in prompt)
            if vpn == 'desk':
                i = prompt.index('EXTRACTO:'); print(prompt[i:i+700])
            props = await pg.eval_on_selector_all('.prop', 'els => els.map(e => (e.classList.contains("on")?"[x] ":"[ ] ") + e.innerText.replace(/\\n/g," | "))')
            print('\n'.join(props))
            await shot(pg, f'{vpn}-imp-revisar.png')
            # cambiar Mercadona a 'Supermercado' (gas-26, normalmente tarjeta)
            sel = pg.locator('.mov:has-text("Mercadona") select[aria-label="Cuenta como"]')
            await sel.select_option('c:gas-26'); await pg.wait_for_timeout(200)
            props2 = await pg.eval_on_selector_all('.prop .pt', 'els => els.map(e => e.innerText)')
            print('tras cambiar Mercadona, supermercado en propuestas:', [x for x in props2 if 'Supermercado' in x])
            await pg.click('button:has-text("Aplicar y guardar")'); await pg.wait_for_timeout(1500)
            print(await pg.inner_text('.donelist'))
            await pg.screenshot(path=str(SCR/f'{vpn}-imp-hecho.png'), full_page=True)
            ext = await pg.evaluate("JSON.stringify(Object.fromEntries([...window.__store.keys()].filter(k=>k.startsWith('extractos/')).map(k=>[k, window.__store.get(k).items.length])))")
            print('extractos', ext)
            print('mes', await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09'))"))
            cre = await pg.evaluate("JSON.stringify(window.__store.get('app/config').creditos.map(c=>[c.nombre,c.cuota]))"); print('creditos', cre)
            # 2. CSV de tarjeta
            await pg.click('button:has-text("Subir otro")'); await pg.wait_for_timeout(300)
            await pg.set_input_files('.dropzone input[type=file]', str(ROOT/'test/fixtures/mastercard-septiembre.csv'))
            await pg.wait_for_selector('.applybar', timeout=15000)
            print('csv prompt tiene NETFLIX', 'NETFLIX' in await pg.evaluate('window.__prompts[window.__prompts.length-1]'))
            print('origen detectado:', await pg.eval_on_selector('.card select.in-ctl', 'e => e.value'))
            await pg.screenshot(path=str(SCR/f'{vpn}-imp-tarjeta-sinorigen.png'), full_page=False)
            await pg.select_option('.card select.in-ctl >> nth=0', 'tarjeta:tar-mastercard-santander'); await pg.wait_for_timeout(300)
            props = await pg.eval_on_selector_all('.prop', 'els => els.map(e => (e.classList.contains("on")?"[x] ":"[ ] ") + e.innerText.replace(/\\n/g," | "))')
            print('\n'.join(props))
            print('cuadre:', await pg.locator('text=Cuadra con el total').count())
            await shot(pg, f'{vpn}-imp-tarjeta.png')
            await pg.click('button:has-text("Aplicar y guardar")'); await pg.wait_for_timeout(1500)
            print('mes tras tarjeta', await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09').reales)"))
            # páginas
            LAB = {'mes': ('Mes a mes', 'Mes'), 'cuentas': ('Cuentas y tarjetas', 'Cuentas'), 'gastos': ('Gastos', 'Gastos'), 'resumen': ('Resumen', 'Resumen'), 'importar': ('Importar extractos', None)}
            async def nav(name):
                d, m = LAB[name]
                if vpn == 'desk': await pg.click(f'.nav button:has-text("{d}")')
                elif m: await pg.click(f'.tabbar button:has-text("{m}")')
                else: await pg.click('.tabbar button:has-text("Más")'); await pg.click(f'.more-sheet button:has-text("{d}")')
                await pg.wait_for_timeout(600)
            for pgname in ['mes', 'cuentas', 'gastos', 'resumen']:
                await nav(pgname)
                if pgname == 'cuentas':
                    await pg.click('.seg button:has-text("Tarjetas")'); await pg.wait_for_timeout(300)
                await shot(pg, f'{vpn}-tras-{pgname}.png')
                over = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                if over: print('OVERFLOW', pgname)
            # 3. quitar un extracto
            await nav('importar')
            await pg.screenshot(path=str(SCR/f'{vpn}-imp-lista.png'), full_page=True)
            await pg.click('.improw:has-text("MasterCard") .icon-btn'); await pg.click('.improw button:has-text("Quitar")'); await pg.wait_for_timeout(1300)
            print('tras quitar tarjeta', await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09').reales)"), await pg.evaluate("[...window.__store.keys()].filter(k=>k.startsWith('extractos/'))"))
            # 4. error de IA
            await pg.evaluate("window.__SAMPLE_FAIL__='rate_limited'")
            await pg.set_input_files('.dropzone input[type=file]', str(ROOT/'test/fixtures/mastercard-septiembre.csv')); await pg.wait_for_timeout(1500)
            print('error visible:', await pg.inner_text('.formerr'))
            await ctx.close()
        await b.close()
        print('ERRORS', len(errs)); [print(' ', e[:300]) for e in errs[:20]]
asyncio.run(main())
