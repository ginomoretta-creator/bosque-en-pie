# Slides del pitch · Bosque en pie

6 slides para la Competencia Argentina Space. Texto pensado para leerse de lejos; los detalles van en las notas del orador. Datos reales de las parcelas y los informes en `reports/`; la atribución de Copernicus va en el pie de cada slide que use imágenes satelitales.

---

## Slide 1 · Título

**Bosque en pie: el satélite es el testigo y el contrato paga.**

- Pago por conservar monte nativo, verificado cada mes por Sentinel-2.
- Un contrato en Avalanche paga una cuota mensual a quienes cuidan la parcela.
- Demo real: dos parcelas del Chaco salteño y sus imágenes reales de 2025.

**Imagen:** logo de la «b» sobre `reports/A/2025-06/rgb.png` (monte intacto) de fondo, tenue.

**Notas:** 20 segundos. Una sola frase y la foto. Decir el nombre del proyecto y la idea en una línea; no explicar todavía el mecanismo.

---

## Slide 2 · Problema

**Conservar el monte no paga. Desmontarlo, sí.**

- Salta desmontó más de 20.000 ha de monte nativo entre enero y septiembre de 2026 (relevamiento satelital de Greenpeace).
- La Ley de Bosques prometió un fondo para quien conserva; nunca se integró completo.
- El donante no conoce a quien cuida ni puede ir a ver el monte; quien cuida no sabe si van a seguir pagando.

**Imagen:** `reports/B/2025-07/rgb.png` (último mes con el monte intacto) junto a `reports/B/2025-09/rgb.png` (escolleras del desmonte).

**Notas:** el contraste de las dos fotos es el argumento. Si preguntan por la legalidad del desmonte: no opinamos ni nombramos a nadie; solo mostramos que el pago por conservar es verificable.

---

## Slide 3 · Solución

**Pagamos por cada mes que el monte sigue en pie.**

1. Una empresa con metas ambientales deja AVAX por adelantado en el contrato, para una parcela y un plazo de compromiso.
2. Cada mes, una imagen Sentinel-2 compara la parcela con el mismo mes del año anterior.
3. Tres verificadores firman el informe; alcanza con dos. El contrato paga la cuota al dueño y al operador.
4. Si aparece un desmonte, dos lecturas malas seguidas cortan los pagos. El saldo vuelve al donante o queda para restaurar: nadie gana con un desmonte.

**Imagen:** diagrama simple de 4 pasos (empresa → contrato → satélite → dueño/operador), o el mapa de la web con las dos parcelas.

**Notas:** el punto clave es "nadie gana con un desmonte": la plata nunca va al dueño ni al operador. La empresa recibe certificados de monte en pie por las hectáreas-mes financiadas.

---

## Slide 4 · Cómo funciona

**La demo repite el 2025 real en un minuto.**

- Parcela A (101 ha): monte en pie todo el año; cobró la cuota cada mes con informe.
- Parcela B (84 ha): 7 cuotas pagadas (enero a julio), en revisión en agosto (48,7 % en pie) y cortada en septiembre (1,4 %).
- Cada mes usa la imagen utilizable (60 % visible o más) más cercana al día 15; si un mes no tiene ninguna, no hay informe y el contrato ni paga ni corta.
- La evidencia de cada informe queda en el repo con su hash: cualquiera rehace la cuenta.

**Imagen:** `reports/B/2025-08/perdida.png` (píxeles perdidos en rojo) y `reports/B/2025-09/perdida.png`. Si hay tiempo, captura del replay corriendo.

**Notas:** explicar que se compara contra el mismo mes de 2024 porque el monte chaqueño pierde hojas en invierno. Las imágenes, el algoritmo (bosque-v1) y los informes firmados son reales y están en el repo.

---

## Slide 5 · Por qué blockchain

**Acá nadie confía en nadie, y con razón.**

- Una base de datos guarda registros, no plata: haría falta una organización que la custodie, y las dos partes tendrían que confiar en ella.
- El contrato guarda la plata y aplica las reglas solo: quórum 2 de 3, dos lecturas malas para cortar, ventana para impugnar.
- La imagen es pública y el algoritmo está en el repo: el dato no puede mentir sin que se note.
- Si el dato está en duda, el informe queda pendiente y decide el curador.

**Imagen:** la pantalla "Actividad" de la web (eventos del contrato) o el explorer de Fuji.

**Notas:** esta slide es obligatoria para el jurado. Límites honestos: en la demo los tres verificadores somos del equipo, la ventana de impugnación va en cero para mostrar un año en un minuto y el carbono es una estimación. En producción: verificadores independientes, 72 h para impugnar, imágenes de hasta 45 días y compromiso de 24 meses.

---

## Slide 6 · Impacto y siguiente paso

**El monte que queda no se salva con promesas: se salva si cuidarlo paga más que desmontarlo.**

- Impacto medible: hectáreas-mes verificadas por satélite y t CO₂e estimadas en pie (etiqueta "SIMULACIÓN · no validado").
- Cliente: empresas con metas ambientales que pagan por adelantado y reciben certificados de monte en pie.
- Siguiente paso: verificadores independientes, fondo de restauración liberado por etapas y más parcelas del NOA.

**Imagen:** `reports/A/2025-10/rgb.png` (el monte de A siguiendo en pie al final del año) con la frase de cierre.

**Notas:** cerrar con la frase, no con más datos. Pie en todas las slides con imágenes: "Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026". Máscara de árboles: ESA WorldCover 2021 (CC BY 4.0).
