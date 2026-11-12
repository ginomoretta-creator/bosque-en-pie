"""Arma los mocks de design/: inserta el logotipo del Figma y genera una versión
con las imágenes incluidas (un solo archivo para mandar o abrir en el celular)."""
import base64, pathlib, re

DESIGN = pathlib.Path(__file__).parent

def logo_path():
    svg = (DESIGN / "assets/logo/logotipo-horizontal.svg").read_text(encoding="utf-8")
    return re.search(r'<path d="([^"]+)"', svg).group(1)

def inline_assets(html):
    def data(rel):
        p = DESIGN / rel
        mime = "image/jpeg" if p.suffix == ".jpg" else "image/png"
        return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()
    cache = {}
    return re.sub(r'(assets/[\w/.-]+\.(?:jpg|png))', lambda m: cache.setdefault(m.group(1), data(m.group(1))), html)

src = (DESIGN / "mock-v4.src.html").read_text(encoding="utf-8").replace("{{LOGO_PATH}}", logo_path())
(DESIGN / "mock-v4.html").write_text(src, encoding="utf-8")
(DESIGN / "mock-v4-standalone.html").write_text(inline_assets(src), encoding="utf-8")
for f in ("mock-v4.html", "mock-v4-standalone.html"):
    print(f, round((DESIGN / f).stat().st_size / 1024), "KB")
