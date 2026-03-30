import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { Modal } from '../components/shared';
import { useToast } from '../components/toast';

interface CirugiaItem { producto_nombre: string; cantidad: string; unidad: string; observaciones: string; }
interface Cirugia {
  id: string; paciente_id?: string; veterinario_id?: string; tipo: string;
  fecha: string; hora_inicio?: string; hora_fin?: string; estado: string;
  costo: number; notas_preop?: string; notas_postop?: string;
  pacientes?: { nombre: string; especie: string; raza?: string };
  usuarios?: { nombre: string };
  cirugia_medicamentos?: CirugiaItem[];
}

const ESTADO_CIR: Record<string, { label: string; color: string }> = {
  programada: { label: 'Programada', color: '#7c3aed' },
  en_curso:   { label: 'En curso',   color: '#d97706' },
  finalizada: { label: 'Finalizada', color: '#15803d' },
  cancelada:  { label: 'Cancelada',  color: '#dc2626' },
};

const TIPOS_CIRUGIA = [
  'Castración macho', 'Castración hembra (OVH)', 'Cesárea',
  'Ortopédica', 'Oftalmológica', 'Digestiva / laparotomía',
  'Tumor / masa', 'Dental', 'Traumatológica', 'Otra',
];

const fmtFecha = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora  = (h?: string) => h ? h.slice(0, 5) : '—';
const fmtPeso  = (n: number) => `$${n.toLocaleString('es-AR')}`;
const itemVacio = (): CirugiaItem => ({ producto_nombre: '', cantidad: '', unidad: 'ml', observaciones: '' });

