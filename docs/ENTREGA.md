# Entrega · paso a paso

**Cierre: viernes 13/11/2026 a las 13:00 (hora de Argentina), en Hacki.** Lo vimos en Hacki el 13/11 a las 11:08. El sitio de ayuda del track decía 09:00; manda Hacki, que es donde se entrega. Lo que se evalúa es lo que esté **enviado** en Hacki a esa hora.

- Hacki: https://hacki.crecimiento.build/h/competencia-argentina-space (track **Avalanche**)
- Al 13/11 a las 11:08, Bosque en pie todavía no estaba cargado.

---

## 1. Lo que pide el track, y dónde está

| Pide | Estado | Dónde |
|---|---|---|
| Contrato desplegado en Fuji, con link al explorer («sin contrato no hay entrega») | Listo, con código verificado | https://testnet.snowtrace.io/address/0x7eC244B5Baf9079AE21E721B1c507D493649b8c6 |
| Video de 1 a 3 minutos con una acción on-chain | **Falta grabarlo.** El guion y el estudio de grabación están listos. | Guion en [pitch-2min.md](pitch-2min.md) |
| Pitch de 5 a 7 diapositivas, con una de «por qué blockchain» | Listo: 7 diapositivas; «por qué blockchain» es la 5 | [pitch.pdf](pitch.pdf) |
| Repo o link del proyecto (opcional) | Listo | https://github.com/ginomoretta-creator/bosque-en-pie |
| Datos reales | Imágenes Sentinel-2 reales de 2024, 2025 y 2026 | `reports/`, [parcels/LEEME.md](../parcels/LEEME.md) |
| Atribución de las fuentes de datos | En el README, en las diapositivas y en el cierre del video | README, «Atribución y licencias» |
| Test de las 4 preguntas y «qué pasa si el dato miente» | Respondido | README, «Por qué blockchain»; diapositiva 5 |
| Un equipo, un solo track; una categoría principal | Track Avalanche. Categoría principal: **Geoespacial** (un dato del espacio decide un pago), cruzada con **RWA**. | — |

Los criterios del jurado tienen el mismo peso: impacto, creatividad, validez, justificación de blockchain y presentación.

---

## 2. El orden, contra el reloj

| Hasta | Qué | Quién |
|---|---|---|
| Ya mismo (10 min) | **Crear el proyecto en Hacki y dejarlo cargado sin el video** (punto 3). Si después no llega el video, hay algo cargado igual. | Quien tenga la cuenta |
| +40 min | Grabar la pantalla con Screen Studio, muda, siguiendo los tramos del guion. El envío en vivo (tramo 05) va al final y se hace una sola vez. | Quien graba |
| +15 min | Voz y cámara en el estudio de grabación. El video final se arma solo apenas están todos los tramos (unos 4 minutos). | Quien presenta |
| +10 min | Subir el video a YouTube como «No listado» (punto 4). | Cualquiera |
| **12:45 como máximo** | Pegar el link del video en Hacki y en el README, revisar (punto 6) y **enviar**. | Quien tenga la cuenta |

**Si a las 12:40 el video no está:** se envía igual con todo lo demás. Un video más simple también vale: el corte de Screen Studio con la voz grabada en el mismo Screen Studio. Lo que no puede faltar es la acción en el contrato vista en Snowtrace.

---

## 3. Hacki: qué cargar (textos para copiar)

En Hacki: **Mis proyectos → Nuevo proyecto → «Bosque en pie» → Crear proyecto.** Queda como borrador hasta que se envía.

**Nombre:** Bosque en pie

**Track:** Avalanche

**Frase corta:**

> Pago por conservar monte nativo: cada mes que Sentinel-2 confirma que la parcela sigue en pie, un contrato en Avalanche le paga al dueño y a quien la cuida.

**Descripción:**

