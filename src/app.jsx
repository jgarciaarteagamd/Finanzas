import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Tags, LayoutDashboard, CalendarCheck2, TrendingUp, ReceiptText, HandCoins, Wallet, PiggyBank, History,
  ChevronLeft, ChevronRight, Save, MoreHorizontal, Upload, Download, FileJson, X, FileUp,
} from 'lucide-react';
import { useStore } from './store.js';
import * as E from './engine.js';
import { Drawer } from './ui.jsx';
import { ResumenPage } from './pages/resumen.jsx';
import { MesPage } from './pages/mes.jsx';
import { IngresosPage } from './pages/ingresos.jsx';
import { GastosPage } from './pages/gastos.jsx';
import { CreditosPage } from './pages/creditos.jsx';
import { CuentasPage } from './pages/cuentas.jsx';
import { AhorroPage } from './pages/ahorro.jsx';
import { HistorialPage } from './pages/historial.jsx';
import { EtiquetasPage } from './pages/etiquetas.jsx';
import { ImportarPage } from './pages/importar.jsx';

const PAGES = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard, C: ResumenPage },
  { key: 'mes', label: 'Mes a mes', short: 'Mes', icon: CalendarCheck2, C: MesPage },
  { key: 'ingresos', label: 'Ingresos', icon: TrendingUp, C: IngresosPage },
  { key: 'gastos', label: 'Gastos', icon: ReceiptText, C: GastosPage },
  { key: 'creditos', label: 'Créditos', icon: HandCoins, C: CreditosPage },
  { key: 'cuentas', label: 'Cuentas y tarjetas', short: 'Cuentas', icon: Wallet, C: CuentasPage },
  { key: 'ahorro', label: 'Ahorro', icon: PiggyBank, C: AhorroPage },
  { key: 'etiquetas', label: 'Etiquetas', icon: Tags, C: EtiquetasPage },
  { key: 'historial', label: 'Historial', icon: History, C: HistorialPage },
  { key: 'importar', label: 'Importar extractos', short: 'Importar', icon: FileUp, C: ImportarPage, destacado: true },
];
const TAB_MOVIL = ['resumen', 'mes', 'gastos', 'cuentas'];

