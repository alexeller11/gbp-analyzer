import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies"; // Ficheiro na mesma pasta
import { systemRouter } from "./systemRouter"; // Ficheiro na mesma pasta
import { publicProcedure, router, protectedProcedure } from "./trpc"; // Ficheiro na mesma pasta
import { z } from "zod";

// IMPORTANTE: Adicionado "../" para subir uma pasta e encontrar os ficheiros corretamente na Render
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

/* ─── Router ──────────────────────────────────────────────────────── */

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
        if (!process.env.GOOGLE_PLACES_API_KEY) {
          throw new Error("GOOGLE_PLACES_API_KEY não configurada no servidor");
        }

        let placeId: string | null = null;

        if (input.url.startsWith("http")) {
          placeId = await findPlaceFromUrl(input.url);
        } else {
          const key = process.env.GOOGLE_PLACES_API_KEY;
          const params = new URLSearchParams({ query: input.url, key, language: "pt-BR" });
          const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
          const data = await res.json();
          placeId = data.results?.[0]?.place_id || null;
        }

        if (!placeId) throw new Error("Negócio não encontrado. Tente ser mais específico.");

        const details = await getPlaceDetails(placeId);
        if (!details) throw new Error("Negócio encontrado mas não foi possível buscar os detalhes.");

        const categoryMap: Record<string, string> = {
          restaurant: "Restaurante", gym: "Academia", hospital: "Hospital",
          dentist: "Clínica Odontológica", pharmacy: "Farmácia", lodging: "Hotel/Pousada",
          supermarket: "Supermercado", store: "Loja", beauty_salon: "Salão de Beleza",
          lawyer: "Escritório de Advocacia", accounting: "Contabilidade", school: "Escola",
          bar: "Bar", cafe: "Cafeteria", bakery: "Padaria", car_repair: "Oficina Mecânica",
          clothing_store: "Loja de Roupas", electronics_store: "Loja de Eletrônicos",
          hair_care: "Cabeleireiro", real_estate_agency: "Imobiliária",
          travel_agency: "Agência de Viagens", veterinary_care: "Clínica Veterinária",
        };

        const category = categoryMap[details.category] || details.category?.replace(/_/g, " ") || "Negócio";
        return { ...details, category };
      }),

    create: protectedProcedure
      .input(z.object({
        googleAccountId: z.string(),
        googleLocationId: z.string(),
        name: z.string(),
        address: z.string(),
        phone: z.string().optional(),
        website: z.string().optional(),
        category: z.string(),
        description: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        isVerified: z.boolean().optional(),
        totalReviews: z.number().optional(),
        avgRating: z.number().optional(),
        photoCount: z.number().optional(),
        postCount: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const profile = await db.createProfile({ userId: ctx.user.id, ...input });
        const s = calcScore({ ...input });
        await db.createScore({ profileId: profile.id, ...s });
        return profile;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const profile = await db.getProfileById(input.id);
        if (!profile || profile.userId !== ctx.user.id) throw new Error("Perfil não encontrado");
        await db.deleteProfile(input.id);
        return { success: true };
      }),
  }),

  // ... (outras rotas tRPC permanecem iguais)
});

export type AppRouter = typeof appRouter;
