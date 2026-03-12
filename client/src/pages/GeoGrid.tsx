import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, MapPin, Info, RefreshCw } from "lucide-react";
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

// Converte lat/lng para pixel X/Y dentro de um tile de tamanho size no zoom Z
function latLngToPixel(lat: number, lng: number, centerLat: number, centerLng: number, zoom: number, mapW: number, mapH: number) {
  const scale = Math.pow(2, zoom) * 256;
  const toX = (lng: number) => (lng + 180) / 360 * scale;
  const toY = (lat: number) => {
    const s = Math.sin(lat * Math.PI / 180);
    return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  };
  const cx = toX(centerLng), cy = toY(centerLat);
  const px = toX(lng),  py = toY(lat);
  return { x: mapW / 2 + (px - cx), y: mapH / 2 + (py - cy) };
}

// Zoom automático baseado no span dos pontos
function calcZoom(points: GridPoint[], mapW: number) {
  if (!points.length) return 14;
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lngSpan = Math.max(...lngs) - Math.min(...lngs);
  const span = Math.max(latSpan, lngSpan);
  for (let z = 17; z >= 10; z--) {
    const scale = Math.pow(2, z) * 256;
    if (span * scale / 360 < mapW * 0.75) return z;
  }
  return 13;
}

function MapGrid({ points, centerLat, centerLng }: { points: GridPoint[], centerLat: number, centerLng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 480, h: 480 });

  useEffect(() => {
    if (containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setDims({ w: r.width || 480, h: r.width || 480 });
    }
  }, []);

  const zoom = calcZoom(points, dims.w);
  const tileSize = 256;
  // Tiles necessários para cobrir o mapa
  const scale = Math.pow(2, zoom);
  const toTileX = (lng: number) => ((lng + 180) / 360) * scale;
  const toTileY = (lat: number) => {
    const s = Math.sin(lat * Math.PI / 180);
    return (1 - Math.log((1 + s) / (1 - s)) / (2 * Math.PI)) / 2 * scale;
  };
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

  const DOT = Math.min(dims.w / GRID_SIZE / 1.5, 40);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "1/1", background: "#e8e0d8" }}>
      {/* OSM tiles */}
      {tiles.map((t, i) => (
        <img
          key={i}
          src={`https://tile.openstreetmap.org/${zoom}/${t.tx}/${t.ty}.png`}
          alt=""
          style={{ position: "absolute", left: t.x, top: t.y, width: tileSize, height: tileSize, imageRendering: "crisp-edges" }}
          onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
        />
      ))}
      {/* Overlay semitransparente para melhor leitura dos pins */}
      <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.08)" }} />

      {/* Grid pins */}
      <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible" }}>
        {points.map((pt, i) => {
          const { x, y } = latLngToPixel(pt.lat, pt.lng, centerLat, centerLng, zoom, dims.w, dims.h);
          const r = rankLabel(pt.rank);
          const col = rankColor(pt.rank);
          const isCenter = i === Math.floor(points.length / 2);
          const fontSize = r.length > 2 ? DOT * 0.32 : DOT * 0.38;
          return (
            <g key={i}>
              {/* Sombra */}
              <circle cx={x} cy={y + 1.5} r={DOT / 2 + 1} fill="rgba(0,0,0,0.18)" />
              {/* Círculo principal */}
              <circle
                cx={x} cy={y} r={DOT / 2}
                fill={col}
                stroke={isCenter ? "#1d4ed8" : "rgba(255,255,255,0.85)"}
                strokeWidth={isCenter ? 3 : 2}
              />
              {/* Anel extra no centro */}
              {isCenter && <circle cx={x} cy={y} r={DOT / 2 + 4} fill="none" stroke="#1d4ed8" strokeWidth={2} strokeDasharray="4 3" />}
              {/* Número */}
              <text
                x={x} y={y}
                textAnchor="middle" dominantBaseline="central"
                fill="white" fontWeight="900" fontSize={fontSize}
                style={{ fontFamily: "system-ui, sans-serif", pointerEvents: "none", userSelect: "none" }}
              >
                {isCenter ? "📍" : r}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Atribuição OSM */}
      <div className="absolute bottom-1 right-2 text-[9px] text-gray-500 bg-white/70 px-1 rounded">
        © OpenStreetMap
      </div>
    </div>
  );
}

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

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const geoGridMutation = trpc.geoGrid.scan.useMutation();

  const handleScan = async () => {
    if (!keyword.trim()) { toast.error("Digite uma palavra-chave"); return; }
    if (!profile?.latitude || !profile?.longitude) {
      toast.error("Perfil sem coordenadas. Clique em 🗺️ Maps no perfil primeiro."); return;
    }
    setLoading(true);
    try {
      const res = await geoGridMutation.mutateAsync({ profileId, keyword: keyword.trim() });
      setPoints(res.points);
      setCenter(res.center);
      setLastKeyword(keyword.trim());

      const found = res.points.filter((p: GridPoint) => p.rank !== null);
      const avg = found.length > 0 ? Math.round(found.reduce((s: number, p: GridPoint) => s + (p.rank || 0), 0) / found.length) : null;
      const top3 = Math.round((res.points.filter((p: GridPoint) => p.rank !== null && p.rank <= 3).length / res.points.length) * 100);
      setAvgRank(avg); setTop3Pct(top3);
      toast.success(`Escaneado! Posição média: #${avg || "20+"}`);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  const legendItems = [
    { color: "#16a34a", label: "#1" },
    { color: "#22c55e", label: "#2-3" },
    { color: "#eab308", label: "#4-7" },
    { color: "#f97316", label: "#8-10" },
    { color: "#ef4444", label: "#11-20" },
    { color: "#6b7280", label: "20+" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-2xl mx-auto">
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

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Ex: "${profile?.category?.toLowerCase() || "seu segmento"}"`}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleScan()}
              />
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

        {/* Métricas */}
        {avgRank !== null && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-black" style={{ color: rankColor(avgRank) }}>#{avgRank}</div>
              <div className="text-xs text-muted-foreground mt-1">Posição média</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 pb-3 text-center">
              <div className={`text-3xl font-black ${top3Pct! > 0 ? "text-green-600" : "text-red-500"}`}>{top3Pct}%</div>
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
          <Card>
            <CardContent className="py-14 text-center">
              <MapPin className="w-10 h-10 text-blue-500 mx-auto mb-3 animate-bounce" />
              <p className="font-semibold">Escaneando 25 pontos no mapa...</p>
              <p className="text-sm text-muted-foreground mt-1">~30 segundos</p>
              <div className="max-w-xs mx-auto mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapa com grid */}
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

              {/* Legenda */}
              <div className="flex flex-wrap gap-3 justify-center mt-4">
                {legendItems.map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm" style={{ background: l.color }}>
                      {l.label === "#1" ? "1" : ""}
                    </div>
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>

              {/* Interpretação */}
              <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-muted-foreground">
                📍 = sua localização &nbsp;·&nbsp; Cada número = posição no Google Maps naquele ponto
                {avgRank! <= 3 ? " · 🟢 Excelente visibilidade!" :
                 avgRank! <= 7 ? " · 🟡 Visibilidade moderada" :
                 " · 🔴 Baixa visibilidade — otimize o perfil"}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado inicial */}
        {points.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-blue-300 mx-auto mb-3" />
            <p className="font-semibold">Digite uma palavra-chave para escanear</p>
            <p className="text-sm text-muted-foreground mt-1">O mapa mostrará sua posição em 25 pontos ao redor do seu negócio</p>
          </CardContent></Card>
        )}
      </div>
    </DashboardLayout>
  );
}
