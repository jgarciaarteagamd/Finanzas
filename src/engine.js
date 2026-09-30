/* ============================================================
   Motor de cálculo — funciones puras, sin React.
   Esquema v2:
     config:      { version, mesInicio, cuentas, tarjetas, creditos, objetivos }
     movimientos: [ ingreso | gasto ]
     meses:       { 'YYYY-MM': { saldos, reales, reparto, aportaciones } }
   ============================================================ */

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const MESES_ABREV = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const MOMENTOS = [
  { key: 'inicio', label: 'Inicio de mes', dia: 'día 1' },
  { key: 'medio', label: 'Mediados', dia: 'día 15' },
  { key: 'fin', label: 'Fin de mes', dia: 'último día' },
];

// Orden fijo = orden de color (slot). "otros" va en gris neutro.
export const AREAS = [
  { key: 'vivienda', label: 'Vivienda', slot: 1 },
  { key: 'alimentacion', label: 'Alimentación', slot: 2 },
  { key: 'hijos', label: 'Hijos y educación', slot: 3 },
  { key: 'trabajo', label: 'Trabajo y autónomo', slot: 4 },
  { key: 'salud', label: 'Salud y seguros', slot: 5 },
  { key: 'transporte', label: 'Transporte', slot: 6 },
  { key: 'donaciones', label: 'Donaciones', slot: 7 },
  { key: 'creditos', label: 'Créditos', slot: 8 },
  { key: 'otros', label: 'Ocio y otros', slot: 0 },
];
export const categorias = (state) => state?.config?.categorias || [...AREAS,
  { key: 'familia', label: 'Familia', slot: 3 },
  { key: 'suscripciones', label: 'Suscripciones', slot: 2 },
  { key: 'compensaciones', label: 'Compensaciones', slot: 6 }];
export const areaDe = (key, state) => categorias(state).find((a) => a.key === key) || { key: key || 'otros', label: key || 'Sin categoría', slot: 0 };
export function subcategorias(state, area) {
  const configuradas = state.config.subcategorias?.[area] || (area === 'familia' && !state.config.subcategorias ? ['Ahorros'] : []);
  return [...new Set([...configuradas, ...state.movimientos.filter((x) => x.area === area && x.sub).map((x) => x.sub),
    ...Object.values(state.extractos || {}).flatMap((e) => (e.items || []).filter((x) => x.area === area && x.sub).map((x) => x.sub))])].sort((a,b) => a.localeCompare(b, 'es'));
}
// Reasignar etiquetas conserva importes, identificadores y confirmaciones.
export function cambiarEtiqueta(state, area, sub, destinoArea, destinoSub = '') {
  const cambiar = (x) => x.area === area && (sub === null || x.sub === sub) ? { ...x, area: destinoArea, sub: destinoSub } : x;
  return { ...state, movimientos: state.movimientos.map(cambiar), extractos: Object.fromEntries(Object.entries(state.extractos || {}).map(([id,e]) => [id, { ...e, items: (e.items || []).map(cambiar) }])) };
}

export const MEDIOS = [
  { key: 'recibo', label: 'Recibos domiciliados' },
  { key: 'tarjeta', label: 'Tarjetas de crédito' },
  { key: 'transferencia', label: 'Transferencias y Bizum' },
  { key: 'efectivo', label: 'Débito, efectivo y otros' },
];
export const medioDe = (key) => MEDIOS.find((m) => m.key === key) || MEDIOS[3];

export const FRECUENCIAS = [
  { key: 'mensual', label: 'Mensual', div: 1 },
  { key: 'bimestral', label: 'Bimestral', div: 2 },
  { key: 'trimestral', label: 'Trimestral', div: 3 },
  { key: 'semestral', label: 'Semestral', div: 6 },
  { key: 'anual', label: 'Anual', div: 12 },
  { key: 'esporadico', label: 'Puntual', div: null },
];

/* ---------- fechas (claves 'YYYY-MM') ---------- */
export const mkOf = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
export const parseMk = (mk) => { const [y, m] = mk.split('-').map(Number); return { y, m }; };
export const addMonths = (mk, d) => {
  const { y, m } = parseMk(mk);
  const t = y * 12 + (m - 1) + d;
  return mkOf(Math.floor(t / 12), (t % 12) + 1);
};
export const monthsBetween = (a, b) => { const A = parseMk(a), B = parseMk(b); return (B.y - A.y) * 12 + (B.m - A.m); };
export const mkLabel = (mk) => { const { y, m } = parseMk(mk); return `${MESES[m - 1]} ${y}`; };
export const mkShort = (mk) => { const { y, m } = parseMk(mk); return `${MESES_ABREV[m - 1]} ${String(y).slice(2)}`; };
export const range = (desde, n) => Array.from({ length: n }, (_, i) => addMonths(desde, i));

/* ---------- dinero ---------- */
const nf2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const nf0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
export const eur = (n) => nf2.format(Number(n) || 0);
export const eur0 = (n) => nf0.format(Math.round(Number(n) || 0));
export const pct = (n, d = 0) => `${(Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d })} %`;
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, (s, i, str) => (str.includes(',') ? '' : s)).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

/* ---------- aplicabilidad ---------- */
export function enRango(item, mk) {
  if (item.fechaInicio && mk < item.fechaInicio) return false;
  if (item.fechaFin && mk > item.fechaFin) return false;
  return true;
}
export function aplica(item, mk) {
  if (!enRango(item, mk)) return false;
  const { y, m } = parseMk(mk);
  const ref = item.mesReferencia || 1;
  const cada = (n) => ((m - ref) % n + n) % n === 0;
  switch (item.frecuencia) {
    case 'mensual': return true;
    case 'bimestral': return cada(2);
    case 'trimestral': return cada(3);
    case 'semestral': return cada(6);
    case 'anual': return m === ref;
    case 'esporadico': return m === item.mesEsporadico && y === item.anoEsporadico;
    default: return false;
  }
}
export function equivalenteMensual(item, ingresosRef = 0) {
  if (item.calculado === 'diezmo') return (ingresosRef * (item.porcentaje ?? 10)) / 100;
  const f = FRECUENCIAS.find((x) => x.key === item.frecuencia);
  if (!f || !f.div) return 0;
  return (Number(item.importe) || 0) / f.div;
}

