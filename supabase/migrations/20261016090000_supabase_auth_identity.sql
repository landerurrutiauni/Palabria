-- Identidad anónima de Supabase Auth (versión GitHub Pages + Supabase).
-- Un jugador se identifica por su token firmado (cookie, servidor Node.js) o
-- por el usuario anónimo de Supabase Auth (`auth.uid()`), nunca por ambos.
alter table anonymous_players add column if not exists auth_user_id uuid unique;
alter table anonymous_players alter column token_hash drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'anonymous_players_identity_check') then
    alter table anonymous_players
      add constraint anonymous_players_identity_check check (token_hash is not null or auth_user_id is not null);
  end if;
end
$$;
