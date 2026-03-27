import React from "react";

export default function AccountDashboard({ account, businesses }) {
  const total = businesses.length;
  const avgScore =
    total > 0
      ? Math.round(
          businesses.reduce((acc, b) => acc + b.score, 0) / total
        )
      : 0;

  const verified = businesses.filter(b => b.location?.isVerified).length;
  const highOpportunity = businesses.filter(b => b.opportunityLevel === "alta").length;
  const prospects = businesses.filter(b => b.portfolioType === "prospect").length;
  const clients = businesses.filter(b => b.portfolioType === "client").length;

  return (
    <div style={{ padding: 20 }}>
      <h2>{account.accountDisplayName || account.accountId}</h2>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <Card title="Perfis" value={total} />
        <Card title="Score médio" value={`${avgScore}/100`} />
        <Card title="Verificados" value={verified} />
        <Card title="Oportunidades altas" value={highOpportunity} />
        <Card title="Prospects" value={prospects} />
        <Card title="Clientes" value={clients} />
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div
      style={{
        background: "#fff",
        padding: 16,
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        minWidth: 140
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}