/* ============================================================
   Líneas del mes: lo que entra y sale en un mes concreto.
   Cada línea tiene un "estimado" y, si ya se confirmó, un "real".
   Las tarjetas se convierten en UNA línea cada una (su estimado es la
   suma de lo configurado para esa tarjeta ese mes), y cada crédito
   genera su cuota.
   ============================================================ */
export function lineasDelMes(state, mk) {
  const { config, movimientos } = state;
  const mes = (state.meses && state.meses[mk]) || {};
  const reales = mes.reales || {};
  const real = (key) => (reales[key] === undefined || reales[key] === null ? undefined : Number(reales[key]));

  const ingresos = [];
  movimientos.filter((x) => x.tipo === 'ingreso' && aplica(x, mk)).forEach((x) => {
    const r = real(x.id);
    ingresos.push({
      key: x.id, tipo: 'ingreso', origen: 'mov', nombre: x.nombre, estimado: Number(x.importe) || 0, real: r,
      importe: r ?? (Number(x.importe) || 0), confirmado: r !== undefined,
      cuenta: x.cuenta, momento: x.momento || 'fin', clase: x.clase || 'recibo', titular: x.titular || '', ref: x,
    });
  });
  const exts = extractosDelMes(state, mk);
  const puntuales = lineasPuntuales(exts, real);
  ingresos.push(...puntuales.filter((l) => l.tipo === 'ingreso'));
  const totalIngresos = ingresos.reduce((s, l) => s + l.importe, 0);

  const gastos = [...puntuales.filter((l) => l.tipo === 'gasto')];
  // gastos directos (no de tarjeta)
  movimientos.filter((x) => x.tipo === 'gasto' && !(x.medio === 'tarjeta' && x.tarjetaId) && aplica(x, mk)).forEach((x) => {
    const r = real(x.id);
    const est = x.calculado === 'diezmo' ? (ingresos.filter((l) => x.cuenta && l.cuenta === x.cuenta).reduce((s, l) => s + l.importe, 0) * (x.porcentaje ?? 10)) / 100 : Number(x.importe) || 0;
    gastos.push({
      key: x.id, tipo: 'gasto', origen: 'mov', nombre: x.nombre, estimado: r2(est), real: r,
      importe: r ?? r2(est), confirmado: r !== undefined, cuenta: x.cuenta, momento: x.momento || 'fin',
      medio: x.medio || 'recibo', area: x.area || 'otros', sub: x.sub || '', calculado: x.calculado, ref: x,
    });
  });
  // una línea por tarjeta
  (config.tarjetas || []).forEach((t) => {
    const items = movimientos.filter((x) => x.tipo === 'gasto' && x.medio === 'tarjeta' && x.tarjetaId === t.id && aplica(x, mk));
    const est = r2(items.reduce((s, x) => s + (Number(x.importe) || 0), 0));
    const key = `tarjeta:${t.id}`;
    const r = real(key);
    const ext = exts.filter((e) => e.tipo === 'tarjeta' && e.tarjetaId === t.id);
    if (est === 0 && r === undefined) return;
    const importe = r ?? est;
    let desglose;
    const real_ = desgloseExtracto(ext, movimientos);
    if (real_.total > 0) {
      const f = importe / real_.total;
      desglose = real_.grupos.map((d) => ({ ...d, importe: d.importe * f }));
    } else {
      const factor = est > 0 ? importe / est : 0;
      desglose = items.filter((x) => (Number(x.importe) || 0) > 0).map((x) => ({
        nombre: x.nombre, area: x.area || 'otros', sub: x.sub || '', importe: (Number(x.importe) || 0) * factor,
      }));
      if (est === 0 && importe > 0) desglose.push({ nombre: 'Gasto sin detallar', area: 'otros', sub: 'Tarjeta sin desglose', importe });
    }
    gastos.push({
      key, tipo: 'gasto', origen: 'tarjeta', nombre: t.nombre, estimado: est, real: r, importe, confirmado: r !== undefined,
      cuenta: t.cuentaDebitoId, momento: t.momento || 'fin', medio: 'tarjeta', tarjetaId: t.id, area: null, sub: '', desglose, ref: t,
      conExtracto: real_.total > 0, movsExtracto: real_.n,
    });
  });
  // cuotas de créditos
  (config.creditos || []).forEach((c) => {
    if (!enRango(c, mk)) return;
    const key = `credito:${c.id}`;
    const r = real(key);
    const est = Number(c.cuota) || 0;
    gastos.push({
      key, tipo: 'gasto', origen: 'credito', nombre: `Cuota ${c.nombre}`, estimado: est, real: r, importe: r ?? est,
      confirmado: r !== undefined, cuenta: c.cuenta, momento: c.momento || 'inicio', medio: 'recibo',
      area: 'creditos', sub: c.nombre, creditoId: c.id, ref: c,
    });
  });

  return { ingresos, gastos, totalIngresos };
}

/* ============================================================
   Extractos importados (colección `extractos`, un documento por
   cuenta o tarjeta y mes):
     { id, mk, tipo: 'cuenta'|'tarjeta', cuentaId, tarjetaId, archivos,
       items: [{ i, fecha, concepto, comercio, importe (>0), signo: 'gasto'|'ingreso',
                 clase, area, sub, destino: 'linea'|'puntual'|'ignorar', linea }],
       aplicado: { reales: {key: previo|null}, saldos: {cuentaId: previo|null} } }
   ============================================================ */
export const extractoId = (mk, origenId) => `${mk}__${origenId}`;
export function extractosDelMes(state, mk) {
  return Object.values(state.extractos || {}).filter((e) => e && e.mk === mk);
}
export const momentoDeFecha = (fecha) => { const d = Number(String(fecha || '').slice(8, 10)) || 1; return d <= 10 ? 'inicio' : d <= 20 ? 'medio' : 'fin'; };
const MEDIO_CLASE = { recibo: 'recibo', cuota_credito: 'recibo', comision: 'recibo', transferencia: 'transferencia', bizum: 'transferencia', nomina: 'transferencia' };
export const medioDeClase = (clase) => MEDIO_CLASE[clase] || 'efectivo';
const slug = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
export const nombreItem = (it) => (it.comercio && it.comercio.trim()) || String(it.concepto || 'Movimiento').trim();

/* Movimientos del extracto de una cuenta que no corresponden a nada
   configurado: se agrupan por comercio y categoría y cuentan como
   importes reales del mes. */
