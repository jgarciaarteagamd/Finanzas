// Mock de firebase/auth: no hay ventana emergente real; entrar
// simplemente "inicia sesión" con el correo de window.__TEST_EMAIL__.
let user = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f(user));

export function getAuth() { return {}; }
export class GoogleAuthProvider {}
export async function signInWithPopup() {
  if (window.__TEST_NO_LOGIN__) { const e = new Error('cerrado'); e.code = 'auth/popup-closed-by-user'; throw e; }
  user = { email: window.__TEST_EMAIL__ || 'sin-correo@gmail.com' };
  notify();
  return { user };
}
export function onAuthStateChanged(_auth, cb) { listeners.add(cb); setTimeout(() => cb(user), 5); return () => listeners.delete(cb); }
export async function signOut() { user = null; notify(); }
