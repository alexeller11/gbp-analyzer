import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, BarChart3, Zap, Users, Brain, Star, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Capturar erros retornados pelo OAuth
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setErrorMsg(decodeURIComponent(err));

    // Se já autenticado, ir direto ao dashboard
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07090f" }}>
        <Loader2 style={{ width: 32, height: 32, color: "#4f8ef7", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  const handleLogin = () => {
    window.location.href = "/api/auth/google-login";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", color: "#e2e8f0", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .hero-btn { background: linear-gradient(135deg,#4f8ef7,#a855f7); color:white; border:none; padding:14px 32px;
          border-radius:12px; font-size:16px; font-weight:700; cursor:pointer; font-family:inherit;
          transition:all .2s; box-shadow:0 4px 20px rgba(79,142,247,.3); }
        .hero-btn:hover { transform:translateY(-2px); box-shadow:0 8px 30px rgba(79,142,247,.4); }
        .feat-card { background:#0e1220; border:1px solid #1a2540; border-radius:13px; padding:20px; }
        .anim { animation: fadeUp .6s ease both; }
      `}</style>

      {/* NAV */}
      <nav style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 40px", borderBottom:"1px solid #1a2540", background:"#0e1220" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, fontWeight:800, fontSize:18 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#4f8ef7,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>📊</div>
          GBP Analyzer
        </div>
        <button className="hero-btn" style={{ padding:"9px 22px", fontSize:14 }} onClick={handleLogin}>
          Entrar com Google
        </button>
      </nav>

      {/* HERO */}
      <div style={{ textAlign:"center", padding:"80px 24px 60px", maxWidth:700, margin:"0 auto" }} className="anim">
        {errorMsg && (
          <div style={{ background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)", borderRadius:10, padding:"12px 20px", marginBottom:28, color:"#ef4444", fontSize:14 }}>
            ⚠️ {errorMsg}
          </div>
        )}
        <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(79,142,247,.1)", border:"1px solid rgba(79,142,247,.3)", borderRadius:20, padding:"6px 16px", fontSize:12, fontWeight:700, color:"#4f8ef7", marginBottom:24 }}>
          ✨ Powered by Google Business Profile API + Claude AI
        </div>
        <h1 style={{ fontSize:52, fontWeight:800, letterSpacing:-2, lineHeight:1.05, marginBottom:20 }}>
          Otimize seu{" "}
          <span style={{ background:"linear-gradient(135deg,#4f8ef7,#a855f7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Google Business
          </span>
          {" "}com IA
        </h1>
        <p style={{ fontSize:17, color:"#94a3b8", marginBottom:36, lineHeight:1.7 }}>
          Conecte sua conta Google e veja todos os seus perfis do Google Maps em um painel único.<br/>
          Score inteligente, análise de reviews e consultoria IA em tempo real.
        </p>
        <button className="hero-btn" onClick={handleLogin} style={{ fontSize:16, padding:"15px 36px" }}>
          🔐 Entrar com Google Business
        </button>
        <p style={{ fontSize:12, color:"#64748b", marginTop:14 }}>Login seguro via Google OAuth · Seus dados ficam na sua conta</p>
      </div>

      {/* FEATURES */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 24px 60px", display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {[
          { icon:"📊", title:"Score 0–100", desc:"Análise em 5 dimensões: completude, reviews, engajamento, consistência e mídia." },
          { icon:"⭐", title:"Análise de Reviews", desc:"Sentimentos, palavras-chave, distribuição de ratings e tendências." },
          { icon:"🤖", title:"Chat IA (Claude)", desc:"Consultor especializado em Google Business responde suas dúvidas." },
          { icon:"🏢", title:"Análise de Concorrentes", desc:"Compare seu perfil com concorrentes próximos no Google Maps." },
          { icon:"💡", title:"Sugestões Automáticas", desc:"IA gera sugestões personalizadas com impacto estimado." },
          { icon:"📈", title:"Gráficos de Performance", desc:"Visualizações, buscas, cliques e ligações ao longo do tempo." },
        ].map((f,i) => (
          <div key={i} className="feat-card" style={{ animationDelay:`${i*80}ms` }}>
            <div style={{ fontSize:26, marginBottom:10 }}>{f.icon}</div>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:5 }}>{f.title}</div>
            <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* HOW IT WORKS */}
      <div style={{ maxWidth:700, margin:"0 auto 80px", padding:"0 24px", textAlign:"center" }}>
        <h2 style={{ fontSize:26, fontWeight:800, marginBottom:32 }}>Como funciona</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {[
            ["🔐", "Entrar com Google", "Clique em \"Entrar com Google\" e autorize o acesso ao Google Business Profile."],
            ["🏢", "Perfis importados", "Seus perfis do Google Meu Negócio aparecem automaticamente no dashboard."],
            ["📊", "Analise e melhore", "Veja scores, reviews, concorrentes e receba sugestões de melhoria com IA."],
          ].map(([icon, title, desc], i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:16, background:"#0e1220", border:"1px solid #1a2540", borderRadius:13, padding:"16px 20px", textAlign:"left" }}>
              <div style={{ width:40, height:40, borderRadius:10, background:"linear-gradient(135deg,#4f8ef7,#a855f7)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{icon}</div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{title}</div>
                <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="hero-btn" onClick={handleLogin} style={{ marginTop:36, fontSize:15, padding:"13px 30px" }}>
          Começar agora — é grátis
        </button>
      </div>
    </div>
  );
}
