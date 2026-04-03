import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: text("open_id").notNull().unique(),
    email: text("email").notNull().unique(),
    name: text("name"),
    picture: text("picture"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    openIdIdx: uniqueIndex("users_open_id_idx").on(t.openId),
    emailIdx: uniqueIndex("users_email_idx").on(t.email)
  })
);

export const googleConnections = pgTable(
  "google_connections",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    googleUserId: text("google_user_id").notNull(),
    googleEmail: text("google_email").notNull(),
    googleName: text("google_name"),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    scope: text("scope"),
    expiresAt: timestamp("expires_at"),
    googleBusinessConnected: boolean("google_business_connected").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    googleUserIdIdx: uniqueIndex("google_connections_google_user_id_idx").on(t.googleUserId),
    userIdIdx: index("google_connections_user_id_idx").on(t.userId)
  })
);

export const gbpAccounts = pgTable(
  "gbp_accounts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    googleConnectionId: integer("google_connection_id").notNull(),
    googleAccountName: text("google_account_name").notNull(),
    accountId: text("account_id").notNull(),
    accountDisplayName: text("account_display_name"),
    accountType: text("account_type"),
    rawJson: jsonb("raw_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    googleAccountNameIdx: uniqueIndex("gbp_accounts_google_account_name_idx").on(t.googleAccountName),
    userIdIdx: index("gbp_accounts_user_id_idx").on(t.userId)
  })
);

export const businesses = pgTable(
  "businesses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    source: text("source").default("google_import").notNull(),
    status: text("status").default("active").notNull(),
    leadType: text("lead_type").default("client").notNull(),
    score: integer("score").default(0).notNull(),
    priorityLevel: text("priority_level").default("low").notNull(),
    priorityReason: text("priority_reason"),
    aiSummary: text("ai_summary"),
    notes: text("notes"),
    name: text("name").notNull(),
    primaryCategory: text("primary_category"),
    city: text("city"),
    state: text("state"),
    phone: text("phone"),
    website: text("website"),
    googleLocationKey: text("google_location_key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    googleLocationKeyIdx: uniqueIndex("businesses_google_location_key_idx").on(t.googleLocationKey),
    userIdIdx: index("businesses_user_id_idx").on(t.userId)
  })
);

export const gbpLocations = pgTable(
  "gbp_locations",
  {
    id: serial("id").primaryKey(),
    businessId: integer("business_id").notNull(),
    userId: integer("user_id").notNull(),
    gbpAccountId: integer("gbp_account_id").notNull(),
    googleLocationName: text("google_location_name").notNull(),
    locationId: text("location_id").notNull(),
    title: text("title").notNull(),
    storeCode: text("store_code"),
    languageCode: text("language_code"),
    verificationState: text("verification_state"),
    isVerified: boolean("is_verified").default(false).notNull(),
    metadataJson: jsonb("metadata_json"),
    profileJson: jsonb("profile_json"),
    lastImportedAt: timestamp("last_imported_at"),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  (t) => ({
    googleLocationNameIdx: uniqueIndex("gbp_locations_google_location_name_idx").on(t.googleLocationName),
    businessIdIdx: index("gbp_locations_business_id_idx").on(t.businessId),
    userIdIdx: index("gbp_locations_user_id_idx").on(t.userId)
  })
);
