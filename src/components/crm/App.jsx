import React, { useState } from "react";
import styles from "./CRM.module.css";
import ClientList from "./components/ClientList.jsx";
import ClientCard from "./components/ClientCard.jsx";
import Pipeline   from "./components/Pipeline.jsx";

export default function CrmApp() {
  const [route,   setRoute]   = useState({ name: "list" });
  const [filters, setFilters] = useState({ stages: [], segments: [], country: null, q: "" });

  return (
    <div className={styles.shell}>
      {route.name !== "detail" && (
        <nav style={{ marginBottom: 18 }}>
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab"
                    className={[styles.tab, route.name === "list" ? styles["tab--active"] : ""].join(" ")}
                    onClick={() => setRoute({ name: "list" })}
                    aria-selected={route.name === "list"}>
              Lista
            </button>
            <button type="button" role="tab"
                    className={[styles.tab, route.name === "pipeline" ? styles["tab--active"] : ""].join(" ")}
                    onClick={() => setRoute({ name: "pipeline" })}
                    aria-selected={route.name === "pipeline"}>
              Pipeline
            </button>
          </div>
        </nav>
      )}

      {route.name === "list" && (
        <ClientList
          filters={filters}
          onFiltersChange={setFilters}
          onOpen={(id) => setRoute({ name: "detail", id })}
          onNew={() => alert("TODO: abrir modal Nueva cuenta")}
        />
      )}

      {route.name === "pipeline" && (
        <Pipeline onOpen={(id) => setRoute({ name: "detail", id })} />
      )}

      {route.name === "detail" && (
        <ClientCard
          accountId={route.id}
          onBack={() => setRoute({ name: "list" })}
          onStageChange={() => {}}
        />
      )}
    </div>
  );
}
