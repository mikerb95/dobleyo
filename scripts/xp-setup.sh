#!/usr/bin/env bash
# scripts/xp-setup.sh
# Configura el tablero XP en GitHub: elimina labels por defecto,
# crea labels XP, milestones (iteraciones) e issues de ejemplo.
# Uso: bash scripts/xp-setup.sh

set -euo pipefail

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "→ Repositorio: $REPO"

# ──────────────────────────────────────────────
# 1. ELIMINAR LABELS POR DEFECTO DE GITHUB
# ──────────────────────────────────────────────
echo ""
echo "[ 1/4 ] Eliminando labels por defecto..."

DEFAULT_LABELS=(
  "bug"
  "documentation"
  "duplicate"
  "enhancement"
  "help wanted"
  "good first issue"
  "invalid"
  "question"
  "wontfix"
)

for label in "${DEFAULT_LABELS[@]}"; do
  gh label delete "$label" --yes 2>/dev/null && echo "  ✗ eliminado: $label" || echo "  · no existe: $label"
done

# ──────────────────────────────────────────────
# 2. CREAR LABELS XP
# ──────────────────────────────────────────────
echo ""
echo "[ 2/4 ] Creando labels XP..."

# Formato: "nombre|color|descripción"
LABELS=(
  # — Tipo de ítem —
  "historia|0052CC|Como [rol] quiero [X] para [valor de negocio]"
  "spike|5319E7|Exploración técnica con tiempo límite explícito"
  "bug|B60205|Defecto que escapó a las pruebas de aceptación"
  "tarea|E4E669|Trabajo técnico sin valor directo al cliente (infra, deuda)"

  # — Estado (flujo del tablero) —
  "en-desarrollo|FFA500|Historia en pareja actualmente en curso"
  "en-aceptacion|0E8A16|Esperando validación del cliente o prueba de aceptación"

  # — Valor de negocio (lo asigna el cliente) —
  "valor-alto|D93F0B|Impacto alto en el negocio — prioridad máxima"
  "valor-medio|F9D0C4|Impacto medio — incluir en iteración actual si cabe"
  "valor-bajo|FEF2C0|Impacto bajo — cola o iteración futura"
)

for entry in "${LABELS[@]}"; do
  IFS="|" read -r name color description <<< "$entry"
  gh label create "$name" --color "$color" --description "$description" --force \
    && echo "  ✓ $name"
done

# ──────────────────────────────────────────────
# 3. CREAR MILESTONES (ITERACIONES)
# ──────────────────────────────────────────────
echo ""
echo "[ 3/4 ] Creando milestones (iteraciones)..."

gh milestone create \
  --title "Iteración 12 · Pagos & Checkout" \
  --description "Integración de pasarelas de pago (Wompi / MercadoPago), flujo de checkout completo y confirmación de orden por correo." \
  --due-date "2026-06-20" \
  && echo "  ✓ Iteración 12"

gh milestone create \
  --title "Iteración 13 · Auth & Usuarios" \
  --description "Mejoras al sistema de autenticación: recuperación de contraseña, verificación de correo robusta, panel de usuarios en admin, roles granulares." \
  --due-date "2026-07-04" \
  && echo "  ✓ Iteración 13"

# ──────────────────────────────────────────────
# 4. CREAR ISSUES DE EJEMPLO (HISTORIAS XP)
# ──────────────────────────────────────────────
echo ""
echo "[ 4/4 ] Creando issues de ejemplo..."

# Obtener número del milestone Iteración 12
M12=$(gh milestone list --json number,title | \
  jq -r '.[] | select(.title | test("Iteración 12")) | .number')

# Historia 1 — Checkout con Wompi
gh issue create \
  --title "Como cliente, quiero pagar con tarjeta de crédito para completar mi compra" \
  --label "historia,valor-alto,en-desarrollo" \
  --milestone "$M12" \
  --body "## Historia
Como **cliente**, quiero **pagar con tarjeta de crédito mediante Wompi** para **completar mi compra de café sin salir del sitio**.

