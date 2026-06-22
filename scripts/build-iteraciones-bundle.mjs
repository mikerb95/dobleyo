// ─────────────────────────────────────────────────────────────────────────────
// Generador del bundle autónomo del Tablero de Iteraciones.
//
// Lee la fuente de verdad (src/data/iteraciones.ts) y la página admin
// (src/pages/admin/iteraciones.astro), y produce un único archivo HTML
// portable y "namespaced" bajo .dy-iter para pegarlo en otro sitio web sin
// depender de AdminLayout ni chocar con los estilos del sitio destino.
//
//   npx tsx scripts/build-iteraciones-bundle.mjs
//   → export/proyectos-iteraciones.html
// ─────────────────────────────────────────────────────────────────────────────
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PARES, COLUMNAS, ITERACIONES, COMMITS_POR_MES, REPO } from "../src/data/iteraciones.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const iterData = { PARES, COLUMNAS, ITERACIONES, COMMITS_POR_MES, REPO };

// ── Extraer markup, estilos y script de la página admin ──────────────────────
const page = await readFile(resolve(root, "src/pages/admin/iteraciones.astro"), "utf8");

const between = (src, open, close) => {
  const i = src.indexOf(open);
  const j = src.indexOf(close, i + open.length);
  if (i === -1 || j === -1) throw new Error(`No se encontró ${open} … ${close}`);
  return src.slice(i + open.length, j);
};

// Markup: desde el primer comentario tras <AdminLayout> hasta </AdminLayout>
let markup = page.slice(
  page.indexOf("<!-- Datos derivados"),
  page.indexOf("</AdminLayout>")
);

// Reemplazar la inyección Astro (set:html) por un <script application/json> real
markup = markup.replace(
  /<script type="application\/json" id="iterData"[^>]*\/>/,
  `<script type="application/json" id="iterData">${JSON.stringify(iterData)}</script>`
);

// Quitar el enlace admin "Zona de peligro" (no aplica fuera del ERP)
markup = markup.replace(
  /<a href="\/admin\/devtools"[^>]*>.*?<\/a>\s*/s,
  ""
);

const boardStyle = between(page, "<style is:global>", "</style>");
const boardScript = between(page, "<script is:inline>", "</script>");

