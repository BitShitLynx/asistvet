import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from './supabaseClient';
import type { Usuario } from './supabaseClient';
import { TEMAS } from './styles/theme';
import type { Tema } from './styles/theme';
import { VALVET_LOGO, LYNX_LOGO } from './styles/theme';
import { ToastProvider, useToast } from './components/toast';

const PantallaLogin         = lazy(() => import('./pages/Login'));
const PantallaInicio        = lazy(() => import('./pages/Inicio'));
const SeccionPacientes      = lazy(() => import('./pages/Pacientes'));
const SeccionPropietarios   = lazy(() => import('./pages/Propietarios'));
const SeccionIntervenciones = lazy(() => import('./pages/Intervenciones'));
const SeccionInventario     = lazy(() => import('./pages/Inventario'));
const SeccionTurnos         = lazy(() => import('./pages/Turnos'));
const SeccionFacturacion    = lazy(() => import('./pages/Facturacion'));
const SeccionRecetas        = lazy(() => import('./pages/Recetas'));
const SeccionCirugias       = lazy(() => import('./pages/Cirugias'));
const SeccionGastos         = lazy(() => import('./pages/Gastos'));
const SeccionReportes       = lazy(() => import('./pages/Reportes'));
const SeccionUsuarios       = lazy(() => import('./pages/Usuarios'));
const AdminLynx             = lazy(() => import('./pages/AdminLynx'));
const SeccionAjustes        = lazy(() => import('./pages/Ajustes'));

