# Guion de locución · video demo (1:49)

Cada bloque tiene el tramo del video en el que suena. Léelo a ritmo normal,
sin correr: el texto está medido para caber con aire en cada tramo. Los
tiempos salen de `salida/linea-de-tiempo.json`; si vuelves a montar, se mueven
unos segundos y basta con mirar ese archivo.

Graba la voz en un solo archivo de corrido (pausas incluidas) o por bloques;
`mezclar.sh` acepta las dos cosas.

| Tramo | Escena | Texto |
|---|---|---|
| 0:00 – 0:03 | Portada | Este es Command Center, la plataforma comercial de TrámitesBuga. |
| 0:03 – 0:07 | Entrar | Se entra con usuario y contraseña. Las cuentas las crea el administrador: no hay registro público. |
| 0:07 – 0:15 | Empresas | Arriba, el mes que se está mirando. Basta retroceder a agosto para ver el avance real de las cinco empresas: ventas, facturación y recaudo, en una sola pantalla. |
| 0:15 – 0:36 | Dashboard | Dentro de una empresa, el dashboard. Todo sale de las ventas y los pagos registrados: nada se digita aparte. La evolución del mes, el embudo de la gestión, cómo se financió lo vendido y por dónde entró la plata. Más abajo, el total por sede y el ranking de comerciales: llamadas, contactabilidad y conversión, calculadas sobre los totales del mes. |
| 0:36 – 0:44 | Objetivos | Los objetivos se fijan por mes y por responsable. El cumplimiento se mide contra lo acumulado y se proyecta a fin de mes según los días hábiles. |
| 0:44 – 0:51 | Nueva empresa | Crear una empresa toma un minuto: datos, sedes, módulos y financiaciones, en cuatro pasos. |
| 0:51 – 0:55 | Sedes | Cada empresa opera en una o varias sedes. |
| 0:55 – 0:60 | Equipo | Y cada comercial pertenece a una sede: ahí quedan sus registros. |
| 0:60 – 1:07 | Ventas | La captura reemplaza el Excel. Una venta: cliente, responsable, financiación y valor. |
| 1:07 – 1:14 | Pagos | El recaudo va aparte: se busca la venta y se le abona. Así el saldo de cada crédito siempre cuadra. |
| 1:14 – 1:21 | Gestión diaria | La jornada del comercial: llamadas, agendas y atenciones. De aquí sale la contactabilidad. |
| 1:21 – 1:25 | Agendas | Las citas, con hora y responsable. |
| 1:25 – 1:31 | Caja | Y los ingresos y gastos del punto, que solo administra el coordinador. |
| 1:31 – 1:39 | Dashboard | Lo que se acaba de registrar ya cuenta en el dashboard. El reporte mensual no se arma: es la suma de los diarios. |
| 1:39 – 1:45 | Auditoría | Y todo deja rastro: quién hizo qué y cuándo. |
| 1:45 – 1:49 | Cierre | Command Center. Todo sale de lo registrado, nada se digita aparte. |

## Con Whisper

Si quieres subtítulos, transcribe tu propia voz ya grabada:

```bash
whisper voz.wav --language es --model small --output_format srt --output_dir .
```

Eso deja `voz.srt`, que `mezclar.sh` incrusta en el MP4 como pista de
subtítulos (se activan o apagan desde el reproductor).
