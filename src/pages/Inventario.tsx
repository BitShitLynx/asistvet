import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS, CATEGORIAS_INV, UNIDADES_INV, COLORES_CAT } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  especie: string;
  dosis: string[];
  vias: string[];
  stock: number;
  unidad: string;
}

const mapearProducto = (p: any): Producto => ({
  id:        p.id,
  nombre:    p.nombre,
  categoria: p.categoria   || 'Otro',
  especie:   p.especie     || 'General',
  dosis:     Array.isArray(p.dosis) ? p.dosis : [],
  vias:      Array.isArray(p.vias)  ? p.vias  : [],
  stock:     Number(p.stock_actual ?? p.stock ?? 0),
  unidad:    p.unidad      || 'unidad',
});

const SeccionInventario = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();

  const [productos, setProductos]             = useState<Producto[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [busquedaInv, setBusquedaInv]         = useState('');
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [productoSel, setProductoSel]         = useState<Producto | null>(null);
  const [panel, setPanel]                     = useState<string | null>(null);
  const [registro, setRegistro]               = useState({ dosis: '', via: '', cantidad: '', fecha: new Date().toISOString().split('T')[0], lote: '', vencimiento: '' });
  const [cantidadEntrada, setCantidadEntrada] = useState('');
  const [nuevoInsumo, setNuevoInsumo]         = useState({ nombre: '', categoria: 'Vacuna', stockInicial: '', unidad: 'dosis' });
  const [edicion, setEdicion]                 = useState({ dosisTexto: '', viasTexto: '', especie: '' });
  const [error, setError]                     = useState('');

  // ── Carga desde Supabase ────────────────────────────────────────────────────
  const cargarProductos = useCallback(async () => {
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('productos')
      .select('*')
      .eq('clinica_id', usuario.clinica_id)
      .order('nombre');
    console.log('Productos data:', data);
    console.log('Productos error:', dbErr);
    console.log('clinica_id usado:', usuario.clinica_id);
    if (dbErr) { console.error('Error cargando productos:', dbErr); setError(dbErr.message); setLoading(false); return; }
    setProductos((data || []).map(mapearProducto));
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  // ── Helpers UI ──────────────────────────────────────────────────────────────
  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busquedaInv.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busquedaInv.toLowerCase()) ||
    p.especie.toLowerCase().includes(busquedaInv.toLowerCase())
  );

  const seleccionar = (p: Producto) => {
    setProductoSel(p); setBusquedaInv(p.nombre);
    setMostrarSugerencias(false);
    setRegistro(prev => ({ ...prev, dosis: '', via: '' }));
    setPanel('aplicacion');
  };
  const abrirNuevo   = () => { setNuevoInsumo({ nombre: busquedaInv, categoria: 'Vacuna', stockInicial: '', unidad: 'dosis' }); setPanel('nuevo'); };
  const abrirEntrada = (p: Producto) => { setProductoSel(p); setCantidadEntrada(''); setPanel('entrada'); };
  const abrirEdicion = (p: Producto) => { setProductoSel(p); setEdicion({ dosisTexto: p.dosis.join('\n'), viasTexto: p.vias.join(', '), especie: p.especie }); setPanel('editar'); };

  const badgeStock = (stock: number, unidad: string) => {
    const color = stock === 0 ? '#dc2626' : stock <= 5 ? '#d97706' : '#059669';
    return <span style={{ fontSize: '12px', background: color, padding: '3px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>{stock} {unidad}</span>;
  };

  // ── Confirmar aplicación ────────────────────────────────────────────────────
  const confirmarAplicacion = async () => {
    if (!productoSel) return;
    const cant      = parseFloat(registro.cantidad) || 1;
    const nuevoStock = Math.max(0, productoSel.stock - cant);
    setSaving(true);
    const { error: dbErr } = await supabase
      .from('productos')
      .update({ stock_actual: nuevoStock })
      .eq('id', productoSel.id);
    if (dbErr) { toast('Error al actualizar stock: ' + dbErr.message, 'error'); setSaving(false); return; }
    await cargarProductos();
    setSaving(false); setPanel(null);
    toast(`Stock actualizado: ${nuevoStock} ${productoSel.unidad}`, 'success');
  };

  // ── Confirmar entrada de stock ──────────────────────────────────────────────
  const confirmarEntrada = async () => {
    if (!productoSel) return;
    const cant = parseFloat(cantidadEntrada);
    if (!cant || cant <= 0) { toast('Ingresá una cantidad válida.', 'warning'); return; }
    const nuevoStock = productoSel.stock + cant;
    setSaving(true);
    const { error: dbErr } = await supabase
      .from('productos')
      .update({ stock_actual: nuevoStock })
      .eq('id', productoSel.id);
    if (dbErr) { toast('Error al actualizar stock: ' + dbErr.message, 'error'); setSaving(false); return; }
    await cargarProductos();
    setSaving(false); setPanel(null);
    toast(`Se sumaron ${cant} ${productoSel.unidad}`, 'success');
  };

  // ── Agregar nuevo insumo ────────────────────────────────────────────────────
  const confirmarNuevo = async () => {
    if (!nuevoInsumo.nombre.trim()) { toast('El nombre es obligatorio.', 'warning'); return; }
    setSaving(true);
    const { error: dbErr } = await supabase.from('productos').insert({
      clinica_id:   usuario.clinica_id,
      nombre:       nuevoInsumo.nombre.trim(),
      categoria:    nuevoInsumo.categoria,
      especie:      'General',
      dosis:        [],
      vias:         [],
      stock_actual: parseFloat(nuevoInsumo.stockInicial) || 0,
      unidad:       nuevoInsumo.unidad,
    });
    if (dbErr) { toast('Error al agregar: ' + dbErr.message, 'error'); setSaving(false); return; }
    await cargarProductos();
    setSaving(false); setPanel(null); setBusquedaInv('');
    toast(`"${nuevoInsumo.nombre}" agregado al inventario`, 'success');
  };

  // ── Editar especie / dosis / vías ───────────────────────────────────────────
  const confirmarEdicion = async () => {
    if (!productoSel) return;
    setSaving(true);
    const { error: dbErr } = await supabase.from('productos').update({
      especie: edicion.especie || productoSel.especie,
      dosis:   edicion.dosisTexto ? edicion.dosisTexto.split('\n').map(d => d.trim()).filter(Boolean) : productoSel.dosis,
      vias:    edicion.viasTexto  ? edicion.viasTexto.split(',').map(v => v.trim()).filter(Boolean)   : productoSel.vias,
    }).eq('id', productoSel.id);
    if (dbErr) { toast('Error al editar: ' + dbErr.message, 'error'); setSaving(false); return; }
    await cargarProductos();
    setSaving(false); setPanel(null);
    toast('Insumo actualizado correctamente', 'success');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {error && (
        <div style={{ background: '#450a0a', border: '1px solid #dc2626', borderRadius: '8px', padding: '12px', color: '#f87171', fontSize: '14px' }}>
          ⚠️ {error} — <button onClick={cargarProductos} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', textDecoration: 'underline' }}>Reintentar</button>
        </div>
      )}

      {/* Buscador */}
      <div style={{ ...S.card }}>
        <h4 style={{ marginTop: 0, marginBottom: '15px', color: tema.text }}>🔍 Buscar Producto / Droga</h4>
        <div style={{ position: 'relative' }}>
          <input type="text" placeholder="Buscar por nombre, categoría o especie..." value={busquedaInv}
            onChange={e => { setBusquedaInv(e.target.value); setMostrarSugerencias(true); setProductoSel(null); setPanel(null); }}
            onFocus={() => setMostrarSugerencias(true)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
            style={{ ...S.input, fontSize: '15px', padding: '12px' }} />
          {mostrarSugerencias && busquedaInv.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: tema.bgCard, border: `1px solid ${tema.accent}`, borderRadius: '8px', marginTop: '4px', maxHeight: '260px', overflowY: 'auto' }}>
              {filtrados.length === 0 ? (
                <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: tema.textMuted }}>Sin resultados</span>
                  <button onMouseDown={abrirNuevo} style={{ ...S.btnSuccess, padding: '6px 14px', fontSize: '13px' }}>+ Agregar nuevo</button>
                </div>
              ) : (
                <>
                  {filtrados.map(p => (
                    <div key={p.id} onMouseDown={() => seleccionar(p)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ color: tema.text }}>{p.nombre}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {badgeStock(p.stock, p.unidad)}
                        <span style={{ fontSize: '11px', background: COLORES_CAT[p.categoria] || '#475569', padding: '2px 8px', borderRadius: '99px', color: 'white' }}>{p.categoria}</span>
                      </div>
                    </div>
                  ))}
                  <div onMouseDown={abrirNuevo}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderTop: `1px solid ${tema.border}`, color: '#34d399', fontSize: '13px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    ＋ Agregar "{busquedaInv}" como nuevo insumo
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panel aplicación */}
      {panel === 'aplicacion' && productoSel && (
        <div style={{ ...S.card, border: `1px solid ${tema.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: tema.accent }}>📋 Registrar Aplicación — {productoSel.nombre}</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: tema.textMuted, fontSize: '13px' }}>Stock:</span>
              {badgeStock(productoSel.stock, productoSel.unidad)}
              <button onClick={() => setPanel(null)} style={{ background: 'transparent', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><label style={S.label}>Dosis</label>
              {productoSel.dosis.length > 0
                ? <select value={registro.dosis} onChange={e => setRegistro(p => ({ ...p, dosis: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}><option value="">-- Seleccionar --</option>{productoSel.dosis.map((d, i) => <option key={i} value={d}>{d}</option>)}</select>
                : <input style={S.input} value={registro.dosis} onChange={e => setRegistro(p => ({ ...p, dosis: e.target.value }))} placeholder="Ej: 10mg/kg" />}
            </div>
            <div><label style={S.label}>Vía</label>
              {productoSel.vias.length > 0
                ? <select value={registro.via} onChange={e => setRegistro(p => ({ ...p, via: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}><option value="">-- Seleccionar --</option>{productoSel.vias.map((v, i) => <option key={i} value={v}>{v}</option>)}</select>
                : <input style={S.input} value={registro.via} onChange={e => setRegistro(p => ({ ...p, via: e.target.value }))} placeholder="Ej: SC, IM" />}
            </div>
            <div><label style={S.label}>Cantidad ({productoSel.unidad})</label><input type="number" min="0" step="0.1" value={registro.cantidad} onChange={e => setRegistro(p => ({ ...p, cantidad: e.target.value }))} style={S.input} /></div>
            <div><label style={S.label}>Fecha</label><input type="date" value={registro.fecha} onChange={e => setRegistro(p => ({ ...p, fecha: e.target.value }))} style={{ ...S.input, colorScheme: 'dark' }} /></div>
            <div><label style={S.label}>Lote</label><input type="text" placeholder="Nº de lote" value={registro.lote} onChange={e => setRegistro(p => ({ ...p, lote: e.target.value }))} style={S.input} /></div>
            <div><label style={S.label}>Vencimiento</label><input type="date" value={registro.vencimiento} onChange={e => setRegistro(p => ({ ...p, vencimiento: e.target.value }))} style={{ ...S.input, colorScheme: 'dark' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={confirmarAplicacion} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : '✅ CONFIRMAR Y DESCONTAR STOCK'}
            </button>
            <button onClick={() => setPanel(null)} style={S.btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel entrada */}
      {panel === 'entrada' && productoSel && (
        <div style={{ ...S.card, border: '1px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#34d399' }}>📥 Entrada de Stock — {productoSel.nombre}</h4>
            <button onClick={() => setPanel(null)} style={{ background: 'transparent', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}><label style={S.label}>Cantidad a sumar ({productoSel.unidad})</label><input type="number" min="1" value={cantidadEntrada} onChange={e => setCantidadEntrada(e.target.value)} style={{ ...S.input, fontSize: '18px', padding: '12px' }} /></div>
            <div style={{ textAlign: 'center', padding: '10px 20px', background: tema.bgInput, borderRadius: '8px', border: `1px solid ${tema.border}` }}>
              <div style={{ fontSize: '11px', color: tema.textMuted }}>ACTUAL</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{productoSel.stock}</div>
              <div style={{ fontSize: '11px', color: tema.textMuted }}>{productoSel.unidad}</div>
            </div>
            {cantidadEntrada && parseFloat(cantidadEntrada) > 0 && (
              <div style={{ textAlign: 'center', padding: '10px 20px', background: tema.bgInput, borderRadius: '8px', border: '1px solid #059669' }}>
                <div style={{ fontSize: '11px', color: tema.textMuted }}>NUEVO</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399' }}>{productoSel.stock + parseFloat(cantidadEntrada)}</div>
                <div style={{ fontSize: '11px', color: tema.textMuted }}>{productoSel.unidad}</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={confirmarEntrada} disabled={saving} style={{ ...S.btnSuccess, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : '📥 CONFIRMAR ENTRADA'}
            </button>
            <button onClick={() => setPanel(null)} style={S.btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel nuevo */}
      {panel === 'nuevo' && (
        <div style={{ ...S.card, border: '1px solid #34d399' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#34d399' }}>➕ Nuevo Insumo</h4>
            <button onClick={() => setPanel(null)} style={{ background: 'transparent', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Nombre *</label><input type="text" value={nuevoInsumo.nombre} onChange={e => setNuevoInsumo(p => ({ ...p, nombre: e.target.value }))} style={S.input} placeholder="Ej: Amoxicilina 250mg" /></div>
            <div><label style={S.label}>Categoría</label><select value={nuevoInsumo.categoria} onChange={e => setNuevoInsumo(p => ({ ...p, categoria: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}>{CATEGORIAS_INV.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label style={S.label}>Unidad</label><select value={nuevoInsumo.unidad} onChange={e => setNuevoInsumo(p => ({ ...p, unidad: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}>{UNIDADES_INV.map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label style={S.label}>Stock inicial</label><input type="number" min="0" value={nuevoInsumo.stockInicial} onChange={e => setNuevoInsumo(p => ({ ...p, stockInicial: e.target.value }))} style={S.input} /></div>
          </div>
          <p style={{ fontSize: '12px', color: tema.textMuted, marginTop: '12px', marginBottom: 0 }}>💡 Podés agregar dosis, vías y especie después con ✏️</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={confirmarNuevo} disabled={saving} style={{ ...S.btnSuccess, flex: 1, padding: '14px', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : '➕ AGREGAR AL INVENTARIO'}
            </button>
            <button onClick={() => setPanel(null)} style={S.btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Panel editar */}
      {panel === 'editar' && productoSel && (
        <div style={{ ...S.card, border: '1px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0, color: '#fbbf24' }}>✏️ Editar — {productoSel.nombre}</h4>
            <button onClick={() => setPanel(null)} style={{ background: 'transparent', border: 'none', color: tema.textMuted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><label style={S.label}>Especie</label><input type="text" value={edicion.especie} onChange={e => setEdicion(p => ({ ...p, especie: e.target.value }))} style={S.input} /></div>
            <div><label style={S.label}>Vías (separadas por coma)</label><input type="text" value={edicion.viasTexto} onChange={e => setEdicion(p => ({ ...p, viasTexto: e.target.value }))} style={S.input} /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Dosis (una por línea)</label><textarea rows={3} value={edicion.dosisTexto} onChange={e => setEdicion(p => ({ ...p, dosisTexto: e.target.value }))} style={{ ...S.input, resize: 'vertical' }} /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button onClick={confirmarEdicion} disabled={saving} style={{ padding: '12px 28px', background: '#d97706', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', flex: 1, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : '💾 GUARDAR CAMBIOS'}
            </button>
            <button onClick={() => setPanel(null)} style={S.btnGhost}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Tabla de stock */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: `1px solid ${tema.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, color: tema.text }}>
            📦 Stock Actual
            {loading && <span style={{ fontSize: '12px', color: tema.textMuted, marginLeft: '10px', fontWeight: 'normal' }}>Cargando...</span>}
          </h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[...new Set(productos.map(p => p.categoria))].map(cat => (
              <span key={cat} style={{ fontSize: '11px', background: COLORES_CAT[cat] || '#475569', padding: '3px 10px', borderRadius: '99px', color: 'white' }}>{cat}</span>
            ))}
          </div>
        </div>
        {loading ? (
          <p style={{ padding: '30px', color: tema.textMuted, textAlign: 'center' }}>Cargando inventario...</p>
        ) : productos.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: tema.textMuted, marginBottom: '16px' }}>No hay productos en el inventario todavía.</p>
            <button onClick={abrirNuevo} style={{ ...S.btnSuccess }}>➕ Agregar primer insumo</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Insumo', 'Categoría', 'Especie', 'Stock', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '12px 15px', textAlign: 'left', color: tema.accent, fontSize: '13px' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {(busquedaInv.length > 0 ? filtrados : productos).map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 15px', fontWeight: 'bold', cursor: 'pointer', color: tema.text }} onClick={() => seleccionar(p)}>{p.nombre}</td>
                  <td style={{ padding: '12px 15px' }}><span style={{ fontSize: '11px', background: COLORES_CAT[p.categoria] || '#475569', padding: '2px 8px', borderRadius: '99px', color: 'white' }}>{p.categoria}</span></td>
                  <td style={{ padding: '12px 15px', color: tema.textMuted, fontSize: '13px' }}>{p.especie || '—'}</td>
                  <td style={{ padding: '12px 15px' }}>{badgeStock(p.stock, p.unidad)}</td>
                  <td style={{ padding: '12px 15px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => abrirEntrada(p)} style={{ padding: '5px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>📥 Entrada</button>
                      <button onClick={() => seleccionar(p)} style={{ padding: '5px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>💉 Aplicar</button>
                      <button onClick={() => abrirEdicion(p)} style={S.btnDanger}>✏️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button onClick={() => { setNuevoInsumo({ nombre: '', categoria: 'Vacuna', stockInicial: '', unidad: 'dosis' }); setPanel('nuevo'); }}
        style={{ ...S.btnSuccess, alignSelf: 'flex-start' }}>➕ Agregar nuevo insumo</button>
    </div>
  );
};

export default SeccionInventario;