function lineasPuntuales(exts, real) {
  const grupos = new Map();
  exts.filter((e) => e.tipo === 'cuenta').forEach((e) => {
    (e.items || []).forEach((it) => {
      if (it.destino !== 'puntual' || !(Number(it.importe) > 0)) return;
      const tipo = it.signo === 'ingreso' ? 'ingreso' : 'gasto';
      const nombre = nombreItem(it);
      const k = `ext:${e.id}:${tipo[0]}:${tipo === 'gasto' ? `${it.area || 'otros'}:` : ''}${slug(nombre)}`;
      const g = grupos.get(k) || { key: k, tipo, nombre, importe: 0, n: 0, fecha: it.fecha, cuenta: e.cuentaId, area: it.area || 'otros', sub: it.sub || '', clase: it.clase, extractoId: e.id };
      g.importe += Number(it.importe); g.n += 1;
      if (it.fecha && it.fecha < g.fecha) g.fecha = it.fecha;
      grupos.set(k, g);
    });
  });
  return [...grupos.values()].map((g) => {
    const r = real(g.key);
    const imp = r ?? r2(g.importe);
    const base = { key: g.key, tipo: g.tipo, origen: 'extracto', nombre: g.n > 1 ? `${g.nombre} (${g.n})` : g.nombre, estimado: 0, real: imp, importe: imp, confirmado: true, cuenta: g.cuenta, momento: momentoDeFecha(g.fecha), extractoId: g.extractoId, ref: null };
    return g.tipo === 'ingreso'
      ? { ...base, clase: 'extra', titular: '' }
      : { ...base, medio: medioDeClase(g.clase), area: g.area, sub: g.sub || 'Del extracto' };
  });
}

/* Desglose real de una tarjeta a partir de sus extractos. */
export function desgloseExtracto(exts, movimientos) {
  const grupos = new Map();
  let total = 0, n = 0;
  exts.forEach((e) => (e.items || []).forEach((it) => {
    if (it.destino === 'ignorar' || !(Number(it.importe) > 0)) return;
    const sgn = it.signo === 'ingreso' ? -1 : 1;
    const mov = it.destino === 'linea' && it.linea ? movimientos.find((x) => x.id === it.linea) : null;
    const nombre = mov ? mov.nombre : nombreItem(it);
    const area = mov ? mov.area || 'otros' : it.area || 'otros';
    const sub = mov ? mov.sub || '' : it.sub || '';
    const k = `${area}|${sub}|${nombre}`;
    const g = grupos.get(k) || { nombre, area, sub, importe: 0, n: 0 };
    g.importe += sgn * Number(it.importe); g.n += 1; n += 1;
    total += sgn * Number(it.importe);
    grupos.set(k, g);
  }));
  const lista = [...grupos.values()].filter((g) => g.importe > 0.004).map((g) => ({ ...g, nombre: g.n > 1 ? `${g.nombre} (${g.n})` : g.nombre }));
  const pos = lista.reduce((s, g) => s + g.importe, 0);
  // las devoluciones sueltas reducen proporcionalmente
  const f = pos > 0 && total > 0 ? total / pos : 1;
  return { grupos: lista.map((g) => ({ ...g, importe: g.importe * f })), total: Math.max(0, total), n };
}

/* Suma de lo que los extractos de un mes atribuyen a cada línea
   (clave de movimiento, tarjeta:<id> o credito:<id>). */
export function realesDeExtractos(state, mk, lineasTipo = {}) {
  const exts = extractosDelMes(state, mk);
  const out = {};
  const desdeCuenta = new Set();
  exts.filter((e) => e.tipo === 'cuenta').forEach((e) => (e.items || []).forEach((it) => {
    if (it.destino !== 'linea' || !it.linea || !(Number(it.importe) > 0)) return;
    const esIngresoLinea = lineasTipo[it.linea] === 'ingreso';
    const sgn = (it.signo === 'ingreso') === esIngresoLinea ? 1 : -1;
    out[it.linea] = (out[it.linea] || 0) + sgn * Number(it.importe);
    if (it.linea.startsWith('tarjeta:')) desdeCuenta.add(it.linea);
  }));
  exts.filter((e) => e.tipo === 'tarjeta' && e.tarjetaId).forEach((e) => {
    const k = `tarjeta:${e.tarjetaId}`;
    if (desdeCuenta.has(k)) return;
    out[k] = (out[k] || 0) + desgloseExtracto([e], state.movimientos || []).total;
  });
  Object.keys(out).forEach((k) => { out[k] = r2(Math.max(0, out[k])); });
  return out;
}

/* Desglose por área de una línea de gasto (las tarjetas se reparten
   según lo configurado, escalado al importe real si ya se confirmó). */
function trozos(l) {
  if (l.origen === 'tarjeta') return l.desglose.map((d) => ({ ...d, medio: 'tarjeta', tarjetaId: l.tarjetaId }));
  return [{ nombre: l.nombre, area: l.area, sub: l.sub, importe: l.importe, medio: l.medio }];
}

/* ============================================================
   Resumen del mes
   ============================================================ */