const hoyMk = () => { const d = new Date(); return E.mkOf(d.getFullYear(), d.getMonth() + 1); };
const leerPref = (k, d) => { try { return window.localStorage.getItem(k) || d; } catch (e) { return d; } };
const guardarPref = (k, v) => { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

function App() {
  const store = useStore();
  const { state, fase, guardado, update, replaceAll } = store;
  const [page, setPageRaw] = useState(() => {
    const h = (window.location.hash || '').replace('#', '');
    return PAGES.some((p) => p.key === h) ? h : leerPref('fin.page', 'resumen');
  });
  const setPage = (p) => { setPageRaw(p); guardarPref('fin.page', p); const m = document.querySelector('.main'); if (m) m.scrollTop = 0; };
  const [mkRaw, setMk] = useState(hoyMk());
  const [focus, setFocus] = useState(null); // p. ej. { area: 'vivienda' } al saltar desde el resumen
  const [more, setMore] = useState(false);
  const [backup, setBackup] = useState(false);

  const inicio = state?.config?.mesInicio || '2000-01';
  const mk = mkRaw < inicio ? inicio : mkRaw;
  const go = (p, f = null) => { setFocus(f); setPage(p); setMore(false); };

  /* ---------- acciones ---------- */
  const A = useMemo(() => {
    const mesDe = (s, m) => (s.meses && s.meses[m]) || { saldos: {}, reales: {}, reparto: {}, aportaciones: {} };
    const setMes = (s, m, patch) => {
      const cur = mesDe(s, m);
      const next = { saldos: { ...cur.saldos }, reales: { ...cur.reales }, reparto: { ...cur.reparto }, aportaciones: { ...cur.aportaciones } };
      patch(next);
      return { ...s, meses: { ...s.meses, [m]: next } };
    };
    const setField = (grupo) => (m, key, val) => update((s) => setMes(s, m, (x) => { if (val === undefined || val === null) delete x[grupo][key]; else x[grupo][key] = E.r2(val); }));
    const upsert = (list) => (item) => update((s) => {
      const arr = s.config[list] || [];
      const i = arr.findIndex((x) => x.id === item.id);
      return { ...s, config: { ...s.config, [list]: i >= 0 ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item] } };
    });
    const remove = (list) => (id) => update((s) => ({ ...s, config: { ...s.config, [list]: (s.config[list] || []).filter((x) => x.id !== id) } }));
    return {
      setReal: setField('reales'),
      setSaldo: setField('saldos'),
      setReparto: setField('reparto'),
      setAportacion: setField('aportaciones'),
      confirmarVarios: (m, pares) => update((s) => setMes(s, m, (x) => { pares.forEach(([k, v]) => { x.reales[k] = E.r2(v); }); })),
      upsertMov: (item) => update((s) => {
        const i = s.movimientos.findIndex((x) => x.id === item.id);
        return { ...s, movimientos: i >= 0 ? s.movimientos.map((x) => (x.id === item.id ? item : x)) : [...s.movimientos, item] };
      }),
      deleteMov: (id) => update((s) => ({ ...s, movimientos: s.movimientos.filter((x) => x.id !== id) })),
      upsertCuenta: upsert('cuentas'), deleteCuenta: remove('cuentas'),
      upsertTarjeta: upsert('tarjetas'), deleteTarjeta: remove('tarjetas'),
      upsertCredito: upsert('creditos'), deleteCredito: remove('creditos'),
      upsertObjetivo: upsert('objetivos'), deleteObjetivo: remove('objetivos'),
      setMesInicio: (m) => update((s) => ({ ...s, config: { ...s.config, mesInicio: m } })),
      transformar: (fn) => update(fn),
    };
  }, [update]);

  const pendientes = useMemo(() => (state ? E.resumenMes(state, mk).pendientes : 0), [state, mk]);

  if (fase === 'cargando') return <div className="loading"><div style={{ display: 'grid', placeItems: 'center', gap: 10 }}><div className="spin" /><span>Cargando tus finanzas…</span></div></div>;
  if (!state) return <Bienvenida fase={fase} onStart={replaceAll} />;

  const P = PAGES.find((p) => p.key === page) || PAGES[0];
  const ctx = { state, mk, setMk, A, go, focus, setFocus };
  const MonthSwitch = ({ compact }) => (
    <div className={compact ? 'row' : 'monthbox'} style={compact ? { gap: 4 } : undefined}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 4 }}>
        <button className="icon-btn" onClick={() => setMk(E.addMonths(mk, -1))} disabled={mk <= inicio} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
        <div className="mlabel" style={{ minWidth: compact ? 130 : 0, flex: 1 }}>{E.mkLabel(mk)}</div>
        <button className="icon-btn" onClick={() => setMk(E.addMonths(mk, 1))} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
      </div>
      {!compact && (
        <div className="chipnav">
          <button className={mk === hoyMk() ? 'on' : ''} onClick={() => setMk(hoyMk())}>Este mes</button>
          <button className={mk === E.addMonths(hoyMk(), 1) ? 'on' : ''} onClick={() => setMk(E.addMonths(hoyMk(), 1))}>El siguiente</button>
        </div>
      )}
    </div>
  );
  const SaveState = () => (
    <div className={`savestate ${guardado.estado === 'error' ? 'err' : guardado.estado === 'guardando' ? 'busy' : 'ok'}`} title={guardado.mensaje}>
      <span className="dot" />
      {fase === 'sin-db' || !store.hasDb() ? 'Sin guardado automático aquí' : guardado.estado === 'error' ? guardado.mensaje : guardado.estado === 'guardando' ? 'Guardando…' : 'Todo guardado'}
    </div>
  );

  return (
    <div className="shell">
      <aside className="side" aria-label="Navegación">
        <div className="brand">
          <div className="brand-mark">GA</div>
          <div><div className="brand-name">Finanzas</div><div className="brand-sub">Familia García Naranjo</div></div>
        </div>
        <MonthSwitch />
        <nav className="nav">
          {PAGES.map((p) => {
            const I = p.icon;
            return (
              <button key={p.key} className={`${page === p.key ? 'on' : ''} ${p.destacado ? 'hl' : ''}`} onClick={() => go(p.key)} aria-current={page === p.key ? 'page' : undefined}>
                <I size={18} /> {p.label}
                {p.key === 'mes' && pendientes > 0 && <span className="badge">{pendientes}</span>}
              </button>
            );
          })}
        </nav>
        <div className="side-foot">
          <SaveState />
          <button className="side-btn" onClick={() => setBackup(true)}><Save size={16} /> Copia de seguridad</button>
        </div>
      </aside>

      <header className="topbar">
        <div className="brand-mark" style={{ width: 32, height: 32, fontSize: '.9rem' }}>GA</div>
        <MonthSwitch compact />
        <button className="icon-btn" onClick={() => setBackup(true)} aria-label="Copia de seguridad"><Save size={18} /></button>
      </header>

      <main className="main" id="main">
        <P.C {...ctx} />
      </main>

      <nav className="tabbar" aria-label="Secciones">
        {TAB_MOVIL.map((k) => {
          const p = PAGES.find((x) => x.key === k); const I = p.icon;
          return <button key={k} className={page === k ? 'on' : ''} onClick={() => go(k)}><I size={20} />{p.short || p.label}</button>;
        })}
        <button className={!TAB_MOVIL.includes(page) ? 'on' : ''} onClick={() => setMore(true)}><MoreHorizontal size={20} />Más</button>
      </nav>

      {more && (
        <div className="more-sheet" onMouseDown={(e) => { if (e.target === e.currentTarget) setMore(false); }}>
          <div className="panel">
            {PAGES.filter((p) => !TAB_MOVIL.includes(p.key)).map((p) => { const I = p.icon; return <button key={p.key} onClick={() => go(p.key)}><I size={19} /> {p.label}</button>; })}
            <button onClick={() => { setMore(false); setBackup(true); }}><Save size={19} /> Copia de seguridad</button>
          </div>
        </div>
      )}

      <CopiaSeguridad open={backup} onClose={() => setBackup(false)} state={state} guardado={guardado} hasDb={store.hasDb()} onRestore={(s) => { replaceAll(s); setBackup(false); }} />
    </div>
  );
}

