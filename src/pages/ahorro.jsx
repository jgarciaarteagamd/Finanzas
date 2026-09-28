import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Scale, PiggyBank, CheckCircle2, CircleDashed, Check } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Kpi, Editable, Progress } from '../ui.jsx';
import { StackBar } from '../charts.jsx';
import { ObjetivoForm } from '../forms.jsx';

const SLOT = ['var(--s7)', 'var(--s1)', 'var(--s4)', 'var(--s3)', 'var(--s5)', 'var(--s2)', 'var(--s6)', 'var(--s8)'];

export function AhorroPage({ state, mk, A }) {
  const [edit, setEdit] = useState(null);
  const res = useMemo(() => E.resumenMes(state, mk), [state, mk]);
  const est = useMemo(() => E.estadoObjetivos(state, mk), [state, mk]);
  const objetivos = state.config.objetivos || [];
  const color = (id) => { const i = objetivos.findIndex((o) => o.id === id); return i >= 0 && i < 8 ? SLOT[i] : 'var(--s0)'; };
  const sinAsignar = Math.max(0, res.superavit) - res.aportadoPrevisto;
  const totalPct = res.aportaciones.reduce((s, a) => s + a.pct, 0);
  const mesesConAport = Object.keys(state.meses || {}).filter((m) => Object.keys(state.meses[m].aportaciones || {}).length).sort();

  return (
    <div className="page">
      <PageHead title="Ahorro y objetivos" lead="Cómo repartís el superávit de cada mes entre vuestros objetivos, y cuánto falta para cada uno.">
        <button className="btn primary" onClick={() => setEdit('nuevo')}><Plus size={16} /> Nuevo objetivo</button>
      </PageHead>

      <div className="kpis">
        <Kpi tone="sur" icon={Scale} label="Superávit del mes" value={E.eur0(res.superavit)} foot={<span>{E.pct(res.tasaAhorro)} de los ingresos</span>} />
        <Kpi tone="sav" icon={PiggyBank} label="Previsto para objetivos" value={E.eur0(res.aportadoPrevisto)} foot={<span>Reparto al {totalPct} %</span>} />
        <Kpi tone="in" icon={CheckCircle2} label="Ya apartado" value={E.eur0(res.aportado)} foot={<span>{res.aportaciones.filter((a) => a.confirmado).length} aportaciones confirmadas</span>} />
        <Kpi tone="neutral" icon={CircleDashed} label="Sin asignar" value={E.eur0(sinAsignar)} foot={<span>{totalPct < 100 ? `Queda un ${100 - totalPct} % sin repartir` : 'Todo repartido'}</span>} />
      </div>

      <Card title={`Reparto de ${E.mkLabel(mk).toLowerCase()}`} sub="Cambia el % de este mes o confirma lo que de verdad apartas. El % recomendado de cada objetivo se edita en su ficha.">
        <StackBar tall parts={res.aportaciones.map((a) => ({ key: a.objetivo.id, label: a.objetivo.nombre, value: a.pct, color: color(a.objetivo.id) }))} />
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Objetivo</th><th className="n hide-sm">Recomendado</th><th className="n">Este mes</th><th className="n">Estimado</th><th className="n">Apartado</th><th /></tr></thead>
            <tbody>
              {res.aportaciones.map((a) => (
                <tr key={a.objetivo.id}>
                  <td><span className="row" style={{ gap: 8 }}><span className="swatch" style={{ background: color(a.objetivo.id) }} /><b>{a.objetivo.nombre}</b></span>{!a.puede && <div className="tiny muted">Empieza en {E.mkLabel(a.objetivo.fechaInicioAportacion).toLowerCase()}</div>}</td>
                  <td className="n hide-sm muted">{a.objetivo.porcentaje} %</td>
                  <td className="n"><Editable value={a.pct} format={(v) => `${v} %`} onSave={(v) => A.setReparto(mk, a.objetivo.id, v)} ariaLabel={`Porcentaje de ${a.objetivo.nombre} este mes`} /></td>
                  <td className="n muted">{E.eur(a.estimado)}</td>
                  <td className="n"><Editable value={a.real} placeholder="Sin apartar" onSave={(v) => A.setAportacion(mk, a.objetivo.id, v)} ariaLabel={`Apartado para ${a.objetivo.nombre}`} /></td>
                  <td className="n"><button className={`check ${a.confirmado ? 'on' : ''}`} disabled={!a.puede && !a.confirmado} aria-label={a.confirmado ? 'Quitar' : 'Apartar lo estimado'} onClick={() => A.setAportacion(mk, a.objetivo.id, a.confirmado ? undefined : a.estimado)}><Check size={15} strokeWidth={3} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="objgrid">
        {est.map((o) => {
          const ob = o.objetivo;
          return (
            <Card key={ob.id} title={<span className="row" style={{ gap: 8 }}><span className="swatch" style={{ background: color(ob.id) }} />{ob.nombre}</span>}
              sub={ob.tipo === 'colchon' ? `${ob.mesesDeseados || 6} meses de gasto medio` : ob.fechaObjetivo ? `Para ${E.mkLabel(ob.fechaObjetivo.slice(0, 7)).toLowerCase()}` : null}
              actions={<>{ob.contingente && <span className="pill warn">Contingente</span>}<button className="icon-btn" onClick={() => setEdit(ob)} aria-label={`Editar ${ob.nombre}`}><Pencil size={15} /></button></>}>
              <div className="row between"><span className="num" style={{ font: '700 1.5rem/1.1 var(--display)' }}>{E.eur0(o.ahorrado)}</span><span className="muted small">de {E.eur0(o.meta)}</span></div>
              <Progress value={o.progreso} color={o.progreso >= 1 ? 'var(--ok)' : color(ob.id)} />
              <div>
                <div className="statline"><span>Falta</span><b>{E.eur0(o.falta)}</b></div>
                {o.mesesHasta !== null && o.falta > 0 && <div className="statline"><span>Meses hasta la fecha</span><b>{Math.max(0, o.mesesHasta)}</b></div>}
                {o.necesarioMes !== null && o.falta > 0 && <div className="statline"><span>Haría falta al mes</span><b>{E.eur0(o.necesarioMes)}</b></div>}
                <div className="statline"><span>% recomendado del superávit</span><b>{ob.porcentaje} %</b></div>
                {ob.cuentaOrigenId && ob.cuentaDestinoId && <div className="statline"><span>Traspaso</span><b>{E.nombreCuenta(state, ob.cuentaOrigenId)} → {E.nombreCuenta(state, ob.cuentaDestinoId)}</b></div>}
              </div>
              {ob.notas && <div className="tiny muted">{ob.notas}</div>}
            </Card>
          );
        })}
      </div>

      {mesesConAport.length > 0 && (
        <Card title="Aportaciones registradas" sub="Lo que habéis apartado cada mes.">
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Mes</th>{objetivos.map((o) => <th key={o.id} className="n">{o.nombre}</th>)}<th className="n">Total</th></tr></thead>
              <tbody>
                {mesesConAport.map((m) => {
                  const ap = state.meses[m].aportaciones || {};
                  return (
                    <tr key={m}><td>{E.mkLabel(m)}</td>{objetivos.map((o) => <td key={o.id} className="n">{ap[o.id] !== undefined ? E.eur0(ap[o.id]) : '—'}</td>)}<td className="n"><b>{E.eur0(Object.values(ap).reduce((s, v) => s + (Number(v) || 0), 0))}</b></td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ObjetivoForm open={!!edit} item={edit && edit !== 'nuevo' ? edit : null} state={state} onClose={() => setEdit(null)}
        onSave={(x) => { A.upsertObjetivo(x); setEdit(null); }} onDelete={() => { A.deleteObjetivo(edit.id); setEdit(null); }} />
    </div>
  );
}
