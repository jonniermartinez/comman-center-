#!/usr/bin/env python3
"""
Comprueba, contra la base real, qué puede ver y escribir cada rol.

Uso:
    python tools/verificar_permisos.py

No confía en la interfaz: entra con una cuenta de cada rol y ejecuta las
operaciones contra la API, que es lo que haría alguien saltándose la pantalla.
Si la aplicación esconde un botón pero la política deja pasar la operación,
esto lo saca a la luz.

Las cuentas de prueba se crean al empezar y se borran al terminar, salvo la del
super admin, que es la real.
"""

import argparse
import json
import os
import random
import sys

try:
    import requests
except ImportError:
    sys.exit("Falta instalar dependencias:  pip install requests")

VERDE, ROJO, GRIS, FIN = "\033[32m", "\033[31m", "\033[90m", "\033[0m"


def entorno(clave):
    if os.environ.get(clave):
        return os.environ[clave]
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
    if os.path.exists(ruta):
        for linea in open(ruta, encoding="utf-8"):
            if linea.strip().startswith(clave + "="):
                return linea.split("=", 1)[1].strip()
    return None


class Api:
    def __init__(self, url, anon, token):
        self.rest = url.rstrip("/") + "/rest/v1"
        self.h = {"apikey": anon, "Authorization": f"Bearer {token}",
                  "Content-Type": "application/json"}

    def contar(self, tabla, filtro=None):
        p = dict(filtro or {})
        p["select"] = "id"
        r = requests.get(f"{self.rest}/{tabla}", params=p,
                         headers={**self.h, "Prefer": "count=exact", "Range": "0-0"}, timeout=60)
        if r.status_code >= 400:
            return None
        rango = r.headers.get("content-range", "*/0")
        return int(rango.split("/")[-1])

    def insertar(self, tabla, fila):
        r = requests.post(f"{self.rest}/{tabla}", headers={**self.h, "Prefer": "return=representation"},
                          data=json.dumps(fila), timeout=60)
        return r.status_code, (r.json() if r.text else None)

    def actualizar(self, tabla, id_, campos):
        """
        Devuelve (cambió_algo, filas).

        Un UPDATE que RLS filtra no falla: responde 200 con cero filas. Mirar
        solo el código de estado daría por permitido algo que nunca ocurrió.
        """
        r = requests.patch(f"{self.rest}/{tabla}", params={"id": f"eq.{id_}"},
                           headers={**self.h, "Prefer": "return=representation"},
                           data=json.dumps(campos), timeout=60)
        filas = r.json() if r.text else []
        return (r.status_code < 300 and bool(filas)), filas

    def borrar(self, tabla, id_):
        r = requests.delete(f"{self.rest}/{tabla}", params={"id": f"eq.{id_}"},
                            headers={**self.h, "Prefer": "return=representation"}, timeout=60)
        return r.status_code, (r.json() if r.text else None)


def entrar(url, anon, correo, clave):
    r = requests.post(f"{url}/auth/v1/token", params={"grant_type": "password"},
                      headers={"apikey": anon, "Content-Type": "application/json"},
                      data=json.dumps({"email": correo, "password": clave}), timeout=60)
    if r.status_code >= 300:
        return None
    return r.json()["access_token"]


resultados = []


