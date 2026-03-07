import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Send, Loader2, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";

interface Props { params: { profileId: string } }

interface Message { role: "user" | "assistant"; content: string; ts: string }

const SUGESTOES = [
  "Como melhorar minha nota no Google?",
  "Como responder reviews negativos?",
  "Quantas fotos devo ter no perfil?",
  "Como criar posts que engajam?",
  "Como aparecer mais no Google Maps?",
  "Como pedir mais avaliações aos clientes?",
];

export default function AIChatPage({ params }: Props) {
  const [, setLocation] = useLocation();
  const profileId = parseInt(params.profileId);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: profile } = trpc.profiles.getById.useQuery({ id: profileId });
  const sendMutation = trpc.chat.sendMessage.useMutation();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Mensagem de boas-vindas
  useEffect(() => {
    if (profile && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Olá! Sou seu consultor especializado para o **${profile.name}**. Posso ajudar com estratégias para melhorar seu Google Business Profile, aumentar avaliações, responder reviews e muito mais. Como posso ajudar?`,
        ts: new Date().toISOString(),
      }]);
    }
  }, [profile]);

  const handleSend = async (msg?: string) => {
    const text = (msg || input).trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await sendMutation.mutateAsync({ profileId, message: text });
      setMessages(prev => [...prev, { role: "assistant", content: res.message, ts: new Date().toISOString() }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao processar resposta. Tente novamente.", ts: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/profile/${profileId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Consultor IA</h1>
              <p className="text-xs text-muted-foreground">{profile?.name || "Carregando..."} · Powered by Claude</p>
            </div>
          </div>
          <span className="ml-auto text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">● Online</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}>
                {m.content}
                <div className={`text-[10px] mt-1 opacity-60`}>
                  {new Date(m.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Analisando...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Sugestões */}
        {messages.length <= 1 && (
          <div className="flex gap-2 flex-wrap py-3">
            {SUGESTOES.map(s => (
              <button key={s} onClick={() => handleSend(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 pt-3 border-t">
          <input
            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Pergunte sobre estratégias para o seu perfil..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={isLoading}
          />
          <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="px-4">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
