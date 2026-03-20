import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLocation } from "wouter";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

interface Props { params: { profileId: string } }

function scoreColor(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444"; }

export default function ScoreHistoryPage({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: history } = trpc.scoreHistory.getByProfile.useQuery({ profileId });
  const { data: currentScore } = trpc.scores.getByProfile.useQuery({ profileId });
  const snapshotMutation = trpc.scoreHistory.snapshot.useMutation();

  const chartData = [...(history || [])].reverse().map(h => ({
    date: new Date(h.snapshotAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    total: Math.round(h.total),
    completeness: Math.round(h.completeness),
    reviewScore: Math.round(h.reviewScore),
    engagement: Math.round(h.engagement),
  }));

  const firstScore = chartData[0]?.total;
  const lastScore = chartData[chartData.length - 1]?.total;
  const trend = firstScore && lastScore ? lastScore - firstScore : 0;

  const ttip = { contentStyle: { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

  const radarData = currentScore ? [
    { s: "Completude", v: Math.round(currentScore.completeness) },
    { s: "Reviews", v: Math.round(currentScore.reviewScore) },
    { s: "Engajamento", v: Math.round(currentScore.engagement) },
    { s: "Consistência", v: Math.round(currentScore.consistency) },
    { s: "Mídia", v: Math.round(currentScore.mediaScore) },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Histórico de Score</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={async () => {
            try { await snapshotMutation.mutateAsync({ profileId }); window.location.reload(); }
            catch (e: any) { alert(e.message); }
          }}>
            📸 Salvar snapshot
          </Button>
        </div>

        {/* Score atual + tendência */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-black" style={{ color: scoreColor(currentScore?.total || 0) }}>
              {currentScore ? Math.round(currentScore.total) : "—"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Score atual</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 text-center">
            <div className={`text-3xl font-black flex items-center justify-center gap-1 ${trend > 0 ? "text-green-600" : trend < 0 ? "text-red-500" : "text-gray-400"}`}>
              {trend > 0 ? <TrendingUp className="w-6 h-6" /> : trend < 0 ? <TrendingDown className="w-6 h-6" /> : <Minus className="w-6 h-6" />}
              {Math.abs(trend)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Evolução total</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3 text-center">
            <div className="text-3xl font-black text-blue-600">{history?.length || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Snapshots</div>
          </CardContent></Card>
        </div>

        {chartData.length >= 2 ? (<>
          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Evolução do Score Total</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip {...ttip} />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: "#3b82f6" }} name="Score" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Evolução por Dimensão</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip {...ttip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="completeness" stroke="#22c55e" strokeWidth={2} dot={false} name="Completude" />
                  <Line type="monotone" dataKey="reviewScore" stroke="#f59e0b" strokeWidth={2} dot={false} name="Reviews" />
                  <Line type="monotone" dataKey="engagement" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Engajamento" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>) : (
          <Card><CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 text-blue-300 mx-auto mb-3" />
            <p className="font-semibold">Histórico ainda vazio</p>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Salvar snapshot" para registrar o score de hoje.<br />
              A cada sincronização, um snapshot é salvo automaticamente.
            </p>
          </CardContent></Card>
        )}

        {radarData.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Radar Atual</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="s" tick={{ fontSize: 11 }} />
                  <Radar dataKey="v" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
