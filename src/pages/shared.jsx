import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CreditCard, Landmark, ArrowLeftRight, Banknote } from 'lucide-react';
import * as E from '../engine.js';
import { StackBar } from '../charts.jsx';

export const colorArea = (key) => `var(--s${E.areaDe(key).slot})`;
export const COLOR_MEDIO = { recibo: 'var(--m1)', tarjeta: 'var(--m2)', transferencia: 'var(--m3)', efectivo: 'var(--m4)' };
export const ICONO_MEDIO = { recibo: Landmark, tarjeta: CreditCard, transferencia: ArrowLeftRight, efectivo: Banknote };

/* Lista de categorías con barra, % y desplegable de subcategorías */
export function AreaList({ porArea, total, abiertas: abiertasIni = [], max, onPick, compact = false }) {
  const [abiertas, setAbiertas] = useState(new Set(abiertasIni));
  const lista = max ? porArea.slice().sort((a, b) => b.importe - a.importe).slice(0, max) : porArea.slice().sort((a, b) => b.importe - a.importe);
  const top = Math.max(...lista.map((a) => a.importe), 1);
  const toggle = (k) => setAbiertas((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div className="arealist">
      {lista.map((a) => {
        const open = abiertas.has(a.key);
        const Chev = open ? ChevronDown : ChevronRight;
        return (
          <div key={a.key}>
            <button className="arearow" onClick={() => (onPick ? onPick(a.key) : toggle(a.key))} aria-expanded={onPick ? undefined : open}>
              <span className="nm">{!onPick && !compact && <Chev size={15} className="muted" />}<span className="swatch" style={{ background: colorArea(a.key) }} /><span className="t">{a.label}</span></span>
              <span className="vl">{E.eur0(a.importe)}<small>{total > 0 ? E.pct((a.importe / total) * 100) : ''}</small></span>
              <div className="bar"><span style={{ width: `${(a.importe / top) * 100}%`, background: colorArea(a.key) }} /></div>
            </button>
            {open && !onPick && (
              <div className="subrows">
                {a.subs.map((s) => (
                  <div key={s.sub}>
                    <div className="subrow"><b>{s.sub}</b><span className="num">{E.eur0(s.importe)}</span></div>
                    <div className="subrow items"><span>{s.items.map((i) => i.nombre).join(' · ')}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Cómo sale el dinero: por medio de pago, con el detalle de tarjetas */
export function MedioList({ state, porMedio, total }) {
  const colores = COLOR_MEDIO;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <StackBar tall parts={porMedio.map((m) => ({ key: m.key, label: m.label, value: m.importe, color: colores[m.key] }))} />
      {porMedio.map((m) => {
        const I = ICONO_MEDIO[m.key];
        return (
          <div key={m.key} className="stack" style={{ gap: 4 }}>
            <div className="row between">
              <span className="row" style={{ gap: 8, fontWeight: 700 }}><span className="swatch" style={{ background: colores[m.key] }} /><I size={15} className="muted" />{m.label}</span>
              <span className="num" style={{ fontWeight: 800 }}>{E.eur0(m.importe)} <span className="muted small">{total > 0 ? E.pct((m.importe / total) * 100) : ''}</span></span>
            </div>
            {m.key === 'tarjeta' && m.lineas.map((l) => (
              <div key={l.key} className="row between small" style={{ paddingLeft: 24 }}>
                <span className="ink2">{l.nombre} <span className="muted">· {l.confirmado ? 'real' : 'estimado'}</span></span>
                <span className="num">{E.eur0(l.importe)}</span>
              </div>
            ))}
            {m.key !== 'tarjeta' && (
              <div className="small muted" style={{ paddingLeft: 24 }}>{m.lineas.slice().sort((a, b) => b.importe - a.importe).slice(0, 4).map((l) => `${l.nombre} ${E.eur0(l.importe)}`).join(' · ')}{m.lineas.length > 4 ? ` · y ${m.lineas.length - 4} más` : ''}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LegendAreas({ keys }) {
  return (
    <div className="legend">
      {keys.map((k) => <span key={k}><span className="swatch" style={{ background: colorArea(k) }} />{E.areaDe(k).label}</span>)}
    </div>
  );
}
