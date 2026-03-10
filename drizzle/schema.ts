import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  varchar,
  boolean,
  real,
  integer,
  serial,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "success", "failed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  googleAccountId: varchar("googleAccountId", { length: 255 }).notNull(),
  googleLocationId: varchar("googleLocationId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  website: varchar("website", { length: 255 }),
  category: varchar("category", { length: 255 }),
  description: text("description"),
  latitude: real("latitude").default(0),
  longitude: real("longitude").default(0),
  isVerified: boolean("isVerified").default(false),
  photoCount: integer("photoCount").default(0),
  postCount: integer("postCount").default(0),
  totalReviews: integer("totalReviews").default(0),
  avgRating: real("avgRating").default(0),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  googleReviewId: varchar("googleReviewId", { length: 255 }).notNull().unique(),
  authorName: varchar("authorName", { length: 255 }).notNull(),
  authorPhoto: varchar("authorPhoto", { length: 255 }),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  reply: text("reply"),
  sentiment: varchar("sentiment", { length: 50 }),
  sentimentScore: real("sentimentScore"),
  publishedAt: timestamp("publishedAt").notNull(),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export const metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  date: timestamp("date").notNull(),
  views: integer("views").default(0),
  searches: integer("searches").default(0),
  mapViews: integer("mapViews").default(0),
  websiteClicks: integer("websiteClicks").default(0),
  phoneCallClicks: integer("phoneCallClicks").default(0),
  directionRequests: integer("directionRequests").default(0),
  photoViews: integer("photoViews").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  total: real("total").notNull(),
  completeness: real("completeness").notNull(),
  reviewScore: real("reviewScore").notNull(),
  engagement: real("engagement").notNull(),
  consistency: real("consistency").notNull(),
  mediaScore: real("mediaScore").notNull(),
  calculatedAt: timestamp("calculatedAt").defaultNow().notNull(),
});

export type Score = typeof scores.$inferSelect;
export type InsertScore = typeof scores.$inferInsert;

export const keywords = pgTable("keywords", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  term: varchar("term", { length: 255 }).notNull(),
  frequency: integer("frequency").default(1),
  sentiment: varchar("sentiment", { length: 50 }),
  source: varchar("source", { length: 50 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Keyword = typeof keywords.$inferSelect;
export type InsertKeyword = typeof keywords.$inferInsert;

export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  placeId: varchar("placeId", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  rating: real("rating"),
  reviewCount: integer("reviewCount"),
  category: varchar("category", { length: 255 }),
  distance: real("distance"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Competitor = typeof competitors.$inferSelect;
export type InsertCompetitor = typeof competitors.$inferInsert;

export const suggestions = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  priority: varchar("priority", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  impact: real("impact").default(0),
  isDone: boolean("isDone").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Suggestion = typeof suggestions.$inferSelect;
export type InsertSuggestion = typeof suggestions.$inferInsert;

export const chatMessages = pgTable("chatMessages", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const googleAccounts = pgTable("googleAccounts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  googleAccountId: varchar("googleAccountId", { length: 255 }).notNull().unique(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type InsertGoogleAccount = typeof googleAccounts.$inferInsert;

export const googleTokens = pgTable("google_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  googleAccountId: varchar("googleAccountId", { length: 255 }).notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GoogleToken = typeof googleTokens.$inferSelect;
export type InsertGoogleToken = typeof googleTokens.$inferInsert;

export const syncedReviews = pgTable("synced_reviews", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  googleReviewId: varchar("googleReviewId", { length: 255 }).notNull().unique(),
  authorName: varchar("authorName", { length: 255 }),
  rating: integer("rating").default(0).notNull(),
  reviewText: text("reviewText"),
  reviewUrl: text("reviewUrl"),
  publishTime: timestamp("publishTime").notNull(),
  updateTime: timestamp("updateTime"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SyncedReview = typeof syncedReviews.$inferSelect;
export type InsertSyncedReview = typeof syncedReviews.$inferInsert;

export const syncedInsights = pgTable("synced_insights", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  metricType: varchar("metricType", { length: 100 }).notNull(),
  value: integer("value").default(0).notNull(),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SyncedInsight = typeof syncedInsights.$inferSelect;
export type InsertSyncedInsight = typeof syncedInsights.$inferInsert;

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  syncType: varchar("syncType", { length: 100 }).notNull(),
  status: syncStatusEnum("status").default("pending"),
  message: text("message"),
  nextSyncAt: timestamp("nextSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;
