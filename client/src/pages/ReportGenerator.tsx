import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, FileText, Download, CheckCircle2, XCircle, AlertCircle, TrendingUp, Zap, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

const STATUS_ICON = {
  ok: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
  warn: <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
  fail: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
};
const PRIORITY_COLOR: Record<string, string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-green-100 text-green-700 border-green-200",
};
const MARKET_STATUS_COLOR: Record<string, string> = {
  "líder": "bg-green-100 text-green-800 border-green-300",
  "competitivo": "bg-blue-100 text-blue-800 border-blue-300",
  "em risco": "bg-orange-100 text-orange-800 border-orange-300",
  "crítico": "bg-red-100 text-red-800 border-red-300",
};

export default function ReportGenerator({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: score } = trpc.scores.getByProfile.useQuery({ profileId });
  const generateMutation = trpc.report.generate.useMutation();
  const publicReportMutation = trpc.publicReport.generate.useMutation();
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    if (!profileId) return;
    setSharing(true);
    try {
      const res = await publicReportMutation.mutateAsync({ profileId });
      const fullUrl = `${window.location.origin}/public/report/${res.token}`;
      setPublicUrl(fullUrl);
      navigator.clipboard.writeText(fullUrl);
      toast.success("Link copiado! Válido por 30 dias.");
    } catch (e: any) { toast.error(e.message); }
    setSharing(false);
  };

  // Auto-gera ao abrir
  useEffect(() => {
    if (profile && !report) handleGenerate();
  }, [profile]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateMutation.mutateAsync({ profileId });
      setReport(res);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const scoreColor = (v: number) => v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444";

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Relatório Estratégico</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {report && (
              <Button onClick={handleGenerate} variant="outline" size="sm" disabled={loading}>
                <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : "hidden"}`} />
                Regenerar
              </Button>
            )}
            {report && (<div className="flex gap-2">
              <Button onClick={handleShare} variant="outline" size="sm" disabled={sharing} className="gap-1.5">
                {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                Compartilhar
              </Button>
              <Button onClick={() => window.print()} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>)}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="font-semibold text-lg">Gerando relatório estratégico...</p>
              <p className="text-sm text-muted-foreground mt-1">Analisando {profile?.totalReviews || 0} avaliações e dados do perfil</p>
            </CardContent>
          </Card>
        )}

        {publicUrl && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-800 font-medium truncate">{publicUrl}</span>
            </div>
            <Button size="sm" variant="ghost" className="flex-shrink-0 h-7 text-xs"
              onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Copiado!"); }}>
              Copiar
            </Button>
          </div>
        )}

        {report && !loading && (<>
          {/* ── Cabeçalho do relatório ── */}
          <Card className="border-2" style={{ borderColor: scoreColor(report.overallScore) }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Score GBP</p>
                  <div className="text-5xl font-black mt-0.5" style={{ color: scoreColor(report.overallScore) }}>{report.overallScore}</div>
                  <p className="text-xs text-muted-foreground mt-1">de 100 pontos</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Posição Local</p>
                  <div className="text-5xl font-black mt-0.5 text-blue-600">#{report.localRank}</div>
                  <p className="text-xs text-muted-foreground mt-1">de {report.rankTotal || "?"} negócios</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Status</p>
                  <div className={`mt-1 px-3 py-1.5 rounded-full text-sm font-bold border ${MARKET_STATUS_COLOR[report.marketStatus] || "bg-gray-100 text-gray-700"}`}>
                    {report.marketStatus || "—"}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{profile?.name}</p>
                  <p>{profile?.category}</p>
                  <p className="mt-1">{new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Quick Wins ── */}
          {report.quickWins?.length > 0 && (
            <Card className="border-green-200 bg-green-50/30">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 fill-yellow-400 stroke-yellow-500" /> Quick Wins — Faça agora
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {report.quickWins.map((w: string, i: number) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-bold mt-0.5">{i === 0 ? "HOJE" : "SEMANA"}</span>
                    <p className="text-sm text-green-800">{w}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ── Diagnóstico ── */}
          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Diagnóstico Completo</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(report.diagnosis || []).map((d: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${d.status === "fail" ? "bg-red-50/30" : d.status === "warn" ? "bg-yellow-50/20" : ""}`}>
                  {STATUS_ICON[d.status as keyof typeof STATUS_ICON] || STATUS_ICON.warn}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{d.item}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.detail}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Sentimento + Gap competitivo ── */}
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Sentimento das Avaliações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Positivas", pct: report.sentiment?.positive || 0, color: "#22c55e" },
                  { label: "Neutras", pct: report.sentiment?.neutral || 0, color: "#94a3b8" },
                  { label: "Negativas", pct: report.sentiment?.negative || 0, color: "#ef4444" },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-bold">{s.pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
                {report.sentiment?.themes?.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1.5">Temas mais mencionados:</p>
                    <div className="flex flex-wrap gap-1">
                      {report.sentiment.themes.map((t: string, i: number) => (
                        <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {report.sentiment?.topComplaint && (
                  <div className="pt-1 border-t">
                    <p className="text-xs text-red-600"><span className="font-semibold">Principal reclamação:</span> {report.sentiment.topComplaint}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Gap Competitivo</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-gray-50">
                    <div className={`text-2xl font-bold ${report.competitiveGap?.ratingGap > 0 ? "text-red-500" : "text-green-600"}`}>
                      {report.competitiveGap?.ratingGap > 0 ? "-" : "+"}{Math.abs(report.competitiveGap?.ratingGap || 0)}⭐
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs líder (nota)</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-gray-50">
                    <div className={`text-2xl font-bold ${report.competitiveGap?.reviewGap > 0 ? "text-orange-500" : "text-green-600"}`}>
                      {report.competitiveGap?.reviewGap > 0 ? "-" : "+"}{Math.abs(report.competitiveGap?.reviewGap || 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">vs líder (avaliações)</p>
                  </div>
                </div>
                {report.competitiveGap?.toClose && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-semibold text-blue-800 mb-1">🎯 Para fechar o gap em 90 dias:</p>
                    <p className="text-xs text-blue-700">{report.competitiveGap.toClose}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Plano de ação ── */}
          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Plano de Ação Prioritário</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(report.actionPlan || []).map((a: any, i: number) => (
                <div key={i} className={`flex gap-3 px-4 py-3 border-b last:border-0 ${a.priority === "alta" ? "bg-red-50/20" : ""}`}>
                  <div className={`text-xs font-bold px-2 py-1 rounded-full border h-fit flex-shrink-0 mt-0.5 ${PRIORITY_COLOR[a.priority] || "bg-gray-100 text-gray-600"}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm">{a.action}</p>
                      {a.timeframe && (
                        <span className="text-[10px] flex items-center gap-0.5 text-muted-foreground flex-shrink-0 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5" />{a.timeframe}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.why}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── Previsão ── */}
          {report.forecast && (
            <Card className="border-orange-200 bg-orange-50/20">
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-orange-800">⚠️ Previsão para 90 dias (sem ação)</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-orange-700">{report.forecast}</p>
              </CardContent>
            </Card>
          )}
        </>)}
      </div>
    </DashboardLayout>
  );
}
