export const ENV = {
  appId: "gbp-analyzer",
  cookieSecret: process.env.JWT_SECRET ?? "gbp-analyzer-secret",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
