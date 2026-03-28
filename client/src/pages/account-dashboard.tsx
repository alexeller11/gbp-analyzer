import React from "react";

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
  portfolioType: string;
  notes: string | null;
  aiSummaryJson: {
    summary?: string;
    rankingDiagnosis?: string;
    priorities?: string[];
    opportunityAnalysis?: string;
    pitch?: string;
  } | null;
  lastAiAnalysisAt: string | null;
  createdAt: string;
  updatedAt: string;
  score: number;
  opportunityScore: number;
  opportunityLevel: "baixa" | "media" | "alta";
  insights: string[];
  priorities: string[];
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

type Props = {
  account: AccountRow | null;
  businesses: BusinessRow[];
};

const ui = {
  wrap: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)"
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 900,
    letterSpacing: "-0.02em"
  } as React.CSSProperties,
  sub: {
    margin: "8px 0 0",
    color: "#6b7280",
    fontSize: "14px"
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
    marginTop: "18px"
  } as React.CSSProperties,
  card: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px"
  } as React.CSSProperties,
  label: {
    color: "#6b7280",
    fontSize: "13px",
    marginBottom: "8px"
  } as React.CSSProperties,
  value: {
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    margin: 0
  } as React.CSSProperties,
  panels: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "14px",
    marginTop: "18px"
  } as React.CSSProperties,
  panel: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px"
  } as React.CSSProperties,
  panelTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 800
  } as React.CSSProperties,
  list: {
    margin: "12px 0 0 18px",
    color: "#374151"
  } as React.CSSProperties
};

function averageScore(items: BusinessRow[]) {
  if (!items.length) return 0;
  return Math.round(items.reduce((acc, item) => acc + item.score, 0) / items.length);
}

export default function AccountDashboard({ account, businesses }: Props) {
  const title = account?.accountDisplayName || "Visão geral da carteira";
  const total = businesses.length;
  const avg = averageScore(businesses);
  const verified = businesses.filter(
    (b) => b.location?.isVerified || b.location?.verificationState === "VERIFIED"
  ).length;
  const highOpp = businesses.filter((b) => b.opportunityLevel === "alta").length;
  const clients = businesses.filter((b) => b.portfolioType === "client").length;
  const prospects = businesses.filter((b) => b.portfolioType === "prospect").length;
  const noWebsite = businesses.filter((b) => !b.website).length;
  const noPhone = businesses.filter((b) => !b.phone).length;
  const critical = businesses.filter((b) => b.score < 50).length;

  const weakest = [...businesses].sort((a, b) => a.score - b.score).slice(0, 5);
  const hottest = [...businesses]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  return (
    <div style={ui.wrap}>
      <h2 style={ui.title}>{title}</h2>
      <p style={ui.sub}>
        {account
          ? `Conta ${account.accountType || "N/A"} • ${account.accountId}`
          : "Resumo consolidado das contas e perfis importados"}
      </p>

      <div style={ui.grid}>
        <div style={ui.card}>
          <div style={ui.label}>Perfis</div>
          <p style={ui.value}>{total}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Score médio</div>
          <p style={ui.value}>{avg}/100</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Verificados</div>
          <p style={ui.value}>{verified}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Críticos</div>
          <p style={ui.value}>{critical}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Oportunidades altas</div>
          <p style={ui.value}>{highOpp}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Clientes</div>
          <p style={ui.value}>{clients}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Prospects</div>
          <p style={ui.value}>{prospects}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Sem site</div>
          <p style={ui.value}>{noWebsite}</p>
        </div>

        <div style={ui.card}>
          <div style={ui.label}>Sem telefone</div>
          <p style={ui.value}>{noPhone}</p>
        </div>
      </div>

      <div style={ui.panels}>
        <div style={ui.panel}>
          <h3 style={ui.panelTitle}>Perfis mais fracos</h3>
          {weakest.length === 0 ? (
            <p>Nenhum perfil encontrado.</p>
          ) : (
            <ul style={ui.list}>
              {weakest.map((item) => (
                <li key={item.id}>
                  {item.name} — {item.score}/100
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={ui.panel}>
          <h3 style={ui.panelTitle}>Maiores oportunidades</h3>
          {hottest.length === 0 ? (
            <p>Nenhum perfil encontrado.</p>
          ) : (
            <ul style={ui.list}>
              {hottest.map((item) => (
                <li key={item.id}>
                  {item.name} — {item.opportunityLevel} ({item.opportunityScore}/100)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
