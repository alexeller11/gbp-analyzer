import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

interface Props { params: { profileId: string } }

export default function CompetitorComparison({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: competitors } = trpc.competitors.getByProfile.useQuery({ profileId });
  const { data: score } = trpc.scores.getByProfile.useQuery({ profileId });

  const compData = [
    { name: profile?.name?.substring(0, 14) || "Seu Perfil", rating: profile?.avgRating || 0, reviews: profile?.totalReviews || 0 },
    ...(competitors || []).slice(0, 4).map((c: any) => ({
      name: c.name?.substring(0, 14), rating: c.rating || 0, reviews: c.reviewCount || 0,
    })),
  ];

  const radarData = score ? [
    { metric: "Completude", value: Math.round(score.completeness) },
    { metric: "Reviews", value: Math.round(score.reviewScore) },
    { metric: "Engajamento", value: Math.round(score.engagement) },
    { metric: "Consistência", value: Math.round(score.consistency) },
    { metric: "Mídia", value: Math.round(score.mediaScore) },
  ] : [];

  const ttip = { contentStyle: { background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 } };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Análise de Concorrentes</h1>
            <p className="text-sm text-muted-foreground">{profile?.name || "Carregando..."}</p>
          </div>
        </div>

        {/* Tabela de concorrentes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Concorrentes Próximos</CardTitle></CardHeader>
          <CardContent>
            {!competitors || competitors.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-3xl mb-2">🏢</div>
                <p className="text-muted-foreground text-sm">Nenhum concorrente mapeado ainda.</p>
                <p className="text-xs text-muted-foreground mt-1">Os concorrentes são identificados automaticamente após sincronização.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {[{ name: profile?.name, rating: profile?.avgRating, reviews: profile?.totalReviews, isYou: true },
                  ...(competitors || []).map((c: any) => ({ name: c.name, rating: c.rating, reviews: c.reviewCount, isYou: false }))
                ].map((c: any, i) => (
                  <div key={i} className={`flex items-center justify-between py-3 border-b last:border-0 ${c.isYou ? "bg-blue-50/50 -mx-4 px-4 rounded-lg" : ""}`}>
                    <div>
                      <p className="font-medium text-sm">{c.name} {c.isYou && <span className="text-xs text-blue-600 font-bold ml-1">← Você</span>}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-yellow-500 font-bold">★ {(c.rating || 0).toFixed(1)}</span>
                      <span className="text-muted-foreground">{c.reviews || 0} avaliações</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {compData.length > 1 && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Comparação de Nota Média</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={compData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip {...ttip} />
                    <Bar dataKey="rating" fill="#3b82f6" radius={[0,4,4,0]} name="Nota" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Volume de Avaliações</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={compData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip {...ttip} />
                    <Bar dataKey="reviews" fill="#8b5cf6" radius={[4,4,0,0]} name="Avaliações" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {radarData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Radar de Performance — Seu Perfil</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Score" />
                  <Tooltip {...ttip} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
