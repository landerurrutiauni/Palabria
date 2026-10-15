-- Palabria · esquema inicial
-- Compatible con PostgreSQL 14+ (Supabase, Postgres local o PGlite embebido).
-- Las marcas de tiempo usadas por el motor de juego se guardan como epoch en
-- milisegundos (bigint) para no depender de la zona horaria de la sesión.

-- ───────────────────────── Identidades anónimas ─────────────────────────
create table if not exists anonymous_players (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 del secreto aleatorio que guarda la cookie HttpOnly (nunca el secreto).
  token_hash text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 24),
  name_is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists player_preferences (
  player_id uuid primary key references anonymous_players(id) on delete cascade,
  sound_enabled boolean not null default true,
  sound_volume smallint not null default 70 check (sound_volume between 0 and 100),
  motion text not null default 'system' check (motion in ('system', 'reduce', 'full')),
  high_contrast boolean not null default false,
  large_text boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Desafíos diarios ─────────────────────────
create table if not exists daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  public_id text not null unique,
  content_version text not null,
  difficulty text not null check (difficulty in ('facil', 'media', 'dificil')),
  difficulty_score numeric(4, 2) not null,
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  source text not null check (source in ('bank', 'override', 'reserve')),
  seed text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Preguntas publicadas de cada desafío. Las respuestas solo se leen en el servidor.
create table if not exists daily_questions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references daily_challenges(id) on delete cascade,
  set_key text not null check (set_key in ('solo', 'duel_a', 'duel_b')),
  phase text not null check (phase in ('rosco', 'quick', 'clues', 'saying', 'link')),
  position smallint not null check (position >= 0),
  letter text,
  letter_mode text check (letter_mode in ('starts', 'contains')),
  prompt jsonb not null,
  answers text[] not null check (cardinality(answers) > 0),
  difficulty smallint not null check (difficulty between 1 and 3),
  bank_item_id text not null,
  unique (challenge_id, set_key, phase, position),
  check ((phase = 'rosco') = (letter is not null))
);
create index if not exists daily_questions_challenge_idx on daily_questions (challenge_id, set_key);

-- ───────────────────────── Partidas individuales ─────────────────────────
create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references anonymous_players(id) on delete cascade,
  challenge_id uuid not null references daily_challenges(id),
  challenge_date date not null,
  mode text not null check (mode in ('rosco', 'program')),
  status text not null check (status in ('in_progress', 'completed', 'abandoned')),
  state jsonb not null,
  version integer not null default 0,
  started_at_ms bigint not null,
  finished_at_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un único intento individual por identidad y día (rosco o programa completo).
  unique (player_id, challenge_date)
);
create index if not exists game_sessions_open_idx on game_sessions (status) where status = 'in_progress';

-- ───────────────────────── Salas 1 vs 1 ─────────────────────────
create table if not exists multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  -- Código impredecible del enlace de invitación.
  code text not null unique check (char_length(code) between 12 and 40),
  challenge_id uuid not null references daily_challenges(id),
  challenge_date date not null,
  mode text not null check (mode in ('rosco', 'program')),
  status text not null check (status in ('waiting', 'ready', 'in_progress', 'completed', 'abandoned', 'expired')),
  creator_id uuid not null references anonymous_players(id) on delete cascade,
  rules jsonb not null,
  stages text[] not null,
  stage_index smallint not null default 0,
  -- Turno activo: un único asiento y un único reloj en marcha por sala.
  turn_seat smallint check (turn_seat in (1, 2)),
  turn_started_at_ms bigint,
  turn_number integer not null default 0,
  winner_seat smallint check (winner_seat in (1, 2)),
  end_reason text check (end_reason in ('completed', 'abandoned', 'expired', 'cancelled')),
  version integer not null default 0,
  expires_at_ms bigint not null,
  started_at_ms bigint,
  finished_at_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'in_progress' or turn_seat is not null),
  check (turn_started_at_ms is null or turn_seat is not null)
);
create index if not exists multiplayer_rooms_creator_idx on multiplayer_rooms (creator_id, status);
create index if not exists multiplayer_rooms_open_idx on multiplayer_rooms (status)
  where status in ('waiting', 'ready', 'in_progress');

create table if not exists multiplayer_participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references multiplayer_rooms(id) on delete cascade,
  player_id uuid not null references anonymous_players(id) on delete cascade,
  seat smallint not null check (seat in (1, 2)),
  display_name text not null,
  question_set text not null check (question_set in ('duel_a', 'duel_b')),
  is_ready boolean not null default false,
  status text not null default 'joined' check (status in ('joined', 'playing', 'finished', 'out_of_time', 'abandoned')),
  -- Banco de tiempo del rosco (tiempo restante en la última parada del reloj).
  time_bank_ms integer not null check (time_bank_ms >= 0),
  bonus_ms integer not null default 0,
  phase_points integer not null default 0,
  time_used_ms integer not null default 0,
  correct smallint not null default 0,
  wrong smallint not null default 0,
  pending smallint not null default 27,
  -- Estado de letras (pendientes, pasadas, resueltas), cursor y pruebas previas.
  progress jsonb not null,
  last_seen_at_ms bigint not null,
  joined_at timestamptz not null default now(),
  unique (room_id, seat),
  -- La misma identidad no puede ocupar los dos asientos de una sala.
  unique (room_id, player_id)
);
create index if not exists multiplayer_participants_player_idx on multiplayer_participants (player_id);

