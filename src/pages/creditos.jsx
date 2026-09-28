import React, { useMemo, useState } from 'react';
import { Plus, HandCoins, CalendarClock, Flag, Pencil } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Kpi, Progress } from '../ui.jsx';
import { MonthBars } from '../charts.jsx';
import { CreditoForm } from '../forms.jsx';

const SLOT = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

export function CreditosPage({ state, mk, A }) {
  const [edit, setEdit] = useState(null);
  const est = useMemo(() => E.estadoCreditos(state, mk), [state, mk]);
  const creditos = state.config.creditos || [];
  const color = (id) => { const i = creditos.findIndex((c) => c.id === id); return i >= 0 && i < 8 ? SLOT[i] : 'var(--s0)'; };
  const ultimo = est.reduce((m, c) => (c.ultimo && c.ultimo > m ? c.ultimo : m), mk);
  const n = Math.min(60, Math.max(24, E.monthsBetween(mk, ultimo) + 3));
  const servicio = useMemo(() => E.servicioDeuda(state, mk, n), [state, mk, n]);

  const activos = est.filter((c) => c.totalPorPagar > 0 || c.activo);
  const cuotaMes = est.filter((c) => c.activo).reduce((s, c) => s + (Number(c.credito.cuota) || 0), 0);
  const porPagar = est.reduce((s, c) => s + c.totalPorPagar, 0);
  const finales = est.filter((c) => c.finalPendiente);
  const proximo = activos.filter((c) => c.ultimo).sort((a, b) => a.ultimo.localeCompare(b.ultimo))[0];
  // cuánto se libera cada vez que termina uno
  const liberaciones = creditos.filter((c) => c.fechaFin && c.fechaFin >= mk).map((c) => ({ c, mes: E.addMonths(c.fechaFin, 1), libera: Number(c.cuota) || 0 })).sort((a, b) => a.mes.localeCompare(b.mes));

  return (
    <div className="page">
      <PageHead title="Créditos" lead="Lo que debéis, cuánto pagáis cada mes y cuándo termina cada cuota.">
        <button className="btn primary" onClick={() => setEdit('nuevo')}><Plus size={16} /> Nuevo crédito</button>
      </PageHead>

      <div className="kpis">
        <Kpi tone="out" icon={HandCoins} label="Por pagar en total" value={E.eur0(porPagar)} foot={<span>Cuotas que quedan más cuotas finales</span>} />
        <Kpi tone="neutral" icon={CalendarClock} label="Cuotas este mes" value={E.eur0(cuotaMes)} foot={<span>{activos.filter((c) => c.activo).length} créditos activos</span>} />
        <Kpi tone="neutral" icon={Flag} label="Próximo en terminar" value={proximo ? E.mkShort(proximo.ultimo) : '—'} foot={<span>{proximo ? `${proximo.credito.nombre} · en ${proximo.mesesHastaUltimo} meses` : ''}</span>} />
        <Kpi tone="sav" icon={HandCoins} label="Cuotas finales pendientes" value={E.eur0(finales.reduce((s, c) => s + c.cuotaFinal, 0))} foot={<span>{finales.length ? `Ahorrado para ellas: ${E.eur0(finales.reduce((s, c) => s + Math.min(c.ahorrado, c.cuotaFinal), 0))}` : 'Ninguna'}</span>} />
      </div>

      <Card title="Cuotas mes a mes" sub="Cuánto se va en créditos cada mes y cuándo baja. La línea marca cada cuota final.">
        <MonthBars series={servicio.map((s) => ({ mk: s.mk, estado: 'previsto', values: Object.fromEntries(creditos.map((c) => [c.id, s[c.id]])) }))}
          keys={creditos.map((c) => c.id)} colorOf={color} labelOf={(k) => creditos.find((c) => c.id === k)?.nombre || k} height={240}
          markers={servicio.flatMap((s) => s.finales.map((f) => ({ mk: s.mk, label: `Final ${f.credito.nombre.split(' ').slice(-1)[0]} ${E.eur0(f.importe)}` })))} valueLabel="Cuotas de créditos por mes" />
        <div className="legend">{creditos.map((c) => <span key={c.id}><span className="swatch" style={{ background: color(c.id) }} />{c.nombre}</span>)}</div>
        {liberaciones.length > 0 && (
          <div className="row wrap" style={{ gap: 8 }}>
            {liberaciones.map((l) => <span key={l.c.id} className="pill ok">Desde {E.mkShort(l.mes)}: +{E.eur0(l.libera)}/mes ({l.c.nombre})</span>)}
          </div>
        )}
      </Card>

      <div className="objgrid">
        {est.map((c) => {
          const cr = c.credito;
          return (
            <Card key={cr.id} title={<span className="row" style={{ gap: 8 }}><span className="swatch" style={{ background: color(cr.id) }} />{cr.nombre}</span>}
              sub={`${cr.tipo || 'Crédito'} · se paga desde ${E.nombreCuenta(state, cr.cuenta)}`}
              actions={<><span className={`pill ${c.totalPorPagar > 0 ? (c.activo ? 'brand' : 'neutral') : 'ok'}`}>{c.totalPorPagar > 0 ? (c.activo ? 'Activo' : 'Pendiente') : 'Terminado'}</span><button className="icon-btn" onClick={() => setEdit(cr)} aria-label={`Editar ${cr.nombre}`}><Pencil size={15} /></button></>}>
              <div className="credit-meta">
                <div><div className="eyebrow">Cuota</div><div className="v">{E.eur(cr.cuota)}</div></div>
                <div><div className="eyebrow">Quedan</div><div className="v">{c.cuotasRestantes ?? '—'} cuotas</div></div>
                <div><div className="eyebrow">Por pagar</div><div className="v">{E.eur0(c.totalPorPagar)}</div></div>
              </div>
              {c.progreso !== null && (
                <div className="stack" style={{ gap: 5 }}>
                  <div className="row between small"><span className="muted">Pagado {c.transcurridos} de {c.totalMeses} meses</span><b>{Math.round(c.progreso * 100)} %</b></div>
                  <Progress value={c.progreso} color={color(cr.id)} />
                </div>
              )}
              <div>
                {cr.fechaFin && <div className="statline"><span>Última cuota mensual</span><b>{E.mkLabel(cr.fechaFin)}</b></div>}
                {c.cuotaFinal > 0 && <div className="statline"><span>Cuota final</span><b>{E.eur(c.cuotaFinal)} · {cr.fechaCuotaFinal ? E.mkShort(cr.fechaCuotaFinal) : '—'}</b></div>}
                {cr.capitalPendiente ? <div className="statline"><span>Capital pendiente según el banco</span><b>{E.eur(cr.capitalPendiente)}{cr.fechaCapital ? ` (${E.mkShort(cr.fechaCapital)})` : ''}</b></div> : null}
                {c.cuotasRestantes && cr.capitalPendiente ? <div className="statline"><span>Intereses aproximados que quedan</span><b>{E.eur0(Math.max(0, c.porCuotas - cr.capitalPendiente))}</b></div> : null}
              </div>
              {c.finalPendiente && c.objetivo && (
                <div className="stack" style={{ gap: 5 }}>
                  <div className="row between small"><span>Ahorrado para la cuota final ({c.objetivo.nombre})</span><b className="num">{E.eur0(c.ahorrado)}</b></div>
                  <Progress value={c.cobertura || 0} color="var(--sav)" />
                  {c.mesesHastaUltimo > 0 && c.ahorrado < c.cuotaFinal && <div className="tiny muted">Para llegar harían falta {E.eur0((c.cuotaFinal - c.ahorrado) / c.mesesHastaUltimo)} al mes.</div>}
                </div>
              )}
              {cr.notas && <div className="tiny muted">{cr.notas}</div>}
            </Card>
          );
        })}
      </div>

      <CreditoForm open={!!edit} item={edit && edit !== 'nuevo' ? edit : null} state={state} onClose={() => setEdit(null)}
        onSave={(x) => { A.upsertCredito(x); setEdit(null); }} onDelete={() => { A.deleteCredito(edit.id); setEdit(null); }} />
    </div>
  );
}
