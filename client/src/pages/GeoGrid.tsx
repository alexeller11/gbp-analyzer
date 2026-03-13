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
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

interface Props { params: { profileId: string } }
interface GridPoint { lat: number; lng: number; rank: number | null }

/* ─── helpers de projeção Mercator ─────────────────────────── */
function project(lat: number, lng: number) {
  const x = (lng + 180) / 360;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return { x, y };            // coordenadas 0‑1 no mundo inteiro
}

function worldToPixel(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  zoom: number, w: number, h: number
) {
  const scale = Math.pow(2, zoom) * 256;
  const c  = project(centerLat, centerLng);
  const p  = project(lat, lng);
  return {
    x: w / 2 + (p.x - c.x) * scale,
    y: h / 2 + (p.y - c.y) * scale,
  };
}

function bestZoom(points: GridPoint[], size: number) {
  if (!points.length) return 14;
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const spanLat = Math.max(...lats) - Math.min(...lats);
  const spanLng = Math.max(...lngs) - Math.min(...lngs);
  const span = Math.max(spanLat, spanLng);
  // Usa 50% do mapa para a grade (deixa margem para ver a cidade)
  for (let z = 15; z >= 10; z--) {
    const pixels = span * Math.pow(2, z) * 256 / 360;
    if (pixels < size * 0.50) return z;
  }
  return 12;
}

/* ─── cores ─────────────────────────────────────────────────── */
function rankStyle(r: number | null): { bg: string; ring: string; text: string } {
  if (r === null) return { bg: "#6b7280", ring: "#4b5563", text: "#fff" };
  if (r === 1)    return { bg: "#15803d", ring: "#166534", text: "#fff" };
  if (r <= 3)     return { bg: "#22c55e", ring: "#16a34a", text: "#fff" };
  if (r <= 7)     return { bg: "#d4a017", ring: "#a37c0e", text: "#fff" };
  if (r <= 10)    return { bg: "#f97316", ring: "#ea580c", text: "#fff" };
  return           { bg: "#ef4444", ring: "#dc2626", text: "#fff" };
}

