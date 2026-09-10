#!/usr/bin/env python3
"""
Importa el histórico de los archivos .xlsb a Supabase.

Uso:
    pip install pyxlsb requests
    python tools/importar_excel.py --carpeta ~/Downloads/command/OneDrive_16_18-8-2026
    python tools/importar_excel.py --carpeta ... --solo "LV - Unión"   # un archivo
    python tools/importar_excel.py --carpeta ... --dry-run             # sin escribir

Idempotente: antes de cargar un archivo borra lo que ese mismo archivo haya
dejado antes (`source_file`), así que volver a correrlo corrige en vez de
duplicar. Nunca toca lo capturado desde la aplicación (`source = 'app'`).

Se conecta con la clave de servicio porque salta RLS: importar 46.000 filas
como un usuario concreto obligaría a que ese usuario tuviera acceso a las trece
empresas, que es justo lo que las políticas impiden.
"""

import argparse
import datetime
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict

try:
    import requests
    from pyxlsb import open_workbook
except ImportError:
    sys.exit("Falta instalar dependencias:  pip install pyxlsb requests")

EPOCA_EXCEL = datetime.date(1899, 12, 30)

# ------------------------------------------------------------------
# Una empresa por oficina.
#
# Cada archivo es una oficina y cada oficina es una empresa. Las agrupaciones
# que se usaban antes —LV, CEA, Trámites— salían del prefijo del nombre del
# archivo y no existen: nadie factura como "LV".
#
# El nombre del archivo manda, no la columna "Empresa": está mal digitada en
# varios (el archivo "Trámites Tuluá" dice "LV Tuluá" en todas sus filas, y los
# tres de Cars dicen "CEA Carss").
#
# La columna "Escuela" tampoco dice de quién es la venta: dice dónde va a
# estudiar el alumno. Trámites Florida vende cursos de CEA la 28 y de TTC sin
# ser ninguna de las dos, y Yumbo y Palmira venden TTC entero.
# ------------------------------------------------------------------
EMPRESAS = {
    #  nombre                     ciudad          departamento       color
    "CEA la 28":             ("Tuluá",        "Valle del Cauca", "#b45309"),
    "TTC":                   ("Jamundí",      "Valle del Cauca", "#7c3aed"),
    "Eduvial":               ("Pereira",      "Risaralda",       "#0891b2"),
    "Autogo":                ("La Unión",     "Valle del Cauca", "#1d4ed8"),
    "Ruta Maestra":          ("Cartago",      "Valle del Cauca", "#0f766e"),
    "Ruta Segura":           ("Buga",         "Valle del Cauca", "#be123c"),
    "Atenas":                ("Yumbo",        "Valle del Cauca", "#ca8a04"),
    "San José":              ("Palmira",      "Valle del Cauca", "#4d7c0f"),
    "Trámites Buenaventura": ("Buenaventura", "Valle del Cauca", "#0369a1"),
    "Cevial":                ("El Cerrito",   "Valle del Cauca", "#9333ea"),
    "Trámites Candelaria":   ("Candelaria",   "Valle del Cauca", "#c2410c"),
    "Trámites Florida":      ("Florida",      "Valle del Cauca", "#059669"),
    "Carss":                 ("Cali",         "Valle del Cauca", "#db2777"),
}

MAPA = {
    "Ventas - Trámites Tuluá":      "CEA la 28",
    "Ventas Internas - Tuluá":      "CEA la 28",
    "Ventas TTC":                   "TTC",
    "Ventas - CEA Eduvial":         "Eduvial",
    "Ventas LV - Unión":            "Autogo",
    "Ventas - Trámites Cartago":    "Ruta Maestra",
    "Ventas - Ruta Segura":         "Ruta Segura",
    "Ventas LV - Yumbo":            "Atenas",
    "Ventas LV - Palmira":          "San José",
    "Ventas LV - Buenaventura":     "Trámites Buenaventura",
    "Ventas - CEA Cevial":          "Cevial",
    "Ventas - Trámites Candelaria": "Trámites Candelaria",
    "Ventas - Trámites Florida":    "Trámites Florida",
    "Ventas Cars - Legendarios":    "Carss",
    "Ventas Cars - Monarcas":       "Carss",
    "Ventas Cars - Sultanes":       "Carss",
}

# ------------------------------------------------------------------
# Carss es la única excepción y por eso tiene tres sedes en vez de una.
#
# Legendarios, Monarcas y Sultanes no son oficinas: son equipos comerciales, y
# la misma gente aparece en varios —Arias Ingrid y Acevedo Nataly venden en
# dos, Prado Mariana en los tres—. La empresa es una y sus sedes son las dos
# escuelas de Cali. Ahí sí la columna Escuela decide, porque la venta se hace
# para una o para la otra.
#
# Hasta junio de 2026 esa columna decía "Cars" a secas, y ninguna otra
# —contrato, voucher, examen, centro médico, financiación— las distingue. Esas
# 482 no se reparten a ojo: van a "Sin definir", que no es ninguna de las dos.
# El equipo del que salió cada fila queda en source_file.
# ------------------------------------------------------------------
SEDE_UNICA = "Sede principal"
SIN_DEFINIR = "Sin definir"
SEDES_CARSS = {"conducars": "Conducars", "champions": "Champions Car"}


