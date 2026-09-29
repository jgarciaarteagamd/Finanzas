import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../app.jsx';
import { AuthGate } from './AuthGate.jsx';
import { crearDbFirestore } from './firestoreShim.js';
import { crearDownloads } from './downloadsShim.js';
import { crearSample } from './geminiShim.js';

/* La app (store.js, app.jsx, importar/*) llama a
   window.claude.use('db' | 'downloads' | 'sample'), igual que
   dentro de un artefacto de Claude. Aquí implementamos esas mismas
   tres capacidades con Firebase y Gemini, para que el resto del
   código no necesite saber dónde está corriendo. */
let dbCache = null, samplecache = null, downloadsCache = null;
window.__FINANZAS_WEB__ = true;
window.claude = {
  use: async (nombre) => {
    if (nombre === 'db') return dbCache || (dbCache = crearDbFirestore());
    if (nombre === 'downloads') return downloadsCache || (downloadsCache = crearDownloads());
    if (nombre === 'sample') return samplecache || (samplecache = crearSample());
    return null;
  },
};

createRoot(document.getElementById('root')).render(
  <AuthGate><App /></AuthGate>,
);
