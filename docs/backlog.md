# Backlog de Bosque en pie

Fuente de las issues de GitHub. Cada bloque `### ` es una issue; `scripts/create-issues.mjs` las crea con su milestone y labels.

**Cierre: viernes 13/11/2026, 09:00 (Argentina).** Lo marcado `no se recorta` va sí o sí. Si falta tiempo, se recorta en el orden de los labels `recorte 1` a `recorte 5`.

---

### Configurar Hardhat 2 y el proyecto del contrato
- milestone: 1 · Contrato y pruebas
- labels: contrato, no se recorta

Hardhat **2** con versión fija (no 3), Solidity 0.8.24, `evmVersion: "paris"`, ethers v6. Redes `hardhat` (local) y `fuji` (chain ID 43113, RPC desde `.env`).

**Hecho cuando:** `npx hardhat compile` y `npx hardhat test` corren sin errores sobre un contrato vacío y la versión de Hardhat queda fijada en `package.json`.

### Contrato base: constructor, roles y registro de parcelas
- milestone: 1 · Contrato y pruebas
- labels: contrato, no se recorta

`contracts/BosqueEnPie.sol`, un solo archivo y sin dependencias externas.
- Constructor: verificadores (3), quórum, `challengeWindow`, `minInterval`, `maxObsAge` (0 = sin límite), `restorationTimeout`. Quien despliega es el curador.
- `registerParcel` (solo curador): dueño, operador, cuota mensual en AVAX, umbral `coverBps` (por defecto 9500), `ownerShareBps`, hectáreas.
- Estados: en pie, en revisión, desmontada.
- Eventos para todo lo que la web necesita leer.

**Hecho cuando:** pruebas de registro (curador sí, otra cuenta no) en verde.

### Aportes en AVAX con elección devolución / restauración
- milestone: 1 · Contrato y pruebas
- labels: contrato, no se recorta

`donate(parcelId, choice)` payable en AVAX nativo. Guarda el aporte por donante y por opción (devolución o fondo de restauración). Rechaza aportes a parcelas desmontadas. Emite evento.

**Hecho cuando:** pruebas de aporte (montos, dos donantes, opción guardada, parcela desmontada rechaza) en verde.

### Informes firmados: validación de firmas, quórum y fechas (regla 1)
- milestone: 1 · Contrato y pruebas
- labels: contrato, no se recorta

- Digest: `keccak256(abi.encode(block.chainid, address(this), parcelId, tObs, coverBps, validBps, evidenceHash))` con tipos `uint256, address, uint256, uint64, uint16, uint16, bytes32`.
- Firma EIP-191 (`personal_sign`), recuperación con `ecrecover`. Firmas ordenadas por dirección de menor a mayor; rechaza repetidas, desordenadas y firmantes no registrados.
- Acepta con ≥ quórum (2 de 3), `validBps` ≥ 6000, `tObs` ≥ última aceptada + `minInterval`, `tObs` no futura y dentro de `maxObsAge` si es > 0.

**Hecho cuando:** pruebas de quórum, firmas repetidas/desordenadas, informe alterado, nubes (`validBps` bajo) y fechas en verde.

### Estados y pagos: cuota, revisión y corte (reglas 2 a 5 y 8)
- milestone: 1 · Contrato y pruebas
- labels: contrato, no se recorta

- Lectura buena (`coverBps` ≥ umbral): paga una cuota, repartida entre dueño y operador según `ownerShareBps`. Si el pozo no alcanza, paga lo que queda.
- Primera lectura mala: pasa a "en revisión", no paga ni corta.
- Segunda mala seguida: "desmontada", pagos cortados para siempre.
- Buena estando en revisión: vuelve a "en pie" y paga.
- El saldo nunca va al dueño ni al operador por un desmonte.

Si falta tiempo, el reparto dueño/operador se reduce a un solo cuidador (`recorte 3`), pero el corte no se toca.

**Hecho cuando:** pruebas de revisión, vuelta a en pie, corte y pozo insuficiente en verde.

### División del saldo al confirmarse el desmonte (regla 6)
- milestone: 1 · Contrato y pruebas
- labels: contrato, recorte 2 · restauración

- Parte "devolución": cada donante retira en proporción a su aporte (`withdrawRefund`).
- Parte "restauración": queda bloqueada como fondo de restauración de la parcela. Pasado `restorationTimeout` sin usarse, esos donantes también pueden retirarla.
- La liberación por etapas a un restaurador queda solo para el pitch.

Si se recorta: queda solo la devolución.

**Hecho cuando:** pruebas de división del saldo con dos donantes con opciones distintas, retiro antes y después del vencimiento, y doble retiro rechazado.

