import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { Modal } from '../components/shared';
import { useToast } from '../components/toast';

interface TipoConsulta { id: string; nombre: string; precio: number; activo: boolean; }
interface Turno {
  id: string; clinica_id: string; paciente_id?: string; tipo_consulta_id?: string;
  veterinario_id?: string; fecha: string; hora?: string; es_guardia: boolean;
  motivo?: string; estado: string; observaciones?: string;
  pacientes?: { nombre: string; especie: string; raza?: string };
  tipos_consulta?: { nombre: string; precio: number };
  usuarios?: { nombre: string };
}

const ESTADO_TURNO: Record<string, { label: string; color: string }> = {
  pendiente:   { label: 'Pendiente',   color: '#7c3aed' },
  confirmado:  { label: 'Confirmado',  color: '#2563eb' },
  en_curso:    { label: 'En curso',    color: '#d97706' },
  finalizado:  { label: 'Finalizado',  color: '#059669' },
  cancelado:   { label: 'Cancelado',   color: '#dc2626' },
};

const hoy = () => new Date().toISOString().split('T')[0];
const fmtHora = (h?: string) => h ? h.slice(0, 5) : '—';
const fmtFecha = (f: string) => new Date(f + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });

const SeccionTurnos = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [tipos, setTipos] = useState<TipoConsulta[]>([]);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [vets, setVets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaSel, setFechaSel] = useState(hoy());
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalPrecio, setModalPrecio] = useState(false);
  const [turnoAccion, setTurnoAccion] = useState<Turno | null>(null);
  const [modalCobro, setModalCobro] = useState(false);

  const esAdmin = usuario.rol === 'admin';

  const cargar = useCallback(async () => {
    setLoading(true);
    const [t, tc, p, v] = await Promise.all([
      supabase.from('turnos').select('*, pacientes(nombre,especie,raza), tipos_consulta(nombre,precio), usuarios(nombre)')
        .eq('clinica_id', usuario.clinica_id).eq('fecha', fechaSel).order('hora', { ascending: true, nullsFirst: false }),
      supabase.from('tipos_consulta').select('*').eq('clinica_id', usuario.clinica_id).eq('activo', true).order('nombre'),
      supabase.from('pacientes').select('id,nombre,especie,raza').eq('clinica_id', usuario.clinica_id).order('nombre'),
      supabase.from('usuarios').select('id,nombre,rol').eq('clinica_id', usuario.clinica_id),
    ]);
    setTurnos((t.data || []) as Turno[]);
    setTipos(tc.data || []);
    setPacientes(p.data || []);
    setVets(v.data || []);
    setLoading(false);
  }, [usuario.clinica_id, fechaSel]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (turno: Turno, nuevoEstado: string) => {
    const { error } = await supabase.from('turnos').update({ estado: nuevoEstado }).eq('id', turno.id);
    if (error) { toast('Error al cambiar estado del turno', 'error'); return; }
    if (nuevoEstado === 'finalizado') {
      setTurnoAccion(turno); setModalCobro(true);
    }
    cargar();
  };

  const kpis = {
    total: turnos.length,
    pendientes: turnos.filter(t => t.estado === 'pendiente' || t.estado === 'confirmado').length,
    en_curso: turnos.filter(t => t.estado === 'en_curso').length,
    guardias: turnos.filter(t => t.es_guardia).length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '15px' }}>
        {[
          { label: 'Turnos del día', val: kpis.total, color: '#3b82f6' },
          { label: 'Pendientes', val: kpis.pendientes, color: '#7c3aed' },
          { label: 'En curso', val: kpis.en_curso, color: '#d97706' },
          { label: 'Guardias', val: kpis.guardias, color: '#059669' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, borderColor: color + '55', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barra de controles */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" value={fechaSel} onChange={e => setFechaSel(e.target.value)}
          style={{ ...S.input, width: 'auto', padding: '10px 14px', colorScheme: 'dark' }} />
        <button onClick={() => setFechaSel(hoy())} style={{ ...S.btnGhost, padding: '10px 16px', fontSize: '13px' }}>Hoy</button>
        <button onClick={() => { setTurnoAccion(null); setModalNuevo(true); }}
          style={{ ...S.btnPrimary, whiteSpace: 'nowrap' }}>+ Nuevo turno</button>
        <button onClick={() => { setTurnoAccion(null); setModalNuevo(true); }}
          style={{ ...S.btnGhost, whiteSpace: 'nowrap' }}>🚨 Guardia sin turno</button>
        {esAdmin && (
          <button onClick={() => setModalPrecio(true)}
            style={{ ...S.btnGhost, marginLeft: 'auto', fontSize: '13px' }}>⚙️ Precios</button>
        )}
      </div>

      {/* Tabla de turnos */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tema.border}` }}>
          <h4 style={{ margin: 0, color: tema.text }}>📅 {fmtFecha(fechaSel)} — {turnos.length} turnos</h4>
        </div>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Hora', 'Paciente', 'Tipo', 'Veterinario', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 15px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {turnos.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>
                  No hay turnos para este día.
                </td></tr>
              )}
              {turnos.map(t => {
                const est = ESTADO_TURNO[t.estado] || { label: t.estado, color: '#475569' };
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 15px', color: tema.text, fontWeight: 'bold', fontSize: '15px' }}>
                      {t.es_guardia ? <span style={{ fontSize: '11px', background: '#d97706', padding: '2px 8px', borderRadius: '99px', color: 'white' }}>GUARDIA</span> : fmtHora(t.hora)}
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{t.pacientes?.nombre || '—'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: tema.textMuted }}>{t.pacientes?.especie}{t.pacientes?.raza ? ` · ${t.pacientes.raza}` : ''}</p>
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <p style={{ margin: 0, fontSize: '13px', color: tema.text }}>{t.tipos_consulta?.nombre || '—'}</p>
                      {t.tipos_consulta?.precio && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#34d399' }}>${t.tipos_consulta.precio.toLocaleString('es-AR')}</p>}
                    </td>
                    <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.textMuted }}>{t.usuarios?.nombre || '—'}</td>
                    <td style={{ padding: '12px 15px' }}>
                      <span style={{ fontSize: '11px', background: est.color, padding: '3px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>{est.label}</span>
                    </td>
                    <td style={{ padding: '12px 15px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {t.estado === 'pendiente' && <button onClick={() => cambiarEstado(t, 'confirmado')} style={{ padding: '4px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Confirmar</button>}
                        {t.estado === 'confirmado' && <button onClick={() => cambiarEstado(t, 'en_curso')} style={{ padding: '4px 10px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>▶ Iniciar</button>}
                        {t.estado === 'en_curso' && <button onClick={() => cambiarEstado(t, 'finalizado')} style={{ padding: '4px 10px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✓ Finalizar</button>}
                        {(t.estado === 'finalizado') && <button onClick={() => { setTurnoAccion(t); setModalCobro(true); }} style={{ padding: '4px 10px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>💰 Cobrar</button>}
                        {t.estado !== 'cancelado' && t.estado !== 'finalizado' && <button onClick={() => cambiarEstado(t, 'cancelado')} style={{ padding: '4px 10px', background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo turno */}
      {modalNuevo && (
        <Modal titulo="📅 Nuevo Turno" onClose={() => setModalNuevo(false)} tema={tema}>
          <FormTurno
            clinicaId={usuario.clinica_id} pacientes={pacientes} tipos={tipos} vets={vets}
            esGuardia={false} fechaInicial={fechaSel}
            onSave={() => { setModalNuevo(false); cargar(); }}
            onClose={() => setModalNuevo(false)} tema={tema} />
        </Modal>
      )}

      {/* Modal precios (solo admin) */}
      {modalPrecio && esAdmin && (
        <Modal titulo="⚙️ Precios de consulta" onClose={() => setModalPrecio(false)} tema={tema}>
          <FormPrecios clinicaId={usuario.clinica_id} tipos={tipos} onSave={cargar} tema={tema} />
        </Modal>
      )}

      {/* Modal cobro */}
      {modalCobro && turnoAccion && (
        <Modal titulo="💰 Registrar Cobro" onClose={() => { setModalCobro(false); setTurnoAccion(null); }} tema={tema}>
          <FormCobro
            clinicaId={usuario.clinica_id} turno={turnoAccion}
            onSave={() => { setModalCobro(false); setTurnoAccion(null); cargar(); }}
            onClose={() => { setModalCobro(false); setTurnoAccion(null); }} tema={tema} />
        </Modal>
      )}
    </div>
  );
};

// ── FORM TURNO ─────────────────────────────────────────────────────────────────
const FormTurno = ({ clinicaId, pacientes, tipos, vets, esGuardia, fechaInicial, onSave, onClose, tema }: {
  clinicaId: string; pacientes: any[]; tipos: TipoConsulta[]; vets: any[];
  esGuardia: boolean; fechaInicial: string; onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const [form, setForm] = useState({
    paciente_id: '', tipo_consulta_id: '', veterinario_id: '',
    fecha: fechaInicial, hora: '', motivo: '', es_guardia: esGuardia, observaciones: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.paciente_id) { setError('Seleccioná un paciente.'); return; }
    setSaving(true); setError('');
    const { error: dbErr } = await supabase.from('turnos').insert({
      clinica_id: clinicaId,
      paciente_id: form.paciente_id,
      tipo_consulta_id: form.tipo_consulta_id || null,
      veterinario_id: form.veterinario_id || null,
      fecha: form.fecha,
      hora: form.hora || null,
      motivo: form.motivo || null,
      es_guardia: form.es_guardia,
      observaciones: form.observaciones || null,
      estado: 'pendiente',
    });
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    onSave();
  };

  return (
    <div>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171', marginBottom: '15px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Paciente *</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.paciente_id} onChange={e => set('paciente_id', e.target.value)}>
            <option value="">-- Seleccionar paciente --</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.especie}{p.raza ? ` · ${p.raza}` : ''})</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Tipo de consulta</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.tipo_consulta_id} onChange={e => set('tipo_consulta_id', e.target.value)}>
            <option value="">-- Seleccionar --</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre} — ${t.precio.toLocaleString('es-AR')}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Veterinario</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.veterinario_id} onChange={e => set('veterinario_id', e.target.value)}>
            <option value="">-- Asignar --</option>
            {vets.map(v => <option key={v.id} value={v.id}>{v.nombre} ({v.rol})</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Fecha</label>
          <input type="date" style={{ ...S.input, colorScheme: 'dark' }} value={form.fecha} onChange={e => set('fecha', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Hora</label>
          <input type="time" style={{ ...S.input, colorScheme: 'dark' }} value={form.hora} onChange={e => set('hora', e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Tipo de ingreso</label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button onClick={() => set('es_guardia', false)} style={{ ...(!form.es_guardia ? S.btnPrimary : S.btnGhost), flex: 1, fontSize: '13px', padding: '10px' }}>📅 Turno programado</button>
            <button onClick={() => set('es_guardia', true)} style={{ ...(form.es_guardia ? { ...S.btnPrimary, background: '#d97706' } : S.btnGhost), flex: 1, fontSize: '13px', padding: '10px' }}>🚨 Guardia</button>
          </div>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Motivo de consulta</label>
          <input style={S.input} value={form.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Ej: Control anual, vómitos, revisión post-cirugía..." />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Observaciones</label>
          <textarea rows={2} style={{ ...S.input, resize: 'vertical' }} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : '✅ REGISTRAR TURNO'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── FORM COBRO ─────────────────────────────────────────────────────────────────
const FormCobro = ({ clinicaId, turno, onSave, onClose, tema }: {
  clinicaId: string; turno: Turno; onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const precioBase = turno.tipos_consulta?.precio || 0;
  const [monto, setMonto] = useState(precioBase.toString());
  const [montoPagado, setMontoPagado] = useState(precioBase.toString());
  const [medioPago, setMedioPago] = useState('efectivo');
  const [estadoPago, setEstadoPago] = useState('pagado');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const nroRecibo = `REC-${Date.now().toString().slice(-6)}`;

  const guardar = async () => {
    setSaving(true); setError('');
    const { error: dbErr } = await supabase.from('cobros').insert({
      clinica_id: clinicaId,
      turno_id: turno.id,
      paciente_id: turno.paciente_id,
      tipo_consulta_id: turno.tipo_consulta_id,
      monto: parseFloat(monto) || 0,
      medio_pago: medioPago,
      estado_pago: estadoPago,
      monto_pagado: parseFloat(montoPagado) || 0,
      numero_recibo: nroRecibo,
      notas: notas || null,
    });
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    onSave();
  };

  return (
    <div>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171', marginBottom: '15px' }}>{error}</div>}
      <div style={{ background: tema.bgInput, borderRadius: '8px', padding: '14px', marginBottom: '20px', border: `1px solid ${tema.border}` }}>
        <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{turno.pacientes?.nombre || '—'}</p>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: tema.textMuted }}>{turno.tipos_consulta?.nombre || 'Sin tipo'} · {turno.usuarios?.nombre || '—'}</p>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: tema.textMuted }}>Recibo N°: <strong style={{ color: '#34d399' }}>{nroRecibo}</strong></p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <label style={S.label}>Monto total ($)</label>
          <input type="number" min="0" style={{ ...S.input, fontSize: '20px', fontWeight: 'bold' }} value={monto} onChange={e => setMonto(e.target.value)} />
        </div>
        <div>
          <label style={S.label}>Monto cobrado ($)</label>
          <input type="number" min="0" style={{ ...S.input, fontSize: '20px', color: '#34d399' }} value={montoPagado} onChange={e => { setMontoPagado(e.target.value); setEstadoPago(parseFloat(e.target.value) >= parseFloat(monto) ? 'pagado' : 'parcial'); }} />
        </div>
        <div>
          <label style={S.label}>Medio de pago</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setMedioPago('efectivo')} style={{ ...(medioPago === 'efectivo' ? S.btnPrimary : S.btnGhost), flex: 1, fontSize: '13px' }}>💵 Efectivo</button>
            <button onClick={() => setMedioPago('transferencia')} style={{ ...(medioPago === 'transferencia' ? S.btnPrimary : S.btnGhost), flex: 1, fontSize: '13px' }}>📱 Transferencia</button>
          </div>
        </div>
        <div>
          <label style={S.label}>Estado del pago</label>
          <div style={{ padding: '10px', background: estadoPago === 'pagado' ? '#052e16' : '#451a03', borderRadius: '8px', border: `1px solid ${estadoPago === 'pagado' ? '#059669' : '#d97706'}`, textAlign: 'center' }}>
            <span style={{ fontWeight: 'bold', color: estadoPago === 'pagado' ? '#34d399' : '#fbbf24' }}>
              {estadoPago === 'pagado' ? '✅ Pagado completo' : `⚠️ Parcial — debe $${(parseFloat(monto) - parseFloat(montoPagado || '0')).toLocaleString('es-AR')}`}
            </span>
          </div>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Notas</label>
          <input style={S.input} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del cobro..." />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnSuccess, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : '💰 CONFIRMAR COBRO'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── FORM PRECIOS ───────────────────────────────────────────────────────────────
const FormPrecios = ({ clinicaId, tipos, onSave, tema }: {
  clinicaId: string; tipos: TipoConsulta[]; onSave: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const [precios, setPrecios] = useState<Record<string, string>>(
    Object.fromEntries(tipos.map(t => [t.id, t.precio.toString()]))
  );
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [saving, setSaving] = useState(false);

  const guardarPrecios = async () => {
    setSaving(true);
    await Promise.all(tipos.map(t =>
      supabase.from('tipos_consulta').update({ precio: parseFloat(precios[t.id]) || 0 }).eq('id', t.id)
    ));
    setSaving(false); onSave();
  };

  const agregarTipo = async () => {
    if (!nuevoNombre.trim()) return;
    await supabase.from('tipos_consulta').insert({ clinica_id: clinicaId, nombre: nuevoNombre.trim(), precio: parseFloat(nuevoPrecio) || 0 });
    setNuevoNombre(''); setNuevoPrecio(''); onSave();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {tipos.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ flex: 1, color: tema.text, fontSize: '14px' }}>{t.nombre}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: tema.textMuted, fontSize: '13px' }}>$</span>
            <input type="number" min="0" value={precios[t.id] || ''} onChange={e => setPrecios(p => ({ ...p, [t.id]: e.target.value }))}
              style={{ ...S.input, width: '120px', textAlign: 'right' }} />
          </div>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${tema.border}`, paddingTop: '12px', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}><label style={S.label}>Nuevo tipo</label><input style={S.input} value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej: Ecografía" /></div>
        <div style={{ width: '120px' }}><label style={S.label}>Precio</label><input type="number" style={S.input} value={nuevoPrecio} onChange={e => setNuevoPrecio(e.target.value)} /></div>
        <button onClick={agregarTipo} style={{ ...S.btnSuccess, whiteSpace: 'nowrap' }}>+ Agregar</button>
      </div>
      <button onClick={guardarPrecios} disabled={saving} style={{ ...S.btnPrimary, padding: '14px', marginTop: '8px', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Guardando...' : '💾 GUARDAR PRECIOS'}
      </button>
    </div>
  );
};

export default SeccionTurnos;
