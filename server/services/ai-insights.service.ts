import { GoogleGenAI } from "@google/genai";

type AiBusinessInput = {
  name: string;
  primaryCategory: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  accountName: string | null;
  accountType: string | null;
  score: number;
  opportunityScore: number;
  opportunityLevel: string;
  insights: string[];
  priorities: string[];
  isVerified: boolean;
  verificationState: string | null;
  portfolioType: string;
};

export type AiAnalysisResult = {
  summary: string;
  rankingDiagnosis: string;
  priorities: string[];
  opportunityAnalysis: string;
  pitch: string;
};

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurado");
  }

  return new GoogleGenAI({ apiKey });
}

function getModel() {
  return process.env.GEMINI_MODEL || "gemini-3-flash-preview";
}

function extractJson(text: string) {
  const cleaned = text.trim();

  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return cleaned;
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("A IA não retornou JSON válido");
  }

  return match[0];
}

export async function generateAiAnalysis(
  business: AiBusinessInput
): Promise<AiAnalysisResult> {
  const ai = getClient();
  const model = getModel();

  const prompt = `
Você é um estrategista sênior de Google Business Profile e SEO local para agências.
Responda SOMENTE em JSON válido, sem markdown e sem texto extra.

Objetivo:
Analisar um perfil de empresa e gerar:
- resumo executivo
- diagnóstico de ranqueamento local
- prioridades de ação
- leitura de oportunidade comercial
- pitch de abordagem comercial

Dados do perfil:
${JSON.stringify(business, null, 2)}

Regras:
- Escreva em português do Brasil.
- Seja específico e útil.
- Evite linguagem genérica.
- O pitch deve soar como mensagem comercial de agência, natural e profissional.
- Prioridades devem ser curtas e acionáveis.
- Se o perfil estiver fraco, diga isso claramente.
- Considere verificação, completude, estrutura e potencial comercial.

Formato obrigatório:
{
  "summary": "string",
  "rankingDiagnosis": "string",
  "priorities": ["string", "string", "string"],
  "opportunityAnalysis": "string",
  "pitch": "string"
}
`.trim();

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  const text = response.text ?? "";
  const jsonText = extractJson(text);
  const parsed = JSON.parse(jsonText);

  return {
    summary: String(parsed.summary || ""),
    rankingDiagnosis: String(parsed.rankingDiagnosis || ""),
    priorities: Array.isArray(parsed.priorities)
      ? parsed.priorities.map((item: unknown) => String(item))
      : [],
    opportunityAnalysis: String(parsed.opportunityAnalysis || ""),
    pitch: String(parsed.pitch || "")
  };
}
