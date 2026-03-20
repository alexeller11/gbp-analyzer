import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { systemRouter } from "./systemRouter";
import { publicProcedure, router, protectedProcedure } from "./trpc";
import { z } from "zod";

// Corrigido: caminhos agora apontam para a pasta 'server/'
import * as db from "../db"; 
import { callGroqAPI } from "../groq"; 
import { reviewsRouter, generateResponseProcedure } from "../reviews-router"; 
import { getGoogleOAuthUrl, refreshAccessToken } from "../google-oauth-tokens";
import { findPlaceFromUrl, getPlaceDetails, getNearbyCompetitors, getCompetitorDetails } from "../places-api";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function extractKeywords(text: string): string[] {
  const stopWords = new Set(["de", "da", "do", "em", "a", "o", "e", "que", "com", "para", "um", "uma", "os", "as", "se", "na", "no", "ao", "por", "foi", "são", "mais", "muito", "bem", "mas", "ou", "me", "meu", "sua", "seu"]);
  const words = text.toLowerCase().replace(/[^a-záéíóúãõâêôç\s]/g, " ").split(/\s+/);
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (w.length > 3 && !stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

function calcScore(p: {
  totalReviews?: number | null;
  avgRating?: number | null;
  photoCount?: number | null;
  postCount?: number | null;
  isVerified?: boolean | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  category?: string | null;
  name?: string | null;
}) {
  const completeness = Math.min(100,
    (p.name ? 15 : 0) + (p.address ? 15 : 0) + (p.phone ? 15 : 0) +
    (p.website ? 15 : 0) + (p.description ? 20 : 0) + (p.category ? 10 : 0) + (p.isVerified ? 10 : 0)
  );
  const reviewScore = Math.min(100,
    (Math.min(p.totalReviews ?? 0, 200) * 0.3) + ((p.avgRating ?? 0) * 14)
  );
  const engagement = Math.min(100,
    ((p.avgRating ?? 0) * 14) + (Math.min(p.totalReviews ?? 0, 100) * 0.3) + (Math.min(p.postCount ?? 0, 30) * 1.2)
  );
  const consistency = Math.min(100,
    ((p.avgRating ?? 0) * 12) + (p.isVerified ? 20 : 0) + (p.phone ? 12 : 0) + (p.website ? 12 : 0) + (p.description ? 8 : 0)
  );
  const mediaScore = Math.min(100,
    (Math.min(p.photoCount ?? 0, 60) * 1.1) + (Math.min(p.postCount ?? 0, 30) * 1.5)
  );
  const total = Math.round(completeness * 0.2 + reviewScore * 0.25 + engagement * 0.2 + consistency * 0.2 + mediaScore * 0.15);
  return { total, completeness, reviewScore, engagement, consistency, mediaScore };
}

async function getValidAccessToken(userId: number): Promise<string | null> {
  const tokenData = await db.getGoogleToken(userId);
  if (!tokenData) return null;

  const isExpired = tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date(Date.now() + 5 * 60 * 1000);

  if (isExpired && tokenData.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(tokenData.refreshToken);
      await db.storeGoogleToken(userId, tokenData.googleAccountId, refreshed.accessToken, tokenData.refreshToken,
        new Date(Date.now() + refreshed.expiresIn * 1000));
      return refreshed.accessToken;
    } catch (e) {
      console.error("[Token] Refresh failed:", e);
      return tokenData.accessToken;
    }
  }

  return tokenData.accessToken;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  reviews: reviewsRouter,
  reviewAI: router({
    generateResponse: generateResponseProcedure,
  }),
  profiles: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getProfilesByUserId(ctx.user.id);
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => db.getProfileById(input.id)),
    extractFromUrl: protectedProcedure
      .input(z.object({ url: z.string() }))
      .mutation(async ({ input }) => {
        if (!process.env.GOOGLE_PLACES_API_KEY) throw new Error("GOOGLE_PLACES_API_KEY não configurada");
        let placeId = input.url.startsWith("http") ? await findPlaceFromUrl(input.url) : null;
        if (!placeId) {
          const params = new URLSearchParams({ query: input.url, key: process.env.GOOGLE_PLACES_API_KEY, language: "pt-BR" });
          const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
          const data = await res.json();
          placeId = data.results?.[0]?.place_id || null;
        }
        if (!placeId) throw new Error("Negócio não encontrado.");
        const details = await getPlaceDetails(placeId);
        if (!details) throw new Error("Erro ao buscar detalhes.");
        return details;
      }),
    create: protectedProcedure
      .input(z.object({
        googleAccountId: z.string(), googleLocationId: z.string(), name: z.string(),
        address: z.string(), phone: z.string().optional(), website: z.string().optional(),
        category: z.string(), latitude: z.number(), longitude: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const profile = await db.createProfile(ctx.user.id, input);
        const s = calcScore(input);
        await db.createScore({ profileId: profile.id, ...s });
        return profile;
      }),
  }),
});

export type AppRouter = typeof appRouter;
