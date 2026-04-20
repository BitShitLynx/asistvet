create table if not exists grooming_turnos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid references clinicas(id) on delete cascade,
  paciente_id uuid references pacientes(id),
  fecha date not null,
  hora time,
  servicios text[] default '{}',
  precio_total numeric(10,2) default 0,
  estado text default 'pendiente',
  observaciones text,
  created_at timestamptz default now()
);

alter table grooming_turnos enable row level security;

create policy "clinica_grooming" on grooming_turnos for all
  using (clinica_id = (
    select clinica_id from usuarios
    where id = auth.uid() limit 1
  ));
