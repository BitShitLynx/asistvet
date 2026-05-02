import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';
import { Modal } from '../components/shared';

const SERVICIOS_GROOMING = [
  'Baño y secado',
  'Corte de pelo',
  'Corte de uñas',
  'Limpieza de oídos',
  'Cepillado',
  'Deslanado',
  'Baño medicado',
  'Perfume',
  'Moño / accesorios',
];

interface TurnoGrooming {
  id: string;
  paciente_id: string;
  fecha: string;
  hora: string;
  servicios: string[];
  precio_total: number;
  estado: string;
  observaciones: string;
  pacientes?: { nombre: string; especie: string; raza: string };
}

const FORM_VACIO = (hoy: string) => ({
  paciente_id: '', fecha: hoy, hora: '09:00',
  servicios: [] as string[], precio_total: '', observaciones: '',
});

const ESTADO_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  pendiente:  { bg: '#1a1a2a', color: '#A78BFA', border: '#5B21B6' },
  en_curso:   { bg: '#1a1500', color: '#fbbf24', border: '#d97706' },
  finalizado: { bg: '#0a1a0a', color: '#4ade80', border: '#16a34a' },
  cancelado:  { bg: '#1a0a0a', color: '#f87171', border: '#dc2626' },
};

const SeccionGrooming = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const hoy = new Date().toISOString().split('T')[0];

  const [turnos, setTurnos]       = useState<TurnoGrooming[]>([]);
  const [pacientes, setPacientes] = useState<{ id: string; nombre: string; especie: string; raza: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fechaSel, setFechaSel]   = useState(hoy);

  // 'nuevo' | TurnoGrooming (editar) | null (cerrado)
  const [turnoModal, setTurnoModal]     = useState<TurnoGrooming | 'nuevo' | null>(null);
  const [turnoEliminar, setTurnoEliminar] = useState<TurnoGrooming | null>(null);

  const [form, setForm] = useState(FORM_VACIO(hoy));
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('grooming_turnos')
      .select('*, pacientes(nombre, especie, raza)')
      .eq('clinica_id', usuario.clinica_id)
      .eq('fecha', fechaSel)
      .order('hora');
    setTurnos((data || []) as TurnoGrooming[]);
    setLoading(false);
  }, [usuario.clinica_id, fechaSel]);

  const cargarPacientes = useCallback(async () => {
    const { data, error } = await supabase
      .from('pacientes')
      .select('id, nombre, especie, raza')
      .eq('clinica_id', usuario.clinica_id)
      .order('nombre');
    if (error) { toast('Error al cargar pacientes', 'error'); return; }
    setPacientes(data || []);
  }, [usuario.clinica_id, toast]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarPacientes(); }, [cargarPacientes]);

  const abrirNuevo = () => {
    setForm(FORM_VACIO(fechaSel));
    setTurnoModal('nuevo');
  };

  const abrirEditar = (t: TurnoGrooming) => {
    setForm({
      paciente_id:   t.paciente_id,
      fecha:         t.fecha,
      hora:          t.hora ? t.hora.slice(0, 5) : '09:00',
      servicios:     [...t.servicios],
      precio_total:  String(t.precio_total),
      observaciones: t.observaciones || '',
    });
    setTurnoModal(t);
  };

  const toggleServicio = (s: string) => {
    setForm(p => ({
      ...p,
      servicios: p.servicios.includes(s)
        ? p.servicios.filter(x => x !== s)
        : [...p.servicios, s],
    }));
  };

  const guardar = async () => {
    if (!form.paciente_id) { toast('Seleccioná un paciente', 'warning'); return; }
    if (form.servicios.length === 0) { toast('Seleccioná al menos un servicio', 'warning'); return; }
    setSaving(true);

    const payload = {
      paciente_id:   form.paciente_id,
      fecha:         form.fecha,
      hora:          form.hora,
      servicios:     form.servicios,
      precio_total:  parseFloat(form.precio_total) || 0,
      observaciones: form.observaciones || null,
    };

    const esEdicion = turnoModal !== 'nuevo';
    const { error } = esEdicion
      ? await supabase.from('grooming_turnos').update(payload).eq('id', (turnoModal as TurnoGrooming).id)
      : await supabase.from('grooming_turnos').insert({ ...payload, clinica_id: usuario.clinica_id, estado: 'pendiente' });

    if (error) { toast('Error al guardar: ' + error.message, 'error'); setSaving(false); return; }
    toast(esEdicion ? 'Turno actualizado' : 'Turno registrado', 'success');
    setTurnoModal(null);
    setSaving(false);
    cargar();
  };

  const cambiarEstado = async (id: string, estado: string) => {
    const { error } = await supabase.from('grooming_turnos').update({ estado }).eq('id', id);
    if (error) { toast('Error al cambiar estado', 'error'); return; }
    toast('Estado actualizado', 'success');
    cargar();
  };

  const eliminar = async () => {
    if (!turnoEliminar) return;
    setSaving(true);
    const { error } = await supabase.from('grooming_turnos').delete().eq('id', turnoEliminar.id);
    if (error) { toast('Error al eliminar: ' + error.message, 'error'); setSaving(false); return; }
    toast('Turno eliminado', 'success');
    setTurnoEliminar(null);
    setSaving(false);
    cargar();
  };

  const totalDia   = turnos.reduce((a, t) => a + t.precio_total, 0);
  const finalizados = turnos.filter(t => t.estado === 'finalizado').length;
  const modoEdicion = turnoModal !== null && turnoModal !== 'nuevo';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {[
          { label: 'Turnos hoy',    valor: turnos.length,                                      color: '#A78BFA' },
          { label: 'Finalizados',   valor: finalizados,                                         color: '#4ade80' },
          { label: 'Pendientes',    valor: turnos.filter(t => t.estado === 'pendiente').length, color: '#fbbf24' },
          { label: 'Total del día', valor: `$${totalDia.toLocaleString('es-AR')}`,             color: '#A78BFA' },
        ].map(k => (
          <div key={k.label} style={{ ...S.card, textAlign: 'center' }}>
            <p style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: '700', color: k.color }}>{k.valor}</p>
            <p style={{ margin: 0, fontSize: '11px', color: tema.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={fechaSel} onChange={e => setFechaSel(e.target.value)}
          style={{ ...S.input, width: 'auto', colorScheme: 'dark' }} />
        <button onClick={() => setFechaSel(hoy)} style={{ ...S.btnGhost, padding: '9px 16px' }}>Hoy</button>
        <div style={{ flex: 1 }} />
        <button onClick={abrirNuevo} style={{ ...S.btnPrimary, padding: '10px 20px' }}>
          + Nuevo turno
        </button>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tema.border}` }}>
          <h4 style={{ margin: 0, color: tema.text, fontSize: '14px', fontWeight: '600' }}>
            Agenda de grooming — {new Date(fechaSel + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h4>
        </div>
        {loading ? (
          <p style={{ padding: '24px', color: tema.textMuted, fontSize: '13px' }}>Cargando...</p>
        ) : turnos.length === 0 ? (
          <p style={{ padding: '32px', color: tema.textMuted, fontSize: '13px', textAlign: 'center' }}>No hay turnos para este día.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Hora', 'Paciente', 'Servicios', 'Precio', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#8B5CF6', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {turnos.map(t => {
                const est = ESTADO_COLOR[t.estado] || ESTADO_COLOR.pendiente;
                const activo = t.estado === 'pendiente' || t.estado === 'en_curso';
                return (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', color: tema.textMuted, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                      {t.hora ? t.hora.slice(0, 5) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ margin: '0 0 2px', fontWeight: '600', color: tema.text, fontSize: '14px' }}>{t.pacientes?.nombre}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>{t.pacientes?.especie} · {t.pacientes?.raza}</p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {t.servicios.map((s, i) => (
                          <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '99px', background: '#1e1333', color: '#A78BFA', border: '1px solid #5B21B6' }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: tema.text, fontSize: '13px' }}>
                      ${t.precio_total.toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: est.bg, color: est.color, border: `1px solid ${est.border}`, fontWeight: '500', letterSpacing: '0.04em' }}>
                        {t.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {t.estado === 'pendiente' && (
                          <button onClick={() => cambiarEstado(t.id, 'en_curso')}
                            style={{ padding: '4px 10px', fontSize: '11px', background: '#1a1500', color: '#fbbf24', border: '1px solid #d97706', borderRadius: '5px', cursor: 'pointer' }}>
                            Iniciar
                          </button>
                        )}
                        {t.estado === 'en_curso' && (
                          <button onClick={() => cambiarEstado(t.id, 'finalizado')}
                            style={{ padding: '4px 10px', fontSize: '11px', background: '#0a1a0a', color: '#4ade80', border: '1px solid #16a34a', borderRadius: '5px', cursor: 'pointer' }}>
                            Finalizar
                          </button>
                        )}
                        {activo && (
                          <button onClick={() => cambiarEstado(t.id, 'cancelado')}
                            style={{ padding: '4px 10px', fontSize: '11px', background: 'transparent', color: '#f87171', border: '1px solid #dc2626', borderRadius: '5px', cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        )}
                        <button onClick={() => abrirEditar(t)}
                          style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent', color: tema.accent, border: `1px solid ${tema.border}`, borderRadius: '5px', cursor: 'pointer' }}>
                          ✏️
                        </button>
                        <button onClick={() => setTurnoEliminar(t)}
                          style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '5px', cursor: 'pointer' }}>
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

      {/* Modal crear / editar turno */}
      {turnoModal !== null && (
        <Modal
          titulo={modoEdicion ? 'Editar turno de grooming' : 'Nuevo turno de grooming'}
          onClose={() => setTurnoModal(null)}
          tema={tema}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Paciente *</label>
                <select value={form.paciente_id}
                  onChange={e => setForm(p => ({ ...p, paciente_id: e.target.value }))}
                  style={{ ...S.input, cursor: 'pointer' }}>
                  <option value="">-- Seleccioná un paciente --</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} — {p.especie}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Fecha</label>
                <input type="date" value={form.fecha}
                  onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))}
                  style={{ ...S.input, colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={S.label}>Hora</label>
                <input type="time" value={form.hora}
                  onChange={e => setForm(p => ({ ...p, hora: e.target.value }))}
                  style={{ ...S.input, colorScheme: 'dark' }} />
              </div>
            </div>

            <div>
              <label style={S.label}>Servicios *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                {SERVICIOS_GROOMING.map(s => (
                  <button key={s} onClick={() => toggleServicio(s)}
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '99px', cursor: 'pointer', border: `1px solid ${form.servicios.includes(s) ? '#7C3AED' : tema.border}`, background: form.servicios.includes(s) ? '#1e1333' : 'transparent', color: form.servicios.includes(s) ? '#A78BFA' : tema.textMuted, fontWeight: form.servicios.includes(s) ? '500' : '400' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={S.label}>Precio total ($)</label>
                <input type="number" min="0" value={form.precio_total}
                  onChange={e => setForm(p => ({ ...p, precio_total: e.target.value }))}
                  style={S.input} placeholder="0" />
              </div>
              <div>
                <label style={S.label}>Observaciones</label>
                <input type="text" value={form.observaciones}
                  onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))}
                  style={S.input} placeholder="Opcional" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={guardar} disabled={saving}
                style={{ ...S.btnPrimary, flex: 1, padding: '12px', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Registrar turno'}
              </button>
              <button onClick={() => setTurnoModal(null)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmar eliminación */}
      {turnoEliminar && (
        <Modal titulo="Eliminar turno" onClose={() => setTurnoEliminar(null)} tema={tema}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, color: tema.text, fontSize: '14px' }}>
              ¿Eliminás el turno de <strong>{turnoEliminar.pacientes?.nombre}</strong> del{' '}
              {new Date(turnoEliminar.fecha + 'T00:00:00').toLocaleDateString('es-AR')} a las {turnoEliminar.hora?.slice(0, 5)}?
            </p>
            <p style={{ margin: 0, color: '#f87171', fontSize: '13px' }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={eliminar} disabled={saving}
                style={{ ...S.btnPrimary, flex: 1, padding: '12px', background: '#dc2626', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button onClick={() => setTurnoEliminar(null)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SeccionGrooming;
