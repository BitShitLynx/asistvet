import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';

interface Cobro {
  id: string; turno_id?: string; paciente_id?: string; tipo_consulta_id?: string;
  monto: number; medio_pago: string; estado_pago: string; monto_pagado: number;
  numero_recibo?: string; notas?: string; fecha_cobro: string;
  pacientes?: { nombre: string; especie: string };
  tipos_consulta?: { nombre: string };
}

const fmtPeso = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const SeccionFacturacion = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
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
  const totalEfectivo  = filtrados.filter(c => c.medio_pago === 'efectivo').reduce((a, c) => a + c.monto_pagado, 0);
  const totalTransf    = filtrados.filter(c => c.medio_pago === 'transferencia').reduce((a, c) => a + c.monto_pagado, 0);

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
              <tr>{['Recibo', 'Fecha', 'Paciente', 'Tipo', 'Monto', 'Cobrado', 'Medio', 'Estado'].map(h =>
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>Sin cobros en el período seleccionado.</td></tr>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Resumen del período */}
      <div style={{ ...S.card, border: '1px solid #334155' }}>
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
    </div>
  );
};

export default SeccionFacturacion;
