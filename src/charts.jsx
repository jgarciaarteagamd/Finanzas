import React, { useState, useRef, useMemo, useEffect } from 'react';
import { eur0, mkShort, mkLabel } from './engine.js';

/* ---------- tooltip compartido ---------- */
function useTip() {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (e, content) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const x = Math.max(80, Math.min(box.width - 80, e.clientX - box.left));
    setTip({ x, y: e.clientY - box.top, content });
  };
  const hide = () => setTip(null);
  const node = tip ? <div className="tip" style={{ left: tip.x, top: tip.y }}>{tip.content}</div> : null;
  return { ref, show, hide, node };
}

function useWidth(ref, fallback) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const upd = () => { const x = Math.round(el.getBoundingClientRect().width); if (x > 0) setW(x); };
    upd();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(upd); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  const n = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => f <= x) || 10;
  return n * p;
}
const kfmt = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} k` : `${Math.round(v)}`);

/* ============================================================
   Barras mensuales apiladas (o con signo, para una sola serie)
   series: [{ mk, estado, values: {key: n} }]
   ============================================================ */
export function MonthBars({ series, keys, colorOf, labelOf, height = 220, signed = false, markers = [], valueLabel }) {
  const tip = useTip();
  const W = useWidth(tip.ref, 760), H = height, padL = 44, padR = 8, padT = 22, padB = 26;
  const totals = series.map((s) => keys.reduce((a, k) => a + Math.max(0, s.values[k] || 0), 0));
  const mins = series.map((s) => (signed ? Math.min(0, ...keys.map((k) => s.values[k] || 0)) : 0));
  const maxV = niceMax(Math.max(1, ...totals, ...series.map((s) => Math.max(0, ...keys.map((k) => s.values[k] || 0)))));
  const minV = signed ? -niceMax(Math.max(0, ...mins.map((m) => -m))) * (Math.min(...mins) < 0 ? 1 : 0) : 0;
  const span = maxV - minV || 1;
  const y = (v) => padT + ((maxV - v) / span) * (H - padT - padB);
  const n = series.length;
  const band = (W - padL - padR) / n;
  const bw = Math.min(38, band * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => minV + t * span);
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((W - padL) / 52))));

  return (
    <div className="chart" ref={tip.ref} onMouseLeave={tip.hide}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={valueLabel || 'Gráfico mensual'}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="gridline" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} strokeDasharray={Math.abs(t) < 0.001 ? '' : '2 4'} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end">{kfmt(t)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const cx = padL + band * i + band / 2;
          const proj = s.estado === 'proyectado';
          let acc = 0;
          const segs = keys.map((k) => {
            const v = s.values[k] || 0;
            if (signed) {
              const y0 = y(Math.max(0, v)), y1 = y(Math.min(0, v));
              return { k, v, top: y0, h: Math.max(v === 0 ? 0 : 1.5, y1 - y0) };
            }
            if (v <= 0) return null;
            const top = y(acc + v), h = y(acc) - top;
            acc += v;
            return { k, v, top, h };
          }).filter(Boolean);
          const visibles = segs.filter((sg) => sg.h > 0);
          return (
            <g key={s.mk} opacity={proj ? 0.55 : 1}
              onMouseMove={(e) => tip.show(e, (
                <div>
                  <div style={{ marginBottom: 4 }}><b>{mkLabel(s.mk)}</b> · {s.estado}</div>
                  {keys.filter((k) => (s.values[k] || 0) !== 0).map((k) => (
                    <div className="tr" key={k}><span><span className="swatch" style={{ background: colorOf(k), marginRight: 6 }} />{labelOf(k)}</span><b>{eur0(s.values[k])}</b></div>
                  ))}
                  {!signed && keys.length > 1 && <div className="tr" style={{ borderTop: '1px solid rgba(255,255,255,.2)', marginTop: 4, paddingTop: 4 }}><span>Total</span><b>{eur0(totals[i])}</b></div>}
                </div>
              ))}>
              <rect x={cx - band / 2} y={padT} width={band} height={H - padT - padB} fill="transparent" />
              {visibles.map((sg, j) => {
                const last = j === visibles.length - 1;
                const r = last || signed ? 4 : 0;
                const gap = !last && !signed ? 2 : 0;
                const h = Math.max(0, sg.h - gap);
                const neg = signed && sg.v < 0;
                const top = neg ? sg.top : sg.top + (last || signed ? 0 : gap);
                return <path key={sg.k} d={roundedBar(cx - bw / 2, top, bw, h, neg ? 0 : r, neg ? r : 0)} fill={colorOf(sg.k, sg.v)} />;
              })}
              {i % step === 0 && <text x={cx} y={H - 8} textAnchor="middle">{mkShort(s.mk)}</text>}
            </g>
          );
        })}
        {markers.map((m, i) => {
          const idx = series.findIndex((s) => s.mk === m.mk);
          if (idx < 0) return null;
          const cx = padL + band * idx + band / 2;
          return (
            <g key={i}>
              <line x1={cx} x2={cx} y1={padT - 6} y2={H - padB} stroke="var(--ink-2)" strokeDasharray="3 3" />
              <text x={cx > W * 0.7 ? cx - 5 : cx + 5} y={padT - 8} textAnchor={cx > W * 0.7 ? 'end' : 'start'} style={{ fill: 'var(--ink-2)', fontWeight: 800 }}>{m.label}</text>
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}
function roundedBar(x, y, w, h, rt, rb) {
  if (h <= 0) return '';
  rt = Math.min(rt, h / 2, w / 2); rb = Math.min(rb, h / 2, w / 2);
  return `M${x},${y + rt} a${rt},${rt} 0 0 1 ${rt},${-rt} h${w - 2 * rt} a${rt},${rt} 0 0 1 ${rt},${rt} v${h - rt - rb} a${rb},${rb} 0 0 1 ${-rb},${rb} h${-(w - 2 * rb)} a${rb},${rb} 0 0 1 ${-rb},${-rb} z`;
}

/* ============================================================
   Barras agrupadas: ingresos vs gastos por mes, con superávit
   ============================================================ */
export function InOutBars({ series, height = 240 }) {
  const tip = useTip();
  const W = useWidth(tip.ref, 760), H = height, padL = 44, padR = 8, padT = 14, padB = 26;
  const maxV = niceMax(Math.max(1, ...series.map((s) => Math.max(s.ingresos, s.gastos))));
  const y = (v) => padT + ((maxV - v) / maxV) * (H - padT - padB);
  const n = series.length;
  const band = (W - padL - padR) / n;
  const bw = Math.min(16, band * 0.3);
  const step = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((W - padL) / 52))));
  return (
    <div className="chart" ref={tip.ref} onMouseLeave={tip.hide}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos y gastos por mes">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}><line className="gridline" x1={padL} x2={W - padR} y1={y(t * maxV)} y2={y(t * maxV)} strokeDasharray={t ? '2 4' : ''} /><text x={padL - 8} y={y(t * maxV) + 4} textAnchor="end">{kfmt(t * maxV)}</text></g>
        ))}
        {series.map((s, i) => {
          const cx = padL + band * i + band / 2;
          const proj = s.estado === 'proyectado';
          return (
            <g key={s.mk} opacity={proj ? 0.55 : 1} onMouseMove={(e) => tip.show(e, (
              <div>
                <div style={{ marginBottom: 4 }}><b>{mkLabel(s.mk)}</b> · {s.estado}</div>
                <div className="tr"><span>Ingresos</span><b>{eur0(s.ingresos)}</b></div>
                <div className="tr"><span>Gastos</span><b>{eur0(s.gastos)}</b></div>
                <div className="tr"><span>Superávit</span><b>{eur0(s.superavit)}</b></div>
              </div>
            ))}>
              <rect x={cx - band / 2} y={padT} width={band} height={H - padT - padB} fill="transparent" />
              <path d={roundedBar(cx - bw - 1, y(s.ingresos), bw, y(0) - y(s.ingresos), 4, 0)} fill="var(--in)" />
              <path d={roundedBar(cx + 1, y(s.gastos), bw, y(0) - y(s.gastos), 4, 0)} fill="var(--out)" />
              <circle cx={cx} cy={y(Math.max(0, s.superavit))} r={4.5} fill={s.superavit >= 0 ? 'var(--sur)' : 'var(--crit)'} stroke="var(--surface)" strokeWidth="2" />
              {i % step === 0 && <text x={cx} y={H - 8} textAnchor="middle">{mkShort(s.mk)}</text>}
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}

/* ============================================================
   Flujo del dinero (Sankey de 3 columnas)
   ============================================================ */
export function Sankey({ data, height = 400 }) {
  const tip = useTip();
  const W = Math.max(640, useWidth(tip.ref, 900)), H = height, nw = 12, pad = 12, minSlot = 30;
  const layout = useMemo(() => {
    const nodes = data.nodes.map((n) => ({ ...n, inV: 0, outV: 0 }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    data.links.forEach((l) => { byId[l.from].outV += l.value; byId[l.to].inV += l.value; });
    nodes.forEach((n) => { n.value = Math.max(n.inV, n.outV); });
    const cols = [0, 1, 2].map((c) => nodes.filter((n) => n.col === c));
    cols[0].sort((a, b) => (a.kind === 'saldo') - (b.kind === 'saldo') || b.value - a.value);
    cols[1].sort((a, b) => b.value - a.value);
    cols[2].sort((a, b) => (a.kind === 'superavit') - (b.kind === 'superavit') || (a.slot || 9) - (b.slot || 9) || b.value - a.value);
    const colTotal = Math.max(...cols.map((c) => c.reduce((s, n) => s + n.value, 0)), 1);
    const maxCount = Math.max(...cols.map((c) => c.length));
    const scale = Math.max(0.01, (H - 20 - pad * (maxCount - 1) - minSlot * 0.4 * maxCount) / colTotal);
    const xs = [0, W / 2 - nw / 2, W - nw];
    cols.forEach((c, ci) => {
      const hs = c.map((n) => Math.max(2, n.value * scale));
      const slots = hs.map((h) => Math.max(h, minSlot));
      const tot = slots.reduce((a, b) => a + b, 0) + pad * (c.length - 1);
      let yy = Math.max(10, (H - tot) / 2);
      c.forEach((n, i) => { n.x = xs[ci]; n.h = hs[i]; n.y = yy + (slots[i] - hs[i]) / 2; yy += slots[i] + pad; });
    });
    const links = data.links.map((l) => ({ ...l, s: byId[l.from], t: byId[l.to], w: Math.max(1, l.value * scale) }));
    nodes.forEach((n) => {
      let o = 0; links.filter((l) => l.s === n).sort((a, b) => a.t.y - b.t.y).forEach((l) => { l.sy = n.y + o + l.w / 2; o += l.w; });
      let i = 0; links.filter((l) => l.t === n).sort((a, b) => a.s.y - b.s.y).forEach((l) => { l.ty = n.y + i + l.w / 2; i += l.w; });
    });
    const bottom = Math.max(...nodes.map((n) => n.y + Math.max(n.h, minSlot)), H);
    return { nodes, links, bottom };
  }, [data, H, W]);

  const colorLink = (l) => (l.kind === 'ingreso' ? 'var(--in)' : l.kind === 'saldo' ? 'var(--s0)' : l.kind === 'superavit' ? 'var(--sur)' : `var(--s${l.t.slot ?? 0})`);
  const colorNode = (n) => (n.kind === 'ingreso' ? 'var(--in)' : n.kind === 'saldo' ? 'var(--s0)' : n.kind === 'superavit' ? 'var(--sur)' : n.kind === 'cuenta' ? 'var(--ink-2)' : `var(--s${n.slot ?? 0})`);
  const Hh = Math.ceil(layout.bottom + 8);
  return (
    <div className="chart sankey-wrap" ref={tip.ref} onMouseLeave={tip.hide} style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${Hh}`} style={{ width: W, maxWidth: 'none' }} role="img" aria-label="Flujo del dinero: de dónde viene, por qué cuenta pasa y a dónde va">
        {layout.links.map((l, i) => {
          const x0 = l.s.x + nw, x1 = l.t.x, xm = (x0 + x1) / 2;
          return (
            <path key={i} className="sankey-link" d={`M${x0},${l.sy} C${xm},${l.sy} ${xm},${l.ty} ${x1},${l.ty}`} fill="none"
              stroke={colorLink(l)} strokeOpacity={0.38} strokeWidth={l.w}
              onMouseMove={(e) => tip.show(e, <div><b>{l.s.label}</b> → <b>{l.t.label}</b><div className="tr"><span>Importe</span><b>{eur0(l.value)}</b></div></div>)} />
          );
        })}
        {layout.nodes.map((n) => {
          const left = n.col === 2;
          const tx = left ? n.x - 8 : n.x + nw + 8;
          const cy = n.y + n.h / 2;
          return (
            <g key={n.id} onMouseMove={(e) => tip.show(e, <div><b>{n.label}</b><div className="tr"><span>{n.col === 1 ? 'Entra' : n.col === 0 ? 'Aporta' : 'Recibe'}</span><b>{eur0(n.col === 1 ? n.inV : n.value)}</b></div>{n.col === 1 && <div className="tr"><span>Sale</span><b>{eur0(n.outV)}</b></div>}</div>)}>
              <rect x={n.x} y={n.y} width={nw} height={n.h} rx={3} fill={colorNode(n)} />
              <text x={tx} y={cy - 2} textAnchor={left ? 'end' : 'start'} style={{ fill: 'var(--ink)', fontWeight: 700, fontSize: 12.5, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' }}>{n.label}</text>
              <text x={tx} y={cy + 13} textAnchor={left ? 'end' : 'start'} style={{ fill: 'var(--ink-2)', fontWeight: 600, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4, strokeLinejoin: 'round' }}>{eur0(n.value)}</text>
            </g>
          );
        })}
      </svg>
      {tip.node}
    </div>
  );
}

