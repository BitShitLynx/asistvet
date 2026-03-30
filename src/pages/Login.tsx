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

  const handleLogin = async () => {
    setError(''); setLoading(true);
    const { data, error: ae } = await supabase.auth.signInWithPassword({ email, password });
    if (ae || !data.user) { setError('Email o contraseña incorrectos.'); setLoading(false); return; }
    const { data: u } = await supabase.from('usuarios').select('*').eq('id', data.user.id).single();
    if (!u) { setError('Usuario no encontrado en el sistema.'); setLoading(false); return; }
    onLogin(u as Usuario);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src={VALVET_LOGO} alt="ValVet"
            style={{ width: '260px', objectFit: 'contain', filter: 'invert(1) brightness(0.88)', display: 'inline-block', verticalAlign: 'bottom' }} />
          <p style={{ margin: '14px 0 0', fontSize: '12px', color: '#666666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sistema de Gestión Veterinaria</p>
        </div>

        {/* Card login */}
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
            style={{ width: '100%', padding: '13px', background: loading ? '#1a2a1a' : '#2d5a2d', color: '#7ab87a', border: '1px solid #3a6e3a', borderRadius: '6px', fontWeight: '500', cursor: loading ? 'default' : 'pointer', fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {loading ? 'Verificando...' : 'Ingresar'}
          </button>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '11px', color: '#666666', letterSpacing: '0.06em' }}>
          powered by Lynx
        </p>
      </div>
    </div>
  );
};

export default PantallaLogin;
