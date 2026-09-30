/* ============================================================
   Del análisis de la IA a cambios concretos en la app.
   - borrador(): prepara los movimientos para revisarlos.
   - propuestas(): lo que se cambiaría (saldos, importes reales,
     créditos, estimados, gastos recurrentes nuevos).
   - aplicar(): devuelve el estado nuevo.
   - deshacer(): quita un extracto importado y revierte sus importes.
   ============================================================ */
import * as E from '../engine.js';

export const NUEVA = '__nueva__';
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const firma = (it) => `${it.fecha}|${it.signo}|${E.r2(it.importe).toFixed(2)}|${norm(it.concepto).slice(0, 24)}`;


/* Intenta reconocer la cuenta o tarjeta del extracto por su nombre. */
function adivinarOrigen(state, doc, tipo) {
  const lista = tipo === 'tarjeta' ? state.config.tarjetas || [] : state.config.cuentas || [];
  const idIA = tipo === 'tarjeta' ? doc.tarjetaId : doc.cuentaId;
  if (idIA && lista.some((x) => x.id === idIA)) return idIA;
  const texto = norm(`${doc.entidad} ${doc.producto} ${doc.titular}`);
  if (!texto) return null;
  let mejor = null, puntos = 0;
  lista.forEach((x) => {
    const pals = norm(x.nombre).split(' ').filter((w) => w.length > 2 && !['de', 'del', 'visa', 'mastercard', 'tarjeta', 'cuenta'].includes(w));
    let p = pals.filter((w) => texto.includes(w)).length;
    if (x.titular && texto.includes(norm(x.titular))) p += 0.5;
    if (p > puntos) { puntos = p; mejor = x.id; }
  });
  return puntos >= 1 ? mejor : null;
}

export function lineasValidas(state) {
  const set = new Set();
  state.movimientos.forEach((x) => { if (x.frecuencia !== 'esporadico') set.add(x.id); });
  (state.config.tarjetas || []).forEach((t) => set.add(`tarjeta:${t.id}`));
  (state.config.creditos || []).forEach((c) => set.add(`credito:${c.id}`));
  return set;
}
export const tipoLineas = (state) => Object.fromEntries(state.movimientos.map((x) => [x.id, x.tipo]));

export function nombreLinea(state, key) {
  if (!key) return '';
  if (key.startsWith('tarjeta:')) return `Cargo de ${E.nombreTarjeta(state, key.slice(8))}`;
  if (key.startsWith('credito:')) return `Cuota ${(state.config.creditos || []).find((c) => c.id === key.slice(8))?.nombre || 'crédito'}`;
  if (key.startsWith('nuevo_credito:')) return 'Crédito nuevo';
  return state.movimientos.find((x) => x.id === key)?.nombre || key;
}

