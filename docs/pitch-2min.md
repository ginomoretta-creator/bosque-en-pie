# Pitch de 2 minutos · Bosque en pie

Unas 310 palabras, a ritmo tranquilo (~150 por minuto). Entre corchetes, qué se muestra en pantalla.

---

**[0:00 · Problema — imagen satelital del Chaco salteño, monte contra lotes desmontados]**

Entre enero y septiembre de este año, en Salta se desmontaron más de veinte mil hectáreas de monte nativo. La Ley de Bosques prometió un fondo para pagarle a quien conserva, pero ese fondo nunca se integró completo. Hoy, conservar el monte no paga. Desmontarlo, sí.

**[0:20 · La idea — logo y frase]**

Bosque en pie da vuelta esa cuenta: pagamos por cada mes que el monte sigue en pie. Y el testigo es el satélite.

**[0:30 · Cómo funciona — los cuatro pasos]**

Un donante deja AVAX en un contrato en Avalanche, para una parcela. Cada mes, una imagen Sentinel-2 compara esa parcela con el mismo mes del año anterior. Si el monte sigue, los verificadores firman el informe —alcanza con dos de tres— y el contrato paga la cuota: una parte al dueño por no desmontar y otra al operador que hace cortafuegos y vigila.

Si aparece un desmonte, la primera lectura mala pone la parcela en revisión. La segunda corta los pagos para siempre. Y nadie gana con un desmonte: el saldo vuelve al donante o queda para restaurar.

**[1:05 · Demo — replay de 2025]**

En la demo repetimos el 2025 de dos parcelas reales en un minuto: una cobra todos los meses; en la otra aparece el desmonte y el contrato corta solo.

**[1:20 · Por qué blockchain]**

¿Por qué blockchain? Porque acá nadie confía en nadie, y con razón. El donante no conoce a quien cuida ni puede ir a ver el monte. Quien cuida no sabe si el donante va a seguir pagando. Una base de datos guarda registros, no plata. El contrato guarda la plata y aplica las reglas solo, y la imagen es pública: cualquiera puede rehacer la cuenta.

**[1:40 · Límites honestos]**

En la demo los verificadores somos del equipo y no hay ventana para impugnar, para mostrar un año en un minuto. En producción: verificadores independientes y 72 horas para impugnar.

**[1:50 · Cierre]**

El monte que queda no se salva con promesas. Se salva si cuidarlo paga más que desmontarlo. Bosque en pie: el satélite es el testigo y el contrato paga.

---

## Para tener a mano (preguntas del jurado)

- **¿Y si el dato miente?** La imagen es pública y el algoritmo está en el repo. Firman dos de tres, hacen falta dos lecturas malas seguidas para cortar y hay una ventana para impugnar.
- **¿Para empresas?** Cada cuota pagada genera un certificado de monte en pie por las hectáreas-mes financiadas. No es un bono de carbono.
- **¿Qué es real en la demo?** Las imágenes Sentinel-2, el cálculo y el contrato en Avalanche Fuji. Las billeteras y montos son de prueba.

Atribución en la slide: "Contiene datos Copernicus Sentinel modificados, 2024 y 2025".
