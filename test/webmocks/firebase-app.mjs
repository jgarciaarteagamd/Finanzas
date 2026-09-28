// Mock de firebase/app para pruebas locales sin conexión real.
let apps = [];
export function initializeApp(cfg) { const a = { options: cfg }; apps.push(a); return a; }
export function getApps() { return apps; }
