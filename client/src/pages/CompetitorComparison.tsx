import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Search, Loader2, Trash2, TrendingUp, TrendingDown,
  Minus, Trophy, Zap, RefreshCw, Plus, Star, MapPin
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props { params: { profileId: string } }

const THREAT_COLOR: Record<string, string> = { alto: "#ef4444", médio: "#f59e0b", baixo: "#22c55e" };

export default function CompetitorComparison({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [adding, setAdding] = useState<string | null>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: competitors, refetch } = trpc.competitors.getByProfile.useQuery({ profileId });
  const fetchMutation = trpc.competitors.fetchReal.useMutation();
  const searchMutation = trpc.competitors.searchByName.useMutation();
  const addMutation = trpc.competitors.addByPlaceId.useMutation();
  const removeMutation = trpc.competitors.remove.useMutation();
  const analyzeMutation = trpc.competitors.analyze.useMutation();
  const utils = trpc.useUtils();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await searchMutation.mutateAsync({ query: query.trim(), profileId });
      setSearchResults(res);
      if (!res.length) toast.info("Nenhum resultado encontrado");
    } catch (e: any) { toast.error(e.message); }
    setSearching(false);
  };

  const handleAdd = async (placeId: string, name: string) => {
    setAdding(placeId);
    try {
      await addMutation.mutateAsync({ profileId, placeId });
      toast.success(`✅ ${name} adicionado!`);
      setSearchResults([]);
      setQuery("");
      utils.competitors.getByProfile.invalidate({ profileId });
      refetch();
    } catch (e: any) { toast.error(e.message); }
    setAdding(null);
  };

  const handleRemove = async (id: number, name: string) => {
    try {
      await removeMutation.mutateAsync({ competitorId: id });
      toast.success(`Removido: ${name}`);
      utils.competitors.getByProfile.invalidate({ profileId });
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleFetchAuto = async () => {
    setFetching(true);
    try {
      const res = await fetchMutation.mutateAsync({ profileId });
      toast.success(res.message);
      utils.competitors.getByProfile.invalidate({ profileId });
      refetch();
    } catch (e: any) { toast.error(e.message); }
    setFetching(false);
  };

  const handleAnalyze = async () => {
    if (!competitors?.length) { toast.error("Adicione pelo menos 1 concorrente antes de analisar"); return; }
    setAnalyzing(true);
    try {
      const res = await analyzeMutation.mutateAsync({ profileId });
      setAnalysis(res);
      toast.success("Análise concluída!");
    } catch (e: any) { toast.error(e.message); }
    setAnalyzing(false);
  };

  const chartData = [
    { name: profile?.name?.substring(0, 14) || "Você", rating: profile?.avgRating || 0, reviews: profile?.totalReviews || 0, isYou: true },
    ...(competitors || []).slice(0, 5).map((c: any) => ({
      name: c.name?.substring(0, 14), rating: c.rating || 0, reviews: c.reviewCount || 0, isYou: false,
    })),
  ];

  const myRating = profile?.avgRating || 0;
  const topRating = Math.max(...(competitors || []).map((c: any) => c.rating || 0), 0);
  const ratingDiff = myRating - topRating;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Análise de Concorrentes</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleFetchAuto} disabled={fetching}>
              {fetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Busca Automática
            </Button>
            {(competitors?.length || 0) > 0 && (
              <Button size="sm" onClick={handleAnalyze} disabled={analyzing} className="gap-1.5">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {analyzing ? "Analisando..." : "Análise IA"}
              </Button>
            )}
          </div>
        </div>

        {/* Busca manual */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Search className="w-4 h-4" /> Adicionar Concorrente Manualmente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Salão da Maria, São Paulo SP"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching || !query.trim()}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {/* Resultados da busca */}
            {searchResults.length > 0 && (
              <div className="border rounded-xl divide-y overflow-hidden">
                {searchResults.map((r: any) => (
                  <div key={r.placeId} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm truncate">{r.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-0.5 text-xs text-yellow-600">
                          <Star className="w-3 h-3 fill-yellow-400" />{r.rating || "N/A"}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{r.reviewCount || 0} avaliações</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate">{r.address?.split(",")[0]}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="flex-shrink-0 gap-1"
                      disabled={adding === r.placeId}
                      onClick={() => handleAdd(r.placeId, r.name)}>
                      {adding === r.placeId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de concorrentes */}
        {(competitors?.length || 0) > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold">
                {competitors?.length} Concorrentes · Comparativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {/* Meu perfil no topo */}
                <div className="flex items-center gap-3 py-2.5">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-blue-700 truncate">{profile?.name} <span className="font-normal text-blue-400">(você)</span></p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.address?.split(",")[0]}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">⭐ {profile?.avgRating?.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{profile?.totalReviews} avaliações</p>
                  </div>
                </div>

                {competitors?.map((c: any, i: number) => {
                  const diff = (c.rating || 0) - (profile?.avgRating || 0);
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.address?.split(",")[0]}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-medium text-sm">⭐ {c.rating?.toFixed(1) || "—"}</p>
                          <p className="text-xs text-muted-foreground">{c.reviewCount || 0} av.</p>
                        </div>
                        <div className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${diff > 0.1 ? "bg-red-100 text-red-600" : diff < -0.1 ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                          {diff > 0.1 ? <TrendingUp className="w-3 h-3" /> : diff < -0.1 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </div>
                        <Button variant="ghost" size="icon" className="w-7 h-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleRemove(c.id, c.name)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráficos */}
        {chartData.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Nota Média</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => v.toFixed(1)} />
                    <Bar dataKey="rating" radius={4}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.isYou ? "#2563eb" : "#94a3b8"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Total de Avaliações</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="reviews" radius={4}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.isYou ? "#2563eb" : "#94a3b8"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Análise IA */}
        {analysis && (
          <div className="space-y-4">
            {/* Resumo */}
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0">
                    #{analysis.position}
                  </div>
                  <div>
                    <p className="font-bold text-blue-800">Sua posição no ranking</p>
                    <p className="text-sm text-blue-700 mt-1">{analysis.summary}</p>
                    <div className="flex gap-3 mt-2 text-xs">
                      {analysis.ratingGap !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${analysis.ratingGap > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                          Nota: {analysis.ratingGap > 0 ? "+" : ""}{analysis.ratingGap} vs líder
                        </span>
                      )}
                      {analysis.reviewGap !== undefined && (
                        <span className={`px-2 py-0.5 rounded-full font-medium ${analysis.reviewGap > 0 ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"}`}>
                          {analysis.reviewGap > 0 ? `${analysis.reviewGap} avaliações a menos` : "Mais avaliações que o líder"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SWOT */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-green-200">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-green-700">💪 Pontos Fortes</CardTitle></CardHeader>
                <CardContent>
                  {analysis.strengths?.map((s: string, i: number) => (
                    <div key={i} className="flex gap-2 py-1 text-sm"><span className="text-green-500 flex-shrink-0">✓</span>{s}</div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-red-200">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-red-700">⚠️ Pontos Fracos</CardTitle></CardHeader>
                <CardContent>
                  {analysis.weaknesses?.map((s: string, i: number) => (
                    <div key={i} className="flex gap-2 py-1 text-sm"><span className="text-red-500 flex-shrink-0">✕</span>{s}</div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Ações e Oportunidades */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-purple-200">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-purple-700">🎯 Ações Prioritárias</CardTitle></CardHeader>
                <CardContent>
                  {analysis.actions?.map((a: string, i: number) => (
                    <div key={i} className="flex gap-2 py-1 text-sm">
                      <span className="bg-purple-100 text-purple-600 rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 text-xs font-bold">{i+1}</span>
                      {a}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card className="border-yellow-200">
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-yellow-700">✨ Oportunidades</CardTitle></CardHeader>
                <CardContent>
                  {analysis.opportunities?.map((o: string, i: number) => (
                    <div key={i} className="flex gap-2 py-1 text-sm"><span className="text-yellow-500 flex-shrink-0">→</span>{o}</div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Insights por concorrente */}
            {analysis.competitorInsights?.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">🔍 Análise Individual dos Concorrentes</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analysis.competitorInsights.map((ci: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: `${THREAT_COLOR[ci.threat]}22`, color: THREAT_COLOR[ci.threat] }}>
                          {ci.threat}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{ci.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ci.insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Empty state */}
        {(!competitors || competitors.length === 0) && !searching && (
          <Card><CardContent className="py-12 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="font-semibold">Nenhum concorrente adicionado</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Pesquise pelo nome ou tente a busca automática</p>
            <Button variant="outline" onClick={handleFetchAuto} disabled={fetching}>
              {fetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Busca Automática por Localização
            </Button>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
