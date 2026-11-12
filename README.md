# Bosque en pie

Pago por conservar monte, verificado por satélite. Un donante deja AVAX bloqueado en un contrato en Avalanche; cada mes que una imagen Sentinel-2 confirma que la parcela sigue en pie, el contrato paga una cuota a quienes la cuidan. Si aparece un desmonte, los pagos se cortan.

Proyecto para la Competencia Argentina Space (Salta), track Avalanche.

> **En una línea:** Bosque en pie paga cada mes que el monte sigue en pie: el satélite es el testigo y un contrato en Avalanche paga.

## La idea

En Salta se desmontaron más de 20.000 hectáreas de monte nativo entre enero y septiembre de 2026, y el fondo de la Ley de Bosques para pagarle a quien conserva nunca se integró completo. Bosque en pie da vuelta esa cuenta:

1. Una **empresa con metas ambientales** (por ejemplo, una minera de la región) deja AVAX por adelantado en un contrato, para una parcela y por un plazo de compromiso.
2. Cada mes, una imagen **Sentinel-2** compara la parcela con el mismo mes del año anterior. Tres verificadores firman el informe; alcanza con dos.
3. Si el monte sigue en pie, el contrato paga una cuota al **dueño** (por no desmontar) y al **operador** (cortafuegos, vigilancia), y la empresa recibe un **certificado de monte en pie** por las hectáreas-mes financiadas.
4. Si aparece un desmonte, dos lecturas malas seguidas cortan los pagos para siempre. El saldo vuelve a la empresa o queda para restaurar. Nadie gana con un desmonte.
5. La plata y los certificados quedan **bloqueados durante el compromiso**: si desmontan antes, los certificados no sirven.

Cada parcela muestra además un **bono de carbono simulado**: las toneladas de CO₂e que siguen en pie, estimadas con factores públicos. Es una simulación para la demo y no está validada por ningún organismo.

Guion del pitch: [docs/pitch-2min.md](docs/pitch-2min.md).

> En construcción. El plan de trabajo está en las [issues](../../issues) y los [milestones](../../milestones). El contexto completo del proyecto está en [CLAUDE.md](CLAUDE.md).

## Contrato

- Red: Avalanche Fuji C-Chain (chain ID 43113)
- Dirección: _pendiente_
- Explorer: _pendiente_

## Cómo correr

Requisitos: Node 18 o más nuevo y Python 3.11 o más nuevo.

```bash
npm install
npx hardhat test                      # 34 pruebas del contrato
python -m venv .venv
.venv/Scripts/pip install -r oracle/requirements.txt   # en Linux/Mac: .venv/bin/pip
.venv/Scripts/python -m pytest oracle/tests            # la firma de Python valida en el contrato
```

Despliegue en Fuji (claves de prueba en `.env`, ver `.env.example`):

```bash
npx hardhat run scripts/deploy.js --network fuji
npx hardhat run scripts/register-parcels.js --network fuji   # requiere hectáreas en parcels/registry.json
```

## Estructura

```
contracts/   BosqueEnPie.sol
test/        pruebas del contrato
scripts/     deploy, registro de parcelas
oracle/      Python: algoritmo, lectura Sentinel-2, firma y envío de informes
parcels/     GeoJSON de las parcelas
reports/     informes firmados y evidencia
web/         página (Vite + viem + Leaflet)
design/      mocks de interfaz
```

## Atribución

Contiene datos Copernicus Sentinel modificados, 2024 y 2025.
