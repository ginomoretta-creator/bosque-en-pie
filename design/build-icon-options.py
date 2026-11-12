"""Genera design/icon-options.html: cuatro estilos de íconos comparados (archivo único)."""
import base64, pathlib, re

D = pathlib.Path(__file__).parent


def b64(path, mime):
    return f"data:{mime};base64," + base64.b64encode((D / path).read_bytes()).decode()


def lucide(name, size=26):
    svg = (D / f"assets/lucide/{name}.svg").read_text(encoding="utf-8")
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    return re.sub(r'width="24"\s+height="24"', f'width="{size}" height="{size}"', svg, count=1)


KEYS = [("tree", "trees", "Monte en pie"), ("satellite", "satellite", "Satélite"), ("moneybag", "hand-coins", "Pozo"),
        ("seedling", "sprout", "Restauración"), ("medal", "award", "Certificados"), ("axe", "axe", "Desmonte")]
LUCIDE = {k: l for k, l, _ in KEYS}
LUCIDE.update({"warning": "triangle-alert", "shield": "shield-check"})


def icon(style, key, size):
    if style == "3d":
        return f'<img src="{b64(f"assets/emoji/{key}.png", "image/png")}" style="width:{size}px;height:{size}px;filter:drop-shadow(0 8px 10px #0b2a1a33)" alt="">'
    if style == "color":
        return f'<img src="{b64(f"assets/emoji-color/{key}.svg", "image/svg+xml")}" style="width:{size}px;height:{size}px" alt="">'
    if style == "flat":
        return f'<img src="{b64(f"assets/emoji-flat/{key}.svg", "image/svg+xml")}" style="width:{size}px;height:{size}px" alt="">'
    return f'<span class="badge" style="width:{size}px;height:{size}px">{lucide(LUCIDE[key], int(size * .5))}</span>'


STYLES = [
    ("3d", "A · Emoji 3D, en pocos lugares", "El que te gustó, pero solo en tres lugares: la tarjeta de la parcela, los avisos y los pasos de cómo funciona.", "Más cálido y memorable · pesa más (PNG)"),
    ("color", "B · Emoji a color plano", "Los mismos emojis de Fluent en versión vectorial con degradé suave. Más livianos y nítidos en cualquier tamaño.", "Amable pero más sobrio · liviano (SVG)"),
    ("flat", "C · Emoji plano", "Versión plana, sin degradé, como ilustración editorial. Combina con la tipografía grande.", "El más limpio de los emojis · liviano (SVG)"),
    ("line", "D · Línea en plaquita", "Íconos de línea Lucide (los que ya usa el Figma) dentro de una plaquita lima o verde. Lo más de producto serio.", "El más profesional · menos personalidad"),
]

cols = []
for st, title, desc, tag in STYLES:
    row = "".join(f'<div class="ic">{icon(st, k, 44)}<span>{lbl}</span></div>' for k, _, lbl in KEYS)
    hero_icon = icon(st, "tree", 64 if st == "line" else 84)
    steps = "".join(f'<div class="st">{icon(st, k, 34)}<span>{t}</span></div>'
                    for k, t in [("moneybag", "Aportás"), ("satellite", "El satélite mira"), ("tree", "Paga o corta")])
    cols.append(f"""
<section class="opt">
  <h2>{title}</h2><p class="desc">{desc}</p><p class="tag">{tag}</p>
  <div class="row">{row}</div>
  <div class="phone">
    <div class="hcard"><div><span class="pill">● En pie</span><div class="big">99,3<small>%</small></div><div class="sub">del monte de 2024 sigue en pie</div></div><div class="hi">{hero_icon}</div></div>
    <div class="notice">{icon(st, "axe", 40)}<div><b>Dos lecturas malas. Pagos cortados.</b><span>El saldo nunca va al dueño ni al operador.</span></div></div>
    <div class="two"><div class="tile"><span class="lbl">Pozo</span><div class="v">3,20 AVAX</div><div class="k">cuota 0,10</div></div><div class="tile"><span class="lbl">Firmas</span><div class="v">2 de 3</div><div class="k">último informe</div></div></div>
    <div class="steps">{steps}</div>
  </div>
</section>""")

