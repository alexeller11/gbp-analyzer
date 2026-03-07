import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Sparkles, Copy, Check, Star, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

function Stars({ v }: { v: number }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= v ? "#f59e0b" : "#d1d5db", fontSize: 14 }}>★</span>)}</span>;
}

export default function ReviewResponder({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [generating, setGenerating] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [keywords, setKeywords] = useState("");

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId, limit: 30 } as any);
  const generateMutation = trpc.reviewAI.generateResponse.useMutation();

  const unanswered = (reviews || []).filter((r: any) => !r.reply && !responses[r.id]);
  const answered = (reviews || []).filter((r: any) => r.reply || responses[r.id]);

  const handleGenerate = async (review: any) => {
    setGenerating(review.id);
    try {
      const res = await generateMutation.mutateAsync({
        profileId,
        reviewId: review.id,
        authorName: review.authorName,
        rating: review.rating,
        comment: review.comment || "",
        keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
      setResponses(prev => ({ ...prev, [review.id]: res.response }));
      toast.success("Resposta gerada com SEO!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar resposta");
    }
    setGenerating(null);
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copiado! Cole diretamente no Google Business.");
  };

  const handleGenerateAll = async () => {
    const pending = unanswered.slice(0, 10);
    for (const r of pending) {
      await handleGenerate(r);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Respostas com SEO</h1>
              <p className="text-sm text-muted-foreground">{profile?.name} · IA gera respostas com suas palavras-chave</p>
            </div>
          </div>
          {unanswered.length > 0 && (
            <Button onClick={handleGenerateAll} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Gerar todas ({unanswered.length})
            </Button>
          )}
        </div>

        {/* Keywords input */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-0.5">🔑</div>
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1">Palavras-chave para SEO local</p>
                <p className="text-xs text-muted-foreground mb-3">A IA vai inserir essas palavras naturalmente nas respostas. Ex: advocacia trabalhista SP, dentista Vila Mariana, restaurante japonês centro</p>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="palavra-chave 1, palavra-chave 2, cidade, bairro..."
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            ["💬", "Total", (reviews || []).length],
            ["⏳", "Sem resposta", unanswered.length],
            ["✅", "Respondidos", answered.length],
          ].map(([icon, label, val]) => (
            <Card key={label as string}><CardContent className="pt-4 text-center">
              <div className="text-xl">{icon}</div>
              <div className="text-2xl font-bold mt-1">{val}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* Reviews sem resposta */}
        {unanswered.length > 0 && (
          <div>
            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
              Aguardando resposta ({unanswered.length})
            </h2>
            <div className="space-y-3">
              {unanswered.map((r: any) => (
                <Card key={r.id} className="border-orange-100">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                      <div>
                        <span className="font-semibold text-sm">{r.authorName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{new Date(r.publishedAt).toLocaleDateString("pt-BR")}</span>
                      </div>
                      <Stars v={r.rating} />
                    </div>
                    {r.comment && <p className="text-sm text-muted-foreground mb-3 italic">"{r.comment}"</p>}

                    {responses[r.id] ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold text-green-700">✨ Resposta com SEO gerada</span>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-300"
                            onClick={() => handleCopy(r.id, responses[r.id])}>
                            {copied === r.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied === r.id ? "Copiado!" : "Copiar"}
                          </Button>
                        </div>
                        <p className="text-sm text-gray-700">{responses[r.id]}</p>
                        <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs gap-1 text-muted-foreground"
                          onClick={() => handleGenerate(r)} disabled={generating === r.id}>
                          <RefreshCw className="w-3 h-3" /> Gerar outra
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" className="gap-2 mt-1" onClick={() => handleGenerate(r)} disabled={generating === r.id}>
                        {generating === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generating === r.id ? "Gerando..." : "Gerar resposta SEO"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Reviews já respondidos */}
        {answered.length > 0 && (
          <div>
            <h2 className="font-bold text-base mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              Já respondidos ({answered.length})
            </h2>
            <div className="space-y-2">
              {answered.map((r: any) => (
                <Card key={r.id} className="border-green-100 opacity-75">
                  <CardContent className="pt-3 pb-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.authorName}</span>
                        <Stars v={r.rating} />
                      </div>
                      <span className="text-xs text-green-600 font-medium">✓ Respondido</span>
                    </div>
                    {r.comment && <p className="text-xs text-muted-foreground mt-1 truncate">"{r.comment}"</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {(!reviews || reviews.length === 0) && (
          <Card><CardContent className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-muted-foreground">Nenhum review ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Sincronize o perfil para carregar as avaliações.</p>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
