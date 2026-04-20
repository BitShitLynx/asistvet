import { useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { TEMAS, makeS } from '../styles/theme';
import { VALVET_LOGO } from '../styles/theme';

const PantallaLogin = ({ onLogin }: { onLogin: (u: Usuario) => void }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const S = makeS(TEMAS.dark);

  const [modoRecuperar, setModoRecuperar]         = useState(false);
  const [emailRecuperar, setEmailRecuperar]       = useState('');
  const [mensajeRecuperar, setMensajeRecuperar]   = useState('');
  const [loadingRecuperar, setLoadingRecuperar]   = useState(false);

  const handleLogin = async () => {
    setError(''); setLoading(true);
    const { data, error: ae } = await supabase.auth.signInWithPassword({ email, password });
    if (ae || !data.user) { setError('Email o contraseña incorrectos.'); setLoading(false); return; }
    const { data: u } = await supabase.from('usuarios').select('*').eq('id', data.user.id).single();
    if (!u) { setError('Usuario no encontrado en el sistema.'); setLoading(false); return; }
    onLogin(u as Usuario);
    setLoading(false);
  };

  const handleRecuperar = async () => {
    if (!emailRecuperar.trim()) return;
    setLoadingRecuperar(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      emailRecuperar.trim(),
      { redirectTo: window.location.origin }
    );
    setLoadingRecuperar(false);
    if (error) {
      setMensajeRecuperar('Error al enviar el email. Verificá la dirección.');
    } else {
      setMensajeRecuperar('Si el email existe, recibirás un enlace para restablecer tu contraseña.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src={VALVET_LOGO} alt="ValVet"
            style={{ width: '260px', objectFit: 'contain', filter: 'invert(1) brightness(0.88)', display: 'inline-block', verticalAlign: 'bottom' }} />
          <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#666666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>AsistVet · Gestión Veterinaria</p>
        </div>

        {!modoRecuperar ? (
          /* Card login */
          <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '32px 28px' }}>
            {error && (
              <div style={{ background: '#200a0a', border: '1px solid #5a2020', borderRadius: '6px', padding: '10px 14px', color: '#c07070', marginBottom: '20px', fontSize: '13px', letterSpacing: '0.02em' }}>
                {error}
              </div>
            )}
            <div style={{ marginBottom: '18px' }}>
              <label style={S.label}>Email</label>
              <input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...S.input, background: '#0f0f0f', border: '1px solid #2a2a2a', color: '#c8c8c8' }}
                placeholder="usuario@clinica.com" />
            </div>
            <div style={{ marginBottom: '28px' }}>
              <label style={S.label}>Contraseña</label>
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...S.input, background: '#0f0f0f', border: '1px solid #2a2a2a', color: '#c8c8c8' }}
                placeholder="••••••••" />
            </div>
            <button onClick={handleLogin} disabled={loading}
              style={{ width: '100%', padding: '13px', background: loading ? '#1e1333' : '#5B21B6', color: '#EDE9FE', border: '1px solid #6D28D9', borderRadius: '6px', fontWeight: '500', cursor: loading ? 'default' : 'pointer', fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <button
              onClick={() => setModoRecuperar(true)}
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', marginTop: '12px', width: '100%', letterSpacing: '0.04em' }}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        ) : (
          /* Card recuperar contraseña */
          <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '32px 28px' }}>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#888' }}>
              Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
            </p>
            {mensajeRecuperar && (
              <div style={{
                background: mensajeRecuperar.includes('Error') ? '#200a0a' : '#0a2010',
                border: `1px solid ${mensajeRecuperar.includes('Error') ? '#5a2020' : '#2d5a2d'}`,
                borderRadius: '6px', padding: '10px 14px',
                color: mensajeRecuperar.includes('Error') ? '#c07070' : '#7ab87a',
                marginBottom: '16px', fontSize: '13px'
              }}>
                {mensajeRecuperar}
              </div>
            )}
            <label style={S.label}>Email</label>
            <input
              type="email"
              value={emailRecuperar}
              onChange={e => setEmailRecuperar(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRecuperar()}
              style={{ ...S.input, background: '#0f0f0f', border: '1px solid #2a2a2a', color: '#c8c8c8', marginBottom: '20px' }}
              placeholder="tu@email.com"
            />
            <button
              onClick={handleRecuperar}
              disabled={loadingRecuperar}
              style={{ width: '100%', padding: '13px', background: '#2d5a2d', color: '#7ab87a', border: '1px solid #3a6e3a', borderRadius: '6px', fontWeight: '500', cursor: 'pointer', fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: loadingRecuperar ? 0.6 : 1 }}>
              {loadingRecuperar ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <button
              onClick={() => { setModoRecuperar(false); setMensajeRecuperar(''); }}
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px', marginTop: '12px', width: '100%', letterSpacing: '0.04em' }}>
              ← Volver al inicio de sesión
            </button>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '11px', color: '#666666', letterSpacing: '0.06em' }}>
          powered by Lynx
        </p>
      </div>
    </div>
  );
};

export default PantallaLogin;
