# Feedback del 15 de septiembre de 2026 — el tablero de indicadores

Fuentes: un mensaje de WhatsApp con las reglas del semáforo, un video de pantalla
(transcrito con Whisper, ver `2026-09-15-transcripciones/`) y una foto del tablero
en el portátil.

## Semáforo por indicador

| Indicador | Meta | Cómo se lee |
|---|---|---|
| Contactabilidad | 70 % | más es mejor, sin techo |
| Volumen de agendas | 25 % | más es mejor, sin techo |
| Llamadas contestadas al día | 45 | más es mejor, sin techo |
| Conversión de agenda | 60 % | bien superarla; sobre 100 % es un error de captura (rojo) |
| **Confirmación de agenda** (nuevo) | **40 %** | agendas confirmadas ÷ agendas totales; mismo criterio |
| Agendas efectivas al día | 6 | bien superarla; atender más agendas de las que hubo es rojo |
| Venta presencial | 70 % | 70 % es el 100 %; entre 70 y 85 % ámbar; sobre 85 % rojo |
| Seguimiento | 55 % | misma banda que venta presencial |

Todo esto quedó en el commit `e078ec2` (semáforo por regla) y `fee05f5`.

## Lo que pidió el video

1. **Más color.** Que la tarjeta entera diga de lejos si cumple (verde), está a
   mitad (ámbar) o no cumple (rojo), como lo hacen siempre en Excel.
2. **La tabla de totales, por bloques de color.** Llamadas de un color, agendas
   de otro, como en el formulario de la jornada, para que no sea "todo lo mismo".
3. **La cola del CRM** traía "inicial, medio, final" tres veces seguidas sin
   decir cuál era chats, cuál tareas y cuál caducadas. Falta el título arriba
   y que diga "inicial · medio día · final".
4. **Las metas deben ser editables por empresa.** Las que hay son las actuales,
   pero cada empresa puede tener las suyas.
5. Un dato "así de grandecito" al lado de los días hábiles con cuántas jornadas
   registró el comercial (foto). Ya estaba en `e078ec2`.
6. "El KPI 14 no lo vi": la distribución por canal tiene que verse más.