### Impugnación de informes (regla 7)
- milestone: 1 · Contrato y pruebas
- labels: contrato, recorte 4 · impugnación

Si `challengeWindow` > 0, el informe queda pendiente ese tiempo. Pueden impugnar el dueño, el operador o un donante de la parcela; resuelve el curador. Pasada la ventana sin impugnación, cualquiera lo ejecuta. Si `challengeWindow` = 0 se ejecuta en la misma transacción (configuración de la demo).

**Hecho cuando:** pruebas de ventana, impugnación por cada rol permitido, rechazo de terceros y resolución del curador en verde.

### Certificados de monte en pie (ERC-1155)
- milestone: 1 · Contrato y pruebas
- labels: contrato, recorte 1 · certificados

Para empresas con metas ambientales. Cada cuota pagada acuña al donante un certificado por las hectáreas-mes que financió, en proporción a su aporte. Transferible y retirable (retirar = quemar y dejarlo registrado a nombre de quien lo retira). ERC-1155 mínimo propio, sin dependencias, un `id` por parcela.

**No es un bono de carbono y no se lo llama así** en código, interfaz ni pitch: es un "certificado de monte en pie".

**Hecho cuando:** pruebas de acuñado proporcional, transferencia y retiro en verde, y el resto de la suite sigue pasando.

### Compromiso con plazo y quien paga no cobra (reglas 9 y 10)
- milestone: 1 · Contrato y pruebas
- labels: contrato

- `commitEnd` por parcela, fijado por el curador al registrarla (0 = sin plazo, como en la demo).
- Antes de `commitEnd`, el aporte no se retira ni se mueve a otra parcela (no existe función para eso).
- Pasado `commitEnd` con la parcela en pie, cualquiera cierra el compromiso: se terminan los pagos y cada donante retira el saldo sobrante en proporción a su aporte.
- `donate` rechaza aportes desde la dirección del dueño o del operador de la parcela.

**Hecho cuando:** pruebas de cierre del compromiso, retiro proporcional del sobrante, informes rechazados después del cierre y aporte del dueño u operador rechazado, en verde.

### Suite de pruebas del contrato completa
- milestone: 1 · Contrato y pruebas
- labels: contrato, no se recorta

Repasar que estén cubiertos: quórum, firmas repetidas o desordenadas, informe alterado, nubes, fechas, revisión y corte, división del saldo, impugnación, pozo insuficiente y certificados (si entraron).

**Hecho cuando:** se pega en la issue la salida de `npx hardhat test` con todo en verde.

### Firma de informes desde Python (`oracle/signing.py`)
- milestone: 2 · Firma desde Python
- labels: oráculo, no se recorta

Construir el mismo digest que el contrato con `eth_abi` + keccak256, firmar con `eth_account` (`encode_defunct`) y devolver las firmas ordenadas por dirección del firmante.

**Hecho cuando:** pruebas unitarias en Python que comparan el digest con un valor calculado por el contrato.

### Prueba Python ↔ nodo local de Hardhat
- milestone: 2 · Firma desde Python
- labels: oráculo, contrato, no se recorta

Script de prueba que levanta `npx hardhat node`, despliega, registra una parcela, aporta, firma 2 de 3 en Python y envía el informe con `web3.py`. Verifica que el dueño y el operador cobraron.

**Hecho cuando:** la prueba corre de punta a punta y se pega la salida.

### Claves de prueba y AVAX de Fuji
- milestone: 3 · Despliegue en Fuji
- labels: infra, necesita humano, no se recorta

Generar claves de prueba (curador, 3 verificadores, relayer, dueños y operadores genéricos), cargarlas en `.env` (nunca en el repo) y conseguir AVAX de prueba del faucet para curador y relayer.

**Hecho cuando:** las cuentas tienen saldo en Fuji (link al explorer de cada una en la issue, sin claves).

### Despliegue y registro de parcelas en Fuji
- milestone: 3 · Despliegue en Fuji
- labels: contrato, infra, no se recorta

`scripts/deploy.js` (parámetros de demo: `challengeWindow = 0`, `maxObsAge = 0`, `minInterval = 20 días`) y `scripts/register-parcels.js` para A y B. Guardar dirección y link del explorer en el README y en `deployments/fuji.json`.

**Hecho cuando:** el contrato está en Fuji y el link al explorer muestra el despliegue y los dos registros.

### Verificar el código fuente en el explorer
- milestone: 3 · Despliegue en Fuji
- labels: contrato, infra

Verificar el contrato en Snowtrace / Routescan para que el jurado pueda leer el código desde el explorer.