def sedes_de(empresa):
    """Sedes de una empresa, la principal primero."""
    if empresa == "Carss":
        return ["Conducars", "Champions Car", SIN_DEFINIR]
    return [SEDE_UNICA]


def sede_de(empresa, escuela):
    """A qué sede va una venta. Solo Carss reparte; el resto tiene una sola."""
    if empresa != "Carss":
        return SEDE_UNICA
    return SEDES_CARSS.get(slug(escuela), SIN_DEFINIR)

# "Todo" no es una persona: en el Excel marca lo que no se atribuye a nadie.
NO_ES_PERSONA = {"todo", "todos", "n/a", "na", "-", ""}


# ------------------------------------------------------------------
# Utilidades
# ------------------------------------------------------------------
def slug(valor):
    """Normaliza un valor de catálogo: sin tildes, minúsculas, con guiones."""
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = re.sub(r"[^a-zA-Z0-9]+", "_", texto).strip("_").lower()
    return texto or None


def fecha(valor):
    """Serial de Excel → date. Devuelve None si no es una fecha razonable."""
    if isinstance(valor, (int, float)) and 1 < valor < 80000:
        return EPOCA_EXCEL + datetime.timedelta(days=int(valor))
    if isinstance(valor, str):
        try:
            return datetime.date.fromisoformat(valor.strip()[:10])
        except ValueError:
            return None
    return None


def hora(valor):
    """Fracción de día → 'HH:MM'. El Excel guarda las horas como decimales."""
    if not isinstance(valor, (int, float)):
        return None
    frac = float(valor) % 1
    if frac <= 0:
        return None
    minutos = round(frac * 24 * 60)
    return f"{minutos // 60 % 24:02d}:{minutos % 60:02d}"


def numero(valor):
    if isinstance(valor, (int, float)):
        return float(valor)
    if isinstance(valor, str):
        limpio = valor.replace("$", "").replace(".", "").replace(",", ".").strip()
        try:
            return float(limpio)
        except ValueError:
            return 0.0
    return 0.0


def entero(valor):
    n = numero(valor)
    return int(n) if n and n > 0 else 0


def texto(valor, limite=None):
    if valor is None:
        return None
    if isinstance(valor, float) and valor.is_integer():
        t = str(int(valor))
    else:
        t = str(valor).strip()
    if not t:
        return None
    return t[:limite] if limite else t


def mes(d):
    return d.replace(day=1) if d else None


# ------------------------------------------------------------------
# Cliente mínimo de Supabase
# ------------------------------------------------------------------
class Supabase:
    def __init__(self, url, key, dry_run=False):
        self.url = url.rstrip("/") + "/rest/v1"
        self.dry_run = dry_run
        self.s = requests.Session()
        self.s.headers.update({
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        })

    def select(self, tabla, params):
        r = self.s.get(f"{self.url}/{tabla}", params=params, timeout=60)
        r.raise_for_status()
        return r.json()

    def insert(self, tabla, filas, upsert_on=None, devolver=False):
        if not filas:
            return []
        if self.dry_run:
            # En seco se devuelven identificadores de mentira para que el resto
            # del proceso pueda ejecutarse y contar filas sin escribir nada.
            return [{"id": f"dry-{tabla}-{i}", "slug": f.get("slug")}
                    for i, f in enumerate(filas)] if devolver else []
        prefer = ["return=representation" if devolver else "return=minimal"]
        params = {}
        if upsert_on:
            prefer.append("resolution=merge-duplicates")
            params["on_conflict"] = upsert_on
        salida = []
        # Por lotes: 46.000 filas en una sola petición se caen por tamaño.
        for i in range(0, len(filas), 500):
            lote = filas[i:i + 500]
            r = self.s.post(f"{self.url}/{tabla}", params=params,
                            headers={"Prefer": ",".join(prefer)},
                            data=json.dumps(lote, default=str), timeout=180)
            if r.status_code >= 300:
                raise RuntimeError(f"{tabla}: {r.status_code} {r.text[:400]}")
            if devolver:
                salida.extend(r.json())
        return salida

    def delete(self, tabla, params):
        if self.dry_run:
            return
        r = self.s.delete(f"{self.url}/{tabla}", params=params, timeout=180)
        if r.status_code >= 300:
            raise RuntimeError(f"borrar {tabla}: {r.status_code} {r.text[:300]}")


