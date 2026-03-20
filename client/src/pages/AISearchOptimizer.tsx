import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Brain, CheckCircle2, XCircle, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

const PLATFORMS = [
  { key: "googleAI", label: "Google AI Overview", icon: "🔵", desc: "Aparece nas respostas do Google com IA" },
  { key: "chatGPT", label: "ChatGPT / Bing", icon: "🟢", desc: "Mencionado pelo ChatGPT em buscas locais" },
  { key: "gemini", label: "Google Gemini", icon: "🟣", desc: "Visível no assistente Gemini do Google" },
  { key: "perplexity", label: "Perplexity AI", icon: "⚫", desc: "Aparece em respostas do Perplexity" },
  { key: "grok", label: "Grok / X AI", icon: "🔳", desc: "Mencionado no assistente da X (Twitter)" },
];

function scoreColor(v: number) {
  return v >= 70 ? "#16a34a" : v >= 40 ? "#d97706" : "#ef4444";
}

function ScoreRing({ value, size = 80 }: { value: number; size?: number }) {
  const c = scoreColor(value);
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, dash = (value / 100) * circ;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 900, color: c }}>{value}</span>
        <span style={{ fontSize: 9, color: "#94a3b8", marginTop: -2 }}>/ 100</span>
      </div>
    </div>
  );
}

export default function AISearchOptimizer({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const analyzeMutation = trpc.aiSearch.analyze.useMutation();

  // Auto-analisa ao abrir
  useEffect(() => {
    if (profile && !result) handleAnalyze();
  }, [profile]);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await analyzeMutation.mutateAsync({ profileId });
      setResult(res);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const StatusIcon = ({ v }: { v: "ok" | "warn" | "fail" }) =>
    v === "ok" ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" /> :
    v === "warn" ? <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" /> :
    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-600" /> Visibilidade em IA
              </h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          {result && (
            <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Reanalisar
            </Button>
          )}
        </div>

        {/* Contexto */}
        <Card className="border-purple-200 bg-purple-50/30">
          <CardContent className="pt-3 pb-3">
            <p className="text-sm text-purple-800">
              <strong>ChatGPT, Gemini, Grok e Perplexity</strong> já respondem perguntas como <em>"qual o melhor {profile?.category?.toLowerCase() || "negócio"} perto de mim?"</em>.
              Esta análise verifica se seu perfil está otimizado para aparecer nessas respostas.
            </p>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-14 text-center">
              <Brain className="w-10 h-10 text-purple-500 mx-auto mb-3 animate-pulse" />
              <p className="font-semibold">Analisando visibilidade em 5 plataformas de IA...</p>
              <p className="text-sm text-muted-foreground mt-1">ChatGPT · Gemini · Grok · Perplexity · Google AI</p>
            </CardContent>
          </Card>
        )}

        {result && !loading && (<>

          {/* Score geral + por plataforma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Score geral */}
            <Card className="flex items-center gap-4 p-5">
              <ScoreRing value={result.score} size={90} />
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide">Score de Visibilidade IA</p>
                <p className="text-2xl font-black mt-0.5" style={{ color: scoreColor(result.score) }}>
                  {result.score >= 70 ? "Alta" : result.score >= 40 ? "Moderada" : "Baixa"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {result.score >= 70 ? "Seu perfil aparece bem nas IAs" :
                   result.score >= 40 ? "Visibilidade parcial — pode melhorar" :
                   "Risco de não aparecer nas IAs"}
                </p>
              </div>
            </Card>

            {/* Por plataforma */}
            <Card>
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Por Plataforma</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {PLATFORMS.map(p => {
                  const val = result[p.key] || 0;
                  return (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="text-base w-5 flex-shrink-0">{p.icon}</span>
                      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{p.label}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: scoreColor(val) }} />
                      </div>
                      <span className="text-xs font-bold w-7 text-right" style={{ color: scoreColor(val) }}>{val}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Fatores */}
          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Fatores de Visibilidade</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(result.factors || []).map((f: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${f.status === "fail" ? "bg-red-50/20" : f.status === "warn" ? "bg-yellow-50/20" : ""}`}>
                  <StatusIcon v={f.status} />
                  <div>
                    <p className="text-sm font-medium">{f.factor}</p>
                    <p className="text-xs text-muted-foreground">{f.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* O que as IAs perguntam */}
          {result.likelyQueries?.length > 0 && (
            <Card className="border-blue-200">
              <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">🔍 Perguntas que as IAs respondem sobre você</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                {result.likelyQueries.map((q: string, i: number) => (
                  <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full">
                    "{q}"
                  </span>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Plano de ação */}
          <Card className="border-purple-200">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm text-purple-800 flex items-center gap-2">
                <Zap className="w-4 h-4" /> Plano de Ação para Aparecer nas IAs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {(result.actions || []).map((a: any, i: number) => (
                <div key={i} className="flex gap-3 items-start p-3 bg-purple-50 rounded-xl">
                  <span className="bg-purple-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-900">{a.action}</p>
                    <p className="text-xs text-purple-600 mt-0.5">{a.impact}</p>
                    {a.platform && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full mt-1 inline-block">{a.platform}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>)}
      </div>
    </DashboardLayout>
  );
}
