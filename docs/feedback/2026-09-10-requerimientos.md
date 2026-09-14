# Feedback del 10 y 11 de septiembre de 2026 — qué pidieron y cómo se cruza con lo que hay

Fuentes: el chat de WhatsApp (Closer Manager, Sales Trainer, Gerencia General),
ocho videos de pantalla (transcritos con Whisper, ver `2026-09-10-transcripciones/`),
tres imágenes (logo Trámites Candelaria, logo "Genelypse Command Center", foto del
formulario Registrar jornada) y el listado de 14 KPIs.

Empresa de referencia en los videos: **LV Unión** (Excel `Ventas LV - Unión.xlsb`,
hojas `Base`, `Pagos`, `Reporte`, `Reporte Gestión`, `Gestión`, `Control Ingreso`).

---

## 1. Reporte de gestión (formulario "Registrar jornada")

Hoy el formulario tiene cuatro pestañas planas: Llamadas, Agendas, Atención, Cola del CRM.
Lo que piden es que **se vea como el Excel**: bloques con título de color, subtotales
calculados y no editables, y que el asesor solo digite las tipificaciones.

### 1.1 Llamadas

| Campo | Hoy | Pedido |
|---|---|---|
| No contestada | editable | editable |
| Efectiva (venta digital) | editable | editable |
| Seguimiento | editable | editable |
| Agenda | editable | editable |
| No interesado | editable | editable |
| Postventa | editable | editable |
| **Contestadas** | editable (`llamada_contestada`) | **calculado, no editable** = Efectiva + Agenda + Seguimiento + No interesado + Postventa |
| **Total de llamadas** | no existe en el formulario | **nuevo, calculado** = Contestadas + No contestadas |

Razón: cuando "contestadas" es editable, el equipo la llena mal y no cuadra con la
tipificación. Con la suma automática detectaron muchos errores.

Impacto en base: `daily_activity.llamada_contestada` deja de ser un dato capturado.
Las vistas de la migración 014 hoy suman `llamada_contestada` como una tipificación
más dentro de `total_llamadas` y `llamadas_contestadas`, lo que duplica. Hay que
quitarla de esas sumas (o dejar de escribirla) y calcular contestadas desde las cinco
tipificaciones.

### 1.2 Agendas

Añadir un **Total de agendas** calculado = Confirmada + Posible asistencia +
Reprograma + No contesta + Cancela. Es a nivel general e **incluye las no
contestadas**. La vista `v_daily_activity.total_agendas` ya lo calcula así; solo
falta mostrarlo en el formulario.

### 1.3 Atención — se divide en tres bloques

Video 12:42. "La atención tiene tres fases":

1. **Atención venta presencial** (el cliente fue al punto físico):
   - Venta exitosa, Seguimiento, Declinado.
   - **Atención venta externa** — NUEVO (video del 11/09): "en la atención presencial
     haya una casilla atención venta externa".
   - **Total atención presencial** calculado. Hoy la vista suma venta + seguimiento +
     declinado. Falta confirmar si "venta externa" entra en ese total (ver dudas).
2. **Atención agenda** (agenda atendida): editable, es un dato suelto. **No se suma**
   al total de atención porque el mismo cliente que vino por agenda ya está contado
   como venta, seguimiento o declinado. Sirve para verificar: "confirmaron 3 en la
   mañana, ¿vinieron 3?".
3. **Atención administrativa / posventa**: Asociado, Enrolamiento, Certificados,
   Renovaciones. No son ventas; no todos los comerciales ni todas las empresas los
   hacen. Con su **propio total** calculado.

### 1.4 Cola del CRM

Ya está (inicial / medio día / final, con chats, tareas del día y caducadas). Piden
que se vea como el Excel: se cambia inicial, medio, final y la tabla se actualiza.
No hay cambio funcional, solo presentación.

---

## 2. Ventas — formulario "Agregar venta"

Regla que dieron: **todo lo que está en la hoja Base tiene que poder llenarse en el
Command Center**. Columnas observadas en `Base` (video 13:04, en orden):

Fecha · Comercial · Canal · Categoría · Tipo doc · ID · Nombre · Celular · Estado
(En proceso / Sin iniciar / Cerrado) · Tipo doc titular · ID titular · Nombre
titular · Celular titular · Pagaré · Voucher · Contrato · Fecha legalización ·
Escuela · Examen médico · Evento · Pago evento · Tipo venta (Presencial / Digital) ·
Producto (A2, C1, B1, A2+B1, A2+C1, Ren A2+C1…) · Devolución · Fecha devolución ·
Cuenta devolución · Valor inicial · Adición · Descuento · Valor final · Recaudo ·
Saldo · Valor lámina.

