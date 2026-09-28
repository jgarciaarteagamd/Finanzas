/* ============================================================
   Configuración de la versión web (fuera de Claude).
   Estos valores NO se escriben aquí: se rellenan al compilar,
   a partir de variables de entorno (ver build.web.mjs y
   .github/workflows/deploy.yml). Así no hace falta tocar código
   para cambiar de proyecto de Firebase o de claves.

   FIREBASE_CONFIG.apiKey y compañía NO son secretos: Firebase los
   diseña para ir dentro del JavaScript del navegador; lo que
   protege tus datos son las reglas de Firestore y el inicio de
   sesión (ver firestore.rules). GEMINI_API_KEY sí conviene
   restringirla por dominio en Google Cloud Console (se explica en
   la guía).
   ============================================================ */
export const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID,
};

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/* Correos de Gmail (uno por línea o separados por coma) a los que
   se les deja entrar. Edítalo en el secreto ALLOWED_EMAILS de
   GitHub (Settings → Secrets → Actions) o, para probar en tu
   ordenador, en tu archivo .env.local. */
export const ALLOWED_EMAILS = String(process.env.ALLOWED_EMAILS || '')
  .split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
