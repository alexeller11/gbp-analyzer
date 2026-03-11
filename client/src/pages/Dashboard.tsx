import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImportProfileDialog } from "@/components/ImportProfileDialog";
import { trpc } from "@/lib/trpc";
import { Search, Loader2, Camera, FileText, RefreshCw, Zap, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function scoreColor(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444"; }

function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  const c = scoreColor(value);
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, dash = (value / 100) * circ;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: c }}>
        {value}
      </div>
    </div>
  );
}

function calcScore(p: any) {
  const completeness = Math.min(100, (p.name?15:0)+(p.address?15:0)+(p.phone?15:0)+(p.website?15:0)+(p.description?20:0)+(p.category?10:0)+(p.isVerified?10:0));
  const reviewScore = Math.min(100, (Math.min(p.totalReviews||0,200)*0.3)+((p.avgRating||0)*14));
  const engagement = Math.min(100, ((p.avgRating||0)*14)+(Math.min(p.totalReviews||0,100)*0.3)+(Math.min(p.postCount||0,30)*1.2));
  const consistency = Math.min(100, ((p.avgRating||0)*12)+(p.isVerified?20:0)+(p.phone?12:0)+(p.website?12:0)+(p.description?8:0));
  const mediaScore = Math.min(100, (Math.min(p.photoCount||0,60)*1.1)+(Math.min(p.postCount||0,30)*1.5));
  return Math.round(completeness*0.2+reviewScore*0.25+engagement*0.2+consistency*0.2+mediaScore*0.15);
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState("");
  const [syncDone, setSyncDone] = useState<any>(null);
  const [syncError, setSyncError] = useState("");
  const autoImportFired = useRef(false);

  const { data: profiles, isLoading, refetch } = trpc.profiles.list.useQuery();
  const autoImportMutation = trpc.googleBusiness.autoImport.useMutation();

  const handleAutoImport = async (silent = false) => {
    setSyncing(true);
    setSyncStep("Conectando à conta Google Business...");
    setSyncDone(null);
    setSyncError("");
    try {
      setSyncStep("Buscando perfis e avaliações...");
      const result = await autoImportMutation.mutateAsync();
      await refetch();
      setSyncDone(result);
      const msg = (result as any).fallback
        ? `Sincronizado · ${result.reviewsSynced} avaliações atualizadas`
        : `✅ ${result.imported} importados · ${result.skipped} atualizados · ${result.reviewsSynced} avaliações`;
      toast.success(msg);
    } catch (e: any) {
      const msg = e.message || "Erro na sincronização";
      setSyncError(msg);
      toast.error(silent ? "Não foi possível sincronizar automaticamente" : msg);
    }
    setSyncing(false);
    setSyncStep("");
  };

  // Tenta auto-importar apenas na primeira carga sem perfis
  useEffect(() => {
    if (!isLoading && profiles !== undefined && profiles.length === 0 && !autoImportFired.current) {
      autoImportFired.current = true;
      handleAutoImport(true);
    }
  }, [isLoading, profiles]);

  const filtered = (profiles || []).filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const avgScore = profiles?.length ? Math.round(profiles.reduce((a, p) => a + calcScore(p), 0) / profiles.length) : 0;
  const totalReviews = profiles?.reduce((a, p) => a + (p.totalReviews || 0), 0) || 0;
  const avgRating = profiles?.length ? (profiles.reduce((a, p) => a + (p.avgRating || 0), 0) / profiles.length).toFixed(1) : "—";

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Meus Perfis</h1>
            <p className="text-muted-foreground mt-1">Google Business Profile</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => handleAutoImport(false)} disabled={syncing} variant="outline" className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {syncing ? "Sincronizando..." : "Sincronizar GBP"}
            </Button>
            <ImportProfileDialog onSuccess={refetch} />
          </div>
        </div>

        {/* Banner erro APIs */}
        {syncError && !syncing && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-orange-800 text-sm">APIs Google Business não ativadas</p>
                <p className="text-orange-600 text-xs mt-1 mb-2">Para sincronizar automaticamente, ative no Google Cloud Console:</p>
                <ol className="text-orange-700 text-xs space-y-1 list-decimal list-inside">
                  <li>Acesse <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noreferrer" className="underline font-medium">console.cloud.google.com/apis/library</a></li>
                  <li>Ative: <strong>My Business Account Management API</strong></li>
                  <li>Ative: <strong>My Business Business Information API</strong></li>
                  <li>Volte e clique em "Sincronizar GBP"</li>
                </ol>
                <p className="text-orange-600 text-xs mt-2">Enquanto isso, use <strong>"Adicionar Perfil"</strong> para importar manualmente pelo link do Google Maps.</p>
              </div>
              <button className="text-orange-400 hover:text-orange-600" onClick={() => setSyncError("")}>✕</button>
            </div>
          </div>
        )}

        {/* Banner sync em progresso */}
        {syncing && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-blue-800 text-sm">Sincronizando com Google Business...</p>
              <p className="text-blue-600 text-xs mt-0.5">{syncStep}</p>
            </div>
          </div>
        )}

        {/* Banner sync concluído */}
        {syncDone && !syncing && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-green-800 text-sm font-medium">
                {(syncDone as any).fallback
                  ? `Sincronizado · ${syncDone.reviewsSynced} avaliações`
                  : `${syncDone.imported} novos · ${syncDone.skipped} atualizados · ${syncDone.reviewsSynced} avaliações`}
              </p>
            </div>
            <button className="text-green-400 text-xs" onClick={() => setSyncDone(null)}>✕</button>
          </div>
        )}

        {/* Métricas */}
        {profiles && profiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Perfis", value: profiles.length, color: "text-blue-600" },
              { label: "Score Médio", value: avgScore, color: `text-[${scoreColor(avgScore)}]` },
              { label: "Nota Média", value: avgRating, color: "text-yellow-600" },
              { label: "Avaliações", value: totalReviews, color: "text-purple-600" },
            ].map(m => (
              <Card key={m.label}><CardContent className="pt-4">
                <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
              </CardContent></Card>
            ))}
          </div>
        )}

        {/* Busca */}
        {profiles && profiles.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, endereço ou categoria..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        )}

        {/* Lista */}
        {(isLoading || (syncing && !profiles?.length)) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin" />
            <p className="font-medium">Buscando seus perfis...</p>
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="text-5xl">🏢</div>
            <div className="text-center">
              <p className="font-semibold text-lg">Nenhum perfil ainda</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sincronize pelo botão acima ou adicione manualmente
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="outline" onClick={() => handleAutoImport(false)} disabled={syncing}>
                <Zap className="w-4 h-4 mr-2" /> Sincronizar GBP
              </Button>
              <ImportProfileDialog onSuccess={refetch} />
            </div>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(profile => {
              const score = calcScore(profile);
              return (
                <Card key={profile.id}
                  className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
                  onClick={() => setLocation(`/profile/${profile.id}`)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <CardTitle className="text-base leading-tight truncate group-hover:text-blue-600 transition-colors">
                          {profile.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">{profile.category}</CardDescription>
                      </div>
                      <ScoreRing value={score} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    <p className="text-xs text-muted-foreground truncate">{profile.address}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium">{(profile.avgRating || 0).toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{profile.totalReviews || 0} avaliações</span>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Camera className="w-3 h-3" />{profile.photoCount || 0}</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{profile.postCount || 0} posts</span>
                      {profile.isVerified && <span className="text-green-600 font-medium">✓ Verificado</span>}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${score}%`, background: scoreColor(score) }} />
                    </div>
                    {profile.lastSyncAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Sync: {new Date(profile.lastSyncAt).toLocaleDateString("pt-BR")}
                      </p>
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
