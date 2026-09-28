import React, { useMemo, useState } from 'react';
import * as E from '../engine.js';
import { Card, PageHead, Seg } from '../ui.jsx';
import { InOutBars } from '../charts.jsx';
import { colorArea } from './shared.jsx';

export function HistorialPage({ state, mk, setMk, go }) {
  const inicio = state.config.mesInicio;
  const [rango, setRango] = useState('12');
  const desde = rango === 'anio' ? (mk.slice(0, 4) + '-01' < inicio ? inicio : mk.slice(0, 4) + '-01') : inicio;
  const n = rango === 'anio' ? E.monthsBetween(desde, mk.slice(0, 4) + '-12') + 1 : Math.max(12, E.monthsBetween(inicio, mk) + 1);
  const serie = useMemo(() => E.serieMeses(state, desde, n), [state, desde, n]);
  const areas = E.AREAS.map((a) => a.key).filter((k) => serie.some((s) => (s.porArea[k] || 0) > 0));
  const tot = (f) => serie.reduce((s, x) => s + (typeof f === 'function' ? f(x) : x[f]), 0);
  const estadoPill = (e) => (e === 'cerrado' ? 'ok' : e === 'en curso' ? 'warn' : 'neutral');

  return (
    <div className="page">
      <PageHead title="Historial" lead="Cada mes, lo que entró, lo que salió y lo que quedó. Los meses sin confirmar aparecen como previsión.">
        <Seg value={rango} onChange={setRango} ariaLabel="Periodo" options={[{ key: '12', label: 'Desde el inicio' }, { key: 'anio', label: `Año ${mk.slice(0, 4)}` }]} />
      </PageHead>

      <Card title="Ingresos, gastos y superávit" sub="Verde: ingresos · coral: gastos · punto: superávit. Barras claras: previsión.">
        <InOutBars series={serie} />
      </Card>

      <Card title="Mes a mes" sub="Toca un mes para abrirlo.">
        <div className="tablewrap">
          <table className="t">
            <thead>
              <tr><th>Concepto</th>{serie.map((s) => <th key={s.mk} className="n"><button className="btn ghost sm" style={{ padding: '2px 4px' }} onClick={() => { setMk(s.mk); go('resumen'); }}>{E.mkShort(s.mk)}</button></th>)}<th className="n">Total</th></tr>
              <tr><th /> {serie.map((s) => <th key={s.mk} className="n"><span className={`pill ${estadoPill(s.estado)}`}>{s.estado}</span></th>)}<th /></tr>
            </thead>
            <tbody>
              <tr><td><b style={{ color: 'var(--in)' }}>Ingresos</b></td>{serie.map((s) => <td key={s.mk} className="n">{E.eur0(s.ingresos)}</td>)}<td className="n"><b>{E.eur0(tot('ingresos'))}</b></td></tr>
              {areas.map((k) => (
                <tr key={k}><td><span className="row" style={{ gap: 7 }}><span className="swatch" style={{ background: colorArea(k) }} />{E.areaDe(k).label}</span></td>{serie.map((s) => <td key={s.mk} className="n ink2">{s.porArea[k] ? E.eur0(s.porArea[k]) : '—'}</td>)}<td className="n">{E.eur0(tot((x) => x.porArea[k] || 0))}</td></tr>
              ))}
              <tr><td><b style={{ color: 'var(--out)' }}>Gastos</b></td>{serie.map((s) => <td key={s.mk} className="n"><b>{E.eur0(s.gastos)}</b></td>)}<td className="n"><b>{E.eur0(tot('gastos'))}</b></td></tr>
              <tr className="tot"><td>Superávit</td>{serie.map((s) => <td key={s.mk} className="n" style={{ color: s.superavit < 0 ? 'var(--crit)' : undefined }}>{E.eur0(s.superavit)}</td>)}<td className="n">{E.eur0(tot('superavit'))}</td></tr>
              <tr><td>Tasa de ahorro</td>{serie.map((s) => <td key={s.mk} className="n">{E.pct(s.tasaAhorro)}</td>)}<td className="n">{E.pct(tot('ingresos') ? (tot('superavit') / tot('ingresos')) * 100 : 0)}</td></tr>
              <tr><td>Apartado para objetivos</td>{serie.map((s) => <td key={s.mk} className="n">{s.aportado ? E.eur0(s.aportado) : '—'}</td>)}<td className="n">{E.eur0(tot('aportado'))}</td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
