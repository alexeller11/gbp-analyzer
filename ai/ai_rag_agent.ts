/**
 * Contextual AI RAG Agent — inspirado em Shubhamsaboo/awesome-llm-apps
 * Busca semântica e respostas contextuais sobre dados do Google Business Profile
 *
 * Uso:
 *   const agent = new AiRagAgent({ apiKey: process.env.OPENAI_API_KEY });
 *   await agent.indexReviews(reviews);
 *   const answer = await agent.query('Quais são as principais reclamações dos clientes?');
 */

import OpenAI from 'openai';

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

interface ChunkWithEmbedding {
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export class AiRagAgent {
  private client: OpenAI;
  private model: string;
  private embedModel: string;
  private store: ChunkWithEmbedding[] = [];

  constructor({ apiKey, model = 'gpt-4o-mini', embedModel = 'text-embedding-3-small' }: { apiKey: string; model?: string; embedModel?: string }) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.embedModel = embedModel;
  }

  /** Gera embedding de um texto */
  private async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({ model: this.embedModel, input: text });
    return res.data[0].embedding;
  }

  /** Similaridade de cosseno entre dois vetores */
  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
  }

  /**
   * Indexa avaliações do GBP para busca semântica
   * @param reviews - Array de avaliações do Google Business Profile
   */
  async indexReviews(reviews: Review[]): Promise<void> {
    this.store = [];
    for (const review of reviews) {
      const text = `Avaliação de ${review.author} (${review.rating}⭐ — ${review.date}): ${review.text}`;
      const embedding = await this.embed(text);
      this.store.push({ text, embedding, metadata: { id: review.id, rating: review.rating, date: review.date } });
    }
    console.log(`✅ ${this.store.length} avaliações indexadas.`);
  }

  /**
   * Busca os chunks mais relevantes para uma query
   * @param query - Pergunta do usuário
   * @param topK - Número de resultados
   */
  private async retrieve(query: string, topK = 5): Promise<string[]> {
    const queryEmbedding = await this.embed(query);
    return this.store
      .map(chunk => ({ ...chunk, score: this.cosineSimilarity(queryEmbedding, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(chunk => chunk.text);
  }

  /**
   * Responde perguntas sobre o GBP usando RAG
   * @param question - Pergunta sobre avaliações, performance ou reputação
   * @returns Resposta contextualizada com base nas avaliações indexadas
   */
  async query(question: string): Promise<string> {
    const context = await this.retrieve(question);
    const contextText = context.join('\n\n');

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `Você é um analista de reputação digital especializado em Google Business Profile.
          Responda à pergunta do usuário baseando-se APENAS nas avaliações fornecidas como contexto.
          Seja objetivo, destaque padrões e sugira ações de melhoria quando relevante.
          Se não houver informação suficiente no contexto, diga claramente.`,
        },
        {
          role: 'user',
          content: `Contexto (avaliações relevantes):\n${contextText}\n\nPergunta: ${question}`,
        },
      ],
    });

    return response.choices[0].message.content ?? '';
  }

  /**
   * Gera relatório de sentimento das avaliações indexadas
   * @returns Relatório com pontos positivos, negativos e sugestões
   */
  async generateSentimentReport(): Promise<object> {
    const allReviews = this.store.map(c => c.text).join('\n\n');

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Analise as avaliações e gere um relatório de sentimento completo em JSON com: pontuacaoMedia, totalAvaliacoes, principaisPontosPositivos, principaisPontosNegativos, palavrasChaveFrequentes e acoesRecomendadas.',
        },
        { role: 'user', content: allReviews },
      ],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content ?? '{}');
  }
}
