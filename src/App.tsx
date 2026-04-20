import React, { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from './supabaseClient';
import type { Usuario } from './supabaseClient';
import { TEMAS } from './styles/theme';
import type { Tema } from './styles/theme';
import { VALVET_LOGO, LYNX_LOGO } from './styles/theme';
import { ToastProvider, useToast } from './components/toast';

const PantallaLogin         = lazy(() => import('./pages/Login'));

// ── Hook para detectar ancho de pantalla ──────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}
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
const SeccionGrooming       = lazy(() => import('./pages/Grooming'));

// ── Modal de alerta de stock ──────────────────────────────────────────────────
const StockAlertModal = ({ sinStock, stockBajo, onClose, onVerInventario }: {
  sinStock: number; stockBajo: number; total: number;
  onClose: () => void; onVerInventario: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: '#141414', border: '1px solid #5a3a00',
        borderRadius: '12px', padding: '28px 32px',
        maxWidth: '380px', width: '100%', textAlign: 'center',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#2a1a00', border: '1px solid #8a6a00',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '22px',
        }}>⚠</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '600', color: '#d0d0d0' }}>
          Alerta de stock
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#888', lineHeight: '1.6' }}>
          {sinStock > 0 && (
            <span style={{ color: '#c07070', display: 'block' }}>
              {sinStock} producto{sinStock > 1 ? 's' : ''} sin stock
            </span>
          )}
          {stockBajo > 0 && (
            <span style={{ color: '#c0a040', display: 'block' }}>
              {stockBajo} producto{stockBajo > 1 ? 's' : ''} con stock bajo
            </span>
          )}
        </p>
        <div style={{ width: '100%', height: '3px', background: '#2a2a2a', borderRadius: '99px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#8a6a00', borderRadius: '99px', animation: 'shrink 4s linear forwards' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onVerInventario}
            style={{ flex: 1, padding: '11px', background: '#1a2a1a', border: '1px solid #2d5a2d', borderRadius: '6px', color: '#5a9e5a', cursor: 'pointer', fontSize: '13px', fontWeight: '500', letterSpacing: '0.03em' }}>
            Ver inventario
          </button>
          <button onClick={onClose}
            style={{ padding: '11px 20px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#555', cursor: 'pointer', fontSize: '13px' }}>
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
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
          <img src={VALVET_LOGO} alt="AsistVet" style={{ width: '200px', objectFit: 'contain', filter: 'none', display: 'inline-block' }} />
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

const PERMISOS: Record<string, string[]> = {
  inicio:         ['admin', 'veterinario', 'recepcionista'],
  turnos:         ['admin', 'veterinario', 'recepcionista'],
  pacientes:      ['admin', 'veterinario', 'recepcionista'],
  propietarios:   ['admin', 'veterinario', 'recepcionista'],
  intervenciones: ['admin', 'veterinario'],
  cirugias:       ['admin', 'veterinario'],
  recetas:        ['admin', 'veterinario'],
  stock:          ['admin', 'veterinario'],
  facturacion:    ['admin', 'recepcionista'],
  gastos:         ['admin'],
  reportes:       ['admin'],
  usuarios:       ['admin'],
  grooming:       ['admin', 'veterinario', 'recepcionista'],
  ajustes:        ['admin', 'veterinario', 'recepcionista'],
  admin_lynx:     ['admin'],
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
  const [stockModal, setStockModal] = useState<{ sinStock: number; stockBajo: number; total: number } | null>(null);
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

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
          const vistaGuardada = localStorage.getItem('valvet-vista') || 'inicio';
          const vistaInicial = PERMISOS[vistaGuardada]?.includes(data.rol) ? vistaGuardada : 'inicio';
          setVista(vistaInicial);
          const { data: clinica } = await supabase
            .from('clinicas').select('nombre')
            .eq('id', data.clinica_id).single();
          if (clinica) setClinicaNombre(clinica.nombre);
          const hoyKey = `valvet-stock-${data.id}-${new Date().toISOString().split('T')[0]}`;
          if (!localStorage.getItem(hoyKey)) {
            localStorage.setItem(hoyKey, 'true');
            const notifActivas = localStorage.getItem('valvet-notificaciones') !== 'false';
            if (notifActivas) {
              const umbral = parseInt(localStorage.getItem('valvet-umbral-stock') || '5');
              const { data: productos } = await supabase
                .from('productos')
                .select('stock_actual')
                .eq('clinica_id', data.clinica_id)
                .eq('activo', true)
                .lte('stock_actual', umbral);
              if (productos && productos.length > 0) {
                const sinStock = productos.filter(p => p.stock_actual === 0).length;
                const stockBajo = productos.filter(p => p.stock_actual > 0).length;
                setStockModal({ sinStock, stockBajo, total: productos.length });
              }
            }
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

  const navegarA = (v: string) => {
    const permisosVista = PERMISOS[v] || ['admin'];
    if (!permisosVista.includes(usuario!.rol) &&
        usuario!.email !== 'marianonicolasmontano@gmail.com') {
      return;
    }
    localStorage.setItem('valvet-vista', v);
    setVista(v);
  };

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
    admin:         { bg: '#1e1333', color: '#A78BFA', border: '#5B21B6' },
    veterinario:   { bg: '#1a1e2a', color: '#5a7aae', border: '#2d3a6a' },
    recepcionista: { bg: '#2a1a2a', color: '#8a5aae', border: '#5a2d7a' },
  };

  const NAV_GRUPOS = [
    {
      label: 'Clínica',
      items: [
        { key: 'inicio',         label: 'Inicio',         roles: ['admin', 'veterinario', 'recepcionista'] },
        { key: 'turnos',         label: 'Turnos',         roles: ['admin', 'veterinario', 'recepcionista'] },
        { key: 'pacientes',      label: 'Pacientes',      roles: ['admin', 'veterinario', 'recepcionista'] },
        { key: 'propietarios',   label: 'Propietarios',   roles: ['admin', 'veterinario', 'recepcionista'] },
        { key: 'intervenciones', label: 'Intervenciones', roles: ['admin', 'veterinario'] },
        { key: 'cirugias',       label: 'Cirugías',       roles: ['admin', 'veterinario'] },
        { key: 'recetas',        label: 'Recetas',        roles: ['admin', 'veterinario'] },
        { key: 'stock',          label: 'Inventario',     roles: ['admin', 'veterinario'] },
        { key: 'grooming',       label: 'Grooming',       roles: ['admin', 'veterinario', 'recepcionista'] },
      ],
    },
    {
      label: 'Administración',
      items: [
        { key: 'facturacion', label: 'Facturación', roles: ['admin', 'recepcionista'] },
        { key: 'gastos',      label: 'Gastos',      roles: ['admin'] },
        { key: 'reportes',    label: 'Reportes',    roles: ['admin'] },
        { key: 'usuarios',    label: 'Usuarios',    roles: ['admin'] },
        { key: 'ajustes',     label: 'Ajustes',     roles: ['admin', 'veterinario', 'recepcionista'] },
        ...(usuario.email === 'marianonicolasmontano@gmail.com' ? [{ key: 'admin_lynx', label: 'Admin Lynx', roles: ['admin'] }] : []),
      ],
    },
  ];

  const todosLosItems = NAV_GRUPOS.flatMap(g => g.items);
  const vistaLabel = todosLosItems.find(n => n.key === vista)?.label || '';
  const breadcrumb = vista === 'inicio' ? ['Inicio'] : ['Inicio', vistaLabel];
  const rolStyle   = ROL_BADGE[usuario.rol] || ROL_BADGE.recepcionista;
  const iniciales  = usuario.nombre.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <ToastProvider>
    {modoRecuperacion && <PantallaRecuperacion onDone={() => setModoRecuperacion(false)} />}
    {stockModal && (
      <StockAlertModal
        sinStock={stockModal.sinStock}
        stockBajo={stockModal.stockBajo}
        total={stockModal.total}
        onClose={() => setStockModal(null)}
        onVerInventario={() => { setStockModal(null); navegarA('stock'); }}
      />
    )}
    {!modoRecuperacion && <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: tema.bg, color: tema.text, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* SIDEBAR DESKTOP */}
      <aside style={{ display: isMobile ? 'none' : 'flex', width: '220px', background: '#0f0f0f', padding: '24px 16px', borderRight: '1px solid #1e1e1e', flexDirection: 'column', flexShrink: 0 }}>

        {/* Logo ValVet */}
        <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #1e1e1e', textAlign: 'center' }}>
          <img src={VALVET_LOGO} alt="ValVet"
            style={{ width: '170px', objectFit: 'contain', filter: 'none', display: 'inline-block', verticalAlign: 'bottom' }} />
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
          {NAV_GRUPOS.map(grupo => {
            const itemsFiltrados = grupo.items.filter(item => item.roles.includes(usuario.rol));
            if (itemsFiltrados.length === 0) return null;
            return (
            <div key={grupo.label} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase' as const, padding: '0 12px', marginBottom: '8px', fontWeight: '500' }}>{grupo.label}</div>
              {itemsFiltrados.map(({ key, label }) => (
                <button key={key} onClick={() => navegarA(key)}
                  style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: '5px', textAlign: 'left', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.02em', marginBottom: '1px', background: vista === key ? '#1e1333' : 'transparent', color: vista === key ? '#A78BFA' : '#aaaaaa', borderLeft: vista === key ? '2px solid #7C3AED' : '2px solid transparent', fontWeight: vista === key ? '500' : '400' }}
                  onMouseEnter={e => { if (vista !== key) { (e.currentTarget as HTMLButtonElement).style.background = '#181818'; (e.currentTarget as HTMLButtonElement).style.color = '#aaa'; } }}
                  onMouseLeave={e => { if (vista !== key) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa'; } }}
                >{label}</button>
              ))}
            </div>
            );
          })}
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

      {/* DRAWER MOBILE */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }}
          />
          {/* Drawer */}
          <aside style={{ position: 'fixed', top: 0, left: 0, height: '100%', width: '220px', background: '#0f0f0f', padding: '24px 16px', borderRight: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', zIndex: 50, overflowY: 'auto' }}>

            {/* Botón cerrar */}
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
            >✕</button>

            {/* Logo ValVet */}
            <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #1e1e1e', textAlign: 'center' }}>
              <img src={VALVET_LOGO} alt="ValVet"
                style={{ width: '170px', objectFit: 'contain', filter: 'none', display: 'inline-block', verticalAlign: 'bottom' }} />
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
              {NAV_GRUPOS.map(grupo => {
                const itemsFiltrados = grupo.items.filter(item => item.roles.includes(usuario.rol));
                if (itemsFiltrados.length === 0) return null;
                return (
                <div key={grupo.label} style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase' as const, padding: '0 12px', marginBottom: '8px', fontWeight: '500' }}>{grupo.label}</div>
                  {itemsFiltrados.map(({ key, label }) => (
                    <button key={key} onClick={() => { navegarA(key); setDrawerOpen(false); }}
                      style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: '5px', textAlign: 'left', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.02em', marginBottom: '1px', background: vista === key ? '#1e1333' : 'transparent', color: vista === key ? '#A78BFA' : '#aaaaaa', borderLeft: vista === key ? '2px solid #7C3AED' : '2px solid transparent', fontWeight: vista === key ? '500' : '400' }}
                    >{label}</button>
                  ))}
                </div>
                );
              })}
            </nav>

            {/* Cerrar sesión */}
            <button onClick={logout}
              style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #333333', borderRadius: '5px', color: '#888888', cursor: 'pointer', fontSize: '13px', letterSpacing: '0.05em', marginTop: '8px' }}
            >Cerrar sesión</button>

            {/* Logo Lynx */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #1e1e1e', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <img src={LYNX_LOGO} alt="Lynx" style={{ width: '96px', height: '96px', objectFit: 'contain', opacity: 0.7 }} />
              <span style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>powered by Lynx</span>
            </div>
          </aside>
        </>
      )}

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* TOPBAR */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: tema.bgCard, borderBottom: `1px solid ${tema.border}` }}>
          {/* Botón hamburguesa — solo mobile */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px', marginRight: '12px', padding: '4px', display: isMobile ? 'block' : 'none' }}
          >☰</button>
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
            {vista === 'intervenciones' && PERMISOS.intervenciones.includes(usuario.rol) && <SeccionIntervenciones usuario={usuario} tema={tema} />}
            {vista === 'cirugias'       && PERMISOS.cirugias.includes(usuario.rol)       && <SeccionCirugias       usuario={usuario} tema={tema} />}
            {vista === 'recetas'        && PERMISOS.recetas.includes(usuario.rol)        && <SeccionRecetas        usuario={usuario} tema={tema} />}
            {vista === 'stock'          && PERMISOS.stock.includes(usuario.rol)          && <SeccionInventario     usuario={usuario} tema={tema} />}
            {vista === 'grooming'       && PERMISOS.grooming.includes(usuario.rol)       && <SeccionGrooming       usuario={usuario} tema={tema} />}
            {vista === 'facturacion'    && PERMISOS.facturacion.includes(usuario.rol)    && <SeccionFacturacion    usuario={usuario} tema={tema} />}
            {vista === 'gastos'         && PERMISOS.gastos.includes(usuario.rol)         && <SeccionGastos         usuario={usuario} tema={tema} />}
            {vista === 'reportes'       && PERMISOS.reportes.includes(usuario.rol)       && <SeccionReportes       usuario={usuario} tema={tema} />}
            {vista === 'usuarios'       && PERMISOS.usuarios.includes(usuario.rol)       && <SeccionUsuarios       usuario={usuario} tema={tema} />}
            {vista === 'ajustes'        && <SeccionAjustes        usuario={usuario} tema={tema} temaKey={temaKey} onCambiarTema={k => { setTemaKey(k); localStorage.setItem('valvet-tema', k); }} />}
            {vista === 'admin_lynx'     && usuario.email === 'marianonicolasmontano@gmail.com' && <AdminLynx usuario={usuario} tema={tema} />}
          </Suspense>
        </main>
      </div>
    </div>}
    </ToastProvider>
  );
};

export default App;
