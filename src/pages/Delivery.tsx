import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';
import { Modal } from '../components/shared';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Propietario {
  id: string;
  nombre: string;
}

interface ShopProducto {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
}

interface ItemCarrito {
  producto_id: string;
  nombre_producto: string;
  cantidad: number;
  precio_unitario: number;
}

interface PedidoItem {
  id: string;
  cantidad: number;
  precio_unitario: number;
  producto_id: string;
  shop_productos: { nombre: string } | null;
}

interface Pedido {
  id: string;
  propietario_id: string;
  propietarios: { nombre: string } | null;
  direccion_entrega: string;
  notas: string | null;
  estado: string;
  total: number;
  medio_pago: string | null;
  fecha_pedido: string;
  fecha_entrega: string | null;
  items?: PedidoItem[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS = ['pendiente', 'en_preparacion', 'en_camino', 'entregado', 'cancelado'] as const;
type EstadoPedido = typeof ESTADOS[number];

const ESTADO_SIGUIENTE: Partial<Record<EstadoPedido, EstadoPedido>> = {
  pendiente:      'en_preparacion',
  en_preparacion: 'en_camino',
  en_camino:      'entregado',
};

const ESTADO_COLOR: Record<EstadoPedido, { bg: string; color: string; border: string; label: string }> = {
  pendiente:      { bg: '#1a1a2a', color: '#7a7aee', border: '#3a3a8a', label: 'Pendiente' },
  en_preparacion: { bg: '#2a1a0a', color: '#e0a040', border: '#7a5020', label: 'En preparación' },
  en_camino:      { bg: '#0a1a2a', color: '#4090d0', border: '#1a4a7a', label: 'En camino' },
  entregado:      { bg: '#0a1a0a', color: '#50a050', border: '#1a5a1a', label: 'Entregado' },
  cancelado:      { bg: '#1a0a0a', color: '#c06060', border: '#6a2020', label: 'Cancelado' },
};

const MEDIOS_PAGO = ['efectivo', 'transferencia', 'tarjeta'] as const;

const FORM_VACIO = () => ({
  propietario_id:    '',
  direccion_entrega: '',
  notas:             '',
});

// ── Componente ────────────────────────────────────────────────────────────────

const SeccionDelivery = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const { toast } = useToast();

  const [pedidos, setPedidos]           = useState<Pedido[]>([]);
  const [propietarios, setPropietarios] = useState<Propietario[]>([]);
  const [productos, setProductos]       = useState<ShopProducto[]>([]);
  const [cargando, setCargando]         = useState(true);

  const [pedidoModal, setPedidoModal]   = useState<Pedido | 'nuevo' | null>(null);
  const [form, setForm]                 = useState(FORM_VACIO());
  const [carrito, setCarrito]           = useState<ItemCarrito[]>([]);
  const [guardando, setGuardando]       = useState(false);

  const [cobroModal, setCobroModal]     = useState<Pedido | null>(null);
  const [medioPago, setMedioPago]       = useState<string>('efectivo');
  const [cobrando, setCobrando]         = useState(false);

  const [cancelarModal, setCancelarModal] = useState<Pedido | null>(null);
  const [cancelando, setCancelando]       = useState(false);

  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  const modoEdicion = pedidoModal !== null && pedidoModal !== 'nuevo';

  // ── Carga ─────────────────────────────────────────────────────────────────

  const cargar = useCallback(async () => {
    setCargando(true);
    const [{ data: pedidosData }, { data: propData }, { data: prodData }] = await Promise.all([
      supabase
        .from('delivery_pedidos')
        .select('*, propietarios(nombre), items:delivery_pedido_items(id, cantidad, precio_unitario, producto_id, shop_productos(nombre))')
        .eq('clinica_id', usuario.clinica_id)
        .order('fecha_pedido', { ascending: false })
        .limit(100),
      supabase
        .from('propietarios')
        .select('id, nombre')
        .eq('clinica_id', usuario.clinica_id)
        .order('nombre'),
      supabase
        .from('shop_productos')
        .select('id, nombre, precio, stock')
        .eq('clinica_id', usuario.clinica_id)
        .eq('activo', true)
        .order('nombre'),
    ]);
    setPedidos((pedidosData || []) as Pedido[]);
    setPropietarios((propData || []) as Propietario[]);
    setProductos((prodData || []) as ShopProducto[]);
    setCargando(false);
  }, [usuario.clinica_id]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Carrito ───────────────────────────────────────────────────────────────

  const agregarProducto = (p: ShopProducto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === p.id);
      if (existe) {
        const disponible = p.stock - existe.cantidad;
        if (disponible <= 0) { toast('Stock insuficiente', 'warning'); return prev; }
        return prev.map(i => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      if (p.stock < 1) { toast('Sin stock', 'warning'); return prev; }
      return [...prev, { producto_id: p.id, nombre_producto: p.nombre, cantidad: 1, precio_unitario: p.precio }];
    });
  };

  const cambiarCantidad = (pid: string, delta: number) => {
    setCarrito(prev => prev.map(i => {
      if (i.producto_id !== pid) return i;
      const nueva = i.cantidad + delta;
      if (nueva <= 0) return i;
      const prod = productos.find(p => p.id === pid);
      if (prod && nueva > prod.stock) { toast('Stock insuficiente', 'warning'); return i; }
      return { ...i, cantidad: nueva };
    }));
  };

  const quitarItem = (pid: string) => setCarrito(prev => prev.filter(i => i.producto_id !== pid));

  const totalCarrito = carrito.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);

