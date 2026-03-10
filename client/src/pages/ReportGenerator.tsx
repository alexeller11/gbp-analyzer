import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, FileText, Download, Star, TrendingUp, Users, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

export default function ReportGenerator({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: score } = trpc.scores.getByProfile.useQuery({ profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId });
  const { data: competitors } = trpc.competitors.getByProfile.useQuery({ profileId });
  const generateMutation = trpc.report.generate.useMutation();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateMutation.mutateAsync({ profileId });
      setReport(res);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Relatório Completo</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          {report && (
            <Button onClick={handlePrint} variant="outline">
              <Download className="w-4 h-4 mr-2" /> Imprimir / Salvar PDF
            </Button>
          )}
        </div>

        {!report ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <p className="font-semibold text-lg mb-2">Gerar Relatório Completo</p>
              <p className="text-sm text-muted-foreground mb-2">O relatório inclui:</p>
              <div className="text-sm text-left max-w-xs mx-auto space-y-1 mb-6">
                {["Score de otimização detalhado", "Análise de concorrentes", "Top palavras-chave", "Sentimento das avaliações", "Plano de ação priorizado", "Recomendações de conteúdo"].map((item, i) => (
                  <p key={i} className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />{item}</p>
                ))}
              </div>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                {loading ? "Gerando relatório..." : "Gerar Relatório"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 print:text-black" id="report">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-6 print:bg-blue-600">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{profile?.name}</h2>
                  <p className="text-blue-100 text-sm mt-1">{profile?.category} • {profile?.address}</p>
                  <p className="text-blue-200 text-xs mt-2">Relatório gerado em {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold">{report.overallScore}</p>
                  <p className="text-blue-200 text-xs">Score GBP</p>
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Star, label: "Nota Média", value: (profile?.avgRating || 0).toFixed(1), color: "text-yellow-500" },
                { icon: Users, label: "Avaliações", value: profile?.totalReviews || 0, color: "text-blue-600" },
                { icon: TrendingUp, label: "Posição Local", value: `#${report.localRank || "?"}`, color: "text-green-600" },
                { icon: CheckCircle2, label: "Completude", value: `${Math.round(score?.completeness || 0)}%`, color: "text-purple-600" },
              ].map((m, i) => (
                <Card key={i}>
                  <CardContent className="pt-3 text-center">
                    <m.icon className={`w-5 h-5 mx-auto mb-1 ${m.color}`} />
                    <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Diagnóstico */}
            <Card>
              <CardHeader><CardTitle className="text-base">📊 Diagnóstico do Perfil</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {report.diagnosis?.map((d: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${d.status === "ok" ? "bg-green-50" : d.status === "warn" ? "bg-yellow-50" : "bg-red-50"}`}>
                    <span className="text-lg">{d.status === "ok" ? "✅" : d.status === "warn" ? "⚠️" : "❌"}</span>
                    <div>
                      <p className="text-sm font-semibold">{d.item}</p>
                      <p className="text-xs text-muted-foreground">{d.detail}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sentimento */}
            {report.sentiment && (
              <Card>
                <CardHeader><CardTitle className="text-base">💬 Análise de Sentimento das Avaliações</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{report.sentiment.positive}%</p>
                      <p className="text-xs text-green-700">Positivas</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-600">{report.sentiment.neutral}%</p>
                      <p className="text-xs text-gray-600">Neutras</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-500">{report.sentiment.negative}%</p>
                      <p className="text-xs text-red-600">Negativas</p>
                    </div>
                  </div>
                  {report.sentiment.themes?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Temas mais mencionados:</p>
                      <div className="flex flex-wrap gap-2">
                        {report.sentiment.themes.map((t: string, i: number) => (
                          <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Plano de ação */}
            <Card className="border-blue-200">
              <CardHeader><CardTitle className="text-base text-blue-800">🎯 Plano de Ação — Próximos 30 dias</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {report.actionPlan?.map((a: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start p-3 border rounded-lg">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${a.priority === "alta" ? "bg-red-100 text-red-700" : a.priority === "media" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                      {(a.priority || "media").toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{a.action}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.why}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button onClick={() => setReport(null)} variant="outline">Gerar Novo Relatório</Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
