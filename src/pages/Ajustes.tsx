import { useState } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj, Tema } from '../styles/theme';
import { useToast } from '../components/toast';

interface AjustesProps {
  usuario: Usuario;
  tema: TemaObj;
  temaKey: Tema;
  onCambiarTema: (t: Tema) => void;
}

const SeccionAjustes = ({ usuario, tema, temaKey, onCambiarTema }: AjustesProps) => {
  const S = makeS(tema);
  const { toast } = useToast();

  // Contraseña
  const [passNueva, setPassNueva] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  // Preferencias (guardadas en localStorage)
  const [umbralStock, setUmbralStock] = useState<number>(
    () => parseInt(localStorage.getItem('valvet-umbral-stock') || '5')
  );
  const [notificaciones, setNotificaciones] = useState<boolean>(
    () => localStorage.getItem('valvet-notificaciones') !== 'false'
  );
  const [matricula, setMatricula] = useState<string>(
    () => localStorage.getItem(`valvet-matricula-${usuario.id}`) || ''
  );

  const cambiarPassword = async () => {
    if (passNueva.length < 6) {
      toast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }
    if (passNueva !== passConfirm) {
      toast('Las contraseñas no coinciden', 'warning');
      return;
    }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: passNueva });
    if (error) { toast('Error: ' + error.message, 'error'); setSavingPass(false); return; }
    toast('Contraseña actualizada correctamente', 'success');
    setPassNueva(''); setPassConfirm('');
    setSavingPass(false);
  };

  const guardarPreferencias = () => {
    localStorage.setItem('valvet-umbral-stock', umbralStock.toString());
    localStorage.setItem('valvet-notificaciones', notificaciones.toString());
    localStorage.setItem(`valvet-matricula-${usuario.id}`, matricula);
    toast('Preferencias guardadas', 'success');
  };

  const seccionStyle: React.CSSProperties = {
    ...S.card, display: 'flex', flexDirection: 'column', gap: '18px'
  };

  const tituloSeccion: React.CSSProperties = {
    margin: '0 0 4px', fontSize: '11px', color: tema.textMuted,
    letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: '500'
  };

  const toggleStyle = (activo: boolean): React.CSSProperties => ({
    position: 'relative', width: '44px', height: '24px',
    background: activo ? '#2d5a2d' : '#2a2a2a',
    border: `1px solid ${activo ? '#3a6e3a' : '#333'}`,
    borderRadius: '99px', cursor: 'pointer', transition: 'background 0.2s',
    flexShrink: 0,
  });

  const toggleKnobStyle = (activo: boolean): React.CSSProperties => ({
    position: 'absolute', top: '3px',
    left: activo ? '22px' : '3px',
    width: '16px', height: '16px',
    background: activo ? '#5a9e5a' : '#555',
    borderRadius: '50%', transition: 'left 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px' }}>

      {/* Encabezado */}
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '600', color: tema.text }}>
          Ajustes
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: tema.textMuted }}>
          Preferencias personales — se guardan en este dispositivo
        </p>
      </div>

      {/* Apariencia */}
      <div style={seccionStyle}>
        <p style={tituloSeccion}>Apariencia</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '14px', color: tema.text, fontWeight: '500' }}>
              Tema de la interfaz
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>
              {temaKey === 'dark' ? 'Modo oscuro activo' : 'Modo claro activo'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { onCambiarTema('dark'); localStorage.setItem('valvet-tema', 'dark'); }}
              style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', border: `1px solid ${temaKey === 'dark' ? '#3a6e3a' : tema.border}`, background: temaKey === 'dark' ? '#1a2a1a' : 'transparent', color: temaKey === 'dark' ? '#5a9e5a' : tema.textMuted }}>
              Oscuro
            </button>
            <button
              onClick={() => { onCambiarTema('light'); localStorage.setItem('valvet-tema', 'light'); }}
              style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', border: `1px solid ${temaKey === 'light' ? '#3a6e3a' : tema.border}`, background: temaKey === 'light' ? '#1a2a1a' : 'transparent', color: temaKey === 'light' ? '#5a9e5a' : tema.textMuted }}>
              Claro
            </button>
          </div>
        </div>
      </div>

      {/* Notificaciones y stock */}
      <div style={seccionStyle}>
        <p style={tituloSeccion}>Notificaciones y stock</p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '14px', color: tema.text, fontWeight: '500' }}>
              Alertas de stock al iniciar sesión
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>
              Notificaciones automáticas de productos con stock bajo
            </p>
          </div>
          <div style={toggleStyle(notificaciones)} onClick={() => setNotificaciones(!notificaciones)}>
            <div style={toggleKnobStyle(notificaciones)} />
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${tema.border}`, paddingTop: '16px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '14px', color: tema.text, fontWeight: '500' }}>
            Umbral de stock bajo
          </p>
          <p style={{ margin: '0 0 12px', fontSize: '12px', color: tema.textMuted }}>
            Se alertará cuando un producto tenga esta cantidad o menos
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number" min="1" max="50" value={umbralStock}
              onChange={e => setUmbralStock(parseInt(e.target.value) || 5)}
              style={{ ...S.input, width: '100px', textAlign: 'center', fontSize: '18px', fontWeight: '600' }}
            />
            <span style={{ fontSize: '13px', color: tema.textMuted }}>unidades o menos</span>
          </div>
        </div>
      </div>

      {/* Matrícula */}
      <div style={seccionStyle}>
        <p style={tituloSeccion}>Datos profesionales</p>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: '14px', color: tema.text, fontWeight: '500' }}>
            Matrícula veterinaria
          </p>
          <p style={{ margin: '0 0 10px', fontSize: '12px', color: tema.textMuted }}>
            Se imprime automáticamente en las recetas
          </p>
          <input
            style={{ ...S.input, maxWidth: '280px' }}
            value={matricula}
            onChange={e => setMatricula(e.target.value)}
            placeholder="Ej: MV 12345"
          />
        </div>
      </div>

      {/* Botón guardar preferencias */}
      <button onClick={guardarPreferencias}
        style={{ ...S.btnPrimary, alignSelf: 'flex-start', padding: '11px 28px' }}>
        Guardar preferencias
      </button>

      {/* Cambiar contraseña */}
      <div style={{ ...seccionStyle, borderTop: `1px solid ${tema.border}`, paddingTop: '24px' }}>
        <p style={tituloSeccion}>Seguridad</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Nueva contraseña</label>
            <input type="password" style={S.input} value={passNueva}
              onChange={e => setPassNueva(e.target.value)}
              placeholder="Mín. 6 caracteres" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={S.label}>Confirmar nueva contraseña</label>
            <input type="password" style={S.input} value={passConfirm}
              onChange={e => setPassConfirm(e.target.value)}
              placeholder="Repetir contraseña" />
          </div>
        </div>
        <button onClick={cambiarPassword} disabled={savingPass}
          style={{ ...S.btnGhost, alignSelf: 'flex-start', padding: '10px 24px', opacity: savingPass ? 0.6 : 1, borderColor: '#3a3a3a', color: '#888' }}>
          {savingPass ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </div>

    </div>
  );
};

export default SeccionAjustes;
