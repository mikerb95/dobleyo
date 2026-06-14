"""
CRUD de demanda — DobleYo Café (módulo 100% Python sobre Vercel).

Módulo autónomo y aislado: gestiona el ciclo de vida completo (Create, Read,
Update, Delete) de registros de demanda por categoría en la tabla
`demand_records`. NO toca el resto del CRUD del sitio (usuarios, productos, etc.)
ni el pipeline de pronóstico (`recompute.py` / `demand_forecasts`), que sigue
intacto.

Endpoints (un solo recurso REST en `/api/ml/demand`):
  POST   /api/ml/demand            → Crea un registro de demanda
  GET    /api/ml/demand            → Lista (filtros opcionales ?category= ?id= ?limit=)
  PUT    /api/ml/demand?id=<n>     → Actualiza el registro <n> (campos parciales)
  DELETE /api/ml/demand?id=<n>     → Borra el registro <n>

Acceso a datos: Turso (libSQL) vía su HTTP API (Hrana /v2/pipeline), el mismo
patrón que usa `recompute.py`. La tabla se autocrea con CREATE TABLE IF NOT
EXISTS, de modo que todo el ciclo vive en Python.

Seguridad: protegido con el MISMO JWT de sesión que emite Node (HS256, cookie
HttpOnly `auth_token` o cabecera `Authorization: Bearer`). La verificación de la
firma se hace con la librería estándar (hmac + hashlib), sin dependencias nuevas
y sin alterar la auth de Node. Requiere rol `admin`.

Ejecución local para pruebas:
  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... python3 api/ml/demand.py
"""

import os
import json
import time
import hmac
import base64
import hashlib
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler


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
    """Ejecuta una lista de (sql, args) en un solo pipeline y devuelve las filas."""
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


# ── Esquema (autocreación) ────────────────────────────────────────────────────
_TABLE_READY = False


def ensure_table():
    """Crea la tabla demand_records y sus índices si no existen (idempotente)."""
    global _TABLE_READY
    if _TABLE_READY:
        return
    turso_batch([
        ("""
         CREATE TABLE IF NOT EXISTS demand_records (
           id            INTEGER PRIMARY KEY AUTOINCREMENT,
           category      TEXT    NOT NULL,
           product_key   TEXT,
           period        TEXT,
           demand_value  REAL    NOT NULL,
           unit          TEXT    NOT NULL DEFAULT 'units',
           notes         TEXT,
           created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
           updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
         )
         """, []),
        ("CREATE INDEX IF NOT EXISTS idx_demand_records_category ON demand_records(category)", []),
        ("CREATE INDEX IF NOT EXISTS idx_demand_records_period   ON demand_records(period)", []),
    ])
    _TABLE_READY = True


# ── JWT (verificación HS256 con stdlib, sin dependencias) ──────────────────────
def _b64url_decode(seg):
    pad = "=" * (-len(seg) % 4)
    return base64.urlsafe_b64decode(seg + pad)


def verify_jwt(token):
    """
    Verifica un JWT HS256 firmado con JWT_SECRET (el mismo que usa Node).
    Devuelve el payload (dict) si es válido y vigente, o None.
    Rechaza tokens con 'type' (p.ej. verificación de email), igual que Node.
    """
    secret = os.environ.get("JWT_SECRET", "")
    if not secret or not token or token.count(".") != 2:
        return None

    header_b64, payload_b64, sig_b64 = token.split(".")
    try:
        header = json.loads(_b64url_decode(header_b64))
        if header.get("alg") != "HS256":
            return None  # evita confusión de algoritmos ('none', RS256, etc.)
        expected = hmac.new(
            secret.encode("utf-8"),
            (header_b64 + "." + payload_b64).encode("utf-8"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_b64)):
            return None
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, TypeError):
        return None

    exp = payload.get("exp")
    if exp is not None and time.time() > float(exp):
        return None  # vencido
    if payload.get("type"):
        return None  # un token de verificación no es de sesión
    return payload


# ── Operaciones CRUD ──────────────────────────────────────────────────────────
_FIELDS = ("category", "product_key", "period", "demand_value", "unit", "notes")


