"""
Pronóstico de demanda — DobleYo Café (analítica con Python sobre Vercel).

Flujo:
  1. Lee `sales_tracking` desde Turso vía su HTTP API (Hrana /v2/pipeline).
  2. "Explota" el JSON `products` de cada orden → demanda semanal por SKU.
  3. Pronostica H semanas hacia adelante por producto (unidades) y el total
     de ingresos, con una banda de confianza ~95%.
  4. Escribe una "corrida" completa en `demand_forecasts` (Node solo LEE).

Disparada por Vercel Cron (GET) o por el proxy admin de Express (POST).
Protegida por CRON_SECRET: header `Authorization: Bearer <CRON_SECRET>`.

Diseño deliberado: solo pandas + numpy (sin statsmodels/scipy) para que el
bundle de la función entre holgado en los límites de Vercel. El modelo es
suavizado exponencial de Holt cuando hay historia suficiente, con fallback a
media móvil — honesto para el volumen de datos típico de un café de especialidad.
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import numpy as np
import pandas as pd

# ── Parámetros del modelo ─────────────────────────────────────────────────────
HORIZON_WEEKS = 8          # semanas a pronosticar
MIN_WEEKS_HOLT = 6         # historia mínima para usar Holt (si no, media móvil)
MOVING_AVG_WINDOW = 4      # ventana de la media móvil
Z_95 = 1.96                # banda de confianza normal ~95%
PRUNE_DAYS = 90            # purga corridas más viejas que esto


# ── Acceso a Turso (HTTP API / Hrana) ─────────────────────────────────────────
def _turso_endpoint():
    url = os.environ.get("TURSO_DATABASE_URL", "")
    if not url:
        raise RuntimeError("TURSO_DATABASE_URL no está definido")
    https = url.replace("libsql://", "https://").replace("wss://", "https://")
    return https.rstrip("/") + "/v2/pipeline"


def _to_arg(value):
    """Convierte un valor Python al formato tipado del protocolo Hrana."""
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "integer", "value": str(int(value))}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    return {"type": "text", "value": str(value)}


def _cell(cell):
    """Decodifica una celda Hrana {type,value} a Python."""
    t = cell.get("type")
    v = cell.get("value")
    if t == "null":
        return None
    if t == "integer":
        return int(v)
    if t == "float":
        return float(v)
    return v


def turso_batch(statements):
    """
    Ejecuta una lista de (sql, args) en un solo pipeline.
    Devuelve la lista de resultados (rows decodificadas por statement).
    """
    endpoint = _turso_endpoint()
    token = os.environ.get("TURSO_AUTH_TOKEN", "")

    requests = [
        {"type": "execute", "stmt": {"sql": sql, "args": [_to_arg(a) for a in args]}}
        for (sql, args) in statements
    ]
    requests.append({"type": "close"})

    body = json.dumps({"requests": requests}).encode("utf-8")
    req = urllib.request.Request(endpoint, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)

    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    out = []
    for item in payload.get("results", []):
        if item.get("type") == "error":
            raise RuntimeError("Turso error: " + json.dumps(item.get("error", {})))
        result = (item.get("response") or {}).get("result") or {}
        cols = [c.get("name") for c in result.get("cols", [])]
        rows = [
            {cols[i]: _cell(cell) for i, cell in enumerate(row)}
            for row in result.get("rows", [])
        ]
        out.append(rows)
    return out


# ── Pronóstico ────────────────────────────────────────────────────────────────
def _holt(y, h, alpha=0.5, beta=0.3):
    """Suavizado exponencial de Holt (nivel + tendencia). Retorna (forecast, sigma)."""
    level = float(y[0])
    trend = float(y[1] - y[0]) if len(y) > 1 else 0.0
    fitted = [level]
    for t in range(1, len(y)):
        prev_level = level
        level = alpha * y[t] + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
        fitted.append(prev_level + trend)  # predicción un-paso-adelante
    resid = np.array(y, dtype=float) - np.array(fitted, dtype=float)
    sigma = float(np.std(resid)) if len(resid) > 1 else 0.0
    forecast = [level + (i + 1) * trend for i in range(h)]
    return forecast, sigma


def _moving_avg(y, h, window):
    """Media móvil plana. Retorna (forecast, sigma)."""
    w = min(window, len(y))
    base = float(np.mean(y[-w:]))
    sigma = float(np.std(y[-w:])) if w > 1 else 0.0
    return [base] * h, sigma


def forecast_series(values, h):
    """
    Elige modelo según la cantidad de historia y devuelve filas de pronóstico.
    `values` es una serie semanal (lista de números, ya rellenada con ceros).
    """
    n = len(values)
    if n == 0:
        return None, None, []

    if n >= MIN_WEEKS_HOLT:
        model = "holt"
        fc, sigma = _holt(values, h)
    else:
        model = "moving_avg"
        fc, sigma = _moving_avg(values, h, MOVING_AVG_WINDOW)

    rows = []
    for i in range(h):
        point = max(0.0, round(float(fc[i]), 3))
        band = Z_95 * sigma
        rows.append({
            "horizon_index": i + 1,
            "forecast_value": point,
            "lower_bound": max(0.0, round(point - band, 3)),
            "upper_bound": round(point + band, 3),
        })
    return model, n, rows


def _future_mondays(last_monday, h):
    return [last_monday + pd.Timedelta(weeks=i + 1) for i in range(h)]


def build_forecasts():
    """Lee ventas, agrega por semana y devuelve (generated_at, filas a insertar)."""
    sales = turso_batch([(
        "SELECT purchase_date, total_amount, products "
        "FROM sales_tracking "
        "WHERE purchase_date IS NOT NULL "
        "  AND (order_status IS NULL OR LOWER(order_status) NOT IN ('cancelled','canceled'))",
        [],
    )])[0]

    if not sales:
        return None, []

    # Explotar el JSON de productos a filas [fecha, product_key, ml_id, qty, revenue]
    records = []
    for s in sales:
        ts = pd.to_datetime(s["purchase_date"], utc=True, errors="coerce")
        if pd.isna(ts):
            continue
        try:
            items = json.loads(s["products"]) if s["products"] else []
        except (ValueError, TypeError):
            items = []
        for it in items:
            title = (it.get("title") or "").strip()
            if not title:
                continue
            qty = it.get("quantity") or 0
            unit = it.get("unit_price") or it.get("full_price") or 0
            records.append({
                "date": ts,
                "product_key": title,
                "product_ml_id": str(it.get("id") or "") or None,
                "qty": float(qty),
                "revenue": float(qty) * float(unit),
            })

    if not records:
        return None, []

    df = pd.DataFrame(records)
    df["week"] = df["date"].dt.tz_convert("UTC").dt.to_period("W-MON").dt.start_time
    weeks = pd.date_range(df["week"].min(), df["week"].max(), freq="W-MON")
    last_monday = weeks[-1]
    future = _future_mondays(last_monday, HORIZON_WEEKS)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    out_rows = []

    # ── Demanda por SKU (unidades) ────────────────────────────────────────────
    ids = df.groupby("product_key")["product_ml_id"].agg(
        lambda x: x.dropna().iloc[0] if x.dropna().size else None
    )
    units = (
        df.groupby(["product_key", "week"])["qty"].sum()
          .unstack(fill_value=0)
          .reindex(columns=weeks, fill_value=0)
    )
    for product_key, series in units.iterrows():
        model, hist, rows = forecast_series(series.values.tolist(), HORIZON_WEEKS)
        for r in rows:
            out_rows.append({
                "product_key": product_key,
                "product_ml_id": ids.get(product_key),
                "metric": "units",
                "period_start": future[r["horizon_index"] - 1].strftime("%Y-%m-%d"),
                "model_used": model,
                "history_weeks": hist,
                **r,
            })

    # ── Ingresos totales (revenue) ────────────────────────────────────────────
    revenue = (
        df.groupby("week")["revenue"].sum()
          .reindex(weeks, fill_value=0)
    )
    model, hist, rows = forecast_series(revenue.values.tolist(), HORIZON_WEEKS)
    for r in rows:
        out_rows.append({
            "product_key": "TOTAL",
            "product_ml_id": None,
            "metric": "revenue",
            "period_start": future[r["horizon_index"] - 1].strftime("%Y-%m-%d"),
            "model_used": model,
            "history_weeks": hist,
            **r,
        })

    return generated_at, out_rows


def persist(generated_at, rows):
    """Inserta la corrida y purga corridas antiguas."""
    statements = []
    for r in rows:
        statements.append((
            "INSERT INTO demand_forecasts "
            "(product_key, product_ml_id, metric, period_start, horizon_index, "
            " forecast_value, lower_bound, upper_bound, model_used, history_weeks, generated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                r["product_key"], r["product_ml_id"], r["metric"], r["period_start"],
                r["horizon_index"], r["forecast_value"], r["lower_bound"],
                r["upper_bound"], r["model_used"], r["history_weeks"], generated_at,
            ],
        ))
    statements.append((
        "DELETE FROM demand_forecasts WHERE generated_at < datetime('now', ?)",
        ["-%d days" % PRUNE_DAYS],
    ))

    # Pipeline en lotes para no enviar un cuerpo gigantesco
    for i in range(0, len(statements), 100):
        turso_batch(statements[i:i + 100])


def run():
    generated_at, rows = build_forecasts()
    if not rows:
        return {"success": True, "generated_at": None, "rows_written": 0,
                "message": "Sin datos de ventas para pronosticar."}
    persist(generated_at, rows)
    series = len({(r["product_key"], r["metric"]) for r in rows})
    return {"success": True, "generated_at": generated_at,
            "series": series, "rows_written": len(rows)}


# ── Handler de Vercel ─────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def _authorized(self):
        secret = os.environ.get("CRON_SECRET")
        if not secret:
            return True  # sin secreto configurado → no se exige (dev)
        return self.headers.get("Authorization") == "Bearer " + secret

    def _respond(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def _handle(self):
        if not self._authorized():
            return self._respond(401, {"success": False, "error": "No autorizado"})
        try:
            self._respond(200, run())
        except Exception as err:  # noqa: BLE001 — superficie de error controlada
            self._respond(500, {"success": False, "error": str(err)})

    def do_GET(self):   # Vercel Cron
        self._handle()

    def do_POST(self):  # Proxy admin (Express)
        self._handle()
