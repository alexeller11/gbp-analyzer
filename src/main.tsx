import React from "react";
import ReactDOM from "react-dom/client";

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string;
    googleOpenId?: string;
    email: string;
    name?: string;
    picture?: string;
    scopes?: string[];
    googleBusinessConnected?: boolean;
  };
};

type DashboardRow = {
  id: number;
  title: string;
  locationId: string;
  isVerified: boolean;
  verificationState: string | null;
  accountId: string | null;
  accountDisplayName: string | null;
  accountType: string | null;
  businessId: number | null;
  businessName: string;
  primaryCategory: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  score: number;
  pipelineStage: string;
  serviceStatus: string;
  priorityLevel: string;
  priorityReason: string | null;
  aiSummary: string | null;
  notes: string | null;
};

type AccountSummary = {
  accountId: string;
  accountDisplayName: string | null;
  accountType: string | null;
  profiles: number;
  withWebsite: number;
  urgent: number;
  attention: number;
  avgScore: number;
};

type DashboardResponse = {
  ok?: boolean;
  summary?: {
    totalProfiles: number;
    totalAccounts: number;
    totalWithWebsite: number;
    totalVerified: number;
    highPriority: number;
    urgentProfiles: number;
    attentionProfiles: number;
  };
  pipelineSummary?: {
    onboarding: number;
    optimization: number;
    monitoring: number;
    recurring: number;
    completed: number;
  };
  accountsSummary?: AccountSummary[];
  topProfiles?: DashboardRow[];
  topOpportunities?: DashboardRow[];
  rows?: DashboardRow[];
};

type TabKey = "overview" | "portfolio" | "accounts";

function shellStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    background: "#f5f7fb",
    fontFamily:
      'Inter, Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#111827"
  };
}

function cardStyle(): React.CSSProperties {
  return {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)"
  };
}

function buttonStyle(variant: "default" | "primary" = "default"): React.CSSProperties {
  if (variant === "primary") {
    return {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid #111827",
      background: "#111827",
      color: "#fff",
      cursor: "pointer",
      fontWeight: 600
    };
  }

  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600
  };
}

function badgeStyle(level: string): React.CSSProperties {
  const map: Record<string, string> = {
    high: "#dc2626",
    medium: "#d97706",
    low: "#2563eb"
  };

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: map[level] || "#6b7280"
  };
}

function serviceStatusStyle(status: string): React.CSSProperties {
  const map: Record<string, string> = {
    active: "#059669",
    attention: "#d97706",
    urgent: "#dc2626",
    paused: "#6b7280"
  };

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: map[status] || "#6b7280"
  };
}

function stageStyle(stage: string): React.CSSProperties {
  const map: Record<string, string> = {
    onboarding: "#2563eb",
    optimization: "#7c3aed",
    monitoring: "#d97706",
    recurring: "#059669",
    completed: "#6b7280"
  };

  return {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    background: map[stage] || "#6b7280"
  };
}

