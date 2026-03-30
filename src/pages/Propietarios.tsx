import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario, Propietario, Paciente } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { Modal } from '../components/shared';
import { useToast } from '../components/toast';

interface PropietarioExt extends Propietario {
  notas?: string;
  pacientes?: Paciente[];
}

interface Cobro {
  id: string; monto: number; monto_pagado: number; estado_pago: string;
  fecha_cobro: string; tipos_consulta?: { nombre: string };
}

const fmtFecha = (iso?: string) => iso
  ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—';
const fmtPeso = (n: number) => `$${n.toLocaleString('es-AR')}`;

// ── FICHA PROPIETARIO ──────────────────────────────────────────────────────────
const FichaPropietario = ({ propietario, tema, onClose: _onClose, onUpdate }: {
  propietario: PropietarioExt; tema: TemaObj; onClose: () => void; onUpdate: () => void;
}) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [tab, setTab] = useState<'datos' | 'pacientes' | 'cobros'>('datos');
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: propietario.nombre, telefono: propietario.telefono || '',
    email: propietario.email || '', direccion: propietario.direccion || '',
    notas: propietario.notas || '',
  });
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [p, _c] = await Promise.all([
      supabase.from('pacientes').select('*').eq('propietario_id', propietario.id).order('nombre'),
      supabase.from('cobros').select('*, tipos_consulta(nombre)')
        .eq('paciente_id', propietario.id)
        .order('fecha_cobro', { ascending: false })
        .limit(20),
    ]);
    // cobros por pacientes del propietario
    const pacs = p.data || [];
    setPacientes(pacs as Paciente[]);
    if (pacs.length > 0) {
      const { data: cdata } = await supabase
        .from('cobros').select('*, tipos_consulta(nombre)')
        .in('paciente_id', pacs.map(x => x.id))
        .order('fecha_cobro', { ascending: false });
      setCobros((cdata || []) as Cobro[]);
    } else {
      setCobros([]);
    }
    setLoading(false);
  }, [propietario.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setSaving(true);
    const { error: dbErr } = await supabase.from('propietarios').update({
      nombre: form.nombre, telefono: form.telefono || null,
      email: form.email || null, direccion: form.direccion || null,
      notas: form.notas || null,
    }).eq('id', propietario.id);
    if (dbErr) { toast('Error al guardar: ' + dbErr.message, 'error'); setSaving(false); return; }
    toast('Propietario actualizado correctamente', 'success');
    setSaving(false); setEditando(false); onUpdate();
  };

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '9px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontWeight: 'bold', fontSize: '13px',
    background: tab === t ? '#2563eb' : 'transparent',
    color: tab === t ? 'white' : tema.textMuted,
  });

  const deudaTotal = cobros
    .filter(c => c.estado_pago !== 'pagado')
    .reduce((a, c) => a + (c.monto - c.monto_pagado), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, color: tema.text }}>{propietario.nombre}</h2>
          <p style={{ margin: '4px 0 0', color: tema.textMuted, fontSize: '13px' }}>
            {pacientes.length} paciente{pacientes.length !== 1 ? 's' : ''} registrado{pacientes.length !== 1 ? 's' : ''}
            {deudaTotal > 0 && <span style={{ color: '#d97706', marginLeft: '12px' }}>⚠️ Deuda: {fmtPeso(deudaTotal)}</span>}
          </p>
        </div>
        <button onClick={() => setEditando(!editando)}
          style={{ padding: '8px 14px', background: 'transparent', border: `1px solid ${tema.border}`, borderRadius: '8px', cursor: 'pointer', color: tema.textMuted, fontSize: '13px' }}>
          {editando ? '✕ Cancelar' : '✏️ Editar'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: `1px solid ${tema.border}`, paddingBottom: '10px' }}>
        <button style={tabStyle('datos')} onClick={() => setTab('datos')}>📋 Datos</button>
        <button style={tabStyle('pacientes')} onClick={() => setTab('pacientes')}>🐕 Pacientes ({pacientes.length})</button>
        <button style={tabStyle('cobros')} onClick={() => setTab('cobros')}>💰 Cobros ({cobros.length})</button>
      </div>

      {loading && <p style={{ color: tema.textMuted }}>Cargando...</p>}

      {/* Tab datos */}
      {tab === 'datos' && (
        editando ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Nombre *</label><input style={S.input} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div><label style={S.label}>Email</label><input style={S.input} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Dirección</label><input style={S.input} value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Notas internas</label><textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones internas sobre el propietario..." /></div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: '10px' }}>
              <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '12px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Guardando...' : '💾 GUARDAR'}</button>
              <button onClick={() => setEditando(false)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              ['Teléfono', propietario.telefono || '—'],
              ['Email', propietario.email || '—'],
              ['Dirección', propietario.direccion || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
                <p style={{ ...S.label, margin: 0 }}>{label}</p>
                <p style={{ margin: '4px 0 0', color: tema.text, fontWeight: 'bold' }}>{val}</p>
              </div>
            ))}
            {propietario.notas && (
              <div style={{ gridColumn: '1/-1', background: tema.bgInput, padding: '12px', borderRadius: '8px' }}>
                <p style={{ ...S.label, margin: 0 }}>Notas internas</p>
                <p style={{ margin: '4px 0 0', color: tema.text, fontSize: '14px', lineHeight: '1.5' }}>{propietario.notas}</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Tab pacientes */}
      {tab === 'pacientes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pacientes.length === 0 && <p style={{ color: tema.textMuted }}>Sin pacientes registrados.</p>}
          {pacientes.map(p => (
            <div key={p.id} style={{ background: tema.bgInput, padding: '14px', borderRadius: '8px', border: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{p.nombre}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: tema.textMuted }}>{p.especie}{p.raza ? ` · ${p.raza}` : ''}{p.peso_kg ? ` · ${p.peso_kg} kg` : ''}</p>
              </div>
              <span style={{ fontSize: '11px', background: p.estado === 'internado' ? '#d97706' : p.estado === 'alta' ? '#059669' : '#2563eb', padding: '3px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>
                {p.estado}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tab cobros */}
      {tab === 'cobros' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {deudaTotal > 0 && (
            <div style={{ background: '#451a03', border: '1px solid #d97706', borderRadius: '8px', padding: '12px' }}>
              <p style={{ margin: 0, color: '#fbbf24', fontWeight: 'bold' }}>⚠️ Deuda pendiente total: {fmtPeso(deudaTotal)}</p>
            </div>
          )}
          {cobros.length === 0 && <p style={{ color: tema.textMuted }}>Sin cobros registrados.</p>}
          {cobros.map(c => (
            <div key={c.id} style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px', border: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: tema.text }}>{c.tipos_consulta?.nombre || 'Consulta'}</p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: tema.textMuted }}>{fmtFecha(c.fecha_cobro)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{fmtPeso(c.monto)}</p>
                <span style={{ fontSize: '11px', background: c.estado_pago === 'pagado' ? '#059669' : '#d97706', padding: '2px 8px', borderRadius: '99px', color: 'white' }}>
                  {c.estado_pago === 'pagado' ? 'Pagado' : `Debe ${fmtPeso(c.monto - c.monto_pagado)}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── FORM NUEVO PROPIETARIO ─────────────────────────────────────────────────────
const FormPropietario = ({ clinicaId, propietario, onSave, onClose, tema }: {
  clinicaId: string; propietario?: PropietarioExt; onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const esEdicion = !!propietario;
  const [form, setForm] = useState({
    nombre: propietario?.nombre || '', telefono: propietario?.telefono || '',
    email: propietario?.email || '', direccion: propietario?.direccion || '',
    notas: propietario?.notas || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError('');
    const payload = {
      clinica_id: clinicaId, nombre: form.nombre.trim(),
      telefono: form.telefono || null, email: form.email || null,
      direccion: form.direccion || null, notas: form.notas || null,
    };
    const { error: dbErr } = esEdicion
      ? await supabase.from('propietarios').update(payload).eq('id', propietario!.id)
      : await supabase.from('propietarios').insert(payload);
    if (dbErr) { toast('Error al guardar: ' + dbErr.message, 'error'); setSaving(false); return; }
    toast(esEdicion ? 'Propietario actualizado correctamente' : 'Propietario registrado correctamente', 'success');
    onSave(); onClose();
  };

  return (
    <div>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171', marginBottom: '15px' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Nombre *</label><input style={S.input} value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre completo" /></div>
        <div><label style={S.label}>Teléfono</label><input style={S.input} value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} placeholder="+54 9 11 1234-5678" /></div>
        <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="correo@ejemplo.com" /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Dirección</label><input style={S.input} value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} placeholder="Calle, número, ciudad" /></div>
        <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Notas internas</label><textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} placeholder="Observaciones internas..." /></div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : esEdicion ? '💾 GUARDAR CAMBIOS' : '✅ REGISTRAR PROPIETARIO'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── SECCIÓN PROPIETARIOS ───────────────────────────────────────────────────────
const SeccionPropietarios = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const [propietarios, setPropietarios] = useState<PropietarioExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [fichaAbierta, setFichaAbierta] = useState<PropietarioExt | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('propietarios').select('*')
      .eq('clinica_id', usuario.clinica_id).order('nombre');
    setPropietarios((data || []) as PropietarioExt[]);
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = propietarios.filter(p => {
    const q = busqueda.toLowerCase();
    return !q || p.nombre.toLowerCase().includes(q)
      || (p.telefono || '').includes(q)
      || (p.email || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '15px' }}>
        {[
          { label: 'Total propietarios', val: propietarios.length, color: '#3b82f6' },
          { label: 'Con teléfono', val: propietarios.filter(p => p.telefono).length, color: '#059669' },
          { label: 'Con email', val: propietarios.filter(p => p.email).length, color: '#7c3aed' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, borderColor: color + '55', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barra */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <input type="text" placeholder="Buscar por nombre, teléfono o email..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, flex: 1, padding: '12px' }} />
        <button onClick={() => setModalNuevo(true)} style={{ ...S.btnSuccess, whiteSpace: 'nowrap' }}>+ Nuevo propietario</button>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Nombre', 'Teléfono', 'Email', 'Dirección', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '12px 15px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>No se encontraron propietarios.</td></tr>
              )}
              {filtrados.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 15px', fontWeight: 'bold', color: tema.text, cursor: 'pointer' }}
                    onClick={() => setFichaAbierta(p)}>{p.nombre}</td>
                  <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.textMuted }}>{p.telefono || '—'}</td>
                  <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.textMuted }}>{p.email || '—'}</td>
                  <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.textMuted }}>{p.direccion || '—'}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <button onClick={() => setFichaAbierta(p)}
                      style={{ padding: '5px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      📋 Ver ficha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalNuevo && (
        <Modal titulo="➕ Nuevo Propietario" onClose={() => setModalNuevo(false)} tema={tema}>
          <FormPropietario clinicaId={usuario.clinica_id} onSave={cargar} onClose={() => setModalNuevo(false)} tema={tema} />
        </Modal>
      )}
      {fichaAbierta && (
        <Modal titulo={`👤 ${fichaAbierta.nombre}`} onClose={() => setFichaAbierta(null)} tema={tema}>
          <FichaPropietario propietario={fichaAbierta} tema={tema} onClose={() => setFichaAbierta(null)} onUpdate={cargar} />
        </Modal>
      )}
    </div>
  );
};

export default SeccionPropietarios;