**Hecho cuando:** el explorer muestra el código verificado.

### Parcelas A y B en GeoJSON
- milestone: 4 · Algoritmo Sentinel-2
- labels: datos, necesita humano, no se recorta

A: monte intacto en 2025. B: un desmonte real de 2025 en el Chaco salteño. Polígonos en `parcels/A.geojson` y `parcels/B.geojson`, con superficie en hectáreas. Sin nombrar dueños reales ni opinar sobre la legalidad del desmonte.

**Hecho cuando:** los dos archivos están en el repo y se ven bien sobre una imagen satelital.

### Algoritmo bosque-v1 (`oracle/cover.py`)
- milestone: 4 · Algoritmo Sentinel-2
- labels: oráculo, no se recorta

Píxeles válidos SCL ∈ {4, 5, 6, 7}; NDVI del mes contra el mismo mes del año base; monte base NDVI ≥ 0,45; píxel perdido si bajó ≥ 0,25 y quedó ≤ 0,35; apertura 3×3 y descarte de manchas < 100 px; `coverBps` y `validBps`.

**Hecho cuando:** pruebas con matrices sintéticas (sin pérdida, pérdida en bloque, ruido aislado, nubes) en verde.

### Lectura de Sentinel-2 desde Earth Search (`oracle/s2.py`)
- milestone: 4 · Algoritmo Sentinel-2
- labels: oráculo, no se recorta

STAC en `https://earth-search.aws.element84.com/v1`, colección `sentinel-2-l2a`. Para una parcela y un mes, elegir la imagen con más superficie visible sobre la parcela y leer solo el recorte (`red`, `nir`, `scl`) con `rasterio` sobre los COG, aplicando escala y offset.

**Hecho cuando:** corre contra una parcela real y devuelve las matrices y el id de la imagen usada.

### Calibrar y congelar umbrales con 2025
- milestone: 4 · Algoritmo Sentinel-2
- labels: oráculo, datos, no se recorta

Correr los 12 meses de 2025 para A y B (base 2024). Ajustar umbrales hasta que A no dé lecturas malas y B las dé desde el mes del desmonte. Congelar y documentar los valores finales.

**Hecho cuando:** tabla real de `coverBps` / `validBps` por mes para A y B en la issue. Si un mes no se pudo calcular, se dice.

### Estimación de carbono en pie por parcela (informativa)
- milestone: 4 · Algoritmo Sentinel-2
- labels: oráculo, datos, recorte 1 · certificados

t CO₂e en pie = hectáreas × biomasa por hectárea del tipo de bosque (Yungas o Chaco) × 0,47 × 44/12. Factores tomados de IPCC 2019 o del Inventario Nacional de Bosques Nativos, con la cita en el código. Se guarda en el JSON de evidencia. En la página se muestra como "bono de carbono (simulación)", con t CO₂e estimadas y un valor de ejemplo opcional, siempre con la etiqueta "SIMULACIÓN · no validado".

**Hecho cuando:** la función tiene pruebas, los factores citan su fuente y el valor aparece en la evidencia de A y B.

### Armar informes con evidencia (`oracle/make_report.py`)
- milestone: 5 · Informes y envío
- labels: oráculo, no se recorta

Para parcela y mes: corre el algoritmo, guarda la evidencia JSON (imagen usada, imagen base, versión del algoritmo, resultado) en `reports/<parcela>/<AAAA-MM>/`, calcula `evidenceHash` = keccak256 del JSON y firma con los verificadores.

**Hecho cuando:** hay un informe real firmado en `reports/` y su hash coincide al recalcularlo.

### Enviar informes a Fuji (`oracle/relay.py`)
- milestone: 5 · Informes y envío
- labels: oráculo, no se recorta

`web3.py` con `ExtraDataToPOAMiddleware` y `gasPrice`. Envía un informe firmado y muestra el link de la transacción.

**Hecho cuando:** un informe real pagó una cuota en Fuji (link a la transacción en la issue).

### Repetir 2025 en un minuto (`oracle/replay.py`)
- milestone: 5 · Informes y envío
- labels: oráculo, no se recorta

Envía en orden los 12 informes de una parcela. Para B debe verse: pagos, revisión y corte.

**Hecho cuando:** replay de A y de B en Fuji con links a las transacciones; B termina "desmontada".

### Imágenes de cada mes para la página
- milestone: 5 · Informes y envío
- labels: oráculo, web, recorte 5 · imágenes

Exportar por parcela y mes una miniatura (color natural y mapa de pérdida) junto a la evidencia, para mostrarla en la web.

