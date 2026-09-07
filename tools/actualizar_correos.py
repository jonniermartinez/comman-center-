#!/usr/bin/env python3
"""
Cambia el usuario provisional por el correo real.

Uso:
    python tools/actualizar_correos.py --dry-run
    python tools/actualizar_correos.py

Las cuentas nacieron con un usuario provisional `.invalid` (ver
`crear_cuentas.py`). Aqui se pone el correo que cada persona reporto. Lo unico
que cambia es la direccion: el identificador de la cuenta sigue siendo el
mismo, asi que el historico, las empresas y las metas se quedan donde estan.

El correo queda confirmado de una vez, para que la persona entre con su clave
temporal sin tener que aceptar ninguna invitacion.
"""

import argparse
import os
import sys

try:
    import requests
except ImportError:
    sys.exit("Falta instalar dependencias:  pip install requests")

# Correo real -> nombre con el que la persona esta guardada en `profiles`.
# El nombre completo que reporto el closer va al lado, para poder revisarlo.
CORREOS = [
    ("comercialjuandavidalvarez@gmail.com", "Alvarez juan",       "Juan David Alvarez Tobar"),
    ("juangomez.asesor.carss@gmail.com",    "Gomez Juan",         "Juan Jose Gomez Castro"),
    ("ecommerceescuelattc@gmail.com",       "Torres Claudia",     "Claudia Torres Collazos"),
    ("juancamilo.asesorescuelas@gmail.com", "Nuñez Juan",         "Juan Camilo Nuñez Herrera"),
    ("allison.asesoratenas@hotmail.com",    "Lopez Allison",      "Allison Lopez Palacios"),
    ("lauraeasesorelite@gmail.com",         "Escobar Valentina",  "Laura Valentina Ruiz Escobar"),
    ("tuluaceala28valentina@hotmail.com",   "Bulla Valentina",    "Valentina Bulla Espinosa"),
    ("asesora.katerine.licencias@gmail.com","Cortes Katerine",    "Paula Katerine Cortes Villalba"),
    ("ingridarias.asesora.elite@gmail.com", "Arias Ingrid",       "Ingrid Hableidy Arias Gamba"),
    ("ladysarria.asesor.elite@gmail.com",   "Sarria Lady",        "Lady Johana Sarria Capote"),
    ("marianagarcia.asesorescuelas@gmail.com", "García Mariana",  "Mariana Garcia Mora"),
    ("marianaeduvialbecerra@gmail.com",     "Becerra Mariana",    "Mariana Becerra"),
    ("lauracasso.asesora.ceaeduvial@gmail.com", "Casso Laura",    "Laura Geraldin Casso"),
    ("asesorcomerciallorenalaguna@hotmail.com", "Laguna Lorena",  "Angie Lorena Laguna Echeverry"),
    ("comercialjuliethzuluaga@gmail.com",   "Zuluaga Julieth",    "Julieth Zuluaga Posso"),
    ("comercialdanieladiaz@gmail.com",      "Diaz Daniela",       "Daniela Diaz Pizarro"),
]


def entorno(clave):
    if os.environ.get(clave):
        return os.environ[clave]
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
    if os.path.exists(ruta):
        for linea in open(ruta, encoding="utf-8"):
            linea = linea.strip()
            if linea.startswith(clave + "="):
                return linea.split("=", 1)[1].strip().strip("\"'")
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="solo muestra lo que haria")
    args = parser.parse_args()

    url = entorno("NEXT_PUBLIC_SUPABASE_URL")
    key = entorno("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (.env.local)")

    s = requests.Session()
    s.headers.update({"apikey": key, "Authorization": f"Bearer {key}",
                      "Content-Type": "application/json"})
    rest = url.rstrip("/") + "/rest/v1"
    auth = url.rstrip("/") + "/auth/v1"

    r = s.get(f"{rest}/profiles", params={"select": "id,full_name,email", "deleted_at": "is.null"})
    r.raise_for_status()
    por_nombre = {p["full_name"]: p for p in r.json()}

    cambios = errores = 0
    for correo, nombre, reportado in CORREOS:
        correo = correo.strip().lower()
        persona = por_nombre.get(nombre)
        if not persona:
            print(f"  ??  {nombre}: no esta en profiles  ({reportado})")
            errores += 1
            continue
        if persona["email"] == correo:
            print(f"  ==  {nombre}: ya tiene {correo}")
            continue
        print(f"  ->  {nombre}: {persona['email']}  ->  {correo}")
        if args.dry_run:
            cambios += 1
            continue
        r = s.put(f"{auth}/admin/users/{persona['id']}",
                  json={"email": correo, "email_confirm": True})
        if r.status_code >= 300:
            print(f"      fallo: {r.status_code} {r.text}")
            errores += 1
            continue
        cambios += 1

    print(f"\n{cambios} correo(s) {'por cambiar' if args.dry_run else 'cambiados'}, {errores} con problema.")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
