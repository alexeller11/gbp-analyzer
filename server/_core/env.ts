export const ENV = {
  appId: "gbp-analyzer",
  cookieSecret: process.env.JWT_SECRET ?? "gbp-analyzer-secret",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