# ------------------------------------------------------------------
# Lectura de hojas
# ------------------------------------------------------------------
def leer_hoja(ruta, nombres):
    """Devuelve (cabecera, filas) de la primera hoja que exista de `nombres`."""
    with open_workbook(ruta) as wb:
        hoja = next((h for h in nombres if h in wb.sheets), None)
        if not hoja:
            return None, []
        with wb.get_sheet(hoja) as sh:
            cab, filas = None, []
            for i, fila in enumerate(sh.rows()):
                vals = [c.v for c in fila]
                if not any(v not in (None, "") for v in vals):
                    continue
                if cab is None:
                    cab = [str(v).strip() if v is not None else "" for v in vals]
                    continue
                filas.append((i, vals))
            return cab, filas


class Fila:
    """Acceso por nombre de columna, tolerante a las variantes entre archivos."""

    def __init__(self, cabecera, valores):
        self.idx = {c: i for i, c in enumerate(cabecera)}
        self.v = valores

    def __call__(self, *nombres):
        for n in nombres:
            i = self.idx.get(n)
            if i is not None and i < len(self.v):
                return self.v[i]
        return None


# ------------------------------------------------------------------
# Catálogos: se acumulan mientras se leen los archivos y se escriben al final.
# ------------------------------------------------------------------
class Catalogos:
    """
    Junta los valores que aparecen en los archivos y los deja normalizados.

    El histórico trae la misma cosa escrita de varias formas —"Sistecredito" y
    "Sistecrédito", "Interaccion directo" e "Interacción Directo"—. El código es
    el valor normalizado, así que las variantes colapsan solas; el nombre que se
    muestra es la primera forma con tildes que aparezca, que suele ser la buena.
    """

    TABLAS = {
        "channels": "canal",
        "ad_categories": "categoría de anuncio",
        "schools": "escuela",
        "medical_centers": "centro médico",
        "products": "producto",
        "sale_states": "estado de trámite",
        "sale_types": "tipo de venta",
        "id_types": "tipo de documento",
        "cash_concepts": "concepto de caja",
        "financing_types": "financiación",
        "payment_methods": "medio de pago",
    }

    def __init__(self):
        self.valores = defaultdict(dict)

    def add(self, tabla, valor):
        code = slug(valor)
        if not code:
            return None
        actual = self.valores[tabla].get(code)
        nombre = str(valor).strip()
        # Se prefiere la forma con tildes y con mayúscula inicial.
        if actual is None or (nombre != nombre.lower() and actual == actual.lower()):
            self.valores[tabla][code] = nombre
        return code

    def escribir(self, sb):
        for tabla, valores in self.valores.items():
            filas = [{"code": c, "name": n, "sort_order": i}
                     for i, (c, n) in enumerate(sorted(valores.items()))]
            if tabla == "products":
                for f in filas:
                    # "Ren A2", "Ren C1": el producto dice si es renovación.
                    f["is_renovacion"] = f["code"].startswith("ren_") or f["code"] == "ren"
            sb.insert(tabla, filas, upsert_on="code")
            print(f"  catálogo {tabla:18s} {len(filas):4d} valores")


# ------------------------------------------------------------------
# Empresas, sedes y personas
# ------------------------------------------------------------------
def asegurar_estructura(sb, archivos):
    """Crea las empresas y sedes que hagan falta y devuelve sus ids."""
    nombres = {MAPA[a] for a in archivos if a in MAPA}

    if sb.dry_run:
        # En seco no se consulta ni se escribe: solo hacen falta claves para que
        # el resto del proceso pueda armar las filas y contarlas.
        empresas = {n: f"dry-{slug(n)}" for n in nombres}
        sedes = {(n, s): f"dry-{slug(n)}-{slug(s)}"
                 for n in nombres for s in sedes_de(n)}
        return empresas, sedes

    empresas, sedes = {}, {}
    for nombre in sorted(nombres):
        ciudad, departamento, color = EMPRESAS[nombre]
        datos = {
            "name": nombre,
            "slug": slug(nombre).replace("_", "-"),
            "city": ciudad,
            "department": departamento,
            "accent_color": color,
            "crm_label": nombre,
        }
        existente = sb.select("companies", {"slug": f"eq.{datos['slug']}",
                                            "select": "id"})
        if existente:
            empresas[nombre] = existente[0]["id"]
        else:
            creada = sb.insert("companies", [datos], devolver=True)
            empresas[nombre] = creada[0]["id"] if creada else None
            print(f"  empresa creada: {nombre}")

        cid = empresas[nombre]
        if not cid:
            continue

        # La primera de la lista es la principal.
        for i, sede in enumerate(sedes_de(nombre)):
            existente = sb.select("branches", {"company_id": f"eq.{cid}",
                                               "name": f"eq.{sede}", "select": "id"})
            if existente:
                sedes[(nombre, sede)] = existente[0]["id"]
                continue
            creada = sb.insert("branches", [{
                "company_id": cid,
                "name": sede,
                "city": ciudad,
                "department": departamento,
                "is_primary": i == 0,
            }], devolver=True)
            sedes[(nombre, sede)] = creada[0]["id"] if creada else None
            print(f"  sede creada: {nombre} · {sede}")

    # Todos los módulos habilitados para todas las empresas importadas.
    modulos = [m["code"] for m in sb.select("modules", {"select": "code"})]
    sb.insert("company_modules",
              [{"company_id": cid, "module_code": m}
               for cid in empresas.values() if cid for m in modulos],
              upsert_on="company_id,module_code")

    return empresas, sedes