// ── Alertas de stock bajo al iniciar sesión ───────────────────────────────────
const StockAlertInit = ({ productos }: { productos: {nombre: string; stock_actual: number; unidad: string}[] }) => {
  const { toast } = useToast();
  useEffect(() => {
    const primeros = productos.slice(0, 3);
    const restantes = productos.length - 3;

    primeros.forEach((p, i) => {
      setTimeout(() => {
        toast(
          p.stock_actual === 0
            ? `Sin stock: ${p.nombre}`
            : `Stock bajo: ${p.nombre} — ${p.stock_actual} ${p.unidad}`,
          p.stock_actual === 0 ? 'error' : 'warning'
        );
      }, i * 500);
    });

    if (restantes > 0) {
      setTimeout(() => {
        toast(
          `${restantes} producto${restantes > 1 ? 's' : ''} más con stock crítico — revisá Inventario`,
          'warning'
        );
      }, 3 * 500 + 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

// ── Pantalla cambio de contraseña (recovery link) ─────────────────────────────
const PantallaRecuperacion = ({ onDone }: { onDone: () => void }) => {
  const { toast } = useToast();
  const [nuevaPassword, setNuevaPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving]                   = useState(false);

  const handleCambiar = async () => {
    if (nuevaPassword.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }
    if (nuevaPassword !== confirmPassword) { toast('Las contraseñas no coinciden', 'warning'); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
    if (error) { toast('Error: ' + error.message, 'error'); setSaving(false); return; }
    await supabase.auth.signOut();
    window.location.hash = '';
    toast('Contraseña actualizada. Ingresá con tu nueva contraseña.', 'success');
    setSaving(false);
    onDone();
  };

  const inputStyle: React.CSSProperties = { background: '#0f0f0f', color: '#c8c8c8', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '10px 12px', width: '100%', boxSizing: 'border-box', fontSize: '14px' };
  const labelStyle: React.CSSProperties = { fontSize: '11px', color: '#444', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src={VALVET_LOGO} alt="ValVet" style={{ width: '200px', objectFit: 'contain', filter: 'invert(1) brightness(0.88)', display: 'inline-block' }} />
        </div>
        <div style={{ background: '#141414', border: '1px solid #222', borderRadius: '10px', padding: '32px 28px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Nueva contraseña</p>
          <h2 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: '600', color: '#d0d0d0' }}>Restablecer contraseña</h2>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Nueva contraseña</label>
            <input type="password" value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)} style={inputStyle} placeholder="Mín. 6 caracteres" />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>Confirmar contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCambiar()} style={inputStyle} placeholder="Repetir contraseña" />
          </div>
          <button onClick={handleCambiar} disabled={saving}
            style={{ width: '100%', padding: '13px', background: saving ? '#1a2a1a' : '#2d5a2d', color: '#7ab87a', border: '1px solid #3a6e3a', borderRadius: '6px', fontWeight: '500', cursor: saving ? 'default' : 'pointer', fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>
            {saving ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </div>
        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '11px', color: '#2a2a2a', letterSpacing: '0.06em' }}>powered by Lynx</p>
      </div>
    </div>
  );
};

const App = () => {
  const [usuario, setUsuario]           = useState<Usuario | null>(null);
  const [vista, setVista]               = useState<string>(
    () => localStorage.getItem('valvet-vista') || 'inicio'
  );
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [temaKey, setTemaKey]           = useState<Tema>(
    () => (localStorage.getItem('valvet-tema') as Tema) || 'dark'
  );
  const [clinicaNombre, setClinicaNombre] = useState<string>('');
  const [stockAlertas, setStockAlertas] = useState<{nombre: string; stock_actual: number; unidad: string}[]>([]);
  const [modoRecuperacion, setModoRecuperacion] = useState(false);

  const tema = TEMAS[temaKey];

  useEffect(() => {
    // Detectar si viene de un link de recuperación de contraseña
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setModoRecuperacion(true);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
        if (data) {
          setUsuario(data as Usuario);
          const { data: clinica } = await supabase
            .from('clinicas').select('nombre')
            .eq('id', data.clinica_id).single();
          if (clinica) setClinicaNombre(clinica.nombre);
          const { data: productosConPocoStock } = await supabase
            .from('productos')
            .select('nombre, stock_actual, unidad')
            .eq('clinica_id', data.clinica_id)
            .eq('activo', true)
            .lte('stock_actual', 5)
            .order('stock_actual', { ascending: true });
          if (productosConPocoStock && productosConPocoStock.length > 0) {
            setStockAlertas(productosConPocoStock);
          }
        }
      }
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) setUsuario(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const navegarA = (v: string) => { localStorage.setItem('valvet-vista', v); setVista(v); };

  const logout = async () => { await supabase.auth.signOut(); localStorage.removeItem('valvet-vista'); setUsuario(null); setVista('inicio'); };

  if (checkingAuth) return (
    <div style={{ minHeight: '100vh', background: TEMAS.dark.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#555', fontSize: '13px', letterSpacing: '0.06em' }}>Verificando sesión...</p>
    </div>
  );

  if (!usuario) return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: TEMAS.dark.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#555', fontSize: '13px', letterSpacing: '0.06em' }}>Cargando...</p></div>}>
      <PantallaLogin onLogin={u => { setUsuario(u); navegarA('inicio'); }} />
    </Suspense>
  );

  const ROL_BADGE: Record<string, { bg: string; color: string; border: string }> = {
    admin:         { bg: '#1a2a1a', color: '#5a9e5a', border: '#2d5a2d' },
    veterinario:   { bg: '#1a1e2a', color: '#5a7aae', border: '#2d3a6a' },
    recepcionista: { bg: '#2a1a2a', color: '#8a5aae', border: '#5a2d7a' },
  };

  const NAV_GRUPOS = [
    {
      label: 'Clínica',
      items: [
        { key: 'inicio',         label: 'Inicio' },
        { key: 'turnos',         label: 'Turnos' },
        { key: 'pacientes',      label: 'Pacientes' },
        { key: 'propietarios',   label: 'Propietarios' },
        { key: 'intervenciones', label: 'Intervenciones' },
        { key: 'cirugias',       label: 'Cirugías' },
        { key: 'recetas',        label: 'Recetas' },
        { key: 'stock',          label: 'Inventario' },
      ],
    },
    {
      label: 'Administración',
      items: [
        { key: 'facturacion', label: 'Facturación' },
        { key: 'gastos',      label: 'Gastos' },
        { key: 'reportes',    label: 'Reportes' },
        { key: 'usuarios',    label: 'Usuarios' },
        { key: 'ajustes',     label: 'Ajustes' },
        ...(usuario.email === 'marianonicolasmontano@gmail.com' ? [{ key: 'admin_lynx', label: 'Admin Lynx' }] : []),
      ],
    },
  ];

  const vistaLabel = NAV_GRUPOS.flatMap(g => g.items).find(n => n.key === vista)?.label || '';
  const breadcrumb = vista === 'inicio' ? ['Inicio'] : ['Inicio', vistaLabel];
  const rolStyle   = ROL_BADGE[usuario.rol] || ROL_BADGE.recepcionista;
  const iniciales  = usuario.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <ToastProvider>
    {modoRecuperacion && <PantallaRecuperacion onDone={() => setModoRecuperacion(false)} />}
    {stockAlertas.length > 0 && <StockAlertInit productos={stockAlertas} />}
    {!modoRecuperacion && <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: tema.bg, color: tema.text, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* SIDEBAR */}
      <aside style={{ width: '220px', background: '#0f0f0f', padding: '24px 16px', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

        {/* Logo ValVet */}
        <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #1e1e1e', textAlign: 'center' }}>
          <img src={VALVET_LOGO} alt="ValVet"
            style={{ width: '170px', objectFit: 'contain', filter: 'invert(1) brightness(0.88)', display: 'inline-block', verticalAlign: 'bottom' }} />
        </div>

        {/* Usuario */}
        <div style={{ marginBottom: '16px', padding: '12px 14px', background: '#141414', borderRadius: '8px', border: '1px solid #1e1e1e', textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: rolStyle.bg, border: `1px solid ${rolStyle.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: rolStyle.color, margin: '0 auto 10px', letterSpacing: '0.04em' }}>
            {iniciales}
          </div>
          <p style={{ margin: '0 0 7px', fontSize: '14px', fontWeight: '600', color: '#c8c8c8', letterSpacing: '0.01em' }}>{usuario.nombre}</p>
          <span style={{ fontSize: '11px', background: rolStyle.bg, color: rolStyle.color, border: `1px solid ${rolStyle.border}`, padding: '2px 10px', borderRadius: '3px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: '500' }}>{usuario.rol}</span>
          {clinicaNombre && (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#888', letterSpacing: '0.04em', borderTop: '1px solid #1e1e1e', paddingTop: '8px' }}>
              {clinicaNombre}
            </p>
          )}
        </div>

        {/* Nav agrupada */}
        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {NAV_GRUPOS.map(grupo => (
            <div key={grupo.label} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase' as const, padding: '0 12px', marginBottom: '8px', fontWeight: '500' }}>{grupo.label}</div>
              {grupo.items.map(({ key, label }) => (
                <button key={key} onClick={() => navegarA(key)}
                  style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: '5px', textAlign: 'left', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.02em', marginBottom: '1px', background: vista === key ? '#1a2a1a' : 'transparent', color: vista === key ? '#5a9e5a' : '#aaaaaa', borderLeft: vista === key ? '2px solid #5a9e5a' : '2px solid transparent', fontWeight: vista === key ? '500' : '400' }}
                  onMouseEnter={e => { if (vista !== key) { (e.currentTarget as HTMLButtonElement).style.background = '#181818'; (e.currentTarget as HTMLButtonElement).style.color = '#aaa'; } }}
                  onMouseLeave={e => { if (vista !== key) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa'; } }}
                >{label}</button>
              ))}
            </div>
          ))}
        </nav>

        {/* Cerrar sesión */}
        <button onClick={logout}
          style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #333333', borderRadius: '5px', color: '#888888', cursor: 'pointer', fontSize: '13px', letterSpacing: '0.05em', marginTop: '8px' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#cccccc'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#555555'; (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888888'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#333333'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >Cerrar sesión</button>

        {/* Logo Lynx */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: 'transparent' }}>
          <img src={LYNX_LOGO} alt="Lynx"
            style={{ width: '96px', height: '96px', objectFit: 'contain', opacity: 0.7 }} />
          <span style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>powered by Lynx</span>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOPBAR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', background: tema.bgCard, borderBottom: `1px solid ${tema.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            {breadcrumb.map((b, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {i > 0 && <span style={{ color: tema.textMuted, fontSize: '12px' }}>›</span>}
                <span
                  style={{ color: i === breadcrumb.length - 1 ? tema.text : tema.textMuted, cursor: i === 0 && vista !== 'inicio' ? 'pointer' : 'default', fontWeight: i === breadcrumb.length - 1 ? '500' : '400', letterSpacing: '0.02em' }}
                  onClick={() => i === 0 && vista !== 'inicio' && navegarA('inicio')}
                >{b}</span>
              </span>
            ))}
          </div>
          <button onClick={() => setTemaKey(k => {
              const nuevo = k === 'dark' ? 'light' : 'dark';
              localStorage.setItem('valvet-tema', nuevo);
              return nuevo;
            })}
            style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${tema.border}`, borderRadius: '5px', cursor: 'pointer', fontSize: '12px', color: tema.textMuted, letterSpacing: '0.05em' }}>
            {temaKey === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </header>

        {/* CONTENIDO */}
        <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}><p style={{ color: tema.textMuted, fontSize: '13px', letterSpacing: '0.06em' }}>Cargando...</p></div>}>
            {vista === 'inicio'         && <PantallaInicio        usuario={usuario} onNavegar={navegarA} tema={tema} />}
            {vista === 'turnos'         && <SeccionTurnos         usuario={usuario} tema={tema} />}
            {vista === 'pacientes'      && <SeccionPacientes      usuario={usuario} tema={tema} />}
            {vista === 'propietarios'   && <SeccionPropietarios   usuario={usuario} tema={tema} />}
            {vista === 'intervenciones' && <SeccionIntervenciones usuario={usuario} tema={tema} />}
            {vista === 'cirugias'       && <SeccionCirugias       usuario={usuario} tema={tema} />}
            {vista === 'recetas'        && <SeccionRecetas        usuario={usuario} tema={tema} />}
            {vista === 'stock'          && <SeccionInventario     usuario={usuario} tema={tema} />}
            {vista === 'facturacion'    && <SeccionFacturacion    usuario={usuario} tema={tema} />}
            {vista === 'gastos'         && <SeccionGastos         usuario={usuario} tema={tema} />}
            {vista === 'reportes'       && <SeccionReportes       usuario={usuario} tema={tema} />}
            {vista === 'usuarios'       && <SeccionUsuarios       usuario={usuario} tema={tema} />}
            {vista === 'ajustes'        && <SeccionAjustes        usuario={usuario} tema={tema} temaKey={temaKey} onCambiarTema={k => { setTemaKey(k); localStorage.setItem('valvet-tema', k); }} />}
            {vista === 'admin_lynx'     && <AdminLynx             usuario={usuario} tema={tema} />}
          </Suspense>
        </main>
      </div>
    </div>}
    </ToastProvider>
  );
};

export default App;