/* ---------- borrador para revisar ---------- */
export function borrador(state, analisis, { archivo, forzarOrigen, mkSel }) {
  const doc = analisis.doc || {};
  let tipo = doc.tipo || (doc.tarjetaId ? 'tarjeta' : 'cuenta');
  let id = null;
  if (forzarOrigen) {
    const [t, i] = forzarOrigen.split(':');
    tipo = t; id = i;
  } else id = adivinarOrigen(state, doc, tipo);

  const validas = lineasValidas(state);
  const creditosIA = (analisis.creditos || []).map((c, n) => {
    let existe = c.id && (state.config.creditos || []).some((x) => x.id === c.id) ? c.id : null;
    if (!existe) {
      // ¿ya está configurado con otro nombre o con la misma cuota?
      const GEN = new Set(['prestamo', 'credito', 'coche', 'personal', 'financiacion', 'cuota', 'tarjeta', 'banco', 'hipoteca', 'consumo', 'recibo', 'pago']);
      const nc = norm(`${c.nombre} ${c.entidad}`).split(' ').filter((w) => w.length > 3 && !GEN.has(w));
      const m = (state.config.creditos || []).find((x) => (c.cuota && Math.abs((Number(x.cuota) || 0) - c.cuota) < 0.01) || nc.some((w) => norm(`${x.nombre} ${x.notas || ''}`).includes(w)));
      if (m) existe = m.id;
    }
    return { ...c, n, id: existe };
  });
  const items = (analisis.movs || []).map((m, n) => {
    const signo = m.i < 0 ? 'gasto' : 'ingreso';
    let linea = m.linea;
    const nc = linea && linea.match(/^nuevo_credito:(\d+)$/);
    if (nc) { const c = creditosIA[Number(nc[1])]; linea = !c ? null : c.id ? `credito:${c.id}` : linea; }
    else if (linea && !validas.has(linea)) linea = null;
    if (tipo === 'tarjeta' && linea && (linea.startsWith('tarjeta:') || linea.startsWith('credito:'))) linea = null;
    let mov = linea && state.movimientos.find((x) => x.id === linea);
    if (mov && mov.tipo !== (signo === 'ingreso' ? 'ingreso' : 'gasto') && m.clase !== 'devolucion') { linea = null; mov = null; }
    // en una cuenta, un gasto que normalmente va con tarjeta solo se clasifica igual
    let clasificarComo = null;
    if (mov && tipo === 'cuenta' && mov.medio === 'tarjeta') { clasificarComo = mov; linea = null; }
    let destino = linea ? 'linea' : 'puntual';
    if (m.clase === 'traspaso') destino = 'ignorar';
    if (tipo === 'tarjeta' && m.clase === 'cargo_tarjeta') { destino = 'ignorar'; linea = null; }
    if (clasificarComo) mov = clasificarComo;
    const area = mov && mov.area ? mov.area : E.categorias(state).some((a) => a.key === m.area) ? m.area : linea && linea.startsWith('credito') ? 'creditos' : 'otros';
    return {
      uid: `m${n}`, fecha: m.fecha, concepto: m.concepto, comercio: m.comercio, importe: E.r2(Math.abs(m.i)), signo, clase: m.clase,
      area, sub: mov ? mov.sub || '' : m.sub, linea: destino === 'linea' ? linea : null, destino, recurrente: m.recurrente, saldo: m.saldo, i: m.i,
    };
  });
  const fechas = items.map((x) => x.fecha).sort();
  const mkTarjeta = (doc.fechaCargo && doc.fechaCargo.slice(0, 7)) || (doc.hasta && doc.hasta.slice(0, 7)) || (fechas.length ? fechas[fechas.length - 1].slice(0, 7) : mkSel);
  return {
    archivo, doc, avisos: analisis.avisos || [], creditosIA, items,
    origen: { tipo, id: id || '', nuevo: { nombre: [doc.entidad, doc.producto].filter(Boolean).join(' ') || (tipo === 'tarjeta' ? 'Tarjeta nueva' : 'Cuenta nueva'), titular: doc.titular || '', cuentaDebitoId: '' } },
    mkTarjeta: mkTarjeta || mkSel,
  };
}

/* A qué documento (mes + cuenta/tarjeta) va cada movimiento. */
export function destinos(state, b) {
  const origenId = b.origen.id === NUEVA ? NUEVA : b.origen.id;
  const inicio = state.config.mesInicio || '2000-01';
  return b.items.map((it) => {
    const mk = b.origen.tipo === 'tarjeta' ? b.mkTarjeta : it.fecha.slice(0, 7);
    const docId = origenId ? E.extractoId(mk, origenId) : null;
    const prev = docId && state.extractos && state.extractos[docId];
    const dup = !!(prev && (prev.items || []).some((x) => firma(x) === firma(it)));
    return { it, mk, docId, dup, anterior: mk < inicio };
  });
}