def asegurar_personas(sb, nombres):
    """Crea en `staff` las personas que falten. Devuelve slug → id."""
    if not nombres:
        return {}
    if sb.dry_run:
        print(f"  personas distintas: {len({slug(n) for n in nombres if slug(n)})}")
        return {slug(n): f"dry-staff-{slug(n)}" for n in nombres if slug(n)}
    existentes = {s["slug"]: s["id"] for s in sb.select("staff", {"select": "id,slug"})}
    faltan = [(slug(n), n) for n in nombres if slug(n) and slug(n) not in existentes]
    unicos = dict(faltan)
    if unicos:
        creadas = sb.insert("staff",
                            [{"full_name": n, "slug": s} for s, n in unicos.items()],
                            devolver=True)
        for c in creadas:
            existentes[c["slug"]] = c["id"]
        print(f"  personas nuevas: {len(unicos)}")
    return existentes


# ------------------------------------------------------------------
# Transformación de cada hoja
# ------------------------------------------------------------------
def sede_id(ctx, escuela=None):
    """Id de la sede donde va una fila. Sin escuela, la sede por defecto."""
    return ctx["sedes"][sede_de(ctx["empresa"], escuela)]


def leer_ventas(ruta, cat, ctx):
    cab, filas = leer_hoja(ruta, ["Base"])
    if not cab:
        return [], set()
    salida, personas, sin_fecha = [], set(), 0

    for nfila, valores in filas:
        f = Fila(cab, valores)
        ref = texto(f("Ref Crédito"))
        if not ref:
            continue
        d = fecha(f("Fecha Solicitud")) or fecha(f("Fecha Certificado"))
        if not d:
            sin_fecha += 1
            continue

        resp = texto(f("Responsable"))
        if resp and slug(resp) in NO_ES_PERSONA:
            resp = None
        if resp:
            personas.add(resp)

        fc, fl, fd = (fecha(f("Fecha Certificado")), fecha(f("Fecha Legalización")),
                      fecha(f("Fecha Devolución")))

        escuela = f("Escuela")

        salida.append({
            "company_id": ctx["company_id"], "branch_id": sede_id(ctx, escuela),
            "ref_credito": ref[:200],
            "report_date": d.isoformat(), "period_month": mes(d).isoformat(),
            "responsable_nombre": resp,
            "_staff": slug(resp) if resp else None,
            "channel_code": cat.add("channels", f("Canal")),
            "ad_category_code": cat.add("ad_categories", f("Categoría Anuncio")),
            "financing_code": cat.add("financing_types", f("Línea Negocio")),
            "sale_type_code": cat.add("sale_types", f("Tipo Venta")),
            "product_code": cat.add("products", f("Producto")),
            "school_code": cat.add("schools", escuela),
            "medical_center_code": cat.add("medical_centers", f("Examen Médico")),
            "state_code": cat.add("sale_states", f("Estado Trámite")),
            "licencia_tipo_id": cat.add("id_types", f("Tipo ID TL")),
            "licencia_id": texto(f("ID Titular Licencia"), 40),
            "licencia_nombre": texto(f("Nombre Titular Licencia"), 200),
            "licencia_celular": texto(f("Celular Titular Licencia"), 40),
            "credito_tipo_id": cat.add("id_types", f("Tipo ID TC")),
            "credito_id": texto(f("ID Titular Crédito"), 40),
            "credito_nombre": texto(f("Nombre Titular Crédito"), 200),
            "credito_celular": texto(f("Celular Titular Crédito"), 40),
            "fecha_certificado": fc.isoformat() if fc else None,
            "fecha_legalizacion": fl.isoformat() if fl else None,
            "fecha_devolucion": fd.isoformat() if fd else None,
            "pagare": texto(f("Pagaré"), 60),
            "voucher": texto(f("Voucher"), 60),
            "contrato": texto(f("Contrato"), 60),
            "consecutivo_examen": texto(f("Consecutivo Examen"), 60),
            "evento": texto(f("Evento"), 40),
            "pago_evento": texto(f("Pago Evento"), 40),
            "devolucion_lamina": texto(f("Devolución Lámina"), 60),
            "cuenta_devolucion": texto(f("Cuenta Devolución"), 120),
            "id_asociado": texto(f("Id Asociado"), 60),
            "id_referido": texto(f("Id Referido"), 60),
            "documentos": texto(f("Documentos"), 300),
            "observacion": texto(f("Observación"), 600),
            "departamento": texto(f("Departamento"), 80),
            "ciudad": texto(f("Ciudad"), 80),
            "valor_inicial": numero(f("Valor Inicial")),
            "adicion": numero(f("Adición")),
            "descuento": numero(f("Descuento")),
            "valor_final": numero(f("Valor Final")),
            "recaudo": numero(f("Recaudo")),
            "saldo": numero(f("Saldo")),
            "valor_lamina": numero(f("Valor Lámina")),
            "ingreso_neto": numero(f("Ingreso Neto")),
            "costo_carta": numero(f("Costo Carta")),
            "costo_examen": numero(f("Costo Exámen")),
            "total_costo": numero(f("Total Costo")),
            "cantidad_final": numero(f("Cantidad Final")),
            "cantidad_comision": numero(f("Cantidad Comisión")),
            "valor_comision": numero(f("Valor Comisión")),
            "total_comision": numero(f("Total")),
            "source": "excel", "source_file": ctx["archivo"], "source_row": nfila,
        })

    if sin_fecha:
        print(f"  · {sin_fecha} venta(s) sin fecha utilizable, omitidas")
    return salida, personas


