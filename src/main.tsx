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

type GbpAccountsResponse = {
  ok?: boolean;
  accounts?: Array<{
    id: number;
    accountId: string;
    accountDisplayName: string | null;
    accountType: string | null;
    googleAccountName: string;
  }>;
  error?: string;
};

function App() {
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [accounts, setAccounts] = React.useState<GbpAccountsResponse["accounts"]>([]);
  const [importing, setImporting] = React.useState(false);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      credentials: "include"
    });

    const data = await res.json();
    setMe(data);
    return data as MeResponse;
  }

  async function loadAccounts() {
    setAccountsLoading(true);

    try {
      const res = await fetch("/api/gbp/accounts", {
        credentials: "include"
      });

      const data: GbpAccountsResponse = await res.json();

      if (res.ok && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
      } else {
        setAccounts([]);
      }
    } finally {
      setAccountsLoading(false);
    }
  }

  React.useEffect(() => {
    loadMe()
      .then((data) => {
        if (data?.authenticated) {
          loadAccounts();
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    window.location.reload();
  }

  async function handleImportAccounts() {
    setImporting(true);
    setMessage("");

    try {
      const res = await fetch("/api/gbp/import", {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Erro ao importar contas");
        return;
      }

      setMessage(
        `Importação concluída. ${data.result?.imported ?? 0} novas contas importadas.`
      );

      await loadAccounts();
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        Carregando...
      </div>
    );
  }

  if (!me?.authenticated) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
        <h1>GBP Analyzer</h1>
        <p>Você ainda não está logado.</p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href="/api/auth/google-login">Entrar com Google</a>
          <a href="/api/auth/google-business-connect">
            Entrar com Google + Business
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif" }}>
      <h1>GBP Analyzer</h1>
      <p>Login realizado com sucesso.</p>

      <pre
        style={{
          background: "#f5f5f5",
          padding: 16,
          borderRadius: 8,
          overflow: "auto"
        }}
      >
        {JSON.stringify(me.user, null, 2)}
      </pre>

      <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/api/auth/google-business-connect">
          Conectar Google Business Profile
        </a>
        <button onClick={handleLogout}>Sair</button>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2>Contas GBP</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            onClick={handleImportAccounts}
            disabled={importing || !me.user?.googleBusinessConnected}
          >
            {importing ? "Importando..." : "Importar contas GBP"}
          </button>

          <button onClick={loadAccounts} disabled={accountsLoading}>
            {accountsLoading ? "Carregando..." : "Atualizar lista"}
          </button>
        </div>

        {!me.user?.googleBusinessConnected ? (
          <p>Conecte o Google Business Profile antes de importar as contas.</p>
        ) : null}

        {message ? <p>{message}</p> : null}

        {accountsLoading ? (
          <p>Carregando contas...</p>
        ) : accounts && accounts.length > 0 ? (
          <pre
            style={{
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 8,
              overflow: "auto"
            }}
          >
            {JSON.stringify(accounts, null, 2)}
          </pre>
        ) : (
          <p>Nenhuma conta importada ainda.</p>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
