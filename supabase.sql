-- Pegar TODO en Supabase > SQL Editor > New query > Run

-- ===== GLOBOLOGÍA =====
-- Globología · tabla de eventos (pegar en Supabase > SQL Editor > Run)
create table if not exists public.globologia_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente text not null,
  contacto text,
  fecha date,
  localidad text,
  tematica text,
  colores text,
  mesas integer default 0,
  mesas_detalle text,
  estructura text,
  items jsonb not null default '[]'::jsonb,   -- [{concepto, monto}] = gastos del evento
  margen numeric default 100,                  -- % de ganancia deseada sobre los gastos (cotizador)
  precio numeric default 0,                    -- lo que se le cobra al cliente
  sena numeric default 0,                      -- seña cobrada
  estado text not null default 'presupuesto'
    check (estado in ('presupuesto','confirmado','realizado','cancelado')),
  notas text,
  created_at timestamptz not null default now()
);

create index if not exists globologia_eventos_fecha_idx on public.globologia_eventos (user_id, fecha);

-- ===== FINANZAS =====
-- Finanzas de Pía · tablas (pegar en Supabase > SQL Editor > Run)
-- Puede ir en el mismo proyecto que Globología: cada app usa sus propias tablas y cada usuaria ve solo lo suyo.

create table if not exists public.finanzas_proyectos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente text not null,
  nombre text,
  area text default 'Programación',          -- Programación | Gestoría | Otro
  total numeric default 0,
  estado text not null default 'activo' check (estado in ('activo','terminado')),
  notas text,
  pendientes jsonb not null default '[]'::jsonb,  -- [{id, monto, fecha, nota}] lo que resta pagar
  created_at timestamptz not null default now()
);

create table if not exists public.finanzas_movs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','gasto')),
  monto numeric not null,
  fecha date not null,
  cuenta text,                               -- Mercado Pago | Cuenta DNI | BBVA | BBVA Crédito | Efectivo
  fuente text,                               -- ingresos: Programación | Gestoría | Papá | Otro
  categoria text,                            -- gastos
  detalle text,
  proyecto_id uuid references public.finanzas_proyectos(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.finanzas_historico (   -- meses anteriores, solo totales
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  total numeric not null default 0,
  programacion numeric default 0,
  gestoria numeric default 0,
  papa numeric default 0,
  nota text,
  primary key (user_id, mes)
);

create table if not exists public.finanzas_config (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  objetivo_default numeric default 0,
  objetivos jsonb not null default '{}'::jsonb   -- {"2026-10": 800000}
);

create index if not exists finanzas_movs_fecha_idx on public.finanzas_movs (user_id, fecha);


-- ===== SEGURIDAD: cada usuaria ve solo lo suyo =====
do $$
declare t text;
begin
  foreach t in array array['globologia_eventos','finanzas_proyectos','finanzas_movs','finanzas_historico','finanzas_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo propio" on public.%I', t);
    execute format('create policy "solo lo propio" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