// ── FORM CIRUGÍA ───────────────────────────────────────────────────────────────
const FormCirugia = ({ clinicaId, usuario, cirugia, onSave, onClose, tema }: {
  clinicaId: string; usuario: Usuario; cirugia?: Cirugia;
  onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const esEdicion = !!cirugia;
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [vets, setVets] = useState<any[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [form, setForm] = useState({
    paciente_id:    cirugia?.paciente_id    || '',
    veterinario_id: cirugia?.veterinario_id || usuario.id,
    tipo:           cirugia?.tipo           || TIPOS_CIRUGIA[0],
    tipoCustom:     '',
    fecha:          cirugia?.fecha          || new Date().toISOString().split('T')[0],
    hora_inicio:    cirugia?.hora_inicio    || '',
    hora_fin:       cirugia?.hora_fin       || '',
    estado:         cirugia?.estado         || 'programada',
    costo:          cirugia?.costo?.toString() || '0',
    notas_preop:    cirugia?.notas_preop    || '',
    notas_postop:   cirugia?.notas_postop   || '',
  });
  const [items, setItems] = useState<CirugiaItem[]>(
    cirugia?.cirugia_medicamentos?.length ? cirugia.cirugia_medicamentos : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busqMed, setBusqMed] = useState('');
  const [mostrarSugMed, setMostrarSugMed] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('pacientes').select('id,nombre,especie,raza').eq('clinica_id', clinicaId).order('nombre'),
      supabase.from('usuarios').select('id,nombre,rol').eq('clinica_id', clinicaId),
      supabase.from('productos').select('id,nombre,stock_actual,unidad').eq('clinica_id', clinicaId).eq('activo', true).order('nombre'),
    ]).then(([p, v, prod]) => {
      setPacientes(p.data || []);
      setVets(v.data || []);
      setCatalogo(prod.data || []);
    });
  }, [clinicaId]);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const setItem = (i: number, k: keyof CirugiaItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const agregarMed = (nombre: string) => {
    setItems(prev => [...prev, { ...itemVacio(), producto_nombre: nombre }]);
    setBusqMed(''); setMostrarSugMed(false);
  };

  const guardar = async () => {
    if (!form.paciente_id) { setError('Seleccioná un paciente.'); return; }
    if (!form.tipo) { setError('Seleccioná un tipo de cirugía.'); return; }
    setSaving(true); setError('');
    const tipoFinal = form.tipo === 'Otra' && form.tipoCustom ? form.tipoCustom : form.tipo;
    const payload = {
      clinica_id: clinicaId, paciente_id: form.paciente_id,
      veterinario_id: form.veterinario_id || null,
      tipo: tipoFinal, fecha: form.fecha,
      hora_inicio: form.hora_inicio || null, hora_fin: form.hora_fin || null,
      estado: form.estado, costo: parseFloat(form.costo) || 0,
      notas_preop: form.notas_preop || null, notas_postop: form.notas_postop || null,
    };
    let cirId = cirugia?.id;
    if (esEdicion) {
      const { error: e } = await supabase.from('cirugias').update(payload).eq('id', cirId!);
      if (e) { setError(e.message); setSaving(false); return; }
      await supabase.from('cirugia_medicamentos').delete().eq('cirugia_id', cirId!);
    } else {
      const { data, error: e } = await supabase.from('cirugias').insert(payload).select().single();
      if (e || !data) { setError(e?.message || 'Error'); setSaving(false); return; }
      cirId = data.id;
    }
    const medsPayload = items.filter(it => it.producto_nombre.trim()).map(it => ({
      cirugia_id: cirId!, producto_nombre: it.producto_nombre,
      cantidad: it.cantidad ? parseFloat(it.cantidad) : null,
      unidad: it.unidad || null, observaciones: it.observaciones || null,
    }));
    if (medsPayload.length > 0) await supabase.from('cirugia_medicamentos').insert(medsPayload);
    onSave(); onClose();
  };

  const sugMeds = catalogo.filter(p =>
    p.nombre.toLowerCase().includes(busqMed.toLowerCase()) && busqMed.length > 0
  ).slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Paciente *</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.paciente_id} onChange={e => set('paciente_id', e.target.value)}>
            <option value="">-- Seleccionar paciente --</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.especie}{p.raza ? ` · ${p.raza}` : ''})</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Tipo de cirugía *</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS_CIRUGIA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {form.tipo === 'Otra' && (
          <div>
            <label style={S.label}>Especificar tipo</label>
            <input style={S.input} value={form.tipoCustom} onChange={e => set('tipoCustom', e.target.value)} placeholder="Describí la cirugía..." />
          </div>
        )}
        <div>
          <label style={S.label}>Veterinario</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.veterinario_id} onChange={e => set('veterinario_id', e.target.value)}>
            <option value="">-- Sin asignar --</option>
            {vets.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Estado</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.estado} onChange={e => set('estado', e.target.value)}>
            {Object.entries(ESTADO_CIR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Fecha</label>
          <input type="date" style={{ ...S.input, colorScheme: 'dark' }} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Costo ($)</label>
          <input type="number" min="0" style={S.input} value={form.costo} onChange={e => set('costo', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Hora inicio</label>
          <input type="time" style={{ ...S.input, colorScheme: 'dark' }} value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Hora fin</label>
          <input type="time" style={{ ...S.input, colorScheme: 'dark' }} value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Notas preoperatorias</label>
          <textarea rows={2} style={{ ...S.input, resize: 'vertical' }} value={form.notas_preop} onChange={e => set('notas_preop', e.target.value)} placeholder="Ayuno, medicación previa, estado del paciente..." />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Notas postoperatorias</label>
          <textarea rows={2} style={{ ...S.input, resize: 'vertical' }} value={form.notas_postop} onChange={e => set('notas_postop', e.target.value)} placeholder="Evolución, indicaciones al alta, seguimiento..." />
        </div>
      </div>

      {/* Medicamentos usados */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ ...S.label, margin: 0 }}>Medicamentos / insumos usados</label>
        </div>
        {/* Buscador del catálogo */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input type="text" placeholder="Buscar en stock o escribir nombre libre..." value={busqMed}
            onChange={e => { setBusqMed(e.target.value); setMostrarSugMed(true); }}
            onFocus={() => setMostrarSugMed(true)}
            onBlur={() => setTimeout(() => setMostrarSugMed(false), 150)}
            style={{ ...S.input, padding: '10px' }} />
          {mostrarSugMed && busqMed.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: tema.bgCard, border: `1px solid #22c55e`, borderRadius: '8px', marginTop: '4px', maxHeight: '180px', overflowY: 'auto' }}>
              {sugMeds.map(p => (
                <div key={p.id} onMouseDown={() => agregarMed(p.nombre)}
                  style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ color: tema.text, fontSize: '13px' }}>{p.nombre}</span>
                  <span style={{ color: tema.textMuted, fontSize: '12px' }}>{p.stock_actual} {p.unidad}</span>
                </div>
              ))}
              {sugMeds.length === 0 && (
                <div onMouseDown={() => agregarMed(busqMed)}
                  style={{ padding: '9px 14px', cursor: 'pointer', color: '#22c55e', fontSize: '13px' }}>
                  ➕ Agregar "{busqMed}" manualmente
                </div>
              )}
            </div>
          )}
        </div>
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((it, i) => (
              <div key={i} style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px', border: `1px solid ${tema.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', color: tema.text, fontSize: '13px' }}>{it.producto_nombre}</span>
                  <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
                  <div><label style={S.label}>Cantidad</label><input type="number" min="0" step="0.1" style={S.input} value={it.cantidad} onChange={e => setItem(i, 'cantidad', e.target.value)} /></div>
                  <div><label style={S.label}>Unidad</label><input style={S.input} value={it.unidad} onChange={e => setItem(i, 'unidad', e.target.value)} placeholder="ml, comp..." /></div>
                  <div><label style={S.label}>Observaciones</label><input style={S.input} value={it.observaciones} onChange={e => setItem(i, 'observaciones', e.target.value)} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : esEdicion ? '💾 GUARDAR CAMBIOS' : '🔪 REGISTRAR CIRUGÍA'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── SECCIÓN CIRUGÍAS ───────────────────────────────────────────────────────────
