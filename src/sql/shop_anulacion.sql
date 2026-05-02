-- Agrega soporte para anulación de ventas en Shop
-- Ejecutar una sola vez en Supabase SQL Editor

ALTER TABLE shop_ventas
  ADD COLUMN IF NOT EXISTS anulada boolean NOT NULL DEFAULT false;
