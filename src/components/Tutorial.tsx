import { useState } from 'react';
import type { TemaObj } from '../styles/theme';

interface PasoTutorial {
  titulo: string;
  descripcion: string;
  icono: string;
}

const PASOS: PasoTutorial[] = [
  { titulo: 'Bienvenido a AsistVet',  descripcion: 'Este tour rápido te va a mostrar todas las funcionalidades de la plataforma. Podés saltarlo en cualquier momento.',          icono: '👋' },
  { titulo: 'Turnos',                  descripcion: 'Gestioná la agenda diaria y semanal. Podés crear turnos, reprogramarlos y ver el estado de cada uno.',                        icono: '📅' },
  { titulo: 'Pacientes',               descripcion: 'Fichas completas de cada mascota con historial clínico, vacunas, internaciones y consultas.',                                  icono: '🐾' },
  { titulo: 'Propietarios',            descripcion: 'Base de clientes con datos de contacto e historial de cobros y mascotas asociadas.',                                           icono: '👤' },
  { titulo: 'Intervenciones',          descripcion: 'Registrá aplicaciones de medicamentos y vacunas. Descuenta stock automáticamente.',                                            icono: '💉' },
  { titulo: 'Recetas',                 descripcion: 'Generá recetas médicas con impresión profesional y envío por email al propietario.',                                           icono: '📋' },
  { titulo: 'Inventario',              descripcion: 'Control de stock de medicamentos e insumos. Alertas automáticas de stock bajo.',                                               icono: '📦' },
  { titulo: 'Grooming',                descripcion: 'Agenda de turnos de peluquería con registro de servicios, precios y estados.',                                                 icono: '✂️' },
  { titulo: 'Shop',                    descripcion: 'Punto de venta para productos. Carrito, cobro y control de stock integrado.',                                                  icono: '🛍️' },
  { titulo: 'Facturación',             descripcion: 'Historial de cobros con filtros por período, estado y medio de pago.',                                                         icono: '💰' },
  { titulo: 'Reportes',                descripcion: 'Métricas financieras y operativas. Ingresos, gastos y balance del período.',                                                   icono: '📊' },
  { titulo: 'Ajustes',                 descripcion: 'Personalizá tu experiencia: tema, umbral de stock, matrícula y cambio de contraseña.',                                        icono: '⚙️' },
  { titulo: '¡Listo!',                 descripcion: 'Ya conocés AsistVet. Podés volver a ver este tour desde el botón "Tutorial" en el sidebar cuando quieras.',                   icono: '✅' },
];

const Tutorial = ({ onClose, tema: _tema }: { onClose: () => void; tema: TemaObj }) => {
  const [paso, setPaso] = useState(0);

  const siguiente = () => {
    if (paso === PASOS.length - 1) {
      onClose();
    } else {
      setPaso(p => p + 1);
    }
  };

  const pasoActual = PASOS[paso];
  const progreso   = ((paso + 1) / PASOS.length) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: '#0f0a1a',
        border: '1px solid #5B21B6',
        borderRadius: '14px',
        padding: '36px 32px',
        maxWidth: '460px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{pasoActual.icono}</div>

        <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#7C3AED', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {paso === 0 ? 'Bienvenida' : paso === PASOS.length - 1 ? '¡Completado!' : `Paso ${paso} de ${PASOS.length - 2}`}
        </p>

        <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: '700', color: '#e8e0ff' }}>
          {pasoActual.titulo}
        </h2>

        <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#9E8FBF', lineHeight: '1.6' }}>
          {pasoActual.descripcion}
        </p>

        <div style={{ background: '#1e1333', borderRadius: '99px', height: '4px', marginBottom: '28px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progreso}%`, background: '#7C3AED', borderRadius: '99px', transition: 'width 0.3s ease' }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose}
            style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #2a2a3a', borderRadius: '7px', color: '#666', cursor: 'pointer', fontSize: '13px' }}>
            Saltar tour
          </button>
          <button onClick={siguiente}
            style={{ flex: 1, padding: '10px', background: '#5B21B6', border: '1px solid #7C3AED', borderRadius: '7px', color: '#EDE9FE', cursor: 'pointer', fontSize: '13px', fontWeight: '600', letterSpacing: '0.03em' }}>
            {paso === PASOS.length - 1 ? 'Comenzar →' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tutorial;