  // ── Abrir modales ─────────────────────────────────────────────────────────

  const abrirNuevo = () => {
    setForm(FORM_VACIO());
    setCarrito([]);
    setPedidoModal('nuevo');
  };

  const abrirEditar = (p: Pedido) => {
    setForm({
      propietario_id:    p.propietario_id,
      direccion_entrega: p.direccion_entrega,
      notas:             p.notas || '',
    });
    setCarrito(
      (p.items || []).map(it => ({
        producto_id:     it.producto_id,
        nombre_producto: it.shop_productos?.nombre || '',
        cantidad:        it.cantidad,
        precio_unitario: it.precio_unitario,
      }))
    );
    setPedidoModal(p);
  };

  // ── Guardar pedido ────────────────────────────────────────────────────────

  const guardar = async () => {
    if (!form.propietario_id)          { toast('Seleccioná un propietario', 'warning'); return; }
    if (!form.direccion_entrega.trim()) { toast('Ingresá la dirección de entrega', 'warning'); return; }
    if (carrito.length === 0)          { toast('Agregá al menos un producto', 'warning'); return; }

    setGuardando(true);
    const total = totalCarrito;

    if (modoEdicion) {
      const pedido = pedidoModal as Pedido;
      const { error } = await supabase
        .from('delivery_pedidos')
        .update({ propietario_id: form.propietario_id, direccion_entrega: form.direccion_entrega.trim(), notas: form.notas.trim() || null, total })
        .eq('id', pedido.id);
      if (error) { toast('Error al guardar: ' + error.message, 'error'); setGuardando(false); return; }

      await supabase.from('delivery_pedido_items').delete().eq('pedido_id', pedido.id);
      const { error: errItems } = await supabase.from('delivery_pedido_items').insert(
        carrito.map(i => ({ pedido_id: pedido.id, producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      );
      if (errItems) { toast('Error al guardar ítems', 'error'); setGuardando(false); return; }

    } else {
      const { data: nuevo, error } = await supabase
        .from('delivery_pedidos')
        .insert({ clinica_id: usuario.clinica_id, propietario_id: form.propietario_id, direccion_entrega: form.direccion_entrega.trim(), notas: form.notas.trim() || null, estado: 'pendiente', total })
        .select()
        .single();
      if (error || !nuevo) { toast('Error al crear pedido', 'error'); setGuardando(false); return; }

      const { error: errItems } = await supabase.from('delivery_pedido_items').insert(
        carrito.map(i => ({ pedido_id: nuevo.id, producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      );
      if (errItems) { toast('Error al guardar ítems', 'error'); setGuardando(false); return; }

      // Decrementar stock al crear el pedido; si alguno falla, rollback best-effort de los exitosos
      const decrementados: { id: string; cantidad: number }[] = [];
      const errStock: string[] = [];
      for (const item of carrito) {
        const prod = productos.find(p => p.id === item.producto_id);
        if (!prod) continue;
        const { error: e } = await supabase
          .from('shop_productos')
          .update({ stock: prod.stock - item.cantidad })
          .eq('id', item.producto_id);
        if (e) {
          errStock.push(item.nombre_producto);
        } else {
          decrementados.push({ id: item.producto_id, cantidad: item.cantidad });
        }
      }
      if (errStock.length > 0) {
        for (const d of decrementados) {
          const { data: curr } = await supabase.from('shop_productos').select('stock').eq('id', d.id).single();
          if (curr) await supabase.from('shop_productos').update({ stock: curr.stock + d.cantidad }).eq('id', d.id);
        }
        toast(`Stock no ajustado: ${errStock.join(', ')}. Revisá el inventario.`, 'warning');
      }
    }

    toast(modoEdicion ? 'Pedido actualizado' : 'Pedido creado', 'success');
    setPedidoModal(null);
    setGuardando(false);
    cargar();
  };

  // ── Avanzar estado ────────────────────────────────────────────────────────

  const avanzarEstado = async (pedido: Pedido) => {
    const siguiente = ESTADO_SIGUIENTE[pedido.estado as EstadoPedido];
    if (!siguiente) return;

    if (siguiente === 'entregado') {
      setMedioPago('efectivo');
      setCobroModal(pedido);
      return;
    }

    const { error } = await supabase
      .from('delivery_pedidos')
      .update({ estado: siguiente })
      .eq('id', pedido.id);
    if (error) { toast('Error al actualizar estado', 'error'); return; }
    toast(`${ESTADO_COLOR[siguiente].label}`, 'success');
    cargar();
  };

  // ── Confirmar entrega (cobro) ─────────────────────────────────────────────

  const confirmarEntrega = async () => {
    if (!cobroModal) return;
    setCobrando(true);
    const { error } = await supabase
      .from('delivery_pedidos')
      .update({ estado: 'entregado', medio_pago: medioPago, fecha_entrega: new Date().toISOString() })
      .eq('id', cobroModal.id);
    if (error) { toast('Error al registrar entrega', 'error'); setCobrando(false); return; }
    toast('Entrega registrada', 'success');
    setCobroModal(null);
    setCobrando(false);
    cargar();
  };

  // ── Cancelar pedido ───────────────────────────────────────────────────────

  const cancelar = async () => {
    if (!cancelarModal) return;
    setCancelando(true);

    const { error } = await supabase
      .from('delivery_pedidos')
      .update({ estado: 'cancelado' })
      .eq('id', cancelarModal.id);
    if (error) { toast('Error al cancelar', 'error'); setCancelando(false); return; }

    // Restaurar stock — acumular errores para reportar con precisión
    const errRestore: string[] = [];
    for (const item of cancelarModal.items || []) {
      const { data: prod } = await supabase.from('shop_productos').select('stock').eq('id', item.producto_id).single();
      if (prod) {
        const { error: e } = await supabase.from('shop_productos').update({ stock: prod.stock + item.cantidad }).eq('id', item.producto_id);
        if (e) errRestore.push(item.shop_productos?.nombre || item.producto_id);
      } else {
        errRestore.push(item.shop_productos?.nombre || item.producto_id);
      }
    }

    const msgCancelar = errRestore.length === 0
      ? 'Pedido cancelado. Stock restaurado.'
      : `Pedido cancelado. Stock no restaurado: ${errRestore.join(', ')}.`;
    toast(msgCancelar, errRestore.length === 0 ? 'success' : 'warning');
    setCancelarModal(null);
    setCancelando(false);
    cargar();
  };

  // ── Vista ─────────────────────────────────────────────────────────────────

  const pedidosFiltrados = filtroEstado === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado === filtroEstado);

  const contadores = ESTADOS.reduce((acc, e) => {
    acc[e] = pedidos.filter(p => p.estado === e).length;
    return acc;
  }, {} as Record<string, number>);

  const activos = pedidos.filter(p => !['entregado', 'cancelado'].includes(p.estado)).length;

  const inputStyle = {
    background: tema.bg, color: tema.text, border: `1px solid ${tema.border}`,
    borderRadius: '6px', padding: '9px 12px', width: '100%',
    boxSizing: 'border-box' as const, fontSize: '13px',
  };
  const labelStyle = {
    fontSize: '11px', color: tema.textMuted, marginBottom: '6px',
    display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.08em',
  };

  const BadgeEstado = ({ estado }: { estado: string }) => {
    const c = ESTADO_COLOR[estado as EstadoPedido] || ESTADO_COLOR.pendiente;
    return (
      <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px', background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: '500', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
        {c.label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '600', color: tema.text }}>Delivery</h1>
          <p style={{ margin: 0, fontSize: '13px', color: tema.textMuted }}>
            {activos} pedido{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={abrirNuevo} style={{ ...S.btnPrimary }}>+ Nuevo pedido</button>
      </div>

      {/* Filtros por estado */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => setFiltroEstado('todos')} style={{
          padding: '6px 14px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: '500',
          background: filtroEstado === 'todos' ? tema.accent : 'transparent',
          color: filtroEstado === 'todos' ? '#fff' : tema.textMuted,
          border: `1px solid ${filtroEstado === 'todos' ? tema.accent : tema.border}`,
        }}>
          Todos ({pedidos.length})
        </button>
        {ESTADOS.map(e => {
          const c = ESTADO_COLOR[e];
          const activo = filtroEstado === e;
          return (
            <button key={e} onClick={() => setFiltroEstado(e)} style={{
              padding: '6px 14px', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: '500',
              background: activo ? c.bg : 'transparent',
              color: activo ? c.color : tema.textMuted,
              border: `1px solid ${activo ? c.border : tema.border}`,
            }}>
              {c.label} ({contadores[e] || 0})
            </button>
          );
        })}
      </div>

      {/* Lista */}
      {cargando ? (
        <p style={{ color: tema.textMuted, fontSize: '13px' }}>Cargando pedidos...</p>
      ) : pedidosFiltrados.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '48px' }}>
          <p style={{ color: tema.textMuted, fontSize: '14px' }}>
            No hay pedidos{filtroEstado !== 'todos' ? ` en estado "${ESTADO_COLOR[filtroEstado as EstadoPedido]?.label}"` : ''}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pedidosFiltrados.map(p => {
            const siguiente = ESTADO_SIGUIENTE[p.estado as EstadoPedido];
            const esActivo = !['entregado', 'cancelado'].includes(p.estado);
            return (
              <div key={p.id} style={{
                ...S.card,
                opacity: p.estado === 'cancelado' ? 0.6 : 1,
                borderLeft: `3px solid ${ESTADO_COLOR[p.estado as EstadoPedido]?.border || tema.border}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>

                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600', color: tema.text }}>
                        {p.propietarios?.nombre || '—'}
                      </span>
                      <BadgeEstado estado={p.estado} />
                    </div>
                    <p style={{ margin: '0 0 3px', fontSize: '13px', color: tema.textMuted }}>📍 {p.direccion_entrega}</p>
                    {p.notas && (
                      <p style={{ margin: '0 0 3px', fontSize: '12px', color: tema.textMuted, fontStyle: 'italic' }}>{p.notas}</p>
                    )}
                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: tema.textMuted }}>
                      {new Date(p.fecha_pedido).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {p.medio_pago && ` · ${p.medio_pago}`}
                    </p>
                    {(p.items || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {(p.items || []).map(it => (
                          <span key={it.id} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '3px', background: tema.rowHover, color: tema.textMuted, border: `1px solid ${tema.border}` }}>
                            {it.cantidad}× {it.shop_productos?.nombre}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: tema.text }}>
                      ${p.total.toLocaleString('es-AR')}
                    </span>
                    {esActivo && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {siguiente && (
                          <button onClick={() => avanzarEstado(p)} style={{
                            padding: '6px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer', fontWeight: '500',
                            background: ESTADO_COLOR[siguiente].bg, color: ESTADO_COLOR[siguiente].color,
                            border: `1px solid ${ESTADO_COLOR[siguiente].border}`,
                          }}>
                            → {ESTADO_COLOR[siguiente].label}
                          </button>
                        )}
                        {p.estado === 'pendiente' && (
                          <button onClick={() => abrirEditar(p)} style={{ ...S.btnSecondary, padding: '6px 12px', fontSize: '12px' }}>
                            ✏️ Editar
                          </button>
                        )}
                        <button onClick={() => setCancelarModal(p)} style={{
                          padding: '6px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer', fontWeight: '500',
                          background: '#1a0a0a', color: '#c06060', border: '1px solid #6a2020',
                        }}>
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal crear/editar pedido */}
      {pedidoModal !== null && (
        <Modal titulo={modoEdicion ? 'Editar pedido' : 'Nuevo pedido'} onClose={() => setPedidoModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div>
              <label style={labelStyle}>Propietario</label>
              <select value={form.propietario_id} onChange={e => setForm(f => ({ ...f, propietario_id: e.target.value }))} style={inputStyle}>
                <option value="">Seleccionar...</option>
                {propietarios.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Dirección de entrega</label>
              <input
                type="text"
                value={form.direccion_entrega}
                onChange={e => setForm(f => ({ ...f, direccion_entrega: e.target.value }))}
                placeholder="Calle 123, Piso 4, Dto B"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Notas</label>
              <textarea
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                placeholder="Instrucciones adicionales..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Productos disponibles</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', maxHeight: '120px', overflowY: 'auto' }}>
                {productos.map(p => (
                  <button key={p.id} onClick={() => agregarProducto(p)} style={{
                    padding: '6px 12px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer',
                    background: tema.rowHover, color: tema.text, border: `1px solid ${tema.border}`,
                  }}>
                    {p.nombre} <span style={{ color: tema.textMuted }}>${p.precio} · stock {p.stock}</span>
                  </button>
                ))}
              </div>

              <label style={labelStyle}>Pedido</label>
              {carrito.length === 0 ? (
                <p style={{ fontSize: '12px', color: tema.textMuted }}>Sin productos.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {carrito.map(it => (
                    <div key={it.producto_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: tema.rowHover, borderRadius: '5px', border: `1px solid ${tema.border}` }}>
                      <span style={{ fontSize: '13px', color: tema.text, flex: 1 }}>{it.nombre_producto}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={() => cambiarCantidad(it.producto_id, -1)} style={{ width: '24px', height: '24px', border: `1px solid ${tema.border}`, background: 'transparent', color: tema.text, cursor: 'pointer', borderRadius: '4px', fontSize: '14px' }}>−</button>
                        <span style={{ fontSize: '13px', color: tema.text, minWidth: '20px', textAlign: 'center' }}>{it.cantidad}</span>
                        <button onClick={() => cambiarCantidad(it.producto_id, 1)} style={{ width: '24px', height: '24px', border: `1px solid ${tema.border}`, background: 'transparent', color: tema.text, cursor: 'pointer', borderRadius: '4px', fontSize: '14px' }}>+</button>
                        <span style={{ fontSize: '13px', color: tema.textMuted, minWidth: '72px', textAlign: 'right' }}>${(it.precio_unitario * it.cantidad).toLocaleString('es-AR')}</span>
                        <button onClick={() => quitarItem(it.producto_id)} style={{ background: 'transparent', border: 'none', color: '#c06060', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: `1px solid ${tema.border}` }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: tema.text }}>
                      Total: ${totalCarrito.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
              <button onClick={() => setPedidoModal(null)} style={{ ...S.btnSecondary }}>Cancelar</button>
              <button onClick={guardar} disabled={guardando} style={{ ...S.btnPrimary }}>
                {guardando ? 'Guardando...' : modoEdicion ? 'Guardar cambios' : 'Crear pedido'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal cobro al entregar */}
      {cobroModal && (
        <Modal titulo="Registrar entrega" onClose={() => setCobroModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: tema.text }}>
              Pedido de <strong>{cobroModal.propietarios?.nombre}</strong> por{' '}
              <strong>${cobroModal.total.toLocaleString('es-AR')}</strong>
            </p>
            <div>
              <label style={labelStyle}>Medio de pago</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {MEDIOS_PAGO.map(m => (
                  <button key={m} onClick={() => setMedioPago(m)} style={{
                    padding: '8px 16px', borderRadius: '5px', fontSize: '13px', cursor: 'pointer', fontWeight: '500',
                    background: medioPago === m ? tema.accent : 'transparent',
                    color: medioPago === m ? '#fff' : tema.textMuted,
                    border: `1px solid ${medioPago === m ? tema.accent : tema.border}`,
                    textTransform: 'capitalize',
                  }}>{m}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCobroModal(null)} style={{ ...S.btnSecondary }}>Cancelar</button>
              <button onClick={confirmarEntrega} disabled={cobrando} style={{ ...S.btnPrimary }}>
                {cobrando ? 'Registrando...' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmar cancelación */}
      {cancelarModal && (
        <Modal titulo="Cancelar pedido" onClose={() => setCancelarModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', color: tema.text }}>
              ¿Cancelar el pedido de <strong>{cancelarModal.propietarios?.nombre}</strong>?
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>
              Se restaurará el stock de los productos del pedido.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setCancelarModal(null)} style={{ ...S.btnSecondary }}>Volver</button>
              <button onClick={cancelar} disabled={cancelando} style={{
                padding: '9px 20px', background: '#1a0a0a', color: '#c06060', border: '1px solid #6a2020',
                borderRadius: '6px', cursor: cancelando ? 'default' : 'pointer', fontSize: '13px', fontWeight: '500',
              }}>
                {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SeccionDelivery;
