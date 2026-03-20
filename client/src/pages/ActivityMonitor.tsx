import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Copy, Check, Loader2, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

export default function ActivityMonitor({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: reviews } = trpc.reviews.getRecent.useQuery({ profileId, limit: 100 } as any);
  const { data: score } = trpc.scores.getByProfile.useQuery({ profileId });
  const syncMutation = trpc.sync.syncProfile.useMutation();
  const utils = trpc.useUtils();

  // Análise de velocidade de reviews
  const reviewList = reviews || [];
  const now = new Date();

  const last30 = reviewList.filter((r: any) => {
    const d = new Date(r.publishedAt);
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 30;
  }).length;

  const last90 = reviewList.filter((r: any) => {
    const d = new Date(r.publishedAt);
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 90;
  }).length;

  const lastReview = reviewList.length > 0
    ? reviewList.sort((a: any, b: any) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0]
    : null;

  const daysSinceLastReview = lastReview
    ? Math.floor((now.getTime() - new Date(lastReview.publishedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const unansweredCount = reviewList.filter((r: any) => !r.reply).length;
  const avgRating = profile?.avgRating || 0;
  const totalReviews = profile?.totalReviews || 0;

  // Review link
  const reviewLink = profile?.googleLocationId
    ? `https://search.google.com/local/writereview?placeid=${profile.googleLocationId.split("/").pop()}`
    : "";

  const handleCopyLink = () => {
    if (!reviewLink) { toast.error("Link não disponível — sincronize o perfil"); return; }
    navigator.clipboard.writeText(reviewLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Link copiado! Compartilhe com seus clientes.");
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncMutation.mutateAsync({ profileId });
      utils.reviews.getRecent.invalidate({ profileId });
      utils.profiles.getById.invalidate({ id: profileId });
      toast.success("Dados atualizados!");
    } catch (e: any) { toast.error(e.message); }
    setSyncing(false);
  };

  // Alertas
  const alerts: { type: "danger" | "warn" | "ok"; text: string }[] = [];
  if (daysSinceLastReview > 30) alerts.push({ type: "danger", text: `⚠️ ${daysSinceLastReview} dias sem novo review — o Google penaliza perfis sem atividade recente` });
  if (unansweredCount > 3) alerts.push({ type: "warn", text: `💬 ${unansweredCount} reviews sem resposta — responder aumenta o ranking` });
  if (avgRating < 4.0 && totalReviews > 5) alerts.push({ type: "danger", text: `⭐ Nota ${avgRating.toFixed(1)} abaixo do ideal — trabalhe para chegar em 4.5+` });
  if (last30 === 0) alerts.push({ type: "warn", text: "📉 Nenhum review nos últimos 30 dias — compartilhe o link com clientes" });
  if ((profile?.photoCount || 0) < 10) alerts.push({ type: "warn", text: `📸 Apenas ${profile?.photoCount || 0} fotos — o ideal é ter 20+ para ranquear melhor` });
  if ((profile?.postCount || 0) < 4) alerts.push({ type: "warn", text: `📝 Poucos posts — publique ao menos 1x por semana para manter o perfil ativo` });
  if (alerts.length === 0) alerts.push({ type: "ok", text: "✅ Perfil com atividade saudável! Continue mantendo o ritmo." });

  // Semanas de atividade simuladas
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (11 - i) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = reviewList.filter((r: any) => {
      const d = new Date(r.publishedAt);
      return d >= weekStart && d < weekEnd;
    }).length;
    return { label: weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), count };
  });

  const maxWeek = Math.max(...weeks.map(w => w.count), 1);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Monitor de Atividade</h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSync} disabled={syncing} className="gap-2">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>

        {/* Alertas */}
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
              a.type === "danger" ? "bg-red-50 text-red-700 border border-red-200" :
              a.type === "warn" ? "bg-yellow-50 text-yellow-700 border border-yellow-200" :
              "bg-green-50 text-green-700 border border-green-200"
            }`}>
              {a.text}
            </div>
          ))}
        </div>

        {/* Métricas de velocidade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["📅", "Último 30 dias", last30, last30 >= 3 ? "green" : last30 >= 1 ? "yellow" : "red"],
            ["📆", "Últimos 90 dias", last90, last90 >= 8 ? "green" : last90 >= 3 ? "yellow" : "red"],
            ["⏰", "Dias s/ review", daysSinceLastReview === 999 ? "—" : daysSinceLastReview, daysSinceLastReview <= 15 ? "green" : daysSinceLastReview <= 30 ? "yellow" : "red"],
            ["💬", "Sem resposta", unansweredCount, unansweredCount === 0 ? "green" : unansweredCount <= 3 ? "yellow" : "red"],
          ].map(([icon, label, val, color]) => (
            <Card key={label as string}><CardContent className="pt-4 text-center">
              <div className="text-xl">{icon}</div>
              <div className={`text-2xl font-bold mt-1 ${color === "green" ? "text-green-600" : color === "yellow" ? "text-yellow-600" : "text-red-500"}`}>{val}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* Heatmap de reviews */}
        <Card>
          <CardHeader><CardTitle className="text-base">Volume de Reviews — Últimas 12 semanas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-24">
              {weeks.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max((w.count / maxWeek) * 72, w.count > 0 ? 8 : 2)}px`,
                      background: w.count === 0 ? "#f1f5f9" : w.count >= 3 ? "#16a34a" : w.count >= 1 ? "#3b82f6" : "#e2e8f0",
                    }} />
                  <span className="text-[9px] text-muted-foreground hidden md:block">{w.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block"></span> 0 reviews</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block"></span> 1-2 reviews</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 inline-block"></span> 3+ reviews</span>
            </div>
          </CardContent>
        </Card>

        {/* Link de avaliação */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">⭐</div>
              <div className="flex-1">
                <p className="font-bold text-base mb-1">Link direto de avaliação</p>
                <p className="text-sm text-muted-foreground mb-3">Compartilhe com clientes via WhatsApp, e-mail ou SMS. Quanto mais reviews recentes, maior o ranking.</p>
                {reviewLink ? (
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 bg-white border rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                      {reviewLink}
                    </div>
                    <Button onClick={handleCopyLink} className="gap-2 shrink-0">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copiado!" : "Copiar link"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sincronize o perfil para gerar o link.</p>
                )}

                {/* Mensagem pronta para WhatsApp */}
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-800 mb-2">📱 Mensagem pronta para WhatsApp:</p>
                  <p className="text-xs text-green-700 italic leading-relaxed">
                    "Olá! Fico muito feliz que tenha gostado do atendimento 😊 Poderia nos deixar uma avaliação no Google? Leva menos de 1 minuto e ajuda muito nossa empresa: {reviewLink || "[link]"}"
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-green-300 text-green-700"
                    onClick={() => {
                      const msg = `Olá! Fico muito feliz que tenha gostado do atendimento 😊 Poderia nos deixar uma avaliação no Google? Leva menos de 1 minuto e ajuda muito nossa empresa: ${reviewLink}`;
                      navigator.clipboard.writeText(msg);
                      toast.success("Mensagem copiada!");
                    }}>
                    <Copy className="w-3 h-3 mr-1" /> Copiar mensagem
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NAP Check */}
        <Card>
          <CardHeader><CardTitle className="text-base">✅ Consistência NAP</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Nome, Endereço e Telefone devem estar idênticos em todos os lugares. Inconsistência derruba o ranking.</p>
            <div className="space-y-2">
              {[
                ["Nome", profile?.name],
                ["Endereço", profile?.address],
                ["Telefone", profile?.phone || "Não cadastrado ⚠️"],
                ["Website", profile?.website || "Não cadastrado ⚠️"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-start justify-between py-2 border-b last:border-0 gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-20 shrink-0">{k}</span>
                  <span className={`text-sm flex-1 ${(!v || v === "Não cadastrado ⚠️") ? "text-orange-500" : "text-foreground"}`}>{v || "—"}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">💡 Copie exatamente esses dados ao cadastrar em outros diretórios (Yelp, Apple Maps, Facebook, etc.)</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
