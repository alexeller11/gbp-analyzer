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

type ImportResult = {
  accountsImported: number;
  locationsImported: number;
  businessesImported: number;
  accountsDiscovered: number;
  accounts: Array<{
    accountId: string;
    accountName: string | null;
    type: string | null;
    locations: number;
  }>;
};

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
  createdAt: string;
  updatedAt: string;
  score: number;
  insights: string[];
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

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #0b1020 0%, #111827 240px, #f3f4f6 240px, #f3f4f6 100%)",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: "#111827",
    padding: "24px"
  } as React.CSSProperties,
  shell: {
    maxWidth: "1400px",
    margin: "0 auto"
  } as React.CSSProperties,
  hero: {
    color: "#fff",
    padding: "8px 4px 28px"
  } as React.CSSProperties,
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap"
  } as React.CSSProperties,
  title: {
    fontSize: "32px",
    fontWeight: 800,
    margin: 0,
    letterSpacing: "-0.02em"
  } as React.CSSProperties,
  subtitle: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.75)",
    fontSize: "15px"
  } as React.CSSProperties,
  topActions: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap"
  } as React.CSSProperties,
  buttonPrimary: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(17,24,39,0.18)"
  } as React.CSSProperties,
  buttonGhost: {
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "12px",
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center"
  } as React.CSSProperties,
  surface: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "20px",
    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)"
  } as React.CSSProperties,
  section: {
    padding: "20px"
  } as React.CSSProperties,
  sectionTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px"
  } as React.CSSProperties,
  sectionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 800,
    letterSpacing: "-0.01em"
  } as React.CSSProperties,
  sectionHint: {
    margin: 0,
    color: "#6b7280",
    fontSize: "14px"
  } as React.CSSProperties,
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "14px",
    marginTop: "-16px",
    marginBottom: "20px"
  } as React.CSSProperties,
  statCard: {
    background: "#fff",
    borderRadius: "18px",
    border: "1px solid #e5e7eb",
    padding: "18px",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)"
  } as React.CSSProperties,
  statLabel: {
    color: "#6b7280",
    fontSize: "13px",
    marginBottom: "8px"
  } as React.CSSProperties,
  statValue: {
    fontSize: "30px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    margin: 0
  } as React.CSSProperties,
  statSub: {
    color: "#6b7280",
    fontSize: "13px",
    marginTop: "6px"
  } as React.CSSProperties,
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap"
  } as React.CSSProperties,
  avatar: {
    width: "64px",
    height: "64px",
    borderRadius: "999px",
    objectFit: "cover",
    border: "3px solid #e5e7eb"
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
  } as React.CSSProperties,
  chipSuccess: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 700
  } as React.CSSProperties,
  chipWarn: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "12px",
    fontWeight: 700
  } as React.CSSProperties,
  chipDanger: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontSize: "12px",
    fontWeight: 700
  } as React.CSSProperties,
  controlsRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center"
  } as React.CSSProperties,
  input: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    outline: "none",
    minWidth: "280px",
    background: "#fff"
  } as React.CSSProperties,
  select: {
    padding: "12px 14px",
    borderRadius: "12px",
    border: "1px solid #d1d5db",
    outline: "none",
    background: "#fff"
  } as React.CSSProperties,
  accountsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "14px"
  } as React.CSSProperties,
  accountCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "16px",
    background: "#fafafa"
  } as React.CSSProperties,
  businessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "16px"
  } as React.CSSProperties,
  businessCard: {
    border: "1px solid #e5e7eb",
    borderRadius: "18px",
    padding: "18px",
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)"
  } as React.CSSProperties,
  businessTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px"
  } as React.CSSProperties,
  businessTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
    lineHeight: 1.2
  } as React.CSSProperties,
  scoreBadge: {
    minWidth: "72px",
    textAlign: "center",
    borderRadius: "14px",
    padding: "10px 12px",
    fontWeight: 800,
    fontSize: "15px"
  } as React.CSSProperties,
  metaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px 14px",
    marginTop: "16px"
  } as React.CSSProperties,
  metaItem: {
    fontSize: "14px",
    color: "#374151"
  } as React.CSSProperties,
  metaLabel: {
    display: "block",
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "4px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em"
  } as React.CSSProperties,
  insightList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "14px"
  } as React.CSSProperties,
  insightChip: {
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    fontSize: "12px",
    fontWeight: 700
  } as React.CSSProperties,
  details: {
    marginTop: "14px",
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "10px 12px"
  } as React.CSSProperties,
  summary: {
    cursor: "pointer",
    fontWeight: 700,
    color: "#111827"
  } as React.CSSProperties,
  empty: {
    padding: "18px",
    borderRadius: "14px",
    background: "#f9fafb",
    border: "1px dashed #d1d5db",
    color: "#6b7280"
  } as React.CSSProperties
};

