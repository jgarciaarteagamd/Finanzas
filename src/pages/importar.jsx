import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Sparkles, ListChecks, FileText, FileSpreadsheet, Image as ImageIcon, X, Check, Trash2, ArrowRight, AlertTriangle, Square, RotateCcw } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Seg, Empty } from '../ui.jsx';
import { colorArea } from './shared.jsx';
import { leerArchivo, tipoArchivo } from '../importar/leer.js';
import { analizar, MENSAJES_ERROR } from '../importar/ia.js';
import * as P from '../importar/propuestas.js';

const ORDEN_GRUPOS = ['Saldos', 'Importes reales del mes', 'Créditos', 'Datos en blanco y estimados', 'Nuevos en tu configuración'];
const ICONO_TIPO = { pdf: FileText, excel: FileSpreadsheet, texto: FileSpreadsheet, imagen: ImageIcon };
const ACCEPT = '.pdf,.xlsx,.xls,.xlsm,.ods,.csv,.txt,.tsv,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

export function ImportarPage({ state, mk, setMk, A, go }) {
  const [sample, setSample] = useState(undefined); // undefined: comprobando · null: no disponible
  const [cola, setCola] = useState([]);
  const [fase, setFase] = useState('inicio'); // inicio | leyendo | revisar | hecho
  const [paso, setPaso] = useState('');
  const [error, setError] = useState('');
  const [origenSel, setOrigenSel] = useState('auto');
  const [pista, setPista] = useState('');
  const [b, setB] = useState(null);
  const [sel, setSel] = useState({});
  const [resultado, setResultado] = useState(null);
  const ctlRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let vivo = true;
    (async () => {
      let s = null;
      try { s = window.claude && window.claude.use ? await window.claude.use('sample') : null; } catch (e) { s = null; }
      if (vivo) setSample(() => (typeof s === 'function' ? s : null)); // es una función: no pasarla directa a setState
    })();
    return () => { vivo = false; if (ctlRef.current) ctlRef.current.abort(); };
  }, []);

  const procesar = async (file) => {
    setError(''); setFase('leyendo'); setPaso('Abriendo el archivo…'); setB(null); setSel({});
    const ctl = new AbortController(); ctlRef.current = ctl;
    try {
      const leido = await leerArchivo(file, (t) => setPaso(t), ctl.signal);
      if (ctl.signal.aborted) return;
      const analisis = await analizar({
        sample, state: stateRef.current, leido, signal: ctl.signal,
        pista: [pista.trim(), origenSel !== 'auto' ? `Este extracto es de: ${origenSel.startsWith('tarjeta:') ? `la tarjeta ${E.nombreTarjeta(stateRef.current, origenSel.slice(8))} (${origenSel.slice(8)})` : `la cuenta ${E.nombreCuenta(stateRef.current, origenSel.slice(7))} (${origenSel.slice(7)})`}.` : ''].filter(Boolean).join(' '),
        onPaso: (p) => setPaso(typeof p === 'string' ? p : p.texto),
      });
      if (!analisis.movs.length) {
        setError(analisis.avisos[0] ? `La IA no encontró movimientos: ${analisis.avisos[0]}` : 'La IA no encontró movimientos en este archivo. ¿Es un extracto de cuenta o de tarjeta?');
        setFase('inicio'); return;
      }
      const borr = P.borrador(stateRef.current, analisis, { archivo: file.name, mkSel: mk, forzarOrigen: origenSel !== 'auto' ? origenSel : null });
      setB(borr); setFase('revisar');
    } catch (e) {
      if ((e && e.code === 'cancelled') || (e && e.name === 'AbortError')) { setFase('inicio'); return; }
      const code = e && e.code;
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled') setSample(null);
      setError((code && MENSAJES_ERROR[code]) || (e && e.message && !code ? e.message : 'Algo falló al leer el extracto. Prueba de nuevo.'));
      setFase('inicio');
    }
  };

  const elegirArchivos = (lista) => {
    const files = [...lista].filter(Boolean);
    if (!files.length) return;
    const malos = files.filter((f) => !tipoArchivo(f) || tipoArchivo(f) === 'heic');
    if (malos.length === files.length) { setError(tipoArchivo(malos[0]) === 'heic' ? MENSAJES_ERROR.heic || 'Las fotos HEIC no se pueden leer aquí: haz una captura (PNG) o expórtala como JPG.' : 'Formato no admitido. Usa PDF, Excel, CSV o una imagen (JPG/PNG).'); return; }
    const buenos = files.filter((f) => !malos.includes(f));
    setCola(buenos.slice(1));
    procesar(buenos[0]);
  };

  const siguiente = () => {
    const [f, ...resto] = cola;
    setCola(resto); setResultado(null);
    if (f) procesar(f); else setFase('inicio');
  };

  const propuestas = useMemo(() => (b ? P.propuestas(state, b) : []), [state, b]);
  const aplicar = () => {
    let res = null;
    A.transformar((s) => { res = P.aplicar(s, b, sel); return res.state; });
    setResultado({ ...res, archivo: b.archivo, props: propuestas.filter((p) => (sel[p.id] === undefined ? p.def : sel[p.id])) });
    setB(null); setFase('hecho');
  };

  return (
    <div className="page">
      <PageHead title="Importar extractos" lead="Sube el extracto de una cuenta o de una tarjeta de crédito (PDF, Excel, CSV o una foto). La IA lee los movimientos, los relaciona con lo que tienes configurado y te propone los cambios. No se guarda nada hasta que lo apruebes." />

      {sample === null && (
        <div className="banner"><AlertTriangle size={18} /><span><b>La lectura con IA no está disponible en esta vista.</b> Abre la app dentro de Claude (claude.ai o la app) y acepta el permiso para que use Claude cuando te lo pida.</span></div>
      )}

      {fase === 'inicio' && (
        <>
          <Subida disabled={!sample} onFiles={elegirArchivos} state={state} origenSel={origenSel} setOrigenSel={setOrigenSel} pista={pista} setPista={setPista} />
          {error && <div className="formerr" role="alert">{error}</div>}
          <Importados state={state} A={A} setMk={setMk} go={go} />
        </>
      )}

      {fase === 'leyendo' && (
        <Card>
          <div className="reading">
            <div className="spin" />
            <div className="grow">
              <div style={{ fontWeight: 800 }}>{paso || 'Leyendo…'}</div>
              <div className="small muted">La IA suele tardar entre 20 segundos y un par de minutos según lo largo que sea el extracto. La primera vez, Claude te pedirá permiso.</div>
            </div>
            <button className="btn" onClick={() => ctlRef.current && ctlRef.current.abort()}><Square size={14} /> Parar</button>
          </div>
        </Card>
      )}

      {fase === 'revisar' && b && (
        <Revision state={state} b={b} setB={setB} sel={sel} setSel={setSel} propuestas={propuestas}
          onDescartar={() => { setB(null); if (cola.length) siguiente(); else setFase('inicio'); }} onAplicar={aplicar} cola={cola} />
      )}

      {fase === 'hecho' && resultado && (
        <Hecho r={resultado} state={state} cola={cola} onSiguiente={siguiente} onOtro={() => { setResultado(null); setFase('inicio'); }}
          onVer={(p, m) => { if (m) setMk(m); go(p); }} />
      )}
    </div>
  );
}

