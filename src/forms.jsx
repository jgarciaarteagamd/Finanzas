import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Drawer, Field } from './ui.jsx';
import { num, MESES, FRECUENCIAS, MOMENTOS, AREAS, MEDIOS, nid } from './engine.js';

/* Formulario genérico en panel lateral, definido por una lista de campos.
   Tipos: text, money, number, select, month, date, textarea, check, datalist */
export function FormDrawer({ open, title, initial, fields, onSave, onDelete, onClose, validate, deleteLabel = 'Eliminar' }) {
  const [v, setV] = useState(initial || {});
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  // se reinicia solo al abrir, para no perder lo escrito si llega una actualización de fondo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setV(initial || {}); setErr(''); setConfirmDel(false); } }, [open]);
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));

  const submit = (e) => {
    e && e.preventDefault();
    const out = { ...v };
    for (const f of fields) {
      if (f.show && !f.show(v)) { if (f.clearWhenHidden) delete out[f.name]; continue; }
      if (f.type === 'money' || f.type === 'number') {
        const raw = v[f.name];
        if (raw === '' || raw === undefined || raw === null) { if (f.required) { setErr(`Falta: ${f.label.toLowerCase()}.`); return; } out[f.name] = f.emptyAs !== undefined ? f.emptyAs : null; continue; }
        const n = typeof raw === 'number' ? raw : num(raw);
        if (!Number.isFinite(n)) { setErr(`Revisa «${f.label}»: tiene que ser un número.`); return; }
        out[f.name] = n;
      } else if (f.required && !String(v[f.name] ?? '').trim()) { setErr(`Falta: ${f.label.toLowerCase()}.`); return; }
      else if (typeof v[f.name] === 'string') out[f.name] = v[f.name].trim() === '' && f.emptyAs !== undefined ? f.emptyAs : v[f.name].trim();
    }
    const msg = validate ? validate(out) : '';
    if (msg) { setErr(msg); return; }
    onSave(out);
  };

  const renderField = (f) => {
    if (f.show && !f.show(v)) return null;
    const val = v[f.name];
    const id = `f-${f.name}`;
    let ctl;
    switch (f.type) {
      case 'select':
        ctl = (
          <select id={id} className="in-ctl" value={val ?? ''} onChange={(e) => set(f.name, e.target.value)}>
            {f.placeholder !== undefined && <option value="">{f.placeholder}</option>}
            {(typeof f.options === 'function' ? f.options(v) : f.options).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
        break;
      case 'textarea': ctl = <textarea id={id} className="in-ctl" rows={3} value={val ?? ''} onChange={(e) => set(f.name, e.target.value)} />; break;
      case 'month': ctl = <input id={id} className="in-ctl" type="month" value={val ?? ''} onChange={(e) => set(f.name, e.target.value)} />; break;
      case 'date': ctl = <input id={id} className="in-ctl" type="date" value={val ?? ''} onChange={(e) => set(f.name, e.target.value)} />; break;
      case 'check':
        return (
          <label key={f.name} className="row" style={{ gap: 9, fontWeight: 600, fontSize: '.88rem' }}>
            <input id={id} type="checkbox" checked={!!val} onChange={(e) => set(f.name, e.target.checked)} /> {f.label}
          </label>
        );
      case 'money': case 'number':
        ctl = <input id={id} className="in-ctl num" inputMode="decimal" value={val === null || val === undefined ? '' : String(val).replace('.', ',')} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />;
        break;
      case 'datalist':
        ctl = (
          <>
            <input id={id} className="in-ctl" list={`${id}-l`} value={val ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
            <datalist id={`${id}-l`}>{(typeof f.options === 'function' ? f.options(v) : f.options).map((o) => <option key={o} value={o} />)}</datalist>
          </>
        );
        break;
      default: ctl = <input id={id} className="in-ctl" value={val ?? ''} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />;
    }
    return <Field key={f.name} label={f.label} hint={typeof f.hint === 'function' ? f.hint(v) : f.hint}>{ctl}</Field>;
  };

  // agrupa campos con `pair: true` de dos en dos
  const rows = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.pair && fields[i + 1] && fields[i + 1].pair) { rows.push([f, fields[i + 1]]); i++; } else rows.push([f]);
  }

  return (
    <Drawer open={open} title={title} onClose={onClose} footer={(
      <>
        {onDelete && (confirmDel
          ? <><span className="small muted" style={{ marginRight: 'auto', alignSelf: 'center' }}>¿Seguro? No se puede deshacer.</span><button className="btn danger solid" onClick={onDelete}>Sí, eliminar</button></>
          : <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}><Trash2 size={15} /> {deleteLabel}</button>)}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={submit}>Guardar</button>
      </>
    )}>
      <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
        {err && <div className="formerr">{err}</div>}
        {rows.map((r, i) => (r.length === 2
          ? <div className="two" key={i}>{renderField(r[0])}{renderField(r[1])}</div>
          : <React.Fragment key={i}>{renderField(r[0])}</React.Fragment>))}
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}