/* Saldo al empezar cada mes, a partir de los saldos que muestra el extracto. */
function saldosInicio(b) {
  const conSaldo = b.items.filter((x) => x.saldo !== null && x.saldo !== undefined);
  if (conSaldo.length < 1) return {};
  const asc = b.items.length < 2 || b.items[0].fecha <= b.items[b.items.length - 1].fecha;
  const crono = asc ? b.items : [...b.items].reverse();
  const cs = crono.filter((x) => x.saldo !== null && x.saldo !== undefined);
  let ok = 0, pares = 0;
  for (let k = 1; k < cs.length; k++) { pares++; if (Math.abs(cs[k - 1].saldo + cs[k].i - cs[k].saldo) < 0.02) ok++; }
  const fiable = pares === 0 || ok / pares >= 0.7;
  const out = {};
  if (fiable) {
    crono.forEach((x) => {
      const mk = x.fecha.slice(0, 7);
      if (out[mk] !== undefined || x.saldo === null || x.saldo === undefined) return;
      const primeroDelMes = crono.find((y) => y.fecha.slice(0, 7) === mk);
      if (primeroDelMes !== x) return;
      const cubreInicio = (b.doc.desde ? b.doc.desde <= `${mk}-01` : false) || Number(x.fecha.slice(8, 10)) <= 5 || mk > (b.doc.desde || '').slice(0, 7);
      if (cubreInicio) out[mk] = E.r2(x.saldo - x.i);
    });
  }
  if (b.doc.saldoInicial !== null && b.doc.saldoInicial !== undefined && b.doc.desde && b.doc.desde.slice(8, 10) <= '02') {
    const mk = b.doc.desde.slice(0, 7);
    if (out[mk] === undefined) out[mk] = E.r2(b.doc.saldoInicial);
  }
  return out;
}

const grupoRec = (it) => `${it.signo}|${norm(E.nombreItem(it)).slice(0, 30)}`;

