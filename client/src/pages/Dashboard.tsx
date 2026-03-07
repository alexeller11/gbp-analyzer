import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ImportProfileDialog } from "@/components/ImportProfileDialog";
import { trpc } from "@/lib/trpc";
import { Search, Loader2, Star, MessageSquare, Camera, FileText, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

function scoreColor(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444" }

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

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");

  const { data: profiles, isLoading, refetch } = trpc.profiles.list.useQuery();
  const { data: scoresList } = trpc.scores.getByProfile as any;

  // Auto-abrir importação se voltou do OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("import") === "true") {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const filtered = (profiles || []).filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const avgScore = profiles?.length
    ? Math.round(profiles.reduce((acc, p) => {
        const s = calcScore(p); return acc + s;
      }, 0) / profiles.length)
    : 0;

  function calcScore(p: any) {
    const completeness = Math.min(100, (p.name?15:0)+(p.address?15:0)+(p.phone?15:0)+(p.website?15:0)+(p.description?20:0)+(p.category?10:0)+(p.isVerified?10:0));
    const reviewScore = Math.min(100, (Math.min(p.totalReviews||0,200)*0.3)+((p.avgRating||0)*14));
    const engagement = Math.min(100, ((p.avgRating||0)*14)+(Math.min(p.totalReviews||0,100)*0.3)+(Math.min(p.postCount||0,30)*1.2));
    const consistency = Math.min(100, ((p.avgRating||0)*12)+(p.isVerified?20:0)+(p.phone?12:0)+(p.website?12:0)+(p.description?8:0));
    const mediaScore = Math.min(100, (Math.min(p.photoCount||0,60)*1.1)+(Math.min(p.postCount||0,30)*1.5));
    return Math.round(completeness*0.2+reviewScore*0.25+engagement*0.2+consistency*0.2+mediaScore*0.15);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Meus Perfis</h1>
            <p className="text-muted-foreground mt-1">Gerencie seus perfis do Google Business</p>
          </div>
          <ImportProfileDialog onSuccess={refetch} />
        </div>

        {/* Métricas globais */}
        {profiles && profiles.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{profiles.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Perfis</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold" style={{ color: scoreColor(avgScore) }}>{avgScore}</div>
              <div className="text-xs text-muted-foreground mt-1">Score Médio</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">
                {profiles.length > 0 ? (profiles.reduce((a, p) => a + (p.avgRating || 0), 0) / profiles.length).toFixed(1) : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Nota Média</div>
            </CardContent></Card>
          </div>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, endereço ou categoria..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {/* Lista de perfis */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-5xl">🏢</div>
            <p className="text-muted-foreground font-medium">{profiles?.length === 0 ? "Nenhum perfil ainda" : "Nenhum perfil encontrado"}</p>
            <p className="text-sm text-muted-foreground">{profiles?.length === 0 ? "Clique em \"Importar do Google\" para sincronizar seus perfis" : "Tente outro termo de busca"}</p>
            {profiles?.length === 0 && <ImportProfileDialog onSuccess={refetch} />}
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(profile => {
              const score = calcScore(profile);
              return (
                <Card key={profile.id} className="cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all group"
                  onClick={() => setLocation(`/profile/${profile.id}`)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <CardTitle className="text-base leading-tight truncate group-hover:text-blue-600 transition-colors">{profile.name}</CardTitle>
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
                    {/* Score bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor(score) }} />
                    </div>
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
