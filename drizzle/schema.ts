import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  boolean,
  float
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Google Business Profiles
 */
export const profiles = mysqlTable("profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  googleAccountId: varchar("googleAccountId", { length: 255 }).notNull(),
  googleLocationId: varchar("googleLocationId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  website: varchar("website", { length: 255 }),
  category: varchar("category", { length: 255 }),
  description: text("description"),
  latitude: float("latitude").default(0),
  longitude: float("longitude").default(0),
  isVerified: boolean("isVerified").default(false),
  photoCount: int("photoCount").default(0),
  postCount: int("postCount").default(0),
  totalReviews: int("totalReviews").default(0),
  avgRating: float("avgRating").default(0),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

/**
 * Google Reviews
 */
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  googleReviewId: varchar("googleReviewId", { length: 255 }).notNull().unique(),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  authorPhoto: varchar("authorPhoto", { length: 255 }),
  rating: int("rating").notNull(),
  comment: text("comment"),
  reply: text("reply"),
  sentiment: varchar("sentiment", { length: 50 }),
  sentimentScore: float("sentimentScore"),
  publishedAt: timestamp("publishedAt").notNull(),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

/**
 * Daily Metrics
 */
export const metrics = mysqlTable("metrics", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  date: timestamp("date").notNull(),
  views: int("views").default(0),
  searches: int("searches").default(0),
  mapViews: int("mapViews").default(0),
  websiteClicks: int("websiteClicks").default(0),
  phoneCallClicks: int("phoneCallClicks").default(0),
  directionRequests: int("directionRequests").default(0),
  photoViews: int("photoViews").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

/**
 * Profile Scores
 */
export const scores = mysqlTable("scores", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  total: float("total").notNull(),
  completeness: float("completeness").notNull(),
  reviewScore: float("reviewScore").notNull(),
  engagement: float("engagement").notNull(),
  consistency: float("consistency").notNull(),
  mediaScore: float("mediaScore").notNull(),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type Score = typeof scores.$inferSelect;
export type InsertScore = typeof scores.$inferInsert;

/**
 * Keywords extracted from reviews
 */
export const keywords = mysqlTable("keywords", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  term: varchar("term", { length: 255 }).notNull(),
  frequency: int("frequency").default(1),
  sentiment: varchar("sentiment", { length: 50 }),
  source: varchar("source", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = typeof keywords.$inferInsert;

/**
 * Competitors
 */
export const competitors = mysqlTable("competitors", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  placeId: varchar("placeId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  rating: float("rating"),
  reviewCount: int("reviewCount"),
  category: varchar("category", { length: 255 }),
  distance: float("distance"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = typeof competitors.$inferInsert;

/**
 * Improvement Suggestions
 */
export const suggestions = mysqlTable("suggestions", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  priority: varchar("priority", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  impact: float("impact").default(0),
  isDone: boolean("isDone").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = typeof suggestions.$inferInsert;

/**
 * Chat Messages for AI Consultant
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Google OAuth Accounts
 */
export const googleAccounts = mysqlTable("googleAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  googleAccountId: varchar("googleAccountId", { length: 255 }).notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type InsertGoogleAccount = typeof googleAccounts.$inferInsert;


/**
 * Google OAuth Tokens - Armazena tokens de forma segura
 */
export const googleTokens = mysqlTable("google_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  googleAccountId: varchar("googleAccountId", { length: 255 }).notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

/**
 * Sincronização de Reviews - Armazena reviews sincronizados
 */
export const syncedReviews = mysqlTable("synced_reviews", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  googleReviewId: varchar("googleReviewId", { length: 255 }).notNull().unique(),
  authorName: varchar("authorName", { length: 255 }),
  rating: int("rating").default(0).notNull(),
  reviewText: text("reviewText"),
  reviewUrl: text("reviewUrl"),
  publishTime: timestamp("publishTime").notNull(),
  updateTime: timestamp("updateTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncedReview = typeof syncedReviews.$inferSelect;
export type InsertSyncedReview = typeof syncedReviews.$inferInsert;

/**
 * Sincronização de Insights - Armazena métricas e insights
 */
export const syncedInsights = mysqlTable("synced_insights", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  metricType: varchar("metricType", { length: 100 }).notNull(),
  value: int("value").default(0).notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncedInsight = typeof syncedInsights.$inferSelect;
export type InsertSyncedInsight = typeof syncedInsights.$inferInsert;

/**
 * Sincronização de Logs - Rastreia quando cada perfil foi sincronizado
 */
export const syncLogs = mysqlTable("sync_logs", {
  id: int("id").autoincrement().primaryKey(),
  profileId: int("profileId").notNull(),
  syncType: varchar("syncType", { length: 100 }).notNull(),
  status: mysqlEnum("status", ["pending", "success", "failed"]).default("pending"),
  message: text("message"),
  nextSyncAt: timestamp("nextSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;