export function resumenMes(state, mk) {
  const { ingresos, gastos, totalIngresos } = lineasDelMes(state, mk);
  const totalGastos = gastos.reduce((s, l) => s + l.importe, 0);
  const superavit = totalIngresos - totalGastos;

  // por área → subcategoría → conceptos
  const areas = new Map();
  gastos.forEach((l) => trozos(l).forEach((t) => {
    if (!(t.importe > 0)) return;
    const a = areas.get(t.area) || { key: t.area, importe: 0, subs: new Map() };
    a.importe += t.importe;
    const sk = t.sub || 'Sin subcategoría';
    const s = a.subs.get(sk) || { sub: sk, importe: 0, items: [] };
    s.importe += t.importe;
    s.items.push({ nombre: t.nombre, importe: t.importe, medio: t.medio, tarjetaId: t.tarjetaId });
    a.subs.set(sk, s);
    areas.set(t.area, a);
  }));
  const porArea = categorias(state).map((def) => {
    const a = areas.get(def.key);
    if (!a) return null;
    return {
      key: def.key, label: def.label, slot: def.slot, importe: a.importe,
      subs: [...a.subs.values()].sort((x, y) => y.importe - x.importe).map((s) => ({ ...s, items: s.items.sort((x, y) => y.importe - x.importe) })),
    };
  }).filter(Boolean);

  // por medio de pago (y por tarjeta)
  const porMedio = MEDIOS.map((def) => {
    const ls = gastos.filter((l) => l.medio === def.key);
    const importe = ls.reduce((s, l) => s + l.importe, 0);
    return { key: def.key, label: def.label, importe, lineas: ls };
  }).filter((m) => m.importe > 0);

  // por titular / fuente de ingreso
  const porFuente = ingresos.filter((l) => l.importe > 0).map((l) => ({ key: l.key, nombre: l.nombre, titular: l.titular, clase: l.clase, importe: l.importe }))
    .sort((a, b) => b.importe - a.importe);

  const pendientes = [...ingresos, ...gastos].filter((l) => !l.confirmado && l.estimado > 0).length;

  // aportaciones a objetivos
  const mes = (state.meses && state.meses[mk]) || {};
  const aportaciones = (state.config.objetivos || []).map((o) => {
    const p = mes.reparto && mes.reparto[o.id] !== undefined ? Number(mes.reparto[o.id]) : Number(o.porcentaje) || 0;
    const puede = !o.fechaInicioAportacion || mk >= o.fechaInicioAportacion;
    const estimado = puede && superavit > 0 ? r2((superavit * p) / 100) : 0;
    const realV = mes.aportaciones && mes.aportaciones[o.id] !== undefined ? Number(mes.aportaciones[o.id]) : undefined;
    return { objetivo: o, pct: p, puede, estimado, real: realV, importe: realV ?? estimado, confirmado: realV !== undefined };
  });
  const aportado = aportaciones.reduce((s, a) => s + (a.confirmado ? a.real : 0), 0);
  const aportadoPrevisto = aportaciones.reduce((s, a) => s + a.importe, 0);

  return {
    mk, ingresos, gastos, totalIngresos, totalGastos, superavit,
    tasaAhorro: totalIngresos > 0 ? (superavit / totalIngresos) * 100 : 0,
    porArea, porMedio, porFuente, pendientes, aportaciones, aportado, aportadoPrevisto,
    confirmadoPct: (() => { const all = [...ingresos, ...gastos].filter((l) => l.estimado > 0 || l.confirmado); return all.length ? (all.filter((l) => l.confirmado).length / all.length) * 100 : 0; })(),
  };
}

/* ============================================================
   Cuentas: saldo inicial (introducido o arrastrado del mes anterior),
   entradas y salidas en los 3 momentos, punto más bajo y saldo final.
   ============================================================ */
export function flujoCuentas(state, mk, cache = new Map()) {
  if (cache.has(mk)) return cache.get(mk);
  const { config } = state;
  const inicio = config.mesInicio || mk;
  const res = resumenMes(state, mk);
  const mes = (state.meses && state.meses[mk]) || {};
  const saldos = mes.saldos || {};
  const previo = mk > inicio ? flujoCuentas(state, addMonths(mk, -1), cache) : null;

  const cuentas = (config.cuentas || []).map((c) => {
    const intro = saldos[c.id];
    let saldoInicial = 0, saldoOrigen = 'vacio';
    if (intro !== undefined && intro !== null && intro !== '') { saldoInicial = Number(intro) || 0; saldoOrigen = 'introducido'; }
    else if (previo) { const p = previo.cuentas.find((x) => x.cuenta.id === c.id); if (p) { saldoInicial = p.saldoFinal; saldoOrigen = 'arrastrado'; } }

    const mom = { inicio: { in: 0, out: 0, lineas: [] }, medio: { in: 0, out: 0, lineas: [] }, fin: { in: 0, out: 0, lineas: [] } };
    res.ingresos.forEach((l) => { if (l.cuenta === c.id && l.importe) { mom[l.momento].in += l.importe; mom[l.momento].lineas.push(l); } });
    res.gastos.forEach((l) => { if (l.cuenta === c.id && l.importe) { mom[l.momento].out += l.importe; mom[l.momento].lineas.push(l); } });
    traspasosDelMes(state, mk).forEach((t) => {
      const m = mom[t.momento] || mom.inicio;
      if (t.cuentaOrigenId === c.id) { m.out += t.importe; m.lineas.push({ ...t, tipo: 'traspaso', direccion: 'salida' }); }
      if (t.cuentaDestinoId === c.id) { m.in += t.importe; m.lineas.push({ ...t, tipo: 'traspaso', direccion: 'entrada' }); }
    });
    res.aportaciones.forEach((a) => {
      const o = a.objetivo;
      if (!o.cuentaOrigenId || !o.cuentaDestinoId || !(a.importe > 0)) return;
      if (o.cuentaOrigenId === c.id) mom.fin.out += a.importe;
      if (o.cuentaDestinoId === c.id) mom.fin.in += a.importe;
    });
    let s = saldoInicial, min = saldoInicial, minMomento = null;
    const pasos = MOMENTOS.map((m) => {
      s = s + mom[m.key].in - mom[m.key].out;
      if (s < min) { min = s; minMomento = m.key; }
      return { momento: m.key, in: mom[m.key].in, out: mom[m.key].out, saldo: s, lineas: mom[m.key].lineas };
    });
    const entradas = pasos.reduce((a, p) => a + p.in, 0);
    const salidas = pasos.reduce((a, p) => a + p.out, 0);
    return { cuenta: c, saldoInicial, saldoOrigen, pasos, entradas, salidas, saldoFinal: s, minimo: min, minMomento, deficit: Math.max(0, -min) };
  });
  const out = { mk, cuentas, resumen: res };
  cache.set(mk, out);
  return out;
}

// Un único registro y un único real mensual mantienen ambos lados vinculados.
export function traspasosDelMes(state, mk) {
  return state.movimientos.filter((x) => x.tipo === 'traspaso' && aplica(x, mk)).map((x) => {
    const value = state.meses?.[mk]?.reales?.[x.id];
    const real = value === undefined || value === null ? undefined : Number(value);
    return { ...x, key: x.id, estimado: Number(x.importe) || 0, real,
      importe: real ?? (Number(x.importe) || 0), confirmado: real !== undefined };
  });
}