/* ─── componente do mapa ─────────────────────────────────────── */
function GeoMap({
  points, centerLat, centerLng,
}: { points: GridPoint[]; centerLat: number; centerLng: number }) {
  const wrapRef  = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 10) setSize(Math.round(w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* placeholder enquanto ainda não tem tamanho */
  if (size === 0) {
    return (
      <div ref={wrapRef} style={{ width: "100%", aspectRatio: "1/1" }}
           className="rounded-xl bg-gray-100 animate-pulse" />
    );
  }

  const zoom     = bestZoom(points, size);
  const TILE     = 256;
  const scale    = Math.pow(2, zoom);
  const c        = project(centerLng > 0 || centerLng <= 0 ? centerLng : 0, centerLat); // unused, kept for clarity
  const cProj    = project(centerLat, centerLng);

  /* tiles necessários */
  const tilesX   = Math.ceil(size / TILE) + 3;
  const tilesY   = Math.ceil(size / TILE) + 3;
  const originTX = cProj.x * scale;   // tile‑x fracionário do centro
  const originTY = cProj.y * scale;
  const startTX  = Math.floor(originTX) - Math.floor(tilesX / 2);
  const startTY  = Math.floor(originTY) - Math.floor(tilesY / 2);

  // deslocamento em pixels do canto top-left do tile (startTX, startTY)
  const offX = size / 2 - (originTX - startTX) * TILE;
  const offY = size / 2 - (originTY - startTY) * TILE;

  const maxTile = scale;
  const tiles: { tx: number; ty: number; px: number; py: number }[] = [];
  for (let row = 0; row < tilesY; row++) {
    for (let col = 0; col < tilesX; col++) {
      const tx = startTX + col;
      const ty = startTY + row;
      if (tx < 0 || ty < 0 || tx >= maxTile || ty >= maxTile) continue;
      tiles.push({ tx, ty, px: offX + col * TILE, py: offY + row * TILE });
    }
  }

  /* pins */
  const PIN_R = Math.min(size / 5 / 3.5, 18);   // raio do círculo — menor para ver o mapa
  const centerIdx = Math.floor(points.length / 2);

  const TILE_SERVERS = [
    "https://a.tile.openstreetmap.org",
    "https://b.tile.openstreetmap.org",
    "https://c.tile.openstreetmap.org",
  ];

  return (
    /* wrapper mantém proporção 1:1 e fornece posição relativa */
    <div
      ref={wrapRef}
      style={{ width: "100%", aspectRatio: "1/1", position: "relative",
               overflow: "hidden", borderRadius: 12, background: "#e8e0d8" }}
    >
      {/* ── tiles OSM ── */}
      {tiles.map((t) => {
        const server = TILE_SERVERS[(t.tx + t.ty) % 3];
        return (
          <img
            key={`${t.tx}-${t.ty}`}
            src={`${server}/${zoom}/${t.tx}/${t.ty}.png`}
            alt=""
            style={{
              position: "absolute",
              left:  t.px,
              top:   t.py,
              width: TILE,
              height: TILE,
              userSelect: "none",
              pointerEvents: "none",
            }}
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        );
      })}

      {/* ── pins SVG ── */}
      <svg
        style={{
          position: "absolute", inset: 0,
          width: size, height: size,
          overflow: "visible", pointerEvents: "none",
        }}
      >
        {points.map((pt, i) => {
          const { x, y }   = worldToPixel(pt.lat, pt.lng, centerLat, centerLng, zoom, size, size);
          const isCenter   = i === centerIdx;
          const label      = pt.rank === null ? "20+" : String(pt.rank);
          const { bg, ring, text } = rankStyle(pt.rank);
          const r          = isCenter ? PIN_R + 4 : PIN_R;
          const fontSize   = label.length > 2 ? r * 0.65 : r * 0.85;

          return (
            <g key={i}>
              {/* sombra suave */}
              <circle cx={x} cy={y + 2} r={r + 1} fill="rgba(0,0,0,0.20)" />

              {/* disco colorido */}
              <circle
                cx={x} cy={y} r={r}
                fill={bg}
                stroke={isCenter ? "#1e40af" : ring}
                strokeWidth={isCenter ? 3.5 : 2}
              />

              {/* anel pontilhado no centro */}
              {isCenter && (
                <circle cx={x} cy={y} r={r + 7}
                  fill="none" stroke="#1e40af"
                  strokeWidth={2.5} strokeDasharray="5 3" />
              )}

              {/* rótulo */}
              {isCenter ? (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  fontSize={r * 1.0} style={{ userSelect: "none" }}>
                  📍
                </text>
              ) : (
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  fill={text} fontWeight="800" fontSize={fontSize}
                  style={{ fontFamily: "system-ui, sans-serif", userSelect: "none" }}>
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* crédito */}
      <div style={{
        position: "absolute", bottom: 4, right: 6,
        fontSize: 9, color: "#444",
        background: "rgba(255,255,255,0.75)",
        padding: "1px 5px", borderRadius: 3,
        pointerEvents: "none",
      }}>
        © OpenStreetMap
      </div>
    </div>
  );
}

/* ─── legendas ──────────────────────────────────────────────── */
const LEGEND = [
  { color: "#15803d", label: "#1" },
  { color: "#22c55e", label: "#2–3" },
  { color: "#d4a017", label: "#4–7" },
  { color: "#f97316", label: "#8–10" },
  { color: "#ef4444", label: "#11–20" },
  { color: "#6b7280", label: ">20" },
];

/* ─── página principal ──────────────────────────────────────── */
export default function GeoGrid({ params }: { params: { profileId: string } }) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);

  const [keyword,     setKeyword]     = useState("");
  const [loading,     setLoading]     = useState(false);
  const [points,      setPoints]      = useState<GridPoint[]>([]);
  const [center,      setCenter]      = useState<{ lat: number; lng: number } | null>(null);
  const [lastKw,      setLastKw]      = useState("");
  const [avgRank,     setAvgRank]     = useState<number | null>(null);
  const [top3Pct,     setTop3Pct]     = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: profile }                        = trpc.profiles.getById.useQuery({ id: profileId });
  const { data: history, refetch: refetchHist }  = trpc.geoGridHistory.getByProfile.useQuery({ profileId });
  const scanMutation                             = trpc.geoGrid.scan.useMutation();

  async function handleScan() {
    if (!keyword.trim()) { toast.error("Digite uma palavra-chave"); return; }
    setLoading(true);
    try {
      const res = await scanMutation.mutateAsync({ profileId, keyword: keyword.trim() });
      setPoints(res.points);
      setCenter(res.center);
      setLastKw(keyword.trim());
      setAvgRank(typeof res.avgRank === "number" ? res.avgRank : null);
      setTop3Pct(typeof res.top3Pct === "number" ? res.top3Pct : null);
      refetchHist();
      toast.success(`Escaneado! Posição média: #${res.avgRank ? Math.round(res.avgRank) : "20+"}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao escanear");
    }
    setLoading(false);
  }

  function loadHistoric(h: any) {
    const pts: GridPoint[] = h.points;
    setPoints(pts);
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng);
    setCenter({
      lat: lats.reduce((a, b) => a + b, 0) / lats.length,
      lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
    });
    setLastKw(h.keyword);
    setAvgRank(h.avgRank);
    setTop3Pct(h.top3Pct);
    setShowHistory(false);
  }

  const avgColor = rankStyle(avgRank !== null ? Math.round(avgRank) : null).bg;

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
                Posição no Google Maps em <strong>25 pontos</strong> ao redor do seu negócio.
                Verde = topo, vermelho = longe.
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
                          day: "2-digit", month: "short",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm"
                        style={{ color: rankStyle(h.avgRank ? Math.round(h.avgRank) : null).bg }}>
                        #{h.avgRank ? Math.round(h.avgRank) : "20+"}
                      </p>
                      {diff !== null && (
                        <p className={`text-xs flex items-center gap-0.5 justify-end
                          ${diff > 0 ? "text-green-600" : "text-red-500"}`}>
                          {diff > 0
                            ? <TrendingUp className="w-3 h-3" />
                            : <TrendingDown className="w-3 h-3" />}
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

        {/* Busca */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2">
              <Input
                placeholder={`Ex: "${profile?.category?.toLowerCase() || "materiais de construção"}"`}
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
            <p className="text-sm text-muted-foreground mt-1">~30 segundos</p>
            <div className="max-w-xs mx-auto mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </CardContent></Card>
        )}

        {/* MAPA */}
        {points.length > 0 && !loading && center && (
          <Card>
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">"{lastKw}"</CardTitle>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7"
                  onClick={() => { setPoints([]); setAvgRank(null); setTop3Pct(null); setCenter(null); }}>
                  <RefreshCw className="w-3 h-3" /> Novo scan
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4">

              {/* ← mapa real aqui */}
              <GeoMap
                points={points}
                centerLat={center.lat}
                centerLng={center.lng}
              />

              {/* Legenda */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-4">
                {LEGEND.map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-4 h-4 rounded-full shadow-sm flex-shrink-0"
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
                  " · 🔴 Baixa visibilidade — otimize o perfil"
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
              O mapa mostrará sua posição em 25 pontos ao redor do negócio
            </p>
          </CardContent></Card>
        )}

      </div>
    </DashboardLayout>
  );
}
