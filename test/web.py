import asyncio, pathlib, sys, json
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/finanzas')
SCR = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-web'); SCR.mkdir(parents=True, exist_ok=True)

GEMINI_DOC = {
    "doc": {"tipo": "cuenta", "entidad": "Banco Santander", "producto": "Cuenta Nomina", "titular": "Juan", "cuentaId": "cta-santander-juan", "desde": "2026-09-01", "hasta": "2026-09-28", "saldoInicial": 2000, "saldoFinal": 3196.71},
    "movs": [
        {"f": "2026-09-01", "c": "TRANSFERENCIA ALQUILER", "m": "Alquiler", "i": -850, "k": "transferencia", "l": "gas-10", "a": "vivienda", "s": "Alquiler", "r": 0, "b": 1150},
        {"f": "2026-09-15", "c": "TRANSF OTOSUR", "m": "Otosur", "i": 3900, "k": "transferencia", "l": "ing-02", "a": "trabajo", "s": "", "r": 0, "b": 4509.11},
    ],
    "creditos": [], "aviso": "",
}

async def route_gemini(route):
    body = {"candidates": [{"content": {"parts": [{"text": json.dumps(GEMINI_DOC)}]}, "finishReason": "STOP"}]}
    await route.fulfill(status=200, content_type="application/json", body=json.dumps(body))

NM = ROOT / 'node_modules'
LIBS = {'pdf.worker.min.js': NM/'pdfjs-dist/build/pdf.worker.min.js', 'pdf.min.js': NM/'pdfjs-dist/build/pdf.min.js', 'xlsx.full.min.js': NM/'xlsx/dist/xlsx.full.min.js'}
async def route_libs(route):
    u = route.request.url
    for k, f in LIBS.items():
        if u.endswith(k):
            await route.fulfill(body=f.read_text(), content_type='application/javascript'); return
    await route.abort()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        ctx = await b.new_context(viewport={'width': 1440, 'height': 1000})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
        await pg.route('https://generativelanguage.googleapis.com/**', route_gemini)
        await pg.route('https://cdnjs.cloudflare.com/**', route_libs)
        await pg.route('https://fonts.googleapis.com/**', lambda r: r.abort())
        await pg.goto('file://' + str(ROOT / 'test/dist-web-test/index.html'))
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=str(SCR / '1-login.png'))
        print('pantalla de login visible:', await pg.locator('text=Iniciar sesión con Google').count())

        # entra con un correo NO autorizado primero
        await pg.evaluate("window.__TEST_EMAIL__='intruso@gmail.com'")
        await pg.click('button:has-text("Iniciar sesión con Google")')
        await pg.wait_for_timeout(400)
        print('no autorizado visible:', await pg.locator('text=no tiene acceso').count())
        await pg.screenshot(path=str(SCR / '2-no-autorizado.png'))
        await pg.click('button:has-text("Cerrar sesión")')
        await pg.wait_for_timeout(300)

        # entra con un correo autorizado
        await pg.evaluate("window.__TEST_EMAIL__='permitido@gmail.com'")
        await pg.click('button:has-text("Iniciar sesión con Google")')
        await pg.wait_for_timeout(600)
        print('bienvenida (sin datos) visible:', await pg.locator('text=Todavía no hay datos guardados').count())
        await pg.screenshot(path=str(SCR / '3-bienvenida.png'))
        await pg.click('button:has-text("Empezar vacía")')
        await pg.wait_for_timeout(800)
        print('resumen visible:', await pg.locator('h1:has-text("Resumen")').count())
        writes_iniciales = await pg.evaluate('window.__writes.length')
        print('escrituras iniciales en Firestore simulada:', writes_iniciales)
        await pg.screenshot(path=str(SCR / '4-resumen-vacio.png'))

        # recarga la página: los datos deben persistir en la Firestore "simulada" (misma pestaña, store en window)
        await pg.click('.nav button:has-text("Cuentas y tarjetas")')
        await pg.wait_for_timeout(300)
        await pg.click('button:has-text("Nueva cuenta")')
        await pg.fill('#f-nombre', 'Santander de Juan')
        await pg.click('.drawer-f button:has-text("Guardar")')
        await pg.wait_for_timeout(900)
        print('cuenta guardada en Firestore simulada:', 'app/config' in (await pg.evaluate("JSON.stringify([...window.__store.keys()])")))

        # importar con Gemini (mock de red)
        await pg.click('.nav button:has-text("Importar extractos")')
        await pg.wait_for_timeout(300)
        f = ROOT / 'test/fixtures/santander-septiembre.pdf'
        await pg.set_input_files('.dropzone input[type=file]', str(f))
        await pg.wait_for_selector('.applybar', timeout=20000)
        print('movimientos leídos con Gemini:', await pg.locator('.mov').count() - 1)
        await pg.screenshot(path=str(SCR / '5-importar-revision.png'), full_page=True)

        await ctx.close(); await b.close()
        print('ERRORS', len(errs))
        for e in errs[:20]: print(' ', e[:300])

asyncio.run(main())
