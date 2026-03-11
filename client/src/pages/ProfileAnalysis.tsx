import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, RefreshCw, Star, MessageSquare, BarChart2, Users, Lightbulb } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

interface Props { params: { id: string } }

function scoreColor(v: number) { return v >= 75 ? "text-green-600" : v >= 50 ? "text-yellow-600" : "text-red-500" }
function scoreHex(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444" }
function Stars({ v }: { v: number }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= Math.round(v) ? "#f59e0b" : "#d1d5db" }}>★</span>)}</span>;
}
function Dim({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${scoreColor(value)}`}>{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

export default function ProfileAnalysis({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.id);
  const [syncing, setSyncing] = useState(false);
  const [genSuggestions, setGenSuggestions] = useState(false);

  const { data: profile, isLoading: profileLoading } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: score, refetch: refetchScore } = trpc.scores.getByProfile.useQuery({ profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId });
  const { data: competitors } = trpc.competitors.getByProfile.useQuery({ profileId });
  const { data: suggestions, refetch: refetchSugs } = trpc.suggestions.listByProfile.useQuery({ profileId });

  const syncMutation = trpc.sync.syncProfile.useMutation();
  const syncPlacesMutation = trpc.sync.syncFromPlaces.useMutation();
  const genSugsMutation = trpc.suggestions.generate.useMutation();
  const toggleMutation = trpc.suggestions.toggleDone.useMutation();
  const deleteMutation = trpc.profiles.delete.useMutation();
  const utils = trpc.useUtils();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncMutation.mutateAsync({ profileId });
      if (res.success) {
        toast.success(`Sincronizado! ${res.reviews || 0} reviews atualizados.`);
        utils.profiles.getById.invalidate({ id: profileId });
        utils.scores.getByProfile.invalidate({ profileId });
        utils.reviews.getRecent.invalidate({ profileId });
      } else {
        toast.error((res as any).error || "Erro na sincronização");
      }
    } catch (e: any) { toast.error(e.message); }
    setSyncing(false);
  };

  const handleGenSuggestions = async () => {
    setGenSuggestions(true);
    try {
      await genSugsMutation.mutateAsync({ profileId });
      refetchSugs();
      toast.success("6 sugestões geradas com IA!");
    } catch (e: any) { toast.error("Erro ao gerar sugestões: " + e.message); }
    setGenSuggestions(false);
  };

  const handleToggle = async (id: number, isDone: boolean) => {
    await toggleMutation.mutateAsync({ id, isDone: !isDone });
    refetchSugs();
  };

  const handleDelete = async () => {
    if (!confirm(`Deletar "${profile?.name}"? Esta ação não pode ser desfeita.`)) return;
    await deleteMutation.mutateAsync({ id: profileId });
    toast.success("Perfil removido.");
    setLocation("/dashboard");
  };

  if (profileLoading) return <DashboardLayout><div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  if (!profile) return <DashboardLayout><div className="text-center py-20"><p className="text-muted-foreground">Perfil não encontrado</p><Button onClick={() => setLocation("/dashboard")} className="mt-4">Voltar</Button></div></DashboardLayout>;

  const ratingDist = [1,2,3,4,5].map(r => ({
    r: `${r}★`,
    n: (reviews || []).filter((rv: any) => rv.rating === r).length,
  }));

  const radarData = score ? [
    { s: "Completude", v: Math.round(score.completeness) },
    { s: "Reviews", v: Math.round(score.reviewScore) },
    { s: "Engajamento", v: Math.round(score.engagement) },
    { s: "Consistência", v: Math.round(score.consistency) },
    { s: "Mídia", v: Math.round(score.mediaScore) },
  ] : [];

  const compData = [
    { name: profile.name?.substring(0, 14), rating: profile.avgRating || 0, reviews: profile.totalReviews || 0 },
    ...(competitors || []).slice(0, 4).map((c: any) => ({
      name: c.name?.substring(0, 14), rating: c.rating || 0, reviews: c.reviewCount || 0
    })),
  ];

  const ttip = { contentStyle: { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/dashboard")}><ArrowLeft className="w-4 h-4" /></Button>
            <div>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <div className="flex gap-2 mt-1 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{profile.category}</span>
                {profile.isVerified && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">✓ Verificado</span>}
                {score && <span className={`text-xs px-2 py-0.5 rounded-full font-bold`} style={{ background: `${scoreHex(score.total)}22`, color: scoreHex(score.total) }}>Score: {Math.round(score.total)}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sincronizar
            </Button>
            <Button variant="outline" className="gap-2" onClick={async () => {
              setSyncing(true);
              try {
                const res = await syncPlacesMutation.mutateAsync({ profileId });
                toast.success(`✅ ${res.reviewCount} avaliações atualizadas via Google Maps!`);
                utils.profiles.getById.invalidate({ id: profileId });
                utils.reviews.getRecent.invalidate({ profileId });
              } catch (e: any) { toast.error(e.message); }
              setSyncing(false);
            }} disabled={syncing}>
              🗺️ Sync Places
            </Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/reviews`)}>💬 Respostas IA</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/posts`)}>✍️ Posts SEO</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/keywords`)}>🔑 Keywords</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/activity`)}>📡 Monitor</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/chat`)}>🤖 Chat IA</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/charts`)}>📊 Gráficos</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/ai-search`)}>🧠 AI Search</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/report`)}>📄 Relatório</Button>
            <Button variant="outline" onClick={() => setLocation(`/profile/${profileId}/checklist`)}>✅ Checklist</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>🗑</Button>
          </div>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["💬", "Avaliações", profile.totalReviews || 0],
            ["⭐", "Nota Média", (profile.avgRating || 0).toFixed(1)],
            ["📸", "Fotos", profile.photoCount || 0],
            ["📝", "Posts", profile.postCount || 0],
          ].map(([icon, label, val]) => (
            <Card key={label as string}><CardContent className="pt-4">
              <div className="text-xl mb-1">{icon}</div>
              <div className="text-2xl font-bold">{val}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">📊 Visão Geral</TabsTrigger>
            <TabsTrigger value="reviews">⭐ Reviews</TabsTrigger>
            <TabsTrigger value="competitors">🏢 Concorrentes</TabsTrigger>
            <TabsTrigger value="suggestions">💡 Sugestões</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base">Informações</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[["Endereço", profile.address], ["Telefone", profile.phone], ["Website", profile.website], ["Descrição", profile.description]].map(([k, v]) => (
                    <div key={k as string}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{k}</p>
                      <p className="text-sm mt-0.5">{v || <span className="text-muted-foreground">—</span>}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="text-base">Score por Dimensão</CardTitle></CardHeader>
                <CardContent>
                  {score ? (<>
                    <Dim label="Completude do Perfil" value={score.completeness} />
                    <Dim label="Qualidade dos Reviews" value={score.reviewScore} />
                    <Dim label="Engajamento" value={score.engagement} />
                    <Dim label="Consistência" value={score.consistency} />
                    <Dim label="Mídia & Conteúdo" value={score.mediaScore} />
                  </>) : <p className="text-sm text-muted-foreground">Score não calculado. Sincronize o perfil.</p>}
                </CardContent>
              </Card>
            </div>
            {radarData.length > 0 && (
              <Card><CardHeader><CardTitle className="text-base">Radar de Performance</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid /><PolarAngleAxis dataKey="s" tick={{ fontSize: 11 }} />
                      <Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* REVIEWS */}
          <TabsContent value="reviews" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base">Distribuição de Ratings</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={ratingDist}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="r" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                      <Tooltip {...ttip} />
                      <Bar dataKey="n" fill="#3b82f6" radius={[4,4,0,0]} name="Avaliações" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <div className="text-4xl font-bold text-center">{(profile.avgRating || 0).toFixed(1)}</div>
                  <div className="flex justify-center"><Stars v={profile.avgRating || 0} /></div>
                  <p className="text-sm text-center text-muted-foreground">{profile.totalReviews || 0} avaliações no total</p>
                  <div className="flex justify-around text-sm pt-2">
                    <div className="text-center"><div className="font-bold text-green-600">{(reviews || []).filter((r:any) => r.sentiment === "positive").length}</div><div className="text-muted-foreground text-xs">Positivos</div></div>
                    <div className="text-center"><div className="font-bold text-gray-500">{(reviews || []).filter((r:any) => r.sentiment === "neutral").length}</div><div className="text-muted-foreground text-xs">Neutros</div></div>
                    <div className="text-center"><div className="font-bold text-red-500">{(reviews || []).filter((r:any) => r.sentiment === "negative").length}</div><div className="text-muted-foreground text-xs">Negativos</div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card><CardHeader><CardTitle className="text-base">Reviews Recentes</CardTitle></CardHeader>
              <CardContent>
                {!reviews || reviews.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>Nenhum review sincronizado ainda.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={handleSync} disabled={syncing}>
                      {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <RefreshCw className="w-3 h-3 mr-2" />}
                      Sincronizar do Google
                    </Button>
                  </div>
                ) : (reviews || []).slice(0, 10).map((r: any) => (
                  <div key={r.id} className="border-b last:border-0 py-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-sm">{r.authorName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{new Date(r.publishedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Stars v={r.rating} />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.sentiment === "positive" ? "bg-green-100 text-green-700" : r.sentiment === "negative" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {r.sentiment === "positive" ? "Positivo" : r.sentiment === "negative" ? "Negativo" : "Neutro"}
                        </span>
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                    {r.reply && <div className="bg-muted rounded p-2 mt-2 text-xs border-l-2 border-blue-400"><span className="font-semibold">Resposta: </span>{r.reply}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPETITORS */}
          <TabsContent value="competitors" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card><CardHeader><CardTitle className="text-base">Concorrentes Próximos</CardTitle></CardHeader>
                <CardContent>
                  {!competitors || competitors.length === 0
                    ? <p className="text-sm text-muted-foreground text-center py-8">Nenhum concorrente encontrado</p>
                    : (competitors || []).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                          <div><p className="font-medium text-sm">{c.name}</p><p className="text-xs text-muted-foreground">{c.address}</p></div>
                          <div className="text-right"><Stars v={c.rating || 0} /><p className="text-xs text-muted-foreground">{c.reviewCount || 0} avaliações</p></div>
                        </div>
                    ))}
                </CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="text-base">Comparação de Nota</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={compData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip {...ttip} />
                      <Bar dataKey="rating" fill="#3b82f6" radius={[0,4,4,0]} name="Nota" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SUGGESTIONS */}
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
            ) : (suggestions || []).map((s: any) => (
              <div key={s.id} className={`border rounded-xl p-4 mb-3 flex justify-between items-start gap-3 transition-all ${s.isDone ? "opacity-60 bg-muted/30" : "bg-background hover:border-blue-300"}`}>
                <div className="flex-1">
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${s.priority === "high" ? "bg-red-100 text-red-700" : s.priority === "low" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {s.priority === "high" ? "Alta prioridade" : s.priority === "low" ? "Baixa prioridade" : "Média prioridade"}
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
