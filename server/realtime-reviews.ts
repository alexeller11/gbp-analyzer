import { getDb } from "./db";
import { reviews, profiles } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

/**
 * Sincronização em tempo real de reviews
 * Simula recebimento de webhooks do Google Business Profile
 */

export interface WebhookReviewData {
  profileId: number;
  googleReviewId: string;
  authorName: string;
  authorPhoto?: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updateTime?: Date;
}

/**
 * Processa webhook de novo review
 */
export async function handleReviewWebhook(data: WebhookReviewData) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Verificar se review já existe
    const existing = await db
      .select()
      .from(reviews)
      .where(eq(reviews.googleReviewId, data.googleReviewId))
      .limit(1);

    if (existing.length > 0) {
      // Atualizar review existente
      await db
        .update(reviews)
        .set({
          comment: data.comment,
        })
        .where(eq(reviews.googleReviewId, data.googleReviewId));

      return { action: "updated", reviewId: existing[0].id };
    }

    // Criar novo review
    await db.insert(reviews).values({
      profileId: data.profileId,
      googleReviewId: data.googleReviewId,
      authorName: data.authorName,
      authorPhoto: data.authorPhoto,
      rating: data.rating,
      comment: data.comment,
      sentiment: await analyzeSentiment(data.comment || ""),
      sentimentScore: await calculateSentimentScore(data.comment || ""),
      publishedAt: data.createdAt,
    });

    // Atualizar rating do perfil
    await updateProfileRating(data.profileId);

    return { action: "created", reviewId: 0 };
  } catch (error) {
    console.error("[Realtime Reviews] Error handling webhook:", error);
    throw error;
  }
}

/**
 * Analisa sentimento do review
 */
export async function analyzeSentiment(comment: string): Promise<string> {
  if (!comment) return "neutral";

  const lowerComment = comment.toLowerCase();

  // Palavras positivas
  const positiveWords = [
    "excelente",
    "ótimo",
    "maravilhoso",
    "perfeito",
    "adorei",
    "amei",
    "incrível",
    "fantástico",
    "bom",
    "gostei",
    "recomendo",
  ];

  // Palavras negativas
  const negativeWords = [
    "péssimo",
    "horrível",
    "ruim",
    "terrível",
    "decepcionante",
    "decepção",
    "problema",
    "não gostei",
    "não recomendo",
    "insatisfeito",
    "desapontado",
  ];

  const positiveCount = positiveWords.filter((word) =>
    lowerComment.includes(word)
  ).length;
  const negativeCount = negativeWords.filter((word) =>
    lowerComment.includes(word)
  ).length;

  if (positiveCount > negativeCount) return "positive";
  if (negativeCount > positiveCount) return "negative";
  return "neutral";
}

/**
 * Calcula score de sentimento (0-1)
 */
async function calculateSentimentScore(comment: string): Promise<number> {
  const sentiment = await analyzeSentiment(comment);

  switch (sentiment) {
    case "positive":
      return 0.8;
    case "negative":
      return 0.2;
    default:
      return 0.5;
  }
}

/**
 * Atualiza rating médio do perfil
 */
async function updateProfileRating(profileId: number) {
  try {
    const db = await getDb();
    if (!db) return;

    // Buscar todos os reviews do perfil
    const profileReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.profileId, profileId));

    if (profileReviews.length === 0) return;

    // Calcular média
    const avgRating =
      profileReviews.reduce((sum, r) => sum + r.rating, 0) /
      profileReviews.length;

    // Atualizar perfil
    await db
      .update(profiles)
      .set({
        avgRating: parseFloat(avgRating.toFixed(2)),
        totalReviews: profileReviews.length,
      })
      .where(eq(profiles.id, profileId));
  } catch (error) {
    console.error("[Realtime Reviews] Error updating profile rating:", error);
  }
}

/**
 * Simula recebimento de webhooks (para testes)
 */
export async function simulateReviewWebhook(profileId: number) {
  const mockReviews: WebhookReviewData[] = [
    {
      profileId,
      googleReviewId: `review-${Date.now()}-1`,
      authorName: "Cliente Satisfeito",
      rating: 5,
      comment:
        "Excelente atendimento! Adorei o serviço, recomendo para todos!",
      createdAt: new Date(),
    },
    {
      profileId,
      googleReviewId: `review-${Date.now()}-2`,
      authorName: "Cliente Crítico",
      rating: 3,
      comment: "Bom, mas poderia melhorar em alguns aspectos.",
      createdAt: new Date(),
    },
    {
      profileId,
      googleReviewId: `review-${Date.now()}-3`,
      authorName: "Cliente Entusiasmado",
      rating: 5,
      comment: "Fantástico! Melhor experiência que já tive!",
      createdAt: new Date(),
    },
  ];

  const results = [];
  for (const review of mockReviews) {
    const result = await handleReviewWebhook(review);
    results.push(result);
  }

  return results;
}

/**
 * Obtém reviews recentes de um perfil
 */
export async function getRecentReviews(profileId: number, limit: number = 10) {
  try {
    const db = await getDb();
    if (!db) return [];

    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.profileId, profileId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[Realtime Reviews] Error fetching recent reviews:", error);
    return [];
  }
}

/**
 * Obtém estatísticas de reviews
 */
export async function getReviewStats(profileId: number) {
  try {
    const db = await getDb();
    if (!db) return null;

    const profileReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.profileId, profileId));

    if (profileReviews.length === 0) {
      return {
        totalReviews: 0,
        avgRating: 0,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
      };
    }

    const avgRating =
      profileReviews.reduce((sum, r) => sum + r.rating, 0) /
      profileReviews.length;

    const sentiments = profileReviews.reduce(
      (acc, r) => {
        if (r.sentiment === "positive") acc.positiveCount++;
        else if (r.sentiment === "negative") acc.negativeCount++;
        else acc.neutralCount++;
        return acc;
      },
      { positiveCount: 0, negativeCount: 0, neutralCount: 0 }
    );

    return {
      totalReviews: profileReviews.length,
      avgRating: parseFloat(avgRating.toFixed(2)),
      ...sentiments,
    };
  } catch (error) {
    console.error("[Realtime Reviews] Error calculating stats:", error);
    return null;
  }
}
