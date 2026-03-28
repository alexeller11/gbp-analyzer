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
  account: AccountRow;
  businesses: BusinessRow[];
  onBack: () => void;
};

const styles = {
  wrapper: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    padding: "20px",
    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
    marginBottom: "18px"
  } as React.CSSProperties,
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap"
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 900,
    letterSpacing: "-0.02em"
  } as React.CSSProperties,
  subtitle: {
    margin: "8px 0 0",
    color: "#6b7280",
    fontSize: "14px"
  } as React.CSSProperties,
  backButton: {
    background: "#fff",
    color: "#111827",
    border: "1px solid #d1d5db",
    borderRadius: "12px",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer"
  } as React.CSSProperties,
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginTop: "18px"
  } as React.CSSProperties,
  statCard: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px"
  } as React.CSSProperties,
  statLabel: {
    color: "#6b7280",
    fontSize: "13px",
    marginBottom: "8px"
  } as React.CSSProperties,
  statValue: {
    fontSize: "28px",
    fontWeight: 900,
    letterSpacing: "-0.02em",
    margin: 0
  } as React.CSSProperties,
  subGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
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
  } as React.CSSProperties,
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px"
  } as React.CSSProperties,
  chip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#374151",
    fontSize: "12px",
    fontWeight: 700
  } as React.CSSProperties
};

function avgScore(businesses: BusinessRow[]) {
  if (!businesses.length) return 0;
  return Math.round(
    businesses.reduce((acc, item) => acc + item.score, 0) / businesses.length
  );
}

export default function AccountDashboard({
  account,
  businesses,
  onBack
}: Props) {
  const total = businesses.length;
  const average = avgScore(businesses);
  const verified = businesses.filter((b) => {
    return (
      b.location?.isVerified ||
      b.location?.verificationState === "VERIFIED"
    );
  }).length;

  const highOpportunity = businesses.filter(
    (b) => b.opportunityLevel === "alta"
  ).length;

  const prospects = businesses.filter(
    (b) => b.portfolioType === "prospect"
  ).length;

  const clients = businesses.filter((b) => b.portfolioType === "client").length;
  const noWebsite = businesses.filter((b) => !b.website).length;
  const noPhone = businesses.filter((b) => !b.phone).length;
  const critical = businesses.filter((b) => b.score < 50).length;

  const topOpportunities = [...businesses]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 5);

  const weakestProfiles = [...businesses]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return (
    <div style={styles.wrapper}>
      <div style={styles.topRow}>
        <div>
          <h2 style={styles.title}>
            {account.accountDisplayName || account.accountId}
          </h2>
          <p style={styles.subtitle}>
            Tipo: {account.accountType || "N/A"} • Account ID: {account.accountId}
          </p>

          <div style={styles.chipRow}>
            <span style={styles.chip}>
              {account.locationsCount} perfil(is)
            </span>
            <span style={styles.chip}>
              Score médio {average}/100
            </span>
            <span style={styles.chip}>
              {highOpportunity} oportunidade(s) alta(s)
            </span>
          </div>
        </div>

        <button onClick={onBack} style={styles.backButton}>
          Voltar para visão geral
        </button>
      </div>

      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Perfis</div>
          <p style={styles.statValue}>{total}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Score médio</div>
          <p style={styles.statValue}>{average}/100</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Verificados</div>
          <p style={styles.statValue}>{verified}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Críticos</div>
          <p style={styles.statValue}>{critical}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Prospects</div>
          <p style={styles.statValue}>{prospects}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Clientes</div>
          <p style={styles.statValue}>{clients}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Sem site</div>
          <p style={styles.statValue}>{noWebsite}</p>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Sem telefone</div>
          <p style={styles.statValue}>{noPhone}</p>
        </div>
      </div>

      <div style={styles.subGrid}>
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Perfis mais fracos</h3>
          {weakestProfiles.length === 0 ? (
            <p>Nenhum perfil encontrado.</p>
          ) : (
            <ul style={styles.list}>
              {weakestProfiles.map((item) => (
                <li key={item.id}>
                  {item.name} — {item.score}/100
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Maiores oportunidades</h3>
          {topOpportunities.length === 0 ? (
            <p>Nenhum perfil encontrado.</p>
          ) : (
            <ul style={styles.list}>
              {topOpportunities.map((item) => (
                <li key={item.id}>
                  {item.name} — oportunidade {item.opportunityLevel} ({item.opportunityScore}/100)
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
