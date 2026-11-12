# Íconos de la marca

Doce íconos propios que reemplazan a los emoji 3D del mock v4. Están dibujados con las mismas piezas que el logo de la «b»: bloques planos, canto en bisel, la hoja con nervadura y el sello ■■□. Sin degradés ni sombras.

| Archivo | Dónde va |
|---|---|
| `tree.svg` | Monte en pie, botón de la portada, «el monte paga» |
| `sprout.svg` | Restauración |
| `stump.svg` | Desmonte |
| `axe.svg` | Corte de pagos |
| `satellite.svg` | Lectura satelital, «en revisión» |
| `coins.svg` / `coin.svg` | Aporte, saldo |
| `medal.svg` | Certificados de monte en pie |
| `sigs.svg` | Firmas de verificadores (2 de 3) |
| `warn.svg` | Aviso de lectura mala |
| `shield.svg` | «No es un bono de carbono» |
| `pin.svg` | Parcela en el mapa |

## Cómo se colorean

Todos tienen `viewBox="0 0 48 48"`. La tinta es `currentColor`; los acentos leen variables con un valor de Día por defecto:

```css
--ic-v: #2E7D4F;  /* verde */
--ic-t: #C2532F;  /* terracota */
--ic-a: #D99A1E;  /* ámbar */
```

Sobre fondo oscuro se pasan a los tonos claros: `--ic-v:#6CC58A; --ic-t:#E58A66; --ic-a:#E2B04A`.

`build-mocks.py` los mete como `<symbol id="ic-<nombre>">` y el mock los usa con `<use href="#ic-<nombre>">` cuando `<html data-marca="v2">`. Sin `data-marca`, el mock vuelve a los emoji.

Tamaño mínimo: 24 px.
