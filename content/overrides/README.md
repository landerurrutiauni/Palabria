# Ediciones manuales de desafíos

Cada archivo `AAAA-MM-DD.json` de esta carpeta sustituye la selección automática
del banco para esa fecha, **siempre que el desafío aún no se haya publicado** y
el contenido supere la validación automática (si no la supera, se ignora y se
usa la selección del banco).

Flujo recomendado:

1. `npm run challenges:show -- --date 2026-11-02 --json > content/overrides/2026-11-02.json`
2. Edita definiciones, respuestas o variantes en el JSON.
3. `npm run content:validate` y `npm run challenges:show -- --date 2026-11-02` para revisarlo.
4. `npm run challenges:publish -- --from 2026-11-02 --days 1` para fijarlo en la base de datos.

Una vez publicado, el contenido de esa fecha no cambia.