// ── Tokens + clases de componentes (extraídas de AdminLayout) scoped a .dy-iter ─
const baseCss = `
/* ===== Tablero de Iteraciones — bundle autónomo (DobleYo Café) =====
   Todo va scoped bajo .dy-iter para no afectar al resto del sitio. */
.dy-iter {
  /* Paleta (fuente de verdad) */
  --color-primary: #3a2618;
  --color-accent:  #c9893d;
  --color-text:    #1a1410;
  /* Derivados */
  --bg:        color-mix(in oklab, var(--color-primary) 4%,  #fbf8f3);
  --paper:     #ffffff;
  --rule:      color-mix(in oklab, var(--color-primary) 12%, #ffffff);
  --rule-2:    color-mix(in oklab, var(--color-primary) 20%, #ffffff);
  --muted:     color-mix(in oklab, var(--color-text)    50%, transparent);
  --muted-2:   color-mix(in oklab, var(--color-text)    35%, transparent);
  --hover:     color-mix(in oklab, var(--color-primary)  4%, white);
  --active-bg: color-mix(in oklab, var(--color-accent) 14%, white);
  /* Semánticos */
  --danger: #c0392b;
  --warn:   var(--color-accent);
  --ok:     #2e7d5b;
  --info:   color-mix(in oklab, var(--color-primary) 50%, white);
  --c-success: var(--ok);
  --c-info:    color-mix(in oklab, var(--color-primary) 60%, white);
  --c-warning: var(--color-accent);
  --c-error:   var(--danger);
  /* Radios y tipografía */
  --radius:    10px;
  --radius-sm: 8px;
  --font-display: "Playfair Display", Georgia, "Times New Roman", Times, serif;
  --card-shadow: 0 1px 0 color-mix(in oklab, var(--color-primary) 6%, transparent),
                 0 8px 24px -16px color-mix(in oklab, var(--color-primary) 30%, transparent);

  color: var(--color-text);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--bg);
}
.dy-iter *, .dy-iter *::before, .dy-iter *::after { box-sizing: border-box; }

/* Estructura de página */
.dy-iter .page-header { background: var(--paper); border-bottom: 1px solid var(--rule); padding: 20px 24px 16px; }
.dy-iter .page-header-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.dy-iter .page-breadcrumb { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-2); margin-bottom: 5px; }
.dy-iter .page-title { font-family: var(--font-display); font-size: 26px; font-weight: 700; letter-spacing: -0.005em; color: var(--color-primary); margin: 0; line-height: 1.15; }
.dy-iter .page-subtitle { font-size: 13px; color: var(--muted); margin-top: 4px; }
.dy-iter .page-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dy-iter .erp-body { padding: 24px; max-width: 1280px; margin: 0 auto; }
@media (max-width: 640px) { .dy-iter .erp-body { padding: 16px; } }

/* KPI tiles */
.dy-iter .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.dy-iter .kpi-tile { position: relative; background: var(--paper); border: 1px solid var(--rule); border-radius: var(--radius); padding: 16px 18px 16px 20px; box-shadow: var(--card-shadow); overflow: hidden; }
.dy-iter .kpi-tile::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--color-accent); }
.dy-iter .kpi-tile.success::before { background: var(--c-success); }
.dy-iter .kpi-tile.info::before    { background: var(--c-info); }
.dy-iter .kpi-tile.warning::before { background: var(--c-warning); }
.dy-iter .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
.dy-iter .kpi-value { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--color-primary); line-height: 1.1; font-variant-numeric: tabular-nums; }
.dy-iter .kpi-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }

/* Card */
.dy-iter .card { background: var(--paper); border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; box-shadow: var(--card-shadow); }
.dy-iter .card-header { padding: 14px 18px; border-bottom: 1px solid var(--rule); display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dy-iter .card-title { font-size: 14px; font-weight: 600; color: var(--color-primary); margin: 0; }
.dy-iter .card-subtitle { font-size: 12px; color: var(--muted); margin-top: 2px; }

/* Botones */
.dy-iter .btn { appearance: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--rule); background: var(--paper); color: var(--color-text); display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
.dy-iter .btn:hover { border-color: var(--rule-2); background: var(--hover); }
.dy-iter .btn-secondary { background: var(--paper); }
.dy-iter .shell-btn { appearance: none; cursor: pointer; display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--rule); background: var(--paper); color: var(--muted); }
.dy-iter .shell-btn:hover { background: var(--hover); color: var(--color-primary); }

/* Modal */
.dy-iter .modal { position: fixed; inset: 0; z-index: 50; background: color-mix(in oklab, var(--color-primary) 50%, transparent); display: grid; place-items: center; padding: 16px; }
.dy-iter .modal-content { background: var(--paper); border-radius: var(--radius); max-width: 540px; width: 100%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px -16px color-mix(in oklab, var(--color-primary) 50%, transparent); border: 1px solid var(--rule); }
.dy-iter .modal-header { padding: 14px 20px; border-bottom: 1px solid var(--rule); display: flex; justify-content: space-between; align-items: center; }
.dy-iter .modal-title { font-size: 15px; font-weight: 600; color: var(--color-primary); margin: 0; }
.dy-iter .modal-body { padding: 20px; }
`;

// El boardStyle usa clases ya únicas (.iter-*, .xp-*, .dt-*) que no colisionan
// con un sitio externo, y referencian variables CSS que se heredan desde el
// wrapper .dy-iter. Se emite verbatim. Las clases genéricas que SÍ podrían
// colisionar (card, modal, kpi, btn, page-header) van scoped en baseCss.
const scopedBoard = boardStyle;

const html = `<!doctype html>
<!--
  Tablero de Iteraciones (XP) — DobleYo Café
  Bundle autónomo generado por scripts/build-iteraciones-bundle.mjs
  Pega el <div class="dy-iter">…</div>, el <style> y el <script> en tu página.
  No depende de ningún framework ni de estilos externos.
-->
<meta charset="utf-8" />
<style>
${baseCss}
${scopedBoard}
</style>

<div class="dy-iter">
${markup.trim()}
</div>

<script>
${boardScript}
</script>
`;

const outDir = resolve(root, "export");
await mkdir(outDir, { recursive: true });
const outFile = resolve(outDir, "proyectos-iteraciones.html");
await writeFile(outFile, html, "utf8");
console.log(`✓ Bundle generado: export/proyectos-iteraciones.html (${(html.length / 1024).toFixed(1)} KB)`);
