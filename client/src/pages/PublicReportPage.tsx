import { trpc } from "@/lib/trpc";
import { Loader2, Star, CheckCircle2, Trophy } from "lucide-react";

interface Props { params: { token: string } }

function scoreColor(v: number) { return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : "#ef4444"; }

export default function PublicReportPage({ params }: Props) {
  const { data, isLoading, error } = trpc.publicReport.getByToken.useQuery({ token: params.token });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center min-h-screen text-center p-8">
      <div>
        <div className="text-5xl mb-4">📄</div>
        <p className="font-bold text-xl">Relatório não encontrado</p>
        <p className="text-muted-foreground mt-2">O link pode ter expirado ou ser inválido.</p>
      </div>
    </div>
  );

  const d = data.data;
  const sc = d.score?.total || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            🏆 GBP Analyzer
          </div>
          <h1 className="text-3xl font-black">{d.profile.name}</h1>
          <p className="text-muted-foreground mt-1">{d.profile.category} · {d.profile.address?.split(",")[0]}</p>
        </div>

        {/* Score + Nota */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border">
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-2">Score GBP</p>
            <div className="text-5xl font-black" style={{ color: scoreColor(sc) }}>{sc}</div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${sc}%`, background: scoreColor(sc) }} />
            </div>
            <p className="text-xs mt-1 font-medium" style={{ color: scoreColor(sc) }}>
              {sc >= 75 ? "Perfil Excelente" : sc >= 50 ? "Precisa Melhorar" : "Atenção Urgente"}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 text-center shadow-sm border">
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-2">Nota Média</p>
            <div className="text-5xl font-black text-yellow-500">{(d.profile.avgRating || 0).toFixed(1)}</div>
            <div className="flex justify-center mt-2">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-4 h-4" fill={i <= Math.round(d.profile.avgRating || 0) ? "#f59e0b" : "#e5e7eb"} stroke="none" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{d.profile.totalReviews || 0} avaliações</p>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border space-y-3">
          {[
            { label: "Avaliações no Google", val: d.profile.totalReviews || 0, icon: "💬" },
            { label: "Concorrentes monitorados", val: d.competitorCount || 0, icon: "🏢" },
            { label: "Perfil verificado", val: d.profile.isVerified ? "✅ Sim" : "❌ Não", icon: "🔒" },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">{s.icon} {s.label}</span>
              <span className="font-bold text-sm">{s.val}</span>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          Gerado em {new Date(d.generatedAt).toLocaleDateString("pt-BR")} via GBP Analyzer
        </div>
      </div>
    </div>
  );
}
