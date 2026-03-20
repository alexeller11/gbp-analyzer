import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { callGroqAPI } from "./groq";
import { reviewsRouter, generateResponseProcedure } from "./reviews-router";
import { getGoogleOAuthUrl, refreshAccessToken } from "./google-oauth-tokens";
import { findPlaceFromUrl, getPlaceDetails, getNearbyCompetitors, getCompetitorDetails } from "./places-api";

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

  scores: router({
    getLatest: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getLatestScore(input.profileId)),

    getByProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getScoreByProfileId(input.profileId)),
  }),

  suggestions: router({
    listByProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getSuggestionsByProfileId(input.profileId)),

    generate: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");

        const prompt = `Analise este perfil do Google Business e retorne EXATAMENTE um array JSON com 6 sugestões:
Perfil: ${profile.name} (${profile.category})
- Nota: ${profile.avgRating}/5 | Reviews: ${profile.totalReviews}
- Fotos: ${profile.photoCount} | Posts: ${profile.postCount}
- Verificado: ${profile.isVerified ? "Sim" : "Não"}
Retorne SOMENTE JSON válido:
[{"categoria":"string","titulo":"string","descricao":"dica prática em 1 frase","impacto":número_1_a_100,"prioridade":"alta"|"média"|"baixa"}]`;

        const resp = await callGroqAPI([
          { role: "system", content: "Você é especialista em Google Business Profile. Responda SOMENTE com JSON válido." },
          { role: "user", content: prompt },
        ]);

        const clean = resp.replace(/```json\n?|```/g, "").trim();
        const parsed = JSON.parse(clean);

        await db.deleteSuggestionsByProfileId(input.profileId);
        const results = [];
        for (const s of parsed) {
          const sug = await db.createSuggestion({
            profileId: input.profileId,
            category: s.categoria || "Geral",
            title: s.titulo,
            description: s.descricao,
            priority: s.prioridade === "alta" ? "high" : s.prioridade === "baixa" ? "low" : "medium",
            impact: s.impacto || 75,
          });
          results.push(sug);
        }
        return results;
      }),

    toggleDone: protectedProcedure
      .input(z.object({ id: z.number(), isDone: z.boolean() }))
      .mutation(async ({ input }) => {
        return db.updateSuggestion(input.id, { isDone: input.isDone });
      }),
  }),

  chat: router({
    sendMessage: protectedProcedure
      .input(z.object({ profileId: z.number(), message: z.string() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");

        const system = `Você é um consultor especialista em Google Business Profile. Responda de forma prática.
Perfil: ${profile.name} | Nota: ${profile.avgRating}/5 | Reviews: ${profile.totalReviews}`;

        const reply = await callGroqAPI([
          { role: "system", content: system },
          { role: "user", content: input.message },
        ]);

        return { success: true, message: reply };
      }),
  }),

  competitors: router({
    getByProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getCompetitorsByProfileId(input.profileId)),

    searchByName: protectedProcedure
      .input(z.object({ query: z.string(), profileId: z.number() }))
      .mutation(async ({ input }) => {
        const key = process.env.GOOGLE_PLACES_API_KEY;
        if (!key) throw new Error("GOOGLE_PLACES_API_KEY não configurada");

        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input.query)}&key=${key}&language=pt-BR`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "OK" || !data.results?.length) throw new Error("Nenhum negócio encontrado.");

        return data.results.slice(0, 5).map((p: any) => ({
          placeId: p.place_id,
          name: p.name,
          address: p.formatted_address || p.vicinity,
          rating: p.rating,
          reviewCount: p.user_ratings_total,
          category: p.types?.[0]?.replace(/_/g, " ") || "Negócio",
        }));
      }),

    addByPlaceId: protectedProcedure
      .input(z.object({ profileId: z.number(), placeId: z.string() }))
      .mutation(async ({ input }) => {
        const details = await getPlaceDetails(input.placeId);
        if (!details) throw new Error("Não foi possível buscar detalhes do concorrente.");
        return db.createCompetitor({
          profileId: input.profileId,
          placeId: input.placeId,
          name: details.name,
          address: details.address,
          rating: details.rating,
          reviewCount: details.totalReviews,
          category: details.category,
        });
      }),

    remove: protectedProcedure
      .input(z.object({ competitorId: z.number() }))
      .mutation(async ({ input }) => {
        const db2 = await import("./db");
        const drizzleDb = await db2.getDb();
        const { competitors: compTable } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        if (drizzleDb) await drizzleDb.delete(compTable).where(eq(compTable.id, input.competitorId));
        return { success: true };
      }),
  }),

  sync: router({
    syncFromPlaces: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        
        const details = await getPlaceDetails(profile.googleLocationId);
        if (!details) throw new Error("Não foi possível buscar dados do Google.");

        await db.updateProfile(input.profileId, {
          totalReviews: details.totalReviews,
          avgRating: details.rating,
          lastSyncAt: new Date(),
        });

        const updated = await db.getProfileById(input.profileId);
        if (updated) {
          const s = calcScore(updated);
          await db.createScore({ profileId: input.profileId, ...s });
        }
        return { success: true };
      }),
  }),

  geoGrid: router({
    scan: protectedProcedure
      .input(z.object({ profileId: z.number(), keyword: z.string() }))
      .mutation(async ({ input }) => {
        // --- TRAVA DE CUSTO: Verifica se já houve scan nas últimas 24 horas ---
        const lastScan = await db.getLastGeoGridScan(input.profileId);
        if (lastScan) {
          const hoursSince = (Date.now() - new Date(lastScan.createdAt).getTime()) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            throw new Error(`Limite atingido. Tente novamente em ${Math.ceil(24 - hoursSince)}h.`);
          }
        }

        const profile = await db.getProfileById(input.profileId);
        if (!profile || !profile.latitude || !profile.longitude) throw new Error("Perfil sem localização válida.");

        const key = process.env.GOOGLE_PLACES_API_KEY;
        if (!key) throw new Error("Chave de API não configurada.");

        const centerLat = profile.latitude;
        const centerLng = profile.longitude;
        const GRID = 5; // 5x5 = 25 chamadas
        const STEP_KM = 0.5;
        const latStep = STEP_KM / 111;
        const lngStep = STEP_KM / (111 * Math.cos((centerLat * Math.PI) / 180));
        const offset = Math.floor(GRID / 2);

        const points: { lat: number; lng: number; rank: number | null }[] = [];

        for (let row = 0; row < GRID; row++) {
          for (let col = 0; col < GRID; col++) {
            const lat = centerLat + (offset - row) * latStep;
            const lng = centerLng + (col - offset) * lngStep;

            try {
              const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(input.keyword)}&location=${lat},${lng}&radius=2000&key=${key}&language=pt-BR`;
              const res = await fetch(url);
              const data = await res.json();

              if (data.status === "OVER_QUERY_LIMIT") throw new Error("Limite de cota do Google atingido.");

              const results: any[] = data.results || [];
              const idx = results.findIndex(r => 
                r.place_id === profile.googleLocationId || 
                r.name?.toLowerCase().includes(profile.name.toLowerCase().split(" ")[0])
              );

              points.push({ lat, lng, rank: idx >= 0 ? idx + 1 : null });
            } catch (e) {
              points.push({ lat, lng, rank: null });
            }
            await new Promise(r => setTimeout(r, 200)); // Delay para evitar rate limit
          }
        }

        const found = points.filter(p => p.rank !== null);
        const avgRank = found.length > 0 ? found.reduce((s, p) => s + (p.rank || 0), 0) / found.length : null;
        const top3Pct = Math.round((points.filter(p => p.rank !== null && (p.rank || 0) <= 3).length / points.length) * 100);

        await db.saveGeoGridScan({
          profileId: input.profileId,
          keyword: input.keyword,
          avgRank,
          top3Pct,
          pointsJson: JSON.stringify(points),
        });

        return { points, keyword: input.keyword, avgRank, top3Pct };
      }),
  }),

  report: router({
    generate: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        const reviews = await db.getReviewsByProfileId(input.profileId);
        
        const prompt = `Gere um relatório SEO local para "${profile.name}". Nota: ${profile.avgRating}, Reviews: ${profile.totalReviews}. Responda apenas JSON.`;

        const raw = await callGroqAPI([
          { role: "system", content: "Você é um consultor sênior de SEO local. Responda APENAS JSON." },
          { role: "user", content: prompt },
        ]);
        const clean = raw.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(clean);
      }),
  }),

  scoreHistory: router({
    getByProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getScoreHistory(input.profileId, 16)),
  }),

  alerts: router({
    saveSettings: protectedProcedure
      .input(z.object({ webhookUrl: z.string().optional(), emailAlerts: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.upsertAlertSettings(ctx.user.id, input);
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
