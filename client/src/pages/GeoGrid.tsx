import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, MapPin, RefreshCw, Info } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }

interface GridPoint {
  lat: number; lng: number;
  rank: number | null; // null = não encontrado no top 20
  label?: string;
}

const GRID_SIZE = 5; // 5x5 = 25 pontos
const SPACING_KM = 0.8; // 800m entre pontos

function rankColor(r: number | null) {
  if (r === null) return { bg: "#6b7280", text: "#fff" };
  if (r === 1) return { bg: "#16a34a", text: "#fff" };
  if (r <= 3) return { bg: "#22c55e", text: "#fff" };
  if (r <= 7) return { bg: "#f59e0b", text: "#fff" };
  if (r <= 10) return { bg: "#f97316", text: "#fff" };
  return { bg: "#ef4444", text: "#fff" };
}

function rankLabel(r: number | null) {
  if (r === null) return "20+";
  return String(r);
}

// Converte km em graus lat/lng aproximados
function kmToLat(km: number) { return km / 111; }
function kmToLng(km: number, lat: number) { return km / (111 * Math.cos((lat * Math.PI) / 180)); }

export default function GeoGrid({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [gridData, setGridData] = useState<GridPoint[][]>([]);
  const [lastKeyword, setLastKeyword] = useState("");
  const [avgRank, setAvgRank] = useState<number | null>(null);
  const [top3Pct, setTop3Pct] = useState<number | null>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const geoGridMutation = trpc.geoGrid.scan.useMutation();

  const handleScan = async () => {
    if (!keyword.trim()) { toast.error("Digite uma palavra-chave"); return; }
    if (!profile?.latitude || !profile?.longitude) {
      toast.error("Perfil sem coordenadas. Clique em 🗺️ Sync Places primeiro.");
      return;
    }
    setLoading(true);
    try {
      const res = await geoGridMutation.mutateAsync({ profileId, keyword: keyword.trim() });
      // Monta grid 5x5
      const grid: GridPoint[][] = [];
      let idx = 0;
      for (let row = 0; row < GRID_SIZE; row++) {
        const rowArr: GridPoint[] = [];
        for (let col = 0; col < GRID_SIZE; col++) {
          rowArr.push(res.points[idx++] || { lat: 0, lng: 0, rank: null });
        }
        grid.push(rowArr);
      }
      setGridData(grid);
      setLastKeyword(keyword.trim());

      // Métricas
      const found = res.points.filter((p: GridPoint) => p.rank !== null);
      const avg = found.length > 0 ? Math.round(found.reduce((s: number, p: GridPoint) => s + (p.rank || 0), 0) / found.length) : null;
      const top3 = Math.round((res.points.filter((p: GridPoint) => p.rank !== null && p.rank <= 3).length / res.points.length) * 100);
      setAvgRank(avg);
      setTop3Pct(top3);
      toast.success(`Grid escaneado! Posição média: ${avg || "20+"}`);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const legendItems = [
    { color: "#16a34a", label: "#1" },
    { color: "#22c55e", label: "#2-3" },
    { color: "#f59e0b", label: "#4-7" },
    { color: "#f97316", label: "#8-10" },
    { color: "#ef4444", label: "#11-20" },
    { color: "#6b7280", label: "20+" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-3xl mx-auto">
        {/* Header */}
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

        {/* Explicação */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Mostra em qual posição seu negócio aparece no Google Maps em <strong>25 pontos geográficos</strong> ao redor da sua localização.
                Cada ponto simula um cliente buscando a partir dali. Verde = topo, vermelho = longe do topo.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Busca */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2">
              <Input
                placeholder='Palavra-chave: "salão de beleza", "dentista", "pizzaria"...'
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleScan()}
                className="flex-1"
              />
              <Button onClick={handleScan} disabled={loading || !keyword.trim()} className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {loading ? "Escaneando..." : "Escanear"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Grade de {GRID_SIZE}×{GRID_SIZE} pontos · {SPACING_KM * 1000}m de espaçamento · raio total: {((GRID_SIZE - 1) / 2 * SPACING_KM).toFixed(1)}km
            </p>
          </CardContent>
        </Card>

        {/* Métricas */}
        {avgRank !== null && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black" style={{ color: rankColor(avgRank).bg }}>#{avgRank}</div>
              <div className="text-xs text-muted-foreground mt-1">Posição média</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black text-green-600">{top3Pct}%</div>
              <div className="text-xs text-muted-foreground mt-1">Pontos no Top 3</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black text-blue-600">{GRID_SIZE * GRID_SIZE}</div>
              <div className="text-xs text-muted-foreground mt-1">Pontos escaneados</div>
            </CardContent></Card>
          </div>
        )}

        {/* Grid visual */}
        {loading && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="font-semibold">Escaneando {GRID_SIZE * GRID_SIZE} pontos geográficos...</p>
              <p className="text-sm text-muted-foreground mt-1">Pode levar até 30 segundos</p>
              {/* Fake progress bar */}
              <div className="max-w-xs mx-auto mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </CardContent>
          </Card>
        )}

        {gridData.length > 0 && !loading && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">"{lastKeyword}" — Visibilidade Geográfica</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setLoading(false)}>
                  <RefreshCw className="w-3 h-3" /> Novo scan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mapa simulado com grid sobreposto */}
              <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ aspectRatio: "1 / 1", maxWidth: 480, margin: "0 auto" }}>
                {/* Fundo de mapa estático */}
                <img
                  src={`https://maps.googleapis.com/maps/api/staticmap?center=${profile?.latitude},${profile?.longitude}&zoom=14&size=480x480&maptype=roadmap&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY || ""}&style=feature:poi|visibility:off`}
                  alt="mapa"
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 grid"
                  style={{
                    gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                    gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
                    padding: "8%",
                    gap: 6,
                  }}
                >
                  {gridData.flat().map((pt, i) => {
                    const { bg, text } = rankColor(pt.rank);
                    const isCenter = i === Math.floor(GRID_SIZE * GRID_SIZE / 2);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center rounded-full font-black text-sm shadow-lg transition-transform hover:scale-110 cursor-default"
                        style={{
                          background: bg,
                          color: text,
                          fontSize: 13,
                          fontWeight: 900,
                          border: isCenter ? "3px solid #fff" : "2px solid rgba(255,255,255,0.6)",
                          boxShadow: isCenter ? "0 0 0 3px #2563eb" : "0 1px 4px rgba(0,0,0,0.3)",
                        }}
                        title={`Posição: ${rankLabel(pt.rank)}`}
                      >
                        {rankLabel(pt.rank)}
                      </div>
                    );
                  })}
                </div>
                {/* Pin central */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white shadow-lg" style={{ marginTop: 1 }} />
                </div>
              </div>

              {/* Legenda */}
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {legendItems.map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow" style={{ background: l.color }}>
                      {l.label.replace("#", "")}
                    </div>
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Interpretação */}
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-700 mb-1">Como interpretar:</p>
                <p className="text-xs text-muted-foreground">
                  Cada círculo representa um cliente buscando <strong>"{lastKeyword}"</strong> naquele ponto do mapa.
                  O número é sua posição no Google Maps naquela localização.
                  {avgRank && avgRank <= 3 ? " 🟢 Excelente visibilidade local!" :
                   avgRank && avgRank <= 7 ? " 🟡 Visibilidade moderada — há espaço para crescer." :
                   " 🔴 Baixa visibilidade — otimize o perfil para melhorar."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado inicial */}
        {gridData.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-blue-400 mx-auto mb-3" />
            <p className="font-semibold">Digite uma palavra-chave para escanear</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ex: "{profile?.category?.toLowerCase() || "seu segmento"}"
            </p>
            {keyword === "" && profile?.category && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setKeyword(profile.category)}>
                Usar "{profile.category}"
              </Button>
            )}
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