const MES_OPTS = MESES.map((m, i) => ({ value: String(i + 1), label: m }));
const FREQ_OPTS = FRECUENCIAS.map((f) => ({ value: f.key, label: f.label }));
const MOM_OPTS = MOMENTOS.map((m) => ({ value: m.key, label: `${m.label} (${m.dia})` }));

/* campos comunes de frecuencia */
const camposFrecuencia = [
  { name: 'frecuencia', label: 'Frecuencia', type: 'select', options: FREQ_OPTS, pair: true },
  { name: 'mesReferencia', label: 'Mes en que se cobra', type: 'select', options: MES_OPTS, pair: true, show: (v) => ['bimestral', 'trimestral', 'semestral', 'anual'].includes(v.frecuencia), hint: (v) => (v.frecuencia === 'anual' ? '' : 'Uno de los meses en que cae.') },
  { name: 'mesEsporadico', label: 'Mes', type: 'select', options: MES_OPTS, pair: true, show: (v) => v.frecuencia === 'esporadico' },
  { name: 'anoEsporadico', label: 'Año', type: 'number', pair: true, show: (v) => v.frecuencia === 'esporadico' },
  { name: 'fechaInicio', label: 'Desde (opcional)', type: 'month', pair: true, show: (v) => v.frecuencia !== 'esporadico' },
  { name: 'fechaFin', label: 'Hasta (opcional)', type: 'month', pair: true, show: (v) => v.frecuencia !== 'esporadico' },
];

function limpiarFrecuencia(o) {
  const out = { ...o };
  if (!['bimestral', 'trimestral', 'semestral', 'anual'].includes(out.frecuencia)) delete out.mesReferencia; else out.mesReferencia = Number(out.mesReferencia) || 1;
  if (out.frecuencia !== 'esporadico') { delete out.mesEsporadico; delete out.anoEsporadico; }
  else { out.mesEsporadico = Number(out.mesEsporadico) || 1; out.anoEsporadico = Number(out.anoEsporadico) || new Date().getFullYear(); delete out.fechaInicio; delete out.fechaFin; }
  if (!out.fechaInicio) delete out.fechaInicio;
  if (!out.fechaFin) delete out.fechaFin;
  return out;
}

