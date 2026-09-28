/* ============================================================
   Adaptador: pone la API de Gemini (Google) detrás de la MISMA
   forma que usa src/importar/ia.js cuando pide
   `window.claude.use('sample')` dentro de un artefacto de Claude.
   Gracias a esto, ia.js no necesita ningún cambio.

     sample(input, opts) → { text, truncated, modelTierApplied }
     sample.json(input, opts) → el JSON ya interpretado
     sample.limits() → { maxPromptBytes, images, tools }

   No hay "consentimiento" que pedir (la clave es tuya, no de un
   tercero), así que cada llamada se hace directamente. Tampoco hay
   caché ni streaming de verdad: se pide todo de una vez y se avisa
   a `onText` una sola vez con la respuesta completa, tal como
   describe el contrato de `sample` para una respuesta no progresiva.
   ============================================================ */
import { GEMINI_API_KEY } from './config.js';

const MODELOS = { quick: 'gemini-2.5-flash-lite', default: 'gemini-2.5-flash', complex: 'gemini-2.5-pro' };
// Si Google renombra o retira alguno de estos modelos, actualiza este
// mapa (Google AI Studio, https://aistudio.google.com, lista los
// modelos disponibles con su nombre exacto).

async function blobABase64(blob) {
  const buf = await blob.arrayBuffer();
  let bin = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function aTurnosGemini(input) {
  if (typeof input === 'string') return [{ role: 'user', parts: [{ text: input }] }];
  return input.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] }));
}

async function llamar(input, opts, comoJson) {
  if (!GEMINI_API_KEY) throw { code: 'not_declared', message: 'Falta la clave de Gemini' };
  if (opts && opts.tools) throw { code: 'tools_unavailable', message: 'Esta versión no ejecuta herramientas' };
  const contents = aTurnosGemini(input);
  if (opts && opts.images) {
    const lista = opts.images instanceof Blob ? [opts.images] : Array.from(opts.images);
    const partes = await Promise.all(lista.map(async (b) => ({ inline_data: { mime_type: b.type || 'image/jpeg', data: await blobABase64(b) } })));
    contents[contents.length - 1].parts.push(...partes);
  }
  const modelo = MODELOS[(opts && opts.modelTier) || 'default'] || MODELOS.default;
  const body = { contents, generationConfig: comoJson ? { responseMimeType: 'application/json' } : {} };
  let res;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: opts && opts.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelado' };
    throw { code: 'upstream_error', message: String(e) };
  }
  if (!res.ok) {
    const code = res.status === 429 ? 'rate_limited' : res.status === 400 ? 'invalid_request' : res.status === 401 || res.status === 403 ? 'not_granted' : 'upstream_error';
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j?.error?.message || msg; } catch (e) { /* sin cuerpo */ }
    throw { code, message: msg };
  }
  const j = await res.json();
  const cand = j.candidates && j.candidates[0];
  const texto = ((cand && cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
  if (!texto.trim()) throw { code: 'empty_completion', message: 'Gemini no devolvió texto' };
  const truncated = cand && cand.finishReason === 'MAX_TOKENS';
  if (opts && opts.onText) opts.onText({ text: texto, delta: texto });
  return { text: texto, truncated: !!truncated, modelTierApplied: (opts && opts.modelTier) || 'default' };
}

function extraerJson(texto) {
  try { return JSON.parse(texto); } catch (e) { /* sigue */ }
  const valla = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (valla) { try { return JSON.parse(valla[1]); } catch (e) { /* sigue */ } }
  const ini = Math.min(...['{', '['].map((c) => { const i = texto.indexOf(c); return i === -1 ? Infinity : i; }));
  const finLlave = texto.lastIndexOf('}'); const finCorch = texto.lastIndexOf(']');
  const fin = Math.max(finLlave, finCorch);
  if (Number.isFinite(ini) && fin > ini) { try { return JSON.parse(texto.slice(ini, fin + 1)); } catch (e) { /* sigue */ } }
  throw { code: 'invalid_json', message: 'Sin JSON en la respuesta', text: texto };
}

export function crearSample() {
  const sample = async (input, opts) => llamar(input, opts, false);
  sample.json = async (input, opts) => {
    const r = await llamar(input, opts, true);
    try { return extraerJson(r.text); }
    catch (e) { throw { ...e, text: r.text }; }
  };
  sample.limits = async () => ({
    maxPromptBytes: 400000,
    images: { maxCount: 16, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  });
  return sample;
}
