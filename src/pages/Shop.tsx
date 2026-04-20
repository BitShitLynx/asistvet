import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';
import { Modal } from '../components/shared';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ShopProducto {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  categoria: string;
  activo: boolean;
}

interface ItemCarrito {
  producto: ShopProducto;
  cantidad: number;
}

interface Venta {
  id: string;
  created_at: string;
  total: number;
  medio_pago: string;
  items_count: number;
  shop_venta_items?: { cantidad: number; precio_unitario: number; shop_productos: { nombre: string } }[];
}

const MEDIOS_PAGO = ['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'MercadoPago'];
const CATEGORIAS  = ['Alimento', 'Medicamento', 'Accesorio', 'Higiene', 'Juguete', 'Otro'];
const ACCENT      = '#8B5CF6';

// ── Tab Punto de venta ────────────────────────────────────────────────────────

const TabPDV = ({ usuario, tema, S }: { usuario: Usuario; tema: TemaObj; S: ReturnType<typeof makeS> }) => {
  const { toast } = useToast();
  const [productos, setProductos] = useState<ShopProducto[]>([]);
  const [carrito, setCarrito]     = useState<ItemCarrito[]>([]);
  const [busqueda, setBusqueda]   = useState('');
  const [medioPago, setMedioPago] = useState('Efectivo');
  const [cobrando, setCobrando]   = useState(false);

  const cargarProductos = useCallback(async () => {
    const { data } = await supabase
      .from('shop_productos')
      .select('*')
      .eq('clinica_id', usuario.clinica_id)
      .eq('activo', true)
      .gt('stock', 0)
      .order('nombre');
    setProductos((data || []) as ShopProducto[]);
  }, [usuario.clinica_id]);

  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  const agregarAlCarrito = (p: ShopProducto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto.id === p.id);
      if (existe) {
        if (existe.cantidad >= p.stock) { toast('Stock insuficiente', 'warning'); return prev; }
        return prev.map(i => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { producto: p, cantidad: 1 }];
    });
  };

  const quitarDelCarrito = (id: string) =>
    setCarrito(prev => prev.filter(i => i.producto.id !== id));

  const cambiarCantidad = (id: string, delta: number) => {
    setCarrito(prev => prev.map(i => {
      if (i.producto.id !== id) return i;
      const nueva = i.cantidad + delta;
      if (nueva <= 0) return i;
      if (nueva > i.producto.stock) { toast('Stock insuficiente', 'warning'); return i; }
      return { ...i, cantidad: nueva };
    }));
  };

  const total = carrito.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);

  const cobrar = async () => {
    if (carrito.length === 0) { toast('El carrito está vacío', 'warning'); return; }
    setCobrando(true);
    const { data: venta, error } = await supabase
      .from('shop_ventas')
      .insert({ clinica_id: usuario.clinica_id, total, medio_pago: medioPago, usuario_id: usuario.id })
      .select('id')
      .single();
    if (error || !venta) { toast('Error al registrar la venta', 'error'); setCobrando(false); return; }

    const items = carrito.map(i => ({
      venta_id:        venta.id,
      producto_id:     i.producto.id,
      cantidad:        i.cantidad,
      precio_unitario: i.producto.precio,
    }));
    const { error: e2 } = await supabase.from('shop_venta_items').insert(items);
    if (e2) { toast('Error al guardar ítems', 'error'); setCobrando(false); return; }

    // Descontar stock
    for (const i of carrito) {
      await supabase
        .from('shop_productos')
        .update({ stock: i.producto.stock - i.cantidad })
        .eq('id', i.producto.id);
    }

    toast(`Venta registrada — $${total.toLocaleString('es-AR')}`, 'success');
    setCarrito([]);
    cargarProductos();
    setCobrando(false);
  };

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 220px)', minHeight: '500px' }}>

      {/* Grilla de productos */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
        <input
          placeholder="Buscar producto o categoría..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, width: '100%' }}
        />
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', alignContent: 'start' }}>
          {filtrados.length === 0 && (
            <p style={{ color: tema.textMuted, fontSize: '13px', gridColumn: '1/-1', textAlign: 'center', paddingTop: '40px' }}>
              No hay productos disponibles.
            </p>
          )}
          {filtrados.map(p => (
            <button key={p.id} onClick={() => agregarAlCarrito(p)}
              style={{ background: tema.bgCard, border: `1px solid ${tema.border}`, borderRadius: '10px', padding: '16px 12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = '#1e1333'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = tema.border; e.currentTarget.style.background = tema.bgCard; }}>
              <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: tema.text, lineHeight: 1.3 }}>{p.nombre}</p>
              <p style={{ margin: '0 0 10px', fontSize: '11px', color: tema.textMuted }}>{p.categoria}</p>
              <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '700', color: ACCENT }}>${p.precio.toLocaleString('es-AR')}</p>
              <p style={{ margin: 0, fontSize: '11px', color: p.stock <= 3 ? '#f87171' : tema.textMuted }}>Stock: {p.stock}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Carrito */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', background: tema.bgCard, border: `1px solid ${tema.border}`, borderRadius: '10px', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${tema.border}` }}>
          <h4 style={{ margin: 0, color: tema.text, fontSize: '14px', fontWeight: '600' }}>Carrito</h4>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {carrito.length === 0 ? (
            <p style={{ color: tema.textMuted, fontSize: '13px', textAlign: 'center', paddingTop: '30px' }}>Hacé clic en un producto para agregarlo</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {carrito.map(i => (
                <div key={i.producto.id} style={{ background: tema.bg, border: `1px solid ${tema.border}`, borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: tema.text, lineHeight: 1.3, flex: 1 }}>{i.producto.nombre}</p>
                    <button onClick={() => quitarDelCarrito(i.producto.id)}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '14px', padding: '0 0 0 8px', lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button onClick={() => cambiarCantidad(i.producto.id, -1)}
                        style={{ width: '24px', height: '24px', background: tema.bgInput, border: `1px solid ${tema.border}`, borderRadius: '4px', color: tema.text, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>−</button>
                      <span style={{ fontSize: '14px', color: tema.text, fontWeight: '600', minWidth: '20px', textAlign: 'center' }}>{i.cantidad}</span>
                      <button onClick={() => cambiarCantidad(i.producto.id, 1)}
                        style={{ width: '24px', height: '24px', background: tema.bgInput, border: `1px solid ${tema.border}`, borderRadius: '4px', color: tema.text, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>+</button>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: ACCENT }}>${(i.producto.precio * i.cantidad).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer carrito */}
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${tema.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: tema.textMuted }}>Total</span>
            <span style={{ fontSize: '20px', fontWeight: '700', color: ACCENT }}>${total.toLocaleString('es-AR')}</span>
          </div>
          <select value={medioPago} onChange={e => setMedioPago(e.target.value)}
            style={{ ...S.input, fontSize: '13px', cursor: 'pointer' }}>
            {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={cobrar} disabled={cobrando || carrito.length === 0}
            style={{ ...S.btnPrimary, padding: '12px', width: '100%', opacity: cobrando || carrito.length === 0 ? 0.5 : 1 }}>
            {cobrando ? 'Procesando...' : `Cobrar $${total.toLocaleString('es-AR')}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Tab Productos (CRUD) ──────────────────────────────────────────────────────

const TabProductos = ({ usuario, tema, S }: { usuario: Usuario; tema: TemaObj; S: ReturnType<typeof makeS> }) => {
  const { toast } = useToast();
  const [productos, setProductos] = useState<ShopProducto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState<ShopProducto | null | 'nuevo'>(null);
  const [form, setForm]           = useState({ nombre: '', descripcion: '', precio: '', stock: '', categoria: 'Otro', activo: true });
  const [saving, setSaving]       = useState(false);
  const [busqueda, setBusqueda]   = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('shop_productos')
      .select('*')
      .eq('clinica_id', usuario.clinica_id)
      .order('nombre');
    setProductos((data || []) as ShopProducto[]);
    setLoading(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirNuevo = () => {
    setForm({ nombre: '', descripcion: '', precio: '', stock: '', categoria: 'Otro', activo: true });
    setModal('nuevo');
  };

  const abrirEditar = (p: ShopProducto) => {
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: String(p.precio), stock: String(p.stock), categoria: p.categoria, activo: p.activo });
    setModal(p);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { toast('Nombre requerido', 'warning'); return; }
    if (!form.precio || isNaN(Number(form.precio))) { toast('Precio inválido', 'warning'); return; }
    setSaving(true);
    const payload = {
      clinica_id:  usuario.clinica_id,
      nombre:      form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio:      parseFloat(form.precio),
      stock:       parseInt(form.stock) || 0,
      categoria:   form.categoria,
      activo:      form.activo,
    };
    const { error } = modal === 'nuevo'
      ? await supabase.from('shop_productos').insert(payload)
      : await supabase.from('shop_productos').update(payload).eq('id', (modal as ShopProducto).id);
    if (error) { toast('Error al guardar: ' + error.message, 'error'); setSaving(false); return; }
    toast(modal === 'nuevo' ? 'Producto creado' : 'Producto actualizado', 'success');
    setModal(null);
    cargar();
    setSaving(false);
  };

  const toggleActivo = async (p: ShopProducto) => {
    await supabase.from('shop_productos').update({ activo: !p.activo }).eq('id', p.id);
    cargar();
  };

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.categoria.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ ...S.input, width: '280px' }} />
        <div style={{ flex: 1 }} />
        <button onClick={abrirNuevo} style={{ ...S.btnPrimary, padding: '10px 20px' }}>+ Nuevo producto</button>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '24px', color: tema.textMuted, fontSize: '13px' }}>Cargando...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Nombre', 'Categoría', 'Precio', 'Stock', 'Estado', 'Acciones'].map(h =>
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: ACCENT, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {filtrados.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${tema.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ margin: '0 0 2px', fontWeight: '600', color: tema.text, fontSize: '14px' }}>{p.nombre}</p>
                    {p.descripcion && <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>{p.descripcion}</p>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: tema.textMuted }}>{p.categoria}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: ACCENT }}>${p.precio.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: p.stock <= 3 ? '#f87171' : p.stock <= 10 ? '#fbbf24' : tema.text, fontWeight: '500' }}>{p.stock}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => toggleActivo(p)}
                      style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', cursor: 'pointer', border: `1px solid ${p.activo ? '#16a34a' : tema.border}`, background: p.activo ? '#0a1a0a' : 'transparent', color: p.activo ? '#4ade80' : tema.textMuted }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => abrirEditar(p)}
                      style={{ fontSize: '12px', padding: '5px 12px', background: '#1e1333', color: '#A78BFA', border: '1px solid #5B21B6', borderRadius: '5px', cursor: 'pointer' }}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: tema.textMuted, fontSize: '13px' }}>No hay productos.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <Modal titulo={modal === 'nuevo' ? 'Nuevo producto' : 'Editar producto'} onClose={() => setModal(null)} tema={tema}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} style={S.input} placeholder="Nombre del producto" />
              </div>
              <div>
                <label style={S.label}>Precio ($) *</label>
                <input type="number" min="0" value={form.precio} onChange={e => setForm(p => ({ ...p, precio: e.target.value }))} style={S.input} placeholder="0" />
              </div>
              <div>
                <label style={S.label}>Stock</label>
                <input type="number" min="0" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} style={S.input} placeholder="0" />
              </div>
              <div>
                <label style={S.label}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} style={{ ...S.input, cursor: 'pointer' }}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: tema.text }}>
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} />
                  Activo
                </label>
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={S.label}>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} style={S.input} placeholder="Opcional" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button onClick={guardar} disabled={saving} style={{ ...S.btnPrimary, flex: 1, padding: '12px', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setModal(null)} style={S.btnGhost}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Tab Historial ─────────────────────────────────────────────────────────────

const TabHistorial = ({ usuario, tema, S }: { usuario: Usuario; tema: TemaObj; S: ReturnType<typeof makeS> }) => {
  const [ventas, setVentas]       = useState<Venta[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fecha, setFecha]         = useState(new Date().toISOString().split('T')[0]);
  const [expandida, setExpandida] = useState<string | null>(null);
  const hoy = new Date().toISOString().split('T')[0];

  const cargar = useCallback(async () => {
    setLoading(true);
    const desde = fecha + 'T00:00:00';
    const hasta = fecha + 'T23:59:59';
    const { data } = await supabase
      .from('shop_ventas')
      .select('*, shop_venta_items(cantidad, precio_unitario, shop_productos(nombre))')
      .eq('clinica_id', usuario.clinica_id)
      .gte('created_at', desde)
      .lte('created_at', hasta)
      .order('created_at', { ascending: false });
    setVentas((data || []) as Venta[]);
    setLoading(false);
  }, [usuario.clinica_id, fecha]);

  useEffect(() => { cargar(); }, [cargar]);

  const totalDia = ventas.reduce((s, v) => s + v.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          style={{ ...S.input, width: 'auto', colorScheme: 'dark' }} />
        <button onClick={() => setFecha(hoy)} style={{ ...S.btnGhost, padding: '9px 16px' }}>Hoy</button>
        <div style={{ flex: 1 }} />
        {ventas.length > 0 && (
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: tema.textMuted }}>Total del día: </span>
            <span style={{ fontSize: '16px', fontWeight: '700', color: ACCENT }}>${totalDia.toLocaleString('es-AR')}</span>
            <span style={{ fontSize: '12px', color: tema.textMuted, marginLeft: '12px' }}>{ventas.length} venta{ventas.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: '24px', color: tema.textMuted, fontSize: '13px' }}>Cargando...</p>
        ) : ventas.length === 0 ? (
          <p style={{ padding: '32px', color: tema.textMuted, fontSize: '13px', textAlign: 'center' }}>No hay ventas para este día.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: tema.bgInput }}>
              <tr>{['Hora', 'Ítems', 'Medio de pago', 'Total', ''].map((h, i) =>
                <th key={i} style={{ padding: '11px 16px', textAlign: 'left', color: ACCENT, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {ventas.map(v => {
                const hora = new Date(v.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                const items = v.shop_venta_items || [];
                const abierta = expandida === v.id;
                return (
                  <>
                    <tr key={v.id} style={{ borderBottom: abierta ? 'none' : `1px solid ${tema.border}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = tema.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px', color: tema.textMuted, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{hora}</td>
                      <td style={{ padding: '12px 16px', color: tema.text, fontSize: '13px' }}>{items.length} ítem{items.length !== 1 ? 's' : ''}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '99px', background: '#1e1333', color: '#A78BFA', border: '1px solid #5B21B6' }}>{v.medio_pago}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: ACCENT, fontSize: '14px' }}>${v.total.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={() => setExpandida(abierta ? null : v.id)}
                          style={{ fontSize: '12px', padding: '4px 10px', background: 'transparent', color: tema.textMuted, border: `1px solid ${tema.border}`, borderRadius: '5px', cursor: 'pointer' }}>
                          {abierta ? 'Cerrar ▲' : 'Ver detalle ▼'}
                        </button>
                      </td>
                    </tr>
                    {abierta && (
                      <tr key={v.id + '-detail'} style={{ borderBottom: `1px solid ${tema.border}` }}>
                        <td colSpan={5} style={{ padding: '0 16px 14px 32px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {items.map((it, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: tema.textMuted }}>
                                <span>{it.cantidad}× {it.shop_productos?.nombre}</span>
                                <span style={{ color: tema.text }}>${(it.cantidad * it.precio_unitario).toLocaleString('es-AR')}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────

type Tab = 'pdv' | 'productos' | 'historial';

const SeccionShop = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const [tab, setTab] = useState<Tab>('pdv');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'pdv',       label: 'Punto de venta' },
    { key: 'productos', label: 'Productos' },
    { key: 'historial', label: 'Historial' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: tema.bgCard, border: `1px solid ${tema.border}`, borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.key ? '600' : '400', background: tab === t.key ? ACCENT : 'transparent', color: tab === t.key ? '#EDE9FE' : tema.textMuted, transition: 'background 0.15s, color 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pdv'       && <TabPDV       usuario={usuario} tema={tema} S={S} />}
      {tab === 'productos' && <TabProductos usuario={usuario} tema={tema} S={S} />}
      {tab === 'historial' && <TabHistorial usuario={usuario} tema={tema} S={S} />}
    </div>
  );
};

export default SeccionShop;