export function IngresoForm({ open, item, state, mk, onSave, onDelete, onClose }) {
  const cuentas = state.config.cuentas.map((c) => ({ value: c.id, label: c.nombre }));
  const { y, m } = { y: Number(mk.slice(0, 4)), m: Number(mk.slice(5)) };
  const initial = item || { tipo: 'ingreso', clase: 'recibo', titular: 'Juan', frecuencia: 'mensual', momento: 'fin', cuenta: cuentas[0]?.value, mesEsporadico: String(m), anoEsporadico: y };
  const fields = [
    { name: 'nombre', label: 'Nombre', required: true, placeholder: 'Ej. Otosur' },
    { name: 'importe', label: 'Importe estimado (€)', type: 'money', required: true, pair: true },
    { name: 'clase', label: 'Tipo', type: 'select', pair: true, options: [{ value: 'recibo', label: 'Fijo / recurrente' }, { value: 'extra', label: 'Extra' }] },
    { name: 'titular', label: 'De quién', type: 'datalist', options: ['Juan', 'Sara', 'Familia'], pair: true },
    { name: 'cuenta', label: 'Entra en la cuenta', type: 'select', options: cuentas, pair: true },
    { name: 'momento', label: 'Cuándo del mes', type: 'select', options: MOM_OPTS },
    ...camposFrecuencia,
    { name: 'notas', label: 'Notas', type: 'textarea' },
  ];
  return (
    <FormDrawer open={open} title={item ? 'Editar ingreso' : 'Nuevo ingreso'} initial={{ ...initial, mesReferencia: initial.mesReferencia ? String(initial.mesReferencia) : '1', mesEsporadico: initial.mesEsporadico ? String(initial.mesEsporadico) : String(m) }}
      fields={fields} onClose={onClose} onDelete={item ? onDelete : null}
      onSave={(o) => onSave(limpiarFrecuencia({ ...o, id: o.id || nid('ing'), tipo: 'ingreso' }))} />
  );
}

export function GastoForm({ open, item, state, mk, onSave, onDelete, onClose, preset }) {
  const cuentas = state.config.cuentas.map((c) => ({ value: c.id, label: c.nombre }));
  const tarjetas = state.config.tarjetas.map((t) => ({ value: t.id, label: t.nombre }));
  const subsDe = (area) => [...new Set(state.movimientos.filter((x) => x.tipo === 'gasto' && x.area === area && x.sub).map((x) => x.sub))];
  const { y, m } = { y: Number(mk.slice(0, 4)), m: Number(mk.slice(5)) };
  const base = item || { tipo: 'gasto', area: 'otros', medio: 'recibo', frecuencia: 'mensual', momento: 'inicio', cuenta: cuentas[0]?.value, tarjetaId: tarjetas[0]?.value, mesEsporadico: String(m), anoEsporadico: y, ...(preset || {}) };
  const initial = { ...base, calcula: base.calculado === 'diezmo', mesReferencia: base.mesReferencia ? String(base.mesReferencia) : '1', mesEsporadico: base.mesEsporadico ? String(base.mesEsporadico) : String(m) };
  const fields = [
    { name: 'nombre', label: 'Concepto', required: true, placeholder: 'Ej. Supermercado' },
    { name: 'area', label: 'Categoría', type: 'select', pair: true, options: AREAS.filter((a) => a.key !== 'creditos').map((a) => ({ value: a.key, label: a.label })) },
    { name: 'sub', label: 'Subcategoría', type: 'datalist', pair: true, options: (v) => subsDe(v.area), placeholder: 'Ej. Suministros' },
    { name: 'medio', label: 'Cómo se paga', type: 'select', options: MEDIOS.map((x) => ({ value: x.key, label: x.label })) },
    { name: 'tarjetaId', label: 'Tarjeta', type: 'select', options: tarjetas, show: (v) => v.medio === 'tarjeta', hint: 'La tarjeta decide cuándo y desde qué cuenta se carga.' },
    { name: 'cuenta', label: 'Sale de la cuenta', type: 'select', options: cuentas, pair: true, show: (v) => v.medio !== 'tarjeta' },
    { name: 'momento', label: 'Cuándo del mes', type: 'select', options: MOM_OPTS, pair: true, show: (v) => v.medio !== 'tarjeta' },
    { name: 'calcula', label: 'Calcular como % de los ingresos del mes (como el diezmo)', type: 'check', show: (v) => v.medio !== 'tarjeta' },
    { name: 'porcentaje', label: '% de los ingresos', type: 'number', show: (v) => v.calcula && v.medio !== 'tarjeta', emptyAs: 10 },
    { name: 'importe', label: 'Importe estimado (€)', type: 'money', show: (v) => !(v.calcula && v.medio !== 'tarjeta'), required: true, hint: (v) => (v.medio === 'tarjeta' ? 'Aproximado: suma al estimado de la tarjeta.' : '') },
    ...camposFrecuencia,
    { name: 'notas', label: 'Notas', type: 'textarea' },
  ];
  const save = (o) => {
    const out = limpiarFrecuencia({ ...o, id: o.id || nid('gas'), tipo: 'gasto' });
    if (out.medio === 'tarjeta') { delete out.cuenta; delete out.momento; delete out.calculado; delete out.porcentaje; out.calcula = false; }
    else delete out.tarjetaId;
    if (out.calcula) { out.calculado = 'diezmo'; out.importe = 0; out.porcentaje = Number(out.porcentaje) || 10; } else { delete out.calculado; delete out.porcentaje; }
    delete out.calcula;
    onSave(out);
  };
  return <FormDrawer open={open} title={item ? 'Editar gasto' : 'Nuevo gasto'} initial={initial} fields={fields} onClose={onClose} onDelete={item ? onDelete : null} onSave={save} />;
}