> En Salta se desmontaron más de 20.000 hectáreas de monte nativo entre enero y septiembre de 2026, y la Ley de Bosques pagó en 2025 unos 4 centavos de dólar por hectárea: 155 veces menos de lo que manda. Hoy desmontar paga y cuidar no.
>
> Bosque en pie da vuelta esa cuenta. Una empresa deja AVAX por adelantado en un contrato, para una parcela. Cada mes, una imagen Sentinel-2 compara la parcela con el mismo mes del año anterior; si el monte sigue, dos de tres verificadores firman el informe y el contrato paga solo: 60 % al dueño y 40 % al operador que la cuida. La primera lectura mala pone la parcela en revisión; la segunda corta los pagos, y el saldo vuelve a la empresa o queda para restaurar. La empresa recibe un certificado por cada hectárea-mes en pie.
>
> La demo corre en Avalanche Fuji con dos parcelas reales del Chaco salteño: una cobró los 12 meses de 2025; la otra se desmontó en agosto y el contrato cortó en septiembre. En el video mandamos en vivo el informe de noviembre de 2026. Las imágenes, el cálculo y el contrato son reales; las billeteras y los montos, de prueba.
>
> Por qué blockchain: el que pone la plata no conoce al que cuida, y el que cuida no sabe si le van a seguir pagando. El contrato guarda la plata y cumple las reglas solo, y la imagen es pública: cualquiera rehace la cuenta.
>
> Contiene datos Copernicus Sentinel modificados, 2024, 2025 y 2026.

**Links:**

| Qué | Link |
|---|---|
| Repo | https://github.com/ginomoretta-creator/bosque-en-pie |
| Demo (web) | https://ginomoretta-creator.github.io/bosque-en-pie/ |
| Contrato en el explorer | https://testnet.snowtrace.io/address/0x7eC244B5Baf9079AE21E721B1c507D493649b8c6 |
| Pitch (PDF) | https://github.com/ginomoretta-creator/bosque-en-pie/blob/main/docs/pitch.pdf |
| Video | el de YouTube (punto 4) |

**Equipo:** AMOCBA. Sumar a los cuatro integrantes al proyecto. Si Hacki pide invitarlos, cada uno necesita su cuenta en Hacki. Revisar que figuren los cuatro antes de enviar.

**Nunca se carga ni se comparte** el deck «para proyectar» ni la hoja de QR del jurado: tienen claves de prueba.

---

## 4. Subir el video

1. YouTube → **Crear → Subir video** → `video-final.mp4`.
2. Título: `Bosque en pie · Competencia Argentina Space · Track Avalanche`.
3. Descripción: la frase corta de arriba, los links del contrato, la web y el repo, y la atribución de Copernicus.
4. «¿Es contenido para niños?» → No.
5. Visibilidad: **No listado** → Guardar → copiar el link.
6. Abrir el link en una ventana de incógnito y mirar que se reproduzca entero.

Alternativa: Google Drive, con «Cualquier persona con el enlace» puede ver.

---

## 5. El link del video en el README

En GitHub, abrir `README.md` → lápiz (editar). En la sección «Entrega», cambiar la fila del video por el link de YouTube. Después, **Commit changes** en `main`.

---

## 6. Antes de apretar «Enviar» (5 minutos)

- [ ] Los cinco links abren en una ventana de incógnito: el video, la web, Snowtrace, el PDF y el repo.
- [ ] En Snowtrace, la dirección del contrato muestra la transacción del informe de noviembre.
- [ ] La web muestra noviembre pagado en la parcela A.
- [ ] En el README de `main` figuran el link del video, el equipo AMOCBA y los cuatro integrantes.
- [ ] Hacki: track Avalanche, equipo AMOCBA, los cuatro integrantes, la descripción y los cinco links.
- [ ] Nada con claves en lo cargado: ni el deck para proyectar, ni la hoja de QR, ni el `.env`.

Después de enviar, abrir la página de BUIDLs de Hacki y confirmar que aparece Bosque en pie en el track Avalanche.

---

## 7. Si algo sale mal

- **El envío del informe falla:** revisar que `FUJI_RPC_URL` apunte a `https://avalanche-fuji-c-chain-rpc.publicnode.com` y volver a probar. Antes de reintentar, mirar en Snowtrace si la transacción ya entró: el contrato acepta ese informe una sola vez.
- **El estudio no ve la cámara:** en Chrome, el candado al lado de la dirección → permitir cámara y micrófono → recargar.
- **El estudio dice que faltan tramos:** tocar el tramo en la tira de abajo y grabarlo desde ahí.
- **No hay tiempo para el estudio:** exportar el corte de Screen Studio con la voz grabada ahí mismo y subir ese.
