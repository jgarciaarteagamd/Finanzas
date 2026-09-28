/* ============================================================
   Análisis de extractos con la IA (capacidad `sample`).
   Una llamada por trozo de texto (o grupo de imágenes). Cada una
   devuelve el documento detectado y los movimientos ya emparejados
   con lo que hay configurado en la app.
   ============================================================ */
import * as E from '../engine.js';
import { trocear } from './leer.js';

const CLASES = 'compra | recibo | transferencia | bizum | nomina | ingreso | traspaso | cargo_tarjeta | cuota_credito | comision | devolucion | retirada | otro';

export function contexto(state) {
  const { config, movimientos } = state;
  const L = [];
  L.push('CUENTAS (id | nombre | titular | notas):');
  (config.cuentas || []).forEach((c) => L.push(`${c.id} | ${c.nombre} | ${c.titular || ''} | ${c.notas || ''}`));
  L.push('\nTARJETAS DE CRÉDITO (id | nombre | titular | cuenta donde se carga):');
  (config.tarjetas || []).forEach((t) => L.push(`${t.id} | ${t.nombre} | ${t.titular || ''} | ${t.cuentaDebitoId || ''}`));
  L.push('\nCRÉDITOS Y PRÉSTAMOS (clave | nombre | tipo | cuota | cuenta | fin):');
  (config.creditos || []).forEach((c) => L.push(`credito:${c.id} | ${c.nombre} | ${c.tipo || ''} | ${c.cuota} | ${c.cuenta || ''} | ${c.fechaFin || ''}`));
  L.push('\nINGRESOS PREVISTOS (clave | nombre | importe | frecuencia | cuenta):');
  movimientos.filter((x) => x.tipo === 'ingreso' && x.frecuencia !== 'esporadico').forEach((x) => L.push(`${x.id} | ${x.nombre} | ${x.importe} | ${x.frecuencia} | ${x.cuenta || ''}`));
  L.push('\nGASTOS PREVISTOS (clave | nombre | importe | frecuencia | categoría/subcategoría | medio | cuenta o tarjeta):');
  movimientos.filter((x) => x.tipo === 'gasto' && x.frecuencia !== 'esporadico').forEach((x) => L.push(`${x.id} | ${x.nombre} | ${x.calculado ? `${x.porcentaje ?? 10}% ingresos` : x.importe} | ${x.frecuencia} | ${x.area}/${x.sub || ''} | ${x.medio} | ${x.medio === 'tarjeta' ? x.tarjetaId : x.cuenta || ''}`));
  (config.tarjetas || []).forEach((t) => L.push(`tarjeta:${t.id} | Cargo mensual de la tarjeta ${t.nombre} | — | mensual | — | recibo | ${t.cuentaDebitoId || ''}`));
  const subs = {};
  movimientos.forEach((x) => { if (x.tipo === 'gasto' && x.sub) (subs[x.area] = subs[x.area] || new Set()).add(x.sub); });
  L.push('\nCATEGORÍAS (clave: nombre — subcategorías ya usadas):');
  E.AREAS.forEach((a) => L.push(`${a.key}: ${a.label}${subs[a.key] ? ` — ${[...subs[a.key]].join(', ')}` : ''}`));
  return L.join('\n');
}

