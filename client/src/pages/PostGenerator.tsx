import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Sparkles, Copy, Check, RefreshCw, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

const POST_TYPES = [
  { id: "institucional", label: "Institucional", emoji: "🏢", desc: "Apresenta a empresa, valores e diferenciais" },
  { id: "servico", label: "Serviço", emoji: "⚡", desc: "Destaca um serviço específico com CTA" },
  { id: "autoridade", label: "Autoridade", emoji: "🏆", desc: "Posiciona como especialista no segmento" },
  { id: "localizacao", label: "Localização", emoji: "📍", desc: "Foca na região/cidade para SEO local" },
  { id: "oferta", label: "Oferta/Promoção", emoji: "🎯", desc: "Promoção ou condição especial" },
  { id: "depoimento", label: "Depoimento", emoji: "⭐", desc: "Baseado em avaliações positivas" },
  { id: "dica", label: "Dica Educativa", emoji: "💡", desc: "Dica útil do seu segmento" },
  { id: "evento", label: "Novidade/Evento", emoji: "🎉", desc: "Lançamento, evento ou novidade" },
];

export default function PostGenerator({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [selectedType, setSelectedType] = useState<string>("servico");
  const [keywords, setKeywords] = useState("");
  const [extraContext, setExtraContext] = useState("");
  const [generating, setGenerating] = useState(false);
  const [posts, setPosts] = useState<{ type: string; content: string; hashtags: string }[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"gerador" | "plano">("gerador");

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const generateMutation = trpc.posts.generate.useMutation();

  const handleGenerate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({
        profileId,
        type: selectedType,
        keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
        extraContext,
      });
      setPosts(prev => [{ type: selectedType, content: res.content, hashtags: res.hashtags }, ...prev]);
      toast.success("Post gerado com SEO local!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar post");
    }
    setGenerating(false);
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      for (const type of ["institucional", "servico", "autoridade", "localizacao"]) {
        const res = await generateMutation.mutateAsync({
          profileId, type,
          keywords: keywords.split(",").map(k => k.trim()).filter(Boolean),
          extraContext,
        });
        setPosts(prev => [...prev, { type, content: res.content, hashtags: res.hashtags }]);
      }
      toast.success("Plano mensal de 4 posts gerado!");
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(false);
  };


  const downloadPostImage = (post: { type: string; content: string; hashtags: string }, prof: any) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080; canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
    const colors: Record<string, [string, string]> = {
      institucional: ["#1e3a8a", "#3b82f6"],
      servico: ["#065f46", "#10b981"],
      autoridade: ["#7c2d12", "#f97316"],
      localizacao: ["#1e1b4b", "#6366f1"],
      oferta: ["#831843", "#ec4899"],
      depoimento: ["#713f12", "#eab308"],
      dica: ["#0f3460", "#0ea5e9"],
      evento: ["#4a044e", "#a855f7"],
    };
    const [c1, c2] = colors[post.type] || ["#1e3a8a", "#3b82f6"];
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Overlay pattern
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let x = 0; x < 1080; x += 60) {
      ctx.fillRect(x, 0, 1, 1080);
      ctx.fillRect(0, x, 1080, 1);
    }

    // Logo bar
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(0, 0, 1080, 80);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "bold 28px system-ui";
    ctx.fillText(prof?.name || "Seu negócio", 40, 52);
    
    // Category badge
    if (prof?.category) {
      const badgeW = ctx.measureText(prof.category).width + 24;
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      (ctx as any).roundRect?.(1080 - badgeW - 40, 20, badgeW, 40, 20) || ctx.rect(1080 - badgeW - 40, 20, badgeW, 40);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "16px system-ui";
      ctx.fillText(prof.category, 1080 - badgeW - 28, 46);
    }

    // Main text
    ctx.fillStyle = "white";
    const lines = wrapText(ctx, post.content, 1000, "28px system-ui");
    ctx.font = "28px system-ui";
    let y = 180;
    for (const line of lines.slice(0, 14)) {
      ctx.fillText(line, 40, y);
      y += 44;
    }

    // Hashtags
    if (post.hashtags) {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "22px system-ui";
      ctx.fillText(post.hashtags.substring(0, 80), 40, 980);
    }

    // Star rating
    if (prof?.avgRating) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 36px system-ui";
      ctx.fillText("★".repeat(Math.round(prof.avgRating)) + " " + prof.avgRating.toFixed(1), 40, 1040);
    }

    canvas.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `post-gbp-${Date.now()}.png`;
      a.click();
    }, "image/png");
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxW: number, font: string): string[] => {
    ctx.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxW && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const handleCopy = (i: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Post copiado! Cole direto no Google Business.");
  };

  const typeInfo = (id: string) => POST_TYPES.find(t => t.id === id);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Gerador de Posts</h1>
            <p className="text-sm text-muted-foreground">{profile?.name} · Posts otimizados para SEO local</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
          <div className="flex gap-3 items-start">
            <div className="text-2xl">📈</div>
            <div>
              <p className="font-semibold text-sm text-blue-800">Por que posts regulares sobem o ranking?</p>
              <p className="text-xs text-blue-600 mt-1">O Google favorece perfis ativos. Publicar 1 post/semana com palavras-chave relevantes sinaliza atividade e relevância, aumentando sua posição no Maps organicamente.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setActiveTab("gerador")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "gerador" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            ✍️ Gerar Post
          </button>
          <button onClick={() => setActiveTab("plano")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "plano" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            📅 Plano Mensal
          </button>
        </div>

        {activeTab === "gerador" && (
          <div className="space-y-4">
            {/* Keywords */}
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <label className="text-sm font-semibold block mb-1.5">🔑 Palavras-chave SEO local</label>
                  <input className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="dentista Moema, clínica odontológica SP, tratamento canal..."
                    value={keywords} onChange={e => setKeywords(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Separe por vírgula. Inclua cidade e bairro para SEO local.</p>
                </div>
                <div>
                  <label className="text-sm font-semibold block mb-1.5">📝 Contexto adicional (opcional)</label>
                  <input className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Ex: promoção de limpeza em fevereiro, novo serviço de clareamento..."
                    value={extraContext} onChange={e => setExtraContext(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Type selector */}
            <div>
              <p className="text-sm font-semibold mb-3">Tipo de post</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {POST_TYPES.map(t => (
                  <button key={t.id} onClick={() => setSelectedType(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${selectedType === t.id ? "border-blue-500 bg-blue-50" : "border-border hover:border-blue-300"}`}>
                    <div className="text-xl mb-1">{t.emoji}</div>
                    <div className="font-medium text-xs">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2 h-11">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? "Gerando post com SEO..." : "Gerar Post"}
            </Button>
          </div>
        )}

        {activeTab === "plano" && (
          <div className="space-y-4">
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="pt-4">
                <div className="flex gap-3 items-start">
                  <Calendar className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1">Plano Mensal Completo</p>
                    <p className="text-xs text-muted-foreground mb-3">Gera 4 posts de uma vez: Institucional + Serviço + Autoridade + Localização. Publique 1 por semana.</p>
                    <div>
                      <label className="text-sm font-semibold block mb-1.5">🔑 Palavras-chave</label>
                      <input className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                        placeholder="suas palavras-chave SEO separadas por vírgula..."
                        value={keywords} onChange={e => setKeywords(e.target.value)} />
                    </div>
                    <Button onClick={handleGeneratePlan} disabled={generating} className="mt-3 gap-2 bg-purple-600 hover:bg-purple-700">
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                      {generating ? "Gerando plano..." : "Gerar 4 Posts do Mês"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Posts gerados */}
        {posts.length > 0 && (
          <div>
            <h2 className="font-bold text-base mb-3">Posts Gerados ({posts.length})</h2>
            <div className="space-y-4">
              {posts.map((post, i) => {
                const info = typeInfo(post.type);
                return (
                  <Card key={i} className="border-green-200">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                          {info?.emoji} {info?.label}
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => { setPosts(p => p.filter((_, j) => j !== i)); }}>
                            🗑
                          </Button>
                          <Button size="sm" variant="default" className="h-7 text-xs gap-1"
                            onClick={() => handleCopy(i, post.content + "\n\n" + post.hashtags)}>
                            {copied === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied === i ? "Copiado!" : "Copiar"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => downloadPostImage(post, profile)}>
                            🖼 Imagem
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">{post.content}</p>
                      {post.hashtags && (
                        <p className="text-xs text-blue-500 mt-3 font-medium">{post.hashtags}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
