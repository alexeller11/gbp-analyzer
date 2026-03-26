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

function App() {
  const [loading, setLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);

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
