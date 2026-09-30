import React, { useMemo, useState, useEffect } from 'react';
import { Plus, ArrowUpRight, CalendarRange, Repeat, CreditCard, Pencil } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Kpi, Delta, Seg } from '../ui.jsx';
import { MonthBars } from '../charts.jsx';
import { AreaList, MedioList, LegendAreas, colorArea, ICONO_MEDIO } from './shared.jsx';
import { GastoForm } from '../forms.jsx';

export function GastosPage({ state, mk, A, focus, setFocus, go }) {
  const [vista, setVista] = useState('analisis');
  const [edit, setEdit] = useState(null);
  const [agrupar, setAgrupar] = useState('area');
  const [filtroArea, setFiltroArea] = useState(focus?.area || 'todas');
  useEffect(() => { if (focus?.area) { setFiltroArea(focus.area); setVista('analisis'); } }, [focus]);

  const res = useMemo(() => E.resumenMes(state, mk), [state, mk]);
  const prev = useMemo(() => (mk > state.config.mesInicio ? E.resumenMes(state, E.addMonths(mk, -1)) : null), [state, mk]);
  const medias = useMemo(() => E.mediasMensuales(state, mk), [state, mk]);
  const desde = state.config.mesInicio;
  const serie = useMemo(() => E.serieMeses(state, desde, Math.max(12, E.monthsBetween(desde, mk) + 4)), [state, desde, mk]);

  const noMensuales = res.gastos.filter((l) => l.origen === 'mov' && l.ref.frecuencia !== 'mensual').sort((a, b) => b.importe - a.importe);
  const noMensual = noMensuales.reduce((s, l) => s + l.importe, 0);
  const tarjetas = res.gastos.filter((l) => l.origen === 'tarjeta').reduce((s, l) => s + l.importe, 0);
  const areasConDatos = E.categorias(state).map((a) => a.key).filter((k) => serie.some((s) => (s.porArea[k] || 0) > 0));
  const abierta = filtroArea !== 'todas' ? [filtroArea] : [];

  return (
    <div className="page">
      <PageHead title="Gastos" lead="En qué se va el dinero, por categoría y subcategoría, y cómo se paga. Aquí también configuras cada gasto, incluidos los de cada tarjeta.">
        <Seg value={vista} onChange={(v) => { setVista(v); setFocus(null); }} options={[{ key: 'analisis', label: 'Análisis' }, { key: 'config', label: 'Configurar' }]} ariaLabel="Vista" />
        <button className="btn primary" onClick={() => setEdit('nuevo')}><Plus size={16} /> Nuevo gasto</button>
      </PageHead>

      {vista === 'analisis' && (
        <>
          <div className="kpis">
            <Kpi tone="out" icon={ArrowUpRight} label={`Gastos de ${E.mkLabel(mk).split(' ')[0].toLowerCase()}`} value={E.eur0(res.totalGastos)} foot={<Delta now={res.totalGastos} prev={prev?.totalGastos} invert />} />
            <Kpi tone="neutral" icon={CalendarRange} label="Media mensual" value={E.eur0(medias.gastos)} foot={<span>Reparte los anuales y trimestrales</span>} />
            <Kpi tone="neutral" icon={Repeat} label="Cargos no mensuales" value={E.eur0(noMensual)} foot={<span>{noMensuales.length ? noMensuales.slice(0, 3).map((l) => `${l.nombre} ${E.eur0(l.importe)}`).join(' · ') : 'Este mes solo hay gastos mensuales'}</span>} />
            <Kpi tone="neutral" icon={CreditCard} label="En tarjetas" value={E.eur0(tarjetas)} foot={<span>{res.gastos.filter((l) => l.origen === 'tarjeta').map((l) => `${l.nombre.split(' ')[0]} ${E.eur0(l.importe)}`).join(' · ')}</span>} />
          </div>
          <div className="grid">
            <Card className="c7" title="Por categoría" sub="Toca una categoría para ver sus subcategorías y conceptos. Los gastos de tarjeta se reparten según lo que tienes configurado.">
              <AreaList key={filtroArea} porArea={res.porArea} total={res.totalGastos} abiertas={abierta} />
            </Card>
            <Card className="c5" title="Cómo se paga" sub="Recibos, tarjetas y transferencias.">
              <MedioList state={state} porMedio={res.porMedio} total={res.totalGastos} />
            </Card>
          </div>
          <Card title="Evolución por categoría" sub="Gasto de cada mes apilado por categoría. Barras claras: previsión.">
            <MonthBars series={serie.map((s) => ({ mk: s.mk, estado: s.estado, values: s.porArea }))} keys={areasConDatos} colorOf={(k) => colorArea(k, state)} labelOf={(k) => E.areaDe(k, state).label} height={260} valueLabel="Gasto por categoría y mes" />
            <LegendAreas state={state} keys={areasConDatos} />
          </Card>
        </>
      )}

      {vista === 'config' && (
        <Configurar state={state} mk={mk} agrupar={agrupar} setAgrupar={setAgrupar} filtroArea={filtroArea} setFiltroArea={setFiltroArea} onEdit={setEdit} go={go} />
      )}

      <GastoForm open={!!edit} item={edit && edit !== 'nuevo' && !edit.preset ? edit : null} preset={edit && edit.preset ? edit.preset : null} state={state} mk={mk} onClose={() => setEdit(null)}
        onSave={(x) => { A.upsertMov(x); setEdit(null); }} onDelete={() => { A.deleteMov(edit.id); setEdit(null); }} />
    </div>
  );
}

