import React, { useMemo, useState } from 'react';
import { Plus, ArrowDownLeft, CalendarRange, Users, Sparkles, Pencil } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Kpi, Delta } from '../ui.jsx';
import { MonthBars, StackBar } from '../charts.jsx';
import { IngresoForm } from '../forms.jsx';

const SLOT_FUENTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

export function IngresosPage({ state, mk, A }) {
  const [edit, setEdit] = useState(null);
  const res = useMemo(() => E.resumenMes(state, mk), [state, mk]);
  const prev = useMemo(() => (mk > state.config.mesInicio ? E.resumenMes(state, E.addMonths(mk, -1)) : null), [state, mk]);
  const medias = useMemo(() => E.mediasMensuales(state, mk), [state, mk]);
  const desde = state.config.mesInicio;
  const serie = useMemo(() => E.serieMeses(state, desde, Math.max(12, E.monthsBetween(desde, mk) + 4)), [state, desde, mk]);

  const ingresos = state.movimientos.filter((x) => x.tipo === 'ingreso');
  // fuentes con color fijo por orden de aparición en la configuración
  const fuentes = [...new Set(ingresos.map((x) => x.nombre))];
  const colorFuente = (n) => { const i = fuentes.indexOf(n); return i >= 0 && i < 8 ? SLOT_FUENTE[i] : 'var(--s0)'; };
  const conDatos = fuentes.filter((f) => serie.some((s) => (s.porFuente[f] || 0) > 0));

  const porTitular = {};
  res.ingresos.forEach((l) => { const t = l.titular || 'Sin asignar'; porTitular[t] = (porTitular[t] || 0) + l.importe; });
  const titulares = Object.entries(porTitular).sort((a, b) => b[1] - a[1]);
  const cerrados = serie.filter((s) => s.estado !== 'proyectado' && s.mk <= mk);
  const mediaReal = cerrados.length ? cerrados.reduce((s, x) => s + x.ingresos, 0) / cerrados.length : null;
  const extrasAnio = serie.filter((s) => s.mk.slice(0, 4) === mk.slice(0, 4)).reduce((acc, s) => {
    const r = E.resumenMes(state, s.mk); return acc + r.ingresos.filter((l) => l.clase === 'extra').reduce((a, l) => a + l.importe, 0);
  }, 0);

  const cuenta = (id) => E.nombreCuenta(state, id);
  const frec = (x) => (x.frecuencia === 'esporadico' ? `Puntual · ${E.MESES[(x.mesEsporadico || 1) - 1].toLowerCase()} ${x.anoEsporadico}` : E.FRECUENCIAS.find((f) => f.key === x.frecuencia)?.label);
  const lista = ingresos.slice().sort((a, b) => (a.clase === b.clase ? E.equivalenteMensual(b) - E.equivalenteMensual(a) : a.clase === 'recibo' ? -1 : 1));

  return (
    <div className="page">
      <PageHead title="Ingresos" lead="De dónde viene el dinero, quién lo aporta y cómo evoluciona mes a mes.">
        <button className="btn primary" onClick={() => setEdit('nuevo')}><Plus size={16} /> Nuevo ingreso</button>
      </PageHead>

      <div className="kpis">
        <Kpi tone="in" icon={ArrowDownLeft} label={`Ingresos de ${E.mkLabel(mk).split(' ')[0].toLowerCase()}`} value={E.eur0(res.totalIngresos)} foot={<Delta now={res.totalIngresos} prev={prev?.totalIngresos} />} />
        <Kpi tone="neutral" icon={CalendarRange} label="Media mensual fija" value={E.eur0(medias.ingresos)} foot={<span>{mediaReal !== null ? `Media real hasta ahora: ${E.eur0(mediaReal)}` : 'Sin meses confirmados todavía'}</span>} />
        <Kpi tone="neutral" icon={Users} label="Quién aporta" value={titulares.length ? `${Math.round((titulares[0][1] / (res.totalIngresos || 1)) * 100)} % ${titulares[0][0]}` : '—'} foot={<span>{titulares.slice(1).map(([t, v]) => `${t}: ${Math.round((v / (res.totalIngresos || 1)) * 100)} %`).join(' · ')}</span>} />
        <Kpi tone="neutral" icon={Sparkles} label={`Extras en ${mk.slice(0, 4)}`} value={E.eur0(extrasAnio)} foot={<span>Ingresos puntuales previstos o cobrados</span>} />
      </div>

      <div className="grid">
        <Card className="c7" title="De dónde vienen este mes" sub="Peso de cada fuente sobre el total del mes.">
          <StackBar tall parts={res.porFuente.map((f) => ({ key: f.key, label: f.nombre, value: f.importe, color: colorFuente(f.nombre) }))} />
          <div className="tablewrap">
            <table className="t">
              <thead><tr><th>Fuente</th><th className="hide-sm">Entra en</th><th className="hide-sm">Cuándo</th><th className="n">Importe</th><th className="n">% del mes</th></tr></thead>
              <tbody>
                {res.ingresos.filter((l) => l.importe > 0 || l.estimado > 0).sort((a, b) => b.importe - a.importe).map((l) => (
                  <tr key={l.key}>
                    <td><span className="row" style={{ gap: 8 }}><span className="swatch" style={{ background: colorFuente(l.nombre) }} /><span><b>{l.nombre}</b><div className="tiny muted">{l.titular}{l.clase === 'extra' ? ' · extra' : ''}{l.confirmado ? ' · confirmado' : ' · estimado'}</div></span></span></td>
                    <td className="hide-sm">{cuenta(l.cuenta)}</td>
                    <td className="hide-sm">{E.MOMENTOS.find((m) => m.key === l.momento)?.label}</td>
                    <td className="n"><b>{E.eur(l.importe)}</b></td>
                    <td className="n">{res.totalIngresos > 0 ? E.pct((l.importe / res.totalIngresos) * 100) : '—'}</td>
                  </tr>
                ))}
                <tr className="tot"><td>Total</td><td className="hide-sm" /><td className="hide-sm" /><td className="n">{E.eur(res.totalIngresos)}</td><td className="n">100 %</td></tr>
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="c5" title="Por persona" sub="Lo que aporta cada uno este mes.">
          <div className="stack" style={{ gap: 14 }}>
            {titulares.map(([t, v], i) => (
              <div key={t} className="stack" style={{ gap: 6 }}>
                <div className="row between"><b>{t}</b><span className="num"><b>{E.eur0(v)}</b> <span className="muted small">{E.pct((v / (res.totalIngresos || 1)) * 100)}</span></span></div>
                <div className="bar tall"><span style={{ width: `${(v / (res.totalIngresos || 1)) * 100}%`, background: i === 0 ? 'var(--in)' : 'var(--m3)' }} /></div>
              </div>
            ))}
            <div className="note">Media mensual de referencia: <b>{E.eur0(medias.ingresos)}</b>. Cuenta solo los ingresos fijos; los extras se ven en su mes.</div>
          </div>
        </Card>
      </div>

      <Card title="Historial y previsión" sub="Ingresos por fuente cada mes. Barras claras: meses sin confirmar todavía.">
        <MonthBars series={serie.map((s) => ({ mk: s.mk, estado: s.estado, values: s.porFuente }))} keys={conDatos} colorOf={colorFuente} labelOf={(k) => k} height={250} valueLabel="Ingresos por fuente y mes" />
        <div className="legend">{conDatos.map((f) => <span key={f}><span className="swatch" style={{ background: colorFuente(f) }} />{f}</span>)}</div>
      </Card>

      <Card title="Tus ingresos configurados" sub="Toca uno para editarlo.">
        <div className="tablewrap">
          <table className="t">
            <thead><tr><th>Concepto</th><th className="hide-sm">Frecuencia</th><th className="hide-sm">Cuenta</th><th className="n">Importe</th><th className="n hide-sm">Al mes</th><th /></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className="click" onClick={() => setEdit(x)}>
                  <td><b>{x.nombre}</b><div className="tiny muted">{x.titular} · {x.clase === 'extra' ? 'Extra' : 'Fijo'}{x.fechaFin ? ` · hasta ${E.mkShort(x.fechaFin)}` : ''}</div></td>
                  <td className="hide-sm">{frec(x)}</td>
                  <td className="hide-sm">{cuenta(x.cuenta)}</td>
                  <td className="n"><b>{E.eur(x.importe)}</b></td>
                  <td className="n hide-sm muted">{x.frecuencia === 'esporadico' ? '—' : E.eur(E.equivalenteMensual(x))}</td>
                  <td className="n"><Pencil size={14} className="muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <IngresoForm open={!!edit} item={edit && edit !== 'nuevo' ? edit : null} state={state} mk={mk} onClose={() => setEdit(null)}
        onSave={(x) => { A.upsertMov(x); setEdit(null); }} onDelete={() => { A.deleteMov(edit.id); setEdit(null); }} />
    </div>
  );
}
