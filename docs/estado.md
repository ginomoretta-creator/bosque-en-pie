# Estado del proyecto · jueves 12/11/2026

Resumen para el equipo. Cierre: **viernes 13/11 a las 09:00**. Repo: https://github.com/ginomoretta-creator/bosque-en-pie · Issues y milestones: pestaña *Issues*. El contexto completo del proyecto está en `CLAUDE.md`.

## La idea en una línea

Bosque en pie paga cada mes que el monte sigue en pie: el satélite es el testigo y un contrato en Avalanche paga.

## Decisiones tomadas hoy

- **Cliente:** una empresa con metas ambientales, por ejemplo una minera de la región (sin nombrar empresas reales; en la demo es "empresa de prueba"). En el código el rol sigue siendo "donante".
- **Cómo paga:** la empresa paga **por adelantado** el compromiso (por ejemplo, 24 cuotas). El contrato paga una cuota **por cada informe verificado** (uno por mes) al dueño (60 %) y al operador (40 %).
- **Compromiso con plazo (regla 9):** la plata queda bloqueada en la parcela hasta `commitEnd`; no se retira ni se pasa a otra parcela. Al terminar con el monte en pie, cada donante retira el sobrante. En la demo `commitEnd = 0`.
- **Quien paga no cobra (regla 10):** el dueño y el operador no pueden aportar a su propia parcela.
- **Token:** el certificado de monte en pie (ERC-1155, 1 token = 1 hectárea-mes). Queda bloqueado hasta el fin del compromiso y congelado si hay desmonte. **Todavía no está implementado** (issue #8).
- **Carbono:** se muestra como **"bono de carbono (simulación)"**, con las t CO₂e estimadas con factores públicos (IPCC / Inventario Nacional) y siempre con la etiqueta "SIMULACIÓN · no validado". No decir que está validado.
- **Parcelas:** A, monte en pie (propuesta: Yungas cerca de San Lorenzo, mejor fuera del área protegida). B, un desmonte real de 2025 en el Chaco salteño.

## Hecho (todo en el repo)

| Paso | Estado | Cómo verificarlo |
|---|---|---|
| 1 · Contrato y pruebas | ✅ `contracts/BosqueEnPie.sol`, reglas 1 a 10 | `npx hardhat test` → 34 pasando |
| 2 · Firma desde Python | ✅ `oracle/signing.py` | `pytest oracle/tests` → 5 pasando (incluye nodo local) |
| 3 · Despliegue en Fuji | ⏳ scripts listos y probados en local | falta AVAX de prueba en las billeteras |
| Pitch | ✅ `docs/pitch-2min.md` | guion de 2 minutos + respuestas al jurado |
| Diseño | 🟡 `design/mock-v4-standalone.html` (abrir en el navegador) | falta elegir íconos y poner el logo v2 original |

Billeteras de prueba: direcciones en `deployments/addresses-fuji.md`. Las claves están solo en el `.env` de Gino; si alguien las necesita, se pasan por privado, nunca por el repo ni por el grupo.

## Pendiente y quién

**Gino (bloquea al resto):**
- Cargar AVAX de Fuji en el curador `0x4672987D452ff25B2ad1a55153854225A12CB96b` y el relayer `0xd298C86F22D85f7fcE77fd38e0941687484b76AC` (faucet: https://core.app/tools/testnet-faucet).
- Dibujar las parcelas A y B en GeoJSON (`parcels/A.geojson`, `parcels/B.geojson`) y anotar las hectáreas en `parcels/registry.json`.
- Pasar el logo v2 en SVG (Figma → clic derecho → Copiar como SVG).
- Elegir el estilo de íconos en `design/icon-options.html` (A emoji 3D, B emoji a color, C emoji plano, D línea).

**Para repartir:**
- Paso 4 · Algoritmo: `oracle/cover.py` (bosque-v1) con pruebas, `oracle/s2.py` (Earth Search), calibración con 2025, estimación de carbono (#16, #17, #18, #36).
- Paso 5 · Informes: `make_report.py`, `relay.py`, `replay.py` (#19 a #22).
- Paso 6 · Web: Vite + viem + Leaflet sobre el mock v4; publicarla para los QR (#24 a #30).
- Certificados ERC-1155 en el contrato (#8) y su pantalla (#28): lo primero que se recorta si falta tiempo.
- Entrega: slides de 5 a 7 (con "por qué blockchain"), video de 1 a 3 minutos, README final y carga en la competencia (#31 a #34).

## Notas

- La cuenta de Figma de Gino tiene asiento View: no se puede editar por el conector. Quien tenga plan pago puede pasar el mock v4 al Figma; cada pantalla lista qué componentes usa.
- Atribución obligatoria en README y slides: "Contiene datos Copernicus Sentinel modificados, 2024 y 2025".
