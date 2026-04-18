# 🤖 Contextual AI RAG Agent — GBP Analyzer

Integração com o projeto [awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) adaptada para análise inteligente de avaliações do Google Business Profile usando RAG (Retrieval Augmented Generation).

## O que faz

- **`indexReviews(reviews)`** — Indexa avaliações do GBP gerando embeddings semânticos para busca inteligente
- **`query(question)`** — Responde perguntas sobre reputação, reclamações e padrões usando as avaliações como contexto
- **`generateSentimentReport()`** — Gera relatório completo de sentimento com pontos positivos, negativos e ações recomendadas

## Configuração

```bash
npm install openai
```

Adicione no `.env`:
```
OPENAI_API_KEY=sk-...
```

## Uso

```ts
import { AiRagAgent } from './ai/ai_rag_agent';

const agent = new AiRagAgent({ apiKey: process.env.OPENAI_API_KEY! });

// Indexar avaliações
await agent.indexReviews(reviews);

// Fazer perguntas sobre o GBP
const answer = await agent.query('Quais são as principais reclamações dos clientes?');
console.log(answer);

// Gerar relatório de sentimento
const report = await agent.generateSentimentReport();
console.log(report);
```

## Referência

Inspirado no **Contextual AI RAG Agent** do repositório [Shubhamsaboo/awesome-llm-apps](https://github.com/Shubhamsaboo/awesome-llm-apps) — #1 GitHub Trending.