/* ---------- propuestas ---------- */
export function propuestas(state, b) {
  const out = [];
  const ds = destinos(state, b).filter((d) => !d.dup && !d.anterior);
  const esCuenta = b.origen.tipo === 'cuenta';
  const origenId = b.origen.id;
  if (!origenId) return out;
  const mks = [...new Set(ds.map((d) => d.mk))].sort();

  // saldos de inicio de mes
  if (esCuenta && origenId !== NUEVA) {
    const si = saldosInicio(b);
    Object.entries(si).forEach(([mk, v]) => {
      if (!mks.includes(mk)) return;
      const actual = state.meses?.[mk]?.saldos?.[origenId];
      if (actual !== undefined && Math.abs(Number(actual) - v) < 0.01) return;
      out.push({ id: `saldo:${mk}`, tipo: 'saldo', grupo: 'Saldos', mk, cuentaId: origenId, valor: v, actual, def: true,
        titulo: `Saldo de ${E.nombreCuenta(state, origenId)} el día 1: ${E.eur(v)}`, detalle: `${E.mkLabel(mk)} · ${actual !== undefined ? `ahora pone ${E.eur(actual)}` : 'ahora está vacío'}` });
    });
  }

  // créditos detectados
  b.creditosIA.forEach((c) => {
    if (c.id) {
      const cur = (state.config.creditos || []).find((x) => x.id === c.id);
      const cambios = {};
      if (c.cuota && Math.abs(c.cuota - (Number(cur.cuota) || 0)) >= 0.01) cambios.cuota = E.r2(c.cuota);
      if (c.fechaFin && c.fechaFin !== cur.fechaFin) cambios.fechaFin = c.fechaFin;
      if (c.capitalPendiente && Math.abs(c.capitalPendiente - (Number(cur.capitalPendiente) || 0)) >= 1) { cambios.capitalPendiente = E.r2(c.capitalPendiente); cambios.fechaCapital = (b.doc.hasta || '').slice(0, 7) || mks[mks.length - 1] || null; }
      if (c.cuotaFinal && Math.abs(c.cuotaFinal - (Number(cur.cuotaFinal) || 0)) >= 1) cambios.cuotaFinal = E.r2(c.cuotaFinal);
      if (!Object.keys(cambios).length) return;
      const txt = [cambios.cuota && `cuota ${E.eur(cur.cuota)} → ${E.eur(cambios.cuota)}`, cambios.fechaFin && `termina en ${E.mkLabel(cambios.fechaFin).toLowerCase()}`, cambios.capitalPendiente && `capital pendiente ${E.eur(cambios.capitalPendiente)}`, cambios.cuotaFinal && `cuota final ${E.eur(cambios.cuotaFinal)}`].filter(Boolean).join(' · ');
      const grande = cambios.cuota && Number(cur.cuota) > 0 && Math.abs(cambios.cuota - cur.cuota) / cur.cuota > 0.15;
      out.push({ id: `cmod:${c.id}`, tipo: 'credito-mod', grupo: 'Créditos', creditoId: c.id, cambios, def: !grande, titulo: `Actualizar ${cur.nombre}`, detalle: txt + (grande ? ' · cambio grande: revísalo antes de marcarlo' : '') });
    } else if (c.cuota && c.cuota > 0) {
      const usado = b.items.find((it) => it.linea === `nuevo_credito:${c.n}` && it.destino === 'linea');
      out.push({ id: `cnew:${c.n}`, tipo: 'credito-nuevo', grupo: 'Créditos', n: c.n, def: true,
        credito: { nombre: c.nombre || `Préstamo ${c.entidad}`.trim(), tipo: 'Préstamo', cuota: E.r2(c.cuota), cuenta: esCuenta && origenId !== NUEVA ? origenId : null, momento: usado ? E.momentoDeFecha(usado.fecha) : 'inicio', fechaInicio: null, fechaFin: c.fechaFin || null, cuotaFinal: c.cuotaFinal || 0, fechaCuotaFinal: null, capitalPendiente: c.capitalPendiente || null, fechaCapital: c.capitalPendiente ? (b.doc.hasta || '').slice(0, 7) || null : null, objetivoId: null, notas: [c.entidad && `Entidad: ${c.entidad}.`, c.notas, 'Creado desde un extracto.'].filter(Boolean).join(' ') },
        titulo: `Nuevo crédito: ${c.nombre || c.entidad || 'préstamo'}`, detalle: `${E.eur(c.cuota)}/mes${c.fechaFin ? ` hasta ${E.mkLabel(c.fechaFin).toLowerCase()}` : ''}${c.capitalPendiente ? ` · pendiente ${E.eur(c.capitalPendiente)}` : ''}` });
    }
  });

  // gastos/ingresos recurrentes nuevos
  const rec = new Map();
  ds.forEach(({ it, mk }) => {
    if (it.destino !== 'puntual' || !it.recurrente) return;
    const k = grupoRec(it);
    const g = rec.get(k) || { k, items: [], mks: new Set(), total: 0, it };
    g.items.push(it.uid); g.mks.add(mk); g.total += it.importe;
    rec.set(k, g);
  });
  rec.forEach((g) => {
    const it = g.it;
    const importe = E.r2(g.total / Math.max(1, g.mks.size));
    const esIngreso = it.signo === 'ingreso';
    const mov = esIngreso
      ? { tipo: 'ingreso', nombre: E.nombreItem(it), clase: 'extra', titular: '', importe, frecuencia: 'mensual', cuenta: esCuenta ? origenId : null, momento: E.momentoDeFecha(it.fecha), notas: 'Creado desde un extracto.' }
      : { tipo: 'gasto', nombre: E.nombreItem(it), area: it.area, sub: it.sub || '', importe, frecuencia: 'mensual', notas: 'Creado desde un extracto.',
          ...(esCuenta ? { medio: E.medioDeClase(it.clase), cuenta: origenId, momento: E.momentoDeFecha(it.fecha) } : { medio: 'tarjeta', tarjetaId: origenId }) };
    out.push({ id: `rec:${g.k}`, tipo: 'recurrente', grupo: 'Nuevos en tu configuración', uids: g.items, mov, def: it.clase === 'recibo',
      titulo: `Añadir «${mov.nombre}» como ${esIngreso ? 'ingreso' : 'gasto'} mensual`, detalle: `${E.eur(importe)} al mes${esIngreso ? '' : ` · ${E.areaDe(mov.area, state).label}${mov.sub ? ` / ${mov.sub}` : ''}`}` });
  });

  // estimados: rellenar los vacíos y avisar de cambios
  const porMov = new Map();
  ds.forEach(({ it, mk }) => {
    if (it.destino !== 'linea' || !it.linea || it.linea.includes(':')) return;
    const mov = state.movimientos.find((x) => x.id === it.linea);
    if (!mov || mov.calculado) return;
    const g = porMov.get(mov.id) || { mov, total: 0, mks: new Set() };
    const sgn = (it.signo === 'ingreso') === (mov.tipo === 'ingreso') ? 1 : -1;
    g.total += sgn * it.importe; g.mks.add(mk);
    porMov.set(mov.id, g);
  });
  porMov.forEach(({ mov, total, mks: ms }) => {
    const media = E.r2(total / Math.max(1, ms.size));
    if (!(media > 0)) return;
    const actual = Number(mov.importe) || 0;
    if (actual === 0) {
      out.push({ id: `est:${mov.id}`, tipo: 'estimado', grupo: 'Datos en blanco y estimados', movId: mov.id, valor: media, def: mov.tipo === 'gasto',
        titulo: `Estimado de «${mov.nombre}»`, detalle: `Estaba vacío → ${E.eur(media)}${mov.frecuencia !== 'mensual' ? ` (${mov.frecuencia})` : ' al mes'}` });
    } else if (mov.frecuencia === 'mensual' && Math.abs(media - actual) > Math.max(2, actual * 0.1)) {
      out.push({ id: `est:${mov.id}`, tipo: 'estimado', grupo: 'Datos en blanco y estimados', movId: mov.id, valor: media, def: false,
        titulo: `Estimado de «${mov.nombre}»`, detalle: `${E.eur(actual)} → ${E.eur(media)} (lo que salió ${ms.size > 1 ? 'de media' : 'este mes'})` });
    }
  });

  // importes reales (se recalculan con lo que ya había importado)
  const sim = simular(state, b, Object.fromEntries(out.map((p) => [p.id, p.def])), { soloReales: true });
  sim.cambiosReales.forEach((r) => {
    const nc = r.key.match(/^credito:nuevo(\d+)$/);
    const nombre = nc ? `Cuota ${b.creditosIA[Number(nc[1])]?.nombre || 'crédito nuevo'}` : nombreLinea(state, r.key);
    const detalle = r.actual !== undefined ? `${E.eur(r.actual)} → ${E.eur(r.valor)}`
      : Math.abs(r.valor - r.estimado) < 0.005 ? `${E.eur(r.valor)}, como estaba previsto` : `previsto ${E.eur(r.estimado)} → real ${E.eur(r.valor)}`;
    const varios = new Set(sim.cambiosReales.map((x) => x.mk)).size > 1;
    out.push({ id: `real:${r.mk}:${r.key}`, tipo: 'real', grupo: 'Importes reales del mes', mk: r.mk, key: r.key, valor: r.valor, actual: r.actual, def: true,
      titulo: varios ? `${nombre} · ${E.mkLabel(r.mk).toLowerCase()}` : nombre, detalle });
  });
  return out;
}

