import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Circle, RefreshCw, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

interface Props { params: { profileId: string } }

const GROUP_ICONS: Record<string, string> = {
  "Perfil": "🏢",
  "Conteúdo": "📸",
  "Avaliações": "⭐",
  "Análise": "📊",
};

const GROUP_TIPS: Record<string, string> = {
  "Perfil": "Informações completas aumentam sua visibilidade no Google Maps em até 70%",
  "Conteúdo": "Perfis com fotos recebem 42% mais cliques que perfis sem fotos",
  "Avaliações": "Responder avaliações mostra ao Google que o negócio está ativo",
  "Análise": "Monitorar concorrentes ajuda a identificar oportunidades de crescimento",
};

export default function ProfileChecklist({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const { data, isLoading, refetch, isFetching } = trpc.profileChecklist.getStatus.useQuery({ profileId });

  const items = data?.items || [];
  const groups = [...new Set(items.map(i => i.group))];
  const totalDone = items.filter(i => i.done).length;
  const percent = items.length ? Math.round((totalDone / items.length) * 100) : 0;

  const progressColor = percent >= 75 ? "#16a34a" : percent >= 50 ? "#d97706" : "#ef4444";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Checklist do Perfil</h1>
              <p className="text-sm text-muted-foreground">{data?.profile?.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Score geral */}
            <Card className="overflow-hidden">
              <div className="h-2 w-full bg-gray-100">
                <div className="h-2 transition-all duration-700 rounded-r-full"
                  style={{ width: `${percent}%`, background: progressColor }} />
              </div>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: progressColor }}>{percent}%</p>
                    <p className="text-sm text-muted-foreground">{totalDone} de {items.length} itens concluídos</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground space-y-1">
                    {data?.profile && (
                      <>
                        <p>⭐ {data.profile.avgRating?.toFixed(1)} · {data.profile.totalReviews} avaliações</p>
                        <p>📊 Score GBP: <strong>{Math.round(data.profile.score)}</strong>/100</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Grupos */}
            <div className="space-y-4">
              {groups.map(group => {
                const groupItems = items.filter(i => i.group === group);
                const groupDone = groupItems.filter(i => i.done).length;
                const allDone = groupDone === groupItems.length;

                return (
                  <Card key={group} className={allDone ? "border-green-200 bg-green-50/30" : ""}>
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <span>{GROUP_ICONS[group] || "📌"}</span>
                          {group}
                          {allDone && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Completo ✓</span>}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">{groupDone}/{groupItems.length}</span>
                      </div>
                      {!allDone && GROUP_TIPS[group] && (
                        <p className="text-xs text-muted-foreground mt-1">{GROUP_TIPS[group]}</p>
                      )}
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="space-y-0">
                        {groupItems.map(item => (
                          <div key={item.id}
                            className={`flex items-center gap-3 py-2.5 border-b last:border-0 ${item.done ? "opacity-60" : ""}`}>
                            {item.done
                              ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                              : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                            <span className={`text-sm ${item.done ? "line-through text-muted-foreground" : "text-gray-800"}`}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Próximos passos */}
            {percent < 100 && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="pt-4">
                  <p className="font-semibold text-sm text-blue-800 mb-2">🎯 Próximos passos</p>
                  <div className="space-y-1.5">
                    {items.filter(i => !i.done).slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-center gap-2 text-sm text-blue-700">
                        <span className="text-blue-400">→</span> {item.label}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {percent === 100 && (
              <Card className="border-green-300 bg-green-50">
                <CardContent className="py-6 text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <p className="font-bold text-green-800">Parabéns! Perfil 100% otimizado</p>
                  <p className="text-sm text-green-600 mt-1">Seu perfil está completamente otimizado para o Google Maps.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