function instrucciones(ctx, pista, parte) {
  return `Eres un asistente contable para una familia en España. Te paso ${parte.imagenes ? 'imágenes de' : 'el texto extraído de'} un extracto bancario o de tarjeta de crédito${parte.total > 1 ? ` (parte ${parte.n} de ${parte.total}; analiza SOLO los movimientos de esta parte)` : ''}. Extrae TODOS los movimientos y emparéjalos con lo que la familia ya tiene configurado.

${ctx}

${pista ? `PISTA DEL USUARIO: ${pista}\n` : ''}
REGLAS
- Importe "i" con signo desde el punto de vista del titular: negativo si sale dinero (compra, recibo, cargo, transferencia enviada, cuota); positivo si entra (nómina, transferencia recibida, abono, devolución). En extractos de tarjeta, las compras son negativas y los abonos/devoluciones positivos.
- Fechas en formato AAAA-MM-DD (usa la fecha de operación; si falta el año, dedúcelo del periodo del extracto).
- "k" (clase): ${CLASES}. "traspaso" = movimiento entre cuentas propias de la familia (incluye aportes a ahorro, a Revolut/Wise o a la cuenta de otro miembro de la familia). "cargo_tarjeta" = liquidación de una tarjeta de crédito en la cuenta, o el pago/abono de la deuda dentro del propio extracto de la tarjeta.
- "l" (línea): la clave de lo configurado a lo que corresponde (un id de gasto o ingreso, "tarjeta:<id>" para el cargo mensual de una tarjeta, "credito:<id>" para la cuota de un crédito). Usa "nuevo_credito:<n>" si es la cuota de un préstamo/financiación que NO está en la lista (n = posición en "creditos", empezando en 0). null si no corresponde a nada configurado. Empareja por concepto y comercio, no solo por importe; por ejemplo, las compras en supermercados van a la línea de Supermercado aunque el importe sea distinto.
- "a" y "s": categoría (una de las claves de CATEGORÍAS) y subcategoría (reutiliza una existente si encaja; si no, una corta y clara en español). Pon categoría también a los movimientos emparejados.
- "m": nombre limpio del comercio o contraparte (p. ej. "Mercadona", "Endesa", "Otosur"). Sin números de tarjeta ni referencias.
- "r": 1 si parece un cargo recurrente (suscripción, recibo mensual, cuota) que no está configurado; si no, 0.
- "b": saldo de la cuenta tras el movimiento si el extracto lo muestra; si no, null.
- Nunca incluyas IBAN, números de cuenta ni de tarjeta completos.
- En "doc": tipo "cuenta" o "tarjeta"; "cuentaId" o "tarjetaId" de la lista si reconoces el producto (por banco, titular, nombre de la tarjeta), o null; "desde"/"hasta" = periodo; "saldoInicial"/"saldoFinal" del periodo si aparecen; en tarjetas, "totalCargo" = importe que se cargará en la cuenta y "fechaCargo" si aparece.
- En "creditos": préstamos, financiaciones o créditos que veas (cuotas recurrentes, cuadros de amortización, capital pendiente). Si ya existe, pon su "id" (sin "credito:") y solo los datos nuevos o distintos.

Responde SOLO con JSON con esta forma exacta (sin texto antes ni después):
{"doc":{"tipo":"cuenta","entidad":"Santander","producto":"Cuenta Nómina","titular":"","cuentaId":null,"tarjetaId":null,"desde":"2026-09-01","hasta":"2026-09-30","saldoInicial":null,"saldoFinal":null,"totalCargo":null,"fechaCargo":null},
"movs":[{"f":"2026-09-03","c":"COMPRA MERCADONA HUELVA","m":"Mercadona","i":-45.3,"k":"compra","l":"gas-26","a":"alimentacion","s":"Supermercado","r":0,"b":1234.5}],
"creditos":[{"id":null,"nombre":"","entidad":"","cuota":0,"fechaFin":null,"capitalPendiente":null,"cuotaFinal":null,"notas":""}],
"aviso":""}
"aviso": una frase corta si algo no se pudo leer bien o está incompleto; si no, "".`;
}

const numOk = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(E.num(v)) ? E.num(v) : null);
const fechaOk = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);

/* Normaliza lo que devuelve la IA. */
export function normalizar(r) {
  const d = (r && typeof r === 'object' && r.doc && typeof r.doc === 'object') ? r.doc : {};
  const doc = {
    tipo: d.tipo === 'tarjeta' ? 'tarjeta' : d.tipo === 'cuenta' ? 'cuenta' : null,
    entidad: String(d.entidad || '').slice(0, 60), producto: String(d.producto || '').slice(0, 80), titular: String(d.titular || '').slice(0, 60),
    cuentaId: d.cuentaId ? String(d.cuentaId) : null, tarjetaId: d.tarjetaId ? String(d.tarjetaId) : null,
    desde: fechaOk(d.desde), hasta: fechaOk(d.hasta), saldoInicial: numOk(d.saldoInicial), saldoFinal: numOk(d.saldoFinal),
    totalCargo: numOk(d.totalCargo), fechaCargo: fechaOk(d.fechaCargo),
  };
  const movs = (Array.isArray(r && r.movs) ? r.movs : []).map((m) => ({
    fecha: fechaOk(m && m.f), concepto: String((m && m.c) || '').slice(0, 90), comercio: String((m && m.m) || '').slice(0, 50),
    i: numOk(m && m.i), clase: String((m && m.k) || 'otro'), linea: m && m.l ? String(m.l) : null,
    area: String((m && m.a) || 'otros'), sub: String((m && m.s) || '').slice(0, 40), recurrente: !!(m && Number(m.r)), saldo: numOk(m && m.b),
  })).filter((m) => m.fecha && m.i !== null && Math.abs(m.i) >= 0.005);
  const creditos = (Array.isArray(r && r.creditos) ? r.creditos : []).filter((c) => c && (c.nombre || c.id)).map((c) => ({
    id: c.id ? String(c.id).replace(/^credito:/, '') : null, nombre: String(c.nombre || '').slice(0, 60), entidad: String(c.entidad || '').slice(0, 60),
    cuota: numOk(c.cuota), fechaFin: typeof c.fechaFin === 'string' && /^\d{4}-\d{2}/.test(c.fechaFin) ? c.fechaFin.slice(0, 7) : null,
    capitalPendiente: numOk(c.capitalPendiente), cuotaFinal: numOk(c.cuotaFinal), notas: String(c.notas || '').slice(0, 200),
  }));
  return { doc, movs, creditos, aviso: String((r && r.aviso) || '').slice(0, 300) };
}