/* Aplica el borrador sobre una copia del estado. `sel` = {idPropuesta: bool}. */
function simular(state, b, sel, { soloReales = false } = {}) {
  let config = { ...state.config };
  let movimientos = [...state.movimientos];
  const origen = { ...b.origen };
  const creados = { cuentas: 0, tarjetas: 0, creditos: 0, movimientos: 0 };

  if (origen.id === NUEVA) {
    const nombre = (origen.nuevo.nombre || '').trim() || (origen.tipo === 'tarjeta' ? 'Tarjeta nueva' : 'Cuenta nueva');
    if (origen.tipo === 'tarjeta') {
      const t = { id: E.nid('tar'), nombre, titular: origen.nuevo.titular || '', cuentaDebitoId: origen.nuevo.cuentaDebitoId || null, momento: 'fin', notas: 'Creada desde un extracto.' };
      config = { ...config, tarjetas: [...(config.tarjetas || []), t] }; origen.id = t.id; creados.tarjetas++;
    } else {
      const c = { id: E.nid('cta'), nombre, titular: origen.nuevo.titular || '', notas: 'Creada desde un extracto.' };
      config = { ...config, cuentas: [...(config.cuentas || []), c] }; origen.id = c.id; creados.cuentas++;
    }
  }

  const items = b.items.map((x) => ({ ...x }));
  const on = (id, def) => (sel[id] === undefined ? def : !!sel[id]);
  const ps = soloReales ? [] : propuestas(state, b);
  const p = (id) => ps.find((x) => x.id === id);

  // créditos
  const mapaCred = {};
  if (!soloReales) {
    b.creditosIA.forEach((c) => {
      if (c.id) {
        const q = p(`cmod:${c.id}`);
        if (q && on(q.id, q.def)) config = { ...config, creditos: config.creditos.map((x) => (x.id === c.id ? { ...x, ...q.cambios } : x)) };
      } else {
        const q = p(`cnew:${c.n}`);
        if (q && on(q.id, q.def)) {
          const nuevo = { id: E.nid('cre'), ...q.credito, fechaInicio: null };
          if (!nuevo.cuenta && origen.tipo === 'cuenta') nuevo.cuenta = origen.id;
          config = { ...config, creditos: [...(config.creditos || []), nuevo] }; mapaCred[c.n] = nuevo.id; creados.creditos++;
        }
      }
    });
  } else {
    b.creditosIA.forEach((c) => { if (!c.id && on(`cnew:${c.n}`, !!(c.cuota > 0))) mapaCred[c.n] = `nuevo${c.n}`; });
  }
  items.forEach((it) => {
    const m = it.linea && it.linea.match(/^nuevo_credito:(\d+)$/);
    if (!m) return;
    if (mapaCred[m[1]]) it.linea = `credito:${mapaCred[m[1]]}`;
    else { it.linea = null; it.destino = it.destino === 'linea' ? 'puntual' : it.destino; it.area = 'creditos'; }
  });

  // recurrentes nuevos y estimados
  if (!soloReales) {
    ps.filter((q) => q.tipo === 'recurrente' && on(q.id, q.def)).forEach((q) => {
      const mov = { id: E.nid(q.mov.tipo === 'ingreso' ? 'ing' : 'gas'), ...q.mov };
      if (origen.tipo === 'cuenta' && mov.cuenta === NUEVA) mov.cuenta = origen.id;
      if (mov.tarjetaId === NUEVA) mov.tarjetaId = origen.id;
      movimientos.push(mov); creados.movimientos++;
      items.forEach((it) => { if (q.uids.includes(it.uid)) { it.destino = 'linea'; it.linea = mov.id; } });
    });
    ps.filter((q) => q.tipo === 'estimado' && on(q.id, q.def)).forEach((q) => {
      movimientos = movimientos.map((x) => (x.id === q.movId ? { ...x, importe: q.valor } : x));
    });
  }

  // extractos
  const bb = { ...b, items, origen };
  const extractos = { ...(state.extractos || {}) };
  const tocados = new Map(); // docId -> mk
  let nuevos = 0;
  destinos({ ...state, config, extractos }, bb).forEach(({ it, mk, docId, dup, anterior }) => {
    if (dup || anterior || !docId) return;
    const prev = extractos[docId] || { id: docId, mk, tipo: origen.tipo, cuentaId: origen.tipo === 'cuenta' ? origen.id : null, tarjetaId: origen.tipo === 'tarjeta' ? origen.id : null, archivos: [], items: [], aplicado: { reales: {}, saldos: {} } };
    const doc = tocados.has(docId) ? prev : { ...prev, items: [...(prev.items || [])], archivos: [...(prev.archivos || [])], aplicado: { reales: { ...(prev.aplicado?.reales || {}) }, saldos: { ...(prev.aplicado?.saldos || {}) } } };
    if (!tocados.has(docId)) {
      if (b.archivo && !doc.archivos.includes(b.archivo)) doc.archivos.push(b.archivo);
      doc.importadoEn = new Date().toISOString();
      if (origen.tipo === 'tarjeta' && b.doc.totalCargo) doc.totalDeclarado = b.doc.totalCargo;
    }
    doc.items.push({ i: `${Date.now().toString(36)}${it.uid}`, fecha: it.fecha, concepto: it.concepto, comercio: it.comercio, importe: it.importe, signo: it.signo, clase: it.clase, area: it.area, sub: it.sub, destino: it.destino, linea: it.destino === 'linea' ? it.linea : null });
    extractos[docId] = doc; tocados.set(docId, mk); nuevos++;
  });

  // importes reales
  const meses = { ...(state.meses || {}) };
  const mesDe = (mk) => { const c = meses[mk] || {}; return { saldos: { ...(c.saldos || {}) }, reales: { ...(c.reales || {}) }, reparto: { ...(c.reparto || {}) }, aportaciones: { ...(c.aportaciones || {}) } }; };
  const tl = tipoLineas({ movimientos });
  const nuevoState = { config, movimientos, meses, extractos };
  const cambiosReales = [];
  [...new Set(tocados.values())].forEach((mk) => {
    const docsMes = [...tocados.entries()].filter(([, m]) => m === mk).map(([id]) => id);
    const claves = new Set();
    docsMes.forEach((id) => {
      const d = extractos[id];
      d.items.forEach((x) => { if (x.destino === 'linea' && x.linea) claves.add(x.linea); });
      if (d.tipo === 'tarjeta') claves.add(`tarjeta:${d.tarjetaId}`);
    });
    const valores = E.realesDeExtractos(nuevoState, mk, tl);
    const lineas = soloReales ? E.lineasDelMes(state, mk) : null;
    const m = mesDe(mk);
    let cambio = false;
    claves.forEach((key) => {
      const v = valores[key];
      if (v === undefined) return;
      const actual = m.reales[key] === undefined || m.reales[key] === null ? undefined : Number(m.reales[key]);
      if (actual !== undefined && Math.abs(actual - v) < 0.005) return;
      if (soloReales) {
        const l = [...lineas.ingresos, ...lineas.gastos].find((x) => x.key === key);
        cambiosReales.push({ mk, key, valor: v, actual, estimado: l ? l.estimado : 0 });
        return;
      }
      if (!on(`real:${mk}:${key}`, true)) return;
      docsMes.forEach((id) => {
        const d = extractos[id];
        const relacionado = (d.tipo === 'tarjeta' && key === `tarjeta:${d.tarjetaId}`) || d.items.some((x) => x.destino === 'linea' && x.linea === key);
        if (relacionado && !(key in d.aplicado.reales)) d.aplicado.reales[key] = actual === undefined ? null : actual;
      });
      m.reales[key] = v; cambio = true;
    });
    if (cambio) meses[mk] = m;
  });

  // saldos
  if (!soloReales) {
    ps.filter((q) => q.tipo === 'saldo' && on(q.id, q.def)).forEach((q) => {
      const m = meses[q.mk] ? { ...meses[q.mk], saldos: { ...(meses[q.mk].saldos || {}) } } : mesDe(q.mk);
      const docId = E.extractoId(q.mk, q.cuentaId);
      const d = extractos[docId];
      if (d && !(q.cuentaId in d.aplicado.saldos)) d.aplicado.saldos[q.cuentaId] = q.actual === undefined ? null : Number(q.actual);
      m.saldos[q.cuentaId] = q.valor;
      meses[q.mk] = { reparto: {}, aportaciones: {}, reales: {}, ...m };
    });
  }

  return {
    state: { ...state, config, movimientos, meses, extractos },
    cambiosReales, docs: [...tocados.keys()], creados, nuevos, mks: [...new Set(tocados.values())].sort(),
  };
}

