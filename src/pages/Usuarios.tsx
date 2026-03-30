import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { Modal } from '../components/shared';
import { useToast } from '../components/toast';

interface UsuarioExt extends Usuario { activo?: boolean; }

const ROLES = ['admin', 'veterinario', 'recepcionista'] as const;
const ROL_COLOR: Record<string, string> = { admin: '#15803d', veterinario: '#0891b2', recepcionista: '#7c3aed' };
const ROL_LABEL: Record<string, string> = { admin: 'Administrador', veterinario: 'Veterinario', recepcionista: 'Recepcionista' };

// ── FORM USUARIO ───────────────────────────────────────────────────────────────
const FormUsuario = ({ clinicaId, usuarioActual, usuario, onSave, onClose, tema }: {
  clinicaId: string; usuarioActual: Usuario; usuario?: UsuarioExt;
  onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const esEdicion = !!usuario;
  const [form, setForm] = useState({
    nombre: usuario?.nombre || '',
    email:  usuario?.email  || '',
    rol:    usuario?.rol    || 'veterinario',
    password: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!form.nombre.trim())  { setError('El nombre es obligatorio.'); return; }
    if (!esEdicion) {
      if (!form.email.trim()) { setError('El email es obligatorio.'); return; }
      if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
      if (form.password !== form.confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    }
    setSaving(true); setError('');

    if (esEdicion) {
      // Solo edita nombre y rol en la tabla usuarios
      const { error: dbErr } = await supabase
        .from('usuarios').update({ nombre: form.nombre.trim(), rol: form.rol }).eq('id', usuario!.id);
      if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    } else {
      // Crear usuario en Auth + tabla usuarios
      const { data, error: authErr } = await supabase.auth.admin.createUser({
        email: form.email.trim(),
        password: form.password,
        email_confirm: true,
      });
      if (authErr || !data.user) {
        // Fallback: usar signUp si no hay permisos de admin
        const { data: su, error: suErr } = await supabase.auth.signUp({
          email: form.email.trim(), password: form.password,
        });
        if (suErr || !su.user) { setError(suErr?.message || 'Error al crear usuario en Auth.'); setSaving(false); return; }
        const { error: dbErr } = await supabase.from('usuarios').insert({
          id: su.user.id, clinica_id: clinicaId,
          nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol, activo: true,
        });
        if (dbErr) { setError(dbErr.message); setSaving(false); return; }
      } else {
        const { error: dbErr } = await supabase.from('usuarios').insert({
          id: data.user.id, clinica_id: clinicaId,
          nombre: form.nombre.trim(), email: form.email.trim(), rol: form.rol, activo: true,
        });
        if (dbErr) { setError(dbErr.message); setSaving(false); return; }
      }
    }
    onSave(); onClose();
  };

  return (
    <div>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171', marginBottom: '15px' }}>{error}</div>}
      {!esEdicion && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '16px', fontSize: '13px', color: tema.textMuted }}>
          ℹ️ El usuario recibirá un email de confirmación. Una vez confirmado podrá ingresar a la plataforma.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Nombre completo *</label>
          <input style={S.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Dra. María García" />
        </div>
        {!esEdicion && (
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Email *</label>
            <input type="email" style={S.input} value={form.email} onChange={e => set('email', e.target.value)} placeholder="usuario@clinica.com" />
          </div>
        )}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Rol</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>
            {ROLES.map(r => (
              <button key={r} onClick={() => set('rol', r)}
                disabled={r === 'admin' && usuarioActual.rol !== 'admin'}
                style={{ padding: '10px', border: `1px solid ${form.rol === r ? ROL_COLOR[r] : tema.border}`, borderRadius: '8px', cursor: 'pointer', background: form.rol === r ? ROL_COLOR[r] + '22' : 'transparent', color: form.rol === r ? ROL_COLOR[r] : tema.textMuted, fontWeight: 'bold', fontSize: '13px', opacity: r === 'admin' && usuarioActual.rol !== 'admin' ? 0.4 : 1 }}>
                {ROL_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
        {!esEdicion && (
          <>
            <div>
              <label style={S.label}>Contraseña *</label>
              <input type="password" style={S.input} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Mín. 6 caracteres" />
            </div>
            <div>
              <label style={S.label}>Confirmar contraseña *</label>
              <input type="password" style={S.input} value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repetir contraseña" />
            </div>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : esEdicion ? '💾 GUARDAR CAMBIOS' : '👤 CREAR USUARIO'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── SECCIÓN USUARIOS ───────────────────────────────────────────────────────────
const SeccionUsuarios = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioExt[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioExt | null>(null);

  const esAdmin = usuario.rol === 'admin';

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('usuarios').select('*')
      .eq('clinica_id', usuario.clinica_id)
      .order('nombre');
    setUsuarios((data || []) as UsuarioExt[]);
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (u: UsuarioExt) => {
    if (u.id === usuario.id) return; // no desactivarse a sí mismo
    const { error } = await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id);
    if (error) { toast('Error al cambiar estado del usuario', 'error'); return; }
    toast(u.activo ? 'Usuario desactivado' : 'Usuario activado', 'success');
    cargar();
  };

  if (!esAdmin) return (
    <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
      <p style={{ fontSize: '48px', margin: '0 0 16px' }}>🔒</p>
      <h3 style={{ color: tema.text, margin: '0 0 8px' }}>Acceso restringido</h3>
      <p style={{ color: tema.textMuted, fontSize: '14px' }}>Solo los administradores pueden gestionar usuarios.</p>
    </div>
  );

  const activos   = usuarios.filter(u => u.activo !== false);
  const inactivos = usuarios.filter(u => u.activo === false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {[
          { label: 'Total usuarios',  val: usuarios.length,   color: '#22c55e' },
          { label: 'Activos',         val: activos.length,    color: '#22c55e' },
          { label: 'Inactivos',       val: inactivos.length,  color: '#f87171' },
          { label: 'Administradores', val: usuarios.filter(u => u.rol === 'admin').length, color: '#15803d' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: 'center', borderColor: color + '44' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barra */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setModalNuevo(true)} style={{ ...S.btnPrimary, whiteSpace: 'nowrap' }}>👤 Nuevo usuario</button>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Usuario', 'Email', 'Rol', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>Sin usuarios registrados.</td></tr>
              )}
              {usuarios.map(u => {
                const esPropioUsuario = u.id === usuario.id;
                const activo = u.activo !== false;
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${tema.border}`, opacity: activo ? 1 : 0.5 }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: ROL_COLOR[u.rol] + '33', border: `1px solid ${ROL_COLOR[u.rol]}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', color: ROL_COLOR[u.rol] }}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: 'bold', color: tema.text, fontSize: '14px' }}>{u.nombre}</p>
                          {esPropioUsuario && <span style={{ fontSize: '10px', color: '#22c55e' }}>● Vos</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: tema.textMuted }}>{u.email}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '11px', background: ROL_COLOR[u.rol], padding: '3px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>
                        {ROL_LABEL[u.rol] || u.rol}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '11px', background: activo ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)', color: activo ? '#22c55e' : '#f87171', border: `1px solid ${activo ? 'rgba(34,197,94,0.3)' : 'rgba(248,113,113,0.3)'}`, padding: '3px 10px', borderRadius: '99px', fontWeight: 'bold' }}>
                        {activo ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setUsuarioEditar(u)}
                          style={{ padding: '5px 12px', background: 'transparent', color: '#6daa7f', border: `1px solid ${tema.border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                          ✏️ Editar
                        </button>
                        {!esPropioUsuario && (
                          <button onClick={() => toggleActivo(u)}
                            style={{ padding: '5px 12px', background: 'transparent', color: activo ? '#f87171' : '#22c55e', border: `1px solid ${activo ? '#f87171' : '#22c55e'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                            {activo ? '🚫 Desactivar' : '✅ Activar'}
                          </button>
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

      {/* Info roles */}
      <div style={{ ...S.card }}>
        <h4 style={{ margin: '0 0 14px', color: tema.text, textAlign: 'center' }}>ℹ️ Permisos por rol</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {[
            { rol: 'admin', desc: 'Acceso total. Puede gestionar usuarios, ver reportes financieros, editar precios y administrar toda la plataforma.' },
            { rol: 'veterinario', desc: 'Acceso clínico completo. Pacientes, turnos, intervenciones, cirugías y recetas. Sin acceso a finanzas.' },
            { rol: 'recepcionista', desc: 'Gestión de turnos y propietarios. Puede registrar cobros pero no ve reportes ni gestiona usuarios.' },
          ].map(({ rol, desc }) => (
            <div key={rol} style={{ background: tema.bgInput, padding: '14px', borderRadius: '8px', border: `1px solid ${ROL_COLOR[rol]}33` }}>
              <span style={{ fontSize: '11px', background: ROL_COLOR[rol], padding: '2px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>{ROL_LABEL[rol]}</span>
              <p style={{ margin: '10px 0 0', fontSize: '13px', color: tema.textMuted, lineHeight: '1.5' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {modalNuevo && (
        <Modal titulo="👤 Nuevo Usuario" onClose={() => setModalNuevo(false)} tema={tema}>
          <FormUsuario clinicaId={usuario.clinica_id} usuarioActual={usuario}
            onSave={cargar} onClose={() => setModalNuevo(false)} tema={tema} />
        </Modal>
      )}
      {usuarioEditar && (
        <Modal titulo={`✏️ Editar — ${usuarioEditar.nombre}`} onClose={() => setUsuarioEditar(null)} tema={tema}>
          <FormUsuario clinicaId={usuario.clinica_id} usuarioActual={usuario}
            usuario={usuarioEditar} onSave={cargar} onClose={() => setUsuarioEditar(null)} tema={tema} />
        </Modal>
      )}
    </div>
  );
};

export default SeccionUsuarios;