function statCard(title: string, value: number | string) {
  return (
    <div style={cardStyle()}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function App() {
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<TabKey>("overview");
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [dashboard, setDashboard] = React.useState<DashboardResponse | null>(null);
  const [message, setMessage] = React.useState("");
  const [lastResult, setLastResult] = React.useState<any>(null);
  const [query, setQuery] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("all");
  const [stageFilter, setStageFilter] = React.useState("all");
  const [serviceFilter, setServiceFilter] = React.useState("all");
  const [working, setWorking] = React.useState<string | null>(null);
  const [editingBusinessId, setEditingBusinessId] = React.useState<number | null>(null);
  const [editForm, setEditForm] = React.useState({
    primaryCategory: "",
    city: "",
    state: "",
    phone: "",
    website: "",
    pipelineStage: "onboarding",
    notes: ""
  });

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      credentials: "include"
    });
    const data = await res.json();
    setMe(data);
    return data as MeResponse;
  }

  async function loadDashboard() {
    const res = await fetch("/api/gbp/dashboard", {
      credentials: "include"
    });
    const data = await res.json();
    setDashboard(data);
  }

  React.useEffect(() => {
    loadMe()
      .then((data) => {
        if (data?.authenticated) {
          return loadDashboard();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(label: string, endpoint: string) {
    setWorking(label);
    setMessage("");
    setLastResult(null);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || `Erro em ${label}`);
        return;
      }

      setLastResult(data.result);
      setMessage(`${label} concluído com sucesso.`);
      await loadDashboard();
    } finally {
      setWorking(null);
    }
  }

  async function handleSaveBusiness() {
    if (!editingBusinessId) return;

    setWorking("Salvar cliente");
    setMessage("");

    try {
      const res = await fetch(`/api/gbp/businesses/${editingBusinessId}/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(editForm)
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Erro ao salvar cliente");
        return;
      }

      setMessage("Cliente atualizado com sucesso.");
      setEditingBusinessId(null);
      await handleAction("Atualização de scores", "/api/gbp/refresh-scores");
      await handleAction("Atualização de insights", "/api/gbp/refresh-insights");
      await loadDashboard();
    } finally {
      setWorking(null);
    }
  }

  function handleExportCsv() {
    window.open("/api/gbp/export.csv", "_blank");
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    window.location.reload();
  }

  if (loading) {
    return <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>Carregando...</div>;
  }

  if (!me?.authenticated) {
    return (
      <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
        <h1>GBP Analyzer</h1>
        <p>Você ainda não está logado.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="/api/auth/google-login">Entrar com Google</a>
          <a href="/api/auth/google-business-connect">Entrar com Google + Business</a>
        </div>
      </div>
    );
  }

  const rows = Array.isArray(dashboard?.rows) ? dashboard!.rows! : [];
  const accountsSummary = Array.isArray(dashboard?.accountsSummary)
    ? dashboard!.accountsSummary!
    : [];
  const topOpportunities = Array.isArray(dashboard?.topOpportunities)
    ? dashboard!.topOpportunities!
    : [];

  const accounts = Array.from(
    new Map(
      rows
        .filter((row) => row.accountId)
        .map((row) => [row.accountId, row.accountDisplayName || row.accountId])
    ).entries()
  );

  const filteredRows = rows.filter((row) => {
    const matchesQuery =
      !query ||
      row.businessName.toLowerCase().includes(query.toLowerCase()) ||
      (row.city || "").toLowerCase().includes(query.toLowerCase()) ||
      (row.website || "").toLowerCase().includes(query.toLowerCase());

    const matchesAccount = accountFilter === "all" || row.accountId === accountFilter;
    const matchesStage = stageFilter === "all" || row.pipelineStage === stageFilter;
    const matchesService = serviceFilter === "all" || row.serviceStatus === serviceFilter;

    return matchesQuery && matchesAccount && matchesStage && matchesService;
  });

  return (
    <div style={shellStyle()}>
      <div style={{ maxWidth: 1520, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            ...cardStyle(),
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            marginBottom: 20
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 30 }}>GBP Analyzer • Versão Agência</h1>
            <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
              {me.user?.name} • {me.user?.email}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle()} onClick={() => handleAction("Importação de contas", "/api/gbp/import")}>
              Importar contas
            </button>
            <button style={buttonStyle()} onClick={() => handleAction("Importação de perfis", "/api/gbp/import-locations")}>
              Importar perfis
            </button>
            <button style={buttonStyle()} onClick={() => handleAction("Sincronização de detalhes", "/api/gbp/sync-location-details")}>
              Sincronizar detalhes
            </button>
            <button style={buttonStyle()} onClick={() => handleAction("Atualização de scores", "/api/gbp/refresh-scores")}>
              Atualizar scores
            </button>
            <button style={buttonStyle("primary")} onClick={() => handleAction("Atualização de insights", "/api/gbp/refresh-insights")}>
              Gerar insights
            </button>
            <button style={buttonStyle()} onClick={loadDashboard}>Atualizar dashboard</button>
            <button style={buttonStyle()} onClick={handleExportCsv}>Exportar CSV</button>
            <button style={buttonStyle()} onClick={handleLogout}>Sair</button>
          </div>
        </div>

        {message ? (
          <div style={{ ...cardStyle(), marginBottom: 20 }}>
            <strong>{message}</strong>
            {lastResult ? (
              <pre style={{ marginTop: 12, overflow: "auto", maxHeight: 260 }}>
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {[
            { key: "overview", label: "Visão executiva" },
            { key: "portfolio", label: "Carteira" },
            { key: "accounts", label: "Contas" }
          ].map((tab) => (
            <button
              key={tab.key}
              style={buttonStyle(activeTab === tab.key ? "primary" : "default")}
              onClick={() => setActiveTab(tab.key as TabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 20
              }}
            >
              {statCard("Perfis", dashboard?.summary?.totalProfiles ?? 0)}
              {statCard("Contas", dashboard?.summary?.totalAccounts ?? 0)}
              {statCard("Com site", dashboard?.summary?.totalWithWebsite ?? 0)}
              {statCard("Verificados", dashboard?.summary?.totalVerified ?? 0)}
              {statCard("Urgentes", dashboard?.summary?.urgentProfiles ?? 0)}
              {statCard("Atenção", dashboard?.summary?.attentionProfiles ?? 0)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 20
              }}
            >
              {statCard("Onboarding", dashboard?.pipelineSummary?.onboarding ?? 0)}
              {statCard("Otimização", dashboard?.pipelineSummary?.optimization ?? 0)}
              {statCard("Acompanhamento", dashboard?.pipelineSummary?.monitoring ?? 0)}
              {statCard("Recorrente", dashboard?.pipelineSummary?.recurring ?? 0)}
              {statCard("Concluído", dashboard?.pipelineSummary?.completed ?? 0)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20
              }}
            >
              <div style={cardStyle()}>
                <div style={{ marginBottom: 14, fontWeight: 700 }}>Clientes com maior prioridade</div>
                <div style={{ overflow: "auto", maxHeight: 420 }}>
                  {topOpportunities.map((item) => (
                    <div key={item.id} style={{ borderBottom: "1px solid #f0f2f5", padding: "12px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <strong>{item.businessName}</strong>
                        <span style={badgeStyle(item.priorityLevel)}>{item.priorityLevel}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        {item.accountDisplayName || "-"} • Score {item.score}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        {item.priorityReason || "Sem motivo registrado."}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={cardStyle()}>
                <div style={{ marginBottom: 14, fontWeight: 700 }}>Resumo por conta</div>
                <div style={{ overflow: "auto", maxHeight: 420 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "10px 8px" }}>Conta</th>
                        <th style={{ padding: "10px 8px" }}>Perfis</th>
                        <th style={{ padding: "10px 8px" }}>Urgentes</th>
                        <th style={{ padding: "10px 8px" }}>Atenção</th>
                        <th style={{ padding: "10px 8px" }}>Score médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsSummary.map((item) => (
                        <tr key={item.accountId} style={{ borderBottom: "1px solid #f0f2f5" }}>
                          <td style={{ padding: "10px 8px" }}>{item.accountDisplayName || item.accountId}</td>
                          <td style={{ padding: "10px 8px" }}>{item.profiles}</td>
                          <td style={{ padding: "10px 8px" }}>{item.urgent}</td>
                          <td style={{ padding: "10px 8px" }}>{item.attention}</td>
                          <td style={{ padding: "10px 8px", fontWeight: 700 }}>{item.avgScore}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {activeTab === "portfolio" ? (
          <>
            <div style={{ ...cardStyle(), marginBottom: 20 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr",
                  gap: 12
                }}
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por empresa, cidade ou site"
                  style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
                />

                <select
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
                >
                  <option value="all">Todas as contas</option>
                  {accounts.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>

                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
                >
                  <option value="all">Todos os estágios</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="optimization">Otimização</option>
                  <option value="monitoring">Acompanhamento</option>
                  <option value="recurring">Recorrente</option>
                  <option value="completed">Concluído</option>
                </select>

                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativo</option>
                  <option value="attention">Atenção</option>
                  <option value="urgent">Urgente</option>
                  <option value="paused">Pausado</option>
                </select>
              </div>
            </div>

            <div style={cardStyle()}>
              <div style={{ marginBottom: 12, fontWeight: 700 }}>
                Carteira de clientes ({filteredRows.length})
              </div>

              <div style={{ overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ padding: "10px 8px" }}>Empresa</th>
                      <th style={{ padding: "10px 8px" }}>Conta</th>
                      <th style={{ padding: "10px 8px" }}>Pipeline</th>
                      <th style={{ padding: "10px 8px" }}>Status</th>
                      <th style={{ padding: "10px 8px" }}>Prioridade</th>
                      <th style={{ padding: "10px 8px" }}>Score</th>
                      <th style={{ padding: "10px 8px" }}>Cidade</th>
                      <th style={{ padding: "10px 8px" }}>Resumo IA</th>
                      <th style={{ padding: "10px 8px" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                        <td style={{ padding: "10px 8px" }}>{row.businessName}</td>
                        <td style={{ padding: "10px 8px" }}>{row.accountDisplayName || "-"}</td>
                        <td style={{ padding: "10px 8px" }}>
                          <span style={stageStyle(row.pipelineStage)}>{row.pipelineStage}</span>
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <span style={serviceStatusStyle(row.serviceStatus)}>{row.serviceStatus}</span>
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <span style={badgeStyle(row.priorityLevel)}>{row.priorityLevel}</span>
                        </td>
                        <td style={{ padding: "10px 8px", fontWeight: 700 }}>{row.score}</td>
                        <td style={{ padding: "10px 8px" }}>
                          {[row.city, row.state].filter(Boolean).join(" / ") || "-"}
                        </td>
                        <td style={{ padding: "10px 8px", maxWidth: 320 }}>
                          <span style={{ fontSize: 13, color: "#4b5563" }}>{row.aiSummary || "-"}</span>
                        </td>
                        <td style={{ padding: "10px 8px" }}>
                          <button
                            style={buttonStyle()}
                            onClick={() => {
                              setEditingBusinessId(row.businessId || null);
                              setEditForm({
                                primaryCategory: row.primaryCategory || "",
                                city: row.city || "",
                                state: row.state || "",
                                phone: row.phone || "",
                                website: row.website || "",
                                pipelineStage: row.pipelineStage || "onboarding",
                                notes: row.notes || ""
                              });
                            }}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {activeTab === "accounts" ? (
          <div style={cardStyle()}>
            <div style={{ marginBottom: 12, fontWeight: 700 }}>Contas conectadas</div>
            <div style={{ overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 8px" }}>Conta</th>
                    <th style={{ padding: "10px 8px" }}>Perfis</th>
                    <th style={{ padding: "10px 8px" }}>Com site</th>
                    <th style={{ padding: "10px 8px" }}>Urgentes</th>
                    <th style={{ padding: "10px 8px" }}>Atenção</th>
                    <th style={{ padding: "10px 8px" }}>Score médio</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsSummary.map((item) => (
                    <tr key={item.accountId} style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 8px" }}>{item.accountDisplayName || item.accountId}</td>
                      <td style={{ padding: "10px 8px" }}>{item.profiles}</td>
                      <td style={{ padding: "10px 8px" }}>{item.withWebsite}</td>
                      <td style={{ padding: "10px 8px" }}>{item.urgent}</td>
                      <td style={{ padding: "10px 8px" }}>{item.attention}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 700 }}>{item.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {editingBusinessId ? (
          <div style={{ ...cardStyle(), marginTop: 20 }}>
            <div style={{ marginBottom: 12, fontWeight: 700 }}>Editar cliente</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12
              }}
            >
              <input
                placeholder="Categoria"
                value={editForm.primaryCategory}
                onChange={(e) => setEditForm({ ...editForm, primaryCategory: e.target.value })}
                style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Cidade"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Estado"
                value={editForm.state}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Telefone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Website"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
              />
              <select
                value={editForm.pipelineStage}
                onChange={(e) => setEditForm({ ...editForm, pipelineStage: e.target.value })}
                style={{ padding: 12, borderRadius: 12, border: "1px solid #d1d5db" }}
              >
                <option value="onboarding">Onboarding</option>
                <option value="optimization">Otimização</option>
                <option value="monitoring">Acompanhamento</option>
                <option value="recurring">Recorrente</option>
                <option value="completed">Concluído</option>
              </select>
            </div>

            <textarea
              placeholder="Notas internas"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              style={{
                width: "100%",
                marginTop: 12,
                minHeight: 100,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #d1d5db"
              }}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <button style={buttonStyle("primary")} onClick={handleSaveBusiness}>
                Salvar
              </button>
              <button style={buttonStyle()} onClick={() => setEditingBusinessId(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
