import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  profiles,
  reviews,
  metrics,
  scores,
  keywords,
  competitors,
  suggestions,
  chatMessages,
  googleAccounts,
  type Profile,
  type Review,
  type Score,
  type Suggestion,
  type ChatMessage,
  type GoogleAccount,
  type Keyword,
  type Competitor,
  type Metric
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Helper: select last inserted row via MAX(id) ─────────────────────────────
// TiDB Cloud serverless does NOT reliably return insertId. 
// We use MAX(id) filtered by profile/known field immediately after insert.
async function selectAfterInsert<T>(
  db: ReturnType<typeof drizzle>,
  table: any,
  whereField: any,
  whereValue: any
): Promise<T> {
  const rows = await db.select().from(table)
    .where(eq(whereField, whereValue))
    .orderBy(desc(table.id))
    .limit(1);
  if (!rows.length) throw new Error(`Row not found after insert (${String(whereField)} = ${whereValue})`);
  return rows[0] as T;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get user: database not available"); return undefined; }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
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
  return result.length > 0 ? result[0] : undefined;
}

export async function createProfile(profile: typeof profiles.$inferInsert): Promise<Profile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(profiles).values(profile);
  // Select by googleLocationId which is unique
  const created = await db.select().from(profiles)
    .where(eq(profiles.googleLocationId, profile.googleLocationId))
    .orderBy(desc(profiles.id)).limit(1);
  if (!created.length) throw new Error("Failed to create profile");
  return created[0];
}

export async function updateProfile(profileId: number, data: Partial<typeof profiles.$inferInsert>): Promise<Profile> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(profiles).set(data).where(eq(profiles.id, profileId));
  const updated = await getProfileById(profileId);
  if (!updated) throw new Error("Failed to update profile");
  return updated;
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

  // Evita duplicata
  if (review.googleReviewId) {
    const existing = await db.select().from(reviews)
      .where(eq(reviews.googleReviewId, review.googleReviewId)).limit(1);
    if (existing.length) return existing[0];
  }

  await db.insert(reviews).values(review);
  // Select by googleReviewId (unique) or by profileId+publishedAt
  if (review.googleReviewId) {
    const created = await db.select().from(reviews)
      .where(eq(reviews.googleReviewId, review.googleReviewId)).limit(1);
    if (created.length) return created[0];
  }
  // Fallback: most recent for this profile
  const created = await db.select().from(reviews)
    .where(eq(reviews.profileId, review.profileId as number))
    .orderBy(desc(reviews.id)).limit(1);
  if (!created.length) throw new Error("Failed to create review");
  return created[0];
}

// ─── Score ────────────────────────────────────────────────────────────────────
export async function getLatestScore(profileId: number): Promise<Score | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scores)
    .where(eq(scores.profileId, profileId))
    .orderBy(desc(scores.calculatedAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getScoreByProfileId(profileId: number): Promise<Score | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(scores).where(eq(scores.profileId, profileId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get score:", error);
    return null;
  }
}

export async function createScore(score: typeof scores.$inferInsert): Promise<Score> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // TiDB: upsert via onDuplicateKeyUpdate not possible (no unique on profileId).
  // Delete existing then insert new.
  try { await db.delete(scores).where(eq(scores.profileId, score.profileId as number)); } catch {}
  await db.insert(scores).values(score);

  // Select most recent score for this profile
  const created = await db.select().from(scores)
    .where(eq(scores.profileId, score.profileId as number))
    .orderBy(desc(scores.calculatedAt)).limit(1);
  if (!created.length) throw new Error("Failed to create score");
  return created[0];
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
  await db.insert(keywords).values(keyword);
  return await selectAfterInsert<Keyword>(db, keywords, keywords.profileId, keyword.profileId);
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

  // Evita duplicata por placeId + profileId
  const existing = await db.select().from(competitors)
    .where(and(eq(competitors.profileId, competitor.profileId as number), eq(competitors.placeId, competitor.placeId)))
    .limit(1);
  if (existing.length) {
    // Atualiza dados
    await db.update(competitors).set(competitor).where(eq(competitors.id, existing[0].id));
    return existing[0];
  }

  await db.insert(competitors).values(competitor);
  return await selectAfterInsert<Competitor>(db, competitors, competitors.profileId, competitor.profileId);
}

// ─── Suggestion ───────────────────────────────────────────────────────────────
export async function getSuggestionsByProfileId(profileId: number): Promise<Suggestion[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suggestions)
    .where(eq(suggestions.profileId, profileId))
    .orderBy(desc(suggestions.priority));
}

export async function updateSuggestion(suggestionId: number, data: Partial<typeof suggestions.$inferInsert>): Promise<Suggestion> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(suggestions).set(data).where(eq(suggestions.id, suggestionId));
  const updated = await db.select().from(suggestions).where(eq(suggestions.id, suggestionId)).limit(1);
  if (!updated.length) throw new Error("Failed to update suggestion");
  return updated[0];
}

export async function createSuggestion(suggestion: typeof suggestions.$inferInsert): Promise<Suggestion> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(suggestions).values(suggestion);
  return await selectAfterInsert<Suggestion>(db, suggestions, suggestions.profileId, suggestion.profileId);
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
  await db.insert(chatMessages).values(message);
  return await selectAfterInsert<ChatMessage>(db, chatMessages, chatMessages.profileId, message.profileId);
}

// ─── Google Account ───────────────────────────────────────────────────────────
export async function getGoogleAccountByUserId(userId: number): Promise<GoogleAccount | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(googleAccounts)
    .where(eq(googleAccounts.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrUpdateGoogleAccount(account: typeof googleAccounts.$inferInsert): Promise<GoogleAccount> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getGoogleAccountByUserId(account.userId);
  if (existing) {
    await db.update(googleAccounts).set(account).where(eq(googleAccounts.userId, account.userId));
    const updated = await getGoogleAccountByUserId(account.userId);
    if (!updated) throw new Error("Failed to update google account");
    return updated;
  } else {
    await db.insert(googleAccounts).values(account);
    return await selectAfterInsert<GoogleAccount>(db, googleAccounts, googleAccounts.userId, account.userId);
  }
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
  await db.insert(metrics).values(metric);
  return await selectAfterInsert<Metric>(db, metrics, metrics.profileId, metric.profileId);
}

// ─── Google Token ─────────────────────────────────────────────────────────────
export async function storeGoogleToken(
  userId: number, googleAccountId: string, accessToken: string,
  refreshToken?: string, expiresAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot store token: database not available"); return; }
  try {
    const { googleTokens } = await import("../drizzle/schema");
    await db.insert(googleTokens).values({
      userId, googleAccountId, accessToken,
      refreshToken: refreshToken || null,
      expiresAt: expiresAt || null,
      scope: "https://www.googleapis.com/auth/business.manage",
    }).onDuplicateKeyUpdate({
      set: { accessToken, refreshToken: refreshToken || null, expiresAt: expiresAt || null },
    });
  } catch (error) {
    console.error("[Database] Failed to store token:", error);
    throw error;
  }
}

export async function getGoogleToken(userId: number) {
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot get token: database not available"); return null; }
  try {
    const { googleTokens } = await import("../drizzle/schema");
    const result = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get token:", error);
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
