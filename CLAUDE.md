# Bosque en pie

Proyecto de hackatón (Competencia Argentina Space, Salta, track Avalanche). Este archivo es todo el contexto: leelo entero antes de escribir código.

## Fecha límite y entregables

- **Cierre: viernes 13/11/2026 a las 09:00** (hora de Argentina). La meta es entregar el jueves 12 a la noche.
- Obligatorio: un contrato desplegado en **Avalanche Fuji** con link al explorer, un video de demo de 1 a 3 minutos con una acción en el contrato, y un pitch de 5 a 7 slides con una dedicada a "por qué blockchain".
- El repositorio es opcional, pero lo vamos a entregar.
- Criterios del jurado, con el mismo peso: impacto (un problema real del NOA suma), creatividad, validez (contrato desplegado, acción demostrable, datos reales), justificación de blockchain, presentación.

**Prioridad absoluta: algo simple que funcione de punta a punta.** Si hay que elegir entre una función más y que la demo corra, gana la demo.

## Qué es

Pago por conservar monte, verificado por satélite. Un donante (persona o empresa) deja plata bloqueada en un contrato. Cada mes que una imagen Sentinel-2 confirma que una parcela de monte sigue en pie, el contrato paga una cuota a quienes la cuidan. Si aparece un desmonte, los pagos se cortan.

Problema: en Salta se desmontaron 20.122 hectáreas entre enero y septiembre de 2026 (relevamiento satelital de Greenpeace), y el fondo de la Ley de Bosques para compensar a quienes conservan nunca se integró completo.

## Roles

| Rol | Qué hace |
|---|---|
| Donante | Aporta al pozo de una parcela. Al aportar elige qué pasa con su saldo si hay desmonte: devolución o fondo de restauración |
| Dueño | Tiene la parcela. Cobra una parte de cada cuota por no desmontar |
| Operador | Cuida la parcela (cortafuegos, vigilancia). Cobra la otra parte de cada cuota |
| Verificadores | Tres claves distintas. Miden el monte en la imagen y firman el informe |
| Curador | Cuenta que despliega. Registra parcelas y resuelve impugnaciones |

## Reglas del contrato

1. **Informe aceptado:** al menos 2 firmas de 3 verificadores registrados, parte visible de la parcela ≥ 60 %, fecha de imagen posterior a la última aceptada por al menos `minInterval` (20 días), y no futura.
2. **Monte en pie** (`coverBps` ≥ umbral de la parcela, por defecto 9500): paga una cuota, repartida entre dueño y operador según `ownerShareBps`. Si el pozo no alcanza, paga lo que queda.
3. **Primera lectura mala:** la parcela pasa a "en revisión". No paga, no corta.
4. **Segunda lectura mala seguida:** la parcela queda "desmontada". Se cortan los pagos para siempre.
5. **Lectura buena estando en revisión:** vuelve a "en pie" y paga la cuota de ese mes.
6. **Al confirmarse el desmonte,** el saldo se divide según lo que eligió cada donante:
   - parte "devolución": cada donante la retira en proporción a su aporte;
   - parte "restauración": queda bloqueada en el contrato como fondo de restauración de esa parcela. Si pasa `restorationTimeout` sin usarse, esos donantes también pueden retirarla.
7. **Impugnación:** si `challengeWindow` > 0, el informe queda pendiente ese tiempo. El dueño, el operador o un donante de la parcela pueden impugnarlo, y entonces decide el curador. Si `challengeWindow` es 0, el informe se ejecuta en la misma transacción.
8. **Nadie gana plata por un desmonte:** el saldo nunca va al dueño ni al operador.

Parámetros del constructor: verificadores, quórum, `challengeWindow`, `minInterval`, `maxObsAge` (0 = sin límite), `restorationTimeout`.

En la demo se usa `challengeWindow = 0` y `maxObsAge = 0`, porque se repite el año 2025 en un minuto con imágenes históricas. En un producto real serían 72 horas y 45 días. Esto se dice abiertamente en el pitch.

### Firma de informes

- Digest: `keccak256(abi.encode(block.chainid, address(this), parcelId, tObs, coverBps, validBps, evidenceHash))`, con tipos `uint256, address, uint256, uint64, uint16, uint16, bytes32`.
- Cada verificador firma ese digest como mensaje (prefijo EIP-191, `personal_sign`).
- El contrato recibe las firmas **ordenadas por dirección de menor a mayor** y rechaza repetidas.
- La firma hecha en Python (`eth_account`) tiene que validar en el contrato. Probar esto primero en red local.

### Liberación del fondo de restauración (no implementar todavía)

Idea para el pitch: el fondo se libera por etapas a un restaurador distinto del dueño y del operador, cuando los verificadores firman que la vegetación se recupera. Para la hackatón alcanza con bloquear el fondo y el vencimiento.

## Verificación con Sentinel-2 (algoritmo bosque-v1)

- Datos: Sentinel-2 L2A desde Earth Search (`https://earth-search.aws.element84.com/v1`, colección `sentinel-2-l2a`, sin clave). Leer solo el recorte de la parcela con `rasterio` sobre los COG.
- Bandas: `red`, `nir`, `scl`. Aplicar escala y offset de reflectancia de cada asset.
- Pasos para una parcela y un mes:
  1. Elegir la imagen del mes con más superficie visible sobre la parcela.
  2. Píxeles válidos: SCL en {4, 5, 6, 7}.
  3. NDVI del mes y NDVI del mismo mes del año base (2024 para la demo).
  4. Monte del año base: NDVI base ≥ 0,45.
  5. Píxel perdido: era monte, bajó 0,25 o más y quedó en 0,35 o menos.
  6. Limpiar: apertura morfológica 3×3 y descartar manchas de menos de 100 píxeles (1 ha).
  7. `coverBps = 10000 × (1 − perdidos / monte base)`, `validBps = 10000 × válidos / total de la parcela`.
