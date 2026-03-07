/**
 * Google Business Profile Reviews Sync
 * Sincroniza reviews reais da API do Google
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { syncedReviews, profiles } from "../drizzle/schema";

export interface GoogleReview {
  name: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
  };
  starRating: number;
  reviewText?: string;
  reviewLink?: string;
  publishTime?: string;
  updateTime?: string;
}

/**
 * Sincroniza reviews de um perfil específico
 */
export async function syncProfileReviews(
  accessToken: string,
  locationName: string,
  profileId: number
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Chamar API do Google para obter reviews
    const response = await fetch(
      `https://businessprofiles.googleapis.com/v1/${locationName}/reviews`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    const reviews: GoogleReview[] = data.reviews || [];

    // Salvar reviews no banco de dados
    const db = drizzle(process.env.DATABASE_URL!);
    let savedCount = 0;

    for (const review of reviews) {
      try {
        // Extrair ID do review da URL
        const reviewId = review.name.split("/").pop() || `review-${Date.now()}`;
        const publishTime = review.publishTime ? new Date(review.publishTime) : new Date();

        await db
          .insert(syncedReviews)
          .values({
            profileId,
            googleReviewId: reviewId,
            authorName: review.reviewer.displayName,
            rating: review.starRating,
            reviewText: review.reviewText || null,
            reviewUrl: review.reviewLink || null,
            publishTime,
            updateTime: review.updateTime ? new Date(review.updateTime) : null,
          })
          .onDuplicateKeyUpdate({
            set: {
              rating: review.starRating,
              reviewText: review.reviewText || null,
              updateTime: review.updateTime ? new Date(review.updateTime) : null,
            },
          });

        savedCount++;
      } catch (error) {
        console.error("Error saving review:", error);
      }
    }

    console.log(`[Sync] Sincronizados ${savedCount} reviews para perfil ${profileId}`);

    return { success: true, count: savedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing reviews:", error);
    return { success: false, count: 0, error: message };
  }
}

/**
 * Sincroniza reviews de todos os perfis do usuário
 */
export async function syncAllUserReviews(
  accessToken: string,
  userId: number
): Promise<{ success: boolean; totalCount: number; error?: string }> {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    // Obter todos os perfis do usuário
    const userProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));

    let totalCount = 0;

    for (const profile of userProfiles) {
      const result = await syncProfileReviews(
        accessToken,
        profile.googleLocationId,
        profile.id
      );

      if (result.success) {
        totalCount += result.count;
      }
    }

    return { success: true, totalCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing all reviews:", error);
    return { success: false, totalCount: 0, error: message };
  }
}

/**
 * Obter reviews sincronizados de um perfil
 */
export async function getProfileReviews(profileId: number) {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    const reviews = await db
      .select()
      .from(syncedReviews)
      .where(eq(syncedReviews.profileId, profileId));

    return reviews;
  } catch (error) {
    console.error("Error getting profile reviews:", error);
    return [];
  }
}
