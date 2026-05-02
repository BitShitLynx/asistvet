import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Usuario } from '../supabaseClient';
import { makeS } from '../styles/theme';
import type { TemaObj } from '../styles/theme';
import { useToast } from '../components/toast';

interface StockItem    { id: string; nombre: string; categoria: string; stock: number; unidad: string; }
interface CobroDato    { monto_pagado: number; medio_pago: string; estado_pago: string; tipos_consulta?: { nombre: string } | null; }
interface GastoDato    { monto: number; categoria: string; }
interface TurnoDato    { fecha: string; estado: string; tipos_consulta?: { nombre: string } | null; }
interface ShopVentaDato    { total: number; medio_pago: string; }
interface GroomingFinDato  { precio_total: number; }

const fmtPeso = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;
const hoy = () => new Date().toISOString().split('T')[0];
const primerDiaMes = () => {
  const d = new Date(); d.setDate(1);
  return d.toISOString().split('T')[0];
};

const SeccionReportes = ({ usuario, tema }: { usuario: Usuario; tema: TemaObj }) => {
  const S = makeS(tema);
  const [fechaDesde, setFechaDesde] = useState(primerDiaMes);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();
  const [cobros, setCobros]           = useState<CobroDato[]>([]);
  const [gastos, setGastos]           = useState<GastoDato[]>([]);
  const [turnos, setTurnos]           = useState<TurnoDato[]>([]);
  const [stockBajo, setStockBajo]     = useState<StockItem[]>([]);
  const [shopVentas, setShopVentas]   = useState<ShopVentaDato[]>([]);
  const [groomingFin, setGroomingFin] = useState<GroomingFinDato[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [c, g, t, s, sv, gr] = await Promise.all([
      supabase.from('cobros').select('monto_pagado, medio_pago, estado_pago, fecha_cobro, tipos_consulta(nombre)')
        .eq('clinica_id', usuario.clinica_id)
        .gte('fecha_cobro', fechaDesde + 'T00:00:00')
        .lte('fecha_cobro', fechaHasta + 'T23:59:59'),
      supabase.from('gastos').select('monto, categoria, fecha')
        .eq('clinica_id', usuario.clinica_id)
        .gte('fecha', fechaDesde).lte('fecha', fechaHasta),
      supabase.from('turnos').select('fecha, estado, tipos_consulta(nombre)')
        .eq('clinica_id', usuario.clinica_id)
        .gte('fecha', fechaDesde).lte('fecha', fechaHasta),
      supabase.from('productos').select('id, nombre, categoria, stock_actual, unidad')
        .eq('clinica_id', usuario.clinica_id)
        .lte('stock_actual', 5)
        .order('stock_actual'),
      supabase.from('shop_ventas').select('total, medio_pago')
        .eq('clinica_id', usuario.clinica_id)
        .gte('created_at', fechaDesde + 'T00:00:00')
        .lte('created_at', fechaHasta + 'T23:59:59'),
      supabase.from('grooming_turnos').select('precio_total')
        .eq('clinica_id', usuario.clinica_id)
        .eq('estado', 'finalizado')
        .gte('fecha', fechaDesde).lte('fecha', fechaHasta),
    ]);
    setCobros(c.data || []);
    setGastos(g.data || []);
    setTurnos(t.data || []);
    setStockBajo((s.data || []).map((p: any) => ({
      id: p.id, nombre: p.nombre, categoria: p.categoria || 'Otro',
      stock: Number(p.stock_actual ?? 0), unidad: p.unidad || 'unidad',
    })));
    setShopVentas(sv.data || []);
    setGroomingFin(gr.data || []);
    if (c.error || g.error || t.error || sv.error || gr.error) {
      toast('Algunos datos no pudieron cargarse', 'warning');
    }
    setLoading(false);
  }, [usuario.clinica_id, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Cálculos ────────────────────────────────────────────────────────────────
  const totalConsultas = cobros.filter(c => c.estado_pago !== 'pendiente').reduce((a, c) => a + (c.monto_pagado || 0), 0);
  const totalShop      = shopVentas.reduce((a, v) => a + (v.total || 0), 0);
  const totalGrooming  = groomingFin.reduce((a, t) => a + (t.precio_total || 0), 0);
  const totalIngresos  = totalConsultas + totalShop + totalGrooming;
  const totalGastos    = gastos.reduce((a, g) => a + (g.monto || 0), 0);
  const balance        = totalIngresos - totalGastos;

  const ingresosEfectivo      = cobros.filter(c => c.medio_pago === 'efectivo').reduce((a, c) => a + (c.monto_pagado || 0), 0)
    + shopVentas.filter(v => v.medio_pago === 'Efectivo').reduce((a, v) => a + (v.total || 0), 0);
  const ingresosTransferencia = cobros.filter(c => c.medio_pago === 'transferencia').reduce((a, c) => a + (c.monto_pagado || 0), 0)
    + shopVentas.filter(v => v.medio_pago === 'Transferencia').reduce((a, v) => a + (v.total || 0), 0);
  const ingresosDebito        = shopVentas.filter(v => v.medio_pago === 'Débito').reduce((a, v) => a + (v.total || 0), 0);
  const ingresosCredito       = shopVentas.filter(v => v.medio_pago === 'Crédito').reduce((a, v) => a + (v.total || 0), 0);
  const ingresosMP            = shopVentas.filter(v => v.medio_pago === 'MercadoPago').reduce((a, v) => a + (v.total || 0), 0);

  // Top tipos de consulta
  const conteoTipos: Record<string, number> = {};
  turnos.forEach(t => {
    const nombre = t.tipos_consulta?.nombre || 'Sin tipo';
    conteoTipos[nombre] = (conteoTipos[nombre] || 0) + 1;
  });
  const topTipos = Object.entries(conteoTipos)
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTipo = topTipos[0]?.[1] || 1;

  // Turnos por día (últimos 14 días del período)
  const conteoFechas: Record<string, number> = {};
  turnos.forEach(t => { conteoFechas[t.fecha] = (conteoFechas[t.fecha] || 0) + 1; });
  const fechasOrdenadas = Object.entries(conteoFechas)
    .sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const maxTurnos = Math.max(...fechasOrdenadas.map(f => f[1]), 1);

  // Gastos por categoría
  const CATS: Record<string, { label: string; color: string }> = {
    insumos:   { label: 'Insumos',   color: '#22c55e' },
    servicios: { label: 'Servicios', color: '#38bdf8' },
    sueldos:   { label: 'Sueldos',   color: '#a78bfa' },
    otros:     { label: 'Otros',     color: '#fb923c' },
  };
  const gastosPorCat = Object.entries(CATS).map(([k, v]) => ({
    ...v, total: gastos.filter(g => g.categoria === k).reduce((a, g) => a + g.monto, 0),
  })).filter(c => c.total > 0);

  const barW = (val: number, max: number) => `${Math.max(4, Math.round((val / max) * 100))}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: tema.textMuted, fontSize: '13px' }}>Período:</span>
        <input type="date" style={{ ...S.input, width: '145px', colorScheme: 'dark' }} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
        <span style={{ color: tema.textMuted, fontSize: '13px' }}>→</span>
        <input type="date" style={{ ...S.input, width: '145px', colorScheme: 'dark' }} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
        {[
          { label: 'Este mes', desde: primerDiaMes(), hasta: hoy() },
          { label: 'Últimos 7 días', desde: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0], hasta: hoy() },
          { label: 'Últimos 30 días', desde: new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0], hasta: hoy() },
        ].map(({ label, desde, hasta }) => (
          <button key={label} onClick={() => { setFechaDesde(desde); setFechaHasta(hasta); }}
            style={{ ...S.btnGhost, padding: '8px 14px', fontSize: '12px' }}>{label}</button>
        ))}
      </div>

      {loading && <p style={{ color: tema.textMuted }}>Cargando reportes...</p>}

      {/* Balance principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
        {[
          { label: 'Total ingresos', val: fmtPeso(totalIngresos), color: '#22c55e', sub: `consultas + shop + grooming` },
          { label: 'Total gastos',   val: fmtPeso(totalGastos),   color: '#f87171', sub: `${gastos.length} registros` },
          { label: 'Balance neto',   val: fmtPeso(balance),       color: balance >= 0 ? '#22c55e' : '#f87171', sub: balance >= 0 ? '✅ Positivo' : '⚠️ Negativo' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} style={{ ...S.card, textAlign: 'center', borderColor: color + '44' }}>
            <p style={{ margin: 0, fontSize: '26px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 2px', fontSize: '12px', color: tema.textMuted, textTransform: 'uppercase' }}>{label}</p>
            <p style={{ margin: 0, fontSize: '12px', color: tema.textMuted }}>{sub}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Ingresos por fuente y medios de pago */}
        <div style={{ ...S.card }}>
          <h4 style={{ margin: '0 0 16px', color: tema.text, textAlign: 'center' }}>📈 Ingresos por fuente</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: '🩺 Consultas',  val: totalConsultas, color: '#22c55e' },
              { label: '🛒 Shop',       val: totalShop,      color: '#8B5CF6' },
              { label: '✂️ Grooming',   val: totalGrooming,  color: '#A78BFA' },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: tema.text }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color }}>{fmtPeso(val)}</span>
                </div>
                <div style={{ background: tema.bgInput, borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: barW(val, totalIngresos || 1), height: '100%', background: color, borderRadius: '99px', transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
            <p style={{ margin: '8px 0 4px', fontSize: '12px', color: tema.textMuted, textTransform: 'uppercase' }}>Medios de pago</p>
            {([
              { label: '💵 Efectivo',      val: ingresosEfectivo,      color: '#22c55e' },
              { label: '📱 Transferencia', val: ingresosTransferencia, color: '#38bdf8' },
              { label: '💳 Débito',        val: ingresosDebito,        color: '#f59e0b' },
              { label: '💳 Crédito',       val: ingresosCredito,       color: '#ec4899' },
              { label: '🟦 MercadoPago',   val: ingresosMP,            color: '#06b6d4' },
            ] as { label: string; val: number; color: string }[]).filter(m => m.val > 0).map(({ label, val, color }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: tema.text }}>{label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color }}>{fmtPeso(val)}</span>
                </div>
                <div style={{ background: tema.bgInput, borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: barW(val, totalIngresos || 1), height: '100%', background: color, borderRadius: '99px', transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
            {gastosPorCat.length > 0 && (
              <>
                <p style={{ margin: '8px 0 4px', fontSize: '12px', color: tema.textMuted, textTransform: 'uppercase' }}>Gastos por categoría</p>
                {gastosPorCat.map(c => (
                  <div key={c.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: tema.text }}>{c.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: c.color }}>{fmtPeso(c.total)}</span>
                    </div>
                    <div style={{ background: tema.bgInput, borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: barW(c.total, totalGastos || 1), height: '100%', background: c.color, borderRadius: '99px', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Top tipos de consulta */}
        <div style={{ ...S.card }}>
          <h4 style={{ margin: '0 0 16px', color: tema.text, textAlign: 'center' }}>📊 Top tipos de consulta</h4>
          {topTipos.length === 0
            ? <p style={{ color: tema.textMuted, textAlign: 'center' }}>Sin datos en el período.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topTipos.map(([nombre, count], i) => (
                  <div key={nombre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', color: tema.text }}>{i + 1}. {nombre}</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#22c55e' }}>{count} turnos</span>
                    </div>
                    <div style={{ background: tema.bgInput, borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: barW(count, maxTipo), height: '100%', background: '#22c55e', borderRadius: '99px', opacity: 1 - i * 0.15, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Turnos por día */}
      <div style={{ ...S.card }}>
        <h4 style={{ margin: '0 0 20px', color: tema.text, textAlign: 'center' }}>📅 Turnos por día</h4>
        {fechasOrdenadas.length === 0
          ? <p style={{ color: tema.textMuted, textAlign: 'center' }}>Sin turnos en el período.</p>
          : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingBottom: '4px' }}>
              {fechasOrdenadas.map(([fecha, count]) => {
                const pct = Math.max(8, Math.round((count / maxTurnos) * 100));
                const d = new Date(fecha + 'T00:00:00');
                const label = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                return (
                  <div key={fecha} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 'bold' }}>{count}</span>
                    <div style={{ width: '100%', background: '#22c55e', borderRadius: '4px 4px 0 0', height: `${pct}%`, minHeight: '8px', transition: 'height 0.4s' }} />
                    <span style={{ fontSize: '10px', color: tema.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Alertas de stock bajo */}
      <div style={{ ...S.card, border: stockBajo.length > 0 ? '1px solid #d97706' : `1px solid ${tema.border}` }}>
        <h4 style={{ margin: '0 0 14px', color: stockBajo.length > 0 ? '#fbbf24' : tema.text, textAlign: 'center' }}>
          {stockBajo.length > 0 ? `⚠️ Stock bajo — ${stockBajo.length} producto${stockBajo.length !== 1 ? 's' : ''}` : '✅ Stock en niveles normales'}
        </h4>
        {stockBajo.length === 0
          ? <p style={{ color: tema.textMuted, textAlign: 'center', fontSize: '13px' }}>Todos los productos tienen stock suficiente.</p>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {stockBajo.map(p => {
                const color = p.stock === 0 ? '#dc2626' : '#d97706';
                return (
                  <div key={p.id} style={{ background: tema.bgInput, padding: '12px', borderRadius: '8px', border: `1px solid ${color}44` }}>
                    <p style={{ margin: 0, fontWeight: 'bold', color: tema.text, fontSize: '13px' }}>{p.nombre}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: tema.textMuted }}>{p.categoria}</p>
                    <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', background: color, padding: '2px 10px', borderRadius: '99px', color: 'white', fontWeight: 'bold' }}>
                      {p.stock === 0 ? 'Sin stock' : `${p.stock} ${p.unidad}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* Resumen rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { label: 'Total turnos',     val: turnos.length,                                               color: '#22c55e' },
          { label: 'Finalizados',      val: turnos.filter(t => t.estado === 'finalizado').length,        color: '#38bdf8' },
          { label: 'Cancelados',       val: turnos.filter(t => t.estado === 'cancelado').length,         color: '#f87171' },
          { label: 'Ticket promedio',  val: cobros.length > 0 ? fmtPeso(totalConsultas / cobros.length) : '$0', color: '#a78bfa' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ ...S.card, textAlign: 'center', borderColor: color + '44' }}>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color }}>{val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: tema.textMuted, textTransform: 'uppercase' }}>{label}</p>
          </div>
        ))}
      </div>

    </div>
  );
};

export default SeccionReportes;
