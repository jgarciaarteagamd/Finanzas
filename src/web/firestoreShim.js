/* ============================================================
   Adaptador: pone Firestore (Firebase) detrás de la MISMA forma
   que usa store.js cuando pide `window.claude.use('db')` dentro de
   un artefacto de Claude. Gracias a esto, store.js, app.jsx y todas
   las páginas no necesitan ningún cambio para funcionar aquí.

   Formas que replica (ver la capacidad `db` de los artefactos):
     db.doc(path).get() → { id, exists, data() }
     db.doc(path).set(obj) / .update(obj) / .delete()
     db.doc(path).onSnapshot(next, onErr) → unsubscribe
     db.collection(path).onSnapshot(next, onErr) → unsubscribe
     db.collection(path).get() → { docs, size, empty }
   ============================================================ */
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, getDocs,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config.js';

let app = null;
export function firebaseApp() {
  if (!app) app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  return app;
}

function snapDoc(id, d) {
  return {
    id, exists: d.exists(), data: () => (d.exists() ? d.data() : undefined),
    metadata: { fromCache: d.metadata?.fromCache || false, hasPendingWrites: d.metadata?.hasPendingWrites || false },
  };
}
function snapCol(qs) {
  const docs = qs.docs.map((d) => snapDoc(d.id, d));
  return { docs, size: docs.length, empty: docs.length === 0, docChanges: () => qs.docChanges(), metadata: qs.metadata };
}
const errShape = (e) => ({ code: e && e.code === 'permission-denied' ? 'invalid_argument' : e && e.code === 'unavailable' ? 'unavailable' : 'unknown', message: (e && e.message) || String(e) });

export function crearDbFirestore() {
  const db = getFirestore(firebaseApp());
  return {
    doc(path) {
      const ref = doc(db, path);
      return {
        id: ref.id, path,
        get: async () => snapDoc(ref.id, await getDoc(ref)),
        set: async (data) => { await setDoc(ref, data); },
        update: async (data) => { await setDoc(ref, data, { merge: true }); },
        delete: async () => { await deleteDoc(ref); },
        onSnapshot(next, onErr) {
          return onSnapshot(ref, (d) => next(snapDoc(ref.id, d)), (e) => onErr && onErr(errShape(e)));
        },
      };
    },
    collection(path) {
      const ref = collection(db, path);
      return {
        path,
        get: async () => snapCol(await getDocs(ref)),
        onSnapshot(next, onErr) {
          return onSnapshot(ref, (qs) => next(snapCol(qs)), (e) => onErr && onErr(errShape(e)));
        },
      };
    },
  };
}