export function CuentaForm({ open, item, onSave, onDelete, onClose }) {
  const fields = [
    { name: 'nombre', label: 'Nombre de la cuenta', required: true, placeholder: 'Ej. Santander de Juan' },
    { name: 'titular', label: 'Titular', type: 'datalist', options: ['Juan', 'Sara', 'Martín', 'Mateo'] },
    { name: 'notas', label: 'Notas', type: 'textarea' },
  ];
  return <FormDrawer open={open} title={item ? 'Editar cuenta' : 'Nueva cuenta'} initial={item || { titular: 'Juan' }} fields={fields} onClose={onClose} onDelete={item ? onDelete : null} onSave={(o) => onSave({ ...o, id: o.id || nid('cta') })} deleteLabel="Eliminar cuenta" />;
}

export function TarjetaForm({ open, item, state, onSave, onDelete, onClose }) {
  const cuentas = state.config.cuentas.map((c) => ({ value: c.id, label: c.nombre }));
  const fields = [
    { name: 'nombre', label: 'Nombre de la tarjeta', required: true, placeholder: 'Ej. Visa Icon' },
    { name: 'titular', label: 'Titular', type: 'datalist', options: ['Juan', 'Sara'], pair: true },
    { name: 'cuentaDebitoId', label: 'Se carga en la cuenta', type: 'select', options: cuentas, pair: true },
    { name: 'momento', label: 'Cuándo se carga', type: 'select', options: MOM_OPTS },
    { name: 'notas', label: 'Notas', type: 'textarea' },
  ];
  return <FormDrawer open={open} title={item ? 'Editar tarjeta' : 'Nueva tarjeta'} initial={item || { titular: 'Juan', cuentaDebitoId: cuentas[0]?.value, momento: 'fin' }} fields={fields} onClose={onClose} onDelete={item ? onDelete : null} onSave={(o) => onSave({ ...o, id: o.id || nid('tar') })} deleteLabel="Eliminar tarjeta" />;
}

