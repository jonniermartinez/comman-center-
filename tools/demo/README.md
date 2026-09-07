# Video demo

Menos de dos minutos, recorre todas las pantallas. Las cifras del dashboard son
las reales de **agosto** (LV); lo que se captura en pantalla ocurre en una
empresa de prueba, *Demo Buga*, que se borra al terminar. Ningún dato del
cliente se toca.

```bash
# 1. Cuenta para grabar (una vez): preparar.sql en el SQL Editor, y la clave en demo.env
printf 'DEMO_EMAIL=e2e-demo-video@jonnier.com\nDEMO_PASSWORD=...\n' > tools/demo/demo.env

# 2. La app, en producción local para que no salga el indicador de Next dev
npx next build && npx next start -p 3100

# 3. Grabar las 14 escenas (Playwright, ~6 min) y montarlas (ffmpeg)
DEMO_BASE_URL=http://localhost:3100 DEMO_ENV=tools/demo/demo.env DEMO_OUT=tools/demo/salida node tools/demo/grabar.mjs
python3 tools/demo/montar.py --raw tools/demo/salida/raw --out tools/demo/salida

# 4. Borrar la empresa demo y la cuenta: limpiar.sql en el SQL Editor

# 5. Grabar la voz siguiendo guion.md y mezclarla
tools/demo/mezclar.sh voz.wav [voz.srt]
```

`grabar.mjs` acepta `DEMO_DESDE=08 DEMO_HASTA=09` para repetir solo unas
escenas. `montar.py` recorta solo los tramos quietos (páginas cargando,
diálogos guardando), acelera el tecleo y pone el rótulo de cada módulo; la
duración de cada tramo queda en `salida/linea-de-tiempo.json`, que es lo que
usa el guion.
