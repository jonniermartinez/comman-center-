#!/usr/bin/env bash
# Mezcla la voz con el video mudo y, si hay .srt, lo mete como subtítulos.
#
#   tools/demo/mezclar.sh voz.wav                 # una sola pista
#   tools/demo/mezclar.sh voz.wav voz.srt         # con subtítulos de whisper
#   tools/demo/mezclar.sh bloque-*.wav            # varios bloques, se pegan en orden
#
# Salida: tools/demo/salida/demo.mp4
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
VIDEO="$AQUI/salida/demo-sin-audio.mp4"
SALIDA="$AQUI/salida/demo.mp4"
[ -f "$VIDEO" ] || { echo "No está $VIDEO: corre antes grabar.mjs y montar.py"; exit 1; }

SRT=""; AUDIOS=()
for a in "$@"; do case "$a" in *.srt) SRT="$a";; *) AUDIOS+=("$a");; esac; done
[ ${#AUDIOS[@]} -gt 0 ] || { echo "Falta el audio"; exit 1; }

# Varios bloques → una sola pista.
VOZ="${AUDIOS[0]}"
if [ ${#AUDIOS[@]} -gt 1 ]; then
  LISTA="$(mktemp)"; for a in "${AUDIOS[@]}"; do echo "file '$(cd "$(dirname "$a")" && pwd)/$(basename "$a")'" >> "$LISTA"; done
  VOZ="$AQUI/salida/voz-unida.wav"
  ffmpeg -y -v error -f concat -safe 0 -i "$LISTA" -c pcm_s16le "$VOZ"
fi

DV=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")
DA=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VOZ")
echo "video ${DV%.*}s · voz ${DA%.*}s"

# Si la voz es más larga, el último cuadro se sostiene; si es más corta, queda silencio al final.
EXTRA=$(python3 -c "print(max(0.0, $DA - $DV + 0.3))")
TOTAL=$(python3 -c "print($DV + $EXTRA)")
FILTRO="[0:v]tpad=stop_mode=clone:stop_duration=$EXTRA[v];[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=$TOTAL[a]"

ARGS=(-y -v error -i "$VIDEO" -i "$VOZ")
MAPS=(-map "[v]" -map "[a]")
if [ -n "$SRT" ]; then ARGS+=(-i "$SRT"); MAPS+=(-map 2:0 -c:s mov_text -metadata:s:s:0 language=spa); fi
ffmpeg "${ARGS[@]}" -filter_complex "$FILTRO" "${MAPS[@]}" \
  -c:v libx264 -preset medium -crf 19 -pix_fmt yuv420p -c:a aac -b:a 160k -t "$TOTAL" -movflags +faststart "$SALIDA"
echo "Listo: $SALIDA"
