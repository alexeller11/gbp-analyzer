/**
 * AI Chat — usa Groq API (gratuito)
 * Modelos gratuitos: llama-3.3-70b-versatile, mixtral-8x7b-32768
 */

export interface GroqMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function callGroqAPI(messages: GroqMessage[]): Promise<string> {
  // Tenta Groq primeiro (gratuito), fallback para Anthropic se tiver chave
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (groqKey) {
    return callGroq(messages, groqKey);
  } else if (anthropicKey) {
    return callAnthropic(messages, anthropicKey);
  } else {
    return "⚠️ Configure GROQ_API_KEY (gratuito em console.groq.com) para usar o chat IA.";
  }
}

async function callGroq(messages: GroqMessage[], apiKey: string): Promise<string> {
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const userMessages = messages.filter(m => m.role !== "system");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...userMessages.map(m => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(messages: GroqMessage[], apiKey: string): Promise<string> {
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const userMessages = messages.filter(m => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: system || "Você é consultor de Google Business Profile. Responda em português.",
      messages: userMessages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) throw new Error(`Anthropic error: ${response.statusText}`);
  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}