CSS = """
:root{--bg:#f2f4ec;--card:#fff;--line:#e3e7dc;--ink:#0e1a12;--muted:#5f6c62;--deep:#0c3b24;--lime:#d6ff3d;--cut-bg:#ffe7df}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#e8ebe2;color:var(--ink);font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased;padding:40px 24px 60px}
header{max-width:1400px;margin:0 auto 24px} header h1{font:800 40px/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.035em}
header p{color:var(--muted);margin-top:10px;max-width:72ch;line-height:1.55}
.grid{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.opt{background:var(--card);border-radius:24px;padding:20px;display:flex;flex-direction:column;gap:10px}
.opt h2{font:700 20px/1.15 "Bricolage Grotesque",sans-serif;letter-spacing:-.02em}
.desc{font-size:13.5px;line-height:1.5;color:var(--muted)} .tag{font:500 11px "Geist Mono",monospace;text-transform:uppercase;letter-spacing:.05em;color:#3a6b00}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 6px;background:var(--bg);border-radius:16px;padding:14px 8px}
.ic{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;color:var(--muted);text-align:center}
.badge{display:inline-grid;place-items:center;border-radius:30%;background:var(--lime);color:var(--deep)}
.hcard .badge{background:#ffffff14;color:var(--lime);box-shadow:inset 0 0 0 1px #d6ff3d55}
.phone{background:var(--bg);border-radius:22px;padding:10px;display:flex;flex-direction:column;gap:8px;margin-top:4px}
.hcard{background:var(--deep);color:#fff;border-radius:20px;padding:14px;display:flex;justify-content:space-between;align-items:flex-end}
.pill{background:var(--lime);color:var(--deep);font:700 11px Inter,sans-serif;padding:4px 9px;border-radius:8px}
.big{font:800 46px/1 "Bricolage Grotesque",sans-serif;letter-spacing:-.05em;color:var(--lime);margin-top:8px} .big small{font-size:22px}
.sub{font-size:11.5px;color:#cfe3d6;margin-top:2px}
.notice{background:var(--cut-bg);color:#5c1d0b;border-radius:16px;padding:10px 12px;display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center}
.notice .badge{background:#f0542f;color:#fff}
.notice b{display:block;font:700 13px/1.25 "Bricolage Grotesque",sans-serif} .notice span{font-size:11.5px;opacity:.85}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px} .tile{background:var(--card);border-radius:14px;padding:10px 12px}
.lbl{font:500 10px "Geist Mono",monospace;text-transform:uppercase;color:#8b968d} .v{font:800 19px "Bricolage Grotesque",sans-serif;letter-spacing:-.03em;margin-top:2px} .k{font-size:11px;color:var(--muted)}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px} .st{background:var(--card);border-radius:14px;padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;font-weight:600;text-align:center}
footer{max-width:1400px;margin:20px auto 0;font-size:12px;color:var(--muted)}
@media (max-width:1100px){.grid{grid-template-columns:1fr 1fr}}
@media (max-width:640px){.grid{grid-template-columns:1fr} body{padding:24px 16px} header h1{font-size:30px}}
"""

html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bosque en pie · Opciones de íconos</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>
<header><h1>Opciones de íconos · con menos cantidad</h1>
<p>Regla para todas: íconos solo en la tarjeta principal de la parcela, en los avisos y en los pasos de "cómo funciona". Los datos (pozo, firmas, listas) van sin ícono. Abajo de cada opción, una porción de pantalla de celular con esa regla aplicada.</p></header>
<div class="grid">{"".join(cols)}</div>
<footer>A, B y C: Fluent Emoji de Microsoft (MIT). D: Lucide (ISC), el set que ya usa el Figma. Números de ejemplo.</footer>
</body></html>"""

(D / "icon-options.html").write_text(html, encoding="utf-8")
print("icon-options.html", round((D / "icon-options.html").stat().st_size / 1024), "KB")
