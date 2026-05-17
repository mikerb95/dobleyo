import React from "react";
import KPICard      from "./components/KPICard.jsx";
import AlertsBanner from "./components/AlertsBanner.jsx";
import ActivityFeed from "./components/ActivityFeed.jsx";
import QuickActions from "./components/QuickActions.jsx";
import { useApi }   from "../../lib/api.js";
import styles       from "./Dashboard.module.css";

export default function Dashboard({ user }) {
  const kpis   = useApi("/dashboard/kpis");
  const alerts = useApi("/dashboard/alerts");
  const feed   = useApi("/dashboard/activity");
  const actions = useQuickActions(user?.role ?? "admin");

  return (
    <main className={styles.shell}>
      <Header user={user} />

      <section className={styles.kpis} aria-label="Indicadores clave">
        {kpis.loading
          ? Array.from({ length: 4 }).map((_, i) => <KPICard key={i} loading tone={["primary","accent","warn","neutral"][i]} />)
          : (kpis.data ?? []).map((k) => (
              <KPICard
                key={k.id}
                label={k.label}
                value={k.value}
                delta={k.delta}
                icon={k.icon}
                tone={k.tone}
                spark={k.spark}
              />
            ))}
        {kpis.error && <ErrorTile message="No pudimos cargar los KPIs." onRetry={kpis.refetch} />}
      </section>

      <AlertsBanner
        alerts={alerts.data}
        loading={alerts.loading}
        onAction={(a) => a.action?.href && (window.location.href = a.action.href)}
      />

      <div className={styles.split}>
        <ActivityFeed items={feed.data} loading={feed.loading} limit={10} />
        <QuickActions actions={actions} />
      </div>

      {feed.error && <ErrorTile message="No pudimos cargar la actividad reciente." onRetry={feed.refetch} />}
    </main>
  );
}

function Header({ user }) {
  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long", day: "2-digit", month: "short", year: "numeric",
  });
  return (
    <header className={styles.header}>
      <div>
        <h1 className={styles.header__hello}>
          Buenos días, {user?.first_name ?? user?.name?.split(" ")[0] ?? "Admin"}
        </h1>
        <div className={styles.header__date}>{capitalize(today)}</div>
      </div>
      <div className={styles.header__right}>
        <div className={styles.avatar} aria-hidden="true">
          {(user?.first_name?.[0] ?? user?.name?.[0] ?? "A").toUpperCase()}
        </div>
      </div>
    </header>
  );
}

function ErrorTile({ message, onRetry }) {
  return (
    <div className={styles.errorTile} role="alert">
      <span>{message}</span>
      <button type="button" className={styles.errorTile__btn} onClick={onRetry}>Reintentar</button>
    </div>
  );
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function useQuickActions(role) {
  const base = [
    { id: "harvest", label: "Registrar cosecha", hint: "Caficultor + lote", icon: "🌱", href: "/app/harvest",         tone: "accent"  },
    { id: "roast",   label: "Programar tostión", hint: "Asignar perfil",    icon: "🔥", href: "/app/send-roasting",    tone: "accent"  },
    { id: "pack",    label: "Empaque",            hint: "250g / 500g / 1kg", icon: "📦", href: "/app/packaging",        tone: "neutral" },
    { id: "sale",    label: "Nueva venta",        hint: "B2B / B2C",         icon: "$",  href: "/admin/mercadolibre",   tone: "primary" },
    { id: "crm",     label: "CRM",                hint: "Cuentas B2B",       icon: "👥", href: "/admin/crm",            tone: "neutral" },
    { id: "prod",    label: "Producción",          hint: "Estado por lote",   icon: "⚙", href: "/admin/produccion",     tone: "neutral" },
  ];
  if (role === "caficultor") return base.filter((a) => ["harvest"].includes(a.id));
  if (role === "provider")   return base.filter((a) => ["sale"].includes(a.id));
  return base;
}
