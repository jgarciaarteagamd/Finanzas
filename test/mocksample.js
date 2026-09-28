// IA simulada para pruebas locales: devuelve respuestas fijas según el extracto.
(function () {
  window.__prompts = [];
  const cuenta = {
    doc: { tipo: 'cuenta', entidad: 'Banco Santander', producto: 'Cuenta Nómina', titular: 'Juan García', cuentaId: 'cta-santander-juan', desde: '2026-09-01', hasta: '2026-09-28', saldoInicial: 2000, saldoFinal: 3196.71 },
    movs: [
      { f: '2026-09-01', c: 'TRANSFERENCIA ALQUILER SEPTIEMBRE', m: 'Alquiler', i: -850, k: 'transferencia', l: 'gas-10', a: 'vivienda', s: 'Alquiler', r: 0, b: 1150 },
      { f: '2026-09-02', c: 'RECIBO ENDESA ENERGIA', m: 'Endesa', i: -31.2, k: 'recibo', l: 'gas-13', a: 'vivienda', s: 'Suministros', r: 0, b: 1118.8 },
      { f: '2026-09-02', c: 'RECIBO RCI BANQUE NISSAN QASHQAI', m: 'RCI Banque', i: -245.1, k: 'cuota_credito', l: 'credito:cre-qashqai', a: 'creditos', s: '', r: 0, b: 873.7 },
      { f: '2026-09-03', c: 'COMPRA TARJ. DEBITO MERCADONA HUELVA', m: 'Mercadona', i: -54.1, k: 'compra', l: null, a: 'alimentacion', s: 'Supermercado', r: 0, b: 819.6 },
      { f: '2026-09-05', c: 'RECIBO SPOTIFY AB', m: 'Spotify', i: -10.99, k: 'recibo', l: null, a: 'otros', s: 'Streaming', r: 1, b: 808.61 },
      { f: '2026-09-06', c: 'RECIBO CETELEM PRESTAMO', m: 'Cetelem', i: -199.5, k: 'cuota_credito', l: 'nuevo_credito:0', a: 'creditos', s: '', r: 1, b: 609.11 },
      { f: '2026-09-15', c: 'TRANSF. RECIBIDA OTOSUR SL HONORARIOS', m: 'Otosur', i: 3900, k: 'transferencia', l: 'ing-02', a: 'trabajo', s: '', r: 0, b: 4509.11 },
      { f: '2026-09-16', c: 'TRASPASO A CUENTA BBVA AHORRO', m: 'BBVA', i: -500, k: 'traspaso', l: null, a: 'otros', s: '', r: 0, b: 4009.11 },
      { f: '2026-09-27', c: 'LIQUIDACION TARJETA MASTERCARD', m: 'Santander', i: -812.4, k: 'cargo_tarjeta', l: 'tarjeta:tar-mastercard-santander', a: 'otros', s: '', r: 0, b: 3196.71 },
    ],
    creditos: [{ id: null, nombre: 'Préstamo Cetelem', entidad: 'Cetelem', cuota: 199.5, fechaFin: '2028-06', capitalPendiente: 4200, cuotaFinal: null, notas: '' }, { id: 'cre-qashqai', nombre: 'Nissan Qashqai', cuota: 245.1 }],
    aviso: '',
  };
  const tarjeta = {
    doc: { tipo: 'tarjeta', entidad: 'Santander', producto: 'MasterCard', titular: '', cuentaId: null, tarjetaId: null, desde: '2026-08-28', hasta: '2026-09-15', totalCargo: 812.4, fechaCargo: null },
    movs: [
      { f: '2026-08-28', c: 'MERCADONA HUELVA', m: 'Mercadona', i: -120.5, k: 'compra', l: 'gas-26', a: 'alimentacion', s: 'Supermercado', r: 0, b: null },
      { f: '2026-09-02', c: 'NETFLIX.COM', m: 'Netflix', i: -15, k: 'compra', l: 'gas-28', a: 'otros', s: 'Streaming', r: 0, b: null },
      { f: '2026-09-04', c: 'FARMACIA LOPEZ', m: 'Farmacia López', i: -38.2, k: 'compra', l: 'gas-41', a: 'salud', s: 'Farmacia', r: 0, b: null },
      { f: '2026-09-10', c: 'ZARA HUELVA', m: 'Zara', i: -640, k: 'compra', l: null, a: 'otros', s: 'Ropa', r: 0, b: null },
      { f: '2026-09-12', c: 'DEVOLUCION ZARA', m: 'Zara', i: 1.3, k: 'devolucion', l: null, a: 'otros', s: 'Ropa', r: 0, b: null },
      { f: '2026-09-15', c: 'PAGO RECIBIDO GRACIAS', m: '', i: 700, k: 'cargo_tarjeta', l: null, a: 'otros', s: '', r: 0, b: null },
    ],
    creditos: [], aviso: 'No aparece la fecha de cargo en la cuenta.',
  };
  const sample = async function () { throw { code: 'invalid_request', message: 'usa json' }; };
  sample.limits = async () => ({ maxPromptBytes: 65536, images: { maxCount: 5, maxInputBytes: 20e6, mediaTypes: ['image/jpeg', 'image/png'] } });
  sample.json = (prompt, opts = {}) => new Promise((res, rej) => {
    window.__prompts.push(prompt);
    if (window.__SAMPLE_FAIL__) { setTimeout(() => rej({ code: window.__SAMPLE_FAIL__, message: 'x' }), 50); return; }
    const r = /MERCADONA HUELVA\s*\|?\s*-?120/.test(prompt) || prompt.includes('NETFLIX') ? tarjeta : cuenta;
    const txt = JSON.stringify(r);
    setTimeout(() => opts.onText && opts.onText({ text: txt.slice(0, 200), delta: txt.slice(0, 200) }), 80);
    const t = setTimeout(() => { opts.onText && opts.onText({ text: txt, delta: txt.slice(200) }); res(JSON.parse(txt)); }, 400);
    if (opts.signal) opts.signal.addEventListener('abort', () => { clearTimeout(t); rej({ code: 'cancelled', message: 'c' }); });
  });
  const prevUse = window.claude.use;
  window.claude.use = async (n) => (n === 'sample' ? (window.__NOSAMPLE__ ? null : sample) : prevUse(n));
})();
