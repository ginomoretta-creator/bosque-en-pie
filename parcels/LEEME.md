# Parcelas de la demo

Dos parcelas de monte nativo del Chaco salteño (departamento Rivadavia), a ~1,5 km una de otra, en el tile Sentinel-2 **20KNA**. Mismo monte, mismo clima, dos destinos distintos en 2025. Dueños y operadores son billeteras de prueba: no se nombra a nadie ni se opina sobre la legalidad del desmonte.

| Parcela | Superficie | Qué pasó en 2025 |
|---|---|---|
| **A** | 101 ha | Monte nativo que siguió en pie todo el año |
| **B** | 84 ha | Monte nativo intacto hasta agosto; desmontado entre el 11/08 y el 15/09 |

## Cómo se eligieron

1. **B:** se barrió el tile 20KNA buscando píxeles que eran árboles en ESA WorldCover 2021, verdes y oscuros en octubre de 2024 y mayo de 2025, y desmontados en dos fechas limpias seguidas (septiembre y diciembre de 2025). La persistencia descarta nubes no detectadas. Se revisó a ojo con imágenes en color real: monte intacto → escolleras.
2. **A:** bloque de monte nativo cercano, revisado a ojo (textura de copas, picada) y con la serie mensual completa.
3. Se descartaron: lotes agrícolas y pasturas (no son monte), desmontes anteriores a 2025, un falso positivo por nubes en otro tile y un bloque de Yungas en San Lorenzo (5 meses nublados y una lectura mala falsa en marzo por sombras o nubes).

## Serie mensual con bosque-v1 (umbrales por defecto, año base 2024)

Mejor imagen de cada mes contra el mismo mes de 2024. Menos de 60 % visible = sin informe.

| Mes 2025 | A: visible · en pie | B: visible · en pie |
|---|---|---|
| Ene | 100 % · 100 % | 100 % · 100 % |
| Feb | 100 % · 100 % | 100 % · 100 % |
| Mar | 8 % · sin informe (nubes) | 44 % · sin informe (nubes) |
| Abr | 99,9 % · 100 % | 100 % · 100 % |
| May | 96 % · 100 % | 95,7 % · 100 % |
| Jun | 99,8 % · 100 % | 99,7 % · 100 % |
| Jul | 98,7 % · 100 % | 98 % · 100 % |
| Ago | 93,8 % · 100 % | 100 % · 100 % |
| Sep | 100 % · 100 % | 100 % · **47,4 %** → en revisión |
| Oct | 100 % · 100 % | 100 % · **59,4 %** → **desmontada** |
| Nov | 100 % · 100 % | 100 % · 2,2 % |
| Dic | 99,8 % · 100 % | 100 % · 40,1 % |

Con esto se cumple la calibración de la issue #18 sin tocar los umbrales: A no da lecturas malas en el año y B las da desde el mes del desmonte. B cobra 7 cuotas (ene, feb, abr a ago), entra en revisión en septiembre y se corta en octubre.

Contiene datos Copernicus Sentinel modificados, 2024 y 2025. Máscara de árboles: ESA WorldCover 2021 (CC BY 4.0).
