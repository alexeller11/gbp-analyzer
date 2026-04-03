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
  leadType: string;
};

type AccountSummary = {
  accountId: string;
  accountDisplayName: string | null;
  accountType: string | null;
  profiles: number;
  clients: number;
  prospects: number;
  withWebsite: number;
  avgScore: number;
};

type DashboardResponse = {
  ok?: boolean;
  summary?: {
    totalProfiles: number;
    totalAccounts: number;
    totalClients: number;
    totalProspects: number;
    totalWithWebsite: number;
    totalVerified: number;
  };
  accountsSummary?: AccountSummary[];
  topProfiles?: DashboardRow[];
  rows?: DashboardRow[];
};

function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
  };
}

function buttonStyle(): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer"
  };
}

function App() {
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [dashboard, setDashboard] = React.useState<DashboardResponse | null>(null);
  const [message, setMessage] = React.useState("");
  const [lastResult, setLastResult] = React.useState<any>(null);
  const [query, setQuery] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("all");
  const [leadFilter, setLeadFilter] = React.useState("all");
  const [working, setWorking] = React.useState<string | null>(null);
  const [editingBusinessId, setEditingBusinessId] = React.useState<number | null>(null);
  const [editForm, setEditForm] = React.useState({
    primaryCategory: "",
    city: "",
    state: "",
    phone: "",
    website: "",
    leadType: "prospect"
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

    setWorking("Salvar empresa");
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
        setMessage(data?.error || "Erro ao salvar empresa");
        return;
      }

      setMessage("Empresa atualizada com sucesso.");
      setEditingBusinessId(null);
      await handleAction("Atualização de scores", "/api/gbp/refresh-scores");
      await loadDashboard();
    } finally {
      setWorking(null);
    }
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
  const topProfiles = Array.isArray(dashboard?.topProfiles)
    ? dashboard!.topProfiles!
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

    const matchesAccount =
      accountFilter === "all" || row.accountId === accountFilter;

    const matchesLead =
      leadFilter === "all" || row.leadType === leadFilter;

    return matchesQuery && matchesAccount && matchesLead;
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        fontFamily: "Arial, sans-serif",
        color: "#111827"
      }}
    >
      <div style={{ maxWidth: 1450, margin: "0 auto", padding: 24 }}>
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
            <h1 style={{ margin: 0, fontSize: 28 }}>GBP Analyzer • Modo Agência</h1>
            <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
              {me.user?.name} • {me.user?.email}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={buttonStyle()} onClick={() => handleAction("Importação de contas", "/api/gbp/import")}>
              {working === "Importação de contas" ? "Processando..." : "Importar contas"}
            </button>
            <button style={buttonStyle()} onClick={() => handleAction("Importação de perfis", "/api/gbp/import-locations")}>
              {working === "Importação de perfis" ? "Processando..." : "Importar perfis"}
            </button>
            <button style={buttonStyle()} onClick={() => handleAction("Sincronização de detalhes", "/api/gbp/sync-location-details")}>
              {working === "Sincronização de detalhes" ? "Processando..." : "Sincronizar detalhes"}
            </button>
            <button style={buttonStyle()} onClick={() => handleAction("Atualização de scores", "/api/gbp/refresh-scores")}>
              {working === "Atualização de scores" ? "Processando..." : "Atualizar scores"}
            </button>
            <button style={buttonStyle()} onClick={loadDashboard}>Atualizar dashboard</button>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 20
          }}
        >
          <div style={cardStyle()}><div style={{ fontSize: 12, color: "#6b7280" }}>Perfis</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.summary?.totalProfiles ?? 0}</div></div>
          <div style={cardStyle()}><div style={{ fontSize: 12, color: "#6b7280" }}>Contas</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.summary?.totalAccounts ?? 0}</div></div>
          <div style={cardStyle()}><div style={{ fontSize: 12, color: "#6b7280" }}>Clientes</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.summary?.totalClients ?? 0}</div></div>
          <div style={cardStyle()}><div style={{ fontSize: 12, color: "#6b7280" }}>Prospects</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.summary?.totalProspects ?? 0}</div></div>
          <div style={cardStyle()}><div style={{ fontSize: 12, color: "#6b7280" }}>Com site</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.summary?.totalWithWebsite ?? 0}</div></div>
          <div style={cardStyle()}><div style={{ fontSize: 12, color: "#6b7280" }}>Verificados</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard?.summary?.totalVerified ?? 0}</div></div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 20,
            marginBottom: 20
          }}
        >
          <div style={cardStyle()}>
            <div style={{ marginBottom: 14, fontWeight: 700 }}>Resumo por conta</div>
            <div style={{ overflow: "auto", maxHeight: 320 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 8px" }}>Conta</th>
                    <th style={{ padding: "10px 8px" }}>Perfis</th>
                    <th style={{ padding: "10px 8px" }}>Clientes</th>
                    <th style={{ padding: "10px 8px" }}>Prospects</th>
                    <th style={{ padding: "10px 8px" }}>Com site</th>
                    <th style={{ padding: "10px 8px" }}>Score médio</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsSummary.map((item) => (
                    <tr key={item.accountId} style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 8px" }}>{item.accountDisplayName || item.accountId}</td>
                      <td style={{ padding: "10px 8px" }}>{item.profiles}</td>
                      <td style={{ padding: "10px 8px" }}>{item.clients}</td>
                      <td style={{ padding: "10px 8px" }}>{item.prospects}</td>
                      <td style={{ padding: "10px 8px" }}>{item.withWebsite}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 700 }}>{item.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle()}>
            <div style={{ marginBottom: 14, fontWeight: 700 }}>Top perfis por score</div>
            <div style={{ overflow: "auto", maxHeight: 320 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 8px" }}>Empresa</th>
                    <th style={{ padding: "10px 8px" }}>Conta</th>
                    <th style={{ padding: "10px 8px" }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {topProfiles.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "10px 8px" }}>{item.businessName}</td>
                      <td style={{ padding: "10px 8px" }}>{item.accountDisplayName || "-"}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 700 }}>{item.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle(), marginBottom: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 12
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por empresa, cidade ou site"
              style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
            />

            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="all">Todas as contas</option>
              {accounts.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>

            <select
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value)}
              style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
            >
              <option value="all">Todos os tipos</option>
              <option value="client">Clientes</option>
              <option value="prospect">Prospects</option>
            </select>
          </div>
        </div>

        <div style={cardStyle()}>
          <div style={{ marginBottom: 12, fontWeight: 700 }}>
            Perfis importados ({filteredRows.length})
          </div>

          <div style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "10px 8px" }}>Empresa</th>
                  <th style={{ padding: "10px 8px" }}>Conta</th>
                  <th style={{ padding: "10px 8px" }}>Tipo</th>
                  <th style={{ padding: "10px 8px" }}>Score</th>
                  <th style={{ padding: "10px 8px" }}>Categoria</th>
                  <th style={{ padding: "10px 8px" }}>Cidade</th>
                  <th style={{ padding: "10px 8px" }}>Site</th>
                  <th style={{ padding: "10px 8px" }}>Verificado</th>
                  <th style={{ padding: "10px 8px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f0f2f5" }}>
                    <td style={{ padding: "10px 8px" }}>{row.businessName}</td>
                    <td style={{ padding: "10px 8px" }}>{row.accountDisplayName || "-"}</td>
                    <td style={{ padding: "10px 8px" }}>{row.leadType}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 700 }}>{row.score}</td>
                    <td style={{ padding: "10px 8px" }}>{row.primaryCategory || "-"}</td>
                    <td style={{ padding: "10px 8px" }}>{[row.city, row.state].filter(Boolean).join(" / ") || "-"}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {row.website ? <a href={row.website} target="_blank" rel="noreferrer">abrir</a> : "-"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>{row.isVerified ? "Sim" : "Não"}</td>
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
                            leadType: row.leadType || "prospect"
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

        {editingBusinessId ? (
          <div style={{ ...cardStyle(), marginTop: 20 }}>
            <div style={{ marginBottom: 12, fontWeight: 700 }}>Editar empresa</div>

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
                style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Cidade"
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Estado"
                value={editForm.state}
                onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Telefone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
              />
              <input
                placeholder="Website"
                value={editForm.website}
                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
              />
              <select
                value={editForm.leadType}
                onChange={(e) => setEditForm({ ...editForm, leadType: e.target.value })}
                style={{ padding: 12, borderRadius: 10, border: "1px solid #d1d5db" }}
              >
                <option value="client">Cliente</option>
                <option value="prospect">Prospect</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <button style={buttonStyle()} onClick={handleSaveBusiness}>
                Salvar
              </button>
              <button
                style={buttonStyle()}
                onClick={() => setEditingBusinessId(null)}
              >
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