export function CreditoForm({ open, item, state, onSave, onDelete, onClose }) {
  const cuentas = state.config.cuentas.map((c) => ({ value: c.id, label: c.nombre }));
  const objetivos = state.config.objetivos.map((o) => ({ value: o.id, label: o.nombre }));
  const fields = [
    { name: 'nombre', label: 'Nombre', required: true, placeholder: 'Ej. Nissan Qashqai' },
    { name: 'tipo', label: 'Tipo', type: 'datalist', options: ['Coche con cuota final', 'Préstamo personal', 'Hipoteca', 'Tratamiento financiado', 'Tarjeta aplazada'] },
    { name: 'cuota', label: 'Cuota mensual (€)', type: 'money', required: true, pair: true },
    { name: 'cuenta', label: 'Se paga desde', type: 'select', options: cuentas, pair: true },
    { name: 'momento', label: 'Cuándo del mes', type: 'select', options: MOM_OPTS },
    { name: 'fechaInicio', label: 'Primera cuota', type: 'month', pair: true, hint: 'Opcional; sirve para ver el avance.' },
    { name: 'fechaFin', label: 'Última cuota mensual', type: 'month', pair: true },
    { name: 'cuotaFinal', label: 'Cuota final / residual (€)', type: 'money', pair: true, emptyAs: 0 },
    { name: 'fechaCuotaFinal', label: 'Mes de la cuota final', type: 'month', pair: true },
    { name: 'capitalPendiente', label: 'Capital pendiente según el banco (€)', type: 'money', pair: true, hint: 'Opcional.' },
    { name: 'fechaCapital', label: 'A fecha de', type: 'month', pair: true },
    { name: 'objetivoId', label: 'Objetivo de ahorro para la cuota final', type: 'select', placeholder: 'Ninguno', options: objetivos },
    { name: 'notas', label: 'Notas', type: 'textarea' },
  ];
  return (
    <FormDrawer open={open} title={item ? 'Editar crédito' : 'Nuevo crédito'} initial={item || { momento: 'inicio', cuenta: cuentas[0]?.value, cuotaFinal: 0 }} fields={fields}
      onClose={onClose} onDelete={item ? onDelete : null} deleteLabel="Eliminar crédito"
      validate={(o) => (o.fechaInicio && o.fechaFin && o.fechaFin < o.fechaInicio ? 'La última cuota no puede ser anterior a la primera.' : '')}
      onSave={(o) => onSave({ ...o, id: o.id || nid('cre'), fechaInicio: o.fechaInicio || null, fechaFin: o.fechaFin || null, fechaCuotaFinal: o.fechaCuotaFinal || null, objetivoId: o.objetivoId || null, fechaCapital: o.fechaCapital || null })} />
  );
}

export function ObjetivoForm({ open, item, state, onSave, onDelete, onClose }) {
  const cuentas = state.config.cuentas.map((c) => ({ value: c.id, label: c.nombre }));
  const esColchon = item && item.tipo === 'colchon';
  const fields = [
    { name: 'nombre', label: 'Nombre', required: true },
    { name: 'porcentaje', label: '% del superávit recomendado', type: 'number', pair: true, emptyAs: 0 },
    esColchon
      ? { name: 'mesesDeseados', label: 'Meses de gasto a cubrir', type: 'number', pair: true, emptyAs: 6 }
      : { name: 'objetivo', label: 'Importe objetivo (€)', type: 'money', pair: true, emptyAs: 0 },
    { name: 'ahorradoBase', label: 'Ya ahorrado antes de usar la app (€)', type: 'money', emptyAs: 0, hint: 'Las aportaciones de cada mes se suman solas.' },
    { name: 'fechaObjetivo', label: 'Fecha objetivo', type: 'date', pair: true, show: () => !esColchon },
    { name: 'fechaInicioAportacion', label: 'Empezar a aportar en', type: 'month', pair: true },
    { name: 'cuentaOrigenId', label: 'Traspaso desde la cuenta', type: 'select', placeholder: 'Sin traspaso', options: cuentas, pair: true },
    { name: 'cuentaDestinoId', label: 'Hacia la cuenta', type: 'select', placeholder: 'Sin traspaso', options: cuentas, pair: true },
    { name: 'contingente', label: 'Es un gasto posible, no seguro (contingente)', type: 'check' },
    { name: 'notas', label: 'Notas', type: 'textarea' },
  ];
  return (
    <FormDrawer open={open} title={item ? 'Editar objetivo' : 'Nuevo objetivo'} initial={item || { tipo: 'otro', porcentaje: 0, ahorradoBase: 0 }} fields={fields}
      onClose={onClose} onDelete={item && !esColchon ? onDelete : null} deleteLabel="Eliminar objetivo"
      validate={(o) => (o.porcentaje < 0 || o.porcentaje > 100 ? 'El porcentaje tiene que estar entre 0 y 100.' : (o.cuentaOrigenId && o.cuentaOrigenId === o.cuentaDestinoId ? 'La cuenta de origen y la de destino no pueden ser la misma.' : ''))}
      onSave={(o) => onSave({ ...o, id: o.id || nid('obj'), cuentaOrigenId: o.cuentaOrigenId || null, cuentaDestinoId: o.cuentaDestinoId || null, fechaInicioAportacion: o.fechaInicioAportacion || null, fechaObjetivo: o.fechaObjetivo || null })} />
  );
}
