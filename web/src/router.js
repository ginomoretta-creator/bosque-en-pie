// Router por hash: #/ , #/parcela/2 , #/actividad …
// El fragmento #k=<clave> de los QR del jurado (#29) no es una ruta: lo toma wallet.js antes de arrancar.
const routes = [];

/**
 * route("/parcela/:id", (params, state) => html | { html, mount(el) })
 * mount(el) corre después de pintar (por ejemplo, para el mapa) y puede devolver una función de limpieza.
 * opts.live = false: no se vuelve a pintar cuando llegan bloques nuevos (útil en formularios).
 */
export function route(pattern, render, opts = {}) {
  const keys = [];
  const re = new RegExp(
    "^" + pattern.replace(/:[a-z]+/gi, (m) => (keys.push(m.slice(1)), "([^/]+)")) + "/?$",
    "i",
  );
  routes.push({ re, keys, render, pattern, live: opts.live !== false });
}

export function currentPath() {
  const h = location.hash;
  return h.startsWith("#/") ? h.slice(1) : "/";
}

export function match(path = currentPath()) {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export const go = (path) => (location.hash = `#${path}`);
