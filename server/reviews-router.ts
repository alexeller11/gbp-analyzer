import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  handleReviewWebhook,
  getRecentReviews,
  getReviewStats,
  simulateReviewWebhook,
} from "./realtime-reviews";
import { callGroqAPI } from "./groq";
import * as db from "./db";

export const reviewsRouter = router({
  /**
   * Webhook para receber novo review do Google
   */
  webhook: publicProcedure
    .input(
      z.object({
        profileId: z.number(),
        googleReviewId: z.string(),
        authorName: z.string(),
        authorPhoto: z.string().optional(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
        createdAt: z.date().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await handleReviewWebhook({
          profileId: input.profileId,
          googleReviewId: input.googleReviewId,
          authorName: input.authorName,
          authorPhoto: input.authorPhoto,
          rating: input.rating,
          comment: input.comment,
          createdAt: input.createdAt || new Date(),
        });

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error("[Reviews Router] Webhook error:", error);
        return {
          success: false,
          error: "Failed to process review webhook",
        };
      }
    }),

  /**
   * Obter reviews recentes de um perfil
   */
  getRecent: protectedProcedure
    .input(
      z.object({
        profileId: z.number(),
        limit: z.number().optional().default(10),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getRecentReviews(input.profileId, input.limit);
      } catch (error) {
        console.error("[Reviews Router] Get recent error:", error);
        return [];
      }
    }),

  /**
   * Obter estatísticas de reviews
   */
  getStats: protectedProcedure
    .input(z.object({ profileId: z.number() }))
    .query(async ({ input }) => {
      try {
        return await getReviewStats(input.profileId);
      } catch (error) {
        console.error("[Reviews Router] Get stats error:", error);
        return null;
      }
    }),

  /**
   * Simular webhook para testes
   */
  simulateWebhook: protectedProcedure
    .input(z.object({ profileId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        const results = await simulateReviewWebhook(input.profileId);
        return {
          success: true,
          count: results.length,
          results,
        };
      } catch (error) {
        console.error("[Reviews Router] Simulate webhook error:", error);
        return {
          success: false,
          error: "Failed to simulate webhook",
        };
      }
    }),
});

// Adicionar ao reviewsRouter - geração de resposta com SEO
// Exportar como função para ser adicionada ao router existente
export const generateResponseProcedure = protectedProcedure
  .input(z.object({
    profileId: z.number(),
    reviewId: z.number(),
    authorName: z.string(),
    rating: z.number(),
    comment: z.string(),
    keywords: z.array(z.string()).optional(),
  }))
  .mutation(async ({ input }) => {
    const profile = await db.getProfileById(input.profileId);
    if (!profile) throw new Error("Perfil não encontrado");

    const kws = (input.keywords || []).join(", ");
    const tone = input.rating >= 4 ? "agradecido e entusiasmado" : input.rating === 3 ? "educado e proativo" : "empático, profissional e resolutivo";

    const prompt = `Você é o dono de "${profile.name}" (${profile.category}) em ${profile.address}.
    
Gere uma resposta para esta avaliação do Google Business Profile:
- Autor: ${input.authorName}
- Nota: ${input.rating}/5 estrelas  
- Comentário: "${input.comment || "(sem comentário)"}"

Regras OBRIGATÓRIAS:
1. Tom: ${tone}
2. Palavras-chave para SEO local (insira 2-3 NATURALMENTE): ${kws || `${profile.category}, ${profile.address}`}
3. Máximo 4 frases
4. Mencione o nome do cliente
5. Inclua nome do negócio e cidade/bairro naturalmente
6. Termine com convite para retornar ou CTA

IMPORTANTE: A resposta deve soar humana, não robótica. As keywords devem aparecer naturalmente.
Responda SOMENTE com o texto da resposta, sem aspas ou explicações.`;

    const response = await callGroqAPI([
      { role: "system", content: "Você gera respostas profissionais para avaliações do Google Business Profile, otimizadas para SEO local." },
      { role: "user", content: prompt },
    ]);

    return { response: response.trim() };
  });
