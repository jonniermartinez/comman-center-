#!/usr/bin/env python3
"""
Monta el video demo a partir de las escenas grabadas por grabar.mjs.

Por escena: detecta los tramos quietos (páginas cargando, diálogos guardando)
y los recorta, acelera lo que es tecleo, y pone un rótulo abajo con el nombre
del módulo. Luego pega todo con una portada y un cierre. Sale sin audio: la voz
se mezcla después con mezclar.sh.

Uso:
    python3 tools/demo/montar.py --raw salida/raw --out salida
"""
import argparse, json, os, re, subprocess, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
FPS = 30

# nombre, rótulo, segundos de quietud que se conservan, velocidad
ESCENAS = [
    ("01-login",            "Entrar",                                  0.8, 1.0),
    ("02-empresas",         "Empresas · de septiembre a agosto",       1.6, 1.0),
    ("03-dashboard",        "Dashboard · agosto 2026",                 1.9, 1.0),
    ("04-objetivos",        "Objetivos comerciales",                   1.8, 1.0),
    ("05-nueva-empresa",    "Nueva empresa · asistente",               0.7, 1.4),
    ("06-sedes",            "Sedes",                                   0.7, 1.4),
    ("07-equipo",           "Equipo",                                  0.7, 1.4),
    ("08-ventas",           "Ventas · nueva venta",                    0.7, 1.5),
    ("09-pagos",            "Pagos · abono a una venta",               0.7, 1.45),
    ("10-gestion-diaria",   "Gestión diaria · la jornada",             0.7, 1.6),
    ("11-agendas",          "Agendas",                                 0.7, 1.5),
    ("12-caja",             "Ingreso y gasto · caja",                  0.7, 1.5),
    ("13-dashboard-demo",   "Dashboard · lo capturado ya cuenta",      1.8, 1.0),
    ("14-auditoria",        "Auditoría · quién hizo qué",              1.8, 1.0),
]
OBJETIVO = 112.0  # segundos, con portada y cierre, para quedar bajo los 2 minutos


def sh(args, capture=False):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0 and not capture:
        sys.exit(f"falló: {' '.join(args)}\n{r.stderr[-2000:]}")
    return r.stderr if capture else r.stdout


def duracion(ruta):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta]))


def congelados(ruta):
    err = sh(["ffmpeg", "-i", ruta, "-vf", "freezedetect=n=0.0015:d=0.45", "-an", "-f", "null", "-"], capture=True)
    inicios = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", err)]
    fines = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", err)]
    tramos = list(zip(inicios, fines))
    if len(inicios) > len(fines):  # quieto hasta el final
        tramos.append((inicios[-1], duracion(ruta)))
    return tramos


def tramos_a_conservar(total, quietos, max_quieto):
    fuera = []
    for s, e in quietos:
        if s < 0.25:  # arranque: página en blanco o cargando
            fuera.append((min(0.3, e), max(e - 0.12, 0.3)))
        elif e - s > max_quieto + 0.15:
            fuera.append((s + max_quieto, e - 0.1))
    fuera = [(a, b) for a, b in fuera if b > a]
    dentro, cursor = [], 0.0
    for a, b in sorted(fuera):
        if a > cursor + 0.05:
            dentro.append((cursor, a))
        cursor = max(cursor, b)
    if total > cursor + 0.05:
        dentro.append((cursor, total))
    return dentro


def pintar_rotulos(out, items):
    """Los PNG los hace Chromium: ver rotulos.mjs."""
    ruta = os.path.join(out, "partes", "rotulos.json")
    with open(ruta, "w") as f:
        json.dump(items, f, ensure_ascii=False)
    r = subprocess.run(["node", os.path.join(AQUI, "rotulos.mjs"), ruta], capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"rotulos.mjs: {r.stderr[-1500:]}")


