import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../drizzle/schema';
import { encrypt, decrypt } from './_core/crypto';

// Otimiza a ligação serverless ao Neon
neonConfig.fetchConnectionCache = true;

let dbInstance: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL não encontrada");
    const sql = neon(databaseUrl);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

// --- USERS & AUTH ---
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  const res = await db.select().from(schema.users).where(eq(schema.users.openId, openId)).limit(1);
  return res[0] || null;
}

export async function upsertUser(data: { openId: string, name: string | null, email: string | null, loginMethod: string, lastSignedIn: Date }) {
  const db = await getDb();
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db.update(schema.users).set({ ...data, updatedAt: new Date() }).where(eq(schema.users.id, existing.id));
    return existing;
  }
  const res = await db.insert(schema.users).values({ ...data, role: 'user' }).returning();
  return res[0];
}

export async function storeGoogleToken(userId: number, googleAccountId: string, accessToken: string, refreshToken?: string, expiresAt?: Date) {
  const db = await getDb();
  await db.delete(schema.googleTokens).where(eq(schema.googleTokens.userId, userId));
  await db.insert(schema.googleTokens).values({
    userId,
    googleAccountId,
    accessToken: encrypt(accessToken),
    refreshToken: refreshToken ? encrypt(refreshToken) : null,
    expiresAt: expiresAt || null,
    scope: "https://www.googleapis.com/auth/business.manage",
  });
}

export async function getGoogleToken(userId: number) {
  const db = await getDb();
  const res = await db.select().from(schema.googleTokens).where(eq(schema.googleTokens.userId, userId)).limit(1);
  const token = res[0] || null;
  if (token) {
    token.accessToken = decrypt(token.accessToken);
    if (token.refreshToken) token.refreshToken = decrypt(token.refreshToken);
  }
  return token;
}

// --- PROFILES ---
export async function getProfilesByUserId(userId: number) {
  const db = await getDb();
  return await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
}

export async function getProfileById(id: number) {
  const db = await getDb();
  const res = await db.select().from(schema.profiles).where(eq(schema.profiles.id, id)).limit(1);
  return res[0] || null;
}

export async function createProfile(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.profiles).values(data).returning();
  return res[0];
}

export async function updateProfile(id: number, data: any) {
  const db = await getDb();
  await db.update(schema.profiles).set({ ...data, updatedAt: new Date() }).where(eq(schema.profiles.id, id));
  return getProfileById(id);
}

export async function deleteProfile(id: number) {
  const db = await getDb();
  await db.delete(schema.profiles).where(eq(schema.profiles.id, id));
}

// --- SCORES ---
export async function getLatestScore(profileId: number) {
  const db = await getDb();
  const res = await db.select().from(schema.scores).where(eq(schema.scores.profileId, profileId)).orderBy(desc(schema.scores.calculatedAt)).limit(1);
  return res[0] || null;
}
export const getScoreByProfileId = getLatestScore;

export async function createScore(data: any) {
  const db = await getDb();
  await db.delete(schema.scores).where(eq(schema.scores.profileId, data.profileId));
  const res = await db.insert(schema.scores).values(data).returning();
  return res[0];
}

// --- REVIEWS ---
export async function getReviewsByProfileId(profileId: number) {
  const db = await getDb();
  return await db.select().from(schema.reviews).where(eq(schema.reviews.profileId, profileId)).orderBy(desc(schema.reviews.publishedAt));
}

export async function createReview(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.reviews).values(data).onConflictDoNothing({ target: schema.reviews.googleReviewId }).returning();
  return res[0];
}

// --- COMPETITORS ---
export async function getCompetitorsByProfileId(profileId: number) {
  const db = await getDb();
  return await db.select().from(schema.competitors).where(eq(schema.competitors.profileId, profileId));
}

export async function createCompetitor(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.competitors).values(data).returning();
  return res[0];
}

// --- SUGGESTIONS ---
export async function getSuggestionsByProfileId(profileId: number) {
  const db = await getDb();
  return await db.select().from(schema.suggestions).where(eq(schema.suggestions.profileId, profileId));
}

export async function deleteSuggestionsByProfileId(profileId: number) {
  const db = await getDb();
  await db.delete(schema.suggestions).where(eq(schema.suggestions.profileId, profileId));
}

export async function createSuggestion(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.suggestions).values(data).returning();
  return res[0];
}

export async function updateSuggestion(id: number, data: any) {
  const db = await getDb();
  await db.update(schema.suggestions).set({ ...data, updatedAt: new Date() }).where(eq(schema.suggestions.id, id));
}

// --- METRICS ---
export async function getMetricsByProfileId(profileId: number) {
  const db = await getDb();
  return await db.select().from(schema.metrics).where(eq(schema.metrics.profileId, profileId)).orderBy(desc(schema.metrics.date));
}

// --- GEO GRID ---
export async function getLastGeoGridScan(profileId: number) {
  const db = await getDb();
  const res = await db.select().from(schema.geoGridHistory).where(eq(schema.geoGridHistory.profileId, profileId)).orderBy(desc(schema.geoGridHistory.scannedAt)).limit(1);
  return res[0] || null;
}

export async function saveGeoGridScan(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.geoGridHistory).values(data).returning();
  return res[0];
}

export async function getGeoGridHistory(profileId: number, keyword?: string, limit = 10) {
  const db = await getDb();
  let query = db.select().from(schema.geoGridHistory).where(eq(schema.geoGridHistory.profileId, profileId));
  if (keyword) {
    query = db.select().from(schema.geoGridHistory).where(and(eq(schema.geoGridHistory.profileId, profileId), eq(schema.geoGridHistory.keyword, keyword)));
  }
  return await query.orderBy(desc(schema.geoGridHistory.scannedAt)).limit(limit);
}

// --- HISTORY & ALERTS ---
export async function getScoreHistory(profileId: number, limit = 16) {
  const db = await getDb();
  return await db.select().from(schema.scoreHistory).where(eq(schema.scoreHistory.profileId, profileId)).orderBy(desc(schema.scoreHistory.snapshotAt)).limit(limit);
}

export async function saveScoreSnapshot(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.scoreHistory).values(data).returning();
  return res[0];
}

export async function getAlertSettings(userId: number) {
  const db = await getDb();
  const res = await db.select().from(schema.alertSettings).where(eq(schema.alertSettings.userId, userId)).limit(1);
  return res[0] || null;
}

export async function upsertAlertSettings(userId: number, data: any) {
  const db = await getDb();
  const existing = await getAlertSettings(userId);
  if (existing) {
    await db.update(schema.alertSettings).set({ ...data, updatedAt: new Date() }).where(eq(schema.alertSettings.userId, userId));
    return;
  }
  await db.insert(schema.alertSettings).values({ userId, ...data });
}

export async function savePublicReport(data: any) {
  const db = await getDb();
  const res = await db.insert(schema.publicReports).values(data).returning();
  return res[0];
}

export async function getPublicReportByToken(token: string) {
  const db = await getDb();
  const res = await db.select().from(schema.publicReports).where(eq(schema.publicReports.token, token)).limit(1);
  return res[0] || null;
}
