# Bosque en pie

[![CI](https://github.com/ginomoretta-creator/bosque-en-pie/actions/workflows/ci.yml/badge.svg)](https://github.com/ginomoretta-creator/bosque-en-pie/actions/workflows/ci.yml)

Pago por conservar monte, verificado por satélite: un donante deja AVAX bloqueado en un contrato en Avalanche, y cada mes que una imagen Sentinel-2 confirma que la parcela sigue en pie, el contrato paga una cuota a quienes la cuidan. Si aparece un desmonte, los pagos se cortan y el saldo vuelve al donante o queda para restaurar. Nadie gana con un desmonte.

Proyecto para la Competencia Argentina Space (Salta), track Avalanche. El contexto completo está en [CLAUDE.md](CLAUDE.md) y el guion del pitch en [docs/pitch-2min.md](docs/pitch-2min.md).

## Entrega

Competencia Argentina Space (Salta, 11 al 13 de noviembre de 2026), track **Avalanche**. Categoría principal: Geoespacial (un dato del espacio decide un pago), cruzada con RWA.

| | |
|---|---|
| Video de la demo (2:50) | Se publica antes del cierre del 13/11 |
| Contrato en Fuji (código verificado) | [0x7eC244B5Baf9079AE21E721B1c507D493649b8c6](https://testnet.snowtrace.io/address/0x7eC244B5Baf9079AE21E721B1c507D493649b8c6) |
| Web de la demo | https://ginomoretta-creator.github.io/bosque-en-pie/ |
| Pitch (7 diapositivas) | [docs/pitch.pdf](docs/pitch.pdf) |
| Guion del video y del pitch | [docs/pitch-2min.md](docs/pitch-2min.md) |

**Equipo AMOCBA:** Gino Luciano Moretta, Valentino Galfré y Valentino Donayo.

El paso a paso de la entrega está en [docs/ENTREGA.md](docs/ENTREGA.md).

## La idea

En Salta se desmontaron más de 20.000 hectáreas de monte nativo entre enero y septiembre de 2026 (relevamiento satelital de Greenpeace), y el fondo de la Ley de Bosques para pagarle a quien conserva nunca se integró completo. Bosque en pie da vuelta esa cuenta:

1. Una **empresa con metas ambientales** deja AVAX por adelantado en el contrato, para una parcela y un plazo de compromiso. Al aportar elige qué pasa con su saldo si hay desmonte: devolución o fondo de restauración.
2. Cada mes, una imagen **Sentinel-2** compara la parcela con el mismo mes del año anterior. Tres verificadores firman el informe; alcanza con dos.
3. Si el monte sigue en pie, el contrato paga la cuota al **dueño** (por no desmontar) y al **operador** (cortafuegos, vigilancia). La empresa recibe un **certificado de monte en pie** por las hectáreas-mes financiadas.
4. Si aparece un desmonte, dos lecturas malas seguidas cortan los pagos para siempre.

## Arquitectura

```
contracts/   BosqueEnPie.sol: un solo archivo, Solidity 0.8.24, evmVersion "paris", sin dependencias externas
test/        pruebas del contrato (Hardhat 2 + ethers v6)
scripts/     deploy, registro de parcelas, aportes de demo, billeteras del jurado
oracle/      Python: cover.py (algoritmo bosque-v1), s2.py (lectura Sentinel-2), signing.py (firma EIP-191),
             make_report.py (informes mensuales), relay.py (envío), replay.py (repetir 2025 en un minuto)
parcels/     GeoJSON y registro de las parcelas
reports/     informes firmados y evidencia, por parcela y mes
deployments/ ABI del contrato y direcciones de prueba
web/         página (Vite + viem + Leaflet): mapa, parcela, mi aporte, actividad
design/      mocks de interfaz y tokens
docs/        pitch, backlog y estado del proyecto
```

- El oráculo lee Sentinel-2 L2A desde [Earth Search](https://earth-search.aws.element84.com/v1) (colección `sentinel-2-l2a`, sin clave) y compara cada mes con el mismo mes del año base 2024.
- Digest del informe: `keccak256(abi.encode(block.chainid, address(this), parcelId, tObs, coverBps, validBps, evidenceHash))`, firmado con `personal_sign` por al menos 2 de 3 verificadores, con firmas ordenadas por dirección.
- La evidencia de cada informe (imagen usada, imagen base, versión del algoritmo, resultado) queda en `reports/` y su keccak256 es el `evidenceHash` que valida el contrato.
- Cada informe lleva además una **estimación de carbono** (t CO₂e que siguen en pie), calculada con factores públicos citados. Se muestra siempre con la etiqueta **"SIMULACIÓN · no validado"**: es un dato informativo, no un bono de carbono.

## Cómo correr todo en local

Requisitos: Node 20 y Python 3.12.

```bash
npm ci
python3.12 -m venv .venv && .venv/bin/pip install -r oracle/requirements.txt
```

Pruebas:

```bash
npx hardhat compile
npx hardhat test          # pruebas del contrato
pytest oracle/tests       # incluye que la firma de Python valide en el contrato
pytest -m network         # opcional: las que leen Earth Search (internet)
```

Demo completa contra el nodo local:

```bash
npx hardhat node          # en una terminal, queda corriendo
npm run local             # en otra: despliega, registra las parcelas y hace los aportes de demo
.venv/bin/python -m oracle.replay B --red localhost     # repite 2025: se ven los pagos, la revisión y el corte
```

Generar informes nuevos desde las imágenes reales (necesita internet; `--sign` firma con las claves de `.env` para la red indicada):

```bash
.venv/bin/python -m oracle.make_report A --year 2025
.venv/bin/python -m oracle.make_report B --year 2025 --sign localhost
```

Despliegue en Fuji con claves de prueba en `.env` (ver `.env.example`; las claves nunca van al repo):

```bash
npx hardhat run scripts/deploy.js --network fuji
npx hardhat run scripts/register-parcels.js --network fuji
```

## Contrato en Fuji

- Red: Avalanche Fuji C-Chain (chain ID 43113)
- Dirección: `0x7eC244B5Baf9079AE21E721B1c507D493649b8c6`
- Explorer (código verificado): https://testnet.snowtrace.io/address/0x7eC244B5Baf9079AE21E721B1c507D493649b8c6
- Transacción de despliegue: https://testnet.snowtrace.io/tx/0xc18ff434e4f91bbcb1b288d86d21c5e624775e3602e25d3a3acda4b3c9f0eb8d (bloque 61003927)
- Web de la demo: https://ginomoretta-creator.github.io/bosque-en-pie/
- RPC: `https://avalanche-fuji-c-chain-rpc.publicnode.com` (el RPC oficial de Fuji corta con error 1015 cuando recibe muchas consultas; queda como respaldo)
- Datos completos del despliegue: [deployments/fuji.json](deployments/fuji.json)

## Parámetros de la demo y su valor en producción

La demo repite el año 2025 en un minuto con imágenes históricas reales, así que los tiempos van en cero. En producción serían:

| Parámetro | Demo | Producción |
|---|---|---|
| `challengeWindow` (ventana para impugnar un informe) | 0 | 72 horas |
| `maxObsAge` (edad máxima de la imagen) | 0 | 45 días |
| `commitEnd` (plazo del compromiso) | 0 | 24 meses |

Esto se dice abiertamente en el pitch: en la demo los tres verificadores son del equipo y no hay ventana de impugnación; en producción serían verificadores independientes.

## Las parcelas reales

Dos parcelas de monte nativo del Chaco salteño (departamento Rivadavia, tile Sentinel-2 **20KNA**), a ~1,5 km una de la otra. Mismo monte, mismo clima, dos destinos distintos en 2025. Los dueños y operadores son billeteras de prueba: no se nombra a nadie ni se opina sobre la legalidad del desmonte.

- **A (101 ha):** monte que siguió en pie todo el año. Cobró las 12 cuotas de 2025.
- **B (84 ha):** intacta hasta julio; desmontada entre mediados de julio y el 15/09. Cobró 7 cuotas (enero a julio), entró en revisión en agosto (48,7 % en pie el 16/08) y el contrato cortó en septiembre (1,4 %).

Cada mes se usa la imagen que deja ver al menos el 60 % de la parcela y está más cerca del día 15 (no la más limpia del mes): así una imagen de fin de mes no deja al mes siguiente sin imágenes posibles por la regla de 20 días entre informes. Con esa regla, 2025 tiene informe los doce meses en las dos parcelas. La selección, la calibración del algoritmo bosque-v1 y la serie mensual completa están en [parcels/LEEME.md](parcels/LEEME.md); los informes y la evidencia de cada mes están en `reports/`.

## Por qué blockchain

Respuestas cortas para el pitch (contexto completo en CLAUDE.md):

- **¿Quién desconfía de quién?** El donante no conoce a quien cuida ni puede ir a ver el monte. Quien cuida no sabe si el donante va a seguir pagando.
- **¿Qué evento dispara algo?** Cada mes, la imagen satelital confirma o no que el monte sigue.
- **¿Qué pasa si el dato miente?** La imagen es pública y cualquiera rehace la cuenta. Firman dos de tres, hacen falta dos lecturas malas para cortar, y hay una ventana para impugnar.
- **¿Quién paga o cobra?** Paga el donante, por adelantado. Cobran dueño y operador, una cuota fija por mes.
- **¿Por qué no una base de datos?** Una base guarda registros, no plata: haría falta una organización que la custodie, y las dos partes tendrían que confiar en ella.

## Qué se hizo con IA

El proyecto se construyó con asistentes de IA: **Claude Code** y **Devin**. La lógica del contrato, el oráculo, las pruebas y este documento se escribieron con su ayuda; las imágenes, los resultados y los datos de las parcelas son reales y verificables desde el repo.

## Atribución y licencias

- Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026.
- Máscara de árboles: ESA WorldCover 2021, licencia [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Código: MIT (ver `package.json`).

## Estado

Contrato desplegado en Fuji, web publicada y pitch listo; entrega del viernes 13/11/2026 a las 13:00 (Argentina), en Hacki. El resumen del estado está en [docs/estado.md](docs/estado.md) y el plan de trabajo en las [issues](../../issues).