- Los umbrales son valores de partida. Se calibran hasta que la parcela A no dé lecturas malas en 12 meses y la B las dé desde el mes del desmonte. Después se congelan.
- Comparar siempre contra el mismo mes del año anterior: el monte chaqueño pierde hojas en invierno.
- La evidencia de cada informe (imagen usada, imagen base, versión del algoritmo, resultado) se guarda como JSON en el repo; `evidenceHash` es su keccak256.

Parcelas de la demo (las elige y dibuja Gino, como GeoJSON en `parcels/`): A, monte intacto en 2025; B, un desmonte real de 2025 en el Chaco salteño. No nombrar dueños reales ni opinar sobre la legalidad del desmonte. Los dueños y operadores de la demo son billeteras de prueba con nombres genéricos.

## Arquitectura

```
contracts/   BosqueEnPie.sol (un solo archivo, sin dependencias externas)
test/        pruebas del contrato
scripts/     deploy, registro de parcelas
oracle/      Python: cover.py (algoritmo), s2.py (lectura Sentinel-2), signing.py,
             make_report.py, relay.py, replay.py
parcels/     GeoJSON de las parcelas
reports/     informes firmados y evidencia, por parcela y mes
web/         página (Vite + viem + Leaflet)
```

- Contrato: Solidity 0.8.24, `evmVersion: "paris"`, Hardhat **2** (fijar la versión; Hardhat 3 cambia la configuración). Pruebas en JavaScript con ethers v6.
- Red: Fuji C-Chain, chain ID 43113, RPC `https://api.avax-test.network/ext/bc/C/rpc`. Explorer: `https://subnets-test.avax.network/c-chain` o `https://testnet.snowtrace.io`.
- Con `web3.py` en Avalanche: agregar el middleware de PoA (`ExtraDataToPOAMiddleware`) y usar `gasPrice` en las transacciones.
- Web: página estática que lee eventos del contrato. Pantallas: mapa con estado de cada parcela; parcela (imagen de cada mes, monte en pie, firmas, pagos, saldo, botón de aportar); mi aporte (con botón de recuperar); actividad (eventos con link al explorer). Interfaz en español.
- Billeteras del jurado: billeteras de prueba precargadas, cuya clave viaja en el fragmento de la URL de un QR. El jurado no instala nada y firma desde su celular. Solo claves de prueba sin valor.

## Orden de trabajo

Avisame al terminar cada paso y esperá mi visto bueno antes del siguiente.

1. **Contrato y pruebas.** Implementar las reglas 1 a 8 y dejar las pruebas pasando en red local. Cubrir: quórum, firmas repetidas o desordenadas, informe alterado, nubes, fechas, revisión y corte, división del saldo, impugnación, pozo insuficiente.
2. **Firma desde Python.** `oracle/signing.py` y una prueba contra un nodo local de Hardhat que demuestre que la firma de Python valida en el contrato.
3. **Despliegue en Fuji.** Scripts de deploy y registro. Decime qué necesitás de mí (claves, monedas de prueba). Guardar dirección y link del explorer en el README.
4. **Algoritmo.** `oracle/cover.py` con pruebas sobre matrices sintéticas, y `oracle/s2.py` probado contra Earth Search con una parcela real.
5. **Informes y envío.** `make_report.py`, `relay.py` y `replay.py` (envía los 12 meses de una parcela).
6. **Página web.**
7. **README** con cómo correr todo, la dirección del contrato, la atribución de datos y qué se hizo con IA.

## Si falta tiempo, se recorta en este orden

1. Certificados para empresas (ver abajo).
2. Fondo de restauración (queda solo la devolución).
3. Reparto dueño/operador (queda un solo cuidador).
4. Impugnación.
5. Imágenes de cada mes en la página.

No se recorta: contrato desplegado, un informe real firmado que pague una cuota, el corte por desmonte.

## Extra, solo si sobra tiempo: certificados

Para el cliente "empresa con metas ambientales": cada cuota pagada le da al donante un certificado transferible y retirable por las hectáreas-mes que financió (un token ERC-1155). **No es un bono de carbono y no se lo llama así:** es un "certificado de monte en pie".

## Reglas para trabajar

- Nunca subir claves al repo. Todo va en `.env`, que está en `.gitignore`. Crear `.env.example`.
- Solo red de prueba y claves de prueba. Nada con dinero real.
- Identificadores del código en inglés; comentarios, mensajes de error e interfaz en español.
- No inventar datos: las imágenes y los resultados de la demo tienen que ser reales. Si algo no se pudo calcular, decilo.
- Antes de decir que algo funciona, corrélo.
- Atribución obligatoria en el README y las slides: "Contiene datos Copernicus Sentinel modificados, 2024 y 2025".
- Commits chicos y con mensajes claros: somos 3 o 4 personas en el mismo repo.

## Respuestas para el pitch

- **¿Quién desconfía de quién?** El donante no conoce a quien cuida ni puede ir a ver el monte. Quien cuida no sabe si el donante va a seguir pagando.
- **¿Qué evento dispara algo?** Cada mes, la imagen satelital confirma o no que el monte sigue.
- **¿Qué pasa si el dato miente?** La imagen es pública y cualquiera rehace la cuenta. Firman dos de tres, hacen falta dos lecturas malas para cortar, y hay una ventana para impugnar. Límite: en la demo los tres verificadores son del equipo.
- **¿Quién paga o cobra?** Paga el donante, por adelantado. Cobran dueño y operador, una cuota fija por mes.
- **¿Por qué no una base de datos?** Una base guarda registros, no plata: haría falta una organización que la custodie, y las dos partes tendrían que confiar en ella.
