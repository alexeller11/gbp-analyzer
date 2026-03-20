import { pgTable, serial, text, integer, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";

// 1. Usuários
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  openId: text("openId"),
  loginMethod: text("loginMethod"),
  role: text("role").default("user"),
  lastSignedIn: timestamp("lastSignedIn"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// 2. Perfis
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  googleAccountId: text("googleAccountId"),
  googleLocationId: text("googleLocationId"),
  name: text("name").notNull(),
  category: text("category"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  description: text("description"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  isVerified: boolean("isVerified").default(false),
  totalReviews: integer("totalReviews").default(0),
  avgRating: doublePrecision("avgRating").default(0),
  photoCount: integer("photoCount").default(0),
  postCount: integer("postCount").default(0),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// 3. Reviews
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  googleReviewId: text("googleReviewId").unique(),
  authorName: text("authorName"),
  authorPhoto: text("authorPhoto"),
  rating: integer("rating"),
  comment: text("comment"),
  reply: text("reply"),
  sentiment: text("sentiment"),
  sentimentScore: doublePrecision("sentimentScore"),
  publishedAt: timestamp("publishedAt"),
  repliedAt: timestamp("repliedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// 4. Concorrentes (Corrigido para não perder colunas)
export const competitors = pgTable("competitors", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  placeId: text("placeId"),
  name: text("name").notNull(),
  address: text("address"),
  rating: doublePrecision("rating"),
  reviewCount: integer("reviewCount"),
  category: text("category"),
  distance: doublePrecision("distance"),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// 5. Scores (Corrigido para não perder colunas)
export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  total: integer("total"),
  completeness: integer("completeness"),
  reviewScore: integer("reviewScore"),
  engagement: integer("engagement"),
  consistency: integer("consistency"),
  mediaScore: integer("mediaScore"),
  calculatedAt: timestamp("calculatedAt").defaultNow(),
});

// 6. Sugestões (Corrigido para não perder colunas)
export const suggestions = pgTable("suggestions", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  category: text("category"),
  priority: text("priority"),
  title: text("title"),
  description: text("description"),
  impact: integer("impact"),
  isDone: boolean("isDone").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// 7. Tokens Google
export const googleTokens = pgTable("google_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  googleAccountId: text("googleAccountId").notNull(),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// 8. Geo-Grid Scans (O objetivo final!)
export const geoGridScans = pgTable("geo_grid_scans", {
  id: serial("id").primaryKey(),
  profileId: integer("profileId").notNull(),
  keyword: text("keyword").notNull(),
  avgRank: doublePrecision("avgRank"),
  top3Pct: integer("top3Pct"),
  pointsJson: text("pointsJson"),
  createdAt: timestamp("createdAt").defaultNow(),
});