**Hecho cuando:** las 24 miniaturas están en `reports/` y la web las encuentra.

### Mock de interfaz v3 (pulido del v2 Noche)
- milestone: 6 · Página web
- labels: web, diseño

Partir del Figma v2 "Noche" y sumar: certificados de monte en pie, vista dueño/operador, aporte más corto, línea de tiempo de 12 meses con imagen por mes y estados más claros. Mock HTML en `design/` que sirve de base para `web/`. Los números del mock son de relleno y se marcan como tales.

**Hecho cuando:** el mock está en el repo y el equipo eligió la versión final.

### Esqueleto de la web (Vite + viem + Leaflet)
- milestone: 6 · Página web
- labels: web, no se recorta

Proyecto en `web/`, tokens de estilo del v2 Noche, lectura de eventos del contrato en Fuji con viem, interfaz en español.

**Hecho cuando:** `npm run dev` muestra los eventos reales del contrato en Fuji.

### Pantallas Mapa y Parcela
- milestone: 6 · Página web
- labels: web, no se recorta

Mapa con el estado de cada parcela (Leaflet). Parcela: estado, monte en pie, 12 meses, firmas de cada informe, pagos, saldo del pozo y botón de aportar.

**Hecho cuando:** las dos pantallas muestran datos leídos del contrato, sin valores fijos.

### Aportar con billetera de prueba desde el celular
- milestone: 6 · Página web
- labels: web, no se recorta

La clave de prueba viaja en el fragmento de la URL de un QR (`#k=…`), nunca en el query string ni en el servidor. Elegir monto y opción devolución/restauración, enviar y ver la confirmación con link al explorer.

**Hecho cuando:** desde un celular, escaneando un QR, se hace un aporte real en Fuji.

### Mi aporte, recuperar y actividad
- milestone: 6 · Página web
- labels: web, no se recorta

Mi aporte: lo aportado, la opción elegida y el botón de recuperar cuando corresponde. Actividad: eventos del contrato con link al explorer.

**Hecho cuando:** tras el corte de B se puede recuperar la parte de devolución desde la web.

### Pantalla de certificados
- milestone: 6 · Página web
- labels: web, recorte 1 · certificados

Certificados del donante (hectáreas-mes por parcela), con transferir y retirar. Texto: "certificado de monte en pie", nunca "bono".

**Hecho cuando:** un certificado acuñado en Fuji se ve, se transfiere y se retira desde la web.

### Billeteras del jurado: QR imprimibles
- milestone: 6 · Página web
- labels: web, infra, necesita humano

Generar 5 billeteras de prueba, cargarles AVAX de Fuji y armar una hoja de QR imprimible (como la del Figma). Solo claves de prueba sin valor.

**Hecho cuando:** la hoja está lista para imprimir y cada QR abre la web con su billetera cargada.

### Publicar la web
- milestone: 6 · Página web
- labels: web, infra, no se recorta

Publicar la página estática (GitHub Pages o Vercel) para que los QR funcionen desde cualquier celular.

**Hecho cuando:** la URL pública abre en un celular y lee el contrato en Fuji.

### README completo
- milestone: 7 · Entrega
- labels: docs, no se recorta

Cómo correr todo (contrato, oráculo, web), dirección del contrato y link al explorer, parámetros de la demo (`challengeWindow = 0`, `maxObsAge = 0`) y su valor en un producto real, atribución "Contiene datos Copernicus Sentinel modificados, 2024 y 2025" y qué se hizo con IA.

**Hecho cuando:** alguien del equipo sigue el README en una máquina limpia y le funciona.

### Pitch de 5 a 7 slides
- milestone: 7 · Entrega
- labels: pitch, no se recorta

Problema (desmonte en Salta 2026 y Ley de Bosques), solución, demo, una slide dedicada a "por qué blockchain", límites honestos (verificadores del equipo, parámetros de la demo), certificados de monte en pie y fondo de restauración como siguiente paso. Atribución de Copernicus.

**Hecho cuando:** las slides están exportadas y enlazadas en el README.

### Video de demo (1 a 3 minutos)
- milestone: 7 · Entrega
- labels: pitch, necesita humano, no se recorta

Grabar la demo con al menos una acción real en el contrato (aporte o envío de informe) y el corte de B, mostrando el explorer.

**Hecho cuando:** el video está subido y enlazado en el README.

### Entregar en la competencia
- milestone: 7 · Entrega
- labels: necesita humano, no se recorta

Cargar link del contrato, del video, del pitch y del repo antes del **viernes 13/11/2026 a las 09:00**. Meta: jueves 12 a la noche.

**Hecho cuando:** la entrega está confirmada.
