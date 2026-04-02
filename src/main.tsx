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
  rows?: DashboardRow[];
};

function cardStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
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

  async function handleAction(
    label: string,
    endpoint: string
  ) {
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
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
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
            <button onClick={() => handleAction("Importação de contas", "/api/gbp/import")}>
              {working === "Importação de contas" ? "Processando..." : "Importar contas"}
            </button>
            <button onClick={() => handleAction("Importação de perfis", "/api/gbp/import-locations")}>
              {working === "Importação de perfis" ? "Processando..." : "Importar perfis"}
            </button>
            <button onClick={() => handleAction("Sincronização de detalhes", "/api/gbp/sync-location-details")}>
              {working === "Sincronização de detalhes" ? "Processando..." : "Sincronizar detalhes"}
            </button>
            <button onClick={() => handleAction("Atualização de scores", "/api/gbp/refresh-scores")}>
              {working === "Atualização de scores" ? "Processando..." : "Atualizar scores"}
            </button>
            <button onClick={loadDashboard}>Atualizar dashboard</button>
            <button onClick={handleLogout}>Sair</button>
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
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Perfis</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {dashboard?.summary?.totalProfiles ?? 0}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Contas</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {dashboard?.summary?.totalAccounts ?? 0}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Clientes</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {dashboard?.summary?.totalClients ?? 0}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Prospects</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {dashboard?.summary?.totalProspects ?? 0}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Com site</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {dashboard?.summary?.totalWithWebsite ?? 0}
            </div>
          </div>
          <div style={cardStyle()}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Verificados</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {dashboard?.summary?.totalVerified ?? 0}
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
                <option key={id} value={id}>
                  {name}
                </option>
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
                    <td style={{ padding: "10px 8px" }}>
                      {[row.city, row.state].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {row.website ? (
                        <a href={row.website} target="_blank" rel="noreferrer">
                          abrir
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {row.isVerified ? "Sim" : "Não"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
