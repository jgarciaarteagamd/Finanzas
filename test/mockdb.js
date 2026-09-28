// Base de datos simulada para probar en local (no se publica).
(function () {
  const store = new Map();
  const seed = window.__SEED__;
  if (seed) {
    store.set('app/config', JSON.parse(JSON.stringify(seed.config)));
    store.set('app/movimientos', { items: JSON.parse(JSON.stringify(seed.movimientos)) });
    Object.entries(seed.meses || {}).forEach(([k, v]) => store.set('meses/' + k, v));
  }
  const listeners = [];
  const snapDoc = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => (store.has(p) ? JSON.parse(JSON.stringify(store.get(p))) : undefined), metadata: { fromCache: false, hasPendingWrites: false } });
  const snapCol = (c) => { const docs = [...store.keys()].filter((k) => k.startsWith(c + '/') && k.split('/').length === c.split('/').length + 1).sort().map(snapDoc); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; };
  const notify = () => setTimeout(() => listeners.forEach((l) => l()), 5);
  window.__writes = [];
  const db = {
    doc(p) { return {
      id: p.split('/').pop(), path: p,
      get: async () => snapDoc(p),
      set: async (d) => { window.__writes.push(p); store.set(p, JSON.parse(JSON.stringify(d))); notify(); },
      update: async (d) => { store.set(p, { ...(store.get(p) || {}), ...d }); notify(); },
      delete: async () => { window.__writes.push('DEL ' + p); store.delete(p); notify(); },
      onSnapshot(next) { const f = () => next(snapDoc(p)); listeners.push(f); setTimeout(f, 10); return () => {}; },
    }; },
    collection(c) { return { path: c, onSnapshot(next) { const f = () => next(snapCol(c)); listeners.push(f); setTimeout(f, 10); return () => {}; }, get: async () => snapCol(c) }; },
  };
  window.__store = store;
  window.claude = { use: async (n) => (n === 'db' ? (window.__NODB__ ? null : db) : n === 'downloads' ? { save: async (x) => { window.__download = x.filename; } } : null) };
})();
