import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';

const ADMIN_EMAIL = 'marianonicolasmontano@gmail.com'; // reemplazar con tu email real

interface Clinica {
  id: string; nombre: string; email?: string;
  telefono?: string; created_at: string;
}

const AdminLynx = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    clinicaNombre: '', clinicaTelefono: '', clinicaEmail: '',
    adminNombre: '', adminEmail: '', adminPassword: '',
  });
  const [creando, setCreando] = useState(false);

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('clinicas').select('*').order('created_at', { ascending: false });
    setClinicas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const crearClinica = async () => {
    if (!form.clinicaNombre.trim()) { toast('El nombre de la clínica es obligatorio', 'warning'); return; }
    if (!form.adminEmail.trim() || !form.adminPassword.trim()) { toast('Email y contraseña del admin son obligatorios', 'warning'); return; }
    if (form.adminPassword.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }

    setCreando(true);

    // 1. Crear clínica
    const { data: clinica, error: e1 } = await supabase
      .from('clinicas').insert({
        nombre: form.clinicaNombre.trim(),
        telefono: form.clinicaTelefono || null,
        email: form.clinicaEmail || null,
      }).select().single();

    if (e1 || !clinica) { toast('Error al crear la clínica: ' + e1?.message, 'error'); setCreando(false); return; }

    // 2. Crear usuario en Auth
    const { data: authData, error: e2 } = await supabase.auth.signUp({
      email: form.adminEmail.trim(),
      password: form.adminPassword,
    });

    if (e2 || !authData.user) {
      toast('Error al crear usuario Auth: ' + e2?.message, 'error');
      setCreando(false); return;
    }

    // 3. Insertar en tabla usuarios
    const { error: e3 } = await supabase.from('usuarios').insert({
      id: authData.user.id,
      clinica_id: clinica.id,
      nombre: form.adminNombre.trim() || 'Administrador',
      email: form.adminEmail.trim(),
      rol: 'admin',
      activo: true,
    });

    if (e3) { toast('Error al crear usuario en DB: ' + e3.message, 'error'); setCreando(false); return; }

    toast(`Clínica "${clinica.nombre}" creada correctamente`, 'success');
    setForm({ clinicaNombre: '', clinicaTelefono: '', clinicaEmail: '', adminNombre: '', adminEmail: '', adminPassword: '' });
    cargar();
    setCreando(false);
  };

  const eliminarClinica = async (id: string, nombre: string) => {
    if (id === 'aaaaaaaa-0000-0000-0000-000000000001') {
      toast('No se puede eliminar la clínica demo', 'warning');
      return;
    }
    const { error } = await supabase.from('clinicas').delete().eq('id', id);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    toast(`Clínica "${nombre}" eliminada`, 'success');
    cargar();
  };

  // Acceso restringido
  if (usuario.email !== ADMIN_EMAIL) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ fontSize: '32px', margin: '0 0 16px' }}>🔒</p>
        <h3 style={{ color: tema.text, margin: '0 0 8px' }}>Acceso restringido</h3>
        <p style={{ color: tema.textMuted, fontSize: '14px' }}>Panel exclusivo de administración Lynx.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ ...S.card, borderLeft: '2px solid #5a9e5a' }}>
        <p style={{ margin: '0 0 4px', fontSize: '11px', color: tema.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Panel interno</p>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: tema.text }}>Administración Lynx</h2>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: tema.textMuted }}>{clinicas.length} clínica{clinicas.length !== 1 ? 's' : ''} registrada{clinicas.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Formulario nueva clínica */}
      <div style={{ ...S.card }}>
        <h3 style={{ margin: '0 0 20px', fontSize: '15px', fontWeight: '600', color: tema.text }}>Nueva clínica</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Nombre de la clínica *</label>
            <input style={S.input} value={form.clinicaNombre} onChange={e => set('clinicaNombre', e.target.value)} placeholder="Ej: Veterinaria San Martín" />
          </div>
          <div>
            <label style={S.label}>Teléfono</label>
            <input style={S.input} value={form.clinicaTelefono} onChange={e => set('clinicaTelefono', e.target.value)} placeholder="+54 9 11 1234-5678" />
          </div>
          <div>
            <label style={S.label}>Email de la clínica</label>
            <input style={S.input} value={form.clinicaEmail} onChange={e => set('clinicaEmail', e.target.value)} placeholder="info@clinica.com" />
          </div>

          <div style={{ gridColumn: '1/-1', borderTop: `1px solid ${tema.border}`, paddingTop: '14px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '11px', color: tema.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Usuario administrador</p>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Nombre completo *</label>
            <input style={S.input} value={form.adminNombre} onChange={e => set('adminNombre', e.target.value)} placeholder="Ej: Dr. Juan Pérez" />
          </div>
          <div>
            <label style={S.label}>Email *</label>
            <input type="email" style={S.input} value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@clinica.com" />
          </div>
          <div>
            <label style={S.label}>Contraseña inicial *</label>
            <input type="password" style={S.input} value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)} placeholder="Mín. 6 caracteres" />
          </div>
        </div>
        <button onClick={crearClinica} disabled={creando}
          style={{ ...S.btnPrimary, marginTop: '20px', padding: '12px 28px', opacity: creando ? 0.6 : 1 }}>
          {creando ? 'Creando...' : 'Crear clínica'}
        </button>
      </div>

      {/* Lista de clínicas */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${tema.border}` }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: tema.text }}>Clínicas registradas</h3>
        </div>
        {loading ? (
          <p style={{ padding: '20px', color: tema.textMuted, fontSize: '13px' }}>Cargando...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Nombre', 'Email', 'Teléfono', 'Creada', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: tema.accent, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {clinicas.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px', color: tema.textMuted, textAlign: 'center', fontSize: '13px' }}>Sin clínicas registradas.</td></tr>
              )}
              {clinicas.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 16px', fontWeight: '600', color: tema.text, fontSize: '14px' }}>{c.nombre}</td>
                  <td style={{ padding: '13px 16px', color: tema.textMuted, fontSize: '13px' }}>{c.email || '—'}</td>
                  <td style={{ padding: '13px 16px', color: tema.textMuted, fontSize: '13px' }}>{c.telefono || '—'}</td>
                  <td style={{ padding: '13px 16px', color: tema.textMuted, fontSize: '13px' }}>
                    {new Date(c.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <button
                      onClick={() => eliminarClinica(c.id, c.nombre)}
                      style={{ padding: '4px 10px', background: 'transparent', color: '#c07070', border: '1px solid #c07070', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminLynx;
