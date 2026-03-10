import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus, Trophy, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface Props { params: { profileId: string } }

export default function CompetitorComparison({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [fetching, setFetching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: competitors, refetch } = trpc.competitors.getByProfile.useQuery({ profileId });
  const fetchMutation = trpc.competitors.fetchReal.useMutation();
  const analyzeMutation = trpc.competitors.analyze.useMutation();
  const utils = trpc.useUtils();

  const ttip = { contentStyle: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 } };

  const handleFetch = async () => {
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
    setAnalyzing(true);
    try {
      const res = await analyzeMutation.mutateAsync({ profileId });
      setAnalysis(res);
    } catch (e: any) { toast.error(e.message); }
    setAnalyzing(false);
  };

  const chartData = [
    { name: profile?.name?.substring(0, 16) || "Você", rating: profile?.avgRating || 0, reviews: profile?.totalReviews || 0, isYou: true },
    ...(competitors || []).slice(0, 4).map((c: any) => ({
      name: c.name?.substring(0, 16), rating: c.rating || 0, reviews: c.reviewCount || 0, isYou: false,
    })),
  ];

  const myRating = profile?.avgRating || 0;
  const topCompRating = Math.max(...(competitors || []).map((c: any) => c.rating || 0));
  const ratingDiff = myRating - topCompRating;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Análise de Concorrentes</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleFetch} disabled={fetching}>
              {fetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Buscar Concorrentes
            </Button>
            {competitors && competitors.length > 0 && (
              <Button onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "🤖"}
                Análise IA
              </Button>
            )}
          </div>
        </div>

        {/* Resumo rápido */}
        {competitors && competitors.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{myRating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">Sua nota média</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <p className={`text-3xl font-bold ${ratingDiff >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {ratingDiff >= 0 ? "+" : ""}{ratingDiff.toFixed(1)}
                  </p>
                  {ratingDiff > 0 ? <TrendingUp className="w-5 h-5 text-green-600" /> :
                   ratingDiff < 0 ? <TrendingDown className="w-5 h-5 text-red-500" /> :
                   <Minus className="w-5 h-5 text-gray-400" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">vs. melhor concorrente</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-purple-600">{competitors.length}</p>
                <p className="text-xs text-muted-foreground mt-1">concorrentes mapeados</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabela */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4" />Ranking Local</CardTitle></CardHeader>
          <CardContent>
            {!competitors || competitors.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-3">🏢</div>
                <p className="text-muted-foreground text-sm mb-4">Nenhum concorrente mapeado ainda.</p>
                <Button onClick={handleFetch} disabled={fetching}>
                  {fetching ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Buscar concorrentes próximos
                </Button>
              </div>
            ) : (
              <div>
                {[
                  { name: profile?.name, rating: profile?.avgRating, reviews: profile?.totalReviews, address: profile?.address, isYou: true },
                  ...(competitors || []).map((c: any) => ({ name: c.name, rating: c.rating, reviews: c.reviewCount, address: c.address, isYou: false }))
                ]
                  .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                  .map((c: any, i) => (
                  <div key={i} className={`flex items-center gap-3 py-3 border-b last:border-0 ${c.isYou ? "bg-blue-50 -mx-4 px-4 rounded-lg" : ""}`}>
                    <span className={`text-lg font-bold w-6 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-gray-300"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{c.name} {c.isYou && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold ml-1">VOCÊ</span>}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.address}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-500">★ {(c.rating || 0).toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">{c.reviews || 0} avaliações</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráficos */}
        {chartData.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Nota Média</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip {...ttip} />
                    <Bar dataKey="rating" radius={[0,4,4,0]} name="Nota">
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.isYou ? "#3b82f6" : "#94a3b8"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Volume de Avaliações</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip {...ttip} />
                    <Bar dataKey="reviews" radius={[4,4,0,0]} name="Avaliações">
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.isYou ? "#8b5cf6" : "#c4b5fd"} />)}
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
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader><CardTitle className="text-base">🤖 Análise Estratégica IA</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border">{analysis.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold text-sm text-green-700 mb-2">✅ Pontos Fortes</p>
                    {analysis.strengths?.map((s: string, i: number) => <p key={i} className="text-sm text-gray-600 mb-1">• {s}</p>)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-red-600 mb-2">⚠️ Pontos Fracos</p>
                    {analysis.weaknesses?.map((w: string, i: number) => <p key={i} className="text-sm text-gray-600 mb-1">• {w}</p>)}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-sm text-blue-700 mb-2">🎯 Ações Prioritárias</p>
                  {analysis.actions?.map((a: string, i: number) => (
                    <div key={i} className="flex gap-2 items-start mb-2 bg-white rounded p-2 border">
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0">{i+1}</span>
                      <p className="text-sm text-gray-700">{a}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-sm text-purple-700 mb-2">💡 Oportunidades</p>
                  {analysis.opportunities?.map((o: string, i: number) => <p key={i} className="text-sm text-gray-600 mb-1">• {o}</p>)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
