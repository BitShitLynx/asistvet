import React, { useState, useCallback, useContext, createContext } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────────
export type ToastTipo = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  mensaje: string;
  tipo: ToastTipo;
  saliendo: boolean;
}

interface ToastContextType {
  toast: (mensaje: string, tipo?: ToastTipo) => void;
}

// ── Colores por tipo ───────────────────────────────────────────────────────────
const TOAST_ESTILOS: Record<ToastTipo, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: '#1e1333', border: '#6D28D9', color: '#A78BFA', icon: '✅' },
  error:   { bg: '#450a0a', border: '#dc2626', color: '#f87171', icon: '❌' },
  warning: { bg: '#431407', border: '#d97706', color: '#fbbf24', icon: '⚠️' },
  info:    { bg: '#0c1a2e', border: '#0891b2', color: '#38bdf8', icon: 'ℹ️'  },
};

// ── Context ────────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextType>({ toast: () => {} });

// ── Provider ───────────────────────────────────────────────────────────────────
export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let nextId = 0;

  const toast = useCallback((mensaje: string, tipo: ToastTipo = 'success') => {
    const id = Date.now() + nextId++;
    setToasts(prev => [...prev, { id, mensaje, tipo, saliendo: false }]);

    // Iniciar animación de salida a los 5s
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, saliendo: true } : t));
    }, 5000);

    // Eliminar a los 5.4s (después de la animación)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5400);
  }, []);

  const cerrar = (id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, saliendo: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Contenedor de toasts — esquina inferior derecha */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const estilo = TOAST_ESTILOS[t.tipo];
          return (
            <div key={t.id} style={{
              pointerEvents: 'all',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: estilo.bg,
              border: `1px solid ${estilo.border}`,
              borderRadius: '10px',
              padding: '12px 16px',
              minWidth: '280px',
              maxWidth: '380px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              opacity: t.saliendo ? 0 : 1,
              transform: t.saliendo ? 'translateY(20px)' : 'translateY(0)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
              cursor: 'default',
            }}>
              <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{estilo.icon}</span>
              <span style={{ flex: 1, fontSize: '13px', color: estilo.color, lineHeight: '1.5', fontWeight: '500' }}>{t.mensaje}</span>
              <button onClick={() => cerrar(t.id)} style={{
                background: 'transparent', border: 'none', color: estilo.color,
                cursor: 'pointer', fontSize: '16px', padding: '0', opacity: 0.6,
                flexShrink: 0, lineHeight: 1,
              }}>✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// ── Hook ───────────────────────────────────────────────────────────────────────
export const useToast = () => useContext(ToastContext);

// ── Modal de confirmación ──────────────────────────────────────────────────────
interface ConfirmProps {
  mensaje: string;
  detalle?: string;
  labelConfirmar?: string;
  peligroso?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export const ConfirmModal = ({ mensaje, detalle, labelConfirmar = 'Confirmar', peligroso = false, onConfirmar, onCancelar }: ConfirmProps) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
    <div style={{ background: '#112918', border: '1px solid #1e4a2a', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 'bold', color: '#e8f5eb' }}>{mensaje}</p>
      {detalle && <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6daa7f', lineHeight: 1.5 }}>{detalle}</p>}
      {!detalle && <div style={{ marginBottom: '24px' }} />}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancelar} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid #1e4a2a', borderRadius: '8px', color: '#6daa7f', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
        <button onClick={onConfirmar} style={{ padding: '9px 18px', background: peligroso ? '#dc2626' : '#16a34a', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>{labelConfirmar}</button>
      </div>
    </div>
  </div>
);