/* Sugerencias de traspaso interno para cubrir déficits. */
export function sugerenciasTraspaso(flujo) {
  const deudoras = flujo.cuentas.filter((c) => c.deficit > 0 && c.saldoOrigen !== 'vacio').map((c) => ({ c, falta: c.deficit }));
  const dadoras = flujo.cuentas.filter((c) => c.saldoFinal > 0 && c.deficit === 0)
    .map((c) => ({ c, sobra: Math.min(c.saldoFinal, c.minimo) })).filter((d) => d.sobra > 0).sort((a, b) => b.sobra - a.sobra);
  const out = [];
  deudoras.sort((a, b) => b.falta - a.falta).forEach((d) => {
    let falta = d.falta;
    dadoras.forEach((g) => {
      if (falta <= 0 || g.sobra <= 0) return;
      const x = Math.min(falta, g.sobra);
      out.push({ desde: g.c.cuenta, hacia: d.c.cuenta, importe: Math.ceil(x), cuando: d.c.minMomento });
      g.sobra -= x; falta -= x;
    });
    if (falta > 0.5) out.push({ desde: null, hacia: d.c.cuenta, importe: Math.ceil(falta), cuando: d.c.minMomento });
  });
  return out;
}

/* ============================================================
   Flujo del dinero (Sankey de 3 columnas):
   de dónde viene → a qué cuenta entra / de cuál sale → a dónde va
   ============================================================ */
export function datosFlujo(state, mk) {
  const f = flujoCuentas(state, mk);
  const res = f.resumen;
  const links = []; // {from, to, value, kind}
  const nodes = new Map();
  const add = (id, label, col, kind, extra = {}) => { if (!nodes.has(id)) nodes.set(id, { id, label, col, kind, ...extra }); };

  res.ingresos.forEach((l) => {
    if (!(l.importe > 0) || !l.cuenta) return;
    const src = `in:${l.key}`;
    add(src, l.nombre, 0, 'ingreso');
    add(`cta:${l.cuenta}`, nombreCuenta(state, l.cuenta), 1, 'cuenta');
    links.push({ from: src, to: `cta:${l.cuenta}`, value: l.importe, kind: 'ingreso' });
  });
  const salidasCuenta = new Map();
  res.gastos.forEach((l) => {
    if (!(l.importe > 0) || !l.cuenta) return;
    add(`cta:${l.cuenta}`, nombreCuenta(state, l.cuenta), 1, 'cuenta');
    trozos(l).forEach((t) => {
      if (!(t.importe > 0)) return;
      const dest = `area:${t.area}`;
      add(dest, areaDe(t.area, state).label, 2, 'area', { area: t.area, slot: areaDe(t.area, state).slot });
      const k = `${l.cuenta}|${t.area}`;
      salidasCuenta.set(k, (salidasCuenta.get(k) || 0) + t.importe);
    });
  });
  salidasCuenta.forEach((v, k) => { const [c, a] = k.split('|'); links.push({ from: `cta:${c}`, to: `area:${a}`, value: v, kind: 'gasto', area: a }); });

  traspasosDelMes(state, mk).forEach((t) => {
    if (!(t.importe > 0) || t.cuentaOrigenId === t.cuentaDestinoId) return;
    if (![t.cuentaOrigenId, t.cuentaDestinoId].every((id) => state.config.cuentas.some((c) => c.id === id))) return;
    const from = `cta:${t.cuentaOrigenId}`, to = `cta:${t.cuentaDestinoId}`;
    add(from, nombreCuenta(state, t.cuentaOrigenId), 1, 'cuenta');
    add(to, nombreCuenta(state, t.cuentaDestinoId), 1, 'cuenta');
    const etiqueta = t.area ? `${areaDe(t.area, state).label}${t.sub ? ` / ${t.sub}` : ''}` : 'Sin etiqueta';
    links.push({ from, to, value: t.importe, kind: 'traspaso', label: etiqueta, nombre: t.nombre, slot: areaDe(t.area, state).slot, confirmado: t.confirmado });
  });

  // equilibrar cada cuenta: lo que sobra queda como superávit; lo que falta sale de su saldo previo
  const saldoPrevioId = 'src:saldo';
  let usaSaldo = false;
  [...nodes.values()].filter((n) => n.col === 1).forEach((n) => {
    const inV = links.filter((l) => l.to === n.id).reduce((s, l) => s + l.value, 0);
    const outV = links.filter((l) => l.from === n.id).reduce((s, l) => s + l.value, 0);
    if (inV > outV + 0.5) {
      add('dest:superavit', 'Queda de superávit', 2, 'superavit');
      links.push({ from: n.id, to: 'dest:superavit', value: inV - outV, kind: 'superavit' });
    } else if (outV > inV + 0.5) {
      usaSaldo = true;
      links.push({ from: saldoPrevioId, to: n.id, value: outV - inV, kind: 'saldo' });
    }
  });
  if (usaSaldo) add(saldoPrevioId, 'Saldo previo en cuentas', 0, 'saldo');

  return { nodes: [...nodes.values()], links, resumen: res };
}
export const nombreCuenta = (state, id) => (state.config.cuentas || []).find((c) => c.id === id)?.nombre || 'Cuenta sin asignar';
export const nombreTarjeta = (state, id) => (state.config.tarjetas || []).find((c) => c.id === id)?.nombre || 'Tarjeta';

/* ============================================================
   Series para historial y proyecciones
   ============================================================ */
export function serieMeses(state, desde, n) {
  return range(desde, n).map((mk) => {
    const r = resumenMes(state, mk);
    const lineas = [...r.ingresos, ...r.gastos].filter((l) => l.estimado > 0 || l.confirmado);
    const conf = lineas.filter((l) => l.confirmado).length;
    return {
      mk, ingresos: r.totalIngresos, gastos: r.totalGastos, superavit: r.superavit, tasaAhorro: r.tasaAhorro,
      aportado: r.aportado, aportadoPrevisto: r.aportadoPrevisto,
      estado: conf === 0 ? 'proyectado' : conf === lineas.length ? 'cerrado' : 'en curso',
      porArea: Object.fromEntries(r.porArea.map((a) => [a.key, a.importe])),
      porFuente: Object.fromEntries(r.ingresos.map((l) => [l.nombre, l.importe])),
    };
  });
}

