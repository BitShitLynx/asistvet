import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';
import { Modal } from '../components/shared';

interface Cobro {
  id: string; turno_id?: string; paciente_id?: string; tipo_consulta_id?: string;
  monto: number; medio_pago: string; estado_pago: string; monto_pagado: number;
  numero_recibo?: string; notas?: string; fecha_cobro: string;
  pacientes?: { nombre: string; especie: string };
  tipos_consulta?: { nombre: string };
}

const fmtPeso = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const MEDIOS_PAGO = ['efectivo', 'transferencia'];

const SeccionFacturacion = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroMedio, setFiltroMedio] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);

  const [cobroEditar, setCobroEditar] = useState<Cobro | null>(null);
  const [cobroEliminar, setCobroEliminar] = useState<Cobro | null>(null);
  const [formEdit, setFormEdit] = useState({ monto_pagado: '', medio_pago: 'efectivo', estado_pago: 'pagado', notas: '' });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cobros')
      .select('*, pacientes(nombre,especie), tipos_consulta(nombre)')
      .eq('clinica_id', usuario.clinica_id)
      .gte('fecha_cobro', fechaDesde + 'T00:00:00')
      .lte('fecha_cobro', fechaHasta + 'T23:59:59')
      .order('fecha_cobro', { ascending: false });
    setCobros((data || []) as Cobro[]);
    setLoading(false);
  }, [usuario.clinica_id, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = cobros.filter(c => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || (c.pacientes?.nombre || '').toLowerCase().includes(q) || (c.numero_recibo || '').toLowerCase().includes(q);
    const matchE = filtroEstado === 'todos' || c.estado_pago === filtroEstado;
    const matchM = filtroMedio === 'todos' || c.medio_pago === filtroMedio;
    return matchQ && matchE && matchM;
  });

  const totalCobrado   = filtrados.filter(c => c.estado_pago !== 'pendiente').reduce((a, c) => a + c.monto_pagado, 0);
  const totalPendiente = filtrados.filter(c => c.estado_pago === 'pendiente' || c.estado_pago === 'parcial').reduce((a, c) => a + (c.monto - c.monto_pagado), 0);
  const totalEfectivo  = filtrados.filter(c => c.medio_pago === 'efectivo'      && c.estado_pago !== 'pendiente').reduce((a, c) => a + c.monto_pagado, 0);
  const totalTransf    = filtrados.filter(c => c.medio_pago === 'transferencia' && c.estado_pago !== 'pendiente').reduce((a, c) => a + c.monto_pagado, 0);

  const abrirEditar = (c: Cobro) => {
    setFormEdit({
      monto_pagado: String(c.monto_pagado),
      medio_pago:   c.medio_pago,
      estado_pago:  c.estado_pago,
      notas:        c.notas || '',
    });
    setCobroEditar(c);
  };

  const guardarEdicion = async () => {
    if (!cobroEditar) return;
    const montoPagado = parseFloat(formEdit.monto_pagado);
    if (isNaN(montoPagado) || montoPagado < 0) { toast('Monto inválido', 'warning'); return; }
    setSaving(true);
    const { error } = await supabase.from('cobros').update({
      monto_pagado: montoPagado,
      medio_pago:   formEdit.medio_pago,
      estado_pago:  formEdit.estado_pago,
      notas:        formEdit.notas || null,
    }).eq('id', cobroEditar.id);
    if (error) { toast('Error al guardar: ' + error.message, 'error'); setSaving(false); return; }
    toast('Cobro actualizado', 'success');
    setCobroEditar(null);
    setSaving(false);
    cargar();
  };

  const marcarPagado = async (c: Cobro) => {
    const { error } = await supabase.from('cobros').update({
      monto_pagado: c.monto,
      estado_pago: 'pagado',
    }).eq('id', c.id);
    if (error) { toast('Error al actualizar', 'error'); return; }
    toast('Cobro marcado como pagado', 'success');
    cargar();
  };

  const eliminarCobro = async () => {
    if (!cobroEliminar) return;
    setSaving(true);
    const { error } = await supabase.from('cobros').delete().eq('id', cobroEliminar.id);
    if (error) { toast('Error al eliminar: ' + error.message, 'error'); setSaving(false); return; }
    toast('Cobro eliminado', 'success');
    setCobroEliminar(null);
    setSaving(false);
    cargar();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '15px' }}>
        {[
          { label: 'Total cobrado', val: fmtPeso(totalCobrado), color: '#059669' },
          { label: 'Pendiente / parcial', val: fmtPeso(totalPendiente), color: '#d97706' },
          { label: 'Efectivo', val: fmtPeso(totalEfectivo), color: '#3b82f6' },
          { label: 'Transferencia', val: fmtPeso(totalTransf), color: '#7c3aed' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, borderColor: color + '55', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...S.input, width: '150px', colorScheme: 'dark' }} type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        <span style={{ color: tema.textMuted, fontSize: '13px' }}>→</span>
        <input style={{ ...S.input, width: '150px', colorScheme: 'dark' }} type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        <input style={{ ...S.input, flex: 1, minWidth: '180px' }} placeholder="Buscar por paciente o N° recibo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select style={{ ...S.input, width: 'auto', cursor: 'pointer' }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="pagado">Pagado</option>
          <option value="parcial">Parcial</option>
          <option value="pendiente">Pendiente</option>
        </select>
        <select style={{ ...S.input, width: 'auto', cursor: 'pointer' }} value={filtroMedio} onChange={e => setFiltroMedio(e.target.value)}>
          <option value="todos">Todos los medios</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, color: tema.text }}>🧾 Cobros — {filtrados.length} registros</h4>
        </div>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Recibo', 'Fecha', 'Paciente', 'Tipo', 'Monto', 'Cobrado', 'Medio', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>Sin cobros en el período seleccionado.</td></tr>
              )}
              {filtrados.map(c => {
                const estadoColor = c.estado_pago === 'pagado' ? '#059669' : c.estado_pago === 'parcial' ? '#d97706' : '#dc2626';
                const estadoLabel = c.estado_pago === 'pagado' ? 'Pagado' : c.estado_pago === 'parcial' ? 'Parcial' : 'Pendiente';
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: '#34d399', fontWeight: 'bold' }}>{c.numero_recibo || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted }}>{fmtFecha(c.fecha_cobro)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: tema.text, fontSize: '13px' }}>{c.pacientes?.nombre || '—'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: tema.textMuted }}>{c.pacientes?.especie}</p>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted }}>{c.tipos_consulta?.nombre || '—'}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: tema.text }}>{fmtPeso(c.monto)}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#34d399' }}>{fmtPeso(c.monto_pagado)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', background: c.medio_pago === 'efectivo' ? '#1e3a5f' : '#2e1065', padding: '2px 8px', borderRadius: '99px', color: c.medio_pago === 'efectivo' ? '#93c5fd' : '#c4b5fd' }}>
                        {c.medio_pago === 'efectivo' ? '💵 Efectivo' : '📱 Transf.'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', background: estadoColor, padding: '3px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>{estadoLabel}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {(c.estado_pago === 'pendiente' || c.estado_pago === 'parcial') && (
                          <button onClick={() => marcarPagado(c)}
                            style={{ fontSize: '11px', padding: '3px 8px', background: '#052e16', color: '#4ade80', border: '1px solid #16a34a', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            ✓ Pagado
                          </button>
                        )}
                        <button onClick={() => abrirEditar(c)}
                          style={{ fontSize: '11px', padding: '3px 8px', background: 'transparent', color: tema.accent, border: `1px solid ${tema.border}`, borderRadius: '5px', cursor: 'pointer' }}>
                          ✏️
                        </button>
                        <button onClick={() => setCobroEliminar(c)}
                          style={{ fontSize: '11px', padding: '3px 8px', background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '5px', cursor: 'pointer' }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Resumen del período */}
      <div style={{ ...S.card, border: `1px solid ${tema.border}` }}>
        <h4 style={{ margin: '0 0 14px', color: tema.text }}>📊 Resumen del período</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          <div style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>CONSULTAS COBRADAS</p>
            <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 'bold', color: tema.text }}>{filtrados.filter(c => c.estado_pago === 'pagado').length}</p>
          </div>
          <div style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>TICKET PROMEDIO</p>
            <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 'bold', color: tema.text }}>
              {filtrados.length > 0 ? fmtPeso(Math.round(totalCobrado / filtrados.length)) : '$0'}
            </p>
          </div>
          <div style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>DEUDA PENDIENTE</p>
            <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 'bold', color: totalPendiente > 0 ? '#d97706' : '#059669' }}>{fmtPeso(totalPendiente)}</p>
          </div>
        </div>
      </div>

      {/* Modal editar cobro */}
      {cobroEditar && (
        <Modal titulo="Editar cobro" onClose={() => setCobroEditar(null)} tema={tema}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: tema.bgInput, padding: '10px 14px', borderRadius: '8px', fontSize: '13px', color: tema.textMuted }}>
              <strong style={{ color: tema.text }}>{cobroEditar.pacientes?.nombre}</strong>
              {cobroEditar.numero_recibo && <span> — Recibo {cobroEditar.numero_recibo}</span>}
              <span> — Total: <strong style={{ color: tema.text }}>{fmtPeso(cobroEditar.monto)}</strong></span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={S.label}>Monto cobrado ($)</label>
                <input type="number" min="0" step="0.01" style={S.input}
                  value={formEdit.monto_pagado}
                  onChange={e => setFormEdit(p => ({ ...p, monto_pagado: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Medio de pago</label>
                <select style={{ ...S.input, cursor: 'pointer' }}
                  value={formEdit.medio_pago}
                  onChange={e => setFormEdit(p => ({ ...p, medio_pago: e.target.value }))}>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Estado</label>
                <select style={{ ...S.input, cursor: 'pointer' }}
                  value={formEdit.estado_pago}
                  onChange={e => setFormEdit(p => ({ ...p, estado_pago: e.target.value }))}>
                  <option value="pagado">Pagado</option>
                  <option value="parcial">Parcial</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Notas</label>
                <input style={S.input} value={formEdit.notas}
                  onChange={e => setFormEdit(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Observaciones del cobro..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={guardarEdicion} disabled={saving}
                style={{ ...S.btnPrimary, flex: 1, padding: '12px', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button onClick={() => setCobroEditar(null)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmar eliminación */}
      {cobroEliminar && (
        <Modal titulo="Eliminar cobro" onClose={() => setCobroEliminar(null)} tema={tema}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, color: tema.text, fontSize: '14px' }}>
              ¿Eliminás el cobro de <strong>{fmtPeso(cobroEliminar.monto)}</strong> de{' '}
              <strong>{cobroEliminar.pacientes?.nombre || 'este paciente'}</strong>?
              {cobroEliminar.numero_recibo && <span> (Recibo {cobroEliminar.numero_recibo})</span>}
            </p>
            <p style={{ margin: 0, color: '#f87171', fontSize: '13px' }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={eliminarCobro} disabled={saving}
                style={{ ...S.btnPrimary, flex: 1, padding: '12px', background: '#dc2626', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button onClick={() => setCobroEliminar(null)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SeccionFacturacion;
