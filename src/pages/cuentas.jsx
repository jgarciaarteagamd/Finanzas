import React, { useMemo, useState } from 'react';
import { Plus, Pencil, ArrowRight, Landmark, CreditCard, Wallet, Scale } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead, Seg, Editable, Kpi } from '../ui.jsx';
import { SaldoSpark, StackBar } from '../charts.jsx';
import { colorArea } from './shared.jsx';
import { CuentaForm, TarjetaForm, GastoForm } from '../forms.jsx';

export function CuentasPage({ state, mk, A, go }) {
  const [vista, setVista] = useState('cuentas');
  const [editC, setEditC] = useState(null);
  const [editT, setEditT] = useState(null);
  const [nuevoGasto, setNuevoGasto] = useState(null);
  const flujo = useMemo(() => E.flujoCuentas(state, mk), [state, mk]);
  const sugerencias = useMemo(() => E.sugerenciasTraspaso(flujo), [flujo]);
  const res = flujo.resumen;
  const sig = E.addMonths(mk, 1);

  const grupos = {};
  flujo.cuentas.forEach((c) => { const t = c.cuenta.titular || 'Otras'; (grupos[t] = grupos[t] || []).push(c); });
  const totalIni = flujo.cuentas.reduce((s, c) => s + c.saldoInicial, 0);
  const totalFin = flujo.cuentas.reduce((s, c) => s + c.saldoFinal, 0);
  const necesita = flujo.cuentas.reduce((s, c) => s + c.deficit, 0);
  const faltanSaldos = flujo.cuentas.filter((c) => c.saldoOrigen === 'vacio' && (c.entradas || c.salidas)).length;
  const haySaldos = flujo.cuentas.some((c) => c.saldoOrigen !== 'vacio');

  return (
    <div className="page">
      <PageHead title="Cuentas y tarjetas" lead={`Cuánto hay en cada cuenta al empezar ${E.mkLabel(mk).split(' ')[0].toLowerCase()}, qué entra y sale en cada momento del mes y con cuánto empezaría ${E.mkLabel(sig).split(' ')[0].toLowerCase()}.`}>
        <Seg value={vista} onChange={setVista} ariaLabel="Vista" options={[{ key: 'cuentas', label: 'Cuentas' }, { key: 'tarjetas', label: 'Tarjetas' }]} />
        <button className="btn primary" onClick={() => (vista === 'cuentas' ? setEditC('nuevo') : setEditT('nuevo'))}><Plus size={16} /> {vista === 'cuentas' ? 'Nueva cuenta' : 'Nueva tarjeta'}</button>
      </PageHead>

      {vista === 'cuentas' && (
        <>
          <div className="kpis">
            <Kpi tone="neutral" icon={Wallet} label="Saldo al empezar el mes" value={E.eur0(totalIni)} foot={<span>{faltanSaldos ? `Faltan ${faltanSaldos} saldos por poner` : 'Suma de todas las cuentas'}</span>} />
            <Kpi tone="sur" icon={Scale} label={`Saldo previsto al empezar ${E.mkLabel(sig).split(' ')[0].toLowerCase()}`} value={E.eur0(totalFin)} foot={<span>{totalFin >= totalIni ? '+' : ''}{E.eur0(totalFin - totalIni)} en el mes</span>} />
            <Kpi tone={necesita > 0 ? 'out' : 'in'} icon={Landmark} label={haySaldos ? 'Basal que falta' : 'Basal necesario'} value={E.eur0(necesita)} foot={<span>{necesita > 0 ? 'Para cubrir los cargos en el momento en que salen' : 'Todas las cuentas llegan'}</span>} />
            <Kpi tone="neutral" icon={CreditCard} label="Tarjetas este mes" value={E.eur0(res.gastos.filter((l) => l.origen === 'tarjeta').reduce((s, l) => s + l.importe, 0))} foot={<span>Se cargan en sus cuentas</span>} />
          </div>

          {!haySaldos && (
            <div className="banner"><b>Empieza por los saldos.</b><span>Pon lo que hay en cada cuenta el día 1 (toca «Poner saldo»). Con eso la app calcula si cada cuenta llega y qué traspasos hacen falta. Los meses siguientes se arrastran solos.</span></div>
          )}
          {haySaldos && sugerencias.length > 0 && (
            <Card title="Movimientos recomendados entre cuentas" sub="Para que ningún cargo quede sin cubrir, en el momento del mes en que sale.">
              <div className="stack">
                {sugerencias.map((s, i) => (
                  <div key={i} className="row wrap" style={{ gap: 8 }}>
                    <span className={`pill ${s.desde ? 'info' : 'warn'}`}>{E.MOMENTOS.find((m) => m.key === s.cuando)?.label || 'Este mes'}</span>
                    <b>{s.desde ? s.desde.nombre : 'Ingresa o trae de otra cuenta'}</b><ArrowRight size={15} className="muted" /><b>{s.hacia.nombre}</b>
                    <span className="num" style={{ marginLeft: 'auto', fontWeight: 800 }}>{E.eur0(s.importe)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {Object.entries(grupos).map(([titular, cs]) => (
            <div key={titular} className="stack" style={{ gap: 10 }}>
              <div className="eyebrow">{titular}</div>
              <div className="objgrid">
                {cs.map((c) => (
                  <Card key={c.cuenta.id} title={c.cuenta.nombre} sub={c.cuenta.notas || null}
                    actions={<button className="icon-btn" onClick={() => setEditC(c.cuenta)} aria-label={`Editar ${c.cuenta.nombre}`}><Pencil size={15} /></button>}>
                    <div className="row between wrap" style={{ gap: 10 }}>
                      <div>
                        <div className="eyebrow">Saldo al día 1</div>
                        <Editable value={c.saldoOrigen === 'introducido' ? c.saldoInicial : undefined} placeholder={c.saldoOrigen === 'arrastrado' ? `${E.eur0(c.saldoInicial)} (previsto)` : 'Poner saldo'}
                          onSave={(v) => A.setSaldo(mk, c.cuenta.id, v)} ariaLabel={`Saldo inicial de ${c.cuenta.nombre}`} />
                        <div className="tiny muted">{c.saldoOrigen === 'introducido' ? 'Lo pusiste tú' : c.saldoOrigen === 'arrastrado' ? 'Arrastrado del mes anterior' : 'Sin saldo todavía'}</div>
                      </div>
                      {(c.entradas > 0 || c.salidas > 0) && <SaldoSpark puntos={[{ v: c.saldoInicial }, ...c.pasos.map((p) => ({ v: p.saldo }))]} />}
                    </div>
                    {(c.entradas > 0 || c.salidas > 0) ? (
                      <>
                        <div className="steps">
                          <div><div className="tiny muted">Empieza</div><div className={`v ${c.saldoInicial < 0 ? 'neg' : ''}`}>{E.eur0(c.saldoInicial)}</div></div>
                          {c.pasos.map((p) => (
                            <div key={p.momento}><div className="tiny muted">{{ inicio: 'Tras el 1', medio: 'Tras el 15', fin: 'Al cerrar' }[p.momento]}</div><div className={`v ${p.saldo < 0 ? 'neg' : ''}`}>{E.eur0(p.saldo)}</div></div>
                          ))}
                        </div>
                        <div className="row wrap small" style={{ gap: 10 }}>
                          <span style={{ color: 'var(--in)', fontWeight: 700 }}>+{E.eur0(c.entradas)}</span>
                          <span style={{ color: 'var(--out)', fontWeight: 700 }}>−{E.eur0(c.salidas)}</span>
                          {c.deficit > 0 ? <span className="pill crit">Faltan {E.eur0(c.deficit)}</span> : <span className="pill ok">Llega</span>}
                        </div>
                      </>
                    ) : <div className="tiny muted">Sin movimientos previstos este mes.</div>}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {vista === 'tarjetas' && (
        <>
          <div className="note">Aquí ves cada tarjeta: lo que tienes configurado para este mes en Gastos (el estimado) y el cargo real, que confirmas aquí o en «Mes a mes».</div>
          <div className="objgrid">
            {state.config.tarjetas.map((t) => {
              const linea = res.gastos.find((l) => l.key === `tarjeta:${t.id}`);
              const items = state.movimientos.filter((x) => x.tipo === 'gasto' && x.medio === 'tarjeta' && x.tarjetaId === t.id);
              const delMesCfg = items.filter((x) => E.aplica(x, mk) && (Number(x.importe) || 0) > 0);
              const delMes = linea && linea.conExtracto ? linea.desglose.map((d, i) => ({ id: `d${i}`, nombre: d.nombre, area: d.area, importe: d.importe })) : delMesCfg;
              const estimado = delMesCfg.reduce((s, x) => s + (Number(x.importe) || 0), 0);
              const media = E.mediaTarjeta(state, t.id, mk);
              const porArea = {};
              delMes.forEach((x) => { porArea[x.area] = (porArea[x.area] || 0) + (Number(x.importe) || 0); });
              return (
                <Card key={t.id} title={<span className="row" style={{ gap: 8 }}><CreditCard size={17} style={{ color: 'var(--m2)' }} />{t.nombre}</span>}
                  sub={`${t.titular} · se carga en ${E.nombreCuenta(state, t.cuentaDebitoId)} ${E.MOMENTOS.find((m) => m.key === t.momento)?.label.toLowerCase()}`}
                  actions={<button className="icon-btn" onClick={() => setEditT(t)} aria-label={`Editar ${t.nombre}`}><Pencil size={15} /></button>}>
                  <div className="credit-meta">
                    <div><div className="eyebrow">Previsto</div><div className="v">{E.eur0(estimado)}</div></div>
                    <div><div className="eyebrow">Cargo real</div><Editable className="amt v" value={linea && linea.confirmado ? linea.real : undefined} placeholder="Poner" onSave={(v) => A.setReal(mk, `tarjeta:${t.id}`, v)} ariaLabel={`Cargo real de ${t.nombre}`} /></div>
                    <div><div className="eyebrow">Media</div><div className="v">{E.eur0(media)}</div></div>
                  </div>
                  {linea && linea.conExtracto && <div className="eyebrow">Según el extracto ({linea.movsExtracto} movimientos)</div>}
                  {delMes.length > 0 && <StackBar parts={Object.entries(porArea).map(([k, v]) => ({ key: k, label: E.areaDe(k).label, value: v, color: colorArea(k) }))} />}
                  <div className="stack" style={{ gap: 4 }}>
                    {delMes.sort((a, b) => b.importe - a.importe).map((x) => (
                      <div key={x.id} className="row between small"><span className="row" style={{ gap: 7 }}><span className="swatch" style={{ background: colorArea(x.area) }} />{x.nombre}</span><span className="num">{E.eur(x.importe)}</span></div>
                    ))}
                    {delMes.length === 0 && <div className="small muted">Nada configurado para este mes.</div>}
                  </div>
                  <div className="row wrap">
                    <button className="btn sm" onClick={() => setNuevoGasto({ medio: 'tarjeta', tarjetaId: t.id })}><Plus size={14} /> Añadir gasto</button>
                    <button className="btn ghost sm" onClick={() => go('gastos')}>Editar en Gastos</button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <CuentaForm open={!!editC} item={editC && editC !== 'nuevo' ? editC : null} onClose={() => setEditC(null)}
        onSave={(x) => { A.upsertCuenta(x); setEditC(null); }} onDelete={() => { A.deleteCuenta(editC.id); setEditC(null); }} />
      <TarjetaForm open={!!editT} item={editT && editT !== 'nuevo' ? editT : null} state={state} onClose={() => setEditT(null)}
        onSave={(x) => { A.upsertTarjeta(x); setEditT(null); }} onDelete={() => { A.deleteTarjeta(editT.id); setEditT(null); }} />
      <GastoForm open={!!nuevoGasto} preset={nuevoGasto} state={state} mk={mk} onClose={() => setNuevoGasto(null)} onSave={(g) => { A.upsertMov(g); setNuevoGasto(null); }} />
    </div>
  );
}