Casi todas esas columnas **ya existen en `sales`** desde la migración 011; lo que
falta es capturarlas en `nueva-venta.tsx`.

| # | Campo pedido | Columna en `sales` | Estado en el formulario |
|---|---|---|---|
| 1 | Canal | `channel_code` | falta (hoy solo hay "Tráfico" = `traffic_code`) |
| 2 | Categoría (del anuncio) | `ad_category_code` | falta |
| 3 | Tipo de documento del cliente | `licencia_tipo_id` | falta (solo hay "Documento") |
| 4–5 | Titular del crédito/pago separado del cliente: nombre, tipo doc, documento, celular | `credito_*` | existe con switch "es el mismo"; **falta tipo de documento** |
| 6 | Pagaré | `pagare` | falta |
| 7 | Voucher | `voucher` | falta |
| 8 | Contrato | `contrato` | falta |
| 9 | Examen médico | `consecutivo_examen`, `medical_center_code` | falta |
| 10 | Evento | `evento` | falta — ver nota de optimización |
| 11 | Pago de evento | `pago_evento` | falta — ver nota |
| 12 | Tipo de venta (Presencial / Digital) | `sale_type_code` | falta. **Clave para el KPI 1** |
| 13 | Devolución | `fecha_devolucion`, `cuenta_devolucion`, `devolucion_lamina` | falta — ver nota |
| 14 | Valor inicial | `valor_inicial` | existe (precio de lista) |
| 15 | Adición | `adicion` + `sale_additions` | existe |
| 16 | Descuento | `descuento` + `sale_bonuses` | existe (bonos) |
| 17 | Valor final | `valor_final` | existe |
| 18 | Recaudo | `recaudo` | se calcula desde pagos (029) |
| 19 | Saldo | `saldo` | se calcula |
| 20 | Valor lámina | `valor_lamina` | falta — ver nota |
| — | Adjuntar imágenes (comprobantes) | no existe para ventas | **nuevo** |

**Nota de optimización** (Sales Trainer, 13:14–13:16): en el Excel real hay
columnas que siempre están en cero y no vale la pena arrastrarlas: **devolución y
todos sus campos, evento y pago de evento**. El **valor de la lámina "y demás"
siempre se pone en adiciones**, así que no necesita campo propio: basta una adición
con concepto "Lámina". El Closer Manager lo aceptó ("entonces ya sabes").

**Adjuntar imágenes** (video 13:05): en el comprobante de la venta, poder subir
**una o varias fotos** del pago. Hoy el asesor tiene que ir al CRM a buscar el chat.
Ya existe el bucket privado `comprobantes-pago` (migración 032) para los pagos;
se extiende a la venta (varias imágenes por venta).

---

## 3. Dashboard — 14 KPIs + tablero de cantidad de ventas

### KPI 1 — Validación presencial / digital (cruce Base vs Gestión)

Dos fuentes que deberían coincidir, mostradas lado a lado con su origen rotulado
("Ventas" y "Gestión diaria"):

| | Según Ventas (base) | Según Gestión diaria |
|---|---|---|
| Presencial | ventas con `sale_type_code` = presencial | suma de `atencion_venta` (Atención venta exitosa) |
| Digital | ventas con `sale_type_code` = digital | suma de `llamada_efectiva` |

Objetivo: detectar cuando el comercial tipifica bien en la base pero mal en
gestión (o al revés).

### KPI 2 — Resultados por comercial y consolidado, con filtros

Piden "hacer lo mismo que en Excel": una **tabla de totales** de todos los campos de
la jornada (agendas por estado, llamadas por tipo, atenciones, cola del CRM en
inicio / medio día / final), que sume según lo filtrado.

Filtros:
- **Empresa**.
- **Comercial**: uno, varios o todos los de la empresa (multiselección).
- **Fecha**: un día, un rango, o el mes completo, "como los filtros de fecha de Excel".

Hoy el dashboard solo filtra por mes (`FiltroMes`) y no por comercial.

### KPI 3 — Promedios

Promedio de: total de agendas, llamadas contestadas, atención venta presencial.
Respetando los mismos filtros. (Promedio por día reportado.)

### KPI 4 — Días laborados y absentismo

- Días laborados = días con jornada registrada en el mes.
- **Días hábiles del mes: campo configurable por empresa y mes** (julio tuvo 21).
  Hoy `businessDaysInMonth` los calcula fijo lunes a sábado; pasa a ser un dato.
- Cumplimiento = laborados ÷ hábiles × 100. **Meta ≥ 80 %**.

### KPI 5 — Facturación total

Fórmula que dieron: `Valor final − (Adición + Descuento)`. Ver dudas: restar la
adición es raro (hoy valor final = inicial + adición − descuento).

