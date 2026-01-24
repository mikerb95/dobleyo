#!/bin/bash

# 🧪 Script de Pruebas para APIs de Producción
# Uso: bash test_production_apis.sh

BASE_URL="http://localhost:3000/api/production"

echo "🏭 Iniciando pruebas de APIs de Producción..."
echo "Base URL: $BASE_URL"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir resultado
print_result() {
    local test_name=$1
    local status=$2
    local response=$3
    
    if [ "$status" -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name"
        echo "Response: $response"
    fi
    echo ""
}

# ============================================
# 1. LISTAR ÓRDENES
# ============================================
echo -e "${BLUE}=== 1. GET /orders ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/orders?limit=5")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 2. CREAR ORDEN DE PRODUCCIÓN
# ============================================
echo -e "${BLUE}=== 2. POST /orders ===${NC}"
ORDER_RESPONSE=$(curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "bom_id": 1,
    "product_id": "CAFE-TOSTADO-001",
    "planned_quantity": 50,
    "quantity_unit": "kg",
    "scheduled_date": "2026-01-24",
    "work_center_id": 1,
    "roasting_equipment_id": 1,
    "responsible_user_id": 4,
    "priority": "normal",
    "notes": "Pedido de prueba"
  }')

echo "Response:"
echo "$ORDER_RESPONSE" | jq . 2>/dev/null || echo "$ORDER_RESPONSE"

# Extraer ID para pruebas posteriores
ORDER_ID=$(echo "$ORDER_RESPONSE" | jq -r '.data.id // empty')
echo -e "Order ID: ${YELLOW}$ORDER_ID${NC}"
echo ""

# ============================================
# 3. OBTENER ORDEN ESPECÍFICA
# ============================================
if [ -n "$ORDER_ID" ]; then
    echo -e "${BLUE}=== 3. GET /orders/:id ===${NC}"
    RESPONSE=$(curl -s -X GET "$BASE_URL/orders/$ORDER_ID")
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 4. CONFIRMAR ORDEN
    # ============================================
    echo -e "${BLUE}=== 4. POST /orders/:id/confirm ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/orders/$ORDER_ID/confirm")
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 5. INICIAR ORDEN
    # ============================================
    echo -e "${BLUE}=== 5. POST /orders/:id/start ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/orders/$ORDER_ID/start")
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
fi

# ============================================
# 6. CREAR BATCH DE TOSTADO
# ============================================
echo -e "${BLUE}=== 6. POST /batches ===${NC}"
BATCH_RESPONSE=$(curl -s -X POST "$BASE_URL/batches" \
  -H "Content-Type: application/json" \
  -d "{
    \"production_order_id\": $ORDER_ID,
    \"roast_profile_id\": 2,
    \"roasting_equipment_id\": 1,
    \"green_coffee_lot_id\": 1,
    \"green_coffee_weight_kg\": 50,
    \"operator_id\": 4
  }")

echo "Response:"
echo "$BATCH_RESPONSE" | jq . 2>/dev/null || echo "$BATCH_RESPONSE"

# Extraer Batch ID
BATCH_ID=$(echo "$BATCH_RESPONSE" | jq -r '.data.id // empty')
echo -e "Batch ID: ${YELLOW}$BATCH_ID${NC}"
echo ""

# ============================================
# 7. LISTAR BATCHES
# ============================================
echo -e "${BLUE}=== 7. GET /batches ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/batches?limit=5")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 8. REGISTRAR PRIMER CRACK
# ============================================
if [ -n "$BATCH_ID" ]; then
    echo -e "${BLUE}=== 8. POST /batches/:id/first-crack ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/first-crack" \
      -H "Content-Type: application/json" \
      -d '{
        "time_minutes": 8,
        "temperature_celsius": 195
      }')
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 9. REGISTRAR SEGUNDO CRACK
    # ============================================
    echo -e "${BLUE}=== 9. POST /batches/:id/second-crack ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/second-crack" \
      -H "Content-Type: application/json" \
      -d '{
        "time_minutes": 11
      }')
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 10. COMPLETAR TOSTADO
    # ============================================
    echo -e "${BLUE}=== 10. POST /batches/:id/complete ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/complete" \
      -H "Content-Type: application/json" \
      -d '{
        "roasted_coffee_weight_kg": 42.75,
        "drop_temperature_celsius": 205,
        "color_agtron": 65,
        "quality_score": 8.5,
        "quality_notes": "Excelente desarrollo",
        "ambient_temperature_celsius": 24,
        "humidity_percentage": 55
      }')
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 11. COMPARAR CON PERFIL
    # ============================================
    echo -e "${BLUE}=== 11. GET /batches/:id/comparison ===${NC}"
    RESPONSE=$(curl -s -X GET "$BASE_URL/batches/$BATCH_ID/comparison")
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 12. REGISTRAR CATACIÓN
    # ============================================
    echo -e "${BLUE}=== 12. POST /quality/cupping ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/quality/cupping" \
      -H "Content-Type: application/json" \
      -d "{
        \"roast_batch_id\": $BATCH_ID,
        \"inspector_id\": 3,
        \"aroma_score\": 8.5,
        \"flavor_score\": 8.75,
        \"acidity_score\": 8.5,
        \"body_score\": 8.25,
        \"balance_score\": 8.5,
        \"aftertaste_score\": 8.25,
        \"sweetness_score\": 8,
        \"uniformity_score\": 8.75,
        \"clean_cup_score\": 9,
        \"moisture_percentage\": 11.2,
        \"observations\": \"Café de excelente calidad\"
      }")
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""

    # ============================================
    # 13. APROBAR BATCH
    # ============================================
    echo -e "${BLUE}=== 13. POST /batches/:id/approve ===${NC}"
    RESPONSE=$(curl -s -X POST "$BASE_URL/batches/$BATCH_ID/approve" \
      -H "Content-Type: application/json" \
      -d '{
        "approved_by_user_id": 3
      }')
    echo "Response:"
    echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
    echo ""
fi

# ============================================
# 14. LISTAR INSPECCIONES DE CALIDAD
# ============================================
echo -e "${BLUE}=== 14. GET /quality ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/quality?limit=5")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 15. ESTADÍSTICAS DE CALIDAD
# ============================================
echo -e "${BLUE}=== 15. GET /quality/stats/summary ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/quality/stats/summary")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 16. DASHBOARD PRINCIPAL
# ============================================
echo -e "${BLUE}=== 16. GET /dashboard ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 17. EFICIENCIA
# ============================================
echo -e "${BLUE}=== 17. GET /dashboard/efficiency ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/efficiency?date_from=2026-01-15&date_to=2026-01-23")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 18. PERFORMANCE DE OPERADORES
# ============================================
echo -e "${BLUE}=== 18. GET /dashboard/operators ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/operators")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# ============================================
# 19. ALERTAS
# ============================================
echo -e "${BLUE}=== 19. GET /dashboard/alerts ===${NC}"
RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/alerts")
echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

echo -e "${GREEN}✅ Pruebas completadas${NC}"
echo ""
echo -e "${YELLOW}Siguiente paso:${NC} Revisar responses en logs"
