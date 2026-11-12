# Web de Bosque en pie

Página estática (Vite + viem + Leaflet) que lee el contrato `BosqueEnPie`. Interfaz en español y marca v2 (`design/tokens-v2.css`, logo e íconos de `design/assets/`).

## Correr contra el nodo local (sin claves)

```bash
# en la raíz del repo
npm ci && npm run abi
npx hardhat node                                         # terminal 1
npm run local                                            # terminal 2: despliega, registra A y B, aportes de prueba
python -m oracle.replay B --informes reports-prueba      # opcional: informes de prueba
python -m oracle.replay A --informes reports-prueba

# en web/
npm install
npm run dev                                              # http://localhost:5173
```

La página se actualiza sola cuando entran bloques nuevos (cada 3 s en local, 6 s en Fuji).

## Contra Fuji

```bash
npm run dev:fuji          # o VITE_NETWORK=fuji npm run build
```

Necesita `deployments/fuji.json` (lo escribe `npm run fuji:deploy`). Si no está, la página lo dice.

## Variables

| Variable | Valores | Por defecto |
|---|---|---|
| `VITE_NETWORK` | `localhost` · `fuji` | `localhost` |
| `VITE_RPC_URL` | otro RPC | local: `http://<host>:8545`; Fuji: RPC público |

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/chain.js` | Lee `deployments/<red>.json` y el ABI; `store` con parcelas, eventos e informes aplicados; links al explorer |
| `src/router.js` | Rutas por hash: `#/`, `#/parcela/:id`, `#/actividad` |
| `src/wallet.js` | Saca la clave de prueba del QR (`#k=…`) antes de que arranque el router; `judgeKey()` |
| `src/ui.js` | Logo en línea, íconos, chip de estado, doce cuadros por mes |
| `src/pages/` | Inicio, Parcela y Actividad (carril 3) |
| `src/aportar/` | Aportar, Mi aporte y Certificados (carril 4): `index.js` registra las rutas |

Para sumar una pantalla: `route("/mi-ruta", (params, state) => html)` en `src/aportar/index.js`. Con `{ live: false }` no se repinta con cada bloque, así no se borra un formulario a medio completar.
