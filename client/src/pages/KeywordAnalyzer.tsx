import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

interface KeywordResult {
  keyword: string;
  score: number;
  inDescription: boolean;
  inServices: boolean;
  inReviews: boolean;
  inPosts: boolean;
  inName: boolean;
  suggestion: string;
}

export default function KeywordAnalyzer({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [keywords, setKeywords] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<KeywordResult[]>([]);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId, limit: 50 } as any);
  const analyzeMutation = trpc.keywords.analyze.useMutation();

  const handleAnalyze = async () => {
    const kws = keywords.split(",").map(k => k.trim()).filter(Boolean);
    if (kws.length === 0) { toast.error("Insira pelo menos uma palavra-chave"); return; }
    setAnalyzing(true);
    try {
      const res = await analyzeMutation.mutateAsync({ profileId, keywords: kws });
      setResults(res.results);
      toast.success("Análise concluída!");
    } catch (e: any) {
      toast.error(e.message || "Erro na análise");
    }
    setAnalyzing(false);
  };

  function scoreColor(v: number) { return v >= 75 ? "text-green-600" : v >= 50 ? "text-yellow-600" : "text-red-500" }
  function scoreHex(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444" }
  function scoreLabel(v: number) { return v >= 75 ? "Ótimo" : v >= 50 ? "Regular" : "Fraco" }

  const avgScore = results.length ? Math.round(results.reduce((a, r) => a + r.score, 0) / results.length) : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Analisador de Keywords</h1>
            <p className="text-sm text-muted-foreground">{profile?.name} · Verifique se suas palavras aparecem nos lugares certos</p>
          </div>
        </div>

        {/* Explicação */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-4">
          <p className="font-semibold text-sm text-green-800 mb-1">🎯 Como funciona o SEO de keywords no Google Business</p>
          <p className="text-xs text-green-700">O Google escaneia: nome do negócio, descrição, serviços, respostas a reviews e posts. Quanto mais vezes sua keyword aparecer nesses locais, maior a chance de ranquear para ela.</p>
        </div>

        {/* Input */}
        <Card>
          <CardContent className="pt-4">
            <label className="text-sm font-semibold block mb-2">Palavras-chave que você quer ranquear</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[80px] resize-none"
              placeholder="advocacia trabalhista&#10;advogado trabalhista SP&#10;rescisão contrato trabalho&#10;(uma por linha ou separadas por vírgula)"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
            <Button onClick={handleAnalyze} disabled={analyzing} className="mt-3 w-full gap-2 h-11">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
              {analyzing ? "Analisando perfil..." : "Analisar Keywords"}
            </Button>
          </CardContent>
        </Card>

        {/* Resultado geral */}
        {results.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold" style={{ color: scoreHex(avgScore) }}>{avgScore}</div>
                <div className="text-xs text-muted-foreground mt-1">Score médio SEO</div>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-green-600">{results.filter(r => r.score >= 75).length}</div>
                <div className="text-xs text-muted-foreground mt-1">Keywords fortes</div>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-red-500">{results.filter(r => r.score < 50).length}</div>
                <div className="text-xs text-muted-foreground mt-1">Precisam atenção</div>
              </CardContent></Card>
            </div>

            {/* Resultados por keyword */}
            <div className="space-y-3">
              {results.map((r, i) => (
                <Card key={i} className={`border-l-4`} style={{ borderLeftColor: scoreHex(r.score) }}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-bold text-base">"{r.keyword}"</span>
                        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full`}
                          style={{ background: `${scoreHex(r.score)}22`, color: scoreHex(r.score) }}>
                          {scoreLabel(r.score)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold" style={{ color: scoreHex(r.score) }}>{r.score}</div>
                        <div className="text-[10px] text-muted-foreground">/ 100</div>
                      </div>
                    </div>

                    <Progress value={r.score} className="h-2 mb-3" />

                    {/* Onde aparece */}
                    <div className="grid grid-cols-5 gap-1 mb-3">
                      {[
                        ["Nome", r.inName],
                        ["Descrição", r.inDescription],
                        ["Serviços", r.inServices],
                        ["Reviews", r.inReviews],
                        ["Posts", r.inPosts],
                      ].map(([label, present]) => (
                        <div key={label as string} className={`text-center py-1.5 rounded-lg text-[10px] font-medium ${present ? "bg-green-100 text-green-700" : "bg-red-50 text-red-400"}`}>
                          {present ? "✓" : "✗"}<br />{label}
                        </div>
                      ))}
                    </div>

                    {/* Sugestão */}
                    {r.score < 100 && (
                      <div className="bg-blue-50 rounded-lg p-2.5 flex gap-2">
                        <span className="text-blue-500">💡</span>
                        <p className="text-xs text-blue-700">{r.suggestion}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
