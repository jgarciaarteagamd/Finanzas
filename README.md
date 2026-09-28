# Finanzas García Naranjo

App de finanzas domésticas de la familia García Naranjo: ingresos, gastos,
tarjetas y créditos, objetivos de ahorro, y un asistente de IA que lee
extractos bancarios (PDF, Excel o foto) y propone los movimientos ya
categorizados.

El mismo código fuente (`src/`) se compila de **dos formas distintas**,
según dónde vaya a vivir la app:

| | Artefacto de Claude | Web independiente |
|---|---|---|
| Comando | `npm run build:artifact` | `npm run build:web` |
| Punto de entrada | `src/entry.artifact.jsx` | `src/web/entry.web.jsx` |
| Salida | `dist/finanzas.html` (un solo archivo) | `dist-web/` (`index.html` + `app.js`) |
| Guardado de datos | `window.claude.use('db')` (Firestore de Claude) | Firestore de un proyecto Firebase propio |
| Copia de seguridad | `window.claude.use('downloads')` | descarga con `Blob` en el navegador |
| Lector de extractos (IA) | `window.claude.use('sample')` (modelo de Claude) | API de Gemini, llamada directa desde el navegador |
| Acceso | el de la conversación de Claude | inicio de sesión con Google, restringido a la familia |
| Cómo se despliega | se publica como Artifact en Claude | GitHub Actions → Firebase Hosting, al hacer `git push` a `main` |

## Cómo es posible compartir el mismo código

Casi todo el código (`src/app.jsx`, `src/store.js`, `src/pages/*.jsx`,
`src/importar/*`, `src/engine.js`, `src/ui.jsx`...) **no sabe ni le importa**
dónde se está ejecutando. Todo pasa por tres funciones que la app pide una
vez, al arrancar:

```js
const db        = await window.claude.use('db');
const downloads = await window.claude.use('downloads');
const sample     = await window.claude.use('sample');
```

- En el **artefacto de Claude**, `window.claude` ya existe y esas tres
  funciones las da Claude.
- En la **web independiente**, `src/web/entry.web.jsx` crea su propio
  `window.claude.use(...)` que por dentro usa Firebase y Gemini, pero
  **imita exactamente la misma forma** (mismos parámetros, mismos códigos
  de error) que la versión de Claude. Esa "imitación" vive en:
  - `src/web/firestoreShim.js` → Firestore de Firebase en vez de la base
    de datos de Claude.
  - `src/web/downloadsShim.js` → descarga de archivo en el navegador.
  - `src/web/geminiShim.js` → llamadas a la API de Gemini en vez del
    modelo de Claude.
  - `src/web/AuthGate.jsx` → pantalla de inicio de sesión con Google que
    solo deja pasar a los correos de `ALLOWED_EMAILS`.

Por eso, cualquier cambio de negocio (una categoría nueva, una pantalla,
una validación) se hace **una sola vez** en `src/` y funciona en los dos
sitios. Solo hay que tocar `src/web/*` si el cambio es sobre el propio
inicio de sesión o el guardado de datos.

## Estructura del repositorio

```
src/
  app.jsx, store.js, engine.js, ui.jsx, charts.jsx, forms.jsx   ← lógica y pantallas (compartido)
  pages/                                                        ← una vista por página (compartido)
  importar/                                                     ← lectura de extractos con IA (compartido)
  entry.artifact.jsx     ← arranque para el artefacto de Claude
  template.html          ← plantilla HTML del artefacto
  web/                   ← todo lo que es exclusivo de la web independiente
    entry.web.jsx, AuthGate.jsx, config.js
    firestoreShim.js, downloadsShim.js, geminiShim.js
  template.web.html      ← plantilla HTML de la web independiente

build.mjs          ← compila el artefacto de Claude → dist/finanzas.html
build.web.mjs       ← compila la web independiente → dist-web/

firebase.json, firestore.rules, .firebaserc   ← configuración de Firebase Hosting/Firestore
.github/workflows/deploy.yml                  ← publica en Firebase Hosting al hacer push a main

migracion/copia-seguridad-inicial.json  ← copia de los datos ya configurados, para restaurarlos en la web nueva la primera vez

test/               ← pruebas automáticas con Playwright (ver más abajo)
```

## Variables de entorno (secrets) que necesita `build:web`

`build.web.mjs` las convierte en el JS compilado en tiempo de compilación
(no hay servidor por detrás, así que no pueden cambiarse sin recompilar):

- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`
  (y opcionalmente `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`) — de la
  configuración del proyecto Firebase.
- `GEMINI_API_KEY` — clave de la API de Gemini (Google AI Studio).
- `ALLOWED_EMAILS` — correos de Google autorizados a entrar, separados por comas.

En GitHub Actions estas variables se leen de **Settings → Secrets and
variables → Actions** del repositorio (ver la guía paso a paso para los
nombres exactos).

## Cómo se despliega

`git push` a la rama `main` dispara `.github/workflows/deploy.yml`, que:
1. Instala dependencias (`npm ci`).
2. Compila la web (`node build.web.mjs`) con los secrets de arriba.
3. Publica `dist-web/` en Firebase Hosting.
4. Publica `firestore.rules` en el proyecto Firebase.

Esto significa que para publicar un cambio **no hace falta ejecutar nada a
mano ni tener Firebase instalado en tu ordenador**: basta con que el nuevo
código llegue a `main` (lo suba Juan, o un agente de IA con acceso de
escritura al repositorio).

## Pruebas locales (Playwright)

Requieren Python 3 con `playwright` instalado (`pip install playwright &&
playwright install chromium`) y las dependencias de Node (`npm install`).

```bash
node build.mjs && python3 test/run.py           # artefacto de Claude
node build.mjs && python3 test/importar.py      # importación de extractos (artefacto)
node test/build.web.test.mjs && python3 test/web.py   # web independiente (Firebase/Gemini simulados)
```

Las pruebas de la web independiente sustituyen `firebase/app`,
`firebase/firestore` y `firebase/auth` por mocks en memoria
(`test/webmocks/`) y simulan la API de Gemini interceptando la red con
Playwright, así que no hacen falta credenciales reales para probar.

## Guía para desplegar desde cero

Ver el documento **"Guía paso a paso: publicar Finanzas García Naranjo en
la web"**, con instrucciones detalladas para alguien sin experiencia
técnica (crear el proyecto Firebase, la clave de Gemini, los secrets de
GitHub, etc.).
