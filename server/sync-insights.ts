/**
 * Google Business Profile Insights Sync
 * Sincroniza métricas e insights reais da API do Google
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { syncedInsights, profiles } from "../drizzle/schema";

export interface GoogleInsight {
  metric: string;
  totalValue: {
    value: string;
  };
}

/**
 * Sincroniza insights de um perfil específico
 */
export async function syncProfileInsights(
  accessToken: string,
  locationName: string,
  profileId: number
): Promise<{ success: boolean; metrics: Record<string, number>; error?: string }> {
  try {
    // Métricas que queremos sincronizar
    const metrics = [
      "BUSINESS_PROFILE_VIEWS",
      "BUSINESS_PROFILE_CLICKS_TO_WEBSITE",
      "BUSINESS_PROFILE_CLICKS_TO_CALL",
      "BUSINESS_PROFILE_CLICKS_TO_DIRECTION",
      "BUSINESS_PROFILE_PHOTOS_VIEWS",
      "BUSINESS_PROFILE_POSTS_VIEWS",
    ];

    const db = drizzle(process.env.DATABASE_URL!);
    const syncedMetrics: Record<string, number> = {};
    const now = new Date();

    for (const metric of metrics) {
      try {
        // Chamar API do Google para obter insights
        const response = await fetch(
          `https://businessprofiles.googleapis.com/v1/${locationName}/insights:search`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              locationNames: [locationName],
              metrics: [metric],
            }),
          }
        );

        if (!response.ok) {
          console.warn(`Failed to fetch ${metric}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const insights: GoogleInsight[] = data.locationInsights?.[0]?.insights || [];

        for (const insight of insights) {
          const value = Math.max(0, parseInt(insight.totalValue.value) || 0);
          syncedMetrics[metric] = value;

          // Mapear métrica para tipo legível
          let metricType = "unknown";
          if (metric.includes("VIEWS")) metricType = "views";
          else if (metric.includes("CLICKS")) metricType = "clicks";
          else if (metric.includes("PHOTOS")) metricType = "photos";
          else if (metric.includes("POSTS")) metricType = "posts";

          // Salvar no banco de dados
          await db.insert(syncedInsights).values({
            profileId,
            metricType,
            value,
            date: now,
          });
        }
      } catch (error) {
        console.error(`Error syncing metric ${metric}:`, error);
      }
    }

    console.log(
      `[Sync] Sincronizadas métricas para perfil ${profileId}:`,
      syncedMetrics
    );

    return { success: true, metrics: syncedMetrics };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing insights:", error);
    return { success: false, metrics: {}, error: message };
  }
}

/**
 * Sincroniza insights de todos os perfis do usuário
 */
export async function syncAllUserInsights(
  accessToken: string,
  userId: number
): Promise<{ success: boolean; profilesUpdated: number; error?: string }> {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    // Obter todos os perfis do usuário
    const userProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId));

    let profilesUpdated = 0;

    for (const profile of userProfiles) {
      const result = await syncProfileInsights(
        accessToken,
        profile.googleLocationId,
        profile.id
      );

      if (result.success) {
        profilesUpdated++;
      }
    }

    return { success: true, profilesUpdated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing all insights:", error);
    return { success: false, profilesUpdated: 0, error: message };
  }
}

/**
 * Obter insights sincronizados de um perfil
 */
export async function getProfileInsights(profileId: number) {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    const insights = await db
      .select()
      .from(syncedInsights)
      .where(eq(syncedInsights.profileId, profileId));

    // Agrupar por tipo de métrica
    const grouped: Record<string, number> = {};
    for (const insight of insights) {
      grouped[insight.metricType] = insight.value;
    }

    return grouped;
  } catch (error) {
    console.error("Error getting profile insights:", error);
    return {};
  }
}
