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

## Serie mensual con bosque-v1 (umbrales congelados, año base 2024)

Mejor imagen de cada mes contra el mismo mes de 2024. Menos de 60 % visible = sin informe. Es la salida real de `python -m oracle.make_report <A|B> --year 2025` (archivos en `reports/`).

| Mes 2025 | A: visible · en pie | B: visible · en pie |
|---|---|---|
| Ene | 100 % · 100 % | 100 % · 100 % |
| Feb | 100 % · 100 % | 100 % · 100 % |
| Mar | 53,8 % · sin informe (nubes) | 45,5 % · sin informe (nubes) |
| Abr | 100 % · 100 % | 100 % · 100 % |
| May | 100 % · 100 % | 100 % · 100 % |
| Jun | 100 % · 100 % | 100 % · 100 % |
| Jul | 100 % · 100 % | 100 % · 100 % |
| Ago | 100 % · 100 % | 100 % · **86,3 %** → en revisión |
| Sep | 100 % · 100 % | 100 % · **1,4 %** → **desmontada** |
| Oct | 100 % · 100 % | 100 % · 3,4 % |
| Nov | 100 % · 100 % | 100 % · 1,4 % |
| Dic | 100 % · 100 % | 100 % · 13,3 % |

B cobra 6 cuotas (enero, febrero y abril a julio), entra en revisión en agosto y se corta en septiembre.

## Calibración (issue #18)

- **Bug corregido:** los COG de Earth Search ya traen aplicado el offset BOA, aunque `raster:bands` anuncie −0,1 (y aunque la bandera `earthsearch:boa_offset_applied` a veces diga False). Restarlo de nuevo daba reflectancias negativas y NDVI > 1. Ahora no se resta (`oracle/s2.py`, con prueba de regresión).
- **Con los datos corregidos,** los umbrales de partida (monte base 0,45; caída 0,25; NDVI final 0,35) detectaban el desmonte de B recién en noviembre: en la estación seca el monte chaqueño baja a NDVI ~0,30 y la caída no alcanzaba.
- **Umbrales congelados:** monte base NDVI ≥ 0,25; pérdida = bajó ≥ 0,08 y quedó ≤ 0,28. Se probaron 480 combinaciones; con esta, A da 100 % todos los meses y B se detecta en agosto, cuando la imagen ya lo muestra talado. El monte intacto no baja de NDVI ~0,36 ni en septiembre, por eso el umbral final de 0,28 evita falsos positivos aun con una caída mínima chica.

## Carbono estimado (bono de carbono · SIMULACIÓN, no validado)

Cada mes trae `carbono.json` (`oracle/carbono.py`): t CO₂e = ha en pie × 115,9 t m.s./ha × (1 + 0,336) × 0,47 × 44/12 ≈ **267 t CO₂e por hectárea**. Factores por defecto del IPCC 2019 Refinement, Vol. 4, cap. 4, para bosque seco subtropical de Sudamérica: tabla 4.7 (115,9 ± 46,2 t/ha, p. 4.23) y tabla 4.4 (R = 0,336, p. 4.19). Es subtropical porque las zonas del IPCC/FAO van por clima, no por latitud. Referencia local: ~98 t m.s./ha en el Parque Chaqueño (Gasparri y Manghi, 2004).

Va **aparte de `evidence.json`** a propósito: los `evidenceHash` ya están grabados en Fuji y no cambian si se agrega o se corrige esta estimación (`python -m oracle.make_report <A|B> --solo-carbono`).

| | ha en pie | t CO₂e en pie |
|---|---|---|
| A, dic 2025 | 100,7 | ≈ 26.900 |
| B, jul 2025 (antes del desmonte) | 83,6 | ≈ 22.300 |
| B, sep 2025 (después del corte) | 1,2 | ≈ 320 |

Es una estimación con factores por defecto, no una medición de la parcela ni un crédito certificado.

Contiene datos Copernicus Sentinel modificados, 2024 y 2025. Máscara de árboles: ESA WorldCover 2021 (CC BY 4.0).
