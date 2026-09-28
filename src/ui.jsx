import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { eur, eur0, num } from './engine.js';

export const slotVar = (slot) => `var(--s${slot})`;

export function Card({ title, sub, actions, children, className = '', style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || actions) && (
        <div className="card-head">
          <div className="grow">
            {title && <h2>{title}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {actions && <div className="row wrap" style={{ justifyContent: 'flex-end' }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, lead, children }) {
  return (
    <div className="pagehead">
      <div className="grow">
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
  );
}

export function Kpi({ tone, icon: Icon, label, value, foot }) {
  return (
    <div className={`kpi ${tone}`}>
      <div className="k-top"><span className="k-ico">{Icon && <Icon size={16} strokeWidth={2.4} />}</span>{label}</div>
      <div className="k-val">{value}</div>
      {foot && <div className="k-foot">{foot}</div>}
    </div>
  );
}

export function Delta({ now, prev, invert = false, suffix = '' }) {
  if (prev === undefined || prev === null || !Number.isFinite(prev) || Math.abs(prev) < 1) return null;
  const d = now - prev;
  if (Math.abs(d) < 1) return <span className="delta">= que el mes anterior</span>;
  const good = invert ? d < 0 : d > 0;
  return <span className={`delta ${good ? 'up' : 'down'}`}>{d > 0 ? '▲' : '▼'} {eur0(Math.abs(d))}{suffix}</span>;
}

export function Seg({ value, options, onChange, ariaLabel }) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} className={value === o.key ? 'on' : ''} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Drawer({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-h"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
        <div className="drawer-b">{children}</div>
        {footer && <div className="drawer-f">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

const ICONOS_ALERTA = { critico: AlertOctagon, aviso: AlertTriangle, info: Info };
export function Alerta({ a, onClick }) {
  const I = ICONOS_ALERTA[a.nivel] || Info;
  const inner = (
    <>
      <span className="a-ico"><I size={16} strokeWidth={2.4} /></span>
      <div className="grow"><div className="a-t">{a.titulo}</div>{a.texto && <div className="a-x">{a.texto}</div>}</div>
    </>
  );
  return onClick
    ? <button className={`alert ${a.nivel}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={onClick}>{inner}</button>
    : <div className={`alert ${a.nivel}`}>{inner}</div>;
}

/* Importe editable en línea: muestra el valor; al pulsar, un campo. */
export function Editable({ value, onSave, className = 'amt', format = eur, placeholder, ariaLabel }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (edit && ref.current) { ref.current.focus(); ref.current.select(); } }, [edit]);
  const commit = () => {
    const n = num(v);
    setEdit(false);
    if (v.trim() === '') { onSave(undefined); return; }
    if (Number.isFinite(n)) onSave(n);
  };
  if (edit) {
    return (
      <input ref={ref} className="amtinput" inputMode="decimal" value={v} aria-label={ariaLabel}
        onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setEdit(false); } }} />
    );
  }
  return (
    <button className={className} aria-label={ariaLabel} onClick={() => { setV(value === undefined || value === null ? '' : String(value).replace('.', ',')); setEdit(true); }}>
      {value === undefined || value === null ? <span className="muted">{placeholder || 'Añadir'}</span> : format(value)}
    </button>
  );
}

export function Progress({ value, color = 'var(--brand)' }) {
  return <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} /></div>;
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={28} />}
      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>{title}</div>
      {children}
    </div>
  );
}

export { eur, eur0 };
