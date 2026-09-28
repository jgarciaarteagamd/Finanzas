// Mock de firebase/firestore: una base de datos en memoria, igual
// de forma que test/mockdb.js pero con la API modular de Firebase
// (doc/getDoc/setDoc/onSnapshot/collection/getDocs) que usa
// src/web/firestoreShim.js.
const store = new Map();
const listeners = new Map(); // path -> Set(fn)
window.__store = store;
window.__writes = [];

function notify(path) {
  (listeners.get(path) || new Set()).forEach((f) => f());
  // también las colecciones que contienen este documento
  listeners.forEach((set, p) => { if (path.startsWith(p + '/') && path.split('/').length === p.split('/').length + 1) set.forEach((f) => f()); });
}

export function getFirestore() { return {}; }
export function doc(_db, path) { return { path, id: path.split('/').pop() }; }
export function collection(_db, path) { return { path, id: path.split('/').pop() }; }

export async function getDoc(ref) {
  const has = store.has(ref.path);
  return { id: ref.id, exists: () => has, data: () => (has ? JSON.parse(JSON.stringify(store.get(ref.path))) : undefined), metadata: { fromCache: false, hasPendingWrites: false } };
}
export async function setDoc(ref, data, opts) {
  window.__writes.push(ref.path);
  const merge = opts && opts.merge;
  store.set(ref.path, merge ? { ...(store.get(ref.path) || {}), ...data } : JSON.parse(JSON.stringify(data)));
  notify(ref.path);
}
export async function deleteDoc(ref) {
  window.__writes.push('DEL ' + ref.path);
  store.delete(ref.path);
  notify(ref.path);
}
export async function getDocs(ref) {
  const docs = [...store.keys()].filter((k) => k.startsWith(ref.path + '/') && k.split('/').length === ref.path.split('/').length + 1)
    .sort().map((k) => ({ id: k.split('/').pop(), exists: () => true, data: () => JSON.parse(JSON.stringify(store.get(k))) }));
  return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
}
export function onSnapshot(ref, next, _onErr) {
  const f = async () => {
    if (ref.path.split('/').length % 2 === 0) next(await getDoc(ref));
    else next(await getDocs(ref));
  };
  const set = listeners.get(ref.path) || new Set(); set.add(f); listeners.set(ref.path, set);
  setTimeout(f, 5);
  return () => { set.delete(f); };
}
