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

type GbpAccount = {
  id: number;
  accountId: string;
  accountDisplayName: string | null;
  accountType: string | null;
  googleAccountName: string;
};

type GbpLocation = {
  id: number;
  title: string;
  locationId: string;
  googleLocationName: string;
  verificationState: string | null;
  isVerified: boolean;
  account: {
    id: number;
    accountId: string;
    accountDisplayName: string | null;
    accountType: string | null;
  } | null;
  business: {
    id: number;
    name: string;
    primaryCategory: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    website: string | null;
  } | null;
};

function App() {
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<MeResponse | null>(null);
  const [accounts, setAccounts] = React.useState<GbpAccount[]>([]);
  const [locations, setLocations] = React.useState<GbpLocation[]>([]);
  const [importingAccounts, setImportingAccounts] = React.useState(false);
  const [importingLocations, setImportingLocations] = React.useState(false);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [locationsLoading, setLocationsLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [lastImportResult, setLastImportResult] = React.useState<any>(null);

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

      const data = await res.json();
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadLocations() {
    setLocationsLoading(true);

    try {
      const res = await fetch("/api/gbp/locations", {
        credentials: "include"
      });

      const data = await res.json();
      setLocations(Array.isArray(data.locations) ? data.locations : []);
    } finally {
      setLocationsLoading(false);
    }
  }

  React.useEffect(() => {
    loadMe()
      .then((data) => {
        if (data?.authenticated) {
          loadAccounts();
          loadLocations();
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
    setImportingAccounts(true);
    setMessage("");
    setLastImportResult(null);

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

      setLastImportResult(data.result);
      setMessage(
        `Importação de contas concluída. ${data.result?.imported ?? 0} novas contas importadas.`
      );

      await loadAccounts();
    } finally {
      setImportingAccounts(false);
    }
  }

  async function handleImportLocations() {
    setImportingLocations(true);
    setMessage("");
    setLastImportResult(null);

    try {
      const res = await fetch("/api/gbp/import-locations", {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Erro ao importar perfis");
        return;
      }

      setLastImportResult(data.result);
      setMessage(
        `Importação de perfis concluída. ${data.result?.locationsImported ?? 0} novos perfis importados.`
      );

      await loadLocations();
    } finally {
      setImportingLocations(false);
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
            disabled={importingAccounts || !me.user?.googleBusinessConnected}
          >
            {importingAccounts ? "Importando contas..." : "Importar contas GBP"}
          </button>

          <button onClick={loadAccounts} disabled={accountsLoading}>
            {accountsLoading ? "Carregando..." : "Atualizar contas"}
          </button>
        </div>

        {accounts.length > 0 ? (
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

      <div style={{ marginTop: 24 }}>
        <h2>Perfis / Locations</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <button
            onClick={handleImportLocations}
            disabled={importingLocations || !me.user?.googleBusinessConnected}
          >
            {importingLocations ? "Importando perfis..." : "Importar todos os perfis"}
          </button>

          <button onClick={loadLocations} disabled={locationsLoading}>
            {locationsLoading ? "Carregando..." : "Atualizar perfis"}
          </button>
        </div>

        {message ? <p>{message}</p> : null}

        {lastImportResult ? (
          <pre
            style={{
              background: "#eef6ff",
              padding: 16,
              borderRadius: 8,
              overflow: "auto",
              maxHeight: 400
            }}
          >
            {JSON.stringify(lastImportResult, null, 2)}
          </pre>
        ) : null}

        {locations.length > 0 ? (
          <pre
            style={{
              background: "#f5f5f5",
              padding: 16,
              borderRadius: 8,
              overflow: "auto",
              maxHeight: 500
            }}
          >
            {JSON.stringify(locations, null, 2)}
          </pre>
        ) : (
          <p>Nenhum perfil importado ainda.</p>
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
