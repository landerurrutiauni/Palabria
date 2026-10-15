-- Modo voz en el duelo: cada jugador acepta (o no) jugar con micrófono. La voz
-- solo se activa si los dos lo han aceptado antes de empezar.
alter table multiplayer_participants add column if not exists voice boolean not null default false;