def revisar(rol, accion, esperado, obtenido, detalle=""):
    ok = esperado == obtenido
    resultados.append(ok)
    marca = f"{VERDE}✓{FIN}" if ok else f"{ROJO}✗{FIN}"
    esp = "permite" if esperado else "niega"
    obt = "permite" if obtenido else "niega"
    linea = f"  {marca} {accion:52s} espera {esp:7s} → {obt}"
    if not ok:
        linea += f"  {ROJO}{detalle}{FIN}"
    elif detalle:
        linea += f"  {GRIS}{detalle}{FIN}"
    print(linea)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--admin-email", default="jonnieralejandrom@gmail.com")
    ap.add_argument("--admin-clave", required=True)
    args = ap.parse_args()

    url = entorno("NEXT_PUBLIC_SUPABASE_URL")
    anon = entorno("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    service = entorno("SUPABASE_SERVICE_ROLE_KEY")
    if not (url and anon and service):
        sys.exit("Faltan variables de entorno")

    sk = {"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"}
    rest = url.rstrip("/") + "/rest/v1"

    # ---------------- montar el escenario ----------------
    empresas = requests.get(f"{rest}/companies", params={"select": "id,name,slug", "order": "name"},
                            headers=sk, timeout=60).json()
    a, b = empresas[0], empresas[1]
    sede_a = requests.get(f"{rest}/branches", params={"select": "id", "company_id": f"eq.{a['id']}",
                                                     "limit": "1"}, headers=sk, timeout=60).json()[0]["id"]

    print(f"Empresa A (con acceso): {a['name']}   ·   Empresa B (sin acceso): {b['name']}")

    sufijo = random.randint(1000, 9999)
    cuentas = {}
    for rol in ("coordinador", "asesor", "sin_empresa"):
        correo = f"prueba.{rol}.{sufijo}@permisos.invalid"
        clave = f"Prueba{sufijo}*"
        r = requests.post(f"{url}/auth/v1/admin/users", headers=sk, data=json.dumps({
            "email": correo, "password": clave, "email_confirm": True,
            "user_metadata": {"full_name": f"Prueba {rol}", "role": "asesor"},
        }), timeout=60)
        uid = r.json()["id"]
        cuentas[rol] = {"id": uid, "correo": correo, "clave": clave}

    # El coordinador y el asesor entran a la empresa A; el tercero, a ninguna.
    requests.post(f"{rest}/company_users", headers={**sk, "Prefer": "resolution=merge-duplicates"},
                  params={"on_conflict": "company_id,user_id"},
                  data=json.dumps([
                      {"company_id": a["id"], "user_id": cuentas["coordinador"]["id"],
                       "role": "coordinador", "branch_id": None},
                      {"company_id": a["id"], "user_id": cuentas["asesor"]["id"],
                       "role": "asesor", "branch_id": sede_a},
                  ]), timeout=60)

    # El asesor además es un comercial del equipo: así puede registrar lo suyo.
    staff = requests.post(f"{rest}/staff", headers={**sk, "Prefer": "return=representation"},
                          data=json.dumps({"full_name": f"Prueba Asesor {sufijo}",
                                           "slug": f"prueba_asesor_{sufijo}",
                                           "profile_id": cuentas["asesor"]["id"]}), timeout=60).json()[0]
    requests.post(f"{rest}/company_staff", headers=sk,
                  data=json.dumps({"company_id": a["id"], "staff_id": staff["id"],
                                   "branch_id": sede_a}), timeout=60)
    otro_staff = requests.get(f"{rest}/staff", params={"select": "id", "id": f"neq.{staff['id']}",
                                                      "limit": "1"}, headers=sk, timeout=60).json()[0]["id"]

    # Se cuenta después de crear las cuentas de prueba: contarlo antes hace que
    # el super admin vea tres perfiles más que el total y parezca un fallo.
    total_perfiles = int(requests.get(f"{rest}/profiles", params={"select": "id"},
                                      headers={**sk, "Prefer": "count=exact", "Range": "0-0"},
                                      timeout=60).headers["content-range"].split("/")[-1])
    print(f"Perfiles en la plataforma: {total_perfiles}\n")

    venta_base = {"company_id": a["id"], "branch_id": sede_a, "report_date": "2026-08-10",
                  "period_month": "2026-08-01", "valor_final": 1000, "licencia_nombre": "PRUEBA PERMISOS"}

    creados = []

    def probar(rol, token, es_admin=False, gestiona=False, tiene_empresa=True):
        api = Api(url, anon, token)
        print(f"\n{'='*78}\n{rol.upper()}\n{'='*78}")

        # --- lectura ---
        ve_a = api.contar("sales", {"company_id": f"eq.{a['id']}"})
        ve_b = api.contar("sales", {"company_id": f"eq.{b['id']}"})
        revisar(rol, "ve las ventas de su empresa", tiene_empresa, bool(ve_a), f"{ve_a} filas")
        revisar(rol, "ve las ventas de OTRA empresa", es_admin, bool(ve_b), f"{ve_b} filas")

        perfiles = api.contar("profiles")
        revisar(rol, "ve TODOS los perfiles de la plataforma", es_admin,
                perfiles == total_perfiles, f"{perfiles} de {total_perfiles}")

        audit = api.contar("audit_log")
        revisar(rol, "puede leer la auditoría", es_admin, bool(audit), f"{audit} entradas")

        # --- escritura de una venta propia y ajena ---
        estado, datos = api.insertar("sales", {**venta_base, "staff_id": staff["id"]})
        puede_propia = estado < 300
        if puede_propia and datos:
            creados.append(("sales", datos[0]["id"]))
        revisar(rol, "registra una venta A SU NOMBRE", tiene_empresa, puede_propia)

        estado, datos = api.insertar("sales", {**venta_base, "staff_id": otro_staff})
        puede_ajena = estado < 300
        if puede_ajena and datos:
            creados.append(("sales", datos[0]["id"]))
        revisar(rol, "registra una venta A NOMBRE DE OTRO", gestiona or es_admin, puede_ajena)

        estado, _ = api.insertar("sales", {**venta_base, "company_id": b["id"], "staff_id": otro_staff})
        revisar(rol, "registra una venta en OTRA empresa", es_admin, estado < 300)

        # --- administración ---
        estado, datos = api.insertar("companies", {"name": f"Prueba {sufijo}", "slug": f"prueba-{sufijo}"})
        if estado < 300 and datos:
            creados.append(("companies", datos[0]["id"]))
        revisar(rol, "crea una empresa", es_admin, estado < 300)

        estado, datos = api.insertar("branches",
                                     {"company_id": a["id"], "name": f"Sede prueba {sufijo}-{rol}"})
        if estado < 300 and datos:
            creados.append(("branches", datos[0]["id"]))
        revisar(rol, "crea una sede en su empresa", gestiona or es_admin, estado < 300,
                "" if estado < 300 else str(datos)[:90])

        cambio, _ = api.actualizar("profiles", cuentas["asesor"]["id"], {"role": "super_admin"})
        revisar(rol, "asciende a otro a super admin", es_admin, cambio)
        if cambio:
            requests.patch(f"{rest}/profiles", params={"id": f"eq.{cuentas['asesor']['id']}"},
                           headers=sk, data=json.dumps({"role": "asesor"}), timeout=60)

        requests.delete(f"{rest}/company_modules",
                        params={"company_id": f"eq.{a['id']}", "module_code": "eq.caja"},
                        headers=sk, timeout=60)
        estado, datos = api.insertar("company_modules", {"company_id": a["id"], "module_code": "caja"})
        revisar(rol, "cambia los módulos de su empresa", gestiona or es_admin, estado < 300,
                "" if estado < 300 else str(datos)[:90])

    for rol, es_admin, gestiona, con_empresa in (
        ("super_admin", True, True, True),
        ("coordinador", False, True, True),
        ("asesor", False, False, True),
        ("sin_empresa", False, False, False),
    ):
        if rol == "super_admin":
            token = entrar(url, anon, args.admin_email, args.admin_clave)
        else:
            token = entrar(url, anon, cuentas[rol]["correo"], cuentas[rol]["clave"])
        if not token:
            print(f"\n{ROJO}No se pudo entrar como {rol}{FIN}")
            continue
        probar(rol, token, es_admin, gestiona, con_empresa)

    # ---------------- limpiar ----------------
    for tabla, id_ in creados:
        requests.delete(f"{rest}/{tabla}", params={"id": f"eq.{id_}"}, headers=sk, timeout=60)
    requests.delete(f"{rest}/sales", params={"licencia_nombre": "eq.PRUEBA PERMISOS"}, headers=sk, timeout=60)
    requests.delete(f"{rest}/company_staff", params={"staff_id": f"eq.{staff['id']}"}, headers=sk, timeout=60)
    requests.delete(f"{rest}/staff", params={"id": f"eq.{staff['id']}"}, headers=sk, timeout=60)
    for c in cuentas.values():
        requests.delete(f"{rest}/company_users", params={"user_id": f"eq.{c['id']}"}, headers=sk, timeout=60)
        requests.delete(f"{rest}/profiles", params={"id": f"eq.{c['id']}"}, headers=sk, timeout=60)
        requests.delete(f"{url}/auth/v1/admin/users/{c['id']}", headers=sk, timeout=60)

    fallos = resultados.count(False)
    print(f"\n{'='*78}")
    if fallos:
        print(f"{ROJO}{fallos} comprobación(es) fallaron de {len(resultados)}.{FIN}")
        sys.exit(1)
    print(f"{VERDE}Las {len(resultados)} comprobaciones pasaron.{FIN}")


if __name__ == "__main__":
    main()
