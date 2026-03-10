import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Brain, Search, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

export default function AISearchOptimizer({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const analyzeMutation = trpc.aiSearch.analyze.useMutation();

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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Otimização para IA Search</h1>
            <p className="text-sm text-muted-foreground">{profile?.name}</p>
          </div>
        </div>

        <Card className="border-purple-200 bg-purple-50/30">
          <CardContent className="pt-4">
            <div className="flex gap-3 items-start">
              <Brain className="w-8 h-8 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-purple-900">O que é AI Search?</p>
                <p className="text-sm text-purple-700 mt-1">ChatGPT, Gemini, Perplexity e outras IAs estão respondendo perguntas sobre negócios locais. Esta análise verifica se seu perfil está otimizado para aparecer nessas respostas e no Google AI Overview.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!result ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <p className="font-semibold text-lg mb-2">Analisar Visibilidade em IAs</p>
              <p className="text-sm text-muted-foreground mb-6">A IA vai verificar 20+ fatores que influenciam se seu negócio aparece no ChatGPT, Gemini, Google AI Overview e Perplexity.</p>
              <Button onClick={handleAnalyze} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Brain className="w-4 h-4 mr-2" />}
                {loading ? "Analisando..." : "Iniciar Análise"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Score geral */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Score Geral", value: result.score, color: result.score >= 70 ? "text-green-600" : result.score >= 40 ? "text-yellow-600" : "text-red-500" },
                { label: "Google AI", value: result.googleAI, color: "text-blue-600" },
                { label: "ChatGPT/Bing", value: result.chatGPT, color: "text-green-600" },
                { label: "Perplexity", value: result.perplexity, color: "text-purple-600" },
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="pt-3 text-center">
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Fatores */}
            <Card>
              <CardHeader><CardTitle className="text-base">Fatores de Visibilidade</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.factors?.map((f: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b last:border-0">
                    <StatusIcon v={f.status} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{f.factor}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Plano de ação */}
            <Card className="border-purple-200">
              <CardHeader><CardTitle className="text-base text-purple-800">🎯 Plano de Ação para AI Search</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {result.actions?.map((a: any, i: number) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-purple-50 rounded-lg">
                    <span className="bg-purple-600 text-white text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{i+1}</span>
                    <div>
                      <p className="text-sm font-medium text-purple-900">{a.action}</p>
                      <p className="text-xs text-purple-600 mt-0.5">{a.impact}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>Nova Análise</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
