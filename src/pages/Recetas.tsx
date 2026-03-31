import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { Modal } from '../components/shared';
import { useToast } from '../components/toast';

interface RecetaItem { id?: string; medicamento: string; dosis: string; frecuencia: string; dias: string; observaciones: string; }
interface Receta {
  id: string; paciente_id: string; veterinario_id?: string; fecha: string;
  diagnostico?: string; indicaciones?: string; matricula?: string;
  pacientes?: { nombre: string; especie: string; raza?: string };
  usuarios?: { nombre: string };
  receta_items?: RecetaItem[];
}

const fmtFecha = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const itemVacio = (): RecetaItem => ({ medicamento: '', dosis: '', frecuencia: '', dias: '', observaciones: '' });

// ── VISTA IMPRESIÓN ────────────────────────────────────────────────────────────
const VistaImpresion = ({ receta, clinicaNombre, tema: _tema }: { receta: Receta; clinicaNombre: string; tema: TemaObj }) => {
  const imprimir = () => {
    const contenido = document.getElementById('receta-print')?.innerHTML || '';
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html><head><title>Receta — ${receta.pacientes?.nombre}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #000; max-width: 700px; margin: 0 auto; }
        h1 { font-size: 22px; margin-bottom: 4px; } h2 { font-size: 16px; font-weight: normal; color: #555; }
        .seccion { margin-top: 24px; } .seccion h3 { font-size: 13px; text-transform: uppercase; color: #888; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
        .item { background: #f9f9f9; padding: 12px; border-radius: 6px; margin-bottom: 10px; }
        .item strong { font-size: 15px; } .item p { margin: 4px 0; font-size: 13px; color: #555; }
        .firma { margin-top: 60px; border-top: 1px solid #000; padding-top: 8px; display: inline-block; min-width: 200px; text-align: center; }
        @media print { body { padding: 20px; } }
      </style></head><body>${contenido}</body></html>
    `);
    ventana.document.close();
    ventana.print();
  };

  return (
    <div>
      <div id="receta-print">
        <h1>{clinicaNombre}</h1>
        <h2>Receta Veterinaria — {fmtFecha(receta.fecha)}</h2>
        <div className="seccion">
          <h3>Paciente</h3>
          <p><strong>{receta.pacientes?.nombre}</strong> — {receta.pacientes?.especie}{receta.pacientes?.raza ? ` · ${receta.pacientes.raza}` : ''}</p>
        </div>
        {receta.diagnostico && <div className="seccion"><h3>Diagnóstico</h3><p>{receta.diagnostico}</p></div>}
        {(receta.receta_items || []).length > 0 && (
          <div className="seccion">
            <h3>Medicamentos prescriptos</h3>
            {(receta.receta_items || []).map((it, i) => (
              <div key={i} className="item">
                <strong>{it.medicamento}</strong>
                <p>Dosis: {it.dosis || '—'} · Frecuencia: {it.frecuencia || '—'} · Días: {it.dias || '—'}</p>
                {it.observaciones && <p>Obs: {it.observaciones}</p>}
              </div>
            ))}
          </div>
        )}
        {receta.indicaciones && <div className="seccion"><h3>Indicaciones generales</h3><p>{receta.indicaciones}</p></div>}
        <div style={{ marginTop: '60px' }}>
          <div className="firma">
            <p><strong>{receta.usuarios?.nombre || '—'}</strong></p>
            {receta.matricula && <p>Mat. {receta.matricula}</p>}
          </div>
        </div>
      </div>
      <button onClick={imprimir}
        style={{ marginTop: '20px', padding: '12px 28px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
        🖨️ IMPRIMIR RECETA
      </button>
    </div>
  );
};

// ── FORM RECETA ────────────────────────────────────────────────────────────────
const FormReceta = ({ clinicaId, usuario, onSave, onClose, tema }: {
  clinicaId: string; usuario: Usuario; onSave: () => void; onClose: () => void; tema: TemaObj;
}) => {
  const S = makeS(tema);
  const { toast } = useToast();
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [form, setForm] = useState({
    paciente_id: '', fecha: new Date().toISOString().split('T')[0],
    diagnostico: '', indicaciones: '', matricula: localStorage.getItem(`valvet-matricula-${usuario.id}`) || '',
  });
  const [items, setItems] = useState<RecetaItem[]>([itemVacio()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('pacientes').select('id,nombre,especie,raza')
      .eq('clinica_id', clinicaId).order('nombre')
      .then(({ data }) => setPacientes(data || []));
  }, [clinicaId]);

  const setItem = (i: number, k: keyof RecetaItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const guardar = async () => {
    if (!form.paciente_id) { setError('Seleccioná un paciente.'); return; }
    if (items.some(it => !it.medicamento.trim())) { setError('Completá el nombre del medicamento en todos los ítems.'); return; }
    setSaving(true); setError('');
    const { data: rec, error: e1 } = await supabase.from('recetas').insert({
      clinica_id: clinicaId, paciente_id: form.paciente_id,
      veterinario_id: usuario.id, fecha: form.fecha,
      diagnostico: form.diagnostico || null, indicaciones: form.indicaciones || null,
      matricula: form.matricula || null,
    }).select().single();
    if (e1 || !rec) { toast(e1?.message || 'Error al guardar la receta', 'error'); setSaving(false); return; }
    const itemsPayload = items.filter(it => it.medicamento.trim()).map(it => ({
      receta_id: rec.id, medicamento: it.medicamento,
      dosis: it.dosis || null, frecuencia: it.frecuencia || null,
      dias: it.dias ? parseInt(it.dias) : null, observaciones: it.observaciones || null,
    }));
    if (itemsPayload.length > 0) await supabase.from('receta_items').insert(itemsPayload);
    toast('Receta guardada correctamente', 'success');
    onSave(); onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {error && <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '10px', color: '#f87171' }}>{error}</div>}

      {/* Datos generales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Paciente *</label>
          <select style={{ ...S.input, cursor: 'pointer' }} value={form.paciente_id} onChange={e => setForm(p => ({ ...p, paciente_id: e.target.value }))}>
            <option value="">-- Seleccionar paciente --</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.especie}{p.raza ? ` · ${p.raza}` : ''})</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>Fecha</label>
          <input type="date" style={{ ...S.input, colorScheme: 'dark' }} value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
        </div>
        <div>
          <label style={S.label}>Matrícula del veterinario</label>
          <input style={S.input} value={form.matricula} onChange={e => setForm(p => ({ ...p, matricula: e.target.value }))} placeholder="Ej: MV 12345" />
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Diagnóstico</label>
          <input style={S.input} value={form.diagnostico} onChange={e => setForm(p => ({ ...p, diagnostico: e.target.value }))} placeholder="Diagnóstico presuntivo o definitivo" />
        </div>
      </div>

      {/* Medicamentos */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={{ ...S.label, margin: 0 }}>Medicamentos prescriptos</label>
          <button onClick={() => setItems(p => [...p, itemVacio()])}
            style={{ ...S.btnSuccess, padding: '6px 14px', fontSize: '13px' }}>+ Agregar</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: tema.bgInput, padding: '14px', borderRadius: '8px', border: `1px solid ${tema.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: tema.textMuted, fontWeight: 'bold' }}>MEDICAMENTO {i + 1}</span>
                {items.length > 1 && <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '13px' }}>✕ Quitar</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Medicamento *</label><input style={S.input} value={it.medicamento} onChange={e => setItem(i, 'medicamento', e.target.value)} placeholder="Ej: Amoxicilina 500mg" /></div>
                <div><label style={S.label}>Dosis</label><input style={S.input} value={it.dosis} onChange={e => setItem(i, 'dosis', e.target.value)} placeholder="10mg/kg" /></div>
                <div><label style={S.label}>Frecuencia</label><input style={S.input} value={it.frecuencia} onChange={e => setItem(i, 'frecuencia', e.target.value)} placeholder="Cada 12hs" /></div>
                <div><label style={S.label}>Días</label><input style={S.input} type="number" min="1" value={it.dias} onChange={e => setItem(i, 'dias', e.target.value)} placeholder="7" /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Observaciones</label><input style={S.input} value={it.observaciones} onChange={e => setItem(i, 'observaciones', e.target.value)} placeholder="Con comida, refrigerar, etc." /></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indicaciones generales */}
      <div>
        <label style={S.label}>Indicaciones generales</label>
        <textarea rows={3} style={{ ...S.input, resize: 'vertical' }} value={form.indicaciones} onChange={e => setForm(p => ({ ...p, indicaciones: e.target.value }))} placeholder="Indicaciones adicionales para el propietario..." />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando...' : '📋 GUARDAR RECETA'}
        </button>
        <button onClick={onClose} style={S.btnGhost}>Cancelar</button>
      </div>
    </div>
  );
};

// ── SECCIÓN RECETAS ────────────────────────────────────────────────────────────
const SeccionRecetas = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modalNueva, setModalNueva] = useState(false);
  const [recetaVer, setRecetaVer] = useState<Receta | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('recetas')
      .select('*, pacientes(nombre,especie,raza), usuarios(nombre), receta_items(*)')
      .eq('clinica_id', usuario.clinica_id)
      .order('fecha', { ascending: false });
    setRecetas((data || []) as Receta[]);
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = recetas.filter(r => {
    const q = busqueda.toLowerCase();
    return !q
      || (r.pacientes?.nombre || '').toLowerCase().includes(q)
      || (r.diagnostico || '').toLowerCase().includes(q)
      || (r.usuarios?.nombre || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '15px' }}>
        {[
          { label: 'Total recetas', val: recetas.length, color: '#3b82f6' },
          { label: 'Este mes', val: recetas.filter(r => r.fecha >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]).length, color: '#059669' },
          { label: 'Medicamentos distintos', val: [...new Set(recetas.flatMap(r => (r.receta_items || []).map(it => it.medicamento)))].length, color: '#7c3aed' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, borderColor: color + '55', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barra */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <input type="text" placeholder="Buscar por paciente, diagnóstico o veterinario..." value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, flex: 1, padding: '12px' }} />
        <button onClick={() => setModalNueva(true)} style={{ ...S.btnPrimary, whiteSpace: 'nowrap' }}>+ Nueva receta</button>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? <p style={{ padding: '20px', color: tema.textMuted }}>Cargando...</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Fecha', 'Paciente', 'Diagnóstico', 'Medicamentos', 'Veterinario', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 15px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>No se encontraron recetas.</td></tr>
              )}
              {filtradas.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 15px', color: tema.textMuted, fontSize: '13px' }}>{fmtFecha(r.fecha)}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: tema.text }}>{r.pacientes?.nombre || '—'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: tema.textMuted }}>{r.pacientes?.especie}{r.pacientes?.raza ? ` · ${r.pacientes.raza}` : ''}</p>
                  </td>
                  <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.textMuted }}>{r.diagnostico || '—'}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(r.receta_items || []).slice(0, 3).map((it, i) => (
                        <span key={i} style={{ fontSize: '11px', background: '#1e3a5f', padding: '2px 8px', borderRadius: '99px', color: '#93c5fd' }}>{it.medicamento}</span>
                      ))}
                      {(r.receta_items || []).length > 3 && <span style={{ fontSize: '11px', color: tema.textMuted }}>+{(r.receta_items || []).length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 15px', fontSize: '13px', color: tema.textMuted }}>{r.usuarios?.nombre || '—'}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <button onClick={() => setRecetaVer(r)}
                      style={{ padding: '5px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                      🖨️ Ver / Imprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalNueva && (
        <Modal titulo="📋 Nueva Receta" onClose={() => setModalNueva(false)} tema={tema}>
          <FormReceta clinicaId={usuario.clinica_id} usuario={usuario} onSave={cargar} onClose={() => setModalNueva(false)} tema={tema} />
        </Modal>
      )}
      {recetaVer && (
        <Modal titulo={`🖨️ Receta — ${recetaVer.pacientes?.nombre}`} onClose={() => setRecetaVer(null)} tema={tema}>
          <VistaImpresion receta={recetaVer} clinicaNombre="ValVet" tema={tema} />
        </Modal>
      )}
    </div>
  );
};

export default SeccionRecetas;
