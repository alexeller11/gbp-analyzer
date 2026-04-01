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
