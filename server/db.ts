import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  InsertUser,
  users, profiles, reviews, metrics, scores, keywords,
  competitors, suggestions, chatMessages, googleAccounts,
  scoreHistory, geoGridHistory, publicReports, alertSettings,
  type Profile, type Review, type Score, type Suggestion,
  type ChatMessage, type GoogleAccount, type Keyword,
  type Competitor, type Metric, type ScoreHistory, type GeoGridHistory,
  type PublicReport, type AlertSetting
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      _db = drizzle(sql);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assign = (field: TextField) => {
      if (user[field] === undefined) return;
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    };
    textFields.forEach(assign);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values)
      .onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export async function getProfilesByUserId(userId: number): Promise<Profile[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(profiles).where(eq(profiles.userId, userId));
}

export async function getProfileById(profileId: number): Promise<Profile | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return result[0];
}

export async function createProfile(profile: typeof profiles.$inferInsert): Promise<Profile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(profiles).values(profile).returning();
  if (!result[0]) throw new Error("Failed to create profile");
  return result[0];
}

export async function updateProfile(profileId: number, data: Partial<typeof profiles.$inferInsert>): Promise<Profile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(profiles).set(data).where(eq(profiles.id, profileId)).returning();
  if (!result[0]) throw new Error("Failed to update profile");
  return result[0];
}

// ─── Review ───────────────────────────────────────────────────────────────────
export async function getReviewsByProfileId(profileId: number): Promise<Review[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviews)
    .where(eq(reviews.profileId, profileId))
    .orderBy(desc(reviews.publishedAt));
}

export async function createReview(review: typeof reviews.$inferInsert): Promise<Review> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert: ignora conflito no googleReviewId único
  const result = await db.insert(reviews).values(review)
    .onConflictDoNothing({ target: reviews.googleReviewId })
    .returning();
  if (result[0]) return result[0];
  // Se já existia, busca o existente
  const existing = await db.select().from(reviews)
    .where(eq(reviews.googleReviewId, review.googleReviewId as string)).limit(1);
  if (!existing[0]) throw new Error("Failed to create review");
  return existing[0];
}

// ─── Score ────────────────────────────────────────────────────────────────────
export async function getLatestScore(profileId: number): Promise<Score | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scores)
    .where(eq(scores.profileId, profileId))
    .orderBy(desc(scores.calculatedAt)).limit(1);
  return result[0];
}

export async function getScoreByProfileId(profileId: number): Promise<Score | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(scores).where(eq(scores.profileId, profileId)).limit(1);
    return result[0] ?? null;
  } catch (e) {
    console.error("[DB] getScore error:", e);
    return null;
  }
}

export async function createScore(score: typeof scores.$inferInsert): Promise<Score> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Deleta score anterior e insere novo com RETURNING
  await db.delete(scores).where(eq(scores.profileId, score.profileId as number));
  const result = await db.insert(scores).values(score).returning();
  if (!result[0]) throw new Error("Failed to create score");
  return result[0];
}

// ─── Keyword ──────────────────────────────────────────────────────────────────
export async function getKeywordsByProfileId(profileId: number): Promise<Keyword[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(keywords)
    .where(eq(keywords.profileId, profileId))
    .orderBy(desc(keywords.frequency));
}

export async function createKeyword(keyword: typeof keywords.$inferInsert): Promise<Keyword> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(keywords).values(keyword).returning();
  if (!result[0]) throw new Error("Failed to create keyword");
  return result[0];
}

// ─── Competitor ───────────────────────────────────────────────────────────────
export async function getCompetitorsByProfileId(profileId: number): Promise<Competitor[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(competitors).where(eq(competitors.profileId, profileId));
}

export async function createCompetitor(competitor: typeof competitors.$inferInsert): Promise<Competitor> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert por profileId+placeId
  const existing = await db.select().from(competitors)
    .where(and(eq(competitors.profileId, competitor.profileId as number), eq(competitors.placeId, competitor.placeId)))
    .limit(1);
  if (existing[0]) {
    const updated = await db.update(competitors).set(competitor)
      .where(eq(competitors.id, existing[0].id)).returning();
    return updated[0];
  }
  const result = await db.insert(competitors).values(competitor).returning();
  if (!result[0]) throw new Error("Failed to create competitor");
  return result[0];
}

// ─── Suggestion ───────────────────────────────────────────────────────────────
export async function getSuggestionsByProfileId(profileId: number): Promise<Suggestion[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suggestions)
    .where(eq(suggestions.profileId, profileId))
    .orderBy(desc(suggestions.priority));
}

export async function updateSuggestion(id: number, data: Partial<typeof suggestions.$inferInsert>): Promise<Suggestion> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(suggestions).set(data).where(eq(suggestions.id, id)).returning();
  if (!result[0]) throw new Error("Failed to update suggestion");
  return result[0];
}

