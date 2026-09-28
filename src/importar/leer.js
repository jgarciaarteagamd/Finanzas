/* ============================================================
   Lectura de archivos de extractos en el navegador.
   - PDF: pdf.js (texto por líneas; si no hay texto, se rasteriza).
   - Excel / CSV: SheetJS → CSV por hoja.
   - Imágenes: se envían tal cual a la IA.
   Las librerías se cargan solo cuando hacen falta.
   ============================================================ */
const CDN = {
  pdf: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
};
const cargados = new Map();
function script(src) {
  if (cargados.has(src)) return cargados.get(src);
  const p = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => res();
    s.onerror = () => { cargados.delete(src); rej(new Error('No se pudo cargar el lector de archivos. Revisa la conexión.')); };
    document.head.appendChild(s);
  });
  cargados.set(src, p);
  return p;
}
async function pdfjs() {
  // El worker se carga como script normal: pdf.js lo usa en el hilo principal.
  await script(CDN.pdf);
  await script(CDN.pdfWorker);
  const lib = window.pdfjsLib;
  if (!lib) throw new Error('No se pudo iniciar el lector de PDF.');
  return lib;
}
async function sheetjs() { await script(CDN.xlsx); if (!window.XLSX) throw new Error('No se pudo iniciar el lector de Excel.'); return window.XLSX; }

export const tipoArchivo = (f) => {
  const n = (f.name || '').toLowerCase();
  if (f.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (/\.(xlsx|xls|xlsm|ods)$/.test(n)) return 'excel';
  if (/\.(csv|txt|tsv)$/.test(n) || f.type === 'text/csv' || f.type === 'text/plain') return 'texto';
  if (/^image\/(jpeg|png|webp|gif)$/.test(f.type) || /\.(jpe?g|png|webp|gif)$/.test(n)) return 'imagen';
  if (/\.(heic|heif)$/.test(n)) return 'heic';
  return null;
};

/* Reconstruye líneas a partir de los trozos de texto de una página. */
function lineasPagina(items) {
  const filas = [];
  items.forEach((it) => {
    const str = String(it.str || '');
    if (!str.trim()) return;
    const x = it.transform[4], y = it.transform[5];
    const h = Math.abs(it.transform[3]) || 8;
    let f = filas.find((r) => Math.abs(r.y - y) <= Math.max(2, h * 0.45));
    if (!f) { f = { y, h, partes: [] }; filas.push(f); }
    f.partes.push({ x, w: it.width || str.length * h * 0.5, str });
  });
  filas.sort((a, b) => b.y - a.y);
  return filas.map((f) => {
    f.partes.sort((a, b) => a.x - b.x);
    let out = '', finX = null;
    f.partes.forEach((p) => {
      if (finX !== null) { const gap = p.x - finX; out += gap > f.h * 1.2 ? '  |  ' : gap > f.h * 0.15 ? ' ' : ''; }
      out += p.str; finX = p.x + p.w;
    });
    return out.replace(/\s+\|\s+\|\s+/g, '  |  ').trim();
  }).filter(Boolean);
}

async function leerPdf(file, onPaso, signal) {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let doc;
  try { doc = await lib.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise; }
  catch (e) {
    if (e && e.name === 'PasswordException') throw new Error('El PDF está protegido con contraseña. Descárgalo sin contraseña desde tu banco o haz una captura.');
    throw new Error('No se pudo abrir el PDF.');
  }
  const paginas = [];
  let chars = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    if (signal && signal.aborted) throw new DOMException('cancelado', 'AbortError');
    onPaso && onPaso(`Leyendo página ${p} de ${doc.numPages}`);
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const ls = lineasPagina(tc.items);
    chars += ls.join('').length;
    paginas.push(ls.join('\n'));
  }
  // PDF escaneado (sin texto): se convierte cada página en imagen
  if (chars < 40 * doc.numPages) {
    const imagenes = [];
    for (let p = 1; p <= Math.min(doc.numPages, 12); p++) {
      onPaso && onPaso(`Preparando imagen de la página ${p}`);
      const page = await doc.getPage(p);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1600 / Math.max(vp0.width, vp0.height));
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      imagenes.push(await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.85)));
    }
    return { modo: 'imagenes', imagenes, paginas: doc.numPages };
  }
  return { modo: 'texto', paginas, npaginas: doc.numPages };
}

async function leerExcel(file) {
  const X = await sheetjs();
  const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: 'array', cellDates: true });
  const paginas = wb.SheetNames.map((n) => {
    const csv = X.utils.sheet_to_csv(wb.Sheets[n], { FS: ' | ', blankrows: false, dateNF: 'yyyy-mm-dd' });
    const limpio = csv.split('\n').map((l) => l.replace(/(\s\|\s)+$/g, '').trim()).filter((l) => l.replace(/[|\s]/g, '')).join('\n');
    return limpio ? `### Hoja: ${n}\n${limpio}` : '';
  }).filter(Boolean);
  return { modo: 'texto', paginas };
}

async function leerTexto(file) {
  const buf = await file.arrayBuffer();
  let t = new TextDecoder('utf-8').decode(buf);
  if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf);
  const lineas = t.split(/\r?\n/).filter((l) => l.trim());
  const paginas = [];
  for (let i = 0; i < lineas.length; i += 120) paginas.push(lineas.slice(i, i + 120).join('\n'));
  return { modo: 'texto', paginas };
}

export async function leerArchivo(file, onPaso, signal) {
  const t = tipoArchivo(file);
  if (t === 'pdf') return leerPdf(file, onPaso, signal);
  if (t === 'excel') { onPaso && onPaso('Leyendo la hoja de cálculo'); return leerExcel(file); }
  if (t === 'texto') { onPaso && onPaso('Leyendo el archivo'); return leerTexto(file); }
  if (t === 'imagen') return { modo: 'imagenes', imagenes: [file] };
  if (t === 'heic') throw new Error('Las fotos HEIC del iPhone no se pueden leer aquí. Haz una captura de pantalla (PNG) o exporta la foto como JPG.');
  throw new Error('Formato no admitido. Usa PDF, Excel, CSV o una imagen (JPG/PNG).');
}

/* Parte el texto en trozos que quepan en una llamada. */
export function trocear(paginas, maxBytes) {
  const enc = new TextEncoder();
  const trozos = [];
  let cur = '';
  const push = () => { if (cur.trim()) trozos.push(cur); cur = ''; };
  paginas.forEach((pg, i) => {
    const bloque = `\n--- página ${i + 1} ---\n${pg}`;
    if (enc.encode(cur + bloque).length <= maxBytes) { cur += bloque; return; }
    push();
    if (enc.encode(bloque).length <= maxBytes) { cur = bloque; return; }
    // página enorme: por líneas
    bloque.split('\n').forEach((l) => {
      if (enc.encode(cur + '\n' + l).length > maxBytes) push();
      cur += '\n' + l;
    });
  });
  push();
  return trozos;
}
