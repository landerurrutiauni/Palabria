-- Ajustes internos del servidor. Nunca son accesibles desde el navegador.
create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;

-- Semilla secreta de la selección diaria (la usa la Edge Function si no se
-- define CHALLENGE_SALT). Se genera aquí con aleatoriedad fuerte de PostgreSQL,
-- así no aparece en el código ni pasa por ninguna otra parte.
insert into app_settings (key, value)
values ('challenge_salt', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table app_settings from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table app_settings from authenticated';
  end if;
end
$$;