/* ---------- barra 100 % en HTML ---------- */
export function StackBar({ parts, tall = false }) {
  const tot = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return (
    <div className={`bar ${tall ? 'tall' : ''}`} role="img" aria-label={parts.map((p) => `${p.label}: ${eur0(p.value)}`).join(', ')}>
      {parts.filter((p) => p.value > 0).map((p) => <span key={p.key} title={`${p.label}: ${eur0(p.value)}`} style={{ width: `${(p.value / tot) * 100}%`, background: p.color }} />)}
    </div>
  );
}

/* ---------- mini serie de saldos (inicio → medio → fin) ---------- */
export function SaldoSpark({ puntos, width = 160, height = 44 }) {
  const vals = puntos.map((p) => p.v);
  const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
  const span = max - min || 1;
  const x = (i) => 6 + (i / (puntos.length - 1)) * (width - 12);
  const y = (v) => 6 + ((max - v) / span) * (height - 12);
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ display: 'block', maxWidth: '100%' }} aria-hidden="true">
      <line x1="0" x2={width} y1={y(0)} y2={y(0)} stroke="var(--line-2)" strokeDasharray="2 3" />
      <path d={`${d} L${x(puntos.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="var(--brand)" opacity=".1" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2" />
      {puntos.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r={i === puntos.length - 1 ? 4 : 2.5} fill={p.v < 0 ? 'var(--crit)' : 'var(--brand)'} stroke="var(--surface)" strokeWidth="1.5" />)}
    </svg>
  );
}
