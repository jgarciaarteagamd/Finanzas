import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, Scale, PiggyBank, ArrowRight } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Kpi, Delta, Alerta, Progress } from '../ui.jsx';
import { Sankey, MonthBars } from '../charts.jsx';
import { AreaList, MedioList, colorArea } from './shared.jsx';

export function ResumenPage({ state, mk, go }) {
  const res = useMemo(() => E.resumenMes(state, mk), [state, mk]);
  const prev = useMemo(() => (mk > state.config.mesInicio ? E.resumenMes(state, E.addMonths(mk, -1)) : null), [state, mk]);
  const flujo = useMemo(() => E.datosFlujo(state, mk), [state, mk]);
  const alertas = useMemo(() => {
    const todas = E.alertas(state, mk);
    const basal = todas.filter((a) => a.tipo === 'basal');
    const resto = todas.filter((a) => a.tipo !== 'basal');
    if (!basal.length) return resto;
    const total = basal.reduce((s, a) => s + a.importe, 0);
    const vacios = basal.some((a) => a.vacio);
    const agrupada = {
      nivel: basal.some((a) => !a.vacio) ? 'critico' : 'aviso', tipo: 'basal',
      titulo: vacios ? `Basal necesario: ${E.eur0(total)} en ${basal.length} cuentas` : `Faltan ${E.eur0(total)} en ${basal.length} cuentas`,
      texto: `${basal.sort((a, b) => b.importe - a.importe).map((a) => `${a.nombre} ${E.eur0(a.importe)} (${(E.MOMENTOS.find((m) => m.key === a.momento)?.label || '').toLowerCase()})`).join(' · ')}.${vacios ? ' Pon los saldos de inicio de mes en Cuentas para afinarlo.' : ''}`,
    };
    return [agrupada, ...resto];
  }, [state, mk]);
  const serie = useMemo(() => E.serieMeses(state, mk, 12), [state, mk]);
  const creditos = useMemo(() => E.estadoCreditos(state, mk), [state, mk]);
  const objetivos = useMemo(() => E.estadoObjetivos(state, mk), [state, mk]);

  const topArea = res.porArea.slice().sort((a, b) => b.importe - a.importe)[0];
  const lead = res.totalIngresos > 0
    ? `Entran ${E.eur0(res.totalIngresos)} y salen ${E.eur0(res.totalGastos)}. ${res.superavit >= 0 ? `Quedan ${E.eur0(res.superavit)} de superávit (${E.pct(res.tasaAhorro)} de lo que entra).` : `Faltan ${E.eur0(-res.superavit)} para cubrir el mes.`}${topArea ? ` Lo que más pesa: ${topArea.label.toLowerCase()}.` : ''}`
    : 'Todavía no hay ingresos previstos para este mes.';
  const cuotasMes = creditos.filter((c) => c.activo).reduce((s, c) => s + (Number(c.credito.cuota) || 0), 0);
  const porPagar = creditos.reduce((s, c) => s + c.totalPorPagar, 0);

  return (
    <div className="page">
      <PageHead title={`Resumen de ${E.mkLabel(mk).toLowerCase()}`} lead={lead} />

      <div className="kpis">
        <Kpi tone="in" icon={ArrowDownLeft} label="Ingresos" value={E.eur0(res.totalIngresos)} foot={<><Delta now={res.totalIngresos} prev={prev?.totalIngresos} /><span>{res.ingresos.filter((l) => l.confirmado).length} de {res.ingresos.filter((l) => l.estimado > 0 || l.confirmado).length} confirmados</span></>} />
        <Kpi tone="out" icon={ArrowUpRight} label="Gastos" value={E.eur0(res.totalGastos)} foot={<><Delta now={res.totalGastos} prev={prev?.totalGastos} invert /><span>{res.gastos.length} conceptos</span></>} />
        <Kpi tone="sur" icon={Scale} label="Superávit" value={E.eur0(res.superavit)} foot={<span>{E.pct(res.tasaAhorro)} de lo que entra se queda</span>} />
        <Kpi tone="sav" icon={PiggyBank} label="Para tus objetivos" value={E.eur0(res.aportadoPrevisto)} foot={<span>{res.aportado > 0 ? `${E.eur0(res.aportado)} ya apartados` : 'Según el reparto de Ahorro'}</span>} />
      </div>

      {alertas.length > 0 && (
        <div className="alerts">
          {alertas.slice(0, 6).map((a, i) => (
            <Alerta key={i} a={a} onClick={() => go(a.tipo === 'basal' ? 'cuentas' : a.tipo === 'pendientes' ? 'mes' : a.tipo === 'balloon' ? 'creditos' : a.tipo === 'deficit' ? 'gastos' : 'gastos')} />
          ))}
        </div>
      )}

      <div className="grid">
        <Card className="c8" title="Flujo del dinero" sub="De dónde viene, en qué cuenta entra o de cuál sale, y a qué se destina. Pasa el cursor por una franja para ver el importe.">
          {flujo.links.length ? <Sankey data={flujo} height={420} /> : <p className="muted">Sin movimientos este mes.</p>}
          <div className="legend">
            <span><span className="swatch" style={{ background: 'var(--in)' }} />Ingresos</span>
            <span><span className="swatch" style={{ background: 'var(--ink-2)' }} />Cuentas</span>
            <span><span className="swatch" style={{ background: 'var(--s0)' }} />Saldo previo en cuentas</span>
            <span><span className="swatch" style={{ background: 'var(--sur)' }} />Superávit que se queda</span>
          </div>
        </Card>
        <Card className="c4" title="A dónde se va" sub="Por categoría. Toca una para ver el detalle." actions={<button className="btn ghost sm" onClick={() => go('gastos')}>Ver gastos <ArrowRight size={14} /></button>}>
          <AreaList porArea={res.porArea} total={res.totalGastos} onPick={(k) => go('gastos', { area: k })} />
        </Card>
      </div>

      <div className="grid">
        <Card className="c5" title="Cómo sale el dinero" sub="Por medio de pago; las tarjetas, con su cargo del mes.">
          <MedioList state={state} porMedio={res.porMedio} total={res.totalGastos} />
        </Card>
        <Card className="c7" title="Superávit de los próximos 12 meses" sub="Los meses con cargos anuales o trimestrales bajan. Barras claras: previsión.">
          <MonthBars series={serie.map((s) => ({ mk: s.mk, estado: s.estado, values: { superavit: s.superavit } }))} keys={['superavit']} signed
            colorOf={(k, v) => (v < 0 ? 'var(--crit)' : 'var(--sur)')} labelOf={() => 'Superávit'} height={230} valueLabel="Superávit por mes" />
        </Card>
      </div>

      <div className="grid">
        <Card className="c6" title="Créditos" sub={`${E.eur0(cuotasMes)} al mes en cuotas · ${E.eur0(porPagar)} por pagar en total`} actions={<button className="btn ghost sm" onClick={() => go('creditos')}>Ver créditos <ArrowRight size={14} /></button>}>
          <div className="stack" style={{ gap: 12 }}>
            {creditos.filter((c) => c.totalPorPagar > 0).sort((a, b) => (a.ultimo || '9').localeCompare(b.ultimo || '9')).map((c) => (
              <div key={c.credito.id} className="row between wrap" style={{ gap: 6 }}>
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{c.credito.nombre}</div>
                  <div className="small muted">{E.eur(c.credito.cuota)}/mes{c.ultimo ? ` · termina en ${E.mkLabel(c.ultimo).toLowerCase()}` : ''}{c.finalPendiente ? ` · cuota final ${E.eur0(c.cuotaFinal)}` : ''}</div>
                </div>
                <div className="num" style={{ fontWeight: 800 }}>{E.eur0(c.totalPorPagar)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="c6" title="Objetivos de ahorro" actions={<button className="btn ghost sm" onClick={() => go('ahorro')}>Ver ahorro <ArrowRight size={14} /></button>}>
          <div className="stack" style={{ gap: 14 }}>
            {objetivos.map((o) => (
              <div key={o.objetivo.id} className="stack" style={{ gap: 5 }}>
                <div className="row between"><b>{o.objetivo.nombre}</b><span className="num small"><b>{E.eur0(o.ahorrado)}</b> <span className="muted">de {E.eur0(o.meta)}</span></span></div>
                <Progress value={o.progreso} color={o.progreso >= 1 ? 'var(--ok)' : 'var(--sav)'} />
                <div className="tiny muted">{o.progreso >= 1 ? 'Objetivo cubierto' : o.necesarioMes ? `Harían falta ${E.eur0(o.necesarioMes)} al mes para llegar a tiempo` : `Faltan ${E.eur0(o.falta)}`}{o.objetivo.contingente ? ' · contingente' : ''}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
