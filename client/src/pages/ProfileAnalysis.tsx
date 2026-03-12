import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Loader2, RefreshCw, Star, MessageSquare, BarChart2, Users, Lightbulb,
  Search, Plus, Trash2, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, MoreHorizontal, ExternalLink, Bell,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell, LineChart, Line,
} from "recharts";

interface Props { params: { profileId: string } }

function Stars({ v, size = 14 }: { v: number; size?: number }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= Math.round(v) ? "#f59e0b" : "#d1d5db", fontSize: size }}>★</span>)}</span>;
}
function Dim({ label, value }: { label: string; value: number }) {
  const c = value >= 75 ? "#16a34a" : value >= 50 ? "#d97706" : "#ef4444";
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: c }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color: c }}>{Math.round(value)}</span>
    </div>
  );
}
function scoreHex(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444"; }

export default function ProfileAnalysis({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [syncing, setSyncing] = useState(false);
  const [genSuggestions, setGenSuggestions] = useState(false);
  const [compQuery, setCompQuery] = useState("");
  const [compSearching, setCompSearching] = useState(false);
  const [compResults, setCompResults] = useState<any[]>([]);
  const [compAdding, setCompAdding] = useState<string | null>(null);
  const [compFetching, setCompFetching] = useState(false);
  const [compAnalysis, setCompAnalysis] = useState<any>(null);
  const [compAnalyzing, setCompAnalyzing] = useState(false);
  const [compAnalysisFor, setCompAnalysisFor] = useState<number | null>(null);
  const [showAllButtons, setShowAllButtons] = useState(false);

  const { data: profile, isLoading: profileLoading } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: score, refetch: refetchScore } = trpc.scores.getByProfile.useQuery({ profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId, limit: 100 } as any);
  const { data: competitors, refetch: refetchComp } = trpc.competitors.getByProfile.useQuery({ profileId });
  const { data: suggestions, refetch: refetchSugs } = trpc.suggestions.listByProfile.useQuery({ profileId });

  const syncMutation = trpc.sync.syncProfile.useMutation();
  const syncPlacesMutation = trpc.sync.syncFromPlaces.useMutation();
  const genSugsMutation = trpc.suggestions.generate.useMutation();
  const toggleMutation = trpc.suggestions.toggleDone.useMutation();
  const deleteMutation = trpc.profiles.delete.useMutation();
  const compSearchMutation = trpc.competitors.searchByName.useMutation();
  const compAddMutation = trpc.competitors.addByPlaceId.useMutation();
  const compRemoveMutation = trpc.competitors.remove.useMutation();
  const compFetchMutation = trpc.competitors.fetchReal.useMutation();
  const compAnalyzeMutation = trpc.competitors.analyze.useMutation();
  const utils = trpc.useUtils();

  // ── Alertas urgentes ──────────────────────────────────────────
  const alerts = useMemo(() => {
    const list: { type: "error" | "warn" | "ok"; msg: string; action?: string; route?: string }[] = [];
    const rv = reviews || [];
    const unanswered = rv.filter((r: any) => !r.reply).length;
    const negatives = rv.filter((r: any) => r.sentiment === "negative" && !r.reply).length;
    const daysSinceSync = profile?.lastSyncAt
      ? Math.floor((Date.now() - new Date(profile.lastSyncAt).getTime()) / 86400000)
      : 999;
    const myRating = profile?.avgRating || 0;
    const topComp = Math.max(...(competitors || []).map((c: any) => c.rating || 0), 0);

    if (negatives > 0) list.push({ type: "error", msg: `${negatives} avaliação negativa sem resposta`, route: "reviews", action: "Responder agora" });
    if (unanswered > 5) list.push({ type: "warn", msg: `${unanswered} avaliações sem resposta`, route: "reviews", action: "Ver todas" });
    if (myRating < 4.0 && (profile?.totalReviews || 0) > 5) list.push({ type: "error", msg: `Nota ${myRating.toFixed(1)} abaixo de 4.0 — risco de perder clientes`, route: "reviews", action: "Estratégia" });
    if (topComp > myRating + 0.3) list.push({ type: "warn", msg: `Concorrente ${topComp.toFixed(1)}⭐ — você está ${(topComp - myRating).toFixed(1)} pontos atrás`, route: "competitors", action: "Ver análise" });
    if (!profile?.description) list.push({ type: "warn", msg: "Descrição ausente — prejudica SEO local e IA Search" });
    if (!profile?.website) list.push({ type: "warn", msg: "Sem website cadastrado — perde 15 pontos no score" });
    if (daysSinceSync > 7) list.push({ type: "warn", msg: `Última sync há ${daysSinceSync} dias — dados podem estar desatualizados` });
    if ((profile?.photoCount || 0) < 10) list.push({ type: "warn", msg: `Apenas ${profile?.photoCount || 0} fotos — ideal: 20+` });
    return list.slice(0, 4); // máx 4 alertas
  }, [profile, reviews, competitors]);

  // ── Tendência de nota (últimos 6 meses) ──────────────────────
  const ratingTrend = useMemo(() => {
    const rv = reviews || [];
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const label = month.toLocaleDateString("pt-BR", { month: "short" });
      const monthReviews = rv.filter((r: any) => {
        const d = new Date(r.publishedAt);
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
      });
      const avg = monthReviews.length > 0
        ? monthReviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / monthReviews.length
        : null;
      return { label, avg, count: monthReviews.length };
    });
  }, [reviews]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleCompSearch = async () => {
    if (!compQuery.trim()) return;
    setCompSearching(true); setCompResults([]);
    try {
      const res = await compSearchMutation.mutateAsync({ query: compQuery.trim(), profileId });
      setCompResults(res);
      if (!res.length) toast.info("Nenhum resultado encontrado");
    } catch (e: any) { toast.error(e.message); }
    setCompSearching(false);
  };
  const handleCompAdd = async (placeId: string, name: string) => {
    setCompAdding(placeId);
    try {
      await compAddMutation.mutateAsync({ profileId, placeId });
      toast.success(`✅ ${name} adicionado!`);
      setCompResults([]); setCompQuery("");
      utils.competitors.getByProfile.invalidate({ profileId }); refetchComp();
    } catch (e: any) { toast.error(e.message); }
    setCompAdding(null);
  };
  const handleCompRemove = async (id: number, name: string) => {
    try {
      await compRemoveMutation.mutateAsync({ competitorId: id });
      toast.success(`Removido: ${name}`);
      if (compAnalysisFor === id) { setCompAnalysis(null); setCompAnalysisFor(null); }
      utils.competitors.getByProfile.invalidate({ profileId }); refetchComp();
    } catch (e: any) { toast.error(e.message); }
  };
  const handleCompFetchAuto = async () => {
    setCompFetching(true);
    try {
      const res = await compFetchMutation.mutateAsync({ profileId });
      toast.success(res.message);
      utils.competitors.getByProfile.invalidate({ profileId }); refetchComp();
    } catch (e: any) { toast.error(e.message); }
    setCompFetching(false);
  };
  const handleAnalyzeAll = async () => {
    if (!competitors?.length) { toast.error("Adicione pelo menos 1 concorrente"); return; }
    setCompAnalyzing(true); setCompAnalysisFor(null);
    try {
      const res = await compAnalyzeMutation.mutateAsync({ profileId });
      setCompAnalysis(res);
    } catch (e: any) { toast.error(e.message); }
    setCompAnalyzing(false);
  };
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncMutation.mutateAsync({ profileId });
      if (res.success) {
        toast.success(`Sincronizado! ${res.reviews || 0} reviews.`);
        utils.profiles.getById.invalidate({ id: profileId });
        utils.scores.getByProfile.invalidate({ profileId });
        utils.reviews.getRecent.invalidate({ profileId });
      } else toast.error((res as any).error || "Erro na sincronização");
    } catch (e: any) { toast.error(e.message); }
    setSyncing(false);
  };
  const handleGenSuggestions = async () => {
    setGenSuggestions(true);
    try {
      await genSugsMutation.mutateAsync({ profileId });
      refetchSugs(); toast.success("6 sugestões geradas com IA!");
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setGenSuggestions(false);
  };
  const handleToggle = async (id: number, isDone: boolean) => {
    await toggleMutation.mutateAsync({ id, isDone: !isDone }); refetchSugs();
  };
  const handleDelete = async () => {
    if (!confirm(`Deletar "${profile?.name}"? Esta ação não pode ser desfeita.`)) return;
    await deleteMutation.mutateAsync({ id: profileId });
    toast.success("Perfil removido."); setLocation("/dashboard");
  };

  if (profileLoading) return <DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  if (!profile) return <DashboardLayout><div className="text-center py-20"><p className="text-muted-foreground">Perfil não encontrado</p><Button onClick={() => setLocation("/dashboard")} className="mt-4">Voltar</Button></div></DashboardLayout>;

  const ratingDist = [1,2,3,4,5].map(r => ({
    r: `${r}★`, n: (reviews || []).filter((rv: any) => rv.rating === r).length,
  }));
  const radarData = score ? [
    { s: "Completude", v: Math.round(score.completeness) },
    { s: "Reviews", v: Math.round(score.reviewScore) },
    { s: "Engajamento", v: Math.round(score.engagement) },
    { s: "Consistência", v: Math.round(score.consistency) },
    { s: "Mídia", v: Math.round(score.mediaScore) },
  ] : [];
  const ttip = { contentStyle: { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };
  const unansweredCount = (reviews || []).filter((r: any) => !r.reply).length;
  const answeredPct = (reviews || []).length > 0 ? Math.round((((reviews || []).length - unansweredCount) / (reviews || []).length) * 100) : 0;
  const myRating = profile.avgRating || 0;
  const topCompRating = Math.max(...(competitors || []).map((c: any) => c.rating || 0), 0);

  // Ferramentas secundárias
  const tools = [
    { label: "💬 Respostas IA", route: "reviews" },
    { label: "✍️ Posts SEO", route: "posts" },
    { label: "🔑 Keywords", route: "keywords" },
    { label: "📡 Monitor", route: "activity" },
    { label: "🤖 Chat IA", route: "chat" },
    { label: "📊 Gráficos", route: "charts" },
    { label: "🧠 AI Search", route: "ai-search" },
    { label: "📄 Relatório", route: "report" },
    { label: "✅ Checklist", route: "checklist" },
    { label: "📍 Geo-Grid", route: "geo-grid" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-5xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{profile.name}</h1>
                {profile.isVerified && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">✓ Verificado</span>}
                {score && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: `${scoreHex(score.total)}18`, color: scoreHex(score.total) }}>Score {Math.round(score.total)}</span>}
                {alerts.filter(a => a.type === "error").length > 0 && (
                  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex items-center gap-1">
                    <Bell className="w-3 h-3" />{alerts.filter(a => a.type === "error").length} urgente{alerts.filter(a => a.type === "error").length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{profile.category} · {profile.address?.split(",")[0]}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sincronizar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => {
              setSyncing(true);
              try {
                const res = await syncPlacesMutation.mutateAsync({ profileId });
                toast.success(`✅ ${res.reviewCount} avaliações via Maps!`);
                utils.profiles.getById.invalidate({ id: profileId });
                utils.reviews.getRecent.invalidate({ profileId });
              } catch (e: any) { toast.error(e.message); }
              setSyncing(false);
            }} disabled={syncing}>🗺️ Maps</Button>
            <div className="relative">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAllButtons(v => !v)}>
                <MoreHorizontal className="w-4 h-4" /> Ferramentas
              </Button>
              {showAllButtons && (
                <div className="absolute right-0 top-9 z-50 bg-white border rounded-xl shadow-lg p-2 w-44 space-y-0.5">
                  {tools.map(t => (
                    <button key={t.route} className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-gray-50 transition-colors"
                      onClick={() => { setShowAllButtons(false); setLocation(`/profile/${profileId}/${t.route}`); }}>
                      {t.label}
                    </button>
                  ))}
                  <hr className="my-1" />
                  <button className="w-full text-left px-3 py-1.5 text-sm rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                    onClick={() => { setShowAllButtons(false); handleDelete(); }}>
                    🗑 Excluir perfil
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Alertas urgentes ── */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-sm ${
                a.type === "error" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
              }`}>
                <div className="flex items-center gap-2">
                  {a.type === "error"
                    ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    : <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                  <span className={a.type === "error" ? "text-red-700" : "text-yellow-700"}>{a.msg}</span>
                </div>
                {a.action && a.route && (
                  <Button size="sm" variant="outline" className="h-6 text-xs flex-shrink-0"
                    onClick={() => setLocation(`/profile/${profileId}/${a.route}`)}>
                    {a.action}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── KPIs principais ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "💬", label: "Avaliações", val: profile.totalReviews || 0,
              sub: unansweredCount > 0 ? `${unansweredCount} sem resposta` : "todas respondidas",
              subColor: unansweredCount > 0 ? "text-orange-500" : "text-green-600" },
            { icon: "⭐", label: "Nota Média", val: (profile.avgRating || 0).toFixed(1),
              sub: topCompRating > myRating + 0.1 ? `líder: ${topCompRating.toFixed(1)}` : "melhor da área",
              subColor: topCompRating > myRating + 0.1 ? "text-orange-500" : "text-green-600" },
            { icon: "📸", label: "Fotos", val: profile.photoCount || 0,
              sub: (profile.photoCount || 0) < 10 ? "abaixo do ideal" : "bom volume",
              subColor: (profile.photoCount || 0) < 10 ? "text-orange-500" : "text-green-600" },
            { icon: "🎯", label: "Score GBP", val: score ? Math.round(score.total) : "—",
              sub: score ? (score.total >= 75 ? "perfil saudável" : score.total >= 50 ? "precisa melhorar" : "atenção urgente") : "calcule o score",
              subColor: !score ? "text-gray-400" : score.total >= 75 ? "text-green-600" : score.total >= 50 ? "text-orange-500" : "text-red-500" },
          ].map(kpi => (
            <Card key={kpi.label}><CardContent className="pt-4 pb-3">
              <div className="text-xl mb-0.5">{kpi.icon}</div>
              <div className="text-2xl font-bold">{kpi.val}</div>
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
              <div className={`text-[11px] mt-1 font-medium ${kpi.subColor}`}>{kpi.sub}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* ── Tabs ── */}
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">📊 Visão Geral</TabsTrigger>
            <TabsTrigger value="reviews">
              ⭐ Reviews
              {unansweredCount > 0 && <span className="ml-1.5 bg-orange-500 text-white text-[10px] px-1.5 rounded-full">{unansweredCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="competitors">🏢 Concorrentes</TabsTrigger>
            <TabsTrigger value="suggestions">💡 Sugestões</TabsTrigger>
          </TabsList>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Informações */}
              <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Informações do Perfil</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    ["Endereço", profile.address],
                    ["Telefone", profile.phone],
                    ["Website", profile.website],
                    ["Descrição", profile.description],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${v ? "bg-green-400" : "bg-red-400"}`} />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">{k}</p>
                        <p className="text-sm">{v
                          ? (k === "Website" ? <a href={v as string} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">{(v as string).replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3" /></a> : v)
                          : <span className="text-red-400 text-xs">Não preenchido</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Score por dimensão */}
              <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Score por Dimensão</CardTitle></CardHeader>
                <CardContent>
                  {score ? (<>
                    <Dim label="Completude do Perfil" value={score.completeness} />
                    <Dim label="Qualidade dos Reviews" value={score.reviewScore} />
                    <Dim label="Engajamento" value={score.engagement} />
                    <Dim label="Consistência" value={score.consistency} />
                    <Dim label="Mídia & Conteúdo" value={score.mediaScore} />
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Score total</span>
                      <span className="text-xl font-bold" style={{ color: scoreHex(score.total) }}>{Math.round(score.total)}/100</span>
                    </div>
                  </>) : <p className="text-sm text-muted-foreground">Score não calculado. Sincronize o perfil.</p>}
                </CardContent>
              </Card>
            </div>

            {/* Tendência de nota + Radar lado a lado */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Tendência */}
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Tendência de Nota</CardTitle>
                    {ratingTrend.some(d => d.avg !== null) && (() => {
                      const vals = ratingTrend.filter(d => d.avg !== null).map(d => d.avg as number);
                      const first = vals[0], last = vals[vals.length - 1];
                      const diff = last - first;
                      return (
                        <span className={`text-xs font-bold flex items-center gap-0.5 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      );
                    })()}
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={ratingTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} />
                      <Tooltip {...ttip} formatter={(v: any) => v ? v.toFixed(1) : "—"} />
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} connectNulls name="Nota" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                    {ratingTrend.map((d, i) => (
                      <span key={i} className={d.count > 0 ? "font-medium" : ""}>{d.count > 0 ? `${d.count}av` : ""}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Radar */}
              <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Radar de Performance</CardTitle></CardHeader>
                <CardContent>
                  {radarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <RadarChart data={radarData}>
                        <PolarGrid /><PolarAngleAxis dataKey="s" tick={{ fontSize: 10 }} />
                        <Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-muted-foreground text-center py-10">Sincronize o perfil para ver o radar</p>}
                </CardContent>
              </Card>
            </div>

            {/* Benchmark vs concorrentes */}
            {(competitors?.length || 0) > 0 && (
              <Card className="border-blue-200 bg-blue-50/20">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">📍 Posição vs Concorrentes</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 flex-wrap">
                    {[
                      { name: profile.name?.substring(0, 20), rating: myRating, you: true },
                      ...(competitors || []).slice(0, 4).map((c: any) => ({ name: c.name?.substring(0, 20), rating: c.rating || 0, you: false })),
                    ].sort((a, b) => b.rating - a.rating).map((c, i) => (
                      <div key={i} className={`flex-1 min-w-24 p-2 rounded-lg text-center border ${c.you ? "bg-blue-100 border-blue-300" : "bg-white"}`}>
                        <div className="text-xs font-bold text-muted-foreground">#{i + 1}</div>
                        <div className="text-sm font-bold truncate">{c.you ? "Você" : c.name?.split(" ")[0]}</div>
                        <div className="text-lg font-bold">⭐ {c.rating?.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── REVIEWS ── */}
          <TabsContent value="reviews" className="space-y-4 mt-4">
            {/* Métricas de reviews */}
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="pt-3 pb-3 text-center">
                <div className="text-2xl font-bold text-green-600">{(reviews || []).filter((r: any) => r.sentiment === "positive").length}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Positivas</div>
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-3 text-center">
                <div className="text-2xl font-bold text-orange-500">{unansweredCount}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Sem resposta</div>
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{answeredPct}%</div>
                <div className="text-xs text-muted-foreground mt-0.5">Taxa resposta</div>
              </CardContent></Card>
            </div>

            {unansweredCount > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-orange-700">{unansweredCount} avaliações aguardam resposta — cada hora conta para o SEO</span>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={() => setLocation(`/profile/${profileId}/reviews`)}>
                  Responder com IA
                </Button>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Distribuição de Ratings</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={ratingDist}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="r" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip {...ttip} />
                      <Bar dataKey="n" radius={[4,4,0,0]} name="Avaliações">
                        {ratingDist.map((d, i) => (
                          <Cell key={i} fill={d.r.startsWith("5") || d.r.startsWith("4") ? "#22c55e" : d.r.startsWith("3") ? "#f59e0b" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Avaliações por Mês</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={ratingTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip {...ttip} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[3,3,0,0]} name="Avaliações" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Reviews Recentes</CardTitle>
                  {unansweredCount > 0 && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => setLocation(`/profile/${profileId}/reviews`)}>
                      <Zap className="w-3 h-3" /> Responder tudo com IA
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {!reviews || reviews.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground px-4">
                    <p>Nenhum review sincronizado ainda.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleSync} disabled={syncing}>
                      {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                      Sincronizar do Google
                    </Button>
                  </div>
                ) : (reviews || []).slice(0, 8).map((r: any) => (
                  <div key={r.id} className={`border-b last:border-0 px-4 py-3 ${!r.reply ? "bg-orange-50/30" : ""}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {r.authorName?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <span className="font-semibold text-sm">{r.authorName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{new Date(r.publishedAt).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Stars v={r.rating} />
                        {!r.reply && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">sem resposta</span>}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mt-1.5 ml-9">{r.comment}</p>}
                    {r.reply && <div className="bg-blue-50 rounded-lg p-2 mt-2 ml-9 text-xs border-l-2 border-blue-400"><span className="font-semibold">Resposta: </span>{r.reply}</div>}
                  </div>
                ))}
                {(reviews?.length || 0) > 8 && (
                  <div className="p-3 text-center">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setLocation(`/profile/${profileId}/reviews`)}>
                      Ver todas as {reviews?.length} avaliações →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── COMPETITORS ── */}
          <TabsContent value="competitors" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Search className="w-4 h-4" /> Adicionar Concorrente
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleCompFetchAuto} disabled={compFetching} className="gap-1.5 h-7 text-xs">
                    {compFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Busca Automática
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder='Ex: "Salão da Maria, Linhares ES"' value={compQuery}
                    onChange={e => setCompQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCompSearch()} />
                  <Button onClick={handleCompSearch} disabled={compSearching || !compQuery.trim()} size="sm" className="px-3">
                    {compSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {compResults.length > 0 && (
                  <div className="border rounded-xl divide-y overflow-hidden">
                    {compResults.map((r: any) => (
                      <div key={r.placeId} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground truncate">⭐ {r.rating || "—"} · {r.reviewCount || 0} av. · {r.address?.split(",")[0]}</p>
                        </div>
                        <Button size="sm" variant="outline" className="flex-shrink-0 gap-1 h-7 text-xs"
                          disabled={compAdding === r.placeId} onClick={() => handleCompAdd(r.placeId, r.name)}>
                          {compAdding === r.placeId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Adicionar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {(competitors?.length || 0) > 0 ? (<>
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{competitors?.length} Concorrentes</CardTitle>
                    <Button size="sm" onClick={handleAnalyzeAll} disabled={compAnalyzing} className="gap-1.5 h-7 text-xs">
                      {compAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                      {compAnalyzing ? "Analisando..." : "Análise IA Completa"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b">
                    <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Star className="w-3 h-3 text-white fill-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-blue-700 truncate">{profile.name} <span className="font-normal opacity-60">(você)</span></p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm">⭐ {profile.avgRating?.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{profile.totalReviews} av.</p>
                    </div>
                  </div>
                  {competitors?.map((c: any, i: number) => {
                    const diff = (c.rating || 0) - myRating;
                    const tc = diff > 0.3 ? "#ef4444" : diff > 0 ? "#f59e0b" : "#22c55e";
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.address?.split(",")[0]}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <p className="font-medium text-sm">⭐ {c.rating?.toFixed(1) || "—"}</p>
                            <p className="text-xs text-muted-foreground">{c.reviewCount || 0} av.</p>
                          </div>
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${tc}18`, color: tc }}>
                            {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                          </span>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-red-400 hover:text-red-600"
                            onClick={() => handleCompRemove(c.id, c.name)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Gráficos */}
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { title: "Nota Média", key: "v", fmt: (v: number) => v.toFixed(1), domain: [0, 5] as [number, number],
                    data: [{ name: profile.name?.substring(0,14) || "Você", v: myRating, you: true },
                           ...(competitors || []).slice(0,4).map((c: any) => ({ name: c.name?.substring(0,14), v: c.rating || 0, you: false }))] },
                  { title: "Avaliações", key: "v", fmt: (v: number) => v, domain: undefined,
                    data: [{ name: profile.name?.substring(0,14) || "Você", v: profile.totalReviews || 0, you: true },
                           ...(competitors || []).slice(0,4).map((c: any) => ({ name: c.name?.substring(0,14), v: c.reviewCount || 0, you: false }))] },
                ].map(chart => (
                  <Card key={chart.title}>
                    <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">{chart.title}</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart layout="vertical" data={chart.data} margin={{ left: 0, right: 16 }}>
                          <XAxis type="number" domain={chart.domain} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={chart.fmt} />
                          <Bar dataKey="v" radius={3}>
                            {chart.data.map((d: any, i: number) => <Cell key={i} fill={d.you ? "#2563eb" : "#94a3b8"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Análise IA */}
              {compAnalysis && (
                <div className="space-y-3">
                  <Card className="border-blue-200 bg-blue-50/40">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">#{compAnalysis.position}</div>
                        <div className="flex-1">
                          <p className="font-bold text-blue-800 text-sm">Sua posição no ranking local</p>
                          <p className="text-sm text-blue-700 mt-1">{compAnalysis.summary}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {compAnalysis.ratingGap !== undefined && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Number(compAnalysis.ratingGap) > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>Nota: {Number(compAnalysis.ratingGap) > 0 ? "+" : ""}{compAnalysis.ratingGap} vs líder</span>}
                            {compAnalysis.reviewGap !== undefined && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${Number(compAnalysis.reviewGap) > 0 ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>{Number(compAnalysis.reviewGap) > 0 ? `${compAnalysis.reviewGap} av. a menos` : "Mais avaliações que o líder"}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { title: "💪 Pontos Fortes", items: compAnalysis.strengths, border: "border-green-200", titleColor: "text-green-700", icon: "✓", iconColor: "text-green-500" },
                      { title: "⚠️ Pontos Fracos", items: compAnalysis.weaknesses, border: "border-red-200", titleColor: "text-red-700", icon: "✕", iconColor: "text-red-500" },
                      { title: "🎯 Ações Prioritárias", items: compAnalysis.actions, border: "border-purple-200", titleColor: "text-purple-700", icon: "→", iconColor: "text-purple-500", numbered: true },
                      { title: "✨ Oportunidades", items: compAnalysis.opportunities, border: "border-yellow-200", titleColor: "text-yellow-700", icon: "→", iconColor: "text-yellow-500" },
                    ].map(section => (
                      <Card key={section.title} className={section.border}>
                        <CardHeader className="py-3 px-4"><CardTitle className={`text-xs font-bold ${section.titleColor}`}>{section.title}</CardTitle></CardHeader>
                        <CardContent className="px-4 pb-3 pt-0 space-y-1">
                          {section.items?.map((item: string, i: number) => (
                            <p key={i} className="text-xs flex gap-1.5">
                              <span className={`${section.iconColor} flex-shrink-0 ${section.numbered ? "bg-purple-100 text-purple-700 rounded-full w-4 h-4 flex items-center justify-center font-bold" : ""}`}>{section.numbered ? i+1 : section.icon}</span>
                              {item}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {compAnalysis.competitorInsights?.length > 0 && (
                    <Card>
                      <CardHeader className="py-3 px-4"><CardTitle className="text-xs font-bold">🔍 Análise Individual dos Concorrentes</CardTitle></CardHeader>
                      <CardContent className="px-4 pb-3 pt-0 space-y-2">
                        {compAnalysis.competitorInsights.map((ci: any, i: number) => {
                          const tc = ci.threat === "alto" ? "#ef4444" : ci.threat === "médio" ? "#f59e0b" : "#22c55e";
                          return (
                            <div key={i} className="flex gap-2 p-2.5 rounded-lg bg-gray-50 items-start">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: `${tc}22`, color: tc }}>{ci.threat}</span>
                              <div><p className="font-semibold text-xs">{ci.name}</p><p className="text-xs text-muted-foreground mt-0.5">{ci.insight}</p></div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>) : (
              <Card><CardContent className="text-center py-10">
                <div className="text-4xl mb-2">🏆</div>
                <p className="font-medium text-sm">Nenhum concorrente ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Pesquise pelo nome ou use a busca automática</p>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* ── SUGGESTIONS ── */}
          <TabsContent value="suggestions" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold">Sugestões de Melhoria</h3>
                <p className="text-xs text-muted-foreground">Geradas por IA com base no seu perfil</p>
              </div>
              <Button onClick={handleGenSuggestions} disabled={genSuggestions} className="gap-2">
                {genSuggestions ? <Loader2 className="w-4 h-4 animate-spin" /> : "🤖"}
                {genSuggestions ? "Gerando..." : "Gerar com IA"}
              </Button>
            </div>
            {!suggestions || suggestions.length === 0 ? (
              <Card><CardContent className="text-center py-12">
                <div className="text-4xl mb-3">💡</div>
                <p className="text-muted-foreground">Clique em "Gerar com IA" para receber sugestões personalizadas</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {(suggestions || []).map((s: any) => (
                  <div key={s.id} className={`border rounded-xl p-4 flex justify-between items-start gap-3 transition-all ${s.isDone ? "opacity-50 bg-muted/30" : s.priority === "high" ? "border-red-200 bg-red-50/20" : "bg-background hover:border-blue-200"}`}>
                    <div className="flex-1">
                      <div className="flex gap-2 mb-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${s.priority === "high" ? "bg-red-100 text-red-700" : s.priority === "low" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {s.priority === "high" ? "🔴 Alta" : s.priority === "low" ? "🟢 Baixa" : "🟡 Média"}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{s.category}</span>
                      </div>
                      <p className={`font-semibold text-sm ${s.isDone ? "line-through text-muted-foreground" : ""}`}>{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                    </div>
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <div className="text-center">
                        <div className={`text-xl font-bold ${s.impact >= 75 ? "text-green-600" : s.impact >= 50 ? "text-yellow-600" : "text-red-500"}`}>{s.impact}</div>
                        <div className="text-[10px] text-muted-foreground">impacto</div>
                      </div>
                      <Button size="sm" variant={s.isDone ? "outline" : "default"} onClick={() => handleToggle(s.id, s.isDone)} className="text-xs h-7 px-3">
                        {s.isDone ? "↩ Desfazer" : "✓ Feito"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
