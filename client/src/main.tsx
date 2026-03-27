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

type ImportResult = {
  accountsImported: number;
  locationsImported: number;
  businessesImported: number;
  accountsDiscovered: number;
  accounts: Array<{
    accountId: string;
    accountName: string | null;
    type: string | null;
    locations: number;
  }>;
};

type AccountRow = {
  id: number;
  googleAccountName: string;
  accountId: string;
  accountDisplayName: string | null;
  accountType: string | null;
  locationsCount: number;
  createdAt: string;
  updatedAt: string;
};

type BusinessRow = {
  id: number;
  name: string;
  primaryCategory: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  source: string;
  googleLocationKey: string;
  createdAt: string;
  updatedAt: string;
  score: number;
  insights: string[];
  breakdown: {
    name: number;
    category: number;
    phone: number;
    website: number;
    city: number;
    verification: number;
    consistencyBonus: number;
  };
  location: {
    id: number;
    googleLocationName: string;
    locationId: string;
    title: string;
    storeCode: string | null;
    languageCode: string | null;
    verificationState: string | null;
    isVerified: boolean;
    lastImportedAt: string | null;
    lastSyncedAt: string | null;
  } | null;
  account: {
    id: number;
    accountId: string;
    accountDisplayName: string | null;
    accountType: string | null;
    googleAccountName: string;
  } | null;
};

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    background: "#fff"
  };
}

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#111827",
    color: disabled ? "#6b7280" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer"
  };
}

function scoreColor(score: number) {
  if (score >= 80) return "#166534";
  if (score >= 60) return "#92400e";
  return "#b91c1c";
}

