import React, { useMemo } from "react";
import styles from "../CRM.module.css";
import Filters from "./Filters.jsx";
import StageChip from "./StageChip.jsx";
import { SEGMENTS, formatCOP, timeAgo } from "./constants.js";
import { useApi } from "../../../lib/api.js";

export default function ClientList({ filters, onFiltersChange, onOpen, onNew }) {
  const apiQuery = useMemo(() => buildQuery(filters), [filters]);
  const { data, loading, error, refetch } = useApi(`/crm/accounts${apiQuery}`, { deps: [apiQuery] });

  const items = useMemo(() => {
    let rows = data?.items ?? [];
    if (filters.stages?.length > 1)   rows = rows.filter((r) => filters.stages.includes(r.pipeline_stage));
    if (filters.segments?.length > 1) rows = rows.filter((r) => filters.segments.includes(r.segment));
    return rows;
  }, [data, filters]);

  return (
    <div>
      <div className={styles.topbar}>
        <div>
          <h1 className={styles.topbar__title}>Cuentas B2B</h1>
          <div className={styles.topbar__sub}>Gestión de pipeline y relaciones comerciales</div>
        </div>
        <button type="button" className={[styles.btn, styles["btn--primary"]].join(" ")} onClick={onNew}>
          + Nueva cuenta
        </button>
      </div>

      <Filters value={filters} onChange={onFiltersChange} total={loading ? null : items.length} />

      {error && (
        <div className={styles.list__empty} role="alert" style={{ color: "var(--danger)" }}>
          No pudimos cargar las cuentas —{" "}
          <button type="button" className={styles.btn} onClick={refetch}>Reintentar</button>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : items.length === 0 ? (
        <p className={styles.list__empty}>Sin resultados. Intente quitar algunos filtros.</p>
      ) : (
        <ul className={styles.list} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((a) => <AccountRow key={a.id} account={a} onOpen={onOpen} />)}
        </ul>
      )}
    </div>
  );
}

function AccountRow({ account, onOpen }) {
  const seg = SEGMENTS.find((s) => s.id === account.segment);
  return (
    <li>
      <button type="button" className={styles.item} onClick={() => onOpen(account.id)}>
        <div className={styles.item__top}>
          <h3 className={styles.item__name}>{account.display_name}</h3>
          <div className={styles.item__badges}>
            <span className={styles.badge}>{account.country}</span>
            {seg && <span className={styles.badge}>{seg.label}</span>}
            <StageChip stage={account.pipeline_stage} />
          </div>
        </div>
        <div className={styles.item__right}>
          <div className={styles.item__ltv}>{formatCOP(account.lifetime_value_cents)}</div>
          <div className={styles.item__when}>
            {account.last_interaction_at ? timeAgo(account.last_interaction_at) : "sin actividad"}
          </div>
        </div>
        {account.legal_name && account.legal_name !== account.display_name && (
          <div className={styles.item__legal}>{account.legal_name}</div>
        )}
        <div className={styles.item__meta}>
          {account.primary_contact_name && <span>contacto · <b>{account.primary_contact_name}</b></span>}
          {account.city && <span>{account.city}{account.region ? `, ${account.region}` : ""}</span>}
          <span>{account.interactions_count ?? 0} interacciones</span>
        </div>
      </button>
    </li>
  );
}

function ListSkeleton({ rows }) {
  return (
    <ul className={styles.list} aria-busy="true" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className={styles.item} style={{ cursor: "default" }}>
          <div>
            <span className={[styles.skel, styles["skel--name"]].join(" ")} />
            <span className={[styles.skel, styles["skel--meta"]].join(" ")} />
          </div>
          <div className={styles.item__right}>
            <span className={[styles.skel, styles["skel--right"]].join(" ")} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function buildQuery(f) {
  const p = new URLSearchParams();
  if (f.stages?.length === 1)   p.set("stage",   f.stages[0]);
  if (f.segments?.length === 1) p.set("segment", f.segments[0]);
  if (f.country)                p.set("country", f.country);
  if (f.q?.trim())              p.set("q",       f.q.trim());
  const s = p.toString();
  return s ? `?${s}` : "";
}
