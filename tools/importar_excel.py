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
como un usuario concreto obligaría a que ese usuario tuviera acceso a las 16
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
# A qué empresa y sede pertenece cada archivo.
#
# El nombre del archivo manda, no la columna "Empresa": está mal digitada en
# varios (el archivo "Trámites Tuluá" dice "LV Tuluá" en todas sus filas, y los
# tres de Cars dicen "CEA Carss").
# ------------------------------------------------------------------
MAPA = {
    "Ventas LV - Unión":          ("LV", "Sede La Unión", "La Unión"),
    "Ventas LV - Palmira":        ("LV", "Sede Palmira", "Palmira"),
    "Ventas LV - Yumbo":          ("LV", "Sede Yumbo", "Yumbo"),
    "Ventas LV - Buenaventura":   ("LV", "Sede Buenaventura", "Buenaventura"),
    "Ventas - Trámites Tuluá":    ("LV", "Sede Tuluá", "Tuluá"),
    "Ventas Internas - Tuluá":    ("LV", "Sede Tuluá", "Tuluá"),
    "Ventas - Trámites Candelaria": ("Trámites", "Sede Candelaria", "Candelaria"),
    "Ventas - Trámites Cartago":  ("Trámites", "Sede Cartago", "Cartago"),
    "Ventas - Trámites Florida":  ("Trámites", "Sede Florida", "Florida"),
    "Ventas - CEA Cevial":        ("CEA", "Sede Cevial", None),
    "Ventas - CEA Eduvial":       ("CEA", "Sede Eduvial", None),
    "Ventas Cars - Legendarios":  ("CEA", "Carss Legendarios", None),
    "Ventas Cars - Monarcas":     ("CEA", "Carss Monarcas", None),
    "Ventas Cars - Sultanes":     ("CEA", "Carss Sultanes", None),
    "Ventas - Ruta Segura":       ("Ruta Segura", "Sede principal", "Buga"),
    "Ventas TTC":                 ("TTC", "Sede principal", "Tuluá"),
}

COLORES = {
    "LV": "#1d4ed8",
    "Trámites": "#0f766e",
    "CEA": "#b45309",
    "Ruta Segura": "#be123c",
    "TTC": "#7c3aed",
}

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
    if sb.dry_run:
        # En seco no se consulta ni se escribe: solo hacen falta claves para que
        # el resto del proceso pueda armar las filas y contarlas.
        empresas = {MAPA[a][0]: f"dry-{slug(MAPA[a][0])}" for a in archivos if a in MAPA}
        sedes = {(MAPA[a][0], MAPA[a][1]): f"dry-{slug(MAPA[a][1])}"
                 for a in archivos if a in MAPA}
        return empresas, sedes

    empresas = {}
    for nombre in {MAPA[a][0] for a in archivos if a in MAPA}:
        existente = sb.select("companies", {"slug": f"eq.{slug(nombre).replace('_','-')}",
                                            "select": "id,name,slug"})
        if existente:
            empresas[nombre] = existente[0]["id"]
            continue
        creada = sb.insert("companies", [{
            "name": nombre,
            "slug": slug(nombre).replace("_", "-"),
            "accent_color": COLORES.get(nombre, "#1e293b"),
            "crm_label": nombre,
            "department": "Valle del Cauca",
        }], devolver=True)
        empresas[nombre] = creada[0]["id"] if creada else None
        print(f"  empresa creada: {nombre}")

    sedes = {}
    for archivo in archivos:
        if archivo not in MAPA:
            continue
        empresa, sede, ciudad = MAPA[archivo]
        cid = empresas.get(empresa)
        if not cid:
            continue
        clave = (empresa, sede)
        if clave in sedes:
            continue
        existente = sb.select("branches", {"company_id": f"eq.{cid}",
                                           "name": f"eq.{sede}", "select": "id"})
        if existente:
            sedes[clave] = existente[0]["id"]
            continue
        hay = sb.select("branches", {"company_id": f"eq.{cid}", "select": "id"})
        creada = sb.insert("branches", [{
            "company_id": cid,
            "name": sede,
            "city": ciudad,
            "department": "Valle del Cauca",
            "is_primary": len(hay) == 0,
        }], devolver=True)
        sedes[clave] = creada[0]["id"] if creada else None
        print(f"  sede creada: {empresa} · {sede}")

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

        salida.append({
            "company_id": ctx["company_id"], "branch_id": ctx["branch_id"],
            "ref_credito": ref[:200],
            "report_date": d.isoformat(), "period_month": mes(d).isoformat(),
            "responsable_nombre": resp,
            "_staff": slug(resp) if resp else None,
            "channel_code": cat.add("channels", f("Canal")),
            "ad_category_code": cat.add("ad_categories", f("Categoría Anuncio")),
            "financing_code": cat.add("financing_types", f("Línea Negocio")),
            "sale_type_code": cat.add("sale_types", f("Tipo Venta")),
            "product_code": cat.add("products", f("Producto")),
            "school_code": cat.add("schools", f("Escuela")),
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


def leer_pagos(ruta, cat, ctx, fecha_por_ref=None):
    """
    Lee la hoja de pagos.

    `fecha_por_ref` mapea la referencia del crédito a la fecha de su venta. Se
    usa para los pagos que vienen sin fecha: en vez de dejarlos fuera —lo que
    descuadraría el recaudo contra el Excel— entran con la fecha de su venta y
    marcados como estimados.
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
            "company_id": ctx["company_id"], "branch_id": ctx["branch_id"],
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
            "company_id": ctx["company_id"], "branch_id": ctx["branch_id"],
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
            "company_id": ctx["company_id"], "branch_id": ctx["branch_id"],
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
            "company_id": ctx["company_id"], "branch_id": ctx["branch_id"],
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
        empresa, sede, _ = MAPA[archivo]
        ctx = {"archivo": archivo,
               "company_id": empresas[empresa],
               "branch_id": sedes[(empresa, sede)]}
        print(f"  {archivo}")

        ventas, p1 = leer_ventas(ruta, cat, ctx)
        # La fecha de cada venta, por si algún pago viene sin la suya.
        fecha_por_ref = {}
        for v in ventas:
            fecha_por_ref.setdefault(v["ref_credito"],
                                     datetime.date.fromisoformat(v["report_date"]))
        pagos, pagos_sin_fecha = leer_pagos(ruta, cat, ctx, fecha_por_ref)
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
                    vinculos[(ctx["company_id"], sid)] = ctx["branch_id"]
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
