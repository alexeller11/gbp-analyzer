import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Loader2, MapPin, Info, RefreshCw,
  TrendingUp, TrendingDown, History,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }
interface GridPoint { lat: number; lng: number; rank: number | null }

function rankColor(r: number | null) {
  if (r === null) return { bg: "#6b7280", text: "#fff", border: "#4b5563" };
  if (r === 1)    return { bg: "#15803d", text: "#fff", border: "#166534" };
  if (r <= 3)     return { bg: "#22c55e", text: "#fff", border: "#16a34a" };
  if (r <= 7)     return { bg: "#eab308", text: "#fff", border: "#ca8a04" };
  if (r <= 10)    return { bg: "#f97316", text: "#fff", border: "#ea580c" };
  return { bg: "#ef4444", text: "#fff", border: "#dc2626" };
}

function RankGrid({ points }: { points: GridPoint[] }) {
  const rows = 5, cols = 5;
  const centerIdx = Math.floor(points.length / 2); // índice 12 na grade 5x5

  return (
    <div className="w-full">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 6,
          padding: 6,
          background: "linear-gradient(135deg, #e0f2fe 0%, #dbeafe 50%, #ede9fe 100%)",
          borderRadius: 16,
        }}
      >
        {points.map((pt, i) => {
          const isCenter = i === centerIdx;
          const { bg, text, border } = rankColor(pt.rank);
          const label = pt.rank === null ? "20+" : pt.rank === 1 ? "🥇" : `#${pt.rank}`;

          return (
            <div
              key={i}
              title={`Lat ${pt.lat.toFixed(4)}, Lng ${pt.lng.toFixed(4)} → posição ${pt.rank ?? ">20"}`}
              style={{
                aspectRatio: "1/1",
                background: bg,
                border: `3px solid ${isCenter ? "#1d4ed8" : border}`,
                borderRadius: isCenter ? 12 : 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                boxShadow: isCenter
                  ? "0 0 0 3px rgba(29,78,216,0.35), 0 4px 12px rgba(0,0,0,0.2)"
                  : "0 2px 6px rgba(0,0,0,0.15)",
                transform: isCenter ? "scale(1.08)" : "scale(1)",
                zIndex: isCenter ? 2 : 1,
                position: "relative",
                transition: "transform 0.15s",
                cursor: "default",
              }}
            >
              <span style={{
                color: text,
                fontWeight: 900,
                fontSize: label.length > 3 ? "clamp(11px, 2.5vw, 15px)" : "clamp(13px, 3vw, 20px)",
                lineHeight: 1,
                textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                userSelect: "none",
              }}>
                {isCenter ? "📍" : label}
              </span>
              {isCenter && (
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.9)", marginTop: 2, fontWeight: 700 }}>
                  VOCÊ
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const LEGEND = [
  { color: "#15803d", label: "#1" },
  { color: "#22c55e", label: "#2–3" },
  { color: "#eab308", label: "#4–7" },
  { color: "#f97316", label: "#8–10" },
  { color: "#ef4444", label: "#11–20" },
  { color: "#6b7280", label: ">20" },
];

export default function GeoGrid({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<GridPoint[]>([]);
  const [lastKeyword, setLastKeyword] = useState("");
  const [avgRank, setAvgRank] = useState<number | null>(null);
  const [top3Pct, setTop3Pct] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: history, refetch: refetchHistory } = trpc.geoGridHistory.getByProfile.useQuery({ profileId });
  const scanMutation = trpc.geoGrid.scan.useMutation();

  const handleScan = async () => {
    if (!keyword.trim()) { toast.error("Digite uma palavra-chave"); return; }
    setLoading(true);
    try {
      const res = await scanMutation.mutateAsync({ profileId, keyword: keyword.trim() });
      setPoints(res.points);
      setLastKeyword(keyword.trim());
      setAvgRank(typeof res.avgRank === "number" ? res.avgRank : null);
      setTop3Pct(typeof res.top3Pct === "number" ? res.top3Pct : null);
      refetchHistory();
      toast.success(`Escaneado! Posição média: #${res.avgRank ? Math.round(res.avgRank) : "20+"}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao escanear");
    }
    setLoading(false);
  };

  const loadHistoric = (h: any) => {
    setPoints(h.points);
    setLastKeyword(h.keyword);
    setAvgRank(h.avgRank);
    setTop3Pct(h.top3Pct);
    setShowHistory(false);
  };

  const avgColor = rankColor(avgRank !== null ? Math.round(avgRank) : null).bg;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="w-6 h-6 text-blue-600" /> Geo-Grid de Ranking
              </h1>
              <p className="text-sm text-muted-foreground">{profile?.name}</p>
            </div>
          </div>
          {(history?.length ?? 0) > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => setShowHistory(v => !v)}>
              <History className="w-3.5 h-3.5" /> Histórico ({history?.length})
            </Button>
          )}
        </div>

        {/* Info */}
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-3 pb-3">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Mostra sua posição no Google Maps em <strong>25 pontos geográficos</strong> ao redor
                do seu negócio. Verde = topo, vermelho = longe do topo.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Histórico */}
        {showHistory && (history?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm">Scans Anteriores</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {history?.map((h: any, idx: number) => {
                const prev = history[idx + 1];
                const diff = prev?.avgRank && h.avgRank ? prev.avgRank - h.avgRank : null;
                return (
                  <button key={h.id} onClick={() => loadHistoric(h)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50 text-left">
                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">"{h.keyword}"</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.scannedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm"
                        style={{ color: rankColor(h.avgRank ? Math.round(h.avgRank) : null).bg }}>
                        #{h.avgRank ? Math.round(h.avgRank) : "20+"}
                      </p>
                      {diff !== null && (
                        <p className={`text-xs flex items-center gap-0.5 justify-end ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Campo de busca */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Ex: "${profile?.category?.toLowerCase() || "clínica odontológica"}"`}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleScan()}
              />
              <Button onClick={handleScan} disabled={loading || !keyword.trim()} className="gap-2 flex-shrink-0">
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <MapPin className="w-4 h-4" />}
                {loading ? "Escaneando..." : "Escanear"}
              </Button>
            </div>
            {profile?.category && !keyword && (
              <button className="mt-2 text-xs text-blue-600 hover:underline"
                onClick={() => setKeyword(profile.category)}>
                Usar "{profile.category}"
              </button>
            )}
          </CardContent>
        </Card>

        {/* KPIs */}
        {avgRank !== null && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black" style={{ color: avgColor }}>
                #{Math.round(avgRank)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Posição média</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className={`text-3xl font-black ${(top3Pct ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>
                {top3Pct ?? 0}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Pontos no Top 3</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black text-blue-600">25</div>
              <div className="text-xs text-muted-foreground mt-1">Pontos escaneados</div>
            </CardContent></Card>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <Card><CardContent className="py-14 text-center">
            <MapPin className="w-10 h-10 text-blue-500 mx-auto mb-3 animate-bounce" />
            <p className="font-semibold">Escaneando 25 pontos no mapa...</p>
            <p className="text-sm text-muted-foreground mt-1">Consultando Google Maps em cada ponto (~30s)</p>
            <div className="max-w-xs mx-auto mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </CardContent></Card>
        )}

        {/* Grade de ranking */}
        {points.length > 0 && !loading && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">"{lastKeyword}"</CardTitle>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7"
                  onClick={() => { setPoints([]); setAvgRank(null); setTop3Pct(null); }}>
                  <RefreshCw className="w-3 h-3" /> Novo scan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <RankGrid points={points} />

              {/* Legenda */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4">
                {LEGEND.map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-4 h-4 rounded-md shadow-sm flex-shrink-0"
                      style={{ background: l.color }} />
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-muted-foreground">
                📍 = sua localização · Cada número = posição no Google Maps naquele ponto
                {avgRank !== null && (
                  avgRank <= 3 ? " · 🟢 Excelente visibilidade!" :
                  avgRank <= 7 ? " · 🟡 Visibilidade moderada" :
                  " · 🔴 Baixa visibilidade — otimize seu perfil"
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado inicial */}
        {points.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#dbeafe,#ede9fe)" }}>
              <MapPin className="w-8 h-8 text-blue-500" />
            </div>
            <p className="font-semibold">Digite uma palavra-chave para escanear</p>
            <p className="text-sm text-muted-foreground mt-1">
              A grade mostrará sua posição em 25 pontos ao redor do negócio
            </p>
          </CardContent></Card>
        )}

      </div>
    </DashboardLayout>
  );
}
