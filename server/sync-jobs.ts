/**
 * Automatic Sync Jobs
 * Sincroniza dados do Google Business Profile periodicamente
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, lt } from "drizzle-orm";
import { profiles, syncLogs, googleTokens } from "../drizzle/schema";
import { syncProfileReviews } from "./sync-reviews";
import { syncProfileInsights } from "./sync-insights";

type SyncType = "reviews" | "insights" | "posts" | "full";

/**
 * Registra um log de sincronização
 */
export async function logSync(
  profileId: number,
  syncType: SyncType,
  status: "pending" | "success" | "failed",
  message?: string,
  nextSyncAt?: Date
) {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    await db.insert(syncLogs).values({
      profileId,
      syncType,
      status,
      message: message || null,
      nextSyncAt: nextSyncAt || null,
    });
  } catch (error) {
    console.error("Error logging sync:", error);
  }
}

/**
 * Sincroniza reviews de um perfil
 */
export async function syncReviewsJob(profileId: number) {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    // Obter perfil
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile.length) {
      throw new Error("Profile not found");
    }

    // Obter token do usuário
    const token = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, profile[0].userId))
      .limit(1);

    if (!token.length || !token[0].accessToken) {
      throw new Error("No valid token found");
    }

    // Sincronizar reviews
    const result = await syncProfileReviews(
      token[0].accessToken,
      profile[0].googleLocationId,
      profileId
    );

    if (result.success) {
      // Próxima sincronização em 1 hora
      const nextSync = new Date(Date.now() + 60 * 60 * 1000);
      await logSync(profileId, "reviews", "success", `Synced ${result.count} reviews`, nextSync);
    } else {
      await logSync(profileId, "reviews", "failed", result.error);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSync(profileId, "reviews", "failed", message);
    console.error("Error in sync reviews job:", error);
    throw error;
  }
}

/**
 * Sincroniza insights de um perfil
 */
export async function syncInsightsJob(profileId: number) {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    // Obter perfil
    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile.length) {
      throw new Error("Profile not found");
    }

    // Obter token do usuário
    const token = await db
      .select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, profile[0].userId))
      .limit(1);

    if (!token.length || !token[0].accessToken) {
      throw new Error("No valid token found");
    }

    // Sincronizar insights
    const result = await syncProfileInsights(
      token[0].accessToken,
      profile[0].googleLocationId,
      profileId
    );

    if (result.success) {
      // Próxima sincronização em 6 horas
      const nextSync = new Date(Date.now() + 6 * 60 * 60 * 1000);
      await logSync(profileId, "insights", "success", "Insights synced", nextSync);
    } else {
      await logSync(profileId, "insights", "failed", result.error);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSync(profileId, "insights", "failed", message);
    console.error("Error in sync insights job:", error);
    throw error;
  }
}

/**
 * Sincroniza tudo (reviews + insights) de um perfil
 */
export async function syncFullJob(profileId: number) {
  try {
    await logSync(profileId, "full", "pending", "Starting full sync");

    // Sincronizar reviews
    await syncReviewsJob(profileId);

    // Sincronizar insights
    await syncInsightsJob(profileId);

    await logSync(profileId, "full", "success", "Full sync completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSync(profileId, "full", "failed", message);
    console.error("Error in full sync job:", error);
    throw error;
  }
}

/**
 * Executa sincronização para todos os perfis que precisam
 * (chamado periodicamente por um cron job ou scheduler)
 */
export async function runScheduledSyncs() {
  try {
    const db = drizzle(process.env.DATABASE_URL!);

    // Obter todos os perfis
    const allProfiles = await db.select().from(profiles);

    console.log(`[Scheduler] Running syncs for ${allProfiles.length} profiles`);

    for (const profile of allProfiles) {
      try {
        // Sincronizar reviews a cada 1 hora
        const reviewLog = await db
          .select()
          .from(syncLogs)
          .where(
            and(
              eq(syncLogs.profileId, profile.id),
              eq(syncLogs.syncType, "reviews")
            )
          )
          .orderBy(syncLogs.createdAt)
          .limit(1);

        if (reviewLog.length === 0 || (reviewLog[0].nextSyncAt && reviewLog[0].nextSyncAt < new Date())) {
          await syncReviewsJob(profile.id);
        }

        // Sincronizar insights a cada 6 horas
        const insightLog = await db
          .select()
          .from(syncLogs)
          .where(
            and(
              eq(syncLogs.profileId, profile.id),
              eq(syncLogs.syncType, "insights")
            )
          )
          .orderBy(syncLogs.createdAt)
          .limit(1);

        if (insightLog.length === 0 || (insightLog[0].nextSyncAt && insightLog[0].nextSyncAt < new Date())) {
          await syncInsightsJob(profile.id);
        }
      } catch (error) {
        console.error(`Error syncing profile ${profile.id}:`, error);
      }
    }

    console.log("[Scheduler] Scheduled syncs completed");
  } catch (error) {
    console.error("Error running scheduled syncs:", error);
  }
}

/**
 * Inicia o scheduler de sincronização
 * Executa a cada 5 minutos
 */
export function startSyncScheduler() {
  console.log("[Scheduler] Starting sync scheduler...");

  // Executar imediatamente
  runScheduledSyncs();

  // Executar a cada 5 minutos
  setInterval(() => {
    runScheduledSyncs();
  }, 5 * 60 * 1000);

  console.log("[Scheduler] Sync scheduler started (runs every 5 minutes)");
}
