import { useEffect, useRef, useState, useCallback } from 'react';

/* ============================================================
   Guardado en la base de datos del artefacto (capacidad `db`).
   Documentos:
     app/config        → { version, mesInicio, cuentas, tarjetas, creditos, objetivos }
     app/movimientos   → { items: [...] }
     meses/<YYYY-MM>   → { saldos, reales, reparto, aportaciones }
   El estado local manda mientras hay escrituras pendientes; las
   instantáneas remotas se aplican cuando no hay nada pendiente.
   ============================================================ */
const P_CONFIG = 'app/config';
const P_MOVS = 'app/movimientos';
const mesPath = (mk) => `meses/${mk}`;
const COLS = [{ col: 'meses', field: 'meses' }, { col: 'extractos', field: 'extractos' }];
const colPath = (col, id) => `${col}/${id}`;

export function useStore() {
  const [state, setStateRaw] = useState(null);
  const [fase, setFase] = useState('cargando'); // cargando | listo | vacio | sin-db
  const [guardado, setGuardado] = useState({ estado: 'ok', mensaje: '' });
  const stateRef = useRef(null);
  const dbRef = useRef(null);
  const pend = useRef(new Map()); // path -> { timer, data, writing, dirty }
  const lastJson = useRef(new Map()); // path -> json escrito/recibido

  const setState = (s) => { stateRef.current = s; setStateRaw(s); };

  const refreshStatus = () => {
    const busy = [...pend.current.values()].some((p) => p.timer || p.writing || p.dirty);
    setGuardado((g) => (g.estado === 'error' && !busy ? g : { estado: busy ? 'guardando' : 'ok', mensaje: busy ? '' : g.mensaje }));
  };

  const flush = async (path) => {
    const db = dbRef.current;
    const p = pend.current.get(path);
    if (!db || !p) return;
    if (p.writing) { p.dirty = true; return; }
    p.timer = null; p.writing = true; p.dirty = false;
    const data = p.data;
    refreshStatus();
    try {
      if (data === null) await db.doc(path).delete();
      else await db.doc(path).set(data);
      lastJson.current.set(path, JSON.stringify(data));
      setGuardado({ estado: 'ok', mensaje: '' });
    } catch (e) {
      const code = e && e.code;
      const msg = code === 'quota_exceeded' ? 'La base de datos está llena.' : code === 'invalid_argument' ? 'No tienes permiso para guardar cambios aquí.' : 'No se pudo guardar. Se reintentará con el próximo cambio.';
      setGuardado({ estado: 'error', mensaje: msg });
      if (code === 'unavailable') { setTimeout(() => { const q = pend.current.get(path); if (q && !q.timer) { q.timer = setTimeout(() => flush(path), 10); } }, 1500 + Math.random() * 1000); }
    } finally {
      p.writing = false;
      if (p.dirty) { p.dirty = false; p.timer = setTimeout(() => flush(path), 300); }
      refreshStatus();
    }
  };

  const schedule = (path, data) => {
    if (!dbRef.current) return;
    const p = pend.current.get(path) || { timer: null, data: null, writing: false, dirty: false };
    p.data = data;
    if (p.timer) clearTimeout(p.timer);
    p.timer = setTimeout(() => flush(path), 650);
    pend.current.set(path, p);
    setGuardado({ estado: 'guardando', mensaje: '' });
  };
  const isPending = (path) => { const p = pend.current.get(path); return !!(p && (p.timer || p.writing || p.dirty)); };

  /* aplica un cambio y programa el guardado de lo que cambió */
  const update = useCallback((fn) => {
    const prev = stateRef.current;
    if (!prev) return;
    const next = fn(prev);
    if (!next || next === prev) return;
    setState(next);
    if (next.config !== prev.config) schedule(P_CONFIG, next.config);
    if (next.movimientos !== prev.movimientos) schedule(P_MOVS, { items: next.movimientos });
    COLS.forEach(({ col, field }) => {
      if (prev[field] === next[field]) return;
      const keys = new Set([...Object.keys(prev[field] || {}), ...Object.keys(next[field] || {})]);
      keys.forEach((id) => {
        const a = prev[field]?.[id], b = next[field]?.[id];
        if (a !== b) schedule(colPath(col, id), b ? b : null);
      });
    });
  }, []);

  /* reemplaza todo (importar copia o empezar de cero) */
  const replaceAll = useCallback((s) => {
    const prev = stateRef.current;
    s = { extractos: {}, ...s };
    setState(s);
    setFase('listo');
    schedule(P_CONFIG, s.config);
    schedule(P_MOVS, { items: s.movimientos });
    COLS.forEach(({ col, field }) => {
      const keys = new Set([...Object.keys(prev?.[field] || {}), ...Object.keys(s[field] || {})]);
      keys.forEach((id) => schedule(colPath(col, id), s[field]?.[id] || null));
    });
  }, []);

  useEffect(() => {
    let unsubs = [];
    let alive = true;
    (async () => {
      let db = null;
      try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
      if (!alive) return;
      if (!db) { setFase('sin-db'); return; }
      dbRef.current = db;
      const got = { config: undefined, movs: undefined, meses: undefined, extractos: undefined };
      const tryAssemble = () => {
        if (Object.values(got).some((v) => v === undefined)) return;
        if (!stateRef.current) {
          if (!got.config) { setFase('vacio'); return; }
          setState({ config: got.config, movimientos: got.movs || [], meses: got.meses || {}, extractos: got.extractos || {} });
          setFase('listo');
        }
      };
      const onErr = (e) => { setGuardado({ estado: 'error', mensaje: e && e.code === 'revoked' ? 'Ya no tienes acceso a estos datos.' : 'Se perdió la conexión con los datos. Recarga la página.' }); };
      unsubs.push(db.doc(P_CONFIG).onSnapshot((snap) => {
        const data = snap.exists ? snap.data() : null;
        const json = JSON.stringify(data);
        if (stateRef.current && (isPending(P_CONFIG) || lastJson.current.get(P_CONFIG) === json)) { lastJson.current.set(P_CONFIG, json); return; }
        lastJson.current.set(P_CONFIG, json);
        if (stateRef.current && data) setState({ ...stateRef.current, config: JSON.parse(json) });
        else { got.config = data ? JSON.parse(json) : null; tryAssemble(); }
      }, onErr));
      unsubs.push(db.doc(P_MOVS).onSnapshot((snap) => {
        const data = snap.exists ? snap.data() : null;
        const items = data && Array.isArray(data.items) ? JSON.parse(JSON.stringify(data.items)) : [];
        const json = JSON.stringify({ items });
        if (stateRef.current && (isPending(P_MOVS) || lastJson.current.get(P_MOVS) === json)) { lastJson.current.set(P_MOVS, json); return; }
        lastJson.current.set(P_MOVS, json);
        if (stateRef.current && data) setState({ ...stateRef.current, movimientos: items });
        else { got.movs = items; tryAssemble(); }
      }, onErr));
      COLS.forEach(({ col, field }) => {
        unsubs.push(db.collection(col).onSnapshot((snap) => {
          const docs = {};
          snap.docs.forEach((d) => { if (d.exists) docs[d.id] = JSON.parse(JSON.stringify(d.data())); });
          if (stateRef.current) {
            let changed = false;
            const next = { ...(stateRef.current[field] || {}) };
            Object.entries(docs).forEach(([id, v]) => {
              const path = colPath(col, id), json = JSON.stringify(v);
              if (isPending(path) || lastJson.current.get(path) === json) { lastJson.current.set(path, json); return; }
              lastJson.current.set(path, json); next[id] = v; changed = true;
            });
            Object.keys(next).forEach((id) => { if (!docs[id] && !isPending(colPath(col, id)) && lastJson.current.has(colPath(col, id))) { delete next[id]; changed = true; } });
            if (changed) setState({ ...stateRef.current, [field]: next });
          } else {
            Object.entries(docs).forEach(([id, v]) => lastJson.current.set(colPath(col, id), JSON.stringify(v)));
            got[field] = docs; tryAssemble();
          }
        }, onErr));
      });
    })();
    return () => { alive = false; unsubs.forEach((u) => u && u()); };
  }, []);

  /* sin base de datos: trabajar en memoria (p. ej. tras importar una copia) */
  const useInMemory = useCallback((s) => { setState({ extractos: {}, ...s }); setFase('listo'); }, []);

  return { state, fase, guardado, update, replaceAll, useInMemory, hasDb: () => !!dbRef.current };
}
