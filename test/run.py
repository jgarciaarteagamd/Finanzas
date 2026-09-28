import sys, json, asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path('/home/claude/finanzas')
SHOTS = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots')
SHOTS.mkdir(parents=True, exist_ok=True)
html = (ROOT / 'dist/finanzas.html').read_text()
seed = (ROOT / 'test/seed.json').read_text()
mock = (ROOT / 'test/mockdb.js').read_text()
extra = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
meses = extra.get('meses')
if meses:
    s = json.loads(seed); s['meses'] = meses; seed = json.dumps(s)
page_html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + \
  f'<script>window.__SEED__={seed};</script><script>{mock}</script>' + html + '</body></html>'
(ROOT / 'test/page.html').write_text(page_html)
REACT = (ROOT / 'node_modules/react/umd/react.production.min.js').read_text()
RDOM = (ROOT / 'node_modules/react-dom/umd/react-dom.production.min.js').read_text()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errors = []
        async def route(r):
            u = r.request.url
            if 'react-dom' in u: await r.fulfill(body=RDOM, content_type='application/javascript')
            elif 'react.production' in u: await r.fulfill(body=REACT, content_type='application/javascript')
            else: await r.abort()
        pages = extra.get('pages', ['resumen','mes','ingresos','gastos','creditos','cuentas','ahorro','historial'])
        for vp_name, vp, scheme in extra.get('viewports', [['desk', {'width': 1440, 'height': 1000}, 'light'], ['mob', {'width': 390, 'height': 844}, 'light']]):
            ctx = await b.new_context(viewport=vp, color_scheme=scheme, device_scale_factor=1)
            pg = await ctx.new_page()
            pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
            pg.on('pageerror', lambda e: errors.append(f'PAGEERROR: {e}'))
            await pg.route('https://**/*', route)
            await pg.goto('file://' + str(ROOT / 'test/page.html'))
            await pg.wait_for_timeout(700)
            for name in pages:
                await pg.evaluate(f"localStorage.setItem('fin.page','{name}')")
                await pg.evaluate(f"location.hash='{name}'")
                await pg.reload()
                await pg.wait_for_timeout(700)
                await pg.screenshot(path=str(SHOTS / f'{vp_name}-{scheme}-{name}.png'), full_page=False)
                # full height of main content
                h = await pg.evaluate("document.querySelector('.main') ? document.querySelector('.main').scrollHeight : 0")
                over = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                print(vp_name, scheme, name, 'mainHeight', h, 'hOverflow', over)
            await ctx.close()
        await b.close()
        print('ERRORS:', len(errors))
        for e in errors[:30]: print(' ', e[:300])
asyncio.run(main())