/* Junta los resultados de varios trozos del mismo archivo. */
export function juntar(partes) {
  const out = { doc: {}, movs: [], creditos: [], avisos: [] };
  partes.forEach((p, idx) => {
    Object.entries(p.doc).forEach(([k, v]) => {
      if (v === null || v === '') return;
      if (k === 'hasta' || k === 'saldoFinal') out.doc[k] = v; // el último manda
      else if (out.doc[k] === undefined || out.doc[k] === null || out.doc[k] === '') out.doc[k] = v;
    });
    const base = out.creditos.length;
    p.movs.forEach((m) => {
      let linea = m.linea;
      const nc = linea && linea.match(/^nuevo_credito:(\d+)$/);
      if (nc) linea = `nuevo_credito:${base + Number(nc[1])}`;
      out.movs.push({ ...m, linea, parte: idx });
    });
    out.creditos.push(...p.creditos);
    if (p.aviso) out.avisos.push(p.aviso);
  });
  ['tipo', 'entidad', 'producto', 'titular', 'cuentaId', 'tarjetaId', 'desde', 'hasta', 'saldoInicial', 'saldoFinal', 'totalCargo', 'fechaCargo'].forEach((k) => { if (out.doc[k] === undefined) out.doc[k] = null; });
  return out;
}

export async function analizar({ sample, state, leido, pista, onPaso, signal }) {
  const ctx = contexto(state);
  const limites = typeof sample.limits === 'function' ? await sample.limits().catch(() => null) : null;
  const maxBytes = (limites && limites.maxPromptBytes) || 65536;
  const base = new TextEncoder().encode(instrucciones(ctx, pista, { n: 9, total: 9 })).length;
  const partes = [];
  if (leido.modo === 'texto') {
    const disponible = Math.max(6000, Math.min(26000, maxBytes - base - 1500));
    const trozos = trocear(leido.paginas, disponible);
    if (!trozos.length) throw Object.assign(new Error('vacio'), { code: 'sin_texto' });
    for (let n = 0; n < trozos.length; n++) {
      partes.push({ texto: trozos[n], n: n + 1, total: trozos.length });
    }
  } else {
    const max = (limites && limites.images && limites.images.maxCount) || 0;
    if (!max) throw Object.assign(new Error('imagenes'), { code: 'images_unavailable' });
    const imgs = leido.imagenes;
    const porLlamada = Math.max(1, Math.min(max, 4));
    const total = Math.ceil(imgs.length / porLlamada);
    for (let n = 0; n < total; n++) partes.push({ imagenes: imgs.slice(n * porLlamada, (n + 1) * porLlamada), n: n + 1, total });
  }
  const resultados = [];
  for (const p of partes) {
    const etiqueta = p.total > 1 ? ` (parte ${p.n} de ${p.total})` : '';
    onPaso && onPaso({ fase: 'ia', texto: `Analizando con la IA${etiqueta}…`, n: p.n, total: p.total, movs: 0 });
    const prompt = instrucciones(ctx, pista, p) + (p.texto ? `\n\nEXTRACTO:\n${p.texto}` : `\n\nLas imágenes adjuntas son ${p.imagenes.length > 1 ? 'páginas consecutivas del' : 'el'} extracto.`);
    const opts = {
      signal, modelTier: 'default',
      onText: ({ text }) => {
        const n = (text.match(/"f"\s*:/g) || []).length;
        onPaso && onPaso({ fase: 'ia', texto: `Analizando con la IA${etiqueta}… ${n} movimientos leídos`, n: p.n, total: p.total, movs: n });
      },
    };
    if (p.imagenes) opts.images = p.imagenes;
    const r = await sample.json(prompt, opts);
    resultados.push(normalizar(r));
  }
  return juntar(resultados);
}

export const MENSAJES_ERROR = {
  not_granted: 'No has permitido que esta app use Claude. Recarga la página para volver a intentarlo.',
  sampling_disabled: 'Claude no está disponible para tu cuenta desde esta app.',
  not_declared: 'Esta versión de la app no puede usar la IA.',
  capability_disabled: 'La IA no está disponible en esta vista.',
  capability_removed: 'Actualiza la app de Claude para usar el importador.',
  images_unavailable: 'Esta vista no admite imágenes. Sube el PDF o el Excel en lugar de una foto.',
  rate_limited: 'Has llegado al límite de uso por ahora. Prueba de nuevo en un rato.',
  session_expired: 'Tu sesión ha caducado. Vuelve a iniciar sesión en Claude.',
  image_rejected: 'La imagen no se pudo usar (formato o tamaño). Prueba con otra captura.',
  refused: 'La IA no pudo procesar este documento.',
  empty_completion: 'La IA no devolvió nada. Prueba de nuevo.',
  invalid_json: 'La respuesta de la IA llegó incompleta (el extracto puede ser muy largo). Prueba de nuevo o sube menos páginas.',
  prompt_too_large: 'El extracto es demasiado largo para una sola lectura. Súbelo por partes.',
  upstream_error: 'Falló la conexión con la IA. Prueba de nuevo.',
  sin_texto: 'No se encontró texto en el archivo.',
};
