import React, { useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import * as E from '../engine.js';
import { Card, PageHead } from '../ui.jsx';
import { FormDrawer } from '../forms.jsx';
const igual = (a, b) => a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0;

export function EtiquetasPage({ state, A }) {
  const [edit, setEdit] = useState(null);
  const [sub, setSub] = useState(null);
  const lista = E.categorias(state);
  const categoria = edit && edit !== 'nuevo' ? edit : null;
  const protegida = categoria && ['otros', 'creditos'].includes(categoria.key);
  return <div className="page">
    <PageHead title="Etiquetas" lead="Organiza gastos y traspasos por categoría y subcategoría. Renombrar actualiza también los movimientos y extractos ya guardados.">
      <button className="btn primary" onClick={() => setEdit('nuevo')}><Plus size={16} /> Nueva categoría</button>
    </PageHead>
    <div className="note">Al eliminar una categoría, sus movimientos pasan a «{E.areaDe('otros', state).label}» sin subcategoría. Al eliminar una subcategoría, conservan su categoría. Los importes se mantienen. Las categorías de respaldo y créditos se pueden renombrar, pero son necesarias para el funcionamiento de la app.</div>
    <div className="objgrid">{lista.map((a) => <Card key={a.key} title={a.label} actions={<button className="icon-btn" aria-label={`Editar categoría ${a.label}`} onClick={() => setEdit(a)}><Pencil size={15} /></button>}>
      <div className="stack">{E.subcategorias(state, a.key).map((s) => <div className="row between" key={s}><span>{s}</span><button className="icon-btn" aria-label={`Editar subcategoría ${s} de ${a.label}`} onClick={() => setSub({ area: a.key, anterior: s })}><Pencil size={14} /></button></div>)}</div>
      <button className="btn sm" onClick={() => setSub({ area: a.key, anterior: '' })}><Plus size={14} /> Nueva subcategoría</button>
    </Card>)}</div>
    <FormDrawer open={!!edit} title={categoria ? 'Editar categoría' : 'Nueva categoría'} initial={{ nombre: categoria?.label || '' }}
      fields={[{ name: 'nombre', label: 'Nombre', required: true, hint: protegida ? 'Categoría necesaria para la app; puedes cambiar su nombre.' : 'Eliminarla reasigna sus movimientos a la categoría de respaldo, sin subcategoría.' }]}
      validate={(v) => lista.some((a) => a.key !== categoria?.key && igual(a.label, v.nombre)) ? 'Ya existe una categoría con ese nombre.' : ''}
      onClose={() => setEdit(null)} onSave={(v) => { A.transformar((s) => E.guardarCategoria(s, { key: categoria?.key || E.nid('cat'), label: v.nombre, slot: categoria?.slot ?? (lista.length % 8 + 1) })); setEdit(null); }}
      onDelete={categoria && !protegida ? () => { A.transformar((s) => E.eliminarCategoria(s, categoria.key)); setEdit(null); } : null} />
    <FormDrawer open={!!sub} title={sub?.anterior ? 'Editar subcategoría' : 'Nueva subcategoría'} initial={{ nombre: sub?.anterior || '' }}
      fields={[{ name: 'nombre', label: 'Nombre', required: true, hint: sub ? `Categoría: ${E.areaDe(sub.area, state).label}. Eliminarla deja los movimientos sin subcategoría.` : '' }]}
      validate={(v) => E.subcategorias(state, sub.area).some((s) => s !== sub.anterior && igual(s, v.nombre)) ? 'Ya existe esa subcategoría.' : ''}
      onClose={() => setSub(null)} onSave={(v) => { A.transformar((s) => E.guardarSubcategoria(s, sub.area, sub.anterior, v.nombre)); setSub(null); }}
      onDelete={sub?.anterior ? () => { A.transformar((s) => E.guardarSubcategoria(s, sub.area, sub.anterior, '')); setSub(null); } : null} />
  </div>;
}
