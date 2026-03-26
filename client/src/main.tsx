import React from "react";
import ReactDOM from "react-dom/client";

type MeResponse = {
  authenticated: boolean;
  user?: {
    id: string;
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
  accounts: Array<{
    accountId: string;
    accountName: string | null;
    locations: number;
  }>;
};

function App() {
  const [loading, setLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me", {
      credentials: "include"
    })
      .then(async (res) => {
        if (!res.ok) {
          setAuthenticated(false);
          setUser(null);
          return;
        }

        const data: MeResponse = await res.json();
        setAuthenticated(Boolean(data.authenticated));
        setUser(data.user ?? null);
      })
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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
    <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1>GBP Analyzer</h1>
      <p>Login realizado com sucesso.</p>

      <pre>{JSON.stringify(user, null, 2)}</pre>

      <div style={{ marginTop: 16 }}>
        <strong>Status do Google Business Profile:</strong>{" "}
        {user?.googleBusinessConnected ? "Conectado" : "Não conectado"}
      </div>

      <div style={{ marginTop: 16 }}>
        {user?.googleBusinessConnected ? (
          <button disabled style={{ opacity: 0.7, cursor: "not-allowed" }}>
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
        <pre>{JSON.stringify(user?.scopes ?? [], null, 2)}</pre>
      </div>

      {user?.googleBusinessConnected && (
        <div style={{ marginTop: 24 }}>
          <button onClick={handleImportPortfolio} disabled={importing}>
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
        <div style={{ marginTop: 24 }}>
          <h2>Importação concluída</h2>
          <pre>{JSON.stringify(importResult, null, 2)}</pre>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button onClick={handleLogout}>Sair</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