def _validate_create(data):
    """Valida el payload de creación. Devuelve (limpio, errores)."""
    errors = []
    category = (data.get("category") or "").strip()
    if not category:
        errors.append("category es requerido")

    raw_value = data.get("demand_value")
    demand_value = None
    if raw_value is None or raw_value == "":
        errors.append("demand_value es requerido")
    else:
        try:
            demand_value = float(raw_value)
            if demand_value < 0:
                errors.append("demand_value debe ser >= 0")
        except (ValueError, TypeError):
            errors.append("demand_value debe ser numérico")

    clean = {
        "category": category,
        "product_key": (data.get("product_key") or "").strip() or None,
        "period": (data.get("period") or "").strip() or None,
        "demand_value": demand_value,
        "unit": (data.get("unit") or "units").strip() or "units",
        "notes": (data.get("notes") or "").strip() or None,
    }
    return clean, errors


def create_record(data):
    ensure_table()
    clean, errors = _validate_create(data)
    if errors:
        return 422, {"success": False, "errors": errors}

    rows = turso_batch([(
        "INSERT INTO demand_records (category, product_key, period, demand_value, unit, notes) "
        "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
        [clean["category"], clean["product_key"], clean["period"],
         clean["demand_value"], clean["unit"], clean["notes"]],
    )])[0]
    return 201, {"success": True, "data": rows[0] if rows else None}


def read_records(params):
    ensure_table()
    rec_id = (params.get("id") or [None])[0]
    category = (params.get("category") or [None])[0]
    limit_raw = (params.get("limit") or ["200"])[0]
    try:
        limit = max(1, min(1000, int(limit_raw)))
    except (ValueError, TypeError):
        limit = 200

    if rec_id:
        try:
            rid = int(rec_id)
        except (ValueError, TypeError):
            return 400, {"success": False, "error": "id inválido"}
        rows = turso_batch([(
            "SELECT * FROM demand_records WHERE id = ?", [rid],
        )])[0]
        if not rows:
            return 404, {"success": False, "error": "Registro no encontrado"}
        return 200, {"success": True, "data": rows[0]}

    if category:
        rows = turso_batch([(
            "SELECT * FROM demand_records WHERE category = ? "
            "ORDER BY created_at DESC, id DESC LIMIT ?",
            [category.strip(), limit],
        )])[0]
    else:
        rows = turso_batch([(
            "SELECT * FROM demand_records ORDER BY created_at DESC, id DESC LIMIT ?",
            [limit],
        )])[0]
    return 200, {"success": True, "data": rows, "count": len(rows)}


def update_record(rec_id, data):
    ensure_table()
    try:
        rid = int(rec_id)
    except (ValueError, TypeError):
        return 400, {"success": False, "error": "id inválido o ausente"}

    sets, args, errors = [], [], []
    if "category" in data:
        category = (data.get("category") or "").strip()
        if not category:
            errors.append("category no puede quedar vacío")
        else:
            sets.append("category = ?"); args.append(category)
    if "product_key" in data:
        sets.append("product_key = ?"); args.append((data.get("product_key") or "").strip() or None)
    if "period" in data:
        sets.append("period = ?"); args.append((data.get("period") or "").strip() or None)
    if "demand_value" in data:
        try:
            val = float(data.get("demand_value"))
            if val < 0:
                errors.append("demand_value debe ser >= 0")
            else:
                sets.append("demand_value = ?"); args.append(val)
        except (ValueError, TypeError):
            errors.append("demand_value debe ser numérico")
    if "unit" in data:
        sets.append("unit = ?"); args.append((data.get("unit") or "units").strip() or "units")
    if "notes" in data:
        sets.append("notes = ?"); args.append((data.get("notes") or "").strip() or None)

    if errors:
        return 422, {"success": False, "errors": errors}
    if not sets:
        return 422, {"success": False, "error": "No hay campos para actualizar"}

    sets.append("updated_at = datetime('now')")
    rows = turso_batch([(
        "UPDATE demand_records SET " + ", ".join(sets) + " WHERE id = ? RETURNING *",
        args + [rid],
    )])[0]
    if not rows:
        return 404, {"success": False, "error": "Registro no encontrado"}
    return 200, {"success": True, "data": rows[0]}


