import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';

const PantallaInicio = ({ usuario, onNavegar, tema }: { usuario: Usuario; onNavegar: (v: string) => void; tema: TemaObj }) => {
  const S = makeS(tema);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  const modulos = [
    { key: 'turnos',         label: 'Turnos',         desc: 'Agenda y guardias' },
    { key: 'pacientes',      label: 'Pacientes',      desc: 'Fichas e historial' },
    { key: 'propietarios',   label: 'Propietarios',   desc: 'Clientes y contactos' },
    { key: 'intervenciones', label: 'Intervenciones', desc: 'Aplicación de drogas' },
    { key: 'cirugias',       label: 'Cirugías',       desc: 'Registro quirúrgico' },
    { key: 'recetas',        label: 'Recetas',         desc: 'Prescripciones' },
    { key: 'grooming',       label: 'Grooming',        desc: 'Peluquería y estética' },
    { key: 'shop',           label: 'Shop',            desc: 'Punto de venta' },
    { key: 'delivery',       label: 'Delivery',        desc: 'Pedidos a domicilio' },
    { key: 'stock',          label: 'Inventario',     desc: 'Stock e insumos' },
    { key: 'facturacion',    label: 'Facturación',    desc: 'Cobros y pagos' },
    { key: 'gastos',         label: 'Gastos',         desc: 'Egresos operativos' },
    { key: 'reportes',       label: 'Reportes',       desc: 'Métricas y balance' },
    { key: 'usuarios',       label: 'Usuarios',       desc: 'Accesos y roles' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Banner */}
      <div style={{ ...S.card, borderLeft: '2px solid #7C3AED', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#888888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{saludo}</p>
        <h2 style={{ margin: '0 0 6px', color: tema.text, fontSize: '22px', fontWeight: '600', letterSpacing: '0.01em' }}>{usuario.nombre}</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#888888', letterSpacing: '0.02em' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Grilla */}
      <div>
        <p style={{ margin: '0 0 16px', fontSize: '10px', color: tema.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: '500' }}>
          Módulos disponibles
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {modulos.map(m => (
            <div key={m.key} onClick={() => onNavegar(m.key)}
              style={{ ...S.card, cursor: 'pointer', padding: '20px', transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = tema.accent;
                (e.currentTarget as HTMLDivElement).style.background = tema.rowHover;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = tema.border;
                (e.currentTarget as HTMLDivElement).style.background = tema.bgCard;
              }}
            >
              <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '600', color: tema.text, letterSpacing: '0.01em' }}>{m.label}</p>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: tema.textMuted, lineHeight: '1.4' }}>{m.desc}</p>
              <p style={{ margin: 0, fontSize: '12px', color: '#7C3AED', letterSpacing: '0.04em' }}>Abrir →</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PantallaInicio;
