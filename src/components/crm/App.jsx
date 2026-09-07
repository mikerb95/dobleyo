import React, { useState } from "react";
import styles from "./CRM.module.css";
import ClientList from "./components/ClientList.jsx";
import ClientCard from "./components/ClientCard.jsx";
import Pipeline   from "./components/Pipeline.jsx";
import NewAccountModal from "./components/NewAccountModal.jsx";

export default function CrmApp() {
  const [route,   setRoute]   = useState({ name: "list" });
  const [filters, setFilters] = useState({ stages: [], segments: [], country: null, q: "" });
  const [newOpen,   setNewOpen]   = useState(false);
  // Se incrementa al crear una cuenta para que ClientList vuelva a consultar la API.
  const [reloadKey, setReloadKey] = useState(0);

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
          reloadKey={reloadKey}
          onOpen={(id) => setRoute({ name: "detail", id })}
          onNew={() => setNewOpen(true)}
        />
      )}

      {route.name === "pipeline" && (
        <Pipeline onOpen={(id) => setRoute({ name: "detail", id })} />
      )}

      <NewAccountModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={(account) => {
          setNewOpen(false);
          setReloadKey((k) => k + 1);
          if (account?.id) setRoute({ name: "detail", id: account.id });
        }}
      />

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