/* Media mensual "de referencia" (amortiza trimestrales/anuales). */
export function mediasMensuales(state, mk) {
  const movs = state.movimientos;
  const ingresos = movs.filter((x) => x.tipo === 'ingreso' && x.frecuencia !== 'esporadico' && enRango(x, mk))
    .reduce((s, x) => s + equivalenteMensual(x), 0);
  const gastosMov = movs.filter((x) => x.tipo === 'gasto' && x.frecuencia !== 'esporadico' && enRango(x, mk))
    .reduce((s, x) => s + equivalenteMensual(x, movs.filter((i) => i.tipo === 'ingreso' && x.cuenta && i.cuenta === x.cuenta && i.frecuencia !== 'esporadico' && enRango(i, mk)).reduce((n, i) => n + equivalenteMensual(i), 0)), 0);
  const cuotas = (state.config.creditos || []).filter((c) => enRango(c, mk)).reduce((s, c) => s + (Number(c.cuota) || 0), 0);
  const gastos = gastosMov + cuotas;
  return { ingresos, gastos, superavit: ingresos - gastos };
}

/* Media mensual configurada de una tarjeta (tendencia). */
export function mediaTarjeta(state, tarjetaId, mk) {
  return state.movimientos.filter((x) => x.tipo === 'gasto' && x.medio === 'tarjeta' && x.tarjetaId === tarjetaId && x.frecuencia !== 'esporadico' && (!mk || enRango(x, mk)))
    .reduce((s, x) => s + equivalenteMensual(x), 0);
}

/* ============================================================
   Créditos
   ============================================================ */
export function estadoCreditos(state, mk) {
  return (state.config.creditos || []).map((c) => {
    const fin = c.fechaFin;
    const activo = enRango(c, mk);
    const cuotasRestantes = fin ? Math.max(0, monthsBetween(mk, fin) + 1) : null;
    const porCuotas = cuotasRestantes !== null ? cuotasRestantes * (Number(c.cuota) || 0) : null;
    const cuotaFinal = Number(c.cuotaFinal) || 0;
    const finalPendiente = cuotaFinal > 0 && (!c.fechaCuotaFinal || c.fechaCuotaFinal >= mk);
    const totalPorPagar = (porCuotas || 0) + (finalPendiente ? cuotaFinal : 0);
    const totalMeses = c.fechaInicio && fin ? monthsBetween(c.fechaInicio, fin) + 1 : null;
    const transcurridos = c.fechaInicio ? Math.max(0, Math.min(totalMeses || 0, monthsBetween(c.fechaInicio, mk))) : null;
    const progreso = totalMeses ? transcurridos / totalMeses : null;
    const ultimo = c.fechaCuotaFinal && c.fechaCuotaFinal > (fin || '') ? c.fechaCuotaFinal : fin;
    const obj = c.objetivoId ? (state.config.objetivos || []).find((o) => o.id === c.objetivoId) : null;
    const ahorrado = obj ? ahorradoObjetivo(state, obj, mk) : 0;
    return {
      credito: c, activo, cuotasRestantes, porCuotas, cuotaFinal, finalPendiente, totalPorPagar, totalMeses, transcurridos,
      progreso, ultimo, mesesHastaUltimo: ultimo ? monthsBetween(mk, ultimo) : null, objetivo: obj, ahorrado,
      cobertura: finalPendiente && cuotaFinal > 0 ? Math.min(1, ahorrado / cuotaFinal) : null,
    };
  });
}
export function servicioDeuda(state, desde, n) {
  return range(desde, n).map((mk) => {
    const fila = { mk, total: 0, finales: [] };
    (state.config.creditos || []).forEach((c) => {
      const v = enRango(c, mk) ? Number(c.cuota) || 0 : 0;
      fila[c.id] = v; fila.total += v;
      if (c.cuotaFinal && c.fechaCuotaFinal === mk) fila.finales.push({ credito: c, importe: Number(c.cuotaFinal) });
    });
    return fila;
  });
}

/* ============================================================
   Objetivos de ahorro
   ============================================================ */
export function ahorradoObjetivo(state, o, hastaMk) {
  let s = Number(o.ahorradoBase) || 0;
  Object.entries(state.meses || {}).forEach(([mk, mes]) => {
    if (hastaMk && mk > hastaMk) return;
    const v = mes.aportaciones && mes.aportaciones[o.id];
    if (v !== undefined && v !== null) s += Number(v) || 0;
  });
  return s;
}
export function metaObjetivo(state, o, mk) {
  if (o.tipo === 'colchon') return mediasMensuales(state, mk).gastos * (Number(o.mesesDeseados) || 6);
  return Number(o.objetivo) || 0;
}
export function estadoObjetivos(state, mk) {
  return (state.config.objetivos || []).map((o) => {
    const ahorrado = ahorradoObjetivo(state, o, null);
    const meta = metaObjetivo(state, o, mk);
    const falta = Math.max(0, meta - ahorrado);
    const mesesHasta = o.fechaObjetivo ? monthsBetween(mk, o.fechaObjetivo.slice(0, 7)) : null;
    const necesarioMes = mesesHasta && mesesHasta > 0 ? falta / mesesHasta : null;
    return { objetivo: o, ahorrado, meta, falta, progreso: meta > 0 ? Math.min(1, ahorrado / meta) : 0, mesesHasta, necesarioMes };
  });
}

/* ============================================================
   Alertas: lo que merece atención este mes
   ============================================================ */