def delete_record(rec_id):
    ensure_table()
    try:
        rid = int(rec_id)
    except (ValueError, TypeError):
        return 400, {"success": False, "error": "id inválido o ausente"}
    rows = turso_batch([(
        "DELETE FROM demand_records WHERE id = ? RETURNING id", [rid],
    )])[0]
    if not rows:
        return 404, {"success": False, "error": "Registro no encontrado"}
    return 200, {"success": True, "data": {"id": rid, "deleted": True}}


# ── Handler de Vercel ─────────────────────────────────────────────────────────
class handler(BaseHTTPRequestHandler):
    def _cookies(self):
        out = {}
        for pair in (self.headers.get("Cookie", "") or "").split(";"):
            if "=" in pair:
                k, v = pair.strip().split("=", 1)
                out[k] = v
        return out

    def _user(self):
        """Extrae y verifica el JWT (cookie auth_token o Bearer). None si inválido."""
        token = self._cookies().get("auth_token")
        if not token:
            auth = self.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth[7:]
        return verify_jwt(token) if token else None

    def _params(self):
        return parse_qs(urlparse(self.path).query)

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else {}
        except (ValueError, TypeError):
            return None  # JSON inválido

    def _respond(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(body)

    def _guard(self):
        """Devuelve el usuario admin o None tras responder el error apropiado."""
        user = self._user()
        if not user:
            self._respond(401, {"success": False, "error": "No autorizado"})
            return None
        if user.get("role") != "admin":
            self._respond(403, {"success": False, "error": "Permisos insuficientes"})
            return None
        return user

    # ── Métodos HTTP → CRUD ──
    def do_GET(self):
        if not self._guard():
            return
        try:
            status, payload = read_records(self._params())
            self._respond(status, payload)
        except Exception as err:  # noqa: BLE001 — superficie de error controlada
            self._respond(500, {"success": False, "error": str(err)})

    def do_POST(self):
        if not self._guard():
            return
        body = self._body()
        if body is None:
            return self._respond(400, {"success": False, "error": "JSON inválido"})
        try:
            status, payload = create_record(body)
            self._respond(status, payload)
        except Exception as err:  # noqa: BLE001
            self._respond(500, {"success": False, "error": str(err)})

    def do_PUT(self):
        if not self._guard():
            return
        body = self._body()
        if body is None:
            return self._respond(400, {"success": False, "error": "JSON inválido"})
        rec_id = (self._params().get("id") or [body.get("id")])[0]
        try:
            status, payload = update_record(rec_id, body)
            self._respond(status, payload)
        except Exception as err:  # noqa: BLE001
            self._respond(500, {"success": False, "error": str(err)})

    def do_DELETE(self):
        if not self._guard():
            return
        rec_id = (self._params().get("id") or [None])[0]
        if rec_id is None:
            body = self._body() or {}
            rec_id = body.get("id")
        try:
            status, payload = delete_record(rec_id)
            self._respond(status, payload)
        except Exception as err:  # noqa: BLE001
            self._respond(500, {"success": False, "error": str(err)})


# ── Smoke test local (requiere TURSO_DATABASE_URL / TURSO_AUTH_TOKEN) ──────────
#   python3 api/ml/demand.py
def _smoke_test():
    print("→ ensure_table()"); ensure_table()
    print("→ create"); st, r = create_record(
        {"category": "cafe-grano", "product_key": "Huila Caturra 500g",
         "period": "2026-W24", "demand_value": 42, "unit": "units",
         "notes": "registro de prueba"})
    print("  ", st, json.dumps(r, ensure_ascii=False))
    rid = (r.get("data") or {}).get("id")
    print("→ read (lista)"); st, r = read_records({"category": ["cafe-grano"]})
    print("  ", st, "count=", r.get("count"))
    print("→ update"); st, r = update_record(rid, {"demand_value": 55, "notes": "ajustada"})
    print("  ", st, json.dumps(r, ensure_ascii=False))
    print("→ delete"); st, r = delete_record(rid)
    print("  ", st, json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    if not os.environ.get("TURSO_DATABASE_URL"):
        print("Defina TURSO_DATABASE_URL y TURSO_AUTH_TOKEN para el smoke test.")
    else:
        _smoke_test()