export function aplicar(state, b, sel) {
  return simular(state, b, sel);
}

/* Quita un extracto importado y deja los importes como estaban. */
export function deshacer(state, docId) {
  const doc = state.extractos?.[docId];
  if (!doc) return state;
  const extractos = { ...state.extractos };
  delete extractos[docId];
  const mk = doc.mk;
  const sin = { ...state, extractos };
  const valores = E.realesDeExtractos(sin, mk, tipoLineas(state));
  const cur = state.meses?.[mk] || {};
  const m = { saldos: { ...(cur.saldos || {}) }, reales: { ...(cur.reales || {}) }, reparto: { ...(cur.reparto || {}) }, aportaciones: { ...(cur.aportaciones || {}) } };
  Object.entries(doc.aplicado?.reales || {}).forEach(([k, prev]) => {
    if (valores[k] !== undefined) m.reales[k] = valores[k];
    else if (prev === null || prev === undefined) delete m.reales[k];
    else m.reales[k] = prev;
  });
  Object.entries(doc.aplicado?.saldos || {}).forEach(([c, prev]) => {
    if (prev === null || prev === undefined) delete m.saldos[c]; else m.saldos[c] = prev;
  });
  // las líneas del propio extracto que se editaron a mano
  Object.keys(m.reales).forEach((k) => { if (k.startsWith(`ext:${docId}:`)) delete m.reales[k]; });
  return { ...sin, meses: { ...state.meses, [mk]: m } };
}