export function alertas(state, mk) {
  const out = [];
  const f = flujoCuentas(state, mk);
  const res = f.resumen;
  f.cuentas.filter((c) => c.deficit > 0).forEach((c) => {
    const cuando = MOMENTOS.find((m) => m.key === c.minMomento);
    const momentoTxt = cuando ? `${cuando.label.toLowerCase()} (${cuando.dia})` : 'a lo largo del mes';
    if (c.saldoOrigen === 'vacio') {
      out.push({ nivel: 'aviso', tipo: 'basal', vacio: true, importe: c.deficit, momento: c.minMomento, nombre: c.cuenta.nombre, titulo: `${c.cuenta.nombre} necesita ${eur0(c.deficit)}`, texto: `Es lo que hace falta tener para cubrir los cargos hasta ${momentoTxt}. Añade su saldo de inicio de mes en Cuentas.`, cuenta: c.cuenta.id });
    } else {
      out.push({ nivel: 'critico', tipo: 'basal', vacio: false, importe: c.deficit, momento: c.minMomento, nombre: c.cuenta.nombre, titulo: `${c.cuenta.nombre}: faltan ${eur0(c.deficit)}`, texto: `Con lo previsto, baja a ${eur0(c.minimo)} ${momentoTxt}.`, cuenta: c.cuenta.id });
    }
  });
  if (res.superavit < 0) out.push({ nivel: 'critico', tipo: 'deficit', titulo: `Mes en negativo: ${eur0(res.superavit)}`, texto: 'Los gastos previstos superan a los ingresos este mes.' });
  if (res.pendientes > 0) out.push({ nivel: 'aviso', tipo: 'pendientes', titulo: `${res.pendientes} importes sin confirmar`, texto: 'Confirma lo que ya se cobró o pagó para que el mes cuadre con la realidad.' });
  // cosas que terminan o cambian pronto (6 meses)
  const horizonte = addMonths(mk, 6);
  state.movimientos.forEach((x) => {
    if (x.fechaFin && x.fechaFin >= mk && x.fechaFin <= horizonte && x.tipo === 'gasto') {
      out.push({ nivel: 'info', tipo: 'fin', titulo: `${x.nombre} termina en ${mkLabel(x.fechaFin).toLowerCase()}`, texto: x.notas ? x.notas.split('.')[0] + '.' : 'Revisa el importe que lo sustituye.' });
    }
  });
  (state.config.creditos || []).forEach((c) => {
    if (c.cuotaFinal && c.fechaCuotaFinal && c.fechaCuotaFinal >= mk && c.fechaCuotaFinal <= addMonths(mk, 12)) {
      const obj = c.objetivoId ? (state.config.objetivos || []).find((o) => o.id === c.objetivoId) : null;
      const ah = obj ? ahorradoObjetivo(state, obj, null) : 0;
      out.push({ nivel: ah >= c.cuotaFinal ? 'info' : 'aviso', tipo: 'balloon', titulo: `Cuota final de ${c.nombre}: ${eur0(c.cuotaFinal)} en ${mkLabel(c.fechaCuotaFinal).toLowerCase()}`, texto: obj ? `Llevas ahorrado ${eur0(ah)} (${Math.round((ah / c.cuotaFinal) * 100)} %).` : 'Sin objetivo de ahorro asociado.' });
    }
  });
  return out;
}

/* ============================================================
   Migración desde la copia de la app anterior (esquema v1)
   ============================================================ */
const MAPA_V1 = {
  'gas-04': ['trabajo', 'Cuotas y seguros profesionales'], 'gas-05': ['trabajo', 'Cuotas y seguros profesionales'],
  'gas-06': ['transporte', 'Seguros de coche'], 'gas-07': ['transporte', 'Seguros de coche'],
  'gas-08': ['salud', 'Seguros'], 'gas-09': ['salud', 'Seguros'],
  'gas-10': ['vivienda', 'Alquiler'], 'gas-11': ['vivienda', 'Parking'],
  'gas-12': ['vivienda', 'Suministros'], 'gas-13': ['vivienda', 'Suministros'], 'gas-14': ['vivienda', 'Suministros'], 'gas-15': ['vivienda', 'Suministros'],
  'gas-16': ['hijos', 'Colegio'], 'gas-17': ['hijos', 'Colegio'], 'gas-18': ['hijos', 'Apoyo y actividades'],
  'gas-20': ['trabajo', 'Cuotas y seguros profesionales'], 'gas-21': ['trabajo', 'Cuotas y seguros profesionales'],
  'gas-22': ['otros', 'Comisiones bancarias'], 'gas-23': ['transporte', 'Combustible'], 'gas-24': ['transporte', 'Combustible'],
  'gas-25': ['otros', 'Comisiones bancarias'], 'gas-26': ['alimentacion', 'Supermercado'],
  'gas-27': ['otros', 'Streaming'], 'gas-28': ['otros', 'Streaming'], 'gas-29': ['otros', 'Streaming'],
  'gas-30': ['trabajo', 'Recursos profesionales'], 'gas-31': ['trabajo', 'Recursos profesionales'], 'gas-32': ['otros', 'Streaming'],
  'gas-33': ['otros', 'Suscripciones digitales'], 'gas-34': ['trabajo', 'Recursos profesionales'],
  'gas-35': ['donaciones', 'Diezmo'], 'gas-36': ['donaciones', 'ONG y asociaciones'], 'gas-37': ['donaciones', 'ONG y asociaciones'],
  'gas-38': ['otros', 'Varios'], 'gas-39': ['trabajo', 'Laborales'], 'gas-40': ['otros', 'Deporte'],
};
const CREDITOS_V1 = { 'gas-01': 'cre-qashqai', 'gas-02': 'cre-juke', 'gas-03': 'cre-prestamo', 'gas-19': 'cre-ortodoncia' };
const MEDIO_V1 = { recibos: 'recibo', tarjetas: 'tarjeta', transferencias: 'transferencia', otros: 'efectivo' };

export function esCopiaV1(d) { return d && Array.isArray(d.movimientos) && Array.isArray(d.cuentas) && !d.config; }

/** Convierte la copia antigua sobre la configuración actual (conserva los
 *  créditos y categorías nuevos; trae movimientos, cuentas, tarjetas,
 *  objetivos, saldos, confirmaciones y aportaciones). */
