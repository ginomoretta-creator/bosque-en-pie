# Bosque en pie

Pago por conservar monte, verificado por satélite. Un donante deja AVAX bloqueado en un contrato en Avalanche; cada mes que una imagen Sentinel-2 confirma que la parcela sigue en pie, el contrato paga una cuota a quienes la cuidan. Si aparece un desmonte, los pagos se cortan.

Proyecto para la Competencia Argentina Space (Salta), track Avalanche.

> En construcción. El plan de trabajo está en las [issues](../../issues) y los [milestones](../../milestones). El contexto completo del proyecto está en [CLAUDE.md](CLAUDE.md).

## Contrato

- Red: Avalanche Fuji C-Chain (chain ID 43113)
- Dirección: _pendiente_
- Explorer: _pendiente_

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