function App() {
  const [loading, setLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);

  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  const [accounts, setAccounts] = React.useState<AccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [accountsError, setAccountsError] = React.useState<string | null>(null);

  const [businesses, setBusinesses] = React.useState<BusinessRow[]>([]);
  const [businessesLoading, setBusinessesLoading] = React.useState(false);
  const [businessesError, setBusinessesError] = React.useState<string | null>(null);

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("all");

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      credentials: "include"
    });

    if (!res.ok) {
      setAuthenticated(false);
      setUser(null);
      return;
    }

    const data: MeResponse = await res.json();
    setAuthenticated(Boolean(data.authenticated));
    setUser(data.user ?? null);
  }

  async function loadAccounts() {
    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const res = await fetch("/api/gbp/accounts", {
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar contas");
      }

      setAccounts(data.accounts ?? []);
    } catch (error: any) {
      setAccountsError(error?.message || "Erro ao carregar contas");
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadBusinesses(accountId?: string) {
    setBusinessesLoading(true);
    setBusinessesError(null);

    try {
      const query =
        accountId && accountId !== "all"
          ? `?accountId=${encodeURIComponent(accountId)}`
          : "";

      const res = await fetch(`/api/gbp/businesses${query}`, {
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar perfis");
      }

      setBusinesses(data.businesses ?? []);
    } catch (error: any) {
      setBusinessesError(error?.message || "Erro ao carregar perfis");
    } finally {
      setBusinessesLoading(false);
    }
  }

  React.useEffect(() => {
    loadMe()
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (!authenticated || !user?.googleBusinessConnected) return;

    loadAccounts();
    loadBusinesses(selectedAccountId);
  }, [authenticated, user?.googleBusinessConnected, selectedAccountId]);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    window.location.href = "/";
  }

  async function handleImportPortfolio() {
    setImporting(true);
    setImportError(null);

    try {
      const response = await fetch("/api/gbp/import", {
        method: "POST",
        credentials: "include"
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao importar contas");
      }

      setImportResult(data.result);
      await loadAccounts();
      await loadBusinesses(selectedAccountId);
    } catch (error: any) {
      setImportError(error?.message || "Erro ao importar contas");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
        Carregando...
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
        <h1>GBP Analyzer</h1>
        <p>Você ainda não está logado.</p>
        <a href="/api/auth/google-login">Entrar com Google</a>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 32,
        fontFamily: "Arial, sans-serif",
        background: "#f9fafb",
        minHeight: "100vh",
        color: "#111827"
      }}
    >
      <h1 style={{ marginBottom: 8 }}>GBP Analyzer</h1>
      <p style={{ marginTop: 0 }}>Login realizado com sucesso.</p>

      <div style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Usuário autenticado</h2>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(user, null, 2)}</pre>
      </div>

      <div style={cardStyle()}>
        <div>
          <strong>Status do Google Business Profile:</strong>{" "}
          {user?.googleBusinessConnected ? "Conectado" : "Não conectado"}
        </div>

        <div style={{ marginTop: 16 }}>
          {user?.googleBusinessConnected ? (
            <button disabled style={buttonStyle(true)}>
              Google Business Profile conectado
            </button>
          ) : (
            <a href="/api/auth/google-business-connect">
              Conectar Google Business Profile
            </a>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Escopos concedidos:</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(user?.scopes ?? [], null, 2)}
          </pre>
        </div>

        {user?.googleBusinessConnected && (
          <div style={{ marginTop: 16 }}>
            <button onClick={handleImportPortfolio} disabled={importing} style={buttonStyle(importing)}>
              {importing ? "Importando..." : "Importar meus perfis do Google Business"}
            </button>
          </div>
        )}

        {importError && (
          <div style={{ marginTop: 16, color: "crimson" }}>
            <strong>Erro:</strong> {importError}
          </div>
        )}

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <h3>Última importação</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(importResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Contas importadas</h2>

        {accountsLoading ? (
          <p>Carregando contas...</p>
        ) : accountsError ? (
          <p style={{ color: "crimson" }}>{accountsError}</p>
        ) : accounts.length === 0 ? (
          <p>Nenhuma conta importada ainda.</p>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <label>
                Filtrar por conta:{" "}
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  style={{ padding: 8, borderRadius: 8 }}
                >
                  <option value="all">Todas</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.accountId}>
                      {(account.accountDisplayName || account.accountId) +
                        ` (${account.locationsCount})`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {accounts.map((account) => (
                <div key={account.id} style={{ ...cardStyle(), marginTop: 0 }}>
                  <div>
                    <strong>{account.accountDisplayName || account.accountId}</strong>
                  </div>
                  <div>Tipo: {account.accountType || "N/A"}</div>
                  <div>Account ID: {account.accountId}</div>
                  <div>Locations importadas: {account.locationsCount}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={cardStyle()}>
        <h2 style={{ marginTop: 0 }}>Perfis importados</h2>

        {businessesLoading ? (
          <p>Carregando perfis...</p>
        ) : businessesError ? (
          <p style={{ color: "crimson" }}>{businessesError}</p>
        ) : businesses.length === 0 ? (
          <p>Nenhum perfil encontrado para esse filtro.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {businesses.map((business) => (
              <div key={business.id} style={{ ...cardStyle(), marginTop: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                  <strong>{business.name}</strong>
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontWeight: 700,
                      background: "#f3f4f6",
                      color: scoreColor(business.score)
                    }}
                  >
                    Score: {business.score}/100
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  Categoria: {business.primaryCategory || "N/A"}
                </div>
                <div>
                  Cidade/UF: {[business.city, business.state].filter(Boolean).join(" / ") || "N/A"}
                </div>
                <div>Telefone: {business.phone || "N/A"}</div>
                <div>Website: {business.website || "N/A"}</div>

                <div style={{ marginTop: 8 }}>
                  Conta: {business.account?.accountDisplayName || business.account?.accountId || "N/A"}
                </div>
                <div>Tipo da conta: {business.account?.accountType || "N/A"}</div>
                <div>Location ID: {business.location?.locationId || "N/A"}</div>
                <div>Verificado: {business.location?.isVerified ? "Sim" : "Não"}</div>
                <div>Status de verificação: {business.location?.verificationState || "N/A"}</div>

                <div style={{ marginTop: 12 }}>
                  <strong>Diagnóstico inicial:</strong>
                  {business.insights?.length > 0 ? (
                    <ul style={{ marginTop: 8 }}>
                      {business.insights.map((insight, index) => (
                        <li key={index}>{insight}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ marginTop: 8 }}>Nenhum alerta inicial encontrado.</p>
                  )}
                </div>

                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    Ver composição do score
                  </summary>
                  <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                    {JSON.stringify(business.breakdown, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button onClick={handleLogout} style={buttonStyle(false)}>
          Sair
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