def montar_escena(raw, out, nombre, texto, max_quieto, vel, factor):
    entrada = os.path.join(raw, f"{nombre}.webm")
    salida = os.path.join(out, "partes", f"{nombre}.mp4")
    total = duracion(entrada)
    dentro = tramos_a_conservar(total, congelados(entrada), max_quieto)
    vel = vel if vel <= 1.0 else vel * factor
    partes, filtros = [], []
    for i, (a, b) in enumerate(dentro):
        filtros.append(f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]")
        partes.append(f"[v{i}]")
    filtros.append(
        f"{''.join(partes)}concat=n={len(partes)}:v=1:a=0,setpts=PTS/{vel:.3f},fps={FPS}[base]"
    )
    filtros.append("[1:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[rot]")
    filtros.append("[base][rot]overlay=0:0:shortest=1,format=yuv420p[v]")
    png = os.path.join(out, "partes", f"{nombre}.png")
    sh(["ffmpeg", "-y", "-v", "error", "-i", entrada, "-loop", "1", "-i", png,
        "-filter_complex", ";".join(filtros), "-map", "[v]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-g", "60", "-r", str(FPS), "-an", salida])
    util = sum(b - a for a, b in dentro)
    return salida, util / vel, total, util


def tarjeta(out, nombre, dur):
    salida = os.path.join(out, "partes", f"{nombre}.mp4")
    png = os.path.join(out, "partes", f"{nombre}.png")
    vf = f"fade=t=in:st=0:d=0.5,fade=t=out:st={dur-0.5:.2f}:d=0.5,format=yuv420p"
    sh(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", png, "-t", str(dur), "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-g", "60", "-r", str(FPS), "-an", salida])
    return salida, dur


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--raw", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--factor", type=float, default=None, help="multiplicador extra para las escenas de captura")
    a = p.parse_args()
    os.makedirs(os.path.join(a.out, "partes"), exist_ok=True)

    # Primera pasada: cuánto dura cada escena ya recortada, a velocidad base.
    medidas = {}
    for nombre, texto, mq, vel in ESCENAS:
        entrada = os.path.join(a.raw, f"{nombre}.webm")
        total = duracion(entrada)
        dentro = tramos_a_conservar(total, congelados(entrada), mq)
        medidas[nombre] = (total, sum(b - a_ for a_, b in dentro))
    fijo = sum(medidas[n][1] / v for n, _, _, v in ESCENAS if v <= 1.0)
    variable = sum(medidas[n][1] / v for n, _, _, v in ESCENAS if v > 1.0)
    tarjetas = 3.0 + 3.5
    factor = a.factor or max(1.0, variable / max(OBJETIVO - tarjetas - fijo, 1))
    print(f"lectura {fijo:.1f}s · captura {variable:.1f}s (x{factor:.2f} extra) · tarjetas {tarjetas:.1f}s")

    pintar_rotulos(a.out, [
        {"tipo": "tarjeta", "png": "00-portada.png", "lineas": ["Command Center", "TrámitesBuga · gestión comercial por empresa y por sede"]},
        *[{"tipo": "rotulo", "png": f"{n}.png", "texto": texto} for n, texto, _, _ in ESCENAS],
        {"tipo": "tarjeta", "png": "99-cierre.png", "lineas": ["Todo sale de lo registrado. Nada se digita aparte.", "Command Center · TrámitesBuga"]},
    ])
    lista, linea_tiempo, t = [], [], 0.0
    portada, d = tarjeta(a.out, "00-portada", 3.0)
    lista.append(portada); linea_tiempo.append(("portada", t, t + d)); t += d
    for nombre, texto, mq, vel in ESCENAS:
        salida, d, total, util = montar_escena(a.raw, a.out, nombre, texto, mq, vel, factor)
        lista.append(salida); linea_tiempo.append((nombre, t, t + d)); t += d
        print(f"  {nombre:20s} {total:5.1f}s → {util:5.1f}s útiles → {d:5.1f}s en el video")
    cierre, d = tarjeta(a.out, "99-cierre", 3.5)
    lista.append(cierre); linea_tiempo.append(("cierre", t, t + d)); t += d

    with open(os.path.join(a.out, "lista.txt"), "w") as f:
        for ruta in lista:
            f.write(f"file '{os.path.abspath(ruta)}'\n")
    final = os.path.join(a.out, "demo-sin-audio.mp4")
    sh(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(a.out, "lista.txt"),
        "-c", "copy", "-movflags", "+faststart", final])
    with open(os.path.join(a.out, "linea-de-tiempo.json"), "w") as f:
        json.dump([{"escena": n, "desde": round(s, 1), "hasta": round(e, 1)} for n, s, e in linea_tiempo], f, indent=2, ensure_ascii=False)
    print(f"\n{final}: {t:.1f}s")
    for n, s, e in linea_tiempo:
        print(f"  {s:6.1f} – {e:6.1f}  {n}")


if __name__ == "__main__":
    main()