function scoreTone(score: number) {
  if (score >= 80) {
    return { background: "#dcfce7", color: "#166534" };
  }
  if (score >= 60) {
    return { background: "#fef3c7", color: "#92400e" };
  }
  return { background: "#fee2e2", color: "#b91c1c" };
}

function formatLocationCount(value: number) {
  return `${value} ${value === 1 ? "perfil" : "perfis"}`;
}

function compactText(value?: string | null) {
  return value && value.trim() ? value : "N/A";
}

function App() {
  const [loading, setLoading] = React.useState(true);
  const [authenticated, setAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState<MeResponse["user"] | null>(null);

  const [importing, setImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  const [accounts, setAccounts] = React.useState<AccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(false);
  const [accountsError, setAccountsError] = React.useState<string | null>(null);

  const [businesses, setBusinesses] = React.useState<BusinessRow[]>([]);
  const [businessesLoading, setBusinessesLoading] = React.useState(false);
  const [businessesError, setBusinessesError] = React.useState<string | null>(null);

  const [selectedAccountId, setSelectedAccountId] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  async function loadMe() {
    const res = await fetch("/api/auth/me", {
      credentials: "include"
    });

    if (!res.ok) {
      setAuthenticated(false);
      setUser(null);
      return;
    }

    const data: MeResponse = await res.json();
    setAuthenticated(Boolean(data.authenticated));
    setUser(data.user ?? null);
  }

  async function loadAccounts() {
    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const res = await fetch("/api/gbp/accounts", {
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar contas");
      }

      setAccounts(data.accounts ?? []);
    } catch (error: any) {
      setAccountsError(error?.message || "Erro ao carregar contas");
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadBusinesses(accountId?: string) {
    setBusinessesLoading(true);
    setBusinessesError(null);

    try {
      const query =
        accountId && accountId !== "all"
          ? `?accountId=${encodeURIComponent(accountId)}`
          : "";

      const res = await fetch(`/api/gbp/businesses${query}`, {
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Erro ao carregar perfis");
      }

      setBusinesses(data.businesses ?? []);
    } catch (error: any) {
      setBusinessesError(error?.message || "Erro ao carregar perfis");
    } finally {
      setBusinessesLoading(false);
    }
  }

  React.useEffect(() => {
    loadMe()
      .catch(() => {
        setAuthenticated(false);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (!authenticated || !user?.googleBusinessConnected) return;

    loadAccounts();
    loadBusinesses(selectedAccountId);
  }, [authenticated, user?.googleBusinessConnected, selectedAccountId]);

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
      await loadAccounts();
      await loadBusinesses(selectedAccountId);
    } catch (error: any) {
      setImportError(error?.message || "Erro ao importar contas");
    } finally {
      setImporting(false);
    }
  }

  const filteredBusinesses = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;

    return businesses.filter((business) => {
      const haystack = [
        business.name,
        business.primaryCategory,
        business.city,
        business.state,
        business.account?.accountDisplayName,
        business.account?.accountId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [businesses, search]);

  const stats = React.useMemo(() => {
    const totalProfiles = businesses.length;
    const verifiedProfiles = businesses.filter((b) => b.location?.isVerified).length;
    const averageScore =
      businesses.length > 0
        ? Math.round(
            businesses.reduce((acc, item) => acc + item.score, 0) / businesses.length
          )
        : 0;
    const criticalProfiles = businesses.filter((b) => b.score < 50).length;

    return {
      totalProfiles,
      verifiedProfiles,
      averageScore,
      criticalProfiles
    };
  }, [businesses]);

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
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <h1 style={styles.title}>GBP Analyzer</h1>
              <p style={styles.subtitle}>
                Painel de contas, perfis e diagnóstico inicial para Google Business Profile.
              </p>
            </div>

            <div style={styles.topActions}>
              {user?.googleBusinessConnected && (
                <button
                  onClick={handleImportPortfolio}
                  disabled={importing}
                  style={styles.buttonPrimary}
                >
                  {importing ? "Importando..." : "Atualizar importação"}
                </button>
              )}

              <button onClick={handleLogout} style={styles.buttonGhost}>
                Sair
              </button>
            </div>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Perfis carregados</div>
            <p style={styles.statValue}>{stats.totalProfiles}</p>
            <div style={styles.statSub}>base atual disponível para análise</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Contas importadas</div>
            <p style={styles.statValue}>{accounts.length}</p>
            <div style={styles.statSub}>entre pessoais e grupos</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Score médio</div>
            <p style={styles.statValue}>{stats.averageScore}/100</p>
            <div style={styles.statSub}>visão rápida da saúde dos perfis</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Perfis críticos</div>
            <p style={styles.statValue}>{stats.criticalProfiles}</p>
            <div style={styles.statSub}>score abaixo de 50</div>
          </div>
        </div>

        <div style={{ ...styles.surface, ...styles.section }}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>Usuário autenticado</h2>
              <p style={styles.sectionHint}>Conexão ativa com Google e Google Business Profile</p>
            </div>
          </div>

          <div style={styles.userCard}>
            {user?.picture ? (
              <img src={user.picture} alt={user.name || user.email} style={styles.avatar} />
            ) : null}

            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {user?.name || "Usuário"}
              </div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>{user?.email}</div>

              <div style={styles.chipRow}>
                <span style={styles.chipSuccess}>Google conectado</span>
                <span
                  style={
                    user?.googleBusinessConnected ? styles.chipSuccess : styles.chipWarn
                  }
                >
                  {user?.googleBusinessConnected
                    ? "Google Business conectado"
                    : "Google Business não conectado"}
                </span>
                <span style={styles.chip}>ID interno: {user?.id}</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <details style={styles.details}>
              <summary style={styles.summary}>Ver dados da sessão</summary>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
                {JSON.stringify(user, null, 2)}
              </pre>
            </details>
          </div>

          {importResult && (
            <div style={{ marginTop: 16 }}>
              <details style={styles.details} open>
                <summary style={styles.summary}>Última importação</summary>
                <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
                  {JSON.stringify(importResult, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {importError && (
            <div style={{ marginTop: 16, color: "#b91c1c", fontWeight: 700 }}>
              Erro: {importError}
            </div>
          )}
        </div>

        <div style={{ ...styles.surface, ...styles.section, marginTop: 18 }}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>Contas importadas</h2>
              <p style={styles.sectionHint}>Use o filtro para focar em um grupo específico</p>
            </div>

            <div style={styles.controlsRow}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar perfil por nome, categoria ou cidade"
                style={styles.input}
              />

              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                style={styles.select}
              >
                <option value="all">Todas as contas</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.accountId}>
                    {(account.accountDisplayName || account.accountId) +
                      ` (${account.locationsCount})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {accountsLoading ? (
            <div style={styles.empty}>Carregando contas...</div>
          ) : accountsError ? (
            <div style={{ ...styles.empty, color: "#b91c1c" }}>{accountsError}</div>
          ) : accounts.length === 0 ? (
            <div style={styles.empty}>Nenhuma conta importada ainda.</div>
          ) : (
            <div style={styles.accountsGrid}>
              {accounts.map((account) => (
                <div key={account.id} style={styles.accountCard}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {account.accountDisplayName || account.accountId}
                  </div>

                  <div style={styles.chipRow}>
                    <span style={styles.chip}>{account.accountType || "N/A"}</span>
                    <span style={styles.chipSuccess}>
                      {formatLocationCount(account.locationsCount)}
                    </span>
                  </div>

                  <div style={{ marginTop: 12, color: "#6b7280", fontSize: 13 }}>
                    <div>Account ID: {account.accountId}</div>
                    <div>Google name: {account.googleAccountName}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...styles.surface, ...styles.section, marginTop: 18 }}>
          <div style={styles.sectionTitleRow}>
            <div>
              <h2 style={styles.sectionTitle}>Perfis importados</h2>
              <p style={styles.sectionHint}>
                {filteredBusinesses.length} perfil(is) exibido(s)
              </p>
            </div>
          </div>

          {businessesLoading ? (
            <div style={styles.empty}>Carregando perfis...</div>
          ) : businessesError ? (
            <div style={{ ...styles.empty, color: "#b91c1c" }}>{businessesError}</div>
          ) : filteredBusinesses.length === 0 ? (
            <div style={styles.empty}>Nenhum perfil encontrado para esse filtro.</div>
          ) : (
            <div style={styles.businessGrid}>
              {filteredBusinesses.map((business) => {
                const tone = scoreTone(business.score);

                return (
                  <div key={business.id} style={styles.businessCard}>
                    <div style={styles.businessTop}>
                      <div>
                        <h3 style={styles.businessTitle}>{business.name}</h3>
                        <div style={{ color: "#6b7280", marginTop: 6, fontSize: 14 }}>
                          {compactText(business.primaryCategory)}
                        </div>
                      </div>

                      <div
                        style={{
                          ...styles.scoreBadge,
                          background: tone.background,
                          color: tone.color
                        }}
                      >
                        {business.score}/100
                      </div>
                    </div>

                    <div style={styles.metaGrid}>
                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Conta</span>
                        {compactText(
                          business.account?.accountDisplayName || business.account?.accountId
                        )}
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Tipo</span>
                        {compactText(business.account?.accountType)}
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Cidade / UF</span>
                        {compactText([business.city, business.state].filter(Boolean).join(" / "))}
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Verificação</span>
                        {business.location?.isVerified ? "Verificado" : "Não verificado"}
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Telefone</span>
                        {compactText(business.phone)}
                      </div>

                      <div style={styles.metaItem}>
                        <span style={styles.metaLabel}>Website</span>
                        {business.website ? (
                          <a
                            href={business.website}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#2563eb", textDecoration: "none" }}
                          >
                            Abrir site
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </div>
                    </div>

                    <div style={styles.insightList}>
                      {business.insights.length > 0 ? (
                        business.insights.map((insight, index) => (
                          <span key={index} style={styles.insightChip}>
                            {insight}
                          </span>
                        ))
                      ) : (
                        <span style={styles.chipSuccess}>Sem alertas iniciais</span>
                      )}
                    </div>

                    <details style={styles.details}>
                      <summary style={styles.summary}>Ver detalhes do perfil</summary>

                      <div style={{ marginTop: 12 }}>
                        <div style={styles.metaGrid}>
                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Location ID</span>
                            {compactText(business.location?.locationId)}
                          </div>

                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Status verificação</span>
                            {compactText(business.location?.verificationState)}
                          </div>

                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Fonte</span>
                            {compactText(business.source)}
                          </div>

                          <div style={styles.metaItem}>
                            <span style={styles.metaLabel}>Status</span>
                            {compactText(business.status)}
                          </div>
                        </div>

                        <div style={{ marginTop: 14 }}>
                          <span style={styles.metaLabel}>Composição do score</span>
                          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                            {JSON.stringify(business.breakdown, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