## Pruebas de aceptación
- [ ] Dado que el carrito tiene ≥1 producto, cuando el cliente hace clic en «Pagar», entonces se muestra el widget de Wompi con el monto correcto.
- [ ] Dado que el pago es aprobado, cuando Wompi envía el webhook, entonces se crea la orden en BD con estado \`pagada\` y se envía correo de confirmación.
- [ ] Dado que el pago es rechazado, cuando Wompi responde error, entonces el cliente ve un mensaje claro y el carrito se conserva.
- [ ] Dado que el webhook llega duplicado, cuando ya existe la orden, entonces el endpoint responde 200 sin crear duplicado.

## Notas
- Clave pública Wompi ya en \`.env.example\` como \`WOMPI_PUBLIC_KEY\`
- Estimado: 3 días ideales" \
  && echo "  ✓ Historia: checkout Wompi"

# Historia 2 — Recuperación de contraseña
M13=$(gh milestone list --json number,title | \
  jq -r '.[] | select(.title | test("Iteración 13")) | .number')

gh issue create \
  --title "Como usuario registrado, quiero recuperar mi contraseña para no perder acceso a mi cuenta" \
  --label "historia,valor-alto" \
  --milestone "$M13" \
  --body "## Historia
Como **usuario registrado**, quiero **recuperar mi contraseña mediante un enlace enviado a mi correo** para **recuperar el acceso sin contactar soporte**.

## Pruebas de aceptación
- [ ] Dado que el correo existe en BD, cuando el usuario solicita recuperación, entonces recibe un correo con enlace válido por 1 hora.
- [ ] Dado que el enlace es válido, cuando el usuario define nueva contraseña (≥8 chars, 1 mayúscula, 1 número), entonces el hash se actualiza y el enlace se invalida.
- [ ] Dado que el enlace expiró o fue usado, cuando el usuario intenta acceder, entonces ve el error «Enlace inválido o expirado» y puede solicitar uno nuevo.
- [ ] Dado que el correo NO existe, cuando el usuario solicita recuperación, entonces la respuesta es genérica (sin revelar si el correo existe).

## Notas
- Usar Resend + template HTML existente en \`server/services/email.js\`
- Token: UUID v4 almacenado en tabla \`password_reset_tokens\` (crear migración)
- Estimado: 2 días ideales" \
  && echo "  ✓ Historia: recuperación de contraseña"

# Spike — Evaluación de MercadoPago
gh issue create \
  --title "[Spike] Evaluar integración MercadoPago Colombia vs Wompi" \
  --label "spike,valor-medio" \
  --milestone "$M12" \
  --body "## Spike
**Pregunta a responder:** ¿Conviene integrar MercadoPago como pasarela alternativa a Wompi para clientes colombianos, o es suficiente con Wompi para la Iteración 12?

## Límite de tiempo
**Máximo 1 día ideal.** Si no hay conclusión en ese tiempo, se descarta MercadoPago para esta iteración.

## Criterios de evaluación
- [ ] Comparar comisiones por transacción (Wompi vs MP Colombia)
- [ ] Verificar si MP Colombia requiere cuenta empresarial verificada
- [ ] Evaluar complejidad de integración webhook vs Wompi
- [ ] Documentar conclusión como comentario en este issue y cerrar

## Notas
- Keys disponibles en \`.env.example\`: \`MERCADOPAGO_ACCESS_TOKEN\`, \`MERCADOPAGO_PUBLIC_KEY\`
- Estimado: 1 día ideal" \
  && echo "  ✓ Spike: evaluación MercadoPago"

# Bug de ejemplo
gh issue create \
  --title "[Bug] El carrito persiste después de cerrar sesión" \
  --label "bug,valor-medio" \
  --body "## Defecto
El contenido del carrito (localStorage) persiste cuando el usuario cierra sesión, expone ítems de sesiones anteriores a usuarios que comparten dispositivo.

## Pruebas de aceptación
- [ ] Dado que el usuario tiene ítems en el carrito, cuando hace clic en «Cerrar sesión», entonces \`localStorage.cart\` queda vacío.
- [ ] Dado que el JWT expira y el refresh falla, cuando \`auth-refresh.js\` detecta la expiración, entonces limpia el carrito antes de redirigir al login.

## Pasos para reproducir
1. Agregar 2 productos al carrito
2. Cerrar sesión desde el menú
3. Recargar — el carrito sigue mostrando los ítems

## Notas
- Afecta: \`public/assets/js/cart.js\` y \`public/assets/js/auth-refresh.js\`" \
  && echo "  ✓ Bug: carrito persiste tras logout"

echo ""
echo "✅ Setup XP completo."
echo ""
echo "Tablero: https://github.com/$REPO/issues"
echo ""
echo "Columnas sugeridas (GitHub Projects):"
echo "  Cola  |  Esta iteración  |  En desarrollo  |  Aceptación  |  Aceptada"
