# Pitch y video · Bosque en pie

Dos textos con el mismo hilo: el **video de la entrega** (2:50, con la acción en vivo en Fuji) y el **pitch en vivo** (2 minutos, con el deck). Entre corchetes, qué se muestra en pantalla.

Contrato vigente: [`0x7eC244B5Baf9079AE21E721B1c507D493649b8c6`](https://testnet.snowtrace.io/address/0x7eC244B5Baf9079AE21E721B1c507D493649b8c6) en Avalanche Fuji.

---

## Video de la entrega (2:50)

Se graba en dos pasos: primero la pantalla, muda, con Screen Studio (el «corte»); después la voz y la cámara encima, con el apuntador del estudio de grabación. Cada tramo tiene su ventana: si el corte sale con otros tiempos, se corren las marcas del estudio, no el texto.

| Tramo | Ventana | Pantalla | Voz |
|---|---|---|---|
| 01 · El problema | 0:00–0:20 | Diapo «problema»: la imagen satelital de jul 2025, monte contra lotes desmontados. | En Salta se desmontaron más de veinte mil hectáreas de monte nativo entre enero y septiembre. La Ley de Bosques debería pagarle a quien conserva: en 2025 pagó cuatro centavos de dólar por hectárea, ciento cincuenta y cinco veces menos de lo que manda. Hoy conservar no paga. Desmontar, sí. |
| 02 · La idea | 0:20–0:42 | Diapo «solución», después la portada de la web. | Bosque en pie da vuelta esa cuenta: paga por cada mes que el monte sigue en pie. Cada mes, una imagen Sentinel-2 mira la parcela. Si el monte sigue, dos de tres verificadores firman y el contrato en Avalanche paga la cuota: sesenta por ciento al dueño, cuarenta al operador que vigila. |
| 03 · Una parcela que se desmontó | 0:42–1:10 | Web: parcela B, el año 2025 mes por mes; agosto y septiembre. | Esta es una parcela real del Chaco salteño, mes por mes en 2025. De enero a julio el monte está entero: cobró siete cuotas. En agosto la imagen muestra el desmonte: queda el cuarenta y ocho coma siete por ciento y la parcela pasa a revisión, sin pago. En septiembre queda el uno coma cuatro: el contrato corta solo, y el saldo se reparte entre devolverle al donante y restaurar. |
| 04 · Una parcela en pie | 1:10–1:20 | Web: parcela A, 12 de 12. | Esta otra siguió en pie los doce meses y cobró las doce cuotas. Y hoy le toca noviembre. |
| 05 · En vivo | 1:20–1:55 | Terminal: `relay reports/A/2026-11 --red fuji`. Snowtrace: la transacción y las transferencias. Web: noviembre pagado. | Mandamos el informe de noviembre, ahora. La imagen es del dos de noviembre y el monte sigue entero. Dos verificadores ya lo firmaron. La transacción entra en la red de prueba de Avalanche: el contrato le pagó al dueño y al operador, y la web lo muestra pagado. Nadie apretó un botón de pagar: lo decidió el contrato. |
| 06 · Por qué blockchain | 1:55–2:15 | Diapo «por qué blockchain». | ¿Por qué blockchain? El donante no conoce a quien cuida, y quien cuida no sabe si el donante va a seguir pagando. El contrato guarda la plata y aplica las reglas solo: nadie las cambia a mitad de camino, y cualquiera puede rehacer la cuenta con la imagen pública. |
| 07 · Los números | 2:15–2:39 | Diapo «negocio». | ¿Y los números? Desmontar le deja al dueño entre noventa y seis y doscientos sesenta y cuatro dólares por hectárea al año. Con ocho a veintidós dólares por hectárea al mes, cuidar le gana. Un crédito de carbono paga por un desmonte supuesto; esto paga un resultado que se ve en la imagen. Pagan exportadores a Europa, empresas y la provincia. |
| 08 · Cierre | 2:39–2:50 | Diapo «cierre» con la web, el contrato y el repo. | El monte que queda no se salva con promesas. Se salva si cuidarlo paga más que desmontarlo. Bosque en pie: el satélite es el testigo y el contrato paga. |

**El envío en vivo se hace una sola vez.** El informe de noviembre de A no se mandó nunca y el contrato lo acepta una sola vez (paga 0,006 AVAX al dueño y 0,004 al operador). Grabar todas las demás tomas antes; en esta, Screen Studio ya grabando antes de apretar Enter. Si la toma sale mal, no se vuelve a mandar: se graba la transacción ya hecha en Snowtrace.

```sh
.venv/bin/python -m oracle.relay reports/A/2026-11 --red fuji
```

Imprime una sola línea: lo que pagó, cómo quedó la parcela y el link a Snowtrace. No muestra nada de `.env`.

**Qué es real.** Las imágenes Sentinel-2, el cálculo y el contrato en Avalanche Fuji. Las billeteras y los montos son de prueba: la voz dice «red de prueba» en el tramo 05.

---

## Pitch en vivo (2 minutos)

Unas 310 palabras, a ritmo tranquilo (~150 por minuto), con el deck para proyectar.

**[0:00 · Problema — imagen satelital del Chaco salteño, monte contra lotes desmontados]**

Entre enero y septiembre de este año, en Salta se desmontaron más de veinte mil hectáreas de monte nativo. La Ley de Bosques debería pagarle a quien conserva: en 2025 pagó cuatro centavos de dólar por hectárea, ciento cincuenta y cinco veces menos de lo que manda. Hoy, conservar el monte no paga. Desmontarlo, sí.

**[0:20 · La idea — diapo «solución»]**

Bosque en pie da vuelta esa cuenta: pagamos por cada mes que el monte sigue en pie. Y el testigo es el satélite.

**[0:30 · Cómo funciona]**

Un donante deja AVAX en un contrato en Avalanche, para una parcela. Cada mes, una imagen Sentinel-2 compara esa parcela con el mismo mes del año anterior. Si el monte sigue, los verificadores firman el informe —alcanza con dos de tres— y el contrato paga la cuota: sesenta por ciento al dueño por no desmontar y cuarenta al operador que hace cortafuegos y vigila.

Si aparece un desmonte, la primera lectura mala pone la parcela en revisión. La segunda corta los pagos para siempre, y el saldo vuelve al donante o queda para restaurar.

**[1:00 · Demo — diapo «demo» o la web]**

Repetimos el 2025 de dos parcelas reales: una cobró los doce meses; en la otra, en agosto aparece el desmonte, queda el 48,7 % y pasa a revisión; en septiembre queda el 1,4 % y el contrato corta solo.

**[1:15 · Por qué blockchain]**

El donante no conoce a quien cuida ni puede ir a ver el monte. Quien cuida no sabe si el donante va a seguir pagando. El contrato guarda la plata y aplica las reglas solo, y la imagen es pública: cualquiera puede rehacer la cuenta.

**[1:30 · Los números — diapo «negocio»]**

Desmontar deja entre 96 y 264 dólares por hectárea al año. Con 8 a 22 dólares por hectárea al mes, cuidar le gana. No competimos con un bono verde, que es una inversión: pagamos un resultado que se ve en la imagen. Pagan exportadores a Europa, empresas con metas de naturaleza y la provincia; nosotros cobramos el 10 %.

**[1:50 · Cierre]**

El monte que queda no se salva con promesas. Se salva si cuidarlo paga más que desmontarlo. Bosque en pie: el satélite es el testigo y el contrato paga.

---

## Para tener a mano (preguntas del jurado)

- **¿Y si el dato miente?** La imagen es pública y el algoritmo está en el repo. Firman dos de tres y hacen falta dos lecturas malas seguidas para cortar. En la demo los verificadores somos del equipo y no hay ventana para impugnar; en producción, verificadores independientes y 72 horas para impugnar.
- **¿Para empresas?** Cada cuota pagada genera un certificado de monte en pie por las hectáreas-mes financiadas. No es un bono ni un crédito de carbono.
- **¿Cuánto cuesta el certificado?** Entre USD 14 y 41 por hectárea-mes: lo que necesita el dueño (7,6 a 22), más el 40 % del operador y nuestra comisión. Empezamos por campo ganadero y zona amarilla, donde el número cierra.
- **¿Debilidades?** En tierra agrícola el precio sube; el desmonte se puede mudar al lote de al lado; Sentinel-2 no ve el raleo debajo de los árboles.
- **¿Qué es real en la demo?** Las imágenes Sentinel-2, el cálculo y el contrato en Avalanche Fuji. Las billeteras y los montos son de prueba.

Fuentes de los números: MAGyP 2025, Vallejos et al. 2021, FARN 2026, MSCI 2025, West et al. (Science, 2023). Dólar tomado: 1.250 pesos.

Atribución en la slide: "Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026".