export async function createSuggestion(suggestion: typeof suggestions.$inferInsert): Promise<Suggestion> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(suggestions).values(suggestion).returning();
  if (!result[0]) throw new Error("Failed to create suggestion");
  return result[0];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export async function getChatMessagesByProfileId(profileId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(chatMessages)
    .where(eq(chatMessages.profileId, profileId))
    .orderBy(chatMessages.createdAt);
}

export async function createChatMessage(message: typeof chatMessages.$inferInsert): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatMessages).values(message).returning();
  if (!result[0]) throw new Error("Failed to create chat message");
  return result[0];
}

// ─── Google Account ───────────────────────────────────────────────────────────
export async function getGoogleAccountByUserId(userId: number): Promise<GoogleAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(googleAccounts)
    .where(eq(googleAccounts.userId, userId)).limit(1);
  return result[0];
}

export async function createOrUpdateGoogleAccount(account: typeof googleAccounts.$inferInsert): Promise<GoogleAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(googleAccounts).values(account)
    .onConflictDoUpdate({ target: googleAccounts.googleAccountId, set: account })
    .returning();
  if (!result[0]) throw new Error("Failed to upsert google account");
  return result[0];
}

// ─── Metric ───────────────────────────────────────────────────────────────────
export async function getMetricsByProfileId(profileId: number): Promise<Metric[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(metrics)
    .where(eq(metrics.profileId, profileId))
    .orderBy(desc(metrics.date));
}

export async function createMetric(metric: typeof metrics.$inferInsert): Promise<Metric> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(metrics).values(metric).returning();
  if (!result[0]) throw new Error("Failed to create metric");
  return result[0];
}

// ─── Google Token ─────────────────────────────────────────────────────────────
export async function storeGoogleToken(
  userId: number, googleAccountId: string, accessToken: string,
  refreshToken?: string, expiresAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const { googleTokens } = await import("../drizzle/schema");
    // Sem depender de constraint: deleta o existente e insere novo
    await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
    await db.insert(googleTokens).values({
      userId, googleAccountId, accessToken,
      refreshToken: refreshToken || null,
      expiresAt: expiresAt || null,
      scope: "https://www.googleapis.com/auth/business.manage",
    });
  } catch (error) {
    console.error("[DB] storeGoogleToken error:", error);
    throw error;
  }
}

export async function getGoogleToken(userId: number) {
  const db = await getDb();
  if (!db) return null;
  try {
    const { googleTokens } = await import("../drizzle/schema");
    const result = await db.select().from(googleTokens)
      .where(eq(googleTokens.userId, userId)).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error("[DB] getGoogleToken error:", error);
    return null;
  }
}

export async function deleteProfile(profileId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(profiles).where(eq(profiles.id, profileId));
}

export async function deleteSuggestionsByProfileId(profileId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(suggestions).where(eq(suggestions.profileId, profileId));
}

// rebuild Wed Mar 11 13:25:27 UTC 2026

// ── Score History ──────────────────────────────────────────────
export async function saveScoreSnapshot(data: typeof scoreHistory.$inferInsert): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(scoreHistory).values(data);
}

export async function getScoreHistory(profileId: number, limit = 12): Promise<ScoreHistory[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scoreHistory)
    .where(eq(scoreHistory.profileId, profileId))
    .orderBy(desc(scoreHistory.snapshotAt))
    .limit(limit);
}

// ── Geo-Grid History ───────────────────────────────────────────
export async function saveGeoGridScan(data: typeof geoGridHistory.$inferInsert): Promise<GeoGridHistory> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(geoGridHistory).values(data).returning();
  return result[0];
}

export async function getGeoGridHistory(profileId: number, keyword?: string, limit = 10): Promise<GeoGridHistory[]> {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(geoGridHistory).where(
    keyword
      ? and(eq(geoGridHistory.profileId, profileId), eq(geoGridHistory.keyword, keyword))
      : eq(geoGridHistory.profileId, profileId)
  ).orderBy(desc(geoGridHistory.scannedAt)).limit(limit);
  return q;
}

// ── Public Reports ─────────────────────────────────────────────
export async function savePublicReport(data: typeof publicReports.$inferInsert): Promise<PublicReport> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Remove old reports for same profile
  await db.delete(publicReports).where(eq(publicReports.profileId, data.profileId as number));
  const result = await db.insert(publicReports).values(data).returning();
  return result[0];
}

export async function getPublicReportByToken(token: string): Promise<PublicReport | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(publicReports).where(eq(publicReports.token, token)).limit(1);
  return result[0];
}

// ── Alert Settings ─────────────────────────────────────────────
export async function getAlertSettings(userId: number): Promise<AlertSetting | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(alertSettings).where(eq(alertSettings.userId, userId)).limit(1);
  return result[0];
}

export async function upsertAlertSettings(userId: number, data: Partial<typeof alertSettings.$inferInsert>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getAlertSettings(userId);
  if (existing) {
    await db.update(alertSettings).set({ ...data, updatedAt: new Date() }).where(eq(alertSettings.userId, userId));
  } else {
    await db.insert(alertSettings).values({ userId, ...data });
  }
}
