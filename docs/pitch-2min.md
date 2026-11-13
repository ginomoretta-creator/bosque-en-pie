# Pitch y video · Bosque en pie

Dos textos con el mismo hilo: el **video de la entrega** (2:50, con la acción en vivo en Fuji) y el **pitch en vivo** (2 minutos, con el deck). Entre corchetes, qué se muestra en pantalla.

Contrato vigente: [`0x7eC244B5Baf9079AE21E721B1c507D493649b8c6`](https://testnet.snowtrace.io/address/0x7eC244B5Baf9079AE21E721B1c507D493649b8c6) en Avalanche Fuji.

---

## Video de la entrega (2:50)

Se graba en dos pasos: primero la pantalla, muda, con Screen Studio (el «corte»); después la voz y la cámara encima, con el apuntador del estudio de grabación. Cada tramo tiene su ventana: si el corte sale con otros tiempos, se corren las marcas del estudio, no el texto.

**Para que no suene leído.** El texto está escrito para decirse, no para leerse:
- Leelo en voz alta dos veces antes de grabar. Después usá el apuntador como ayuda-memoria, no palabra por palabra.
- Si una palabra te sale más tuya de otra forma, cambiala. Los números y los nombres, no.
- Hablale a una persona: imaginate a alguien del jurado del otro lado de la cámara.
- Hacé una pausa en cada «:» y en cada pregunta. Marcá una sola palabra por frase.
- En pantalla van los números exactos (48,7 %, 1,4 %); la voz los redondea («menos de la mitad») para que se entienda de oído.

| Tramo | Ventana | Pantalla | Voz |
|---|---|---|---|
| 01 · El problema | 0:00–0:21 | Portada (vos en grande, 3 s) y la diapo «problema»: la imagen satelital de jul 2025. | En Salta, entre enero y septiembre, se desmontaron más de 20 mil hectáreas de monte. ¿Por qué? Porque hoy desmontar paga. Y cuidar, no. La Ley de Bosques tendría que compensarlo, pero el año pasado pagó 4 centavos de dólar por hectárea: 155 veces menos de lo que dice la ley. |
| 02 · La idea | 0:21–0:43 | Diapo «solución», después la portada de la web. | Nosotros damos vuelta esa cuenta: le pagamos al dueño por cada mes que el monte sigue en pie. ¿Quién controla? El satélite: todos los meses, una imagen de Sentinel-2. Si el monte está, firman dos de tres verificadores y el contrato en Avalanche paga solo: 60 % al dueño, 40 % a quien lo cuida. |
| 03 · Una parcela que se desmontó | 0:43–1:12 | Web: parcela B, el 2025 mes por mes; agosto (48,7 %) y septiembre (1,4 %). | Les muestro un caso real del Chaco salteño, mes a mes durante 2025. Hasta julio, todo bien: el monte está entero y la parcela cobró 7 cuotas. En agosto el satélite ve el desmonte: queda menos de la mitad. El contrato no corta de una: primero la pone en revisión y no paga. En septiembre se confirma, y ahí sí corta. Lo que quedaba vuelve al donante o va a restaurar. |
| 04 · Una parcela en pie | 1:12–1:21 | Web: parcela A, 12 de 12. | Esta otra, en cambio, siguió en pie todo el año: cobró las 12 cuotas. Y ahora le toca noviembre. |
| 05 · En vivo | 1:21–1:55 | Terminal: relay reports/A/2026-11 --red fuji. Snowtrace: la transacción. Web: noviembre pagado. | Vamos a mandar el informe de noviembre, en vivo. La imagen es del 2 de noviembre, el monte sigue entero, y ya viene firmado por dos verificadores. Lo mandamos… y ya está en la red de prueba de Avalanche. En el explorador se ve la transacción: el contrato le pagó al dueño y al operador. Y la web ya muestra noviembre pagado. Nadie apretó un botón de pagar: lo decidió el contrato, con lo que vio el satélite. |
| 06 · Por qué blockchain | 1:55–2:15 | Diapo «por qué blockchain». | ¿Por qué blockchain? Porque acá nadie tiene por qué confiar en nadie. El que pone la plata no conoce al que cuida, y el que cuida no sabe si le van a seguir pagando. El contrato guarda la plata y cumple las reglas solo, y cualquiera puede revisar la cuenta con la imagen pública. |
| 07 · Los números | 2:15–2:39 | Diapo «negocio». | ¿Cierran los números? Desmontar le deja al dueño entre 96 y 264 dólares por hectárea al año. Si le pagamos entre 8 y 22 dólares por hectárea al mes, cuidar le gana a desmontar. Y no vendemos promesas de carbono: pagamos un resultado que se ve en la imagen. Pagan los que exportan a Europa, las empresas y la provincia. |
| 08 · Cierre | 2:39–2:50 | Diapo «cierre» con la web, el contrato y el repo (vos en grande). | El monte que queda no se salva con promesas. Se salva si cuidarlo paga más que desmontarlo. Bosque en pie: el satélite es el testigo, y el contrato paga. |

**El envío en vivo se hace una sola vez.** El informe de noviembre de A no se mandó nunca y el contrato lo acepta una sola vez (paga 0,006 AVAX al dueño y 0,004 al operador). Grabar todas las demás tomas antes; en esta, Screen Studio ya grabando antes de apretar Enter. Si la toma sale mal, no se vuelve a mandar: se graba la transacción ya hecha en Snowtrace.

```sh
.venv/bin/python -m oracle.relay reports/A/2026-11 --red fuji
```

Imprime una sola línea: lo que pagó, cómo quedó la parcela y el link a Snowtrace. No muestra nada de `.env`.

**Qué es real.** Las imágenes Sentinel-2, el cálculo y el contrato en Avalanche Fuji. Las billeteras y los montos son de prueba: la voz dice «red de prueba» en el tramo 05.

---

## Pitch en vivo (2 minutos)

Unas 300 palabras, con el deck para proyectar. Mismo tono que el video: contado, no recitado.

**[0:00 · Problema — imagen satelital del Chaco salteño, monte contra lotes desmontados]**

En Salta, entre enero y septiembre, se desmontaron más de 20 mil hectáreas de monte. ¿Por qué? Porque hoy, para el dueño del campo, desmontar paga. Y cuidar, no. La Ley de Bosques tendría que compensarlo, pero el año pasado pagó 4 centavos de dólar por hectárea: 155 veces menos de lo que dice la ley.

**[0:20 · La idea — diapo «solución»]**

Nosotros damos vuelta esa cuenta: le pagamos al dueño por cada mes que el monte sigue en pie. Y el que controla es el satélite.

**[0:30 · Cómo funciona]**

Alguien deja plata en un contrato en Avalanche, para una parcela. Todos los meses miramos esa parcela con una imagen de Sentinel-2. Si el monte está, firman dos de tres verificadores y el contrato paga solo: 60 % al dueño y 40 % a quien lo cuida y lo vigila.

Si aparece un desmonte, el contrato no corta de una: la primera lectura mala pone la parcela en revisión. Si la segunda lo confirma, corta, y lo que quedaba vuelve al donante o va a restaurar.

**[1:00 · Demo — diapo «demo» o la web]**

Lo probamos con dos parcelas reales durante todo 2025. Una siguió en pie y cobró los 12 meses. En la otra, en agosto el satélite ve el desmonte: queda menos de la mitad y entra en revisión. En septiembre se confirma, y el contrato corta solo.

**[1:15 · Por qué blockchain]**

¿Y por qué blockchain? Porque acá nadie tiene por qué confiar en nadie. El que pone la plata no conoce al que cuida, y el que cuida no sabe si le van a seguir pagando. El contrato guarda la plata y cumple las reglas solo, y cualquiera puede revisar la cuenta con la imagen pública.

**[1:30 · Los números — diapo «negocio»]**

¿Cierran los números? Desmontar le deja al dueño entre 96 y 264 dólares por hectárea al año. Si le pagamos entre 8 y 22 dólares por hectárea al mes, cuidar le gana. No es un bono verde, que es una inversión, ni una promesa de carbono: pagamos un resultado que se ve en la imagen. Pagan los que exportan a Europa, las empresas y la provincia, y nosotros nos quedamos con el 10 %.

**[1:50 · Cierre]**

El monte que queda no se salva con promesas. Se salva si cuidarlo paga más que desmontarlo. Bosque en pie: el satélite es el testigo, y el contrato paga.

---

## Para tener a mano (preguntas del jurado)

- **¿Y si el dato miente?** La imagen es pública y el algoritmo está en el repo. Firman dos de tres y hacen falta dos lecturas malas seguidas para cortar. En la demo los verificadores somos del equipo y no hay ventana para impugnar; en producción, verificadores independientes y 72 horas para impugnar.
- **¿Para empresas?** Cada cuota pagada genera un certificado de monte en pie por las hectáreas-mes financiadas. No es un bono ni un crédito de carbono.
- **¿Cuánto cuesta el certificado?** Entre USD 14 y 41 por hectárea-mes: lo que necesita el dueño (7,6 a 22), más el 40 % del operador y nuestra comisión. Empezamos por campo ganadero y zona amarilla, donde el número cierra.
- **¿Debilidades?** En tierra agrícola el precio sube; el desmonte se puede mudar al lote de al lado; Sentinel-2 no ve el raleo debajo de los árboles.
- **¿Qué es real en la demo?** Las imágenes Sentinel-2, el cálculo y el contrato en Avalanche Fuji. Las billeteras y los montos son de prueba.

Fuentes de los números: MAGyP 2025, Vallejos et al. 2021, FARN 2026, MSCI 2025, West et al. (Science, 2023). Dólar tomado: 1.250 pesos.

Atribución en la slide: "Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026".
