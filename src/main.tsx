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

function App() {
  const [loading, setLoading] = React.useState(true);
  const [me, setMe] = React.useState<MeResponse | null>(null);

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      credentials: "include"
    });

    const data = await res.json();
    setMe(data);
  }

  React.useEffect(() => {
    loadMe().finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    window.location.reload();
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