export function migrarV1(old, base) {
  const creditos = base.config.creditos || [];
  const credPorMov = {};
  Object.entries(CREDITOS_V1).forEach(([mov, cre]) => { if (creditos.some((c) => c.id === cre)) credPorMov[mov] = cre; });
  const movimientos = [];
  (old.movimientos || []).forEach((x) => {
    if (credPorMov[x.id]) return;
    if (String(x.id).startsWith('tarjeta-resumen-') || String(x.id).startsWith('traspaso-')) return;
    if (x.tipo === 'credito') {
      movimientos.push({
        id: x.id, tipo: 'ingreso', nombre: x.nombre, clase: x.categoria === 'extras' ? 'extra' : 'recibo',
        titular: /sara/i.test(x.nombre) ? 'Sara' : 'Juan', importe: Number(x.importe) || 0, frecuencia: x.frecuencia,
        mesReferencia: x.mesReferencia, mesEsporadico: x.mesEsporadico, anoEsporadico: x.anoEsporadico,
        cuenta: x.cuenta, momento: x.momento || 'fin', fechaInicio: x.fechaInicio, fechaFin: x.fechaFin, notas: x.notas || '',
      });
    } else {
      const [area, sub] = MAPA_V1[x.id] || ['otros', x.grupo || ''];
      const medio = x.categoria === 'tarjetas' ? (x.tarjetaId ? 'tarjeta' : 'recibo') : (MEDIO_V1[x.categoria] || 'recibo');
      movimientos.push({
        id: x.id, tipo: 'gasto', nombre: x.nombre, area, sub, medio, tarjetaId: medio === 'tarjeta' ? x.tarjetaId : undefined,
        cuenta: medio === 'tarjeta' ? undefined : x.cuenta, momento: medio === 'tarjeta' ? undefined : (x.momento || 'fin'),
        importe: Number(x.importe) || 0, frecuencia: x.frecuencia, mesReferencia: x.mesReferencia,
        mesEsporadico: x.mesEsporadico, anoEsporadico: x.anoEsporadico, fechaInicio: x.fechaInicio, fechaFin: x.fechaFin,
        calculado: x.calculado, porcentaje: x.porcentajeCalculo, notas: x.notas || '',
      });
    }
  });
  const cuentas = (old.cuentas || []).map((c) => (typeof c === 'string' ? { id: c, nombre: c, titular: '' } : { id: c.id, nombre: c.nombre, titular: c.titular || '', notas: c.notas || '' }));
  const tarjetas = (old.tarjetas || base.config.tarjetas || []).map((t) => ({
    id: t.id, nombre: t.nombre, titular: t.titular || '', cuentaDebitoId: t.cuentaDebitoId,
    momento: t.momento || (t.momentoCargo === 'medio_mes' ? 'medio' : 'fin'), notas: t.notas || '',
  }));
  const objetivos = (old.objetivos || []).map((o) => ({
    id: o.id, nombre: o.nombre, tipo: o.tipo, porcentaje: Number(o.porcentajeRecomendado) || 0, mesesDeseados: o.mesesDeseados,
    objetivo: o.objetivoManual, ahorradoBase: Number(o.ahorradoActual) || 0, fechaObjetivo: o.fechaObjetivo,
    fechaInicioAportacion: o.fechaInicioAportacion, contingente: !!o.contingente,
    cuentaOrigenId: o.cuentaOrigenId || null, cuentaDestinoId: o.cuentaDestinoId || null, notas: o.notas || '',
  }));
  const meses = {};
  const mes = (mk) => (meses[mk] = meses[mk] || { saldos: {}, reales: {}, reparto: {}, aportaciones: {} });
  Object.entries(old.saldosIniciales || {}).forEach(([mk, v]) => {
    if (v && typeof v === 'object') Object.entries(v).forEach(([c, n]) => { mes(mk).saldos[c] = Number(n) || 0; });
  });
  Object.entries(old.confirmaciones || {}).forEach(([k, v]) => {
    const m = k.match(/^(.*)_(\d{4}-\d{2})$/); if (!m) return;
    let [, id, mk] = m; const val = Number(v && v.importeReal !== undefined ? v.importeReal : v);
    if (id.startsWith('tarjeta-resumen-')) id = `tarjeta:${id.slice('tarjeta-resumen-'.length)}`;
    else if (credPorMov[id]) id = `credito:${credPorMov[id]}`;
    mes(mk).reales[id] = val;
  });
  Object.entries(old.repartosReales || {}).forEach(([mk, v]) => { Object.entries(v || {}).forEach(([o, p]) => { mes(mk).reparto[o] = Number(p) || 0; }); });
  Object.entries(old.traspasosConfirmados || {}).forEach(([k, v]) => {
    const m = k.match(/^(.*)_(\d{4}-\d{2})$/); if (m) mes(m[2]).aportaciones[m[1]] = Number(v) || 0;
  });
  // en v1 "ahorradoActual" ya incluía las aportaciones registradas: no se duplican.
  return {
    config: { ...base.config, cuentas: cuentas.length ? cuentas : base.config.cuentas, tarjetas: tarjetas.length ? tarjetas : base.config.tarjetas, objetivos: objetivos.length ? objetivos : base.config.objetivos },
    movimientos: movimientos.length ? movimientos : base.movimientos,
    meses,
  };
}

export const nid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function guardarCategoria(state, categoria) {
  const lista = categorias(state);
  return { ...state, config: { ...state.config, categorias: lista.some((a) => a.key === categoria.key) ? lista.map((a) => a.key === categoria.key ? categoria : a) : [...lista, categoria] } };
}
export function eliminarCategoria(state, key) {
  if (['otros', 'creditos'].includes(key)) return state;
  let next = cambiarEtiqueta(state, key, null, 'otros');
  // Las líneas importadas agrupan por categoría. Conserva los reales incluso
  // si al reasignar se fusionan dos grupos del mismo comercio.
  const meses = { ...state.meses };
  for (const mk of new Set(Object.values(state.extractos || {}).map((e) => e.mk))) {
    const reales = state.meses?.[mk]?.reales || {};
    const lineas = lineasPuntuales(extractosDelMes(state, mk), (k) => reales[k] == null ? undefined : Number(reales[k]));
    const grupos = new Map();
    for (const l of lineas) {
      const prefijo = `ext:${l.extractoId}:g:${key}:`;
      const destino = l.key.startsWith(prefijo) ? `ext:${l.extractoId}:g:otros:${l.key.slice(prefijo.length)}` : l.key;
      const g = grupos.get(destino) || { total: 0, keys: [], cambia: false, real: false };
      g.total += l.importe; g.keys.push(l.key); g.cambia ||= destino !== l.key; g.real ||= reales[l.key] != null;
      grupos.set(destino, g);
    }
    const nuevos = { ...reales };
    let cambio = false;
    for (const [destino, g] of grupos) if (g.cambia && g.real) {
      g.keys.forEach((k) => { delete nuevos[k]; }); nuevos[destino] = r2(g.total); cambio = true;
    }
    if (cambio) meses[mk] = { ...state.meses[mk], reales: nuevos };
  }
  next = { ...next, meses };
  const subs = Object.fromEntries(categorias(state).filter((a) => a.key !== key).map((a) => [a.key, subcategorias(state, a.key)]));
  return { ...next, config: { ...next.config, categorias: categorias(state).filter((a) => a.key !== key), subcategorias: subs } };
}
export function guardarSubcategoria(state, area, anterior, nombre) {
  const subs = Object.fromEntries(categorias(state).map((a) => [a.key, subcategorias(state, a.key)]));
  const next = anterior ? cambiarEtiqueta(state, area, anterior, area, nombre) : state;
  subs[area] = [...new Set([...(subs[area] || []).filter((s) => s !== anterior), ...(nombre ? [nombre] : [])])];
  return { ...next, config: { ...next.config, subcategorias: subs } };
}
