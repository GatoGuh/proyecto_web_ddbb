-- Tabla de destino del pipeline ETL de Open-Meteo.
-- Una fila por ciudad y hora (UTC).

create table if not exists public.mediciones_meteorologicas (
  id bigint generated always as identity primary key,
  ciudad text not null,
  fecha_hora timestamptz not null,
  temperatura_c double precision not null,
  humedad_pct double precision not null,
  precipitacion_mm double precision not null,
  importado_en timestamptz not null default now(),

  -- Clave natural: permite el upsert sin duplicados.
  constraint mediciones_meteorologicas_ciudad_fecha_hora_key
    unique (ciudad, fecha_hora),
  constraint mediciones_meteorologicas_ciudad_no_vacia
    check (length(btrim(ciudad)) > 0),
  -- En Postgres, NaN se ordena por encima de cualquier número; estas
  -- comparaciones excluyen NaN e infinitos.
  constraint mediciones_meteorologicas_temperatura_finita
    check (temperatura_c > '-Infinity'::double precision
       and temperatura_c < 'Infinity'::double precision),
  constraint mediciones_meteorologicas_humedad_rango
    check (humedad_pct >= 0 and humedad_pct <= 100),
  constraint mediciones_meteorologicas_precipitacion_no_negativa
    check (precipitacion_mm >= 0
       and precipitacion_mm < 'Infinity'::double precision)
);

comment on table public.mediciones_meteorologicas is
  'Mediciones horarias (UTC) de Open-Meteo cargadas por el pipeline ETL de prácticas.';
comment on column public.mediciones_meteorologicas.importado_en is
  'Momento de la primera inserción; un upsert posterior no lo modifica.';

-- RLS activado y sin políticas: anon y authenticated no pueden leer ni escribir.
-- La aplicación accede desde el servidor con la clave secreta (rol service_role).
alter table public.mediciones_meteorologicas enable row level security;

-- Desde octubre de 2026 las tablas nuevas de "public" no se exponen a la Data
-- API sin GRANT explícito. Solo se concede acceso a service_role.
revoke all on table public.mediciones_meteorologicas from anon, authenticated;
grant select, insert, update
  on table public.mediciones_meteorologicas to service_role;
