import React, { useMemo, useState } from 'react';
import { Check, CheckCheck, Plus, FileUp, FileText } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Seg, Editable, Progress } from '../ui.jsx';
import { colorArea, ICONO_MEDIO } from './shared.jsx';
import { GastoForm } from '../forms.jsx';

export function MesPage({ state, mk, A, go }) {
  const res = useMemo(() => E.resumenMes(state, mk), [state, mk]);
  const [filtro, setFiltro] = useState('todo');
  const [nuevo, setNuevo] = useState(false);
  const cuenta = (id) => E.nombreCuenta(state, id);

  const lineas = [...res.ingresos, ...res.gastos].filter((l) => l.estimado > 0 || l.confirmado);
  const visibles = lineas.filter((l) => (filtro === 'pend' ? !l.confirmado : filtro === 'conf' ? l.confirmado : true));
  const conf = lineas.filter((l) => l.confirmado).length;

  const confirmarMomento = (m) => A.confirmarVarios(mk, visibles.filter((l) => l.momento === m && !l.confirmado).map((l) => [l.key, l.estimado]));

  return (
    <div className="page">
      <PageHead title={`${E.mkLabel(mk)}, día a día`} lead="Confirma lo que ya se cobró o pagó: toca el importe para poner el real, o la casilla si fue lo previsto. Lo que no confirmes cuenta con su estimado.">
        <button className="btn" onClick={() => setNuevo(true)}><Plus size={16} /> Gasto puntual</button>
        <button className="btn primary" onClick={() => go('importar')}><FileUp size={16} /> Importar extracto</button>
      </PageHead>

      <Card>
        <div className="row between wrap" style={{ gap: 14 }}>
          <div className="stack grow" style={{ gap: 6, minWidth: 220 }}>
            <div className="row between"><b>{conf} de {lineas.length} confirmados</b><span className="muted small num">{Math.round(res.confirmadoPct)} %</span></div>
            <Progress value={res.confirmadoPct / 100} color="var(--ok)" />
          </div>
          <div className="row wrap" style={{ gap: 18 }}>
            <div><div className="eyebrow">Entra</div><div className="num" style={{ fontWeight: 800, color: 'var(--in)' }}>{E.eur0(res.totalIngresos)}</div></div>
            <div><div className="eyebrow">Sale</div><div className="num" style={{ fontWeight: 800, color: 'var(--out)' }}>{E.eur0(res.totalGastos)}</div></div>
            <div><div className="eyebrow">Queda</div><div className="num" style={{ fontWeight: 800, color: res.superavit >= 0 ? 'var(--sur)' : 'var(--crit)' }}>{E.eur0(res.superavit)}</div></div>
          </div>
          <Seg value={filtro} onChange={setFiltro} ariaLabel="Filtrar" options={[{ key: 'todo', label: 'Todo' }, { key: 'pend', label: `Pendiente (${lineas.length - conf})` }, { key: 'conf', label: 'Confirmado' }]} />
        </div>
      </Card>

      <div className="cols3">
        {E.MOMENTOS.map((m) => {
          const ls = visibles.filter((l) => l.momento === m.key).sort((a, b) => (a.tipo === b.tipo ? b.importe - a.importe : a.tipo === 'ingreso' ? -1 : 1));
          const inV = ls.filter((l) => l.tipo === 'ingreso').reduce((s, l) => s + l.importe, 0);
          const outV = ls.filter((l) => l.tipo === 'gasto').reduce((s, l) => s + l.importe, 0);
          const pend = ls.filter((l) => !l.confirmado).length;
          return (
            <div key={m.key} className="moment">
              <div className="moment-h">
                <div><div className="mt">{m.label}</div><div className="md">{m.dia} · <span style={{ color: 'var(--in)' }}>+{E.eur0(inV)}</span> · <span style={{ color: 'var(--out)' }}>−{E.eur0(outV)}</span></div></div>
                {pend > 0 && <button className="btn ghost sm" onClick={() => confirmarMomento(m.key)} title="Marca como pagado o cobrado con el importe estimado"><CheckCheck size={14} /> Confirmar {pend}</button>}
              </div>
              {ls.length === 0 && <div className="note">Nada {filtro === 'pend' ? 'pendiente' : ''} en este momento del mes.</div>}
              {ls.map((l) => <Linea key={l.key} l={l} mk={mk} A={A} cuenta={cuenta} />)}
            </div>
          );
        })}
      </div>

      <Card title="Aportaciones a objetivos" sub="Lo que apartas del superávit este mes. El estimado sale del % de cada objetivo; confirma lo que de verdad traspasas.">
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Objetivo</th><th className="n">% este mes</th><th className="n">Estimado</th><th className="n">Aportado</th><th /></tr></thead>
            <tbody>
              {res.aportaciones.map((a) => (
                <tr key={a.objetivo.id}>
                  <td><b>{a.objetivo.nombre}</b>{!a.puede && <div className="tiny muted">Empieza en {E.mkLabel(a.objetivo.fechaInicioAportacion).toLowerCase()}</div>}{a.objetivo.cuentaOrigenId && a.objetivo.cuentaDestinoId && <div className="tiny muted">{cuenta(a.objetivo.cuentaOrigenId)} → {cuenta(a.objetivo.cuentaDestinoId)}</div>}</td>
                  <td className="n"><Editable value={a.pct} format={(v) => `${v} %`} onSave={(v) => A.setReparto(mk, a.objetivo.id, v)} ariaLabel={`Porcentaje de ${a.objetivo.nombre}`} /></td>
                  <td className="n muted">{E.eur(a.estimado)}</td>
                  <td className="n"><Editable value={a.real} placeholder="Sin aportar" onSave={(v) => A.setAportacion(mk, a.objetivo.id, v)} ariaLabel={`Aportado a ${a.objetivo.nombre}`} /></td>
                  <td className="n"><button className={`check ${a.confirmado ? 'on' : ''}`} aria-label={a.confirmado ? 'Quitar aportación' : 'Aportar lo estimado'} disabled={!a.puede && !a.confirmado} onClick={() => A.setAportacion(mk, a.objetivo.id, a.confirmado ? undefined : a.estimado)}><Check size={15} strokeWidth={3} /></button></td>
                </tr>
              ))}
              <tr className="tot"><td>Total</td><td className="n">{res.aportaciones.reduce((s, a) => s + a.pct, 0)} %</td><td className="n">{E.eur(res.aportaciones.reduce((s, a) => s + a.estimado, 0))}</td><td className="n">{E.eur(res.aportado)}</td><td /></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <GastoForm open={nuevo} state={state} mk={mk} preset={{ frecuencia: 'esporadico' }} onClose={() => setNuevo(false)} onSave={(g) => { A.upsertMov(g); setNuevo(false); }} />
    </div>
  );
}