def leer_pagos(ruta, cat, ctx, fecha_por_ref=None, sede_por_ref=None):
    """
    Lee la hoja de pagos.

    `fecha_por_ref` mapea la referencia del crédito a la fecha de su venta. Se
    usa para los pagos que vienen sin fecha: en vez de dejarlos fuera —lo que
    descuadraría el recaudo contra el Excel— entran con la fecha de su venta y
    marcados como estimados.

    `sede_por_ref` hace lo mismo con la sede: el abono va donde quedó su venta.
    Solo cambia algo en Carss, la única empresa con más de una; el pago que no
    encuentre su venta cae en la sede por defecto.
    """
    cab, filas = leer_hoja(ruta, ["Pagos"])
    if not cab:
        return [], []
    salida, sin_fecha = [], []
    for nfila, valores in filas:
        f = Fila(cab, valores)
        valor = numero(f("Valor"))
        if not valor:
            continue
        ref = texto(f("Referencia Crédito"), 200)
        d = fecha(f("Fecha"))
        estimada = False
        if not d and ref and fecha_por_ref:
            d = fecha_por_ref.get(ref)
            estimada = d is not None
        if not d:
            sin_fecha.append({"fila": nfila, "ref": ref, "valor": valor})
            continue
        salida.append({
            "company_id": ctx["company_id"],
            "branch_id": (sede_por_ref or {}).get(ref) or sede_id(ctx),
            "ref_credito": ref,
            "report_date": d.isoformat(), "period_month": mes(d).isoformat(),
            "date_estimated": estimada,
            "titular_id": texto(f("ID Titular Crédito"), 40),
            "titular_nombre": texto(f("Nombre Titular Crédito"), 200),
            "amount": valor,
            "method_code": cat.add("payment_methods", f("Medio Pago")),
            "recibo": texto(f("N° Recibo Voucher"), 60),
            "observacion": texto(f("Observación"), 600),
            # Solo los archivos de Carss traen estos cinco. Los del titular
            # podrían deducirse de la venta, pero únicamente cuando el pago
            # encontró la suya; los tres documentos son de este abono y no
            # están en ninguna otra parte.
            "licencia_id": texto(f("ID Titular Licencia"), 40),
            "licencia_nombre": texto(f("Nombre Titular Licencia"), 200),
            "pagare": texto(f("Pagaré"), 60),
            "voucher": texto(f("Voucher"), 60),
            "contrato": texto(f("Contrato"), 60),
            "source": "excel", "source_file": ctx["archivo"], "source_row": nfila,
        })
    return salida, sin_fecha


