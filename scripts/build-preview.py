#!/usr/bin/env python3
"""
Genera index.html: la vista previa estática del sitio (para GitHub Pages).

Levanta el sitio real (compilado, sin base de datos) con una lista de matriculados inventada,
recorre las pantallas con un navegador y las guarda en UN solo archivo HTML con un mini navegador propio
(scripts/preview.js). Los formularios de la vista previa son simulados: el sitio real corre con
`npm run dev` o en Vercel.

Uso:   npx next build && python3 scripts/build-preview.py
Requiere: pip install playwright, y Chrome instalado (CHROME_PATH si no está en /usr/bin/google-chrome).
"""
import json, os, re, subprocess, sys, time, urllib.request
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = 3101
BASE = f'http://localhost:{PORT}'
CHROME = os.environ.get('CHROME_PATH', '/usr/bin/google-chrome')

# ───── Lista de matriculados inventada: la vista previa no usa personas reales ─────
FAKE = [['1234', 'GÓMEZ, ANA MARÍA', 'RECONQUISTA'], ['R777', 'PÉREZ, LUCÍA', 'ROSARIO']]


# Reescribe enlaces para el mini navegador de la vista previa y devuelve el contenido de <main>
REWRITE = """() => {
  const MAP = {'/': 'home', '/profesionales': 'profesionales', '/asociar': 'asociar', '/contacto': 'contacto', '/terminos': 'terminos'};
  document.querySelectorAll('a[href]').forEach((a) => {
    const h = a.getAttribute('href');
    if (/^(mailto:|tel:|https?:)/.test(h)) { if (/wa\\.me|whatsapp/.test(h)) a.setAttribute('target', '_blank'); return; }
    if (h.startsWith('#')) return;
    const u = new URL(h, location.origin);
    if (MAP[u.pathname]) { a.dataset.go = MAP[u.pathname]; a.dataset.q = u.search.slice(1); a.setAttribute('href', '#' + MAP[u.pathname]); }
    else { a.dataset.pv = 'other'; a.dataset.orig = h; a.setAttribute('href', '#'); }
  });
}"""
CAPTURE = "() => { (%s)(); return document.querySelector('main#contenido').innerHTML; }" % REWRITE


def fill_step1(pg, prov='Santa Fe', lic='1234', last='Gómez'):
    pg.goto(BASE + '/asociar'); pg.wait_for_load_state('networkidle')
    pg.fill('input[autocomplete="given-name"]', 'Ana María'); pg.fill('input[autocomplete="family-name"]', last)
    pg.fill('input[type=email]', 'ana@example.com'); pg.fill('input[type=tel]', '3482 440552')
    pg.locator('main input').nth(4).fill(lic)
    pg.locator('main select').nth(0).select_option(label=prov)
    pg.locator('fieldset', has_text='Especialidades').locator('label').first.click()
    pg.locator('fieldset', has_text='Rango etario').locator('label').first.click()
    pg.locator('fieldset', has_text='Modalidad de atención').locator('label').first.click()
    pg.locator('input[autocomplete="address-level2"]').fill('Reconquista')
    pg.locator('main select').nth(1).select_option(label='Santa Fe')


def dialog_html(pg):
    return pg.locator('dialog').evaluate('d => d.innerHTML')


