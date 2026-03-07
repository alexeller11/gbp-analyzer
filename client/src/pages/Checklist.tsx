import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const CHECKLIST = [
  {
    id: "prereq",
    titulo: "1. Pré-requisitos",
    emoji: "📋",
    itens: [
      { id: "p1", texto: "Conta Google (Gmail) criada" },
      { id: "p2", texto: "Nome comercial correto definido" },
      { id: "p3", texto: "Endereço físico válido" },
      { id: "p4", texto: "Telefone ativo" },
      { id: "p5", texto: "E-mail profissional" },
      { id: "p6", texto: "Site ou Landing Page" },
    ],
  },
  {
    id: "criacao",
    titulo: "2. Criação do Perfil",
    emoji: "🏢",
    itens: [
      { id: "c1", texto: "Acessar google.com/business" },
      { id: "c2", texto: "Inserir nome da empresa" },
      { id: "c3", texto: "Escolher categoria principal" },
      { id: "c4", texto: "Inserir endereço completo" },
      { id: "c5", texto: "Definir atendimento presencial" },
      { id: "c6", texto: "Inserir telefone e site" },
    ],
  },
  {
    id: "config",
    titulo: "3. Configuração Inicial",
    emoji: "⚙️",
    itens: [
      { id: "cf1", texto: "Horário de funcionamento" },
      { id: "cf2", texto: "Descrição da empresa" },
      { id: "cf3", texto: "Data de abertura" },
      { id: "cf4", texto: "Área de atendimento" },
    ],
  },
  {
    id: "categorias",
    titulo: "4. Categorias e Serviços",
    emoji: "🏷️",
    itens: [
      { id: "cat1", texto: "Categoria principal correta" },
      { id: "cat2", texto: "Categorias secundárias" },
      { id: "cat3", texto: "Cadastro de serviços" },
    ],
  },
  {
    id: "fotos",
    titulo: "5. Fotos e Identidade Visual",
    emoji: "📸",
    itens: [
      { id: "f1", texto: "Logo adicionado" },
      { id: "f2", texto: "Foto de capa" },
      { id: "f3", texto: "Fotos internas e externas" },
      { id: "f4", texto: "Fotos da equipe" },
    ],
  },
  {
    id: "verificacao",
    titulo: "6. Verificação",
    emoji: "✅",
    itens: [
      { id: "v1", texto: "Método de verificação escolhido" },
      { id: "v2", texto: "Verificação concluída" },
    ],
  },
  {
    id: "pos",
    titulo: "7. Pós-Verificação",
    emoji: "🚀",
    itens: [
      { id: "pv1", texto: "Mensagens ativadas" },
      { id: "pv2", texto: "Link de WhatsApp configurado" },
      { id: "pv3", texto: "URL curta criada" },
      { id: "pv4", texto: "Perguntas e respostas configuradas" },
    ],
  },
  {
    id: "conteudo",
    titulo: "8. Conteúdo Inicial",
    emoji: "✍️",
    itens: [
      { id: "co1", texto: "Post institucional publicado" },
      { id: "co2", texto: "Post de serviço publicado" },
      { id: "co3", texto: "Post de autoridade publicado" },
      { id: "co4", texto: "Post de localização publicado" },
    ],
  },
  {
    id: "avaliacoes",
    titulo: "9. Avaliações",
    emoji: "⭐",
    itens: [
      { id: "av1", texto: "Link de avaliação criado" },
      { id: "av2", texto: "Reviews solicitados aos clientes" },
      { id: "av3", texto: "Avaliações respondidas" },
    ],
  },
  {
    id: "manutencao",
    titulo: "10. Manutenção Mensal",
    emoji: "🔄",
    itens: [
      { id: "m1", texto: "Postagens semanais publicadas" },
      { id: "m2", texto: "Avaliações respondidas no mês" },
      { id: "m3", texto: "Fotos atualizadas" },
      { id: "m4", texto: "Insights monitorados" },
    ],
  },
];

const STORAGE_KEY = "gbp_checklist_v1";

function loadChecked(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveChecked(data: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const totalItens = CHECKLIST.reduce((acc, s) => acc + s.itens.length, 0);

export default function Checklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>(loadChecked);

  const toggle = (id: string) => {
    const novo = { ...checked, [id]: !checked[id] };
    setChecked(novo);
    saveChecked(novo);
  };

  const totalFeito = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((totalFeito / totalItens) * 100);

  function scoreColor(v: number) {
    return v >= 75 ? "#16a34a" : v >= 50 ? "#d97706" : v >= 25 ? "#3b82f6" : "#94a3b8";
  }

  const secaoFeita = (secao: typeof CHECKLIST[0]) =>
    secao.itens.filter(i => checked[i.id]).length;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Checklist Google Business</h1>
          <p className="text-muted-foreground mt-1">Guia completo para criar e otimizar seu perfil do zero</p>
        </div>

        {/* Progresso geral */}
        <div className="rounded-2xl border p-5 bg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Progresso geral</p>
              <p className="text-3xl font-bold mt-0.5" style={{ color: scoreColor(pct) }}>{pct}%</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{totalFeito}<span className="text-muted-foreground text-base font-normal">/{totalItens}</span></p>
              <p className="text-xs text-muted-foreground">itens concluídos</p>
            </div>
          </div>
          {/* Barra de progresso */}
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: scoreColor(pct) }}
            />
          </div>
          {pct === 100 && (
            <div className="mt-3 text-center text-sm font-semibold text-green-600 bg-green-50 rounded-lg py-2">
              🎉 Parabéns! Seu perfil está 100% configurado!
            </div>
          )}
        </div>

        {/* Seções */}
        {CHECKLIST.map((secao) => {
          const feitos = secaoFeita(secao);
          const total = secao.itens.length;
          const completa = feitos === total;

          return (
            <div key={secao.id} className={`rounded-2xl border overflow-hidden transition-all ${completa ? "border-green-200 bg-green-50/30" : "bg-card"}`}>
              {/* Header da seção */}
              <div className="flex items-center justify-between px-5 py-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{secao.emoji}</span>
                  <span className="font-bold text-base">{secao.titulo}</span>
                  {completa && <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">✓ Completo</span>}
                </div>
                <span className="text-sm font-medium" style={{ color: scoreColor(Math.round(feitos/total*100)) }}>
                  {feitos}/{total}
                </span>
              </div>

              {/* Itens */}
              <div className="divide-y">
                {secao.itens.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors hover:bg-muted/40 ${checked[item.id] ? "opacity-70" : ""}`}
                  >
                    <div
                      onClick={() => toggle(item.id)}
                      className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all cursor-pointer ${
                        checked[item.id]
                          ? "bg-green-500 border-green-500"
                          : "border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {checked[item.id] && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-sm flex-1 ${checked[item.id] ? "line-through text-muted-foreground" : ""}`}
                      onClick={() => toggle(item.id)}
                    >
                      {item.texto}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {/* Reset */}
        <div className="text-center pb-6">
          <button
            onClick={() => { if (confirm("Resetar todo o checklist?")) { setChecked({}); saveChecked({}); } }}
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors underline underline-offset-2"
          >
            Resetar checklist
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