def leer_actividad(ruta, ctx):
    cab, filas = leer_hoja(ruta, ["Gestión", "GESTIÓN"])
    if not cab:
        return [], set()
    salida, personas, vistos, repetidos = [], set(), set(), 0

    for nfila, valores in filas:
        f = Fila(cab, valores)
        d = fecha(f("Fecha"))
        resp = texto(f("Responsable"))
        if not d or not resp or slug(resp) in NO_ES_PERSONA:
            continue
        # La tabla admite una fila por persona y día. Si el Excel repite la
        # combinación se queda la primera: son correcciones encima, no días
        # distintos.
        clave = (d.isoformat(), slug(resp))
        if clave in vistos:
            repetidos += 1
            continue
        vistos.add(clave)
        personas.add(resp)

        salida.append({
            "company_id": ctx["company_id"], "branch_id": sede_id(ctx),
            "report_date": d.isoformat(), "period_month": mes(d).isoformat(),
            "responsable_nombre": resp, "_staff": slug(resp),
            "hora_llegada": hora(f("Hora Llegada")),
            "hora_salida": hora(f("Hora Salida")),
            "chats_inicial": entero(f("Chats por responder Reporte Inicial")),
            "chats_medio": entero(f("Chats por responder Reporte medio día")),
            "chats_final": entero(f("Chats por responder Reporte Final")),
            "tareas_inicial": entero(f("Tareas del día Reporte Inicial")),
            "tareas_medio": entero(f("Tareas del día Reporte medio día")),
            "tareas_final": entero(f("Tareas del día Reporte Final")),
            "caducadas_inicial": entero(f("Tareas caducadas Reporte Inicial")),
            "caducadas_medio": entero(f("Tareas caducadas Reporte medio día")),
            "caducadas_final": entero(f("Tareas caducadas Reporte Final")),
            "agenda_confirmada": entero(f("Agenda Confirmada")),
            "agenda_posible": entero(f("Agenda Posible Asistencia")),
            "agenda_reprograma": entero(f("Agenda Reprograma")),
            "agenda_no_contesta": entero(f("Agenda NO contesta")),
            "agenda_cancela": entero(f("Agenda Cancela")),
            "llamada_no_contestada": entero(f("Llamada NO Contestada")),
            "llamada_efectiva": entero(f("Llamada Efectiva (Venta Realizada)")),
            "llamada_seguimiento": entero(f("Llamada Seguimiento")),
            "llamada_agenda": entero(f("Llamada Agenda")),
            "llamada_no_interesado": entero(f("Llamada NO Interesado")),
            "llamada_contestada": entero(f("Llamada Contestada")),
            "llamada_postventa": entero(f("Llamada Postventa")),
            "atencion_venta": entero(f("Atención Venta Exitosa")),
            "atencion_seguimiento": entero(f("Atención Seguimiento")),
            "atencion_declinado": entero(f("Atención Declinado")),
            "atencion_asociado": entero(f("Atención Asociado")),
            "atencion_enrolamiento": entero(f("Atención Enrolamiento")),
            "atencion_certificados": entero(f("Atención Certificados")),
            "atencion_agenda": entero(f("Atención Agenda", "Atención Agendas")),
            "atencion_renovacion": entero(f("Atención Renovaciones")),
            "source": "excel", "source_file": ctx["archivo"], "source_row": nfila,
        })
    if repetidos:
        print(f"  · {repetidos} fila(s) de gestión repetían persona+día, se tomó la primera")
    return salida, personas


JORNADA_FOTO = ("chats_inicial", "chats_medio", "chats_final",
                "tareas_inicial", "tareas_medio", "tareas_final",
                "caducadas_inicial", "caducadas_medio", "caducadas_final")

JORNADA_HECHO = ("agenda_confirmada", "agenda_posible", "agenda_reprograma",
                 "agenda_no_contesta", "agenda_cancela",
                 "llamada_no_contestada", "llamada_efectiva", "llamada_seguimiento",
                 "llamada_agenda", "llamada_no_interesado", "llamada_contestada",
                 "llamada_postventa",
                 "atencion_venta", "atencion_seguimiento", "atencion_declinado",
                 "atencion_asociado", "atencion_enrolamiento", "atencion_certificados",
                 "atencion_agenda", "atencion_renovacion")


def fusionar_jornadas(lote):
    """
    Junta las jornadas que caen en la misma sede, el mismo día y en la misma
    persona.

    `leer_actividad` ya quita las repetidas dentro de un archivo, pero en Carss
    los tres archivos son equipos y acaban en la misma sede: hay gente que
    reportó el mismo día en dos. La tabla admite una fila por empresa, sede,
    fecha y persona, así que sin juntarlas la carga revienta.

    Llamadas, agendas y atenciones son cosas que se hicieron y se suman. Las
    colas del CRM —chats, tareas, caducadas— son una foto de ese momento y no
    un acumulado, así que se queda la mayor. Sobrevive la fila de mayor
    movimiento, para que `source_file` apunte al equipo donde la persona sí
    estuvo ese día. Mismo criterio que la migración 036, que juntó estas
    veintisiete filas en la base.
    """
    grupos = defaultdict(list)
    for archivo, datos in lote.items():
        for fila in datos["daily_activity"]:
            grupos[(fila["company_id"], fila["branch_id"],
                    fila["report_date"], fila["_staff"])].append((archivo, fila))

    juntadas = 0
    sobreviven = defaultdict(list)
    for filas in grupos.values():
        if len(filas) > 1:
            filas.sort(key=lambda af: -sum(af[1][c]
                                           for c in JORNADA_FOTO + JORNADA_HECHO))
            juntadas += len(filas) - 1
        archivo, queda = filas[0]
        for _, otra in filas[1:]:
            for c in JORNADA_FOTO:
                queda[c] = max(queda[c], otra[c])
            for c in JORNADA_HECHO:
                queda[c] += otra[c]
            horas = [h for h in (queda["hora_llegada"], otra["hora_llegada"]) if h]
            queda["hora_llegada"] = min(horas) if horas else None
            horas = [h for h in (queda["hora_salida"], otra["hora_salida"]) if h]
            queda["hora_salida"] = max(horas) if horas else None
        sobreviven[archivo].append(queda)

    for archivo, datos in lote.items():
        datos["daily_activity"] = sobreviven.get(archivo, [])
    if juntadas:
        print(f"  · {juntadas} jornada(s) repetidas entre equipos, juntadas en una")


