import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { Modal } from '../components/shared';
import { useToast, ConfirmModal } from '../components/toast';

interface Gasto {
  id: string; categoria: string; descripcion: string; monto: number;
  medio_pago: string; fecha: string; comprobante?: string;
  usuarios?: { nombre: string };
}

const CATEGORIAS: Record<string, { label: string; color: string; icon: string }> = {
  insumos:   { label: 'Insumos / Stock',     color: '#15803d', icon: '📦' },
  servicios: { label: 'Servicios',            color: '#0891b2', icon: '🔌' },
  sueldos:   { label: 'Sueldos',             color: '#7c3aed', icon: '👥' },
  otros:     { label: 'Otros gastos',         color: '#d97706', icon: '📋' },
};

const fmtFecha = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtPeso  = (n: number) => `$${n.toLocaleString('es-AR')}`;
const hoy = () => new Date().toISOString().split('T')[0];

// ── FORM GASTO ─────────────────────────────────────────────────────────────────
const FormGasto = ({ clinicaId, usuarioId, gasto, onSave, onClose, tema }: {
  clinicaId: string; usuarioId: string; gasto?: Gasto;
  onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const esEdicion = !!gasto;
  const [form, setForm] = useState({
    categoria:   gasto?.categoria   || 'insumos',
    descripcion: gasto?.descripcion || '',
    monto:       gasto?.monto?.toString() || '',
    medio_pago:  gasto?.medio_pago  || 'efectivo',
    fecha:       gasto?.fecha       || hoy(),
    comprobante: gasto?.comprobante || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.descripcion.trim()) { setError('Ingresá una descripción.'); return; }
    if (!form.monto || parseFloat(form.monto) <= 0) { setError('Ingresá un monto válido.'); return; }
    setSaving(true); setError('');
    const payload = {
      clinica_id: clinicaId, usuario_id: usuarioId,
      categoria: form.categoria, descripcion: form.descripcion.trim(),
      monto: parseFloat(form.monto), medio_pago: form.medio_pago,
      fecha: form.fecha, comprobante: form.comprobante || null,
    };
    const { error: dbErr } = esEdicion
      ? await supabase.from('gastos').update(payload).eq('id', gasto!.id)
      : await supabase.from('gastos').insert(payload);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    toast(esEdicion ? 'Gasto actualizado' : 'Gasto registrado', 'success');
    onSave(); onClose();
  };

  return (
    <div>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171', marginBottom: '15px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={S.label}>Categoría</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {Object.entries(CATEGORIAS).map(([k, v]) => (
              <button key={k} onClick={() => set('categoria', k)}
                style={{ padding: '10px 8px', border: `1px solid ${form.categoria === k ? v.color : tema.border}`, borderRadius: '8px', cursor: 'pointer', background: form.categoria === k ? v.color + '22' : 'transparent', color: form.categoria === k ? v.color : tema.textMuted, fontWeight: 'bold', fontSize: '12px', textAlign: 'center' }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={S.label}>Monto ($) *</label>
            <input type="number" min="0" step="0.01" style={{ ...S.input, fontSize: '20px', fontWeight: 'bold' }}
              value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={S.label}>Medio de pago</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => set('medio_pago', 'efectivo')}
                style={{ ...(form.medio_pago === 'efectivo' ? S.btnPrimary : S.btnGhost), flex: 1, fontSize: '13px' }}>💵 Efectivo</button>
              <button onClick={() => set('medio_pago', 'transferencia')}
                style={{ ...(form.medio_pago === 'transferencia' ? S.btnPrimary : S.btnGhost), flex: 1, fontSize: '13px' }}>📱 Transferencia</button>
            </div>
          </div>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Descripción *</label>
          <input style={S.input} value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
            placeholder="Ej: Compra de jeringas descartables, factura de luz de marzo..." />
        </div>
        <div>
          <label style={S.label}>Fecha</label>
          <input type="date" style={{ ...S.input, colorScheme: 'dark' }} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>N° comprobante / factura</label>
          <input style={S.input} value={form.comprobante} onChange={e => set('comprobante', e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : esEdicion ? '💾 GUARDAR CAMBIOS' : '➕ REGISTRAR GASTO'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── SECCIÓN GASTOS ─────────────────────────────────────────────────────────────
const SeccionGastos = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [gastoEditar, setGastoEditar] = useState<Gasto | null>(null);
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroMedio, setFiltroMedio] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(hoy);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('gastos').select('*, usuarios(nombre)')
      .eq('clinica_id', usuario.clinica_id)
      .gte('fecha', fechaDesde).lte('fecha', fechaHasta)
      .order('fecha', { ascending: false });
    setGastos((data || []) as Gasto[]);
    setLoading(false);
  }, [usuario.clinica_id, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (id: string) => {
    const { error } = await supabase.from('gastos').delete().eq('id', id);
    if (error) { toast('Error al eliminar el gasto', 'error'); return; }
    toast('Gasto eliminado', 'success');
    setGastoAEliminar(null);
    cargar();
  };

  const filtrados = gastos.filter(g => {
    const q = busqueda.toLowerCase();
    return (!q || g.descripcion.toLowerCase().includes(q) || (g.comprobante || '').toLowerCase().includes(q))
      && (filtroCategoria === 'todos' || g.categoria === filtroCategoria)
      && (filtroMedio === 'todos' || g.medio_pago === filtroMedio);
  });

  const totalGeneral  = filtrados.reduce((a, g) => a + g.monto, 0);
  const porCategoria  = Object.keys(CATEGORIAS).map(k => ({
    key: k, ...CATEGORIAS[k],
    total: filtrados.filter(g => g.categoria === k).reduce((a, g) => a + g.monto, 0),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPIs por categoría */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {porCategoria.map(c => (
          <div key={c.key} onClick={() => setFiltroCategoria(filtroCategoria === c.key ? 'todos' : c.key)}
            style={{ ...S.card, borderColor: filtroCategoria === c.key ? c.color : c.color + '44', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}>
            <p style={{ margin: 0, fontSize: '18px' }}>{c.icon}</p>
            <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 'bold', color: c.color }}>{fmtPeso(c.total)}</p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: tema.textMuted }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ ...S.card, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: tema.textMuted, fontSize: '14px' }}>Total gastos del período</span>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f87171' }}>{fmtPeso(totalGeneral)}</span>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...S.input, width: '145px', colorScheme: 'dark' }} type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        <span style={{ color: tema.textMuted, fontSize: '13px' }}>→</span>
        <input style={{ ...S.input, width: '145px', colorScheme: 'dark' }} type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        <input style={{ ...S.input, flex: 1, minWidth: '160px' }} placeholder="Buscar descripción o comprobante..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select style={{ ...S.input, width: 'auto', cursor: 'pointer' }} value={filtroMedio} onChange={e => setFiltroMedio(e.target.value)}>
          <option value="todos">Todos los medios</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
        <button onClick={() => setModalNuevo(true)} style={{ ...S.btnPrimary, whiteSpace: 'nowrap' }}>➕ Nuevo gasto</button>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Fecha', 'Categoría', 'Descripción', 'Comprobante', 'Medio', 'Monto', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>Sin gastos en el período seleccionado.</td></tr>
              )}
              {filtrados.map(g => {
                const cat = CATEGORIAS[g.categoria] || { label: g.categoria, color: '#475569', icon: '📋' };
                return (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted, whiteSpace: 'nowrap' }}>{fmtFecha(g.fecha)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', background: cat.color + '22', color: cat.color, border: `1px solid ${cat.color}44`, padding: '3px 10px', borderRadius: '99px', fontWeight: 'bold' }}>
                        {cat.icon} {cat.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.text }}>{g.descripcion}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted }}>{g.comprobante || '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', background: g.medio_pago === 'efectivo' ? 'rgba(21,128,61,0.15)' : 'rgba(8,145,178,0.15)', color: g.medio_pago === 'efectivo' ? '#22c55e' : '#38bdf8', padding: '2px 8px', borderRadius: '99px' }}>
                        {g.medio_pago === 'efectivo' ? '💵' : '📱'} {g.medio_pago === 'efectivo' ? 'Efectivo' : 'Transf.'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#f87171' }}>{fmtPeso(g.monto)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setGastoEditar(g)}
                          style={{ padding: '4px 10px', background: 'transparent', color: '#6daa7f', border: `1px solid ${tema.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        <button onClick={() => setGastoAEliminar(g)}
                          style={{ padding: '4px 10px', background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalNuevo && (
        <Modal titulo="➕ Nuevo Gasto" onClose={() => setModalNuevo(false)} tema={tema}>
          <FormGasto clinicaId={usuario.clinica_id} usuarioId={usuario.id}
            onSave={cargar} onClose={() => setModalNuevo(false)} tema={tema} />
        </Modal>
      )}
      {gastoEditar && (
        <Modal titulo="✏️ Editar Gasto" onClose={() => setGastoEditar(null)} tema={tema}>
          <FormGasto clinicaId={usuario.clinica_id} usuarioId={usuario.id}
            gasto={gastoEditar} onSave={cargar} onClose={() => setGastoEditar(null)} tema={tema} />
        </Modal>
      )}
      {gastoAEliminar && (
        <ConfirmModal
          mensaje="¿Eliminár este gasto?"
          detalle={`${gastoAEliminar.descripcion} — $${gastoAEliminar.monto.toLocaleString('es-AR')}`}
          labelConfirmar="Eliminar"
          peligroso
          onConfirmar={() => eliminar(gastoAEliminar.id)}
          onCancelar={() => setGastoAEliminar(null)}
        />
      )}
    </div>
  );
};

export default SeccionGastos;
