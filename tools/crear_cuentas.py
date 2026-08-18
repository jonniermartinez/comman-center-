#!/usr/bin/env python3
"""
Crea las cuentas de acceso del equipo sin esperar los correos.

Uso:
    python tools/crear_cuentas.py                 # los activos (con movimiento reciente)
    python tools/crear_cuentas.py --todos         # los 128 del histórico
    python tools/crear_cuentas.py --desde 2026-01-01
    python tools/crear_cuentas.py --dry-run

Cada persona entra con un usuario provisional y una contraseña temporal, y la
cuenta queda enlazada con su registro en `staff`: desde el primer momento ve
**su** histórico, porque lo que ata los registros a una persona es su
identificador, no su correo.

Cuando llegue el correo real se cambia desde Usuarios y no se mueve nada más.

El dominio de los usuarios provisionales es `.invalid`, reservado por la
RFC 2606 justamente para esto: no existe ni puede existir, así que ninguna de
estas direcciones va a chocar con la de una persona real ni va a mandarle
correo a un desconocido por un dedazo.
"""

import argparse
import datetime
import json
import os
import random
import re
import sys
import unicodedata

try:
    import requests
except ImportError:
    sys.exit("Falta instalar dependencias:  pip install requests")

# Entradas del histórico que no son personas: quedaron en la columna de
# responsable por error de digitación.
NO_SON_PERSONAS = {"tramites_pereira", "interaccion_directo"}

SILABAS = ["ta", "re", "mi", "sol", "lu", "pa", "ce", "no", "vi", "ka"]


def usuario_desde(nombre):
    texto = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    texto = re.sub(r"[^a-zA-Z0-9]+", ".", texto).strip(".").lower()
    return texto or "usuario"


def clave_temporal():
    """Legible por teléfono: tres sílabas y cuatro dígitos."""
    palabra = "".join(random.choice(SILABAS) for _ in range(3))
    return f"{palabra.capitalize()}{random.randint(1000, 9999)}*"


def entorno(clave):
    if os.environ.get(clave):
        return os.environ[clave]
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
    if os.path.exists(ruta):
        for linea in open(ruta, encoding="utf-8"):
            if linea.strip().startswith(clave + "="):
                return linea.split("=", 1)[1].strip()
    return None


def main():
    ap = argparse.ArgumentParser(description="Crea las cuentas del equipo.")
    ap.add_argument("--todos", action="store_true", help="Incluir a todo el histórico")
    ap.add_argument("--desde", default="2026-06-01",
                    help="Solo quienes tengan movimiento desde esta fecha (por defecto 2026-06-01)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--salida", default=os.path.expanduser("~/Downloads/accesos-comerciales.txt"))
    args = ap.parse_args()

    url = entorno("NEXT_PUBLIC_SUPABASE_URL")
    key = entorno("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (.env.local)")

    s = requests.Session()
    s.headers.update({"apikey": key, "Authorization": f"Bearer {key}",
                      "Content-Type": "application/json"})
    rest = url.rstrip("/") + "/rest/v1"
    auth = url.rstrip("/") + "/auth/v1"

    # Personas sin cuenta, con sus empresas y sedes.
    personas = s.get(f"{rest}/staff",
                     params={"select": "id,full_name,slug,active,"
                                       "company_staff(company_id,branch_id,companies(name,slug))",
                             "profile_id": "is.null", "active": "is.true"},
                     timeout=60).json()

    # Última actividad de cada una, para no crearle cuenta a quien ya no está.
    #
    # Se pide por páginas: PostgREST corta en 1.000 filas por respuesta, y sin
    # paginar el corte deja fuera a gente que sí está activa (la primera vez se
    # perdieron 18 personas por esto).
    if not args.todos:
        recientes = set()
        for tabla in ("sales", "daily_activity"):
            desplazamiento = 0
            while True:
                r = s.get(f"{rest}/{tabla}",
                          params={"select": "staff_id", "report_date": f"gte.{args.desde}"},
                          headers={"Range-Unit": "items",
                                   "Range": f"{desplazamiento}-{desplazamiento + 999}"},
                          timeout=120)
                filas = r.json()
                recientes |= {f["staff_id"] for f in filas if f.get("staff_id")}
                if len(filas) < 1000:
                    break
                desplazamiento += 1000
        personas = [p for p in personas if p["id"] in recientes]

    personas = [p for p in personas if p["slug"] not in NO_SON_PERSONAS
                and not p["slug"].isdigit() and p["company_staff"]]
    personas.sort(key=lambda p: p["full_name"])

    print(f"Cuentas por crear: {len(personas)}\n")
    if args.dry_run:
        for p in personas:
            empresas = ", ".join(cs["companies"]["name"] for cs in p["company_staff"])
            print(f"  {p['full_name']:28s} {usuario_desde(p['full_name'])}  → {empresas}")
        print("\n(dry-run: no se creó nada)")
        return

    creadas, fallidas, usados = [], [], set()

    for p in personas:
        usuario = usuario_desde(p["full_name"])
        n = 1
        while usuario in usados:
            n += 1
            usuario = f"{usuario_desde(p['full_name'])}{n}"
        usados.add(usuario)

        principal = p["company_staff"][0]["companies"]["slug"]
        correo = f"{usuario}@{principal}.invalid"
        clave = clave_temporal()

        r = s.post(f"{auth}/admin/users", data=json.dumps({
            "email": correo, "password": clave, "email_confirm": True,
            "user_metadata": {"full_name": p["full_name"], "role": "asesor"},
        }), timeout=60)

        if r.status_code >= 300:
            fallidas.append((p["full_name"], r.text[:120]))
            continue

        uid = r.json()["id"]

        s.patch(f"{rest}/staff", params={"id": f"eq.{p['id']}"},
                data=json.dumps({"profile_id": uid}), timeout=60)

        # Una cuenta, todas sus empresas: 6 personas trabajan en varias.
        s.post(f"{rest}/company_users",
               params={"on_conflict": "company_id,user_id"},
               headers={"Prefer": "resolution=merge-duplicates"},
               data=json.dumps([{
                   "company_id": cs["company_id"], "user_id": uid,
                   "role": "asesor", "branch_id": cs["branch_id"], "removed_at": None,
               } for cs in p["company_staff"]]), timeout=60)

        creadas.append({
            "nombre": p["full_name"], "usuario": correo, "clave": clave,
            "empresas": [cs["companies"]["name"] for cs in p["company_staff"]],
        })
        print(f"  ✓ {p['full_name']:28s} {correo}")

    if fallidas:
        print("\nNo se pudieron crear:")
        for nombre, error in fallidas:
            print(f"  ✗ {nombre}: {error}")

    if creadas:
        with open(args.salida, "w", encoding="utf-8") as fh:
            fh.write("ACCESOS DE LOS COMERCIALES\n")
            fh.write(f"Generado el {datetime.date.today().isoformat()}\n\n")
            fh.write("El usuario es provisional. Cuando llegue el correo real se cambia\n")
            fh.write("desde Usuarios y la persona conserva todo su histórico.\n\n")
            for c in creadas:
                fh.write(f"{c['nombre']}\n")
                fh.write(f"  usuario:  {c['usuario']}\n")
                fh.write(f"  clave:    {c['clave']}\n")
                fh.write(f"  empresas: {', '.join(c['empresas'])}\n\n")
        print(f"\n{len(creadas)} cuenta(s) creadas.")
        print(f"Accesos guardados en: {args.salida}")
        print("Guárdalo: las contraseñas no se vuelven a mostrar.")


if __name__ == "__main__":
    main()