def leer_caja(ruta, cat, ctx):
    cab, filas = leer_hoja(ruta, ["Control Ingreso - Gasto"])
    if not cab:
        return [], set()
    salida, personas = [], set()
    for nfila, valores in filas:
        f = Fila(cab, valores)
        d = fecha(f("Fecha"))
        monto = numero(f("Valor"))
        if not d or not monto:
            continue
        resp = texto(f("Responsable"))
        if resp and slug(resp) in NO_ES_PERSONA:
            resp = None
        if resp:
            personas.add(resp)
        tipo = (texto(f("Tipo")) or "").lower()
        salida.append({
            "company_id": ctx["company_id"], "branch_id": sede_id(ctx),
            "report_date": d.isoformat(), "period_month": mes(d).isoformat(),
            "kind": "entrada" if tipo.startswith("entrada") else "salida",
            "concept_code": cat.add("cash_concepts", f("Concepto")),
            "method_code": cat.add("payment_methods", f("Medio Pago")),
            "responsable_nombre": resp, "_staff": slug(resp) if resp else None,
            "identificacion": texto(f("Identificación"), 40),
            "nombre": texto(f("Nombre"), 200),
            "factura": texto(f("Factura"), 60),
            "amount": monto,
            "observacion": texto(f("Observación"), 600),
            "source": "excel", "source_file": ctx["archivo"], "source_row": nfila,
        })
    return salida, personas


def leer_agendas(ruta, ctx):
    cab, filas = leer_hoja(ruta, ["AGENDAS"])
    if not cab:
        return [], set()
    salida, personas = [], set()
    for nfila, valores in filas:
        f = Fila(cab, valores)
        d = fecha(f("Fecha"))
        if not d:
            continue
        resp = texto(f("Responsable"))
        if resp and slug(resp) in NO_ES_PERSONA:
            resp = None
        if resp:
            personas.add(resp)
        salida.append({
            "company_id": ctx["company_id"], "branch_id": sede_id(ctx),
            "nombre": texto(f("Nombre"), 200),
            "celular": texto(f("Número de celular"), 40),
            "scheduled_at": d.isoformat(),
            "scheduled_time": hora(f("Hora")),
            "responsable_nombre": resp, "_staff": slug(resp) if resp else None,
            "resultado": texto(f("Resultado"), 60),
            "observacion": texto(f("Observación"), 600),
            "source": "excel", "source_file": ctx["archivo"], "source_row": nfila,
        })
    return salida, personas


# ------------------------------------------------------------------
# Programa principal
# ------------------------------------------------------------------
def entorno(clave):
    """Lee una variable de .env.local sin depender de dotenv."""
    if os.environ.get(clave):
        return os.environ[clave]
    ruta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local")
    if os.path.exists(ruta):
        for linea in open(ruta, encoding="utf-8"):
            if linea.strip().startswith(clave + "="):
                return linea.split("=", 1)[1].strip()
    return None


