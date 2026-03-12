import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, MapPin, Info, RefreshCw, TrendingUp, TrendingDown, Minus, History } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }
interface GridPoint { lat: number; lng: number; rank: number | null }

const GRID_SIZE = 5;

function rankColor(r: number | null): string {
  if (r === null) return "#6b7280";
  if (r === 1)    return "#16a34a";
  if (r <= 3)     return "#22c55e";
  if (r <= 7)     return "#eab308";
  if (r <= 10)    return "#f97316";
  return "#ef4444";
}
function rankLabel(r: number | null) { return r === null ? "20+" : String(r); }

function latLngToPixel(lat: number, lng: number, centerLat: number, centerLng: number, zoom: number, mapW: number, mapH: number) {
  const scale = Math.pow(2, zoom) * 256;
  const toX = (lng: number) => (lng + 180) / 360 * scale;
  const toY = (lat: number) => {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  };
  const cx = toX(centerLng), cy = toY(centerLat);
  return { x: mapW / 2 + (toX(lng) - cx), y: mapH / 2 + (toY(lat) - cy) };
}

function calcZoom(points: GridPoint[], mapW: number) {
  if (!points.length) return 14;
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  for (let z = 17; z >= 10; z--) {
    if (span * Math.pow(2, z) * 256 / 360 < mapW * 0.75) return z;
  }
  return 13;
}

