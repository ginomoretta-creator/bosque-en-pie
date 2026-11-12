"""Arma los mocks de design/: inserta el logotipo del Figma y genera una versión
con las imágenes incluidas (un solo archivo para mandar o abrir en el celular)."""
import base64, pathlib, re

DESIGN = pathlib.Path(__file__).parent

def logo_symbol(name, sid):
    """Convierte assets/logo/<name>.svg en un <symbol>: la tinta queda en currentColor
    y lo verde (data-parte="verde") pasa a var(--logo-sq), que cada fondo puede cambiar."""
    svg = (DESIGN / f"assets/logo/{name}.svg").read_text(encoding="utf-8")
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
    inner = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    inner = re.sub(r'fill="#2E7D4F" data-parte="verde"', 'fill="var(--logo-sq,#2E7D4F)"', inner)
    return vb, f'<symbol id="{sid}" viewBox="{vb}">{inner}</symbol>'

def logo_symbols():
    vb_h, h = logo_symbol("horizontal", "logo-h")
    _, s = logo_symbol("signo", "logo-s")
    return vb_h, f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{h}{s}</svg>'

def inline_assets(html):
    def data(rel):
        p = DESIGN / rel
        mime = "image/jpeg" if p.suffix == ".jpg" else "image/png"
        return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
    cache = {}
    return re.sub(r'(assets/[\w/.-]+\.(?:jpg|png))', lambda m: cache.setdefault(m.group(1), data(m.group(1))), html)

vb_h, symbols = logo_symbols()
src = (DESIGN / "mock-v4.src.html").read_text(encoding="utf-8").replace("{{LOGO_SIMBOLOS}}", symbols).replace("{{LOGO_H_VB}}", vb_h)
(DESIGN / "mock-v4.html").write_text(src, encoding="utf-8")
(DESIGN / "mock-v4-standalone.html").write_text(inline_assets(src), encoding="utf-8")
for f in ("mock-v4.html", "mock-v4-standalone.html"):
    print(f, round((DESIGN / f).stat().st_size / 1024), "KB")
