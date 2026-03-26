import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  const [loading, setLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);

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

        const data = await res.json();
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
        <a href="/api/auth/google-business-connect">Conectar Google Business Profile</a>
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
