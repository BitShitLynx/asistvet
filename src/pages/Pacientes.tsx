import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario, Paciente, Propietario, Consulta, Internacion, Aplicacion } from '../supabaseClient';
import { makeS, ESTADO_CONFIG, ESPECIES, SEXOS, formatFecha } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { BadgeEstado, Modal } from '../components/shared';
import { useToast } from '../components/toast';

// ── FORM PACIENTE ──────────────────────────────────────────────────────────────
const FormPaciente = ({ clinicaId, paciente, propietarios, onSave, onClose, tema }: { clinicaId: string; paciente?: Paciente; propietarios: Propietario[]; onSave: () => void; onClose: () => void; tema: TemaObj }) => {
  const S = makeS(tema); const esEdicion = !!paciente;
  const { toast } = useToast();
  const [form, setForm] = useState({ nombre: paciente?.nombre || '', especie: paciente?.especie || 'Canino', raza: paciente?.raza || '', sexo: paciente?.sexo || 'No especificado', edad_años: paciente?.edad_años?.toString() || '', edad_meses: paciente?.edad_meses?.toString() || '', peso_kg: paciente?.peso_kg?.toString() || '', color: paciente?.color || '', microchip: paciente?.microchip || '', estado: paciente?.estado || 'ambulatorio', propietario_id: paciente?.propietario_id || '' });
  const [nuevoOwner, setNuevoOwner] = useState({ nombre: '', telefono: '', direccion: '', email: '' });
  const [crearOwner, setCrearOwner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError('');
    let propietario_id: string | null = form.propietario_id || null;
    if (crearOwner && nuevoOwner.nombre.trim()) {
      const { data: od, error: oe } = await supabase.from('propietarios').insert({ ...nuevoOwner, clinica_id: clinicaId }).select().single();
      if (oe) { toast('Error al crear propietario: ' + oe.message, 'error'); setSaving(false); return; }
      propietario_id = od.id;
    }
    const payload = { clinica_id: clinicaId, propietario_id, nombre: form.nombre.trim(), especie: form.especie, raza: form.raza || null, sexo: form.sexo, edad_años: form.edad_años ? parseInt(form.edad_años) : null, edad_meses: form.edad_meses ? parseInt(form.edad_meses) : null, peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null, color: form.color || null, microchip: form.microchip || null, estado: form.estado };
    const { error: dbErr } = esEdicion ? await supabase.from('pacientes').update(payload).eq('id', paciente!.id) : await supabase.from('pacientes').insert(payload);
    if (dbErr) { toast('Error al guardar: ' + dbErr.message, 'error'); setSaving(false); return; }
    if (!esEdicion && form.estado === 'internado') {
      const { data: pac } = await supabase.from('pacientes').select('id').eq('clinica_id', clinicaId).order('created_at', { ascending: false }).limit(1).single();
      if (pac) await supabase.from('internaciones').insert({ paciente_id: pac.id, clinica_id: clinicaId, fecha_ingreso: new Date().toISOString() });
    }
    toast(esEdicion ? 'Paciente actualizado correctamente' : 'Paciente registrado correctamente', 'success');
    onSave(); onClose();
  };

  return (
    <div>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Nombre *</label><input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Max" /></div>
        <div><label style={S.label}>Especie *</label><select style={{ ...S.input, cursor: 'pointer' }} value={form.especie} onChange={e => set('especie', e.target.value)}>{ESPECIES.map(e => <option key={e}>{e}</option>)}</select></div>
        <div><label style={S.label}>Raza</label><input style={S.input} value={form.raza} onChange={e => set('raza', e.target.value)} placeholder="Ej: Golden Retriever" /></div>
        <div><label style={S.label}>Sexo</label><select style={{ ...S.input, cursor: 'pointer' }} value={form.sexo} onChange={e => set('sexo', e.target.value)}>{SEXOS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div><label style={S.label}>Estado</label><select style={{ ...S.input, cursor: 'pointer' }} value={form.estado} onChange={e => set('estado', e.target.value)}>{Object.entries(ESTADO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div><label style={S.label}>Edad (años)</label><input style={S.input} type="number" min="0" value={form.edad_años} onChange={e => set('edad_años', e.target.value)} placeholder="0" /></div>
        <div><label style={S.label}>Edad (meses)</label><input style={S.input} type="number" min="0" max="11" value={form.edad_meses} onChange={e => set('edad_meses', e.target.value)} placeholder="0" /></div>
        <div><label style={S.label}>Peso (kg)</label><input style={S.input} type="number" min="0" step="0.1" value={form.peso_kg} onChange={e => set('peso_kg', e.target.value)} placeholder="0.0" /></div>
        <div><label style={S.label}>Color / pelaje</label><input style={S.input} value={form.color} onChange={e => set('color', e.target.value)} placeholder="Ej: Dorado" /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Nº Microchip</label><input style={S.input} value={form.microchip} onChange={e => set('microchip', e.target.value)} placeholder="Opcional" /></div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Propietario</label>
          {!crearOwner ? (
            <div style={{ display: 'flex', gap: '10px' }}>
              <select style={{ ...S.input, cursor: 'pointer', flex: 1 }} value={form.propietario_id} onChange={e => set('propietario_id', e.target.value)}>
                <option value="">-- Sin propietario --</option>
                {propietarios.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.telefono ? ` — ${p.telefono}` : ''}</option>)}
              </select>
              <button onClick={() => setCrearOwner(true)} style={{ ...S.btnSuccess, whiteSpace: 'nowrap' }}>+ Nuevo</button>
            </div>
          ) : (
            <div style={{ background: tema.bgInput, padding: '15px', borderRadius: '8px', border: `1px solid ${tema.border}` }}>
              <p style={{ ...S.label, marginBottom: '10px', color: '#34d399' }}>NUEVO PROPIETARIO</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Nombre *</label><input style={S.input} value={nuevoOwner.nombre} onChange={e => setNuevoOwner(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre completo" /></div>
                <div><label style={S.label}>Teléfono</label><input style={S.input} value={nuevoOwner.telefono} onChange={e => setNuevoOwner(p => ({ ...p, telefono: e.target.value }))} /></div>
                <div><label style={S.label}>Email</label><input style={S.input} value={nuevoOwner.email} onChange={e => setNuevoOwner(p => ({ ...p, email: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Dirección</label><input style={S.input} value={nuevoOwner.direccion} onChange={e => setNuevoOwner(p => ({ ...p, direccion: e.target.value }))} /></div>
              </div>
              <button onClick={() => setCrearOwner(false)} style={{ ...S.btnGhost, marginTop: '10px', fontSize: '13px' }}>← Volver</button>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando...' : esEdicion ? '💾 GUARDAR CAMBIOS' : '✅ REGISTRAR PACIENTE'}</button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── FORM CONSULTA ──────────────────────────────────────────────────────────────
const FormConsulta = ({ clinicaId, pacienteId, usuarioId, consulta, onSave, onClose, tema }: { clinicaId: string; pacienteId: string; usuarioId: string; consulta?: Consulta; onSave: () => void; onClose: () => void; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [form, setForm] = useState({ fecha: consulta?.fecha?.split('T')[0] || new Date().toISOString().split('T')[0], motivo: consulta?.motivo || '', peso_kg: consulta?.peso_kg?.toString() || '', temp_c: consulta?.temp_c?.toString() || '', evolucion: consulta?.evolucion || '', diagnostico: consulta?.diagnostico || '', tratamiento: consulta?.tratamiento || '' });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const guardar = async () => {
    setSaving(true);
    const payload = { clinica_id: clinicaId, paciente_id: pacienteId, veterinario_id: usuarioId, fecha: new Date(form.fecha).toISOString(), motivo: form.motivo || null, peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null, temp_c: form.temp_c ? parseFloat(form.temp_c) : null, evolucion: form.evolucion || null, diagnostico: form.diagnostico || null, tratamiento: form.tratamiento || null };
    const { error: dbErr } = consulta ? await supabase.from('consultas').update(payload).eq('id', consulta.id) : await supabase.from('consultas').insert(payload);
    if (dbErr) { toast('Error al guardar consulta: ' + dbErr.message, 'error'); setSaving(false); return; }
    toast(consulta ? 'Consulta actualizada correctamente' : 'Consulta registrada correctamente', 'success');
    onSave(); onClose();
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div><label style={S.label}>Fecha</label><input style={{ ...S.input, colorScheme: 'dark' }} type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
        <div><label style={S.label}>Motivo</label><input style={S.input} value={form.motivo} onChange={e => set('motivo', e.target.value)} placeholder="Ej: Control anual" /></div>
        <div><label style={S.label}>Peso (kg)</label><input style={S.input} type="number" step="0.1" value={form.peso_kg} onChange={e => set('peso_kg', e.target.value)} placeholder="0.0" /></div>
        <div><label style={S.label}>Temperatura (°C)</label><input style={S.input} type="number" step="0.1" value={form.temp_c} onChange={e => set('temp_c', e.target.value)} placeholder="38.5" /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Evolución clínica</label><textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={form.evolucion} onChange={e => set('evolucion', e.target.value)} placeholder="Descripción del estado..." /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Diagnóstico</label><textarea rows={2} style={{ ...S.input, resize: 'vertical' }} value={form.diagnostico} onChange={e => set('diagnostico', e.target.value)} placeholder="Diagnóstico presuntivo o definitivo..." /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Tratamiento indicado</label><textarea rows={2} style={{ ...S.input, resize: 'vertical' }} value={form.tratamiento} onChange={e => set('tratamiento', e.target.value)} placeholder="Medicación, indicaciones..." /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando...' : '✅ GUARDAR CONSULTA'}</button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── FICHA PACIENTE ─────────────────────────────────────────────────────────────
const FichaPaciente = ({ paciente, clinicaId, usuarioId, onClose: _onClose, onUpdate, tema }: { paciente: Paciente; clinicaId: string; usuarioId: string; onClose: () => void; onUpdate: () => void; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [tab, setTab] = useState<'info' | 'consultas' | 'internaciones' | 'aplicaciones'>('info');
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [internaciones, setInternaciones] = useState<Internacion[]>([]);
  const [aplicaciones, setAplicaciones] = useState<Aplicacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalConsulta, setModalConsulta] = useState(false);
  const [modalAlta, setModalAlta] = useState(false);
  const [obsAlta, setObsAlta] = useState('');
  const [estadoActual, setEstadoActual] = useState(paciente.estado);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [c, i, a] = await Promise.all([
      supabase.from('consultas').select('*').eq('paciente_id', paciente.id).order('fecha', { ascending: false }),
      supabase.from('internaciones').select('*').eq('paciente_id', paciente.id).order('fecha_ingreso', { ascending: false }),
      supabase.from('aplicaciones').select('*').eq('paciente_id', paciente.id).order('fecha_aplicacion', { ascending: false }),
    ]);
    setConsultas(c.data || []); setInternaciones(i.data || []); setAplicaciones(a.data || []);
    setLoading(false);
  }, [paciente.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const darAlta = async () => {
    const ia = internaciones.find(i => !i.fecha_egreso);
    if (ia) await supabase.from('internaciones').update({ fecha_egreso: new Date().toISOString(), observaciones: obsAlta }).eq('id', ia.id);
    await supabase.from('pacientes').update({ estado: 'alta' }).eq('id', paciente.id);
    toast('Alta registrada correctamente', 'success');
    setEstadoActual('alta'); onUpdate(); cargar(); setModalAlta(false);
  };
  const internar = async () => {
    await supabase.from('pacientes').update({ estado: 'internado' }).eq('id', paciente.id);
    await supabase.from('internaciones').insert({ paciente_id: paciente.id, clinica_id: clinicaId, fecha_ingreso: new Date().toISOString() });
    toast('Paciente internado correctamente', 'success');
    setEstadoActual('internado'); onUpdate(); cargar();
  };
  const tabStyle = (t: string): React.CSSProperties => ({ padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', background: tab === t ? '#2563eb' : 'transparent', color: tab === t ? 'white' : tema.textMuted });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, color: tema.text }}>{paciente.nombre}</h2>
          <p style={{ margin: '4px 0 0', color: tema.textMuted, fontSize: '14px' }}>
            {paciente.especie}{paciente.raza ? ` · ${paciente.raza}` : ''}{paciente.sexo !== 'No especificado' ? ` · ${paciente.sexo}` : ''}
            {paciente.edad_años != null ? ` · ${paciente.edad_años}a${paciente.edad_meses ? ` ${paciente.edad_meses}m` : ''}` : ''}{paciente.peso_kg ? ` · ${paciente.peso_kg} kg` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <BadgeEstado estado={estadoActual} />
          {estadoActual !== 'internado' && <button onClick={internar} style={{ ...S.btnGhost, fontSize: '13px', borderColor: '#d97706', color: '#fbbf24' }}>🏥 Internar</button>}
          {estadoActual === 'internado' && <button onClick={() => setModalAlta(true)} style={{ ...S.btnSuccess, fontSize: '13px' }}>✅ Dar de alta</button>}
          <button onClick={() => setModalConsulta(true)} style={{ ...S.btnPrimary, fontSize: '13px' }}>+ Nueva consulta</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', borderBottom: `1px solid ${tema.border}`, paddingBottom: '10px', flexWrap: 'wrap' }}>
        {[{ k: 'info', label: '📋 Datos' }, { k: 'consultas', label: `🩺 Consultas (${consultas.length})` }, { k: 'internaciones', label: `🏥 Internaciones (${internaciones.length})` }, { k: 'aplicaciones', label: `💉 Aplicaciones (${aplicaciones.length})` }].map(({ k, label }) => (
          <button key={k} style={tabStyle(k)} onClick={() => setTab(k as any)}>{label}</button>
        ))}
      </div>
      {loading && <p style={{ color: tema.textMuted }}>Cargando...</p>}
      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[['Especie', paciente.especie], ['Raza', paciente.raza || '—'], ['Sexo', paciente.sexo || '—'], ['Edad', paciente.edad_años != null ? `${paciente.edad_años} años ${paciente.edad_meses || 0} meses` : '—'], ['Peso', paciente.peso_kg ? `${paciente.peso_kg} kg` : '—'], ['Color', paciente.color || '—'], ['Microchip', paciente.microchip || '—'], ['Registro', formatFecha(paciente.fecha_registro)]].map(([label, val]) => (
            <div key={label} style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
              <p style={{ ...S.label, margin: 0 }}>{label}</p>
              <p style={{ margin: '4px 0 0', fontWeight: 'bold', color: tema.text }}>{val}</p>
            </div>
          ))}
          {paciente.propietarios && (
            <div style={{ gridColumn: '1/-1', background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
              <p style={{ ...S.label, margin: 0 }}>Propietario</p>
              <p style={{ margin: '4px 0 0', fontWeight: 'bold', color: tema.text }}>{paciente.propietarios.nombre}</p>
              <p style={{ margin: '2px 0 0', color: tema.textMuted, fontSize: '13px' }}>{paciente.propietarios.telefono}{paciente.propietarios.direccion ? ` · ${paciente.propietarios.direccion}` : ''}</p>
            </div>
          )}
        </div>
      )}
      {tab === 'consultas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {consultas.length === 0 && <p style={{ color: tema.textMuted }}>Sin consultas registradas.</p>}
          {consultas.map(c => (
            <div key={c.id} style={{ background: tema.bgInput, borderRadius: '10px', padding: '15px', border: `1px solid ${tema.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong style={{ color: tema.text }}>{formatFecha(c.fecha)}</strong>
                <span style={{ color: tema.textMuted, fontSize: '13px' }}>{c.motivo || 'Sin motivo'}</span>
              </div>
              {(c.peso_kg || c.temp_c) && <p style={{ margin: '4px 0', fontSize: '13px', color: tema.textMuted }}>{c.peso_kg ? `Peso: ${c.peso_kg} kg` : ''}{c.temp_c ? ` · Temp: ${c.temp_c} °C` : ''}</p>}
              {c.evolucion && <p style={{ margin: '6px 0', fontSize: '14px', color: tema.text }}><span style={{ color: '#3b82f6', fontSize: '11px', fontWeight: 'bold' }}>EVOLUCIÓN  </span>{c.evolucion}</p>}
              {c.diagnostico && <p style={{ margin: '6px 0', fontSize: '14px', color: tema.text }}><span style={{ color: '#d97706', fontSize: '11px', fontWeight: 'bold' }}>DIAGNÓSTICO  </span>{c.diagnostico}</p>}
              {c.tratamiento && <p style={{ margin: '6px 0', fontSize: '14px', color: tema.text }}><span style={{ color: '#059669', fontSize: '11px', fontWeight: 'bold' }}>TRATAMIENTO  </span>{c.tratamiento}</p>}
            </div>
          ))}
        </div>
      )}
      {tab === 'internaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {internaciones.length === 0 && <p style={{ color: tema.textMuted }}>Sin internaciones registradas.</p>}
          {internaciones.map(i => (
            <div key={i.id} style={{ background: tema.bgInput, borderRadius: '10px', padding: '15px', border: `1px solid ${i.fecha_egreso ? tema.border : '#d97706'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: tema.text }}>Ingreso: {formatFecha(i.fecha_ingreso)}</strong>
                {i.fecha_egreso ? <span style={{ fontSize: '12px', background: '#059669', padding: '2px 10px', borderRadius: '99px', color: 'white' }}>Alta: {formatFecha(i.fecha_egreso)}</span> : <span style={{ fontSize: '12px', background: '#d97706', padding: '2px 10px', borderRadius: '99px', color: 'white' }}>Internado actualmente</span>}
              </div>
              {i.motivo && <p style={{ margin: '4px 0', fontSize: '13px', color: tema.textMuted }}>Motivo: {i.motivo}</p>}
              {i.observaciones && <p style={{ margin: '4px 0', fontSize: '14px', color: tema.text }}>Obs: {i.observaciones}</p>}
            </div>
          ))}
        </div>
      )}
      {tab === 'aplicaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {aplicaciones.length === 0 && <p style={{ color: tema.textMuted }}>Sin aplicaciones registradas.</p>}
          {aplicaciones.map(a => (
            <div key={a.id} style={{ background: tema.bgInput, borderRadius: '10px', padding: '15px', border: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: tema.text }}>{a.producto_nombre}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: tema.textMuted }}>{a.dosis}{a.via ? ` · ${a.via}` : ''}{a.cantidad ? ` · ${a.cantidad}` : ''}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '13px', color: tema.text }}>{formatFecha(a.fecha_aplicacion)}</p>
                {a.lote && <p style={{ margin: '2px 0 0', fontSize: '12px', color: tema.textMuted }}>Lote: {a.lote}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {modalConsulta && <Modal titulo="🩺 Nueva Consulta" onClose={() => setModalConsulta(false)} tema={tema}><FormConsulta clinicaId={clinicaId} pacienteId={paciente.id} usuarioId={usuarioId} onSave={cargar} onClose={() => setModalConsulta(false)} tema={tema} /></Modal>}
      {modalAlta && (
        <Modal titulo="✅ Dar de Alta" onClose={() => setModalAlta(false)} tema={tema}>
          <p style={{ color: tema.textMuted }}>Registrá las observaciones de egreso.</p>
          <label style={S.label}>Observaciones de alta</label>
          <textarea rows={3} style={{ ...S.input, resize: 'vertical', marginBottom: '15px' }} value={obsAlta} onChange={e => setObsAlta(e.target.value)} placeholder="Estado al egreso, indicaciones..." />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={darAlta} style={{ ...S.btnSuccess, flex: 1, padding: '14px' }}>✅ CONFIRMAR ALTA</button>
            <button onClick={() => setModalAlta(false)} style={S.btnGhost}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── SECCIÓN PACIENTES ──────────────────────────────────────────────────────────
const SeccionPacientes = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [propietarios, setPropietarios] = useState<Propietario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState<Paciente | null>(null);
  const [pacienteEditar, setPacienteEditar] = useState<Paciente | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('pacientes').select('*, propietarios(*)').eq('clinica_id', usuario.clinica_id).order('created_at', { ascending: false });
    setPacientes((data || []) as Paciente[]);
    const { data: owners } = await supabase.from('propietarios').select('*').eq('clinica_id', usuario.clinica_id);
    setPropietarios(owners || []);
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = pacientes.filter(p => {
    const q = busqueda.toLowerCase();
    return (p.nombre.toLowerCase().includes(q) || p.especie.toLowerCase().includes(q) || (p.propietarios?.nombre || '').toLowerCase().includes(q)) && (filtroEstado === 'todos' || p.estado === filtroEstado);
  });
  const internados = pacientes.filter(p => p.estado === 'internado');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '15px' }}>
        {[{ label: 'Total', val: pacientes.length, color: '#3b82f6' }, { label: 'Internados', val: internados.length, color: '#d97706' }, { label: 'Pendientes', val: pacientes.filter(p => p.estado === 'pendiente').length, color: '#7c3aed' }, { label: 'Con alta', val: pacientes.filter(p => p.estado === 'alta').length, color: '#059669' }].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, borderColor: color + '55', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Buscar por nombre, especie o propietario..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ ...S.input, flex: 1, minWidth: '200px', padding: '12px' }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...S.input, width: 'auto', cursor: 'pointer', padding: '12px' }}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => setModalNuevo(true)} style={{ ...S.btnSuccess, whiteSpace: 'nowrap' }}>+ Nuevo paciente</button>
      </div>
      {internados.length > 0 && (
        <div style={{ ...S.card, border: '1px solid #d97706' }}>
          <h4 style={{ margin: '0 0 12px', color: '#fbbf24' }}>🏥 Internados actualmente ({internados.length})</h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {internados.map(p => (
              <div key={p.id} onClick={() => setFichaAbierta(p)} style={{ background: tema.bgInput, padding: '10px 16px', borderRadius: '8px', border: '1px solid #d97706', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)} onMouseLeave={e => (e.currentTarget.style.background = tema.bgInput)}>
                <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{p.nombre}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: tema.textMuted }}>{p.especie} · {p.raza || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando pacientes...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Paciente', 'Especie / Raza', 'Propietario', 'Estado', 'Registro', 'Acciones'].map(h => <th key={h} style={{ padding: '12px 15px', textAlign: 'left', color: tema.accent, fontSize: '12px' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && <tr><td colSpan={6} style={{ padding: '20px', color: tema.textMuted, textAlign: 'center' }}>No se encontraron pacientes.</td></tr>}
              {filtrados.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${tema.border}` }} onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 15px', fontWeight: 'bold', cursor: 'pointer', color: tema.text }} onClick={() => setFichaAbierta(p)}>{p.nombre}</td>
                  <td style={{ padding: '12px 15px', color: tema.textMuted, fontSize: '13px' }}>{p.especie}{p.raza ? ` · ${p.raza}` : ''}</td>
                  <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.text }}>{p.propietarios?.nombre || <span style={{ color: '#475569' }}>—</span>}{p.propietarios?.telefono && <span style={{ color: tema.textMuted, fontSize: '13px', display: 'block' }}>{p.propietarios.telefono}</span>}</td>
                  <td style={{ padding: '12px 15px' }}><BadgeEstado estado={p.estado} /></td>
                  <td style={{ padding: '12px 15px', color: tema.textMuted, fontSize: '13px' }}>{formatFecha(p.fecha_registro)}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setFichaAbierta(p)} style={{ padding: '5px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>📋 Ficha</button>
                      <button onClick={() => setPacienteEditar(p)} style={S.btnDanger}>✏️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modalNuevo && <Modal titulo="➕ Nuevo Paciente" onClose={() => setModalNuevo(false)} tema={tema}><FormPaciente clinicaId={usuario.clinica_id} propietarios={propietarios} onSave={cargar} onClose={() => setModalNuevo(false)} tema={tema} /></Modal>}
      {pacienteEditar && <Modal titulo="✏️ Editar Paciente" onClose={() => setPacienteEditar(null)} tema={tema}><FormPaciente clinicaId={usuario.clinica_id} paciente={pacienteEditar} propietarios={propietarios} onSave={cargar} onClose={() => setPacienteEditar(null)} tema={tema} /></Modal>}
      {fichaAbierta && <Modal titulo={`Ficha — ${fichaAbierta.nombre}`} onClose={() => setFichaAbierta(null)} tema={tema}><FichaPaciente paciente={fichaAbierta} clinicaId={usuario.clinica_id} usuarioId={usuario.id} onClose={() => setFichaAbierta(null)} onUpdate={cargar} tema={tema} /></Modal>}
    </div>
  );
};

export default SeccionPacientes;