def main():
    ap = argparse.ArgumentParser(description="Importa el histórico del Excel a Supabase.")
    ap.add_argument("--carpeta", required=True, help="Carpeta con los .xlsb")
    ap.add_argument("--solo", help="Importar solo los archivos que contengan este texto")
    ap.add_argument("--dry-run", action="store_true", help="Leer y contar sin escribir")
    args = ap.parse_args()

    url = entorno("NEXT_PUBLIC_SUPABASE_URL")
    key = entorno("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (.env.local)")

    # macOS guarda los nombres en NFD ("Unión" = U + n + ´), y las claves del
    # mapa están en NFC. Sin normalizar, ningún archivo con tilde coincide.
    rutas = sorted(f for f in os.listdir(args.carpeta) if f.endswith(".xlsb"))
    nombre_nfc = {f: unicodedata.normalize("NFC", f) for f in rutas}
    if args.solo:
        rutas = [f for f in rutas if args.solo.lower() in f.lower()]
    if not rutas:
        sys.exit("No hay archivos que importar")

    sb = Supabase(url, key, dry_run=args.dry_run)
    cat = Catalogos()
    archivos = [os.path.splitext(nombre_nfc[f])[0] for f in rutas]

    desconocidos = [a for a in archivos if a not in MAPA]
    if desconocidos:
        sys.exit("Estos archivos no están en el mapa de empresas: " + ", ".join(desconocidos))

    # Los tres de Carss comparten empresa y sede y sus jornadas se juntan entre
    # sí, así que van juntos o no van: cargar uno solo dejaría la jornada de una
    # persona partida en dos filas del mismo día, y eso la base no lo admite.
    carss = {a for a, e in MAPA.items() if e == "Carss"}
    faltan = carss - set(archivos)
    if carss & set(archivos) and faltan:
        sys.exit("Los archivos de Carss se importan juntos. Faltan: " + ", ".join(sorted(faltan)))

    print("→ Empresas y sedes")
    empresas, sedes = asegurar_estructura(sb, archivos)

    # Primera pasada: leer todo y juntar catálogos y personas antes de escribir.
    # Los catálogos tienen que existir antes que las ventas, porque las ventas
    # los referencian.
    print("\n→ Leyendo archivos")
    lote = {}
    personas = set()
    perdidos = []
    for archivo, nombre in zip(archivos, rutas):
        ruta = os.path.join(args.carpeta, nombre)
        empresa = MAPA[archivo]
        ctx = {"archivo": archivo,
               "empresa": empresa,
               "company_id": empresas[empresa],
               "sedes": {s: sedes[(empresa, s)] for s in sedes_de(empresa)}}
        print(f"  {archivo}")

        ventas, p1 = leer_ventas(ruta, cat, ctx)
        # La fecha y la sede de cada venta, por si algún pago viene sin las suyas.
        fecha_por_ref, sede_por_ref = {}, {}
        for v in ventas:
            fecha_por_ref.setdefault(v["ref_credito"],
                                     datetime.date.fromisoformat(v["report_date"]))
            sede_por_ref.setdefault(v["ref_credito"], v["branch_id"])
        pagos, pagos_sin_fecha = leer_pagos(ruta, cat, ctx, fecha_por_ref, sede_por_ref)
        if pagos_sin_fecha:
            perdidos.extend((archivo, x) for x in pagos_sin_fecha)
        actividad, p2 = leer_actividad(ruta, ctx)
        caja, p3 = leer_caja(ruta, cat, ctx)
        agendas, p4 = leer_agendas(ruta, ctx)
        personas |= p1 | p2 | p3 | p4

        lote[archivo] = {"ctx": ctx, "sales": ventas, "payments": pagos,
                         "daily_activity": actividad, "cash_movements": caja,
                         "appointments": agendas}
        print(f"    ventas={len(ventas)} pagos={len(pagos)} gestión={len(actividad)} "
              f"caja={len(caja)} agendas={len(agendas)}")

    fusionar_jornadas(lote)

    print("\n→ Catálogos")
    cat.escribir(sb)

    print("\n→ Personas")
    staff = asegurar_personas(sb, personas)

    # Cada persona queda ligada a las empresas y sedes donde aparece.
    vinculos = {}
    for datos in lote.values():
        ctx = datos["ctx"]
        for tabla in ("sales", "daily_activity", "cash_movements", "appointments"):
            for fila in datos[tabla]:
                sid = staff.get(fila.get("_staff"))
                if sid:
                    vinculos[(ctx["company_id"], sid)] = fila["branch_id"]
    sb.insert("company_staff",
              [{"company_id": c, "staff_id": s, "branch_id": b}
               for (c, s), b in vinculos.items()],
              upsert_on="company_id,staff_id")
    print(f"  vínculos persona-empresa: {len(vinculos)}")

    print("\n→ Cargando")
    totales = defaultdict(int)
    for archivo, datos in lote.items():
        print(f"  {archivo}")
        for tabla in ("appointments", "cash_movements", "daily_activity", "payments", "sales"):
            filas = datos[tabla]
            for f in filas:
                if "_staff" in f:
                    f["staff_id"] = staff.get(f.pop("_staff"))
            # Borrar antes de insertar es lo que hace repetible la importación.
            sb.delete(tabla, {"source_file": f"eq.{archivo}", "source": "eq.excel"})
            sb.insert(tabla, filas)
            totales[tabla] += len(filas)
            if filas:
                print(f"    {tabla:16s} {len(filas):6d}")

    # Enlazar cada pago con su venta. Se hace en la base y no acá porque son
    # 19.000 pagos contra 16.000 ventas: es un join, no un bucle.
    if not args.dry_run:
        print("\n→ Enlazando pagos con sus ventas")
        r = sb.s.post(f"{sb.url}/rpc/link_payments_to_sales", data="{}", timeout=300)
        if r.status_code >= 300:
            print(f"  aviso: no se pudieron enlazar ({r.status_code} {r.text[:200]})")
        else:
            print(f"  pagos enlazados: {r.json()}")

    if perdidos:
        print("\n→ Filas que NO se pudieron cargar")
        total = sum(x["valor"] for _, x in perdidos)
        print(f"  {len(perdidos)} pago(s) sin fecha y sin referencia de crédito, "
              f"por ${total:,.0f}:")
        for archivo, x in perdidos:
            print(f"    {archivo} · fila {x['fila']} · ${x['valor']:,.0f}")
        print("  Se arreglan poniéndoles fecha en el Excel y volviendo a correr esto.")

    print("\n=== TOTAL ===")
    for tabla, n in sorted(totales.items()):
        print(f"  {tabla:16s} {n:6d}")
    if args.dry_run:
        print("\n(dry-run: no se escribió nada)")


if __name__ == "__main__":
    main()