function Linea({ l, mk, A, cuenta }) {
  const esIn = l.tipo === 'ingreso';
  const rail = esIn ? 'var(--in)' : l.origen === 'tarjeta' ? 'var(--m2)' : colorArea(l.area);
  const I = esIn ? null : ICONO_MEDIO[l.medio];
  return (
    <div className={`line ${esIn ? 'in' : ''} ${l.confirmado ? 'done' : ''}`}>
      <span className="rail" style={{ background: rail }} />
      <div style={{ minWidth: 0 }}>
        <div className="ln">{l.nombre}</div>
        <div className="lm">
          {I && <I size={12} />}
          <span>{l.origen === 'tarjeta' ? `Se carga en ${cuenta(l.cuenta)}` : cuenta(l.cuenta)}</span>
          {!esIn && l.area && <span>· {E.areaDe(l.area).label}</span>}
          {l.origen === 'extracto' && <span className="pill brand"><FileText size={11} /> Extracto</span>}
          {l.conExtracto && <span className="pill brand"><FileText size={11} /> {l.movsExtracto} compras</span>}
          {l.calculado && <span className="pill neutral">Auto {l.ref.porcentaje ?? 10} %</span>}
        </div>
      </div>
      <div className="lv">
        <div className="row" style={{ gap: 6 }}>
          <Editable value={l.importe} onSave={(v) => A.setReal(mk, l.key, v)} ariaLabel={`Importe real de ${l.nombre}`} />
          {l.origen === 'extracto'
            ? <span className="check on" title="Viene del extracto"><Check size={15} strokeWidth={3} /></span>
            : <button className={`check ${l.confirmado ? 'on' : ''}`} aria-label={l.confirmado ? 'Quitar confirmación' : 'Confirmar con el estimado'} onClick={() => A.setReal(mk, l.key, l.confirmado ? undefined : l.estimado)}><Check size={15} strokeWidth={3} /></button>}
        </div>
        {l.origen === 'extracto' && <span className="est">sin prever</span>}
        {l.origen !== 'extracto' && l.confirmado && Math.abs(l.real - l.estimado) >= 0.5 && <span className="est">estimado {E.eur(l.estimado)}</span>}
        {!l.confirmado && <span className="est">{l.origen === 'tarjeta' ? 'estimado según tus gastos de tarjeta' : 'estimado'}</span>}
      </div>
    </div>
  );
}
