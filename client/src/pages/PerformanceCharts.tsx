import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface Props { params: { profileId: string } }

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

// Gera métricas mock para quando não há dados reais ainda
function mockMetrics() {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return months.map(m => ({
    date: m,
    views: Math.floor(400 + Math.random() * 1200),
    searches: Math.floor(100 + Math.random() * 600),
    mapViews: Math.floor(200 + Math.random() * 800),
    websiteClicks: Math.floor(30 + Math.random() * 200),
    phoneCallClicks: Math.floor(5 + Math.random() * 80),
    directionRequests: Math.floor(10 + Math.random() * 120),
  }));
}

export default function PerformanceCharts({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [syncing, setSyncing] = useState(false);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: score } = trpc.scores.getByProfile.useQuery({ profileId });
  const { data: rawMetrics } = trpc.metrics.getByProfile.useQuery({ profileId });
  const syncMutation = trpc.sync.syncProfile.useMutation();
  const utils = trpc.useUtils();

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncMutation.mutateAsync({ profileId });
      if (res.success) {
        toast.success(`Sincronizado! ${res.reviews || 0} reviews atualizados.`);
        utils.metrics.getByProfile.invalidate({ profileId });
        utils.scores.getByProfile.invalidate({ profileId });
      } else {
        toast.error(res.error || "Erro na sincronização");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  // Usar dados reais ou mock
  const chartData = rawMetrics && rawMetrics.length > 0
    ? rawMetrics.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((m: any) => ({
          date: new Date(m.date).toLocaleDateString("pt-BR", { month: "short" }),
          views: m.views || 0,
          searches: m.searches || 0,
          mapViews: m.mapViews || 0,
          websiteClicks: m.websiteClicks || 0,
          phoneCallClicks: m.phoneCallClicks || 0,
          directionRequests: m.directionRequests || 0,
        }))
    : mockMetrics();

  const isMockData = !rawMetrics || rawMetrics.length === 0;

  const scoreData = score ? [
    { name: "Completude", value: Math.round(score.completeness) },
    { name: "Reviews", value: Math.round(score.reviewScore) },
    { name: "Engajamento", value: Math.round(score.engagement) },
    { name: "Consistência", value: Math.round(score.consistency) },
    { name: "Mídia", value: Math.round(score.mediaScore) },
  ] : [];

  const ttip = { contentStyle: { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Performance</h1>
              <p className="text-sm text-muted-foreground">{profile?.name || "Carregando..."}</p>
            </div>
          </div>
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar Google
          </Button>
        </div>

        {isMockData && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
            ⚠️ Exibindo dados de exemplo. Clique em <strong>"Sincronizar Google"</strong> para carregar dados reais.
          </div>
        )}

        {/* Métricas resumo */}
        {profile && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["⭐", "Nota Média", (profile.avgRating || 0).toFixed(1)],
              ["💬", "Avaliações", profile.totalReviews || 0],
              ["📸", "Fotos", profile.photoCount || 0],
              ["📝", "Posts", profile.postCount || 0],
            ].map(([icon, label, val]) => (
              <Card key={label as string}>
                <CardContent className="pt-4">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-2xl font-bold">{val}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Score Breakdown */}
        {scoreData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Score por Dimensão</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={scoreData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {scoreData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...ttip} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Scores Detalhados</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={scoreData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip {...ttip} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Score" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Visualizações */}
        <Card>
          <CardHeader><CardTitle className="text-base">Visualizações e Buscas (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...ttip} /><Legend />
                <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} name="Visualizações" />
                <Line type="monotone" dataKey="searches" stroke="#10b981" strokeWidth={2} dot={false} name="Buscas" />
                <Line type="monotone" dataKey="mapViews" stroke="#f59e0b" strokeWidth={2} dot={false} name="Views no Maps" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Interações */}
        <Card>
          <CardHeader><CardTitle className="text-base">Interações</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...ttip} /><Legend />
                <Bar dataKey="websiteClicks" fill="#3b82f6" radius={[3,3,0,0]} name="Cliques no site" />
                <Bar dataKey="phoneCallClicks" fill="#8b5cf6" radius={[3,3,0,0]} name="Ligações" />
                <Bar dataKey="directionRequests" fill="#10b981" radius={[3,3,0,0]} name="Rotas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
