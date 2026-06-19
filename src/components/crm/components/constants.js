export const STAGES = [
  { id: "prospect",    label: "Prospecto" },
  { id: "contacted",   label: "Contactado" },
  { id: "sample_sent", label: "Muestra enviada" },
  { id: "negotiation", label: "Negociación" },
  { id: "active",      label: "Cliente activo" },
  { id: "lost",        label: "Perdido" },
];

export const SEGMENTS = [
  { id: "importer_us",    label: "Importador US",   country: "US" },
  { id: "distributor_co", label: "Distribuidor CO", country: "CO" },
  { id: "hotel",          label: "Hotel" },
  { id: "cafeteria",      label: "Cafetería" },
  { id: "retail",         label: "Retail" },
  { id: "other",          label: "Otros" },
];

export const COUNTRIES = [
  { id: "CO", label: "Colombia" },
  { id: "US", label: "Estados Unidos" },
];

export const KINDS = {
  call:         { label: "Llamada",          icon: "☎", tone: "primary" },
  email:        { label: "Email",            icon: "✉", tone: "primary" },
  meeting:      { label: "Reunión",          icon: "◐", tone: "primary" },
  sample:       { label: "Muestra enviada",  icon: "▸", tone: "accent"  },
  quote:        { label: "Cotización",       icon: "$", tone: "accent"  },
  note:         { label: "Nota",             icon: "✎", tone: "primary" },
  stage_change: { label: "Cambio de etapa",  icon: "→", tone: "accent"  },
  order:        { label: "Pedido",           icon: "☷", tone: "ok"      },
  payment:      { label: "Pago",             icon: "$", tone: "ok"      },
};

export function stageIndex(id) {
  return STAGES.findIndex((s) => s.id === id);
}

export function formatCOP(cents) {
  if (cents == null) return "—";
  const cop = Math.round(cents / 100);
  if (cop >= 1_000_000) return `$ ${(cop / 1_000_000).toFixed(1).replace(/\.0$/, "")} M`;
  if (cop >= 1_000)     return `$ ${(cop / 1_000).toFixed(0)} k`;
  return `$ ${cop}`;
}

// Para valores ya en pesos (p. ej. sales_tracking.total_amount), no en centavos.
export function formatPesos(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}
