# Palabría · el concurso diario de palabras

Aplicación web de concursos de palabras en español, inspirada en la experiencia de los concursos de televisión,
con identidad visual propia. Cada día hay un desafío nuevo y estable para todo el mundo:

- **Individual**: «Solo El Rosco» (27 letras contra el reloj) o «Programa completo» (cuatro pruebas + El Rosco final).
  Ambos comparten **un único intento diario**.
- **1 vs 1**: salas privadas por enlace de invitación, **por turnos**, con un reloj para cada jugador que se detiene y
  arranca como en la televisión. Un intento diario independiente del individual.
- **Sin cuentas**: identidad anónima persistente mediante cookie `HttpOnly` firmada por el servidor (o, en la versión
  GitHub Pages, sesión anónima de Supabase Auth).

Se puede desplegar de dos formas con el mismo código de juego:

1. **Servidor Node.js** (Next.js completo con su API en `/api`): ver [Despliegue](#12-despliegue).
2. **GitHub Pages + Supabase**: interfaz estática en GitHub Pages y lógica autoritativa en una Supabase Edge Function.
   Publicada en **https://landerurrutiauni.github.io/Pasapalabra/**. Ver
   [Versión GitHub Pages + Supabase](#13-versión-github-pages--supabase).

---

## 1. Arquitectura

| Capa           | Tecnología                                                                                         | Notas                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web            | Next.js 16 (App Router), React 19, TypeScript estricto, Tailwind CSS 4                             | Componentes de servidor para cargar datos y componentes de cliente para el juego.                                                                |
| Motor de juego | TypeScript puro (`src/lib/game`)                                                                   | Sin dependencias de React ni de la base de datos; 100 % probado con Vitest.                                                                      |
| Servidor       | Route Handlers de Next.js (`src/app/api`) + servicios (`src/lib/server`)                           | Zod valida cada entrada; el servidor es la única autoridad sobre tiempo, intentos y puntuación.                                                  |
| Base de datos  | PostgreSQL (Supabase, Neon, RDS o local) con `pg`; **PGlite** embebido en desarrollo               | Mismo SQL y mismas migraciones en ambos casos.                                                                                                   |
| Tiempo real    | Server-Sent Events (`/api/rooms/[code]/events`)                                                    | Cada conexión recibe su propia vista, hace de latido de presencia y aplica el fin de reloj/abandono. Reconexión automática y sondeo de respaldo. |
| Identidad      | `src/proxy.ts` + cookie `palabria_id`                                                              | `HttpOnly`, `SameSite=Lax`, `Secure` en producción, firmada con HMAC‑SHA256. En la BD solo se guarda su hash.                                    |
| Pruebas        | Vitest (unitarias + integración contra PGlite o PostgreSQL) y Playwright (E2E con dos navegadores) |                                                                                                                                                  |

**¿Por qué SSE y no Supabase Realtime?** El navegador nunca habla con la base de datos: todas las lecturas pasan por
el servidor, que filtra lo que cada jugador puede ver (las preguntas del rival y las respuestas no resueltas nunca salen
del servidor). Con Supabase Realtime (Postgres Changes) habría que exponer tablas a la clave pública y replicar esa lógica
en políticas RLS. SSE funciona con cualquier PostgreSQL, incluido Supabase, y la sincronización entre varias instancias
está garantizada porque cada conexión SSE comprueba la versión de la sala en la base de datos cada segundo (además de un
aviso inmediato en proceso).

**Hora oficial.** Todas las operaciones toman la hora del reloj de PostgreSQL (`clock_timestamp()`), compartida por
todas las instancias. La fecha del desafío se calcula en `Europe/Madrid` (con horario de verano/invierno) en el servidor;
la hora del navegador no influye en nada.

## 2. Funcionalidades implementadas

- Portada con fecha y código del desafío (`PAL-AAAAMMDD`), presentación del rosco del día (letras y modos, sin
  definiciones), tarjetas de juego individual y 1 vs 1 con el estado de cada intento, racha, mejores resultados,
  clasificaciones diarias y cuenta atrás hasta el próximo desafío.
- **El Rosco**: 27 letras (A–Z con Ñ, K y W), «empieza por» / «contiene», estados pendiente, activa, acertada,
  fallada, pasada (pendiente de recuperar) y no jugada; cada estado se distingue por color, forma del borde e icono.
  Vueltas sucesivas, «Pasapalabra», feedback inmediato, recuperación tras recarga sin reiniciar el reloj.
- **Programa completo** (4 pruebas + rosco):
  1. _Palabras al vuelo_ — definiciones rápidas con pista de inicial y longitud.
  2. _La pista justa_ — hasta 4 pistas progresivas (40/30/20/10 puntos).
  3. _Dichos y hechos_ — completar refranes y expresiones.
  4. _El eslabón_ — la palabra que une a cuatro.
  5. _El Rosco_ — con el tiempo base más los segundos ganados en las pruebas.
     Entre pruebas el reloj se detiene (entreacto) y el jugador decide cuándo seguir.
- **1 vs 1**: creación de sala (sin consumir intento), enlace privado con copiar/compartir, invitación sin registro,
  sala de espera, preparación, cuenta atrás sincronizada, turnos con reloj propio, roscos y preguntas independientes
  y equivalentes, indicador de turno muy visible, transición de relevo que no retrasa el juego, reconexión, abandono,
  pantalla de victoria/derrota/empate con soluciones. También en modalidad «Programa completo» (pruebas por turnos alternos).
- Resultados (aciertos, errores, sin resolver, tiempo, % de acierto, puntuación, racha, soluciones) y botón de compartir
  (hoja nativa del dispositivo o portapapeles).
- Historial por fecha, estadísticas (individual y 1 vs 1 por separado), clasificación diaria por modalidad
  (solo nombres visibles), ajustes de sonido (efectos sintetizados con Web Audio, volumen) y accesibilidad
  (movimiento reducido, alto contraste, texto grande), nombre visible opcional validado en el servidor.
- Estados de error: error de conexión, sala caducada/cancelada, sala privada/completa, sala inexistente,
  desafío ya completado, partida abandonada, 404.
- Responsive (escritorio, tablet, móvil), navegación por teclado, etiquetas ARIA, `prefers-reduced-motion`,
  el teclado del móvil redimensiona el contenido (`interactive-widget=resizes-content`) y el campo de respuesta queda fijo
  abajo junto a la definición.

## 3. Estructura de archivos

```
src/
  app/                         Páginas (App Router) y API
    page.tsx                   Portada
    jugar/ , jugar/[modo]/     Selección y partida individual (rosco | programa)
    duelo/ , sala/[code]/      Crear sala y sala 1 vs 1 (invitación, espera, duelo, resultado)
    historial/ estadisticas/ clasificacion/ ajustes/ como-se-juega/
    api/                       me, challenge, solo, rooms (+ events SSE), stats, leaderboard, health
  proxy.ts                     Asignación de la identidad anónima (cookie firmada)
  components/                  UI: game/ (Rosco, temporizador, formulario…), solo/, duel/, home/, stats/…
  content/bank/                Banco de preguntas original (editable a mano)
  lib/
    game/                      Motor puro: alfabeto, normalización, rosco, relojes, puntuación,
                               fases, motor individual, motor del duelo, clasificación, fechas Madrid
    content/                   Validación y selección diaria determinista
    server/                    BD, identidad, desafíos, intentos, partidas, salas, resultados, SSE, HTTP
    client/                    API, sonido, reloj del servidor, sincronización de la sala
    views.ts                   Tipos de lo que el servidor envía al navegador
supabase/migrations/           Migraciones SQL versionadas
scripts/                       migrate, validate-content, publish-challenges, show-challenge
content/overrides/             Ediciones manuales de desafíos por fecha
tests/unit, tests/integration, tests/e2e
```

## 4. Instalación y arranque

Requisitos: Node.js ≥ 20.9 (recomendado 22) y npm.

```bash
npm install
cp .env.example .env.local      # opcional en desarrollo
npm run dev                     # http://localhost:3000
```

Sin `DATABASE_URL`, el modo de desarrollo usa **PostgreSQL embebido (PGlite)** guardado en `.data/pglite`, con las mismas
migraciones. Es un backend real: puedes jugar 1 vs 1 desde dos navegadores o desde el móvil en la misma red
(`http://IP-de-tu-ordenador:3000`). PGlite admite un solo proceso: para producción usa PostgreSQL.

Producción local:

```bash
APP_SECRET=$(openssl rand -base64 48) DATABASE_URL=postgres://… npm run build && npm start
```

Con Docker (incluye PostgreSQL): `docker compose up --build` → http://localhost:3000

## 5. Variables de entorno

Consulta [`.env.example`](./.env.example). Las imprescindibles en producción:

| Variable         | Descripción                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`   | Cadena de conexión PostgreSQL.                                                                                                           |
| `APP_SECRET`     | ≥ 32 caracteres. Firma la cookie de identidad. **Si cambia, todas las identidades se renuevan.** La app no arranca en producción sin él. |
| `CHALLENGE_SALT` | Semilla secreta de la selección diaria.                                                                                                  |
| `PUBLIC_APP_URL` | URL pública que se añade a los resultados compartidos.                                                                                   |

Los tiempos (`ROSCO_SECONDS`, `DUEL_ROSCO_SECONDS`, `DUEL_RECONNECT_GRACE_SECONDS`…) son configurables y se copian en
cada partida al empezar, así que cambiarlos nunca altera una partida en curso.

## 6. Backend y base de datos (Supabase u otro PostgreSQL)

1. Crea un proyecto en [Supabase](https://supabase.com) (o cualquier PostgreSQL ≥ 14).
2. Copia la cadena de conexión (_Project Settings → Database → Connection string → URI_) en `DATABASE_URL`.
   Para un servidor Node de larga duración usa la conexión directa o el _pooler_ en **modo sesión** (puerto 5432).
   Las conexiones a `*.supabase.co/com` usan TLS automáticamente.
3. Aplica las migraciones (siguiente apartado).
4. No necesitas la clave pública (`anon`) ni la `service_role`: el navegador nunca accede a la base de datos.

**Seguridad por fila.** La migración activa RLS en todas las tablas **sin políticas** y revoca los permisos de los roles
`anon` y `authenticated`: aunque alguien tenga la clave pública de Supabase, no puede leer ni modificar partidas,
intentos, respuestas ni resultados. El servidor se conecta con el usuario propietario de las tablas.

Modelo de datos (ver `supabase/migrations/20261015120000_initial_schema.sql`):
`anonymous_players`, `player_preferences`, `daily_challenges`, `daily_questions`, `daily_attempts`
(único por identidad + día + tipo), `game_sessions` (única por identidad + día), `multiplayer_rooms`
(turno activo, inicio del reloj, versión), `multiplayer_participants` (banco de tiempo, progreso, presencia; única por
sala + identidad y sala + asiento), `game_answers` (única por identidad + id de acción), `game_results`
(único por identidad + día + tipo) y `player_statistics`.

## 7. Migraciones

```bash
npm run db:migrate          # aplica supabase/migrations/*.sql pendientes (DATABASE_URL o PGlite)
```

Por defecto la aplicación también aplica las migraciones pendientes al arrancar (`AUTO_MIGRATE=true`), de forma
idempotente y con un bloqueo consultivo para varias instancias. Alternativa con la CLI de Supabase:
`supabase link && supabase db push` (usa una de las dos vías, no ambas, porque llevan registros distintos).

## 8. Desafíos diarios: generación y publicación

- **Banco** (`src/content/bank`): 670 definiciones originales de rosco (entre 19 y 30 por letra, con «empieza por» y
  «contiene»), 90 definiciones rápidas, 34 palabras con pistas, 92 refranes/expresiones y 73 eslabones.
- **Validación automática** (`src/lib/content/validate.ts`): 27 letras en orden, cada respuesta (y cada variante)
  cumple su letra sin confundir Ñ y N, enunciados comprensibles y en español, ninguna definición revela su respuesta ni
  la de otra pregunta del mismo jugador, sin respuestas repetidas en el día, contenido suficiente para cada prueba,
  respuestas aceptadas explícitas.
- **Selección determinista** (`src/lib/content/select.ts`): cada grupo del banco se baraja una vez con `CHALLENGE_SALT`
  y cada día avanza una ventana, de modo que el banco se recorre antes de repetir. Para el duelo se emparejan preguntas
  del mismo modo y dificultad (roscos equivalentes y distintos).
- **Publicación**: el primer acceso del día publica el desafío en una transacción (`on conflict do nothing`) y queda
  **inmutable** en `daily_challenges` + `daily_questions` (versión de contenido, dificultad, semilla, origen). Todas las
  partidas usan esas filas, nunca el banco directamente.
- **Reserva**: si la selección de una fecha no supera la validación, se prueban variantes y, en último término, un
  contenido de reserva validado por las pruebas automáticas. Nunca se publica un desafío defectuoso.
- **Revisión y edición manual**: `content/overrides/AAAA-MM-DD.json` sustituye la selección de esa fecha (ver
  [`content/overrides/README.md`](./content/overrides/README.md)).

```bash
npm run content:validate                         # banco + reserva + 45 días simulados
npm run challenges:publish -- --days 7           # fija por adelantado los próximos 7 días
npm run challenges:show -- --date 2026-11-02     # revisar un día (publicado o vista previa)
npm run challenges:show -- --date 2026-11-02 --json > content/overrides/2026-11-02.json
```

## 9. Reglas exactas

### Intentos (Europe/Madrid, cambio de día a las 00:00 con horario de verano/invierno)

- **Individual**: un intento al día por identidad, compartido entre «Solo El Rosco» y «Programa completo». Se consume al
  pulsar «Empezar» (cuando se muestra la primera pregunta), en la misma transacción que crea la partida. Recargar,
  abandonar o abrir otra pestaña no lo devuelve; dos peticiones simultáneas solo crean una partida.
- **1 vs 1**: un intento al día por identidad, independiente del individual. Crear o abandonar una sala vacía no lo
  consume. Se consume para **ambos** jugadores en la misma transacción que inicia el duelo; si falla, no se consume
  ninguno (no existen reservas que liberar). Al empezar un duelo se cancelan las demás salas abiertas de ambos.
- Una sala sin empezar caduca a las 3 h o a medianoche; las salas de días anteriores nunca se convierten en partidas
  del día nuevo. Un duelo empezado antes de medianoche termina con su contenido original.

### Rosco individual

- 180 s por defecto, reloj continuo desde «Empezar» (no se detiene al recargar o cerrar la página).
- Acierto: letra verde. Fallo: letra roja y se revela la solución. «Pasapalabra»: la letra vuelve en la siguiente vuelta.
- Termina al resolver todas las letras o al agotarse el tiempo. Las letras sin resolver no puntúan.
- Puntuación: +10 por acierto, −5 por fallo (mínimo 0) y +1 por segundo sobrante si no queda ninguna letra sin resolver.

### Programa completo (individual)

| Prueba            | Preguntas | Tiempo                   | Puntos por acierto       | Segundos extra para el rosco |
| ----------------- | --------- | ------------------------ | ------------------------ | ---------------------------- |
| Palabras al vuelo | 6         | 60 s                     | 10                       | 3                            |
| La pista justa    | 2         | 90 s                     | 40/30/20/10 según pistas | 8/6/4/2                      |
| Dichos y hechos   | 5         | 60 s                     | 15                       | 3                            |
| El eslabón        | 3         | 75 s                     | 20                       | 5                            |
| El Rosco          | 27        | 120 s + segundos ganados | como el rosco individual | —                            |

Entre pruebas el reloj está detenido; si no se continúa en 30 minutos el programa se cierra con lo conseguido
(cuenta como partida jugada pero no suma racha). Puntuación final = pruebas + rosco.

### Duelo 1 vs 1

- Un solo turno y un solo reloj en marcha por sala (el esquema no puede representar dos relojes activos).
- Empieza el invitado (en «Programa completo», las pruebas alternan quién empieza y El Rosco lo empieza quien tenga menos
  segundos). Cuenta atrás de 3,5 s antes del primer turno.
- **Acierto**: el turno continúa y el reloj sigue corriendo.
- **Fallo** o **«Pasapalabra»**: el reloj del jugador se detiene en ese instante (se guarda lo que le queda) y empieza a
  correr el del rival desde su tiempo restante. Nadie recupera segundos al volver a su turno.
- Si un jugador termina su rosco o se queda sin tiempo, el rival sigue jugando con su propio tiempo hasta acabar.
- Durante el turno del rival el campo de respuesta y «Pasapalabra» están deshabilitados y el servidor rechaza cualquier
  acción fuera de turno, aunque se manipule la petición.
- Programa completo 1 vs 1: 3/1/2/2 preguntas por jugador en las pruebas, por turnos alternos con tiempo de jugada
  (15/40/15/20 s); los aciertos suman segundos al rosco final (120 s de base). El ganador se decide en El Rosco.
- **Victoria**: 1) más aciertos en El Rosco; 2) menos fallos; 3) menos tiempo de rosco consumido (en segundos); 4) empate.
- **Desconexión**: el reloj sigue corriendo en tu turno. Si el jugador activo no da señales durante 45 s (configurable)
  se declara **abandono**: pierde la partida y termina el duelo. Recargar dentro del margen no cambia nada.

### Racha y estadísticas

- La racha suma 1 cada día en que se **completa** el desafío individual; se rompe si un día no se completa.
- Las estadísticas se calculan a partir de resultados persistidos; cada partida se registra una única vez
  (restricciones únicas), y se separan las del modo individual y las del 1 vs 1.

## 10. Pruebas

```bash
npm run lint && npm run typecheck
npm test                                               # unitarias + integración (PGlite en memoria)
TEST_DATABASE_URL=postgres://… npm test                # integración contra PostgreSQL real
npm run content:validate
npm run build
E2E_DATABASE_URL=postgres://… npm run test:e2e         # Playwright (requiere `npm run build` y PostgreSQL)
E2E_DATABASE_URL=postgres://… npm run test:e2e:static  # versión GitHub Pages (ver sección 13)
```

Resultados en el entorno de desarrollo (PostgreSQL 16 local, Chromium):

| Comprobación                          | Resultado                             |
| ------------------------------------- | ------------------------------------- |
| ESLint, TypeScript estricto, Prettier | sin errores                           |
| Vitest (PGlite)                       | 9 archivos, 70 pruebas superadas      |
| Vitest (PostgreSQL 16)                | 9 archivos, 70 pruebas superadas      |
| Validación de contenido               | banco, reserva y 45 días sin errores  |
| `next build`                          | correcto, sin avisos                  |
| Playwright E2E (PostgreSQL 16)        | 5 pruebas superadas                   |
| Playwright E2E versión GitHub Pages   | 2 pruebas superadas                   |
| Edge Function en Deno 2               | arranca y responde (salud, CORS, JWT) |

Cobertura destacada:

- Motor: normalización (Ñ ≠ N, tildes, variantes explícitas), recorrido del rosco y vueltas, puntuación, relojes por
  marcas de tiempo, fechas de Madrid alrededor de los cambios de hora, programa completo, **pruebas de reloj A–F**
  (acierto, fallo, Pasapalabra con 112 s, fuera de turno, reconexión, fin de tiempo), abandono y desempates.
- Integración (servicios + SQL): intentos atómicos, peticiones simultáneas, recarga, respuestas reenviadas,
  respuestas ocultas en las vistas, cambio de día, salas (crear, unirse, tercero bloqueado, misma identidad como
  rival, caducidad, cancelación, inicio concurrente), resultados únicos y estadísticas.
- E2E: identidad por cookie `HttpOnly`, rosco con recarga, bloqueo del otro modo, hora del navegador manipulada,
  programa completo de principio a fin y un duelo completo entre **dos navegadores** (tiempo real, turnos, relojes,
  rechazo fuera de turno, recarga, fin de tiempo, resultado y bloqueo de una segunda sala).

## 11. Limitaciones conocidas

- **Identidad anónima**: los límites se aplican por identidad persistente (cookie). Borrar las cookies o usar otro
  navegador/dispositivo genera una identidad nueva; sin cuentas no es posible impedirlo por completo y no se usan
  técnicas invasivas de huella digital. Tampoco se puede trasladar el historial a otro dispositivo.
- **Contenido**: el banco cubre aproximadamente una semana sin repetir preguntas del rosco y en torno a tres semanas
  con repeticiones parciales; después se reciclan (en combinaciones distintas). Para producción conviene ampliarlo
  (el formato está pensado para editarse a mano y la validación es automática).
- **Tiempo real en plataformas serverless**: cada conexión SSE dura hasta 2 minutos y se reconecta sola; en plataformas
  con límites de duración muy bajos funcionará con el sondeo de respaldo (cada 2,5 s), con algo más de latencia.
  La mejor experiencia se obtiene con un servidor Node.js persistente.
- **PGlite** solo admite un proceso: úsalo únicamente en desarrollo.
- El limitador de ráfagas es en memoria (por instancia).
- El entorno de desarrollo no tiene acceso de red a Supabase: la Edge Function se ha probado en Deno contra
  PostgreSQL 16 local y el despliegue real lo hace GitHub Actions (`pages.yml`) con los secretos del repositorio.
- Sin una cuenta, el inicio de sesión anónimo de Supabase está sujeto a sus límites por IP (por defecto, 30 nuevas
  identidades por hora y dirección IP).

## 12. Despliegue

**Servidor Node.js (recomendado: Railway, Render, Fly.io, VPS…)**

1. Crea la base de datos (Supabase u otra) y define `DATABASE_URL`, `APP_SECRET`, `CHALLENGE_SALT` y `PUBLIC_APP_URL`.
2. `npm ci && npm run build && npm run db:migrate && npm start` (puerto `PORT`, por defecto 3000).
3. Opcional: `npm run challenges:publish -- --days 7` para fijar y revisar los próximos desafíos.

**Docker**: `docker build -t palabria .` y ejecútalo con las variables anteriores (la imagen usa la salida _standalone_
de Next.js e incluye las migraciones). `docker compose up --build` levanta app + PostgreSQL.

**Vercel**: funciona con `DATABASE_URL` apuntando a Supabase (pooler en modo transacción o conexión directa con pocas
conexiones). Ten en cuenta la limitación de SSE descrita arriba.

Detrás de un proxy inverso, desactiva el _buffering_ para `/api/rooms/*/events` (la respuesta ya incluye
`X-Accel-Buffering: no` para Nginx).

## 13. Versión GitHub Pages + Supabase

GitHub Pages solo sirve ficheros estáticos, así que esta versión separa la interfaz del servidor **sin trasladar
ninguna regla al navegador**:

| Pieza         | Dónde                                                                       | Qué hace                                                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Interfaz      | GitHub Pages (`next build` con `output: "export"`, ficheros `*.static.tsx`) | Las mismas pantallas y componentes; cargan los datos desde la API en el navegador. Rutas con parámetros en la consulta: `/sala/?c=…`, `/historial/ver/?id=…`.            |
| API del juego | Supabase Edge Function `api` (`supabase/functions/api`)                     | `createApiHandler` (`src/lib/server/api-handler.ts`): las mismas rutas, servicios, transacciones y bloqueos que la API de Next.js. Empaquetada con `npm run build:edge`. |
| Base de datos | PostgreSQL de Supabase (`SUPABASE_DB_URL`)                                  | Mismas migraciones. RLS activado y sin permisos para `anon`/`authenticated`: el navegador no puede leer ninguna tabla.                                                   |
| Identidad     | Supabase Auth, inicio de sesión **anónimo**                                 | La función verifica el JWT (`auth.getClaims`) y asocia el `sub` a un jugador (`anonymous_players.auth_user_id`). Sin correo ni contraseña.                               |
| Tiempo real   | Supabase Realtime **Broadcast** (`room-<código>`) + sondeo cada 3 s         | Tras cada cambio de una sala, la función envía un aviso sin datos; cada navegador relee **su** vista filtrada desde la API. El sondeo aplica fin de reloj y presencia.   |

La exportación estática no contiene preguntas ni respuestas (se comprueba buscando textos del banco en `out/`): todo
el contenido sigue en la base de datos y solo sale por la API, igual que en la versión con servidor.

### Puesta en marcha

**Supabase** (proyecto `pkbxxjumiafigigzegxi`): las tablas (migraciones), la semilla secreta de los desafíos
(generada dentro de la base de datos, tabla `app_settings`) y la Edge Function `api` ya están desplegadas. La función
publicada carga `server.js` desde este repositorio fijado a un commit concreto. Solo falta, en el panel de Supabase:

- _Authentication → Sign In / Providers_: activar **Allow anonymous sign-ins** y guardar.

**GitHub** (_Settings_ del repositorio):

- _Pages → Build and deployment → Source_: **GitHub Actions**.

Cada `push` a la rama principal ejecuta `.github/workflows/pages.yml`, que compila la web estática y la publica en
Pages (también se puede lanzar a mano en _Actions → Run workflow_).

Opcional, para que GitHub Actions actualice también Supabase en cada cambio: añade el secreto
`SUPABASE_ACCESS_TOKEN` (token personal de _Account → Access Tokens_). Con él, el flujo activa el inicio de sesión
anónimo y aplica las migraciones nuevas por la API de gestión (`scripts/supabase-setup.mjs`, sin contraseña de la base
de datos), guarda `ALLOWED_ORIGINS` y despliega la Edge Function con la CLI. Variables opcionales:
`SUPABASE_PROJECT_REF`, `SUPABASE_PUBLISHABLE_KEY` y `ALLOWED_ORIGINS`. Si defines `CHALLENGE_SALT` como secreto de la
función, tiene prioridad sobre la semilla guardada en la base de datos.

### Desarrollo y pruebas en local (sin Supabase)

`scripts/api-server.ts` sirve la misma API en Node con identidades simuladas (`dev.<uuid>`, solo con `DEV_AUTH=1`) y
`scripts/serve-static.mjs` imita GitHub Pages (prefijo `/Pasapalabra`, `404.html`):

```bash
NEXT_PUBLIC_BASE_PATH=/Pasapalabra NEXT_PUBLIC_API_URL=http://localhost:3301 NEXT_PUBLIC_DEV_AUTH=1 \
  npm run build:pages
E2E_DATABASE_URL=postgres://… npm run test:e2e:static   # identidad, rosco, historial, clasificación y duelo
```

La Edge Function empaquetada se ha ejecutado en Deno 2 contra PostgreSQL 16 (salud, CORS, rechazo de tokens y, con la
variante de desarrollo, partidas completas por la API).

### Diferencias con la versión con servidor

- Identidad guardada en el almacenamiento local del navegador (sesión anónima de Supabase) en lugar de una cookie
  `HttpOnly`. Borrar los datos del sitio crea una identidad nueva, igual que borrar las cookies.
- Sin SSE: avisos por Realtime Broadcast y sondeo cada 3 s (latencia algo mayor si Realtime no está disponible).
- El HTML inicial no incluye datos del jugador: cada pantalla muestra «Cargando…» mientras pide sus datos.