-- ───────────────────────── Intentos diarios ─────────────────────────
create table if not exists daily_attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references anonymous_players(id) on delete cascade,
  challenge_date date not null,
  kind text not null check (kind in ('solo', 'duel')),
  mode text not null check (mode in ('rosco', 'program')),
  session_id uuid references game_sessions(id) on delete set null,
  room_id uuid references multiplayer_rooms(id) on delete set null,
  consumed_at timestamptz not null default now(),
  -- Exactamente un intento individual y uno 1 vs 1 por identidad y día.
  unique (player_id, challenge_date, kind),
  check ((kind = 'solo' and room_id is null) or (kind = 'duel' and session_id is null))
);

-- ───────────────────────── Respuestas ─────────────────────────
create table if not exists game_answers (
  id bigint generated always as identity primary key,
  player_id uuid not null references anonymous_players(id) on delete cascade,
  session_id uuid references game_sessions(id) on delete cascade,
  room_id uuid references multiplayer_rooms(id) on delete cascade,
  -- Identificador de la acción generado por el cliente: evita duplicados por reenvíos.
  action_id uuid not null,
  stage_index smallint not null,
  stage_kind text not null check (stage_kind in ('rosco', 'quick', 'clues', 'saying', 'link')),
  item_index smallint,
  action text not null check (action in ('answer', 'pass', 'clue', 'start_stage', 'timeout')),
  outcome text not null check (outcome in ('correct', 'wrong', 'passed', 'clue', 'started', 'timeout')),
  given_answer text check (char_length(given_answer) <= 60),
  clock_ms integer,
  created_at timestamptz not null default now(),
  unique (player_id, action_id),
  check ((session_id is null) <> (room_id is null))
);
create index if not exists game_answers_session_idx on game_answers (session_id);
create index if not exists game_answers_room_idx on game_answers (room_id);

-- ───────────────────────── Resultados y estadísticas ─────────────────────────
create table if not exists game_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references anonymous_players(id) on delete cascade,
  challenge_date date not null,
  kind text not null check (kind in ('solo', 'duel')),
  mode text not null check (mode in ('rosco', 'program')),
  status text not null check (status in ('completed', 'abandoned')),
  session_id uuid unique references game_sessions(id) on delete cascade,
  room_id uuid references multiplayer_rooms(id) on delete cascade,
  display_name text not null,
  correct smallint not null,
  wrong smallint not null,
  unanswered smallint not null,
  phase_points integer not null default 0,
  score integer not null,
  time_used_ms integer not null,
  rosco_complete boolean not null,
  perfect boolean not null,
  outcome text check (outcome in ('win', 'loss', 'draw')),
  opponent_name text,
  details jsonb not null,
  finished_at_ms bigint not null,
  created_at timestamptz not null default now(),
  -- Un resultado por intento: nunca se cuenta dos veces la misma partida.
  unique (player_id, challenge_date, kind),
  unique (room_id, player_id)
);
create index if not exists game_results_leaderboard_idx on game_results (challenge_date, kind, mode, score desc);
create index if not exists game_results_player_idx on game_results (player_id, challenge_date desc);

create table if not exists player_statistics (
  player_id uuid primary key references anonymous_players(id) on delete cascade,
  solo_played integer not null default 0,
  solo_completed integer not null default 0,
  solo_correct integer not null default 0,
  solo_wrong integer not null default 0,
  best_score_rosco integer,
  best_score_program integer,
  best_time_ms integer,
  roscos_completed integer not null default 0,
  perfect_roscos integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_streak_date date,
  duel_played integer not null default 0,
  duel_wins integer not null default 0,
  duel_losses integer not null default 0,
  duel_draws integer not null default 0,
  duel_correct integer not null default 0,
  duel_wrong integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Seguridad por fila ─────────────────────────
-- El navegador nunca accede directamente a la base de datos: todas las
-- operaciones pasan por el servidor de la aplicación. Se activa RLS sin
-- políticas para que los roles públicos de Supabase (anon/authenticated)
-- no puedan leer ni modificar ninguna tabla aunque conozcan la clave pública.
alter table anonymous_players enable row level security;
alter table player_preferences enable row level security;
alter table daily_challenges enable row level security;
alter table daily_questions enable row level security;
alter table game_sessions enable row level security;
alter table multiplayer_rooms enable row level security;
alter table multiplayer_participants enable row level security;
alter table daily_attempts enable row level security;
alter table game_answers enable row level security;
alter table game_results enable row level security;
alter table player_statistics enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
  end if;
end
$$;
