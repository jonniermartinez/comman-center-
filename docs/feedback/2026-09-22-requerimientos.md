# Feedback del 22 de septiembre de 2026 — ROAS y costo por venta

Fuente: mensaje de WhatsApp de la coordinación, reenviado por el gerente.

## Lo que pidieron

Medir cuánto rinde la pauta publicitaria de cada empresa:

| Indicador | Fórmula | Ejemplo (CARSS) |
|---|---|---|
| ROAS | facturación ÷ inversión en pauta | 120.000.000 ÷ 1.000.000 = 120 |
| Costo por venta | inversión en pauta ÷ número de ventas | 1.000.000 ÷ 100 = 10.000 |

La facturación y las ventas ya las tiene el sistema. Lo único que falta es un
apartado donde digitar la inversión en pauta, que se actualiza cada dos días
más o menos. Quieren ver, dentro del reporte de cada empresa:
facturación · ventas · inversión en pauta · ROAS · costo por venta.

## Cómo quedó

- Tabla `company_ad_spend` (migración 053): una fila por empresa y mes, con el
  acumulado del mes en pesos. La escribe quien administra la empresa.
- En Indicadores, sección "Rentabilidad de la pauta" con las cinco cifras y el
  campo para anotar la inversión de cada mes del rango. En un rango de varios
  meses se suma la inversión de los meses que toca.
- En el Dashboard, la misma placa para el mes, sin campo: enlaza a Indicadores.
- Sin inversión anotada, ROAS y costo por venta salen en "—", no en cero.
