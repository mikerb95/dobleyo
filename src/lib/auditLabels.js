// Textos legibles para los eventos de audit_logs.
// Lo comparten /admin/auditoria y la actividad del dashboard para que una
// misma acción se lea igual en todo el panel.

// acción → [verbo, tono del punto de estado ("ok" | "info" | "warn" | "error" | "")]
export const AUDIT_ACTIONS = {
  create: ["Creó", "ok"],
  update: ["Actualizó", "info"],
  delete: ["Eliminó", "error"],
  cancel: ["Canceló", "error"],
  adjust: ["Ajustó", "info"],
  transfer: ["Trasladó", "info"],
  open: ["Abrió", "info"],
  post: ["Contabilizó", "ok"],
  reconcile: ["Concilió", ""],
  recompute: ["Recalculó", ""],
  poll: ["Consultó", ""],
  recover: ["Recuperó", ""],
  recover_failed: ["Reintentó", ""],
  run_migrations: ["Migró", ""],
  backup_db: ["Respaldó", ""],
  purge_old_logs: ["Depuró registros", ""],
  clear_error_logs: ["Limpió errores", ""],
  reset_password: ["Restableció clave", "warn"],
  change_role: ["Cambió rol", "warn"],
  create_admin: ["Creó administrador", "warn"],
  deactivate: ["Desactivó", "warn"],
  reactivate: ["Reactivó", "info"],
  expire: ["Venció", ""],
  oversold: ["Sobreventa", "error"],
  generate_labels: ["Generó etiquetas", "ok"],
  generate_labels_custom: ["Generó etiquetas", "ok"],
  delete_label: ["Eliminó etiqueta", "error"],
  shipping_quoted: ["Cotizó envío", ""],
  cod_rejected: ["Rechazó contraentrega", "warn"],
};

export const AUDIT_ENTITIES = {
  shipments: "Envío", product: "Producto", products: "Producto", product_variant: "Variante",
  user: "Usuario", user_address: "Dirección", farm: "Finca", coffee_harvest: "Cosecha",
  lot_cost: "Costo de lote", expense: "Gasto", customer_orders: "Pedido",
  purchase_invoice: "Factura de compra", sales_invoice: "Factura de venta", payment: "Pago",
  storage_location: "Ubicación", storage_zone: "Zona", storage_movement: "Movimiento",
  inventory_count: "Conteo", packaged_coffee: "Café empacado", packaging_supply: "Insumo",
  external_sale: "Venta externa", sales_tracking: "Venta", subscription: "Suscripción",
  crm_account: "Cuenta B2B", accounting_account: "Cuenta contable", demand_forecast: "Pronóstico",
  label: "Etiqueta", custom_profile: "Perfil de etiqueta", system: "Sistema",
};

export const USER_ROLES = {
  admin: "Administrador", caficultor: "Caficultor", client: "Cliente", provider: "Proveedor",
};

export const verbOf = (action) => AUDIT_ACTIONS[action] ?? [String(action ?? "").replace(/_/g, " "), ""];

export const entityOf = (type) => (type ? AUDIT_ENTITIES[type] ?? type.replace(/_/g, " ") : "Sin entidad");

// SQLite guarda CURRENT_TIMESTAMP en UTC sin zona: se marca explícitamente.
export function parseDbDate(s) {
  if (!s) return new Date(NaN);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : String(s).replace(" ", "T") + "Z");
}
