-- Módulo Delivery
CREATE TABLE delivery_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id uuid NOT NULL REFERENCES clinicas(id),
  propietario_id uuid NOT NULL REFERENCES propietarios(id),
  direccion_entrega text NOT NULL,
  notas text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','en_preparacion','en_camino','entregado','cancelado')),
  total numeric NOT NULL DEFAULT 0,
  medio_pago text CHECK (medio_pago IN ('efectivo','transferencia','tarjeta')),
  fecha_pedido timestamptz NOT NULL DEFAULT now(),
  fecha_entrega timestamptz
);

CREATE TABLE delivery_pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES delivery_pedidos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES shop_productos(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0)
);

-- Índices
CREATE INDEX ON delivery_pedidos(clinica_id, fecha_pedido DESC);
CREATE INDEX ON delivery_pedido_items(pedido_id);

-- RLS
ALTER TABLE delivery_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_pedido_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinica_delivery_pedidos" ON delivery_pedidos FOR ALL
  USING (clinica_id = (
    SELECT clinica_id FROM usuarios WHERE id = auth.uid() LIMIT 1
  ));

CREATE POLICY "clinica_delivery_items" ON delivery_pedido_items FOR ALL
  USING (pedido_id IN (
    SELECT id FROM delivery_pedidos
    WHERE clinica_id = (SELECT clinica_id FROM usuarios WHERE id = auth.uid() LIMIT 1)
  ));