function MapGrid({ points, centerLat, centerLng }: { points: GridPoint[], centerLat: number, centerLng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 480, h: 480 });

  useEffect(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      const w = r.width || 480;
      setDims({ w, h: w });
    }
  }, []);

  const zoom = calcZoom(points, dims.w);
  const scale = Math.pow(2, zoom);
  const tileSize = 256;
  const toTileX = (lng: number) => ((lng + 180) / 360) * scale;
  const toTileY = (lat: number) => (1 - Math.log((1 + Math.sin(lat * Math.PI / 180)) / (1 - Math.sin(lat * Math.PI / 180))) / (2 * Math.PI)) / 2 * scale;
  const cx = toTileX(centerLng), cy = toTileY(centerLat);
  const tilesX = Math.ceil(dims.w / tileSize) + 2;
  const tilesY = Math.ceil(dims.h / tileSize) + 2;
  const startTX = Math.floor(cx) - Math.floor(tilesX / 2);
  const startTY = Math.floor(cy) - Math.floor(tilesY / 2);
  const offsetX = dims.w / 2 - (cx - Math.floor(cx)) * tileSize - Math.floor(tilesX / 2) * tileSize;
  const offsetY = dims.h / 2 - (cy - Math.floor(cy)) * tileSize - Math.floor(tilesY / 2) * tileSize;

  const tiles: { tx: number; ty: number; x: number; y: number }[] = [];
  for (let row = 0; row < tilesY; row++) {
    for (let col = 0; col < tilesX; col++) {
      const tx = startTX + col, ty = startTY + row;
      const maxTile = Math.pow(2, zoom);
      if (tx < 0 || ty < 0 || tx >= maxTile || ty >= maxTile) continue;
      tiles.push({ tx, ty, x: offsetX + col * tileSize, y: offsetY + row * tileSize });
    }
  }

  const DOT = Math.min(dims.w / GRID_SIZE / 1.5, 44);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl shadow-md" style={{ aspectRatio: "1/1", background: "#e8e0d8" }}>
      {tiles.map((t, i) => (
        <img key={i} src={`https://tile.openstreetmap.org/${zoom}/${t.tx}/${t.ty}.png`} alt=""
          style={{ position: "absolute", left: t.x, top: t.y, width: tileSize, height: tileSize, imageRendering: "crisp-edges" }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
      ))}
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
        {points.map((pt, i) => {
          const { x, y } = latLngToPixel(pt.lat, pt.lng, centerLat, centerLng, zoom, dims.w, dims.h);
          const r = rankLabel(pt.rank);
          const col = rankColor(pt.rank);
          const isCenter = i === Math.floor(points.length / 2);
          const fontSize = r.length > 2 ? DOT * 0.3 : DOT * 0.38;
          return (
            <g key={i}>
              <circle cx={x} cy={y + 2} r={DOT / 2 + 1} fill="rgba(0,0,0,0.2)" />
              <circle cx={x} cy={y} r={DOT / 2} fill={col}
                stroke={isCenter ? "#1d4ed8" : "rgba(255,255,255,0.9)"} strokeWidth={isCenter ? 3 : 2} />
              {isCenter && <circle cx={x} cy={y} r={DOT / 2 + 5} fill="none" stroke="#1d4ed8" strokeWidth={2.5} strokeDasharray="5 3" />}
              <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                fill="white" fontWeight="900" fontSize={fontSize}
                style={{ fontFamily: "system-ui, sans-serif", pointerEvents: "none", userSelect: "none" }}>
                {isCenter ? "📍" : r}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-1 right-2 text-[9px] text-gray-500 bg-white/70 px-1 rounded">© OpenStreetMap</div>
    </div>
  );
}

const LEGEND = [
  { color: "#16a34a", label: "#1" }, { color: "#22c55e", label: "#2-3" },
  { color: "#eab308", label: "#4-7" }, { color: "#f97316", label: "#8-10" },
  { color: "#ef4444", label: "#11-20" }, { color: "#6b7280", label: "20+" },
];

export default function GeoGrid({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<GridPoint[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [lastKeyword, setLastKeyword] = useState("");
  const [avgRank, setAvgRank] = useState<number | null>(null);
  const [top3Pct, setTop3Pct] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: history, refetch: refetchHistory } = trpc.geoGridHistory.getByProfile.useQuery({ profileId });
  const geoGridMutation = trpc.geoGrid.scan.useMutation();

  const handleScan = async () => {
    if (!keyword.trim()) { toast.error("Digite uma palavra-chave"); return; }
    if (!profile?.latitude && !profile?.longitude) {
      toast.error("Perfil sem coordenadas. Clique em 🗺️ Maps no perfil primeiro."); return;
    }
    setLoading(true);
    try {
      const res = await geoGridMutation.mutateAsync({ profileId, keyword: keyword.trim() });
      setPoints(res.points);
      setCenter(res.center);
      setLastKeyword(keyword.trim());
      setAvgRank(res.avgRank ?? null);
      setTop3Pct(res.top3Pct ?? null);
      refetchHistory();
      toast.success(`Escaneado! Posição média: #${res.avgRank ? Math.round(res.avgRank) : "20+"}`);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const loadHistoricScan = (h: any) => {
    setPoints(h.points);
    setCenter(null); // calcular do centro dos pontos
    const lats = h.points.map((p: GridPoint) => p.lat);
    const lngs = h.points.map((p: GridPoint) => p.lng);
    setCenter({ lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length, lng: lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length });
    setLastKeyword(h.keyword);
    setAvgRank(h.avgRank);
    setTop3Pct(h.top3Pct);
    setShowHistory(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-2xl mx-auto">
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowHistory(v => !v)}>
              <History className="w-3.5 h-3.5" /> Histórico ({history?.length})
            </Button>
          )}
        </div>

        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-3 pb-3">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Mostra em qual posição seu negócio aparece no Google Maps em <strong>25 pontos geográficos</strong> ao redor de você.
                Verde = topo, vermelho = longe do topo.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Histórico */}
        {showHistory && (history?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Scans Anteriores</CardTitle></CardHeader>
            <CardContent className="p-0">
              {history?.map((h: any) => {
                const prev = history[history.indexOf(h) + 1];
                const diff = prev && h.avgRank && prev.avgRank ? prev.avgRank - h.avgRank : null;
                return (
                  <button key={h.id} onClick={() => loadHistoricScan(h)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50 text-left">
                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">"{h.keyword}"</p>
                      <p className="text-xs text-muted-foreground">{new Date(h.scannedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm" style={{ color: rankColor(h.avgRank ? Math.round(h.avgRank) : null) }}>
                        #{h.avgRank ? Math.round(h.avgRank) : "20+"}
                      </p>
                      {diff !== null && (
                        <p className={`text-xs flex items-center gap-0.5 justify-end ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"}`}>
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
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

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2">
              <Input placeholder={`Ex: "${profile?.category?.toLowerCase() || "seu segmento"}"`}
                value={keyword} onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleScan()} />
              <Button onClick={handleScan} disabled={loading || !keyword.trim()} className="gap-2 flex-shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                {loading ? "Escaneando..." : "Escanear"}
              </Button>
            </div>
            {profile?.category && !keyword && (
              <button className="mt-2 text-xs text-blue-600 hover:underline" onClick={() => setKeyword(profile.category)}>
                Usar "{profile.category}"
              </button>
            )}
          </CardContent>
        </Card>

        {avgRank !== null && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black" style={{ color: rankColor(Math.round(avgRank)) }}>#{Math.round(avgRank)}</div>
              <div className="text-xs text-muted-foreground mt-1">Posição média</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className={`text-3xl font-black ${(top3Pct ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>{top3Pct ?? 0}%</div>
              <div className="text-xs text-muted-foreground mt-1">Pontos no Top 3</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black text-blue-600">25</div>
              <div className="text-xs text-muted-foreground mt-1">Pontos escaneados</div>
            </CardContent></Card>
          </div>
        )}

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

        {points.length > 0 && !loading && center && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">"{lastKeyword}"</CardTitle>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => { setPoints([]); setAvgRank(null); }}>
                  <RefreshCw className="w-3 h-3" /> Novo scan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <MapGrid points={points} centerLat={center.lat} centerLng={center.lng} />
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {LEGEND.map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm" style={{ background: l.color }} />
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-muted-foreground">
                📍 = sua localização · Cada número = posição no Google Maps naquele ponto
                {avgRank !== null && (avgRank <= 3 ? " · 🟢 Excelente visibilidade!" : avgRank <= 7 ? " · 🟡 Visibilidade moderada" : " · 🔴 Baixa visibilidade — otimize o perfil")}
              </div>
            </CardContent>
          </Card>
        )}

        {points.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-blue-300 mx-auto mb-3" />
            <p className="font-semibold">Digite uma palavra-chave para escanear</p>
            <p className="text-sm text-muted-foreground mt-1">O mapa mostrará sua posição em 25 pontos ao redor do negócio</p>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