/* ---------- 1. subir ---------- */
function Subida({ disabled, onFiles, state, origenSel, setOrigenSel, pista, setPista }) {
  const [over, setOver] = useState(false);
  const ref = useRef(null);
  return (
    <div className="grid">
      <Card className="c8">
        <div className={`dropzone ${over ? 'over' : ''} ${disabled ? 'dis' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(e.dataTransfer.files); }}>
          <span className="dz-ico"><FileUp size={26} /></span>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Arrastra aquí el extracto</div>
          <div className="small muted">PDF del banco, Excel o CSV descargado de la web, o una foto/captura. Puedes subir varios a la vez.</div>
          <button className="btn primary" disabled={disabled} onClick={() => ref.current && ref.current.click()}><FileUp size={16} /> Elegir archivos</button>
          <input ref={ref} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { const f = e.target.files; onFiles(f); e.target.value = ''; }} />
        </div>
        <div className="two">
          <label className="field"><span>¿De qué es?</span>
            <select className="in-ctl" value={origenSel} onChange={(e) => setOrigenSel(e.target.value)}>
              <option value="auto">Que lo detecte la IA</option>
              <optgroup label="Cuentas">{(state.config.cuentas || []).map((c) => <option key={c.id} value={`cuenta:${c.id}`}>{c.nombre}</option>)}</optgroup>
              <optgroup label="Tarjetas de crédito">{(state.config.tarjetas || []).map((t) => <option key={t.id} value={`tarjeta:${t.id}`}>{t.nombre}</option>)}</optgroup>
            </select>
          </label>
          <label className="field"><span>Nota para la IA (opcional)</span>
            <input className="in-ctl" value={pista} placeholder="Ej.: los Bizum de Sara son traspasos" onChange={(e) => setPista(e.target.value)} />
          </label>
        </div>
      </Card>
      <Card className="c4" title="Cómo funciona">
        <ol className="howto">
          <li><span className="hn"><FileUp size={15} /></span><div><b>Subes el extracto</b><div className="small muted">Se lee en tu navegador; el archivo no se guarda.</div></div></li>
          <li><span className="hn"><Sparkles size={15} /></span><div><b>La IA lo interpreta</b><div className="small muted">Detecta cuenta o tarjeta, categoriza cada movimiento y lo empareja con tus gastos, ingresos, tarjetas y créditos.</div></div></li>
          <li><span className="hn"><ListChecks size={15} /></span><div><b>Tú revisas y apruebas</b><div className="small muted">Importes reales, saldos, créditos nuevos o cambiados y datos que faltaban. Puedes deshacerlo después.</div></div></li>
        </ol>
        <div className="tiny muted">El texto del extracto se envía a Claude para analizarlo y usa tu propio plan. Se guardan solo fecha, concepto, importe y categoría de cada movimiento; nunca números de cuenta o tarjeta.</div>
      </Card>
    </div>
  );
}

/* ---------- 2. revisar ---------- */
function Revision({ state, b, setB, sel, setSel, propuestas, onDescartar, onAplicar, cola }) {
  const [filtro, setFiltro] = useState('todos');
  const ds = useMemo(() => P.destinos(state, b), [state, b]);
  const esTarjeta = b.origen.tipo === 'tarjeta';
  const on = (p) => (sel[p.id] === undefined ? p.def : sel[p.id]);
  const setItem = (uid, patch) => setB((x) => ({ ...x, items: x.items.map((it) => (it.uid === uid ? { ...it, ...patch } : it)) }));

  const validos = ds.filter((d) => !d.dup && !d.anterior);
  const cuentan = validos.filter((d) => d.it.destino !== 'ignorar');
  const salen = cuentan.filter((d) => d.it.signo === 'gasto').reduce((s, d) => s + d.it.importe, 0);
  const entran = cuentan.filter((d) => d.it.signo === 'ingreso').reduce((s, d) => s + d.it.importe, 0);
  const dups = ds.filter((d) => d.dup).length;
  const anteriores = ds.filter((d) => d.anterior && !d.dup).length;
  const mks = [...new Set(validos.map((d) => d.mk))].sort();
  const sinOrigen = !b.origen.id || (b.origen.id === P.NUEVA && !String(b.origen.nuevo.nombre || '').trim());
  const nSel = propuestas.filter(on).length;

  const visibles = ds.filter((d) => {
    if (filtro === 'sin') return !d.dup && !d.anterior && d.it.destino === 'puntual';
    if (filtro === 'emp') return !d.dup && !d.anterior && d.it.destino === 'linea';
    if (filtro === 'no') return d.dup || d.anterior || d.it.destino === 'ignorar';
    return true;
  });
  const grupos = ORDEN_GRUPOS.map((g) => ({ g, ps: propuestas.filter((p) => p.grupo === g) })).filter((x) => x.ps.length);

  const setOrigen = (v) => {
    if (v === `nueva:cuenta` || v === `nueva:tarjeta`) setB((x) => ({ ...x, origen: { ...x.origen, tipo: v.split(':')[1], id: P.NUEVA } }));
    else { const [t, id] = v.split(':'); setB((x) => ({ ...x, origen: { ...x.origen, tipo: t, id } })); }
    setSel({});
  };
  const origenVal = b.origen.id === P.NUEVA ? `nueva:${b.origen.tipo}` : b.origen.id ? `${b.origen.tipo}:${b.origen.id}` : '';
  const mesesCargo = E.range(E.addMonths(state.config.mesInicio || b.mkTarjeta, 0), 16);
  const totalDecl = esTarjeta && b.doc.totalCargo;
  const netoTarjeta = salen - entran;

  return (
    <>
      <Card title={<span className="row" style={{ gap: 8 }}><FileText size={18} style={{ color: 'var(--brand)' }} />{b.archivo}</span>}
        sub={[b.doc.entidad, b.doc.producto, b.doc.desde && b.doc.hasta ? `del ${fechaCorta(b.doc.desde)} al ${fechaCorta(b.doc.hasta)}` : null].filter(Boolean).join(' · ') || 'Extracto'}
        actions={<button className="btn" onClick={onDescartar}><X size={15} /> Descartar</button>}>
        <div className="grid" style={{ gap: 14 }}>
          <label className="field c6"><span>Es el extracto de…</span>
            <select className={`in-ctl ${sinOrigen ? 'need' : ''}`} value={origenVal} onChange={(e) => setOrigen(e.target.value)}>
              {!b.origen.id && <option value="">Elige la cuenta o tarjeta</option>}
              <optgroup label="Cuentas">{(state.config.cuentas || []).map((c) => <option key={c.id} value={`cuenta:${c.id}`}>{c.nombre}</option>)}<option value="nueva:cuenta">+ Crear cuenta nueva…</option></optgroup>
              <optgroup label="Tarjetas de crédito">{(state.config.tarjetas || []).map((t) => <option key={t.id} value={`tarjeta:${t.id}`}>{t.nombre}</option>)}<option value="nueva:tarjeta">+ Crear tarjeta nueva…</option></optgroup>
            </select>
          </label>
          {esTarjeta ? (
            <label className="field c6"><span>Mes en que se carga en la cuenta</span>
              <select className="in-ctl" value={b.mkTarjeta} onChange={(e) => { const v = e.target.value; setB((x) => ({ ...x, mkTarjeta: v })); }}>
                {[...new Set([b.mkTarjeta, ...mesesCargo])].sort().map((m) => <option key={m} value={m}>{E.mkLabel(m)}</option>)}
              </select>
            </label>
          ) : (
            <div className="field c6"><span>Meses que cubre</span><div className="row wrap" style={{ gap: 6, minHeight: 38 }}>{mks.map((m) => <span key={m} className="pill brand">{E.mkLabel(m)}</span>)}</div></div>
          )}
          {b.origen.id === P.NUEVA && (
            <>
              <label className="field c6"><span>Nombre de la {esTarjeta ? 'tarjeta' : 'cuenta'}</span>
                <input className="in-ctl" value={b.origen.nuevo.nombre} onChange={(e) => { const v = e.target.value; setB((x) => ({ ...x, origen: { ...x.origen, nuevo: { ...x.origen.nuevo, nombre: v } } })); }} /></label>
              {esTarjeta ? (
                <label className="field c6"><span>Se carga en</span>
                  <select className="in-ctl" value={b.origen.nuevo.cuentaDebitoId} onChange={(e) => { const v = e.target.value; setB((x) => ({ ...x, origen: { ...x.origen, nuevo: { ...x.origen.nuevo, cuentaDebitoId: v } } })); }}>
                    <option value="">Elige la cuenta</option>
                    {(state.config.cuentas || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select></label>
              ) : (
                <label className="field c6"><span>Titular</span>
                  <input className="in-ctl" value={b.origen.nuevo.titular} onChange={(e) => { const v = e.target.value; setB((x) => ({ ...x, origen: { ...x.origen, nuevo: { ...x.origen.nuevo, titular: v } } })); }} /></label>
              )}
            </>
          )}
        </div>
        <div className="sumrow">
          <div><div className="eyebrow">Movimientos</div><div className="v">{validos.length}</div></div>
          <div><div className="eyebrow">{esTarjeta ? 'Compras' : 'Salen'}</div><div className="v" style={{ color: 'var(--out)' }}>{E.eur(salen)}</div></div>
          <div><div className="eyebrow">{esTarjeta ? 'Abonos' : 'Entran'}</div><div className="v" style={{ color: 'var(--in)' }}>{E.eur(entran)}</div></div>
          <div><div className="eyebrow">Emparejados</div><div className="v">{validos.filter((d) => d.it.destino === 'linea').length} <span className="small muted">de {validos.length}</span></div></div>
        </div>
        {totalDecl ? (
          Math.abs(totalDecl - netoTarjeta) < 0.5
            ? <div className="small" style={{ color: 'var(--ok)', fontWeight: 700 }}><Check size={14} style={{ verticalAlign: '-2px' }} /> Cuadra con el total del extracto: {E.eur(totalDecl)}</div>
            : <div className="note">El extracto indica <b>{E.eur(totalDecl)}</b> a cargar, y los movimientos que cuentan suman <b>{E.eur(netoTarjeta)}</b>. Revisa si falta alguno o si hay pagos o saldos anteriores.</div>
        ) : null}
        {(dups > 0 || anteriores > 0) && <div className="note">{dups > 0 && <span>{dups} movimientos ya estaban importados y no se repiten. </span>}{anteriores > 0 && <span>{anteriores} son de antes de {E.mkLabel(state.config.mesInicio).toLowerCase()}, cuando empieza la app, y no se importan.</span>}</div>}
        {b.avisos.map((a, i) => <div key={i} className="note"><b>Nota de la IA:</b> {a}</div>)}
      </Card>

      {sinOrigen ? (
        <div className="banner"><AlertTriangle size={18} /><span>Elige de qué cuenta o tarjeta es el extracto para ver los cambios propuestos.</span></div>
      ) : (
        <Card title="Cambios que se van a aplicar" sub="Desmarca lo que no quieras. Los importes reales salen de sumar los movimientos emparejados con cada línea.">
          {grupos.length === 0 && <div className="small muted">Solo se guardarán los movimientos; no hay otros cambios que proponer.</div>}
          <div className="propgroups">
            {grupos.map(({ g, ps }) => (
              <div key={g} className="stack" style={{ gap: 6 }}>
                <div className="row between"><div className="eyebrow">{g}</div>
                  <button className="btn ghost sm" onClick={() => { const todos = ps.every(on); setSel((s) => ({ ...s, ...Object.fromEntries(ps.map((p) => [p.id, !todos])) })); }}>{ps.every(on) ? 'Quitar todos' : 'Marcar todos'}</button>
                </div>
                {ps.map((p) => (
                  <label key={p.id} className={`prop ${on(p) ? 'on' : ''}`}>
                    <input type="checkbox" checked={on(p)} onChange={(e) => { const v = e.target.checked; setSel((s) => ({ ...s, [p.id]: v })); }} />
                    <span className="pbox"><Check size={13} strokeWidth={3} /></span>
                    <span className="grow"><span className="pt">{p.titulo}</span><span className="pd">{p.detalle}</span></span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Movimientos del extracto" sub={esTarjeta ? 'Cada compra, con su categoría. Así la app sabe a dónde se va lo que pagas con la tarjeta.' : 'Los emparejados confirman tus líneas previstas; los sueltos cuentan como gasto o ingreso real del mes.'}
        actions={<Seg value={filtro} onChange={setFiltro} ariaLabel="Filtrar movimientos" options={[{ key: 'todos', label: `Todos (${ds.length})` }, { key: 'emp', label: 'Emparejados' }, { key: 'sin', label: 'Sueltos' }, { key: 'no', label: 'No cuentan' }]} />}>
        <div className="movs">
          <div className="mov head hide-sm"><span>Fecha</span><span>Concepto</span><span className="n">Importe</span><span>Categoría</span><span>Cuenta como</span></div>
          {visibles.map((d) => <FilaMov key={d.it.uid} d={d} state={state} b={b} setItem={setItem} esTarjeta={esTarjeta} />)}
          {visibles.length === 0 && <div className="small muted" style={{ padding: 12 }}>Nada en este filtro.</div>}
        </div>
      </Card>

      <div className="applybar">
        <div className="small">
          <b>{validos.length} movimientos</b> y <b>{nSel} cambios</b>{mks.length ? ` en ${mks.map((m) => E.mkLabel(m).toLowerCase()).join(', ')}` : ''}.
          {cola.length > 0 && <span className="muted"> Después: {cola.length} archivo{cola.length > 1 ? 's' : ''} más.</span>}
        </div>
        <div className="row">
          <button className="btn" onClick={onDescartar}>Descartar</button>
          <button className="btn primary" disabled={sinOrigen || validos.length === 0} onClick={onAplicar}><Check size={16} /> Aplicar y guardar</button>
        </div>
      </div>
    </>
  );
}

function FilaMov({ d, state, b, setItem, esTarjeta }) {
  const { it } = d;
  const bloqueado = d.dup || d.anterior;
  const off = bloqueado || it.destino === 'ignorar';
  const opciones = useMemo(() => opcionesLinea(state, b, it.signo), [state, b.origen, b.creditosIA, it.signo]);
  const valor = it.destino === 'linea' && it.linea ? `l:${it.linea}` : it.destino;
  const subs = useMemo(() => [...new Set(state.movimientos.filter((x) => x.area === it.area && x.sub).map((x) => x.sub))], [state.movimientos, it.area]);
  const cambiar = (v) => {
    if (v === 'puntual' || v === 'ignorar') { setItem(it.uid, { destino: v, linea: null }); return; }
    if (v.startsWith('c:')) { const mov = state.movimientos.find((x) => x.id === v.slice(2)); setItem(it.uid, { destino: 'puntual', linea: null, area: mov.area || 'otros', sub: mov.sub || '' }); return; }
    const key = v.slice(2);
    const mov = state.movimientos.find((x) => x.id === key);
    setItem(it.uid, { destino: 'linea', linea: key, ...(mov && mov.area ? { area: mov.area, sub: mov.sub || '' } : key.startsWith('credito') || key.startsWith('nuevo_credito') ? { area: 'creditos' } : {}) });
  };
  return (
    <div className={`mov ${off ? 'off' : ''}`}>
      <span className="f num">{fechaCorta(it.fecha)}</span>
      <span className="c">
        <b>{E.nombreItem(it)}</b>
        {it.comercio && it.concepto && <span className="tiny muted">{it.concepto}</span>}
        {d.dup && <span className="pill neutral">Ya importado</span>}
        {d.anterior && !d.dup && <span className="pill neutral">Antes del inicio</span>}
        {!bloqueado && it.recurrente && it.destino === 'puntual' && <span className="pill info">Parece recurrente</span>}
      </span>
      <span className={`i num ${it.signo === 'ingreso' ? 'pos' : ''}`}>{it.signo === 'ingreso' ? '+' : '−'}{E.eur(it.importe)}</span>
      <span className="a">
        <span className="swatch" style={{ background: colorArea(it.area) }} />
        <select className="sel-sm" aria-label="Categoría" disabled={bloqueado || (it.destino === 'linea' && state.movimientos.some((x) => x.id === it.linea))} value={it.area} onChange={(e) => setItem(it.uid, { area: e.target.value })}>
          {E.AREAS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
        <input className="sel-sm sub" aria-label="Subcategoría" disabled={bloqueado} value={it.sub || ''} placeholder="Subcategoría" list={`subs-${it.area}`} onChange={(e) => setItem(it.uid, { sub: e.target.value })} />
        <datalist id={`subs-${it.area}`}>{subs.map((s) => <option key={s} value={s} />)}</datalist>
      </span>
      <span className="l">
        <select className={`sel-sm ${it.destino === 'linea' ? 'linked' : ''}`} aria-label="Cuenta como" disabled={bloqueado} value={valor} onChange={(e) => cambiar(e.target.value)}>
          <option value="puntual">{it.signo === 'ingreso' ? (esTarjeta ? 'Abono o devolución' : 'Ingreso suelto del mes') : esTarjeta ? 'Compra sin prever' : 'Gasto suelto del mes'}</option>
          <option value="ignorar">No contar (traspaso, pago de la tarjeta…)</option>
          {opciones.map((g) => (
            <optgroup key={g.label} label={g.label}>{g.items.map((o) => <option key={o.key} value={`${o.clasificar ? 'c' : 'l'}:${o.key}`}>{o.nombre}</option>)}</optgroup>
          ))}
        </select>
      </span>
    </div>
  );
}

function opcionesLinea(state, b, signo) {
  const esTarjeta = b.origen.tipo === 'tarjeta';
  const movs = state.movimientos.filter((x) => x.frecuencia !== 'esporadico');
  const g = [];
  if (!esTarjeta) {
    const ing = movs.filter((x) => x.tipo === 'ingreso');
    const gas = movs.filter((x) => x.tipo === 'gasto' && x.medio !== 'tarjeta');
    const tar = (state.config.tarjetas || []).map((t) => ({ key: `tarjeta:${t.id}`, nombre: `Cargo de ${t.nombre}` }));
    const cre = [...(state.config.creditos || []).map((c) => ({ key: `credito:${c.id}`, nombre: `Cuota ${c.nombre}` })),
      ...b.creditosIA.filter((c) => !c.id && c.cuota).map((c) => ({ key: `nuevo_credito:${c.n}`, nombre: `Cuota ${c.nombre || 'crédito nuevo'} (nuevo)` }))];
    const lista = signo === 'ingreso'
      ? [{ label: 'Ingresos previstos', items: ing.map((x) => ({ key: x.id, nombre: x.nombre })) }, { label: 'Devolución de un gasto', items: gas.map((x) => ({ key: x.id, nombre: x.nombre })) }]
      : [{ label: 'Gastos previstos', items: gas.map((x) => ({ key: x.id, nombre: x.nombre })) }, { label: 'Cargo de tarjeta', items: tar }, { label: 'Cuotas de créditos', items: cre }, { label: 'Gasto suelto, con la categoría de…', items: movs.filter((x) => x.tipo === 'gasto' && x.medio === 'tarjeta').map((x) => ({ key: x.id, nombre: x.nombre, clasificar: true })) }];
    lista.forEach((x) => { if (x.items.length) g.push(x); });
  } else {
    const propios = movs.filter((x) => x.tipo === 'gasto' && x.medio === 'tarjeta' && x.tarjetaId === b.origen.id);
    const otros = movs.filter((x) => x.tipo === 'gasto' && !propios.includes(x));
    if (propios.length) g.push({ label: 'Gastos previstos en esta tarjeta', items: propios.map((x) => ({ key: x.id, nombre: x.nombre })) });
    if (otros.length) g.push({ label: 'Otros gastos previstos', items: otros.map((x) => ({ key: x.id, nombre: x.nombre })) });
  }
  return g;
}

/* ---------- 3. hecho ---------- */
function Hecho({ r, state, cola, onSiguiente, onOtro, onVer }) {
  const cuenta = (t) => r.props.filter((p) => p.tipo === t).length;
  const nMovs = r.nuevos || 0;
  const lineas = [
    `${nMovs} movimientos guardados en ${r.mks.map((m) => E.mkLabel(m).toLowerCase()).join(', ') || 'la app'}`,
    cuenta('real') && `${cuenta('real')} importes reales confirmados`,
    cuenta('saldo') && `${cuenta('saldo')} saldo${cuenta('saldo') > 1 ? 's' : ''} de inicio de mes`,
    r.creados.creditos && `${r.creados.creditos} crédito${r.creados.creditos > 1 ? 's' : ''} nuevo${r.creados.creditos > 1 ? 's' : ''}`,
    cuenta('credito-mod') && `${cuenta('credito-mod')} crédito${cuenta('credito-mod') > 1 ? 's' : ''} actualizado${cuenta('credito-mod') > 1 ? 's' : ''}`,
    cuenta('estimado') && `${cuenta('estimado')} estimado${cuenta('estimado') > 1 ? 's' : ''} actualizado${cuenta('estimado') > 1 ? 's' : ''}`,
    r.creados.movimientos && `${r.creados.movimientos} gasto${r.creados.movimientos > 1 ? 's' : ''} o ingreso${r.creados.movimientos > 1 ? 's' : ''} mensual${r.creados.movimientos > 1 ? 'es' : ''} nuevo${r.creados.movimientos > 1 ? 's' : ''}`,
    r.creados.cuentas && 'una cuenta nueva', r.creados.tarjetas && 'una tarjeta nueva',
  ].filter(Boolean);
  return (
    <Card>
      <div className="done-h"><span className="ok-ico"><Check size={22} strokeWidth={3} /></span><div><h2>Extracto aplicado</h2><div className="small muted">{r.archivo}</div></div></div>
      <ul className="donelist">{lineas.map((l) => <li key={l}>{l}</li>)}</ul>
      <div className="row wrap">
        {cola.length > 0 && <button className="btn primary" onClick={onSiguiente}>Siguiente archivo: {cola[0].name} <ArrowRight size={15} /></button>}
        <button className={`btn ${cola.length ? '' : 'primary'}`} onClick={() => onVer('mes', r.mks[0])}>Ver el mes</button>
        <button className="btn" onClick={() => onVer('gastos', r.mks[0])}>Ver a dónde se fue</button>
        <button className="btn ghost" onClick={onOtro}>Subir otro</button>
      </div>
    </Card>
  );
}

/* ---------- extractos ya importados ---------- */
function Importados({ state, A, setMk, go }) {
  const [borrar, setBorrar] = useState(null);
  const lista = Object.values(state.extractos || {}).sort((a, b) => (b.mk + (b.importadoEn || '')).localeCompare(a.mk + (a.importadoEn || '')));
  if (!lista.length) return <Card title="Extractos importados"><Empty icon={FileText} title="Todavía no has importado ningún extracto">Cuando lo hagas, aparecerán aquí por mes. Puedes quitar cualquiera y sus importes vuelven a como estaban.</Empty></Card>;
  return (
    <Card title="Extractos importados" sub="Si quitas uno, se borran sus movimientos y los importes reales y saldos que puso vuelven a como estaban. Los créditos o gastos que creó se quedan.">
      <div className="stack" style={{ gap: 8 }}>
        {lista.map((e) => {
          const items = e.items || [];
          const cuentan = items.filter((x) => x.destino !== 'ignorar');
          const total = cuentan.reduce((s, x) => s + (x.signo === 'ingreso' ? -1 : 1) * x.importe, 0);
          const nombre = e.tipo === 'tarjeta' ? E.nombreTarjeta(state, e.tarjetaId) : E.nombreCuenta(state, e.cuentaId);
          return (
            <div key={e.id} className="improw">
              <span className="pill brand">{E.mkLabel(e.mk)}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{nombre}</div>
                <div className="tiny muted">{items.length} movimientos{e.tipo === 'tarjeta' ? ` · ${E.eur(total)} en compras` : ''} · {(e.archivos || []).join(', ')}</div>
              </div>
              <button className="btn ghost sm" onClick={() => { setMk(e.mk); go('mes'); }}>Ver mes</button>
              {borrar === e.id ? (
                <span className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => setBorrar(null)}>No</button>
                  <button className="btn danger solid sm" onClick={() => { A.transformar((s) => P.deshacer(s, e.id)); setBorrar(null); }}><RotateCcw size={13} /> Quitar</button>
                </span>
              ) : <button className="icon-btn" aria-label={`Quitar extracto de ${nombre}`} onClick={() => setBorrar(e.id)}><Trash2 size={16} /></button>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function fechaCorta(f) {
  if (!f) return '';
  const [y, m, d] = f.split('-');
  return `${Number(d)} ${E.MESES_ABREV[Number(m) - 1]}${y !== String(new Date().getFullYear()) ? ` ${y.slice(2)}` : ''}`;
}