const SeccionCirugias = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [cirugias, setCirugias] = useState<Cirugia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalNueva, setModalNueva] = useState(false);
  const [cirugiaEditar, setCirugiaEditar] = useState<Cirugia | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('cirugias')
      .select('*, pacientes(nombre,especie,raza), usuarios(nombre), cirugia_medicamentos(*)')
      .eq('clinica_id', usuario.clinica_id)
      .order('fecha', { ascending: false });
    setCirugias((data || []) as Cirugia[]);
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (id: string, estado: string) => {
    const { error } = await supabase.from('cirugias').update({ estado }).eq('id', id);
    if (error) { toast('Error al cambiar estado', 'error'); return; }
    toast('Estado actualizado', 'success');
    cargar();
  };

  const filtradas = cirugias.filter(c => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || (c.pacientes?.nombre || '').toLowerCase().includes(q) || c.tipo.toLowerCase().includes(q);
    const matchE = filtroEstado === 'todos' || c.estado === filtroEstado;
    return matchQ && matchE;
  });

  const kpis = {
    total:      cirugias.length,
    programadas: cirugias.filter(c => c.estado === 'programada').length,
    en_curso:   cirugias.filter(c => c.estado === 'en_curso').length,
    mes:        cirugias.filter(c => c.fecha >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]).length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '15px' }}>
        {[
          { label: 'Total', val: kpis.total, color: '#22c55e' },
          { label: 'Programadas', val: kpis.programadas, color: '#7c3aed' },
          { label: 'En curso', val: kpis.en_curso, color: '#d97706' },
          { label: 'Este mes', val: kpis.mes, color: '#0891b2' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, borderColor: color + '55', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barra */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Buscar por paciente o tipo..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, flex: 1, minWidth: '200px', padding: '12px' }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          style={{ ...S.input, width: 'auto', cursor: 'pointer', padding: '12px' }}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_CIR).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setModalNueva(true)} style={{ ...S.btnPrimary, whiteSpace: 'nowrap' }}>🔪 Nueva cirugía</button>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Fecha', 'Paciente', 'Tipo', 'Veterinario', 'Duración', 'Costo', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>No se encontraron cirugías.</td></tr>
              )}
              {filtradas.map(c => {
                const est = ESTADO_CIR[c.estado] || { label: c.estado, color: '#475569' };
                const durMin = c.hora_inicio && c.hora_fin
                  ? Math.round((new Date(`2000-01-01T${c.hora_fin}`) .getTime() - new Date(`2000-01-01T${c.hora_inicio}`).getTime()) / 60000)
                  : null;
                return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted }}>{fmtFecha(c.fecha)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{c.pacientes?.nombre || '—'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: tema.textMuted }}>{c.pacientes?.especie}{c.pacientes?.raza ? ` · ${c.pacientes.raza}` : ''}</p>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.text }}>{c.tipo}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted }}>{c.usuarios?.nombre || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: tema.textMuted }}>
                      {durMin !== null ? `${durMin} min` : fmtHora(c.hora_inicio) !== '—' ? `${fmtHora(c.hora_inicio)} hs` : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#22c55e' }}>{fmtPeso(c.costo)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', background: est.color, padding: '3px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>{est.label}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {c.estado === 'programada' && <button onClick={() => cambiarEstado(c.id, 'en_curso')} style={{ padding: '4px 10px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>▶ Iniciar</button>}
                        {c.estado === 'en_curso'   && <button onClick={() => cambiarEstado(c.id, 'finalizada')} style={{ padding: '4px 10px', background: '#15803d', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Finalizar</button>}
                        <button onClick={() => setCirugiaEditar(c)} style={{ padding: '4px 10px', background: 'transparent', color: '#6daa7f', border: `1px solid ${tema.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                        {c.estado !== 'cancelada' && c.estado !== 'finalizada' && (
                          <button onClick={() => cambiarEstado(c.id, 'cancelada')} style={{ padding: '4px 10px', background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalNueva && (
        <Modal titulo="🔪 Nueva Cirugía" onClose={() => setModalNueva(false)} tema={tema}>
          <FormCirugia clinicaId={usuario.clinica_id} usuario={usuario}
            onSave={cargar} onClose={() => setModalNueva(false)} tema={tema} />
        </Modal>
      )}
      {cirugiaEditar && (
        <Modal titulo={`✏️ Editar — ${cirugiaEditar.tipo}`} onClose={() => setCirugiaEditar(null)} tema={tema}>
          <FormCirugia clinicaId={usuario.clinica_id} usuario={usuario} cirugia={cirugiaEditar}
            onSave={cargar} onClose={() => setCirugiaEditar(null)} tema={tema} />
        </Modal>
      )}
    </div>
  );
};

export default SeccionCirugias;
