import asyncio, pathlib, json, sys
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/finanzas'); SCR = pathlib.Path(sys.argv[1])
REACT = (ROOT / 'node_modules/react/umd/react.production.min.js').read_text()
RDOM = (ROOT / 'node_modules/react-dom/umd/react-dom.production.min.js').read_text()
html = (ROOT / 'dist/finanzas.html').read_text(); seed = (ROOT / 'test/seed.json').read_text(); mock = (ROOT / 'test/mockdb.js').read_text()
def page_html(seed_js, nodb=False):
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + \
      f'<script>window.__SEED__={seed_js};window.__NODB__={"true" if nodb else "false"};</script><script>{mock}</script>' + html + '</body></html>'
async def route(r):
    u = r.request.url
    if 'react-dom' in u: await r.fulfill(body=RDOM, content_type='application/javascript')
    elif 'react.production' in u: await r.fulfill(body=REACT, content_type='application/javascript')
    else: await r.abort()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width': 1440, 'height': 1000}); pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('https://**/*', route)
        (ROOT/'test/p1.html').write_text(page_html(seed))
        await pg.goto('file://' + str(ROOT/'test/p1.html')); await pg.wait_for_timeout(600)
        # 1. Mes a mes: confirmar una línea
        await pg.click('.nav button:has-text("Mes a mes")'); await pg.wait_for_timeout(300)
        await pg.click('.line:has-text("Arriendo") .check'); await pg.wait_for_timeout(1200)
        w = await pg.evaluate('window.__writes'); print('1 writes', w)
        st = await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09'))"); print('  mes doc', st)
        print('  savestate', await pg.inner_text('.side .savestate'))
        # 2. editar importe real de Otosur
        await pg.click('.line:has-text("Otosur") .amt'); await pg.fill('.line:has-text("Otosur") .amtinput', '3.900,50'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1200)
        print('2 mes doc', await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09').reales)"))
        print('  kpi entra', await pg.inner_text('.card >> text=Entra >> xpath=..'))
        # 3. gasto puntual
        await pg.click('button:has-text("Gasto puntual")'); await pg.wait_for_timeout(200)
        await pg.fill('#f-nombre', 'Brackets inferiores Martín'); await pg.select_option('#f-area', 'salud'); await pg.fill('#f-sub', 'Ortodoncia'); await pg.fill('#f-importe', '750')
        await pg.click('.drawer-f button:has-text("Guardar")'); await pg.wait_for_timeout(1200)
        movs = await pg.evaluate("window.__store.get('app/movimientos').items.filter(x=>x.nombre.startsWith('Brackets'))"); print('3 nuevo gasto', movs)
        # 4. Cuentas: saldo
        await pg.click('.nav button:has-text("Cuentas y tarjetas")'); await pg.wait_for_timeout(300)
        await pg.click('.card:has-text("Santander de Juan") >> button.amt'); await pg.fill('.card:has-text("Santander de Juan") .amtinput', '4200'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(1200)
        print('4 saldos', await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09').saldos)"))
        await pg.screenshot(path=str(SCR/'i-cuentas.png'))
        # 5. Gastos: abrir categoría desde resumen
        await pg.click('.nav button:has-text("Resumen")'); await pg.wait_for_timeout(300)
        await pg.click('.arearow:has-text("Vivienda")'); await pg.wait_for_timeout(400)
        print('5 pagina', await pg.inner_text('h1'), '| subrows visibles', await pg.locator('.subrows').count())
        await pg.screenshot(path=str(SCR/'i-gastos-vivienda.png'))
        # 6. configurar por tarjeta
        await pg.click('.seg button:has-text("Configurar")'); await pg.click('.seg button:has-text("Por tarjeta")'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=str(SCR/'i-gastos-config.png'), full_page=False)
        # 7. editar crédito
        await pg.click('.nav button:has-text("Créditos")'); await pg.wait_for_timeout(300)
        await pg.click('button[aria-label="Editar Nissan Qashqai"]'); await pg.fill('#f-fechaInicio', '2023-09'); await pg.click('.drawer-f button:has-text("Guardar")'); await pg.wait_for_timeout(1200)
        print('7 credito', await pg.evaluate("JSON.stringify(window.__store.get('app/config').creditos[0].fechaInicio)"), await pg.locator('.card:has-text("Nissan Qashqai") >> text=Pagado').count())
        # 8. borrar con confirmación
        await pg.click('.nav button:has-text("Ingresos")'); await pg.wait_for_timeout(300)
        await pg.click('tr.click:has-text("Asesoramiento audiológico")'); await pg.click('.drawer-f button:has-text("Eliminar")'); await pg.click('.drawer-f button:has-text("Sí, eliminar")'); await pg.wait_for_timeout(1200)
        print('8 borrado', await pg.evaluate("window.__store.get('app/movimientos').items.some(x=>x.id==='ing-03')"))
        # 9. restaurar copia antigua
        await pg.click('.side-btn:has-text("Copia de seguridad")'); await pg.set_input_files('.drawer input[type=file]', str(SCR/'copia-antigua.json')); await pg.wait_for_timeout(300)
        print('9 resumen copia', await pg.inner_text('.drawer .stack:has-text("Copia lista")'))
        await pg.click('.drawer button.danger.solid:text-is("Restaurar")'); await pg.wait_for_timeout(1500)
        print('  tras restaurar movs', await pg.evaluate("window.__store.get('app/movimientos').items.length"), 'mes', await pg.evaluate("JSON.stringify(window.__store.get('meses/2026-09'))"))
        # 10. descargar copia
        await pg.click('.side-btn:has-text("Copia de seguridad")'); await pg.click('.drawer button:has-text("Descargar")'); await pg.wait_for_timeout(300)
        print('10 descarga', await pg.evaluate('window.__download'))
        await ctx.close()
        # 11. sin datos / sin db
        for nodb, seedjs in [(False, 'null'), (True, 'null')]:
            ctx = await b.new_context(viewport={'width': 800, 'height': 700}); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.route('https://**/*', route); (ROOT/'test/p2.html').write_text(page_html(seedjs, nodb))
            await pg.goto('file://' + str(ROOT/'test/p2.html')); await pg.wait_for_timeout(700)
            print('11', 'nodb' if nodb else 'vacio', (await pg.inner_text('#root'))[:120].replace('\n', ' | '))
            await pg.click('button:has-text("Empezar vacía")'); await pg.wait_for_timeout(500)
            print('   tras empezar', (await pg.inner_text('h1')), 'store', await pg.evaluate("window.__store.has('app/config')"))
            await ctx.close()
        await b.close(); print('PAGE ERRORS', errs)
asyncio.run(main())
