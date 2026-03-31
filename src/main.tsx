import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h1>🚀 GBP Analyzer Online</h1>
      <p>Seu sistema está rodando com sucesso.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