def main():
    fake = Path(tempfile.mkdtemp()) / 'matriculados.json'
    fake.write_text(json.dumps(FAKE, ensure_ascii=False))
    env = {**os.environ, 'PORT': str(PORT), 'MATRICULA_MODE': 'cpsf', 'CPSF_DATA': str(fake),
           'TRIAL_MONTHS': '3', 'MEMBERSHIP_PRICE_ARS': '15000', 'MP_MODE': 'live', 'DATABASE_URL': ''}
    app = subprocess.Popen(['npx', 'next', 'start', '-p', str(PORT)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + '/', timeout=2); break
            except Exception:
                time.sleep(1)
        else:
            sys.exit('El sitio no arrancó (¿corriste `npx next build`?)')

        demo = {d['slug']: d for d in json.loads(subprocess.check_output(['npx', 'tsx', 'scripts/preview-demo.ts'], cwd=ROOT, text=True).strip().splitlines()[-1])}

        with sync_playwright() as pw:
            br = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            pg = br.new_page(viewport={'width': 1280, 'height': 900})
            pg.goto(BASE + '/'); pg.wait_for_load_state('networkidle')

            # CSS del sitio, sin las tipografías locales (la vista previa usa Google Fonts)
            css = ''
            for href in pg.eval_on_selector_all('link[rel=stylesheet]', 'els => els.map(e => e.href)'):
                css += urllib.request.urlopen(href).read().decode()
            css = re.sub(r'@font-face\{[^}]*\}', '', css)

            pg.evaluate(REWRITE)
            chrome = pg.evaluate("""() => ({
              header: document.querySelector('header').outerHTML,
              footer: document.querySelector('footer').outerHTML,
              wa: document.querySelector('a[data-whatsapp]').outerHTML,
              cls: document.body.className })""")
            pages = {'home': pg.evaluate(CAPTURE)}
            for key, path in [('profesionales', '/profesionales'), ('contacto', '/contacto'), ('terminos', '/terminos')]:
                pg.goto(BASE + path); pg.wait_for_load_state('networkidle')
                pages[key] = pg.evaluate(CAPTURE)

            # Tarjetas del directorio: datos para filtrar
            def mark(html):
                order = list(demo.values())  # las tarjetas salen en el mismo orden que los datos de ejemplo
                n = {'i': 0}

                def card(m):
                    d = order[n['i']] if n['i'] < len(order) else None
                    n['i'] += 1
                    if not d:
                        return m.group(0)
                    attrs = ' data-pv-card="1" data-esp=\'%s\' data-corr=\'%s\' data-obra=\'%s\' data-edad="%s" data-mod="%s" data-zona="%s"' % (
                        json.dumps(d['esp'], ensure_ascii=False).replace("'", '&#39;'), json.dumps(d['corr'], ensure_ascii=False).replace("'", '&#39;'),
                        json.dumps(d['obra'], ensure_ascii=False).replace("'", '&#39;'), ','.join(d['edad']), d['mod'], d['zona'])
                    return m.group(0).replace('<article', '<article' + attrs, 1)
                out = re.sub(r'<article[\s\S]*?</article>', card, html)
                assert n['i'] == len(order), 'la cantidad de tarjetas no coincide con los datos de ejemplo'
                return out
            pages['profesionales'] = mark(pages['profesionales']) + (
                '<div id="pv-empty" style="display:none;text-align:center;padding:48px 20px">'
                '<p style="font-weight:600;font-size:1.1rem">Ningún perfil coincide con esa búsqueda.</p>'
                '<p style="opacity:.7">Probá con otras opciones o con una zona más amplia.</p></div>')

            # ───── Alta: se recorre el formulario real ─────
            print('→ alta', file=sys.stderr)
            pg.goto(BASE + '/asociar'); pg.wait_for_load_state('networkidle')
            pages['asociar'] = pg.evaluate(CAPTURE)

            dlg = {}
            fill_step1(pg)
            pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(300)
            dlg['notice_sf'] = dialog_html(pg)
            pg.get_by_role('button', name='Entendido').click(); pg.wait_for_timeout(2500)
            dlg['result_ok'] = dialog_html(pg)
            assert 'Matrícula verificada' in dlg['result_ok'], 'la lista inventada no verificó la matrícula 1234'

            pg.get_by_role('button', name='Continuar').last.click(); pg.wait_for_timeout(300)
            pages['asociar2'] = pg.evaluate(CAPTURE)
            # Prueba real de la subida del título en el sitio (no solo en la vista previa)
            pg.locator('input[type=file]').nth(1).set_input_files(files=[{'name': 'titulo.pdf', 'mimeType': '', 'buffer': b'%PDF-1.4 x'}])
            pg.wait_for_timeout(300)
            assert 'titulo.pdf' in pg.locator('main').inner_text(), 'la subida del título no funciona'
            pg.locator('input[type=checkbox]').last.check()
            pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(400)
            assert 'Hoy pagás' in pg.locator('main').inner_text(), 'no llegó al paso 3'
            assert 'Empezá tu suscripción gratis hoy!' in pg.locator('main').inner_text(), 'falta el botón de suscripción gratis'
            pages['asociar3'] = pg.evaluate(CAPTURE)

            fill_step1(pg, lic='99999')
            pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(300)
            pg.get_by_role('button', name='Entendido').click(); pg.wait_for_timeout(2500)
            dlg['result_bad'] = dialog_html(pg)
            assert 'No pudimos verificar' in dlg['result_bad'], 'una matrícula inexistente no se bloqueó'

            fill_step1(pg, lic='1234', last='Pérez')
            pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(300)
            pg.get_by_role('button', name='Entendido').click(); pg.wait_for_timeout(2500)
            dlg['result_mismatch'] = dialog_html(pg)
            assert 'nombre o el apellido no coinciden' in dlg['result_mismatch'], 'un nombre distinto no se bloqueó'

            fill_step1(pg, prov='Córdoba', lic='555')
            pg.get_by_role('button', name='Continuar').click(); pg.wait_for_timeout(300)
            dlg['notice_other'] = dialog_html(pg)
            pg.get_by_role('button', name='Entendido').click(); pg.wait_for_timeout(800)
            assert 'Subí tu título' in pg.locator('main').inner_text(), 'con matrícula de otra provincia debería poder continuar'
            br.close()

        css = css.replace('</style', '<\\/style')
        extra_css = ('#pv-note{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translate(-50%,16px);max-width:min(92vw,520px);'
                     'background:#082220;color:#fff;font:500 14px/1.4 Poppins,system-ui,sans-serif;padding:12px 18px;border-radius:999px;opacity:0;pointer-events:none;'
                     'transition:.25s;z-index:70;text-align:center}#pv-note.on{opacity:1;transform:translate(-50%,0)}')
        sections = ''.join(f'<section data-page="{k}"{"" if k == "home" else " hidden"}>{v}</section>' for k, v in pages.items())
        tag = ('<div id="pv-tag" style="position:fixed;left:12px;bottom:12px;z-index:60;border-radius:999px;background:#fff;border:1px solid rgba(8,34,32,.18);'
               'color:#082220;padding:6px 12px;font:500 12px/1.3 Poppins,system-ui,sans-serif;max-width:calc(100vw - 150px)">'
               'Vista previa de diseño · datos de ejemplo · la matrícula se verifica con la lista real</div><div id="pv-note" role="status" aria-live="polite"></div>')
        html = ('<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>ProfesionalesOk · vista previa</title><style>' + css + extra_css + '</style>'
                '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Bebas+Neue&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">'
                '</head><body>'
                f'<div id="pv" class="{chrome["cls"]}">{chrome["header"]}<main id="contenido" class="flex-1">{sections}</main>{chrome["footer"]}{chrome["wa"]}{tag}</div>'
                '<script type="application/json" id="pv-data">' + (ROOT / 'data/matriculados.json').read_text(encoding='utf-8').replace('</', '<\\/') + '</script>'
                '<script type="application/json" id="pv-dlg">' + json.dumps(dlg, ensure_ascii=False).replace('</', '<\\/') + '</script>'
                '<script>' + (ROOT / 'scripts/preview.js').read_text() + '</script></body></html>')
        (ROOT / 'index.html').write_text(html, encoding='utf-8')
        print(f'index.html listo: {len(html) // 1024} KB', file=sys.stderr)
    finally:
        app.terminate()


main()
