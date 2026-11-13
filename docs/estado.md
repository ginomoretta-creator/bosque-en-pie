# Estado del proyecto · viernes 13/11/2026

Resumen para el equipo. Cierre: **viernes 13/11** (confirmar la hora en la página de la competencia: `CLAUDE.md` dice 09:00). Repo: https://github.com/ginomoretta-creator/bosque-en-pie · El contexto completo está en `CLAUDE.md`.

## La idea en una línea

Bosque en pie paga cada mes que el monte sigue en pie: el satélite es el testigo y un contrato en Avalanche paga.

## Lo que está andando

| Pieza | Estado | Dónde verlo |
|---|---|---|
| Contrato | ✅ Desplegado en Fuji, código verificado en el explorer | `0x5A963552011bDA9EB20305f7EfdE3F7E932801be` · https://testnet.snowtrace.io/address/0x5A963552011bDA9EB20305f7EfdE3F7E932801be |
| Pruebas | ✅ CI verde en `main` (contrato con Hardhat, oráculo con pytest, build de la web) | pestaña *Actions* |
| Oráculo | ✅ bosque-v1 sobre Sentinel-2 L2A (Earth Search), firma 2 de 3, envío y repetición del año | `oracle/` |
| Informes | ✅ 2025 completo de A y B aplicado en el contrato; noviembre 2026 de A listo para enviar en vivo (sin firmar) | `reports/A`, `reports/B` |
| Web | ✅ Publicada; lee el contrato por RPC publicnode (el oficial queda de respaldo) | https://ginomoretta-creator.github.io/bosque-en-pie/ |
| QR del jurado | ✅ 5 billeteras con 0,03 AVAX de prueba cada una; flujo probado de punta a punta en la web publicada | hoja local `jurado/hoja-qr-fuji.html` (no se sube) |
| Certificados | ✅ ERC-1155, 1 unidad = 1 hectárea-mes; acuñar, transferir y retirar desde la web | pantalla *Certificados* |

## Qué muestra la demo

- **Parcela A (101 ha):** en pie todo 2025. 11 de 12 cuotas pagadas; marzo sin informe por nubes (menos de 60 % visible).
- **Parcela B (84 ha):** en pie hasta julio, en revisión en agosto (86,3 %), desmontada en septiembre (1,4 %). Pagos cortados desde ahí; el saldo vuelve a los donantes o queda para restaurar, según lo que eligió cada uno.
- **Evidencia:** cada informe muestra la imagen, las firmas y el keccak256 de `evidence.json` calculado en el navegador, que coincide con el que guarda el contrato.
- **Acción en vivo:** aportar con una billetera del QR y ver la transacción en Snowtrace. Opcional: enviar el informe de noviembre 2026 de A.

## Decisiones vigentes

- **Cliente:** una empresa con metas ambientales (sin nombrar empresas reales). En el código el rol es «donante».
- **Pago:** por adelantado; el contrato paga una cuota por cada informe verificado al dueño (60 %) y al operador (40 %).
- **Certificado de monte en pie:** cuenta hectáreas-mes, no carbono. Nunca llamarlo «bono».
- **Carbono:** solo como estimación informativa en `reports/*/*/carbono.json`, con la etiqueta «SIMULACIÓN · no validado». No se muestra en la web.
- **Parámetros de la demo:** `challengeWindow = 0`, `maxObsAge = 0`, `commitEnd = 0`; los tres verificadores son del equipo. Se dice en el pitch.

## Pendiente y quién

- **Decidir cuándo se usa el informe de noviembre 2026 de A.** Se puede enviar una sola vez: el contrato exige 20 días entre imágenes (`minInterval`). Si el pitch es en vivo, guardarlo para ahí. Para enviarlo, `FUJI_RPC_URL` tiene que apuntar a publicnode.
- **Ensayo de punta a punta** (#40).
- **Video de 1 a 3 minutos** (#33): la base del guion está en `docs/pitch-2min.md`; la acción en el contrato tiene que verse en Snowtrace.
- **Slides:** pasar `docs/slides.md` a 6 diapositivas, con la de «por qué blockchain».
- **Entregar en la competencia** (#34): link al contrato en el explorer, video, slides y repo.

## Notas

- Las claves privadas están solo en el `.env` local; nunca en el repo, las issues ni el grupo.
- El texto de atribución dentro de `reports/A/2026-11/evidence.json` dice «2024 y 2025»: no se toca, porque ese archivo es lo que se firma y su hash va al contrato.
- Atribución obligatoria en README y slides: «Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026».
