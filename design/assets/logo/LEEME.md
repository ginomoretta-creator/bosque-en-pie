# Bosque en pie: logotipo

El signo es una **«b» minúscula**. El asta tiene el canto superior en bisel. Encima va un brote verde separado del asta por un corte paralelo al bisel. La panza de la b es un círculo y en el hueco hay una **hoja verde**, cruzada por su nervadura en el color de la tinta. El nombre va en minúsculas, en Geist ExtraBold con espaciado −4,5 %. «bosque» va en tinta y «en pie» en verde.

Todas las piezas salen de la página «v2 · Propuesta» de Figma: el horizontal es el mismo del encabezado de E01. Las letras ya están pasadas a trazos, así que no hace falta tener Geist instalado para verlas.

## Archivos

| Archivo | Qué es | Cuándo se usa |
|---|---|---|
| `horizontal.svg` | Signo y nombre en una línea. | Encabezados de escritorio, tablet y pantalla grande. **Desde 120 px de ancho.** |
| `apilado.svg` | Signo a la izquierda y el nombre en dos renglones («bosque» arriba, «en pie» abajo). | Portadas, láminas, espacios cuadrados. **Desde 96 px de ancho.** |
| `signo.svg` | La «b» sola en un lienzo de 400 × 400. | Encabezado del celular, avatar, sellos. **Desde 20 px.** |
| `*-dia.svg` / `*-noche.svg` | Las mismas tres piezas con los colores fijos de Día (tinta `#121410`, verde `#2E7D4F`) y de Noche (tinta `#ECEAE3`, verde `#6CC58A`). | Cuando el SVG va como `<img>` y no puede heredar el color, y para documentos y redes. |
| `*-una-tinta.svg` | Todo en `currentColor`, también el verde. | Sellos, grabado, impresión a un color. |
| `favicon.svg`, `favicon-16/32/48.png` | El signo en papel y verde claro sobre un cuadrado tinta con esquinas redondeadas. | Pestaña del navegador. |
| `icono-app.svg`, `icono-app-1024/512/180.png` | Lo mismo, pero sobre un cuadrado lleno, sin redondear (iOS y Android redondean solos). | Ícono de app y `apple-touch-icon` (180). |

Ningún SVG tiene `<text>`, `<style>` ni `style=`.

## Cómo se colorea

Los SVG sin sufijo usan dos colores:

```html
<path fill="currentColor" …/>                         <!-- asta, panza, nervadura y «bosque» -->
<path data-parte="verde" fill="#2E7D4F" …/>           <!-- brote, hoja y «en pie» -->
```

- **Tinta:** hereda el color del texto (`currentColor`). Va en tinta sobre papel y en papel sobre tinta.
- **Verde:** en la web se pisa con CSS para que siga el tema:
  ```css
  .logo [data-parte="verde"] { fill: var(--v2-verde-logo); }
  ```
  Es `#2E7D4F` en Día y `#6CC58A` en Noche (`design/tokens-v2.css`).
- `currentColor` solo funciona con el SVG **en línea** (pegado en el HTML o como componente). Con `<img>` usá `-dia.svg` o `-noche.svg`.
- **Sobre la portada oscura** (la franja tinta del inicio en Día) va la versión de Noche: tinta clara y verde claro.
- **Sobre imagen satelital**, siempre sobre una placa tinta al 85 %, nunca directo sobre la foto.

## Área de respeto y tamaños

- **Respeto: el ancho del asta**, medido desde la tinta, por los cuatro lados. Los `viewBox` de `horizontal.svg` y `apilado.svg` ya lo traen: pegalos sin sumar margen.
- El `signo.svg` trae 20 unidades de aire (de 400) arriba y abajo. Si va junto a otro elemento, dejá además medio ancho de asta.
- Mínimos: horizontal 120 px de ancho (letra de unos 15 px); apilado 96 px; signo 20 px. A 16 px (favicon) la hoja se ve como un punto verde dentro de la panza: está bien, se sigue leyendo «b».
- En el celular, el horizontal va solo en la entrada (C01, a 159 px de ancho); las demás pantallas abren con la barra de volver y no repiten el logo. En escritorio, tablet y pantalla grande, el encabezado lleva el horizontal.

## Usos incorrectos

1. Escribir el nombre con texto vivo. Usá siempre los SVG.
2. Cambiar el verde por otro color de estado (ámbar, terracota) o pintar «bosque» de verde.
3. Pegar el brote al asta o borrar el corte: sin el corte, el brote se lee como una mancha.
4. Rotar la hoja, sacarle la nervadura o rellenar el hueco de la panza.
5. Sumarle sombra, contorno o degradé, o estirarlo.

## Regenerar

Las piezas salen de un único juego de trazos. Si cambia el signo, se exportan de nuevo desde Figma (frame «Logo · horizontal» de E01). Los PNG se exportan así:

```bash
for s in 1024 512 180; do rsvg-convert -w $s -h $s icono-app.svg -o icono-app-$s.png; done
for s in 16 32 48; do rsvg-convert -w $s -h $s favicon.svg -o favicon-$s.png; done
```

Geist y Geist Mono tienen licencia OFL (google/fonts, `ofl/geist` y `ofl/geistmono`).
