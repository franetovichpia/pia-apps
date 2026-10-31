-- Correr DESPUÉS de supabase.sql (Supabase > SQL Editor > New query > Run)
-- Abre las tablas para usarlas sin login. Cualquiera con la URL del sitio puede ver y editar los datos.

alter table public.globologia_eventos  alter column user_id drop not null, alter column user_id drop default;
alter table public.finanzas_proyectos  alter column user_id drop not null, alter column user_id drop default;
alter table public.finanzas_movs       alter column user_id drop not null, alter column user_id drop default;

-- meses anteriores: un registro por mes
alter table public.finanzas_historico drop constraint if exists finanzas_historico_pkey;
alter table public.finanzas_historico alter column user_id drop not null, alter column user_id drop default;
alter table public.finanzas_historico add primary key (mes);

-- configuración: una sola fila (id = 1)
drop table if exists public.finanzas_config;
create table public.finanzas_config (
  id integer primary key default 1 check (id = 1),
  objetivo_default numeric default 0,
  objetivos jsonb not null default '{}'::jsonb
);

do $$
declare t text;
begin
  foreach t in array array['globologia_eventos','finanzas_proyectos','finanzas_movs','finanzas_historico','finanzas_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo propio" on public.%I', t);
    execute format('drop policy if exists "abierto" on public.%I', t);
    execute format('create policy "abierto" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