### KPIs 6–13 — Ratios con meta y efectividad

Todos con tres números: **Meta · Logrado · Efectividad** (= Logrado ÷ Meta × 100).
Hoy `v_monthly_activity` ya calcula contactabilidad, conversión de agendas y venta
presencial, pero sin meta ni efectividad, y faltan los demás.

| KPI | Fórmula | Meta | Existe hoy |
|---|---|---|---|
| 6 Contactabilidad | contestadas ÷ total llamadas | 70 % | `ratio_contactabilidad` (con el bug de `llamada_contestada`) |
| 7 Conversión de agenda | total agendas ÷ contestadas | 60 % | no (hoy `ratio_conversion_agendas` es atención agenda ÷ agendas, otra cosa) |
| 8 Venta presencial | ventas presenciales ÷ total atención presencial | 70 % | `ratio_venta_presencial` |
| 9 Volumen de agendas | total agendas ÷ total llamadas | 25 % | no |
| 10 Seguimiento | llamadas de seguimiento ÷ total llamadas | 55 % | no |
| 11 Agenda → venta | ventas ÷ total agendas | 30 % | no |
| 12 Contestadas al día | contestadas ÷ 45 por asesor (mensual ÷ 900) | 45/día | no |
| 13 Agendas efectivas al día | atención agenda ÷ 6 por asesor (mensual ÷ 126) | 6/día | no |

### KPI 14 — Distribución de ventas por canal

Presencial ÷ total y Digital ÷ total, sobre `sale_type_code`.

### Tablero adicional — Cantidad de ventas

Número de ventas (no dinero) por comercial, empresa, período, presencial, digital y
total. Hoy el dashboard muestra "Ventas del mes" solo como total.

---

## 4. Marca y nombres

- **Logos**: enviaron el de **Trámites Candelaria** (`Logo_Candelaria.png`) y el de
  **Genelypse Command Center** (`LOGO_COMMAND_CENTER.jpg`). Gerencia dice que lo de
  los logos "ya está pero incompleto": faltan empresas por cargar. Se suben con el
  `logo-uploader` de cada empresa; el de Command Center va en el sidebar / login.
  Ojo: el logo dice "Genelypse Command Center" y `APP_NAME` hoy es "Command Center".
- **Renombrar**: la empresa **Trámites Buenaventura** (slug `tramites-buenaventura`,
  migración 036) se llama **Punto tránsito**. Es un cambio de dato en `companies`,
  no de código.

---

## 5. Dudas para confirmar con el cliente antes de construir

1. **Atención venta externa**: ¿suma al "total atención presencial" o va aparte como
   atención agenda? ¿Y una venta externa cuenta como venta presencial o digital en el
   KPI 1?
2. **Facturación total** = valor final − (adición + descuento): ¿de verdad se resta la
   adición? Con la lámina yendo como adición, esa fórmula excluiría la lámina de la
   facturación. Puede ser intencional (facturación del curso sin extras) o un error.
3. **Metas mensuales fijas** 900 y 126: 900 = 45 × 20 días y 126 = 6 × 21 días. Propongo
   calcularlas como meta diaria × días hábiles configurados del mes (KPI 4), para que
   no se contradigan.
4. **Estado de la venta** (En proceso / Sin iniciar / Cerrado): ya existe `state_code`
   en el formulario. Confirmar que el catálogo actual coincide con el de la base.
5. **Filtro de fecha en rango**: todas las vistas de 014 agregan por mes
   (`period_month`). Un rango arbitrario obliga a agregar desde `daily_activity`
   por día. Es trabajo de base, no solo de interfaz.
6. Con "contestadas" calculada, las jornadas ya registradas con `llamada_contestada`
   digitada quedan con un valor que ya no se usa. ¿Se recalcula el histórico?

---

## 6. Resumen de trabajo, en el orden que conviene

1. Formulario de jornada: contestadas y totales calculados, tres bloques de atención,
   campo venta externa, estilo por bloques. Migración: columna `atencion_venta_externa`,
   corregir vistas 014 para no sumar `llamada_contestada`.
2. Formulario de venta: canal, categoría, tipo de documento (cliente y titular),
   pagaré, voucher, contrato, examen médico, tipo de venta presencial/digital, fotos
   de comprobante. Sin devolución ni evento; lámina como adición.
3. Días hábiles configurables por empresa y mes.
4. Dashboard: filtros por comercial(es) y fecha (día / rango / mes), tabla de
   totales, KPI 1 cruzado, KPIs 6–13 con meta y efectividad, promedios, absentismo,
   distribución por canal y cantidad de ventas.
5. Logos pendientes y renombrar Trámites Buenaventura a Punto tránsito.
