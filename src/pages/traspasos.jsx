import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import * as E from '../engine.js';
import { Card, Editable } from '../ui.jsx';
import { TraspasoForm } from '../forms.jsx';

export function Traspasos({ state, mk, A }) {
  const [edit, setEdit] = useState(null);
  const [todos, setTodos] = useState(false);
  const actuales = E.traspasosDelMes(state, mk);
  const items = todos ? state.movimientos.filter((x) => x.tipo === 'traspaso') : actuales;
  return <>
    <Card title="Traspasos entre cuentas" sub="Una salida y una entrada vinculadas. No aumentan los ingresos, gastos ni el diezmo familiar. Los pendientes cuentan en la previsión; confirma el importe cuando hayas hecho la transferencia en tu banco."
      actions={<button className="btn primary sm" onClick={() => setEdit('nuevo')}><Plus size={14} /> Nuevo traspaso</button>}>
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> Ver también los de otros meses</label>
      {!items.length && <div className="note">Sin traspasos {todos ? 'configurados' : 'este mes'}. Puedes crear uno mensual o puntual, también para las cuentas de los niños.</div>}
      <div className="stack">
        {items.map((t) => {
          const l = actuales.find((x) => x.id === t.id);
          return <div key={t.id} className="row between wrap" style={{ gap: 12 }}>
            <div className="grow"><b>{t.nombre}</b><div className="small">{E.nombreCuenta(state, t.cuentaOrigenId)} → {E.nombreCuenta(state, t.cuentaDestinoId)}</div>
              <div className="tiny muted">{E.FRECUENCIAS.find((f) => f.key === t.frecuencia)?.label} · {E.MOMENTOS.find((m) => m.key === t.momento)?.label} · Previsto: {E.eur(t.importe)}</div>
            </div>
            {l ? <>
              <span className={`pill ${l.confirmado ? 'ok' : 'warn'}`}>{l.confirmado ? (l.real === 0 ? 'Omitido este mes' : 'Realizado') : 'Pendiente'}</span>
              <Editable value={l.real} placeholder="Poner real" ariaLabel={`Importe real de ${t.nombre}`} onSave={(v) => { if (v === undefined || v === null || (Number.isFinite(v) && v >= 0)) A.setReal(mk, t.id, v); }} />
              <button className="btn sm" onClick={() => A.setReal(mk, t.id, l.confirmado ? undefined : l.estimado)}>{l.confirmado ? 'Desconfirmar' : 'Confirmar'}</button>
              {!l.confirmado && <button className="btn ghost sm" onClick={() => A.setReal(mk, t.id, 0)}>Omitir este mes</button>}
            </> : <span className="pill">No corresponde este mes</span>}
            <button className="icon-btn" aria-label={`Editar traspaso ${t.nombre}`} onClick={() => setEdit(t)}><Pencil size={15} /></button>
          </div>;
        })}
      </div>
      <div className="tiny muted">Editar o eliminar una programación afecta a todos los meses en los que se aplica. Para finalizarla, indica «Hasta»; para saltar un mes, usa «Omitir este mes».</div>
    </Card>
    <TraspasoForm open={!!edit} item={edit === 'nuevo' ? null : edit} state={state} mk={mk} onClose={() => setEdit(null)}
      onSave={(v) => { A.upsertMov(v); setEdit(null); }} onDelete={() => { A.deleteMov(edit.id); setEdit(null); }} />
  </>;
}