function Configurar({ state, mk, agrupar, setAgrupar, filtroArea, setFiltroArea, onEdit, go }) {
  const gastos = state.movimientos.filter((x) => x.tipo === 'gasto' && (filtroArea === 'todas' || x.area === filtroArea));
  const grupos = [];
  if (agrupar === 'area') {
    E.categorias(state).forEach((a) => {
      const items = gastos.filter((x) => x.area === a.key);
      if (items.length) grupos.push({ key: a.key, titulo: a.label, color: colorArea(a.key, state), items, total: items.reduce((s, x) => s + E.equivalenteMensual(x), 0) });
    });
  } else {
    state.config.tarjetas.forEach((t) => {
      const items = gastos.filter((x) => x.medio === 'tarjeta' && x.tarjetaId === t.id);
      grupos.push({ key: t.id, titulo: t.nombre, sub: `Se carga en ${E.nombreCuenta(state, t.cuentaDebitoId)} · ${E.MOMENTOS.find((m) => m.key === t.momento)?.label.toLowerCase()}`, color: 'var(--m2)', items, total: items.reduce((s, x) => s + E.equivalenteMensual(x), 0), tarjeta: t, esteMes: items.filter((x) => E.aplica(x, mk)).reduce((s, x) => s + (Number(x.importe) || 0), 0) });
    });
    E.MEDIOS.filter((m) => m.key !== 'tarjeta').forEach((m) => {
      const items = gastos.filter((x) => x.medio === m.key);
      if (items.length) grupos.push({ key: m.key, titulo: m.label, color: 'var(--m1)', items, total: items.reduce((s, x) => s + E.equivalenteMensual(x), 0) });
    });
  }
  const frec = (x) => (x.frecuencia === 'esporadico' ? `Puntual · ${E.MESES[(x.mesEsporadico || 1) - 1].toLowerCase()} ${x.anoEsporadico}` : `${E.FRECUENCIAS.find((f) => f.key === x.frecuencia)?.label}${x.mesReferencia && x.frecuencia !== 'mensual' ? ` (${E.MESES[x.mesReferencia - 1].toLowerCase()})` : ''}`);
  const donde = (x) => (x.medio === 'tarjeta' ? E.nombreTarjeta(state, x.tarjetaId) : `${E.nombreCuenta(state, x.cuenta)} · ${E.MOMENTOS.find((m) => m.key === x.momento)?.label.toLowerCase()}`);

  return (
    <>
      <div className="row wrap between">
        <Seg value={agrupar} onChange={setAgrupar} ariaLabel="Agrupar por" options={[{ key: 'area', label: 'Por categoría' }, { key: 'medio', label: 'Por tarjeta y medio de pago' }]} />
        <select className="in-ctl" style={{ width: 'auto' }} value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} aria-label="Filtrar por categoría">
          <option value="todas">Todas las categorías</option>
          {E.categorias(state).filter((a) => a.key !== 'creditos').map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </div>
      {agrupar === 'medio' && <div className="note">Lo que pones en cada tarjeta es aproximado: sirve para ver la tendencia y como estimado del mes. El cargo real de cada tarjeta lo confirmas en «Mes a mes».</div>}
      <div className="grid">
        {grupos.map((g) => (
          <Card key={g.key} className="c6" title={<span className="row" style={{ gap: 8 }}><span className="swatch" style={{ background: g.color }} />{g.titulo}</span>}
            sub={<>{g.sub ? `${g.sub} · ` : ''}≈ {E.eur0(g.total)} al mes{g.esteMes !== undefined ? ` · ${E.eur0(g.esteMes)} en ${E.mkLabel(mk).split(' ')[0].toLowerCase()}` : ''}</>}
            actions={g.tarjeta ? <button className="btn sm" onClick={() => onEdit({ preset: { medio: 'tarjeta', tarjetaId: g.tarjeta.id } })}><Plus size={14} /> Añadir</button> : null}>
            {g.items.length === 0 && <p className="muted small">Sin gastos configurados en esta tarjeta.</p>}
            <div className="stack" style={{ gap: 2 }}>
              {g.items.slice().sort((a, b) => E.equivalenteMensual(b) - E.equivalenteMensual(a)).map((x) => {
                const I = ICONO_MEDIO[x.medio] || ICONO_MEDIO.efectivo;
                return (
                  <button key={x.id} className="arearow" onClick={() => onEdit(x)} style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="nm"><span className="swatch" style={{ background: colorArea(x.area, state) }} /><span className="t">{x.nombre}</span></span>
                      <span className="tiny muted row" style={{ gap: 5, marginTop: 2 }}><I size={12} />{x.sub ? `${x.sub} · ` : ''}{frec(x)} · {donde(x)}</span>
                    </span>
                    <span className="vl">{x.calculado ? `${x.porcentaje ?? 10} % ingresos` : E.eur(x.importe)}</span>
                    <Pencil size={14} className="muted" />
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
        <Card className="c6" title="Créditos" sub="Las cuotas de préstamos y financiaciones se gestionan en su propia sección.">
          <button className="btn" onClick={() => go('creditos')}>Ir a Créditos</button>
        </Card>
      </div>
    </>
  );
}