/* ---------- copia de seguridad ---------- */
function leerCopia(texto, actual) {
  const d = JSON.parse(texto);
  if (d && d.config && Array.isArray(d.movimientos)) return { config: d.config, movimientos: d.movimientos, meses: d.meses || {}, extractos: d.extractos || {} };
  if (E.esCopiaV1(d)) {
    const base = actual || { config: { version: 2, mesInicio: '2026-09', cuentas: [], tarjetas: [], creditos: [], objetivos: [] }, movimientos: [], meses: {} };
    return E.migrarV1(d, base);
  }
  throw new Error('formato');
}

function CopiaSeguridad({ open, onClose, state, hasDb, onRestore }) {
  const [msg, setMsg] = useState('');
  const [pendiente, setPendiente] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => { if (open) { setMsg(''); setPendiente(null); } }, [open]);
  const descargar = async () => {
    setMsg('');
    let dl = null;
    try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
    if (!dl) { setMsg('Aquí no se pueden descargar archivos. Ábrela desde claude.ai para bajar la copia.'); return; }
    const d = new Date();
    try {
      await dl.save({ filename: `finanzas-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`, data: JSON.stringify({ app: 'finanzas-garcia-arteaga', version: 2, fecha: d.toISOString(), ...state }, null, 2) });
      setMsg('Copia descargada.');
    } catch (e) {
      setMsg(e && e.code === 'declined' ? 'Descarga cancelada.' : 'No se pudo descargar la copia.');
    }
  };
  const elegir = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { setPendiente(leerCopia(String(r.result), state)); setMsg(''); }
      catch (err) { setMsg('Ese archivo no es una copia de esta app (ni de la versión anterior).'); }
    };
    r.onerror = () => setMsg('No se pudo leer el archivo.');
    r.readAsText(f);
  };
  return (
    <Drawer open={open} title="Copia de seguridad" onClose={onClose}>
      <p className="ink2">{hasDb ? 'Tus datos se guardan solos en esta app. La copia es un respaldo extra: un archivo que puedes guardar donde quieras.' : 'En esta vista no hay guardado automático. Descarga una copia para no perder los cambios.'}</p>
      <button className="btn primary" onClick={descargar}><Download size={16} /> Descargar copia (.json)</button>
      <div className="note">También puedes restaurar una copia de la app anterior: se convierte sola a las nuevas categorías.</div>
      <button className="btn" onClick={() => fileRef.current && fileRef.current.click()}><Upload size={16} /> Restaurar desde un archivo</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={elegir} />
      {msg && <div className="note">{msg}</div>}
      {pendiente && (
        <div className="stack" style={{ background: 'var(--crit-soft)', padding: 12, borderRadius: 10 }}>
          <div className="row"><FileJson size={18} /><b>Copia lista para restaurar</b></div>
          <div className="small ink2">{pendiente.movimientos.length} movimientos, {pendiente.config.cuentas.length} cuentas, {Object.keys(pendiente.meses).length} meses con datos{pendiente.extractos && Object.keys(pendiente.extractos).length ? `, ${Object.keys(pendiente.extractos).length} extractos` : ''}. Sustituye todo lo que hay ahora.</div>
          <div className="row"><button className="btn" onClick={() => setPendiente(null)}><X size={15} /> Cancelar</button><button className="btn danger solid" onClick={() => onRestore(pendiente)}>Restaurar</button></div>
        </div>
      )}
    </Drawer>
  );
}

function Bienvenida({ fase, onStart }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState('');
  const vacio = () => onStart({ config: { version: 2, mesInicio: hoyMk(), cuentas: [], tarjetas: [], creditos: [], objetivos: [{ id: 'obj-colchon', nombre: 'Colchón de emergencia', tipo: 'colchon', porcentaje: 100, mesesDeseados: 6, ahorradoBase: 0 }] }, movimientos: [], meses: {}, extractos: {} });
  const elegir = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { onStart(leerCopia(String(r.result), null)); } catch (err) { setMsg('Ese archivo no es una copia de esta app.'); } };
    r.readAsText(f);
  };
  return (
    <div className="loading" style={{ padding: 16 }}>
      <div className="card" style={{ maxWidth: 480 }}>
        <div className="brand" style={{ padding: 0 }}><div className="brand-mark">GA</div><div><h2>Finanzas García Naranjo</h2><div className="small muted">{fase === 'sin-db' ? 'Esta vista no tiene guardado automático.' : 'Todavía no hay datos guardados.'}</div></div></div>
        <p className="ink2">Restaura una copia de seguridad o empieza con la app vacía.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={() => fileRef.current && fileRef.current.click()}><Upload size={16} /> Restaurar copia</button>
          <button className="btn" onClick={vacio}>Empezar vacía</button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={elegir} />
        {msg && <div className="formerr">{msg}</div>}
      </div>
    </div>
  );
}

export { App };
