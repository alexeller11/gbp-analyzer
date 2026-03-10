import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Sparkles, Copy, Check, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

function Stars({ v, size = 14 }: { v: number; size?: number }) {
  return <span>{[1,2,3,4,5].map(i => <span key={i} style={{ color: i <= v ? "#f59e0b" : "#d1d5db", fontSize: size }}>★</span>)}</span>;
}

const STAR_FILTERS = [
  { label: "Todos", value: 0 },
  { label: "5★", value: 5 },
  { label: "4★", value: 4 },
  { label: "3★", value: 3 },
  { label: "2★", value: 2 },
  { label: "1★", value: 1 },
];

const STATUS_FILTERS = [
  { label: "Todos", value: "all" },
  { label: "Sem resposta", value: "unanswered" },
  { label: "Respondidos", value: "answered" },
];

export default function ReviewResponder({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [generating, setGenerating] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [keywords, setKeywords] = useState("");
  const [starFilter, setStarFilter] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId, limit: 100 } as any);
  const generateMutation = trpc.reviewAI.generateResponse.useMutation();

  // Filtragem
  const filtered = (reviews || []).filter((r: any) => {
    if (starFilter > 0 && r.rating !== starFilter) return false;
    if (statusFilter === "unanswered" && (r.reply || responses[r.id])) return false;
    if (statusFilter === "answered" && !r.reply && !responses[r.id]) return false;
    return true;
  });

  const unansweredCount = (reviews || []).filter((r: any) => !r.reply && !responses[r.id]).length;
  const answeredCount = (reviews || []).filter((r: any) => r.reply || responses[r.id]).length;

  const handleGenerate = async (review: any) => {
    setGenerating(review.id);
    try {
      const res = await generateMutation.mutateAsync({
        profileId, reviewId: review.id,
        authorName: review.authorName,
        rating: review.rating,
        comment: review.comment || "",
        keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
      setResponses(prev => ({ ...prev, [review.id]: res.response }));
      toast.success("Resposta gerada!");
    } catch (e: any) { toast.error(e.message || "Erro ao gerar"); }
    setGenerating(null);
  };

  const handleCopy = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
    toast.success("Copiado! Cole no Google Business.");
  };

  const toggleExpand = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Avaliações</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          {unansweredCount > 0 && (
            <Button onClick={async () => {
              const pending = filtered.filter((r: any) => !r.reply && !responses[r.id]).slice(0, 5);
              for (const r of pending) await handleGenerate(r);
            }} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Gerar respostas ({Math.min(unansweredCount, 5)})
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            ["💬", "Total", (reviews || []).length],
            ["⏳", "Sem resposta", unansweredCount],
            ["✅", "Respondidos", answeredCount],
          ].map(([icon, label, val]) => (
            <Card key={label as string}><CardContent className="pt-4 text-center">
              <div className="text-xl">{icon}</div>
              <div className="text-2xl font-bold mt-1">{val}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* Keywords */}
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4">
            <p className="text-xs font-semibold text-blue-800 mb-1">🔑 Keywords SEO para respostas (opcional)</p>
            <input
              className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="materiais de construção, loja Linhares, acabamento ES..."
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {STAR_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => setStarFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${starFilter === f.value ? "bg-yellow-100 text-yellow-800 border border-yellow-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-2">
            {STATUS_FILTERS.map(f => (
              <button key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === f.value ? "bg-blue-100 text-blue-800 border border-blue-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} avaliações</span>
        </div>

        {/* Reviews */}
        {filtered.length === 0 ? (
          <Card><CardContent className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-muted-foreground">Nenhuma avaliação encontrada.</p>
            <p className="text-xs text-muted-foreground mt-1">Sincronize o perfil para carregar as avaliações.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r: any) => {
              const hasReply = r.reply || responses[r.id];
              const isExpanded = expanded[r.id];
              const generatedReply = responses[r.id];

              return (
                <Card key={r.id} className={`transition ${hasReply ? "border-green-100" : "border-orange-100"}`}>
                  <CardContent className="pt-4">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <span className="font-semibold text-sm">{r.authorName}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(r.publishedAt).toLocaleDateString("pt-BR")}
                        </span>
                        {hasReply && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">✓ Respondido</span>}
                      </div>
                      <Stars v={r.rating} />
                    </div>

                    {/* Comentário do cliente */}
                    {r.comment ? (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-xs text-gray-400 mb-1 font-medium">AVALIAÇÃO DO CLIENTE</p>
                        <p className="text-sm text-gray-700 italic">"{r.comment}"</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic mb-3">(sem comentário escrito)</p>
                    )}

                    {/* Resposta existente (do banco) */}
                    {r.reply && !generatedReply && (
                      <div className="bg-blue-50 rounded-lg p-3 mb-3 border border-blue-100">
                        <p className="text-xs text-blue-500 mb-1 font-medium">RESPOSTA DO ESTABELECIMENTO</p>
                        <p className="text-sm text-blue-900">{r.reply}</p>
                      </div>
                    )}

                    {/* Resposta gerada pela IA */}
                    {generatedReply && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-green-700">✨ Resposta gerada com SEO</span>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                              onClick={() => handleGenerate(r)} disabled={generating === r.id}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Nova
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-300"
                              onClick={() => handleCopy(r.id, generatedReply)}>
                              {copied === r.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied === r.id ? "Copiado!" : "Copiar"}
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-700">{generatedReply}</p>
                      </div>
                    )}

                    {/* Botão gerar (quando não há resposta nenhuma) */}
                    {!hasReply && !generatedReply && (
                      <Button size="sm" className="gap-2" onClick={() => handleGenerate(r)} disabled={generating === r.id}>
                        {generating === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generating === r.id ? "Gerando..." : "Gerar resposta SEO"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
