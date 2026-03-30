-- ══════════════════════════════════════════════
-- ALTA DE NUEVA CLÍNICA — ValVet by Lynx
-- ══════════════════════════════════════════════

-- PASO 1: Crear la clínica
insert into clinicas (id, nombre, telefono, email)
values (
  gen_random_uuid(),
  'NOMBRE_CLINICA',
  'TELEFONO',
  'EMAIL_CLINICA'
);

-- PASO 2: Ver el ID generado
select id from clinicas where nombre = 'NOMBRE_CLINICA';

-- PASO 3: Crear usuario en Supabase Dashboard
-- Authentication → Users → Add user
-- Copiar el UUID generado

-- PASO 4: Vincular usuario a la clínica
insert into usuarios (id, clinica_id, nombre, rol, email, activo)
values (
  'UUID_AUTH_USUARIO',
  'UUID_CLINICA',
  'NOMBRE_USUARIO',
  'admin',
  'EMAIL_USUARIO',
  true
);

-- PASO 5: Para agregar más usuarios a la misma clínica
-- repetir pasos 3 y 4 con rol veterinario o recepcionista

-- PASO 6: Cargar catálogo inicial de productos para la nueva clínica
-- Reemplazar UUID_CLINICA por el ID real de la clínica creada

insert into productos (clinica_id, nombre, categoria, especie, dosis, vias, stock_actual, unidad)
select
  'UUID_CLINICA',
  nombre, categoria, especie, dosis, vias,
  0 as stock_actual,  -- stock en 0 para clínica nueva
  unidad
from productos
where clinica_id = 'aaaaaaaa-0000-0000-0000-000000000001';
