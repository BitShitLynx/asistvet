import React from 'react';

interface PaginacionProps {
  total: number;
  porPagina: number;
  paginaActual: number;
  onCambiar: (pagina: number) => void;
  tema: { text: string; textMuted: string; bgCard: string; border: string; accent: string; bgInput: string };
}

const Paginacion = ({ total, porPagina, paginaActual, onCambiar, tema }: PaginacionProps) => {
  const totalPaginas = Math.ceil(total / porPagina);
  if (totalPaginas <= 1) return null;

  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const visibles = paginas.filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 1);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${tema.border}` }}>
      <span style={{ fontSize: '12px', color: tema.textMuted, letterSpacing: '0.03em' }}>
        {total} registros — página {paginaActual} de {totalPaginas}
      </span>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button onClick={() => onCambiar(paginaActual - 1)} disabled={paginaActual === 1}
          style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${tema.border}`, borderRadius: '4px', color: paginaActual === 1 ? tema.border : tema.textMuted, cursor: paginaActual === 1 ? 'default' : 'pointer', fontSize: '13px' }}>
          ←
        </button>
        {visibles.map((p, i) => {
          const anterior = visibles[i - 1];
          return (
            <React.Fragment key={p}>
              {anterior && p - anterior > 1 && (
                <span style={{ color: tema.textMuted, fontSize: '13px', padding: '0 4px' }}>…</span>
              )}
              <button onClick={() => onCambiar(p)}
                style={{ padding: '6px 10px', background: p === paginaActual ? tema.accent : 'transparent', border: `1px solid ${p === paginaActual ? tema.accent : tema.border}`, borderRadius: '4px', color: p === paginaActual ? '#fff' : tema.textMuted, cursor: 'pointer', fontSize: '13px', minWidth: '32px' }}>
                {p}
              </button>
            </React.Fragment>
          );
        })}
        <button onClick={() => onCambiar(paginaActual + 1)} disabled={paginaActual === totalPaginas}
          style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${tema.border}`, borderRadius: '4px', color: paginaActual === totalPaginas ? tema.border : tema.textMuted, cursor: paginaActual === totalPaginas ? 'default' : 'pointer', fontSize: '13px' }}>
          →
        </button>
      </div>
    </div>
  );
};

export default Paginacion;
