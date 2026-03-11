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

  // Check if token is expired (with 5min buffer)
  const isExpired = tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date(Date.now() + 5 * 60 * 1000);

  if (isExpired && tokenData.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(tokenData.refreshToken);
      await db.storeGoogleToken(userId, tokenData.googleAccountId, refreshed.accessToken, tokenData.refreshToken,
        new Date(Date.now() + refreshed.expiresIn * 1000));
      return refreshed.accessToken;
    } catch (e) {
      console.error("[Token] Refresh failed:", e);
      return tokenData.accessToken; // try with existing
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

        // Se parece uma URL, tenta extrair place_id
        if (input.url.startsWith("http")) {
          placeId = await findPlaceFromUrl(input.url);
        } else {
          // Busca por texto/nome diretamente
          const key = process.env.GOOGLE_PLACES_API_KEY;
          const params = new URLSearchParams({ query: input.url, key, language: "pt-BR" });
          const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`);
          const data = await res.json();
          console.log("[Places] textsearch por nome:", data.status, data.results?.length, "results");
          placeId = data.results?.[0]?.place_id || null;
        }

        if (!placeId) throw new Error("Negócio não encontrado. Tente ser mais específico (ex: 'Pizzaria Dom João São Paulo').");

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
          establishment: "Estabelecimento", point_of_interest: "Ponto de Interesse",
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

        // Auto-calcular score imediatamente após criar
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
- Website: ${profile.website || "Não tem"} | Telefone: ${profile.phone || "Não tem"}
- Descrição: ${profile.description || "Não tem"}

Retorne SOMENTE JSON válido, sem texto antes/depois:
[{"categoria":"string","titulo":"string","descricao":"dica prática em 1 frase","impacto":número_1_a_100,"prioridade":"alta"|"média"|"baixa"}]`;

        const resp = await callGroqAPI([
          { role: "system", content: "Você é especialista em Google Business Profile. Responda SOMENTE com JSON válido." },
          { role: "user", content: prompt },
        ]);

        const clean = resp.replace(/```json\n?|```/g, "").trim();
        const parsed = JSON.parse(clean);

        // Deletar sugestões antigas e inserir novas
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

        const system = `Você é um consultor especialista em Google Business Profile. Responda em português, de forma prática e objetiva.

Perfil analisado:
- Nome: ${profile.name} | Categoria: ${profile.category}
- Endereço: ${profile.address} | Verificado: ${profile.isVerified ? "Sim" : "Não"}
- Avaliações: ${profile.totalReviews} (nota média: ${profile.avgRating}/5)
- Fotos: ${profile.photoCount} | Posts: ${profile.postCount}
- Website: ${profile.website || "não tem"} | Telefone: ${profile.phone || "não tem"}`;

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

    fetchReal: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");

        let lat = profile.latitude;
        let lng = profile.longitude;

        // Se não tem coordenadas, geocodifica pelo endereço
        if (!lat || !lng || lat === 0 || lng === 0) {
          if (profile.googleLocationId && !profile.googleLocationId.startsWith("manual_") && !profile.googleLocationId.startsWith("places_")) {
            // Busca coordenadas via place details
            const details = await getPlaceDetails(profile.googleLocationId);
            if (details?.lat && details?.lng) {
              lat = details.lat;
              lng = details.lng;
              await db.updateProfile(input.profileId, { latitude: lat, longitude: lng });
            }
          }
          if (!lat || !lng) {
            // Geocodifica pelo endereço
            const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(profile.address || profile.name)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            const loc = geoData.results?.[0]?.geometry?.location;
            if (loc) { lat = loc.lat; lng = loc.lng; await db.updateProfile(input.profileId, { latitude: lat, longitude: lng }); }
          }
          if (!lat || !lng) throw new Error("Não foi possível determinar a localização do perfil. Verifique o endereço.");
        }

        // Busca concorrentes reais via Places API
        const nearby = await getNearbyCompetitors(lat, lng, profile.category, profile.googleLocationId, profile.name);

        if (nearby.length === 0) return { competitors: [], message: "Nenhum concorrente encontrado próximo." };

        // Busca detalhes com avaliações
        const details = await getCompetitorDetails(nearby.map(c => c.placeId));

        // Salva no banco (createCompetitor já faz upsert)
        for (const comp of details) {
          try {
            await db.createCompetitor({
              profileId: input.profileId,
              placeId: comp.placeId,
              name: comp.name,
              address: comp.address,
              rating: comp.rating,
              reviewCount: comp.totalReviews,
              category: comp.category,
            });
          } catch (e: any) {
            console.warn("[Competitors] insert error:", e?.message);
          }
        }

        return { competitors: details, message: `${details.length} concorrentes encontrados!` };
      }),

    analyze: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        const competitors = await db.getCompetitorsByProfileId(input.profileId);
        if (competitors.length === 0) throw new Error("Busque os concorrentes primeiro.");

        const myReviews = await db.getReviewsByProfileId(input.profileId);
        const myKeywords = extractKeywords(myReviews.map(r => r.comment || "").join(" "));

        const prompt = `Analise estes dados de competitividade para "${profile.name}" e gere uma análise estratégica completa em português.

MEU PERFIL:
- Nota: ${profile.avgRating || "N/A"} (${profile.totalReviews || 0} avaliações)
- Categoria: ${profile.category}
- Endereço: ${profile.address}
- Palavras-chave nas avaliações: ${myKeywords.slice(0,10).join(", ")}

CONCORRENTES:
${competitors.slice(0,5).map((c, i) => `${i+1}. ${c.name}: ${c.avgRating || "N/A"}⭐ (${c.totalReviews || 0} avaliações)`).join("\n")}

Responda com JSON:
{
  "position": "sua posição no ranking (1-${competitors.length + 1})",
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "weaknesses": ["ponto fraco 1", "ponto fraco 2"],
  "opportunities": ["oportunidade 1", "oportunidade 2", "oportunidade 3"],
  "actions": ["ação prioritária 1", "ação prioritária 2", "ação prioritária 3", "ação prioritária 4"],
  "reviewGap": ${(competitors[0]?.totalReviews || 0) - (profile.totalReviews || 0)},
  "ratingGap": ${((competitors[0]?.avgRating || 0) - (profile.avgRating || 0)).toFixed(1)},
  "summary": "resumo executivo em 2-3 frases"
}`;

        const raw = await callGroqAPI([
          { role: "system", content: "Você é especialista em SEO local e Google Business Profile. Responda APENAS com JSON válido." },
          { role: "user", content: prompt },
        ]);

        const clean = raw.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(clean);
      }),
  }),

  metrics: router({
    getByProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getMetricsByProfileId(input.profileId)),
  }),

  sync: router({
    // Sincronização via Google Places API (dados reais sem necessidade de GBP API)
    syncFromPlaces: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        if (!profile.googleLocationId || profile.googleLocationId.startsWith("manual_")) {
          throw new Error("Este perfil foi adicionado manualmente. Reimporte pelo link do Google Maps para sincronizar.");
        }

        // Se temos o placeId, busca dados atualizados
        const placeId = profile.googleLocationId;
        const details = await getPlaceDetails(placeId);
        if (!details) throw new Error("Não foi possível buscar dados atualizados do Google.");

        // Atualiza perfil com dados reais
        await db.updateProfile(input.profileId, {
          totalReviews: details.totalReviews,
          avgRating: details.rating,
          phone: details.phone || profile.phone,
          website: details.website || profile.website,
        });

        // Salva avaliações reais
        let reviewCount = 0;
        if (details.reviews) {
          for (const rv of details.reviews) {
            try {
              await db.createReview({
                profileId: input.profileId,
                googleReviewId: `places_${rv.time}_${rv.author.replace(/\s/g, "")}`,
                authorName: rv.author,
                authorPhoto: rv.photoUrl,
                rating: rv.rating,
                comment: rv.text || null,
                reply: null,
                sentiment: rv.rating >= 4 ? "positive" : rv.rating <= 2 ? "negative" : "neutral",
                publishedAt: new Date(rv.time),
              });
              reviewCount++;
            } catch (e: any) {
              if (!e?.message?.includes("Duplicate")) console.warn("[Sync] review skip:", e?.message);
            }
          }
        }

        // Atualiza score
        const s = calcScore({ totalReviews: details.totalReviews, avgRating: details.rating, website: details.website, phone: details.phone });
        await db.createScore({ profileId: input.profileId, ...s });

        return { success: true, reviewCount, rating: details.rating, totalReviews: details.totalReviews };
      }),

    // Sincronização completa: reviews + métricas + score
    syncProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");

        const accessToken = await getValidAccessToken(ctx.user.id);
        if (!accessToken) return { success: false, error: "Token Google não encontrado. Reconecte sua conta." };

        const results: any = { reviews: 0, metrics: false, score: false };

        // 1. Sincronizar reviews
        try {
          const { getLocationReviews } = await import("./google-mybusiness-api");
          const googleReviews = await getLocationReviews(accessToken, profile.googleLocationId);

          for (const gr of googleReviews) {
            try {
              await db.createReview({
                profileId: input.profileId,
                googleReviewId: gr.name,
                authorName: gr.reviewer?.displayName || "Anônimo",
                authorPhoto: gr.reviewer?.profilePhotoUrl,
                rating: gr.starRating || 0,
                comment: gr.comment || null,
                reply: gr.reviewReply?.comment || null,
                sentiment: gr.starRating >= 4 ? "positive" : gr.starRating <= 2 ? "negative" : "neutral",
                publishedAt: gr.createTime ? new Date(gr.createTime) : new Date(),
              });
              results.reviews++;
            } catch (e: any) {
              if (!e?.message?.includes("Duplicate")) console.warn("[Sync] Review skip:", e?.message);
            }
          }

          // Atualizar contadores no perfil
          const allReviews = await db.getReviewsByProfileId(input.profileId);
          if (allReviews.length > 0) {
            const avgRating = allReviews.reduce((s, r) => s + (r.rating || 0), 0) / allReviews.length;
            await db.updateProfile(input.profileId, {
              totalReviews: allReviews.length,
              avgRating: Math.round(avgRating * 10) / 10,
            });
          }
        } catch (e) {
          console.error("[Sync] Reviews error:", e);
          results.reviewsError = (e as Error).message;
        }

        // 2. Recalcular score com dados atualizados
        try {
          const updated = await db.getProfileById(input.profileId);
          if (updated) {
            const s = calcScore(updated);
            await db.createScore({ profileId: input.profileId, ...s });
            results.score = true;
          }
        } catch (e) {
          console.error("[Sync] Score error:", e);
        }

        return { success: true, ...results };
      }),

    // Verificar se token Google está disponível
    checkToken: protectedProcedure
      .query(async ({ ctx }) => {
        const token = await db.getGoogleToken(ctx.user.id);
        return { hasToken: !!token?.accessToken };
      }),
  }),

  googleBusiness: router({
    getProfiles: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          const accessToken = await getValidAccessToken(ctx.user.id);
          if (!accessToken) return { profiles: [], error: "Conta Google não conectada. Faça login novamente." };

          const { getBusinessAccounts, getBusinessLocations, getLocationDetails } = await import("./google-mybusiness-api");

          const accountsData = await getBusinessAccounts(accessToken);
          const accounts = accountsData.accounts || [];

          if (accounts.length === 0) return { profiles: [], error: "Nenhuma conta Google Business encontrada." };

          const profiles: any[] = [];

          for (const account of accounts) {
            const accountId = account.name.split("/")[1];
            try {
              const locationsData = await getBusinessLocations(accessToken, accountId) as any;
              const locations = Array.isArray(locationsData) ? locationsData : (locationsData?.locations || []);

              for (const location of locations) {
                try {
                  const details = await getLocationDetails(accessToken, location.name) as any;
                  profiles.push({
                    id: location.name,
                    name: details.displayName || location.displayName || "Sem nome",
                    category: details.category?.displayName || details.businessType || "Negócio",
                    address: details.address?.addressLines?.[0] || details.storefrontAddress?.addressLines?.[0] || "Endereço não disponível",
                    phone: details.phoneNumbers?.[0] || details.primaryPhone || undefined,
                    website: details.websiteUrl || undefined,
                    googleLocationId: location.name,
                    googleAccountId: accountId,
                    isVerified: details.metadata?.isVerified || false,
                  });
                } catch (e) {
                  console.warn("[GBP] Location detail error:", e);
                }
              }
            } catch (e) {
              console.warn("[GBP] Locations error for account", accountId, e);
            }
          }

          return { profiles, error: null };
        } catch (error) {
          console.error("[GBP] getProfiles error:", error);
          return { profiles: [], error: (error as Error).message };
        }
      }),

    getOAuthUrl: publicProcedure
      .input(z.object({ returnUrl: z.string().optional(), origin: z.string() }))
      .mutation(({ input }) => {
        const state = Buffer.from(JSON.stringify({ returnUrl: input.returnUrl || "/dashboard" })).toString("base64");
        const url = getGoogleOAuthUrl(state, input.origin);
        return { url };
      }),
  }),
  posts: router({
    generate: protectedProcedure
      .input(z.object({
        profileId: z.number(),
        type: z.string(),
        keywords: z.array(z.string()).optional(),
        extraContext: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");

        const kws = (input.keywords || []).join(", ") || `${profile.category}, ${profile.address}`;

        const typeGuide: Record<string, string> = {
          institucional: "Apresente a empresa, destaque missão, valores e diferenciais. Tom profissional e acolhedor.",
          servico: "Destaque um serviço específico com benefícios concretos e CTA (ligue, agende, visite). Tom persuasivo.",
          autoridade: "Posicione como especialista do segmento com dados, experiência ou conquistas. Tom confiante.",
          localizacao: "Foque na localização, bairro e cidade. Mencione pontos de referência ou facilidade de acesso. SEO local intenso.",
          oferta: "Crie senso de urgência com oferta ou condição especial. CTA claro. Tom energético.",
          depoimento: "Baseado em avaliações positivas reais. Compartilhe resultado de cliente (sem citar nome). Tom empático.",
          dica: "Compartilhe dica útil do segmento que educa o cliente. Posiciona como autoridade. Tom educativo.",
          evento: "Anuncie novidade, lançamento ou evento com data e CTA. Tom animado.",
        };

        const guide = typeGuide[input.type] || typeGuide.servico;
        const context = input.extraContext ? `\nContexto adicional: ${input.extraContext}` : "";

        const prompt = `Crie um post para Google Business Profile de "${profile.name}" (${profile.category}).

Tipo: ${input.type.toUpperCase()}
Diretriz: ${guide}
Palavras-chave SEO local (USE 2-4 naturalmente): ${kws}${context}

Regras:
1. Máximo 300 palavras
2. Linguagem natural, não robótica
3. Inclua as keywords de forma fluida
4. Termine com CTA claro (ligue, visite, agende, saiba mais)
5. Não use emojis em excesso (máximo 3)

Responda com JSON exato:
{"content":"texto do post aqui","hashtags":"#hashtag1 #hashtag2 #hashtag3"}`;

        const raw = await callGroqAPI([
          { role: "system", content: "Você cria posts para Google Business Profile otimizados para SEO local. Responda APENAS com JSON válido." },
          { role: "user", content: prompt },
        ]);

        try {
          const clean = raw.replace(/```json\n?|```/g, "").trim();
          const parsed = JSON.parse(clean);
          return { content: parsed.content || raw, hashtags: parsed.hashtags || "" };
        } catch {
          return { content: raw.trim(), hashtags: "" };
        }
      }),
  }),

  keywords: router({
    analyze: protectedProcedure
      .input(z.object({
        profileId: z.number(),
        keywords: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");

        const reviews = await db.getReviewsByProfileId(input.profileId);
        const reviewText = reviews.map((r: any) => `${r.comment || ""} ${r.reply || ""}`).join(" ").toLowerCase();
        const descText = (profile.description || "").toLowerCase();
        const nameText = (profile.name || "").toLowerCase();
        const categoryText = (profile.category || "").toLowerCase();

        const results = input.keywords.map(kw => {
          const k = kw.toLowerCase().trim();
          const inName = nameText.includes(k);
          const inDescription = descText.includes(k);
          const inServices = categoryText.includes(k);
          const inReviews = reviewText.includes(k);
          const inPosts = false; // would need post data

          let score = 0;
          if (inName) score += 30;
          if (inDescription) score += 25;
          if (inServices) score += 20;
          if (inReviews) score += 15;
          if (inPosts) score += 10;

          const missing = [];
          if (!inDescription) missing.push("descrição");
          if (!inName) missing.push("nome do negócio");
          if (!inServices) missing.push("categoria/serviços");
          if (!inReviews) missing.push("respostas a reviews");

          const suggestion = score === 0
            ? `"${kw}" não aparece em lugar nenhum. Adicione na descrição e nas respostas de reviews com urgência.`
            : missing.length > 0
            ? `Adicione "${kw}" em: ${missing.slice(0,2).join(" e ")}.`
            : `"${kw}" está bem posicionada. Mantenha nas respostas de reviews.`;

          return { keyword: kw, score, inName, inDescription, inServices, inReviews, inPosts, suggestion };
        });

        return { results };
      }),

    suggest: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        const reviews = await db.getReviewsByProfileId(input.profileId);
        const reviewSnippets = reviews.slice(0, 10).map(r => r.comment || "").join(". ");

        const prompt = `Você é especialista em SEO local para Google Business Profile.

Negócio: "${profile.name}"
Categoria: ${profile.category}
Endereço: ${profile.address}
Avaliações recentes: ${reviewSnippets || "(sem avaliações ainda)"}

Sugira 10 palavras-chave de alta intenção local que este negócio deveria ranquear no Google Maps.
Inclua variações com cidade/bairro, serviços específicos e termos que clientes realmente buscam.

Responda APENAS com JSON:
{
  "keywords": ["palavra 1", "palavra 2", ..., "palavra 10"],
  "reasoning": "breve explicação de 1-2 linhas"
}`;

        const raw = await callGroqAPI([
          { role: "system", content: "Você é especialista em SEO local. Responda APENAS com JSON válido." },
          { role: "user", content: prompt },
        ]);
        const clean = raw.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(clean);
      }),
  }),

  profileChecklist: router({
    getStatus: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        const reviews = await db.getReviewsByProfileId(input.profileId);
        const competitors = await db.getCompetitorsByProfileId(input.profileId);
        const score = await db.getScoreByProfileId(input.profileId);
        const respondedReviews = reviews.filter(r => r.reply).length;

        // Auto-detecta quais itens estão concluídos com base nos dados reais
        return {
          items: [
            { id: "name",        group: "Perfil",      label: "Nome do negócio preenchido",        done: !!profile.name },
            { id: "category",    group: "Perfil",      label: "Categoria definida",                done: !!profile.category && profile.category !== "Estabelecimento" },
            { id: "address",     group: "Perfil",      label: "Endereço completo",                 done: !!profile.address },
            { id: "phone",       group: "Perfil",      label: "Telefone adicionado",               done: !!profile.phone },
            { id: "website",     group: "Perfil",      label: "Site vinculado",                    done: !!profile.website },
            { id: "description", group: "Perfil",      label: "Descrição do negócio",              done: !!profile.description && (profile.description?.length || 0) > 50 },
            { id: "verified",    group: "Perfil",      label: "Perfil verificado",                 done: !!profile.isVerified },
            { id: "photos",      group: "Conteúdo",    label: "Pelo menos 5 fotos",                done: (profile.photoCount || 0) >= 5 },
            { id: "posts",       group: "Conteúdo",    label: "Pelo menos 1 post publicado",       done: (profile.postCount || 0) >= 1 },
            { id: "reviews_10",  group: "Avaliações",  label: "Mais de 10 avaliações",             done: (profile.totalReviews || 0) >= 10 },
            { id: "reviews_50",  group: "Avaliações",  label: "Mais de 50 avaliações",             done: (profile.totalReviews || 0) >= 50 },
            { id: "rating_4",    group: "Avaliações",  label: "Nota média acima de 4.0",           done: (profile.avgRating || 0) >= 4.0 },
            { id: "responses",   group: "Avaliações",  label: "Respondeu pelo menos 1 avaliação",  done: respondedReviews >= 1 },
            { id: "response_50", group: "Avaliações",  label: "Taxa de resposta acima de 50%",     done: reviews.length > 0 && (respondedReviews / reviews.length) >= 0.5 },
            { id: "competitors", group: "Análise",     label: "Concorrentes mapeados",             done: competitors.length >= 3 },
            { id: "score_50",    group: "Análise",     label: "Score GBP acima de 50",             done: (score?.total || 0) >= 50 },
            { id: "score_75",    group: "Análise",     label: "Score GBP acima de 75",             done: (score?.total || 0) >= 75 },
          ],
          profile: { name: profile.name, avgRating: profile.avgRating, totalReviews: profile.totalReviews, score: score?.total || 0 },
        };
      }),
  }),

  aiSearch: router({
    analyze: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        const reviews = await db.getReviewsByProfileId(input.profileId);
        const avgRating = profile.avgRating || 0;
        const totalReviews = profile.totalReviews || 0;
        const hasDescription = !!profile.description;
        const hasWebsite = !!profile.website;
        const hasPhone = !!profile.phone;
        const respondedReviews = reviews.filter(r => r.reply).length;
        const responseRate = reviews.length > 0 ? Math.round((respondedReviews / reviews.length) * 100) : 0;

        const prompt = `Analise este perfil Google Business para visibilidade em IAs (ChatGPT, Gemini, Perplexity, Google AI Overview).

DADOS DO PERFIL:
- Nome: ${profile.name}
- Categoria: ${profile.category}
- Endereço: ${profile.address}
- Nota: ${avgRating} (${totalReviews} avaliações)
- Tem descrição: ${hasDescription}
- Tem site: ${hasWebsite}
- Tem telefone: ${hasPhone}
- Taxa de resposta a avaliações: ${responseRate}%

Responda APENAS com JSON válido:
{
  "score": número de 0-100,
  "googleAI": número de 0-100,
  "chatGPT": número de 0-100,
  "perplexity": número de 0-100,
  "factors": [
    {"factor": "nome do fator", "status": "ok|warn|fail", "description": "explicação curta"},
    ...mínimo 8 fatores
  ],
  "actions": [
    {"action": "ação concreta", "impact": "impacto esperado"},
    ...mínimo 5 ações
  ]
}`;

        const raw = await callGroqAPI([
          { role: "system", content: "Você é especialista em SEO para AI Search (LLMs). Responda APENAS com JSON válido." },
          { role: "user", content: prompt },
        ]);

        const clean = raw.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(clean);
      }),
  }),

  report: router({
    generate: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .mutation(async ({ input }) => {
        const profile = await db.getProfileById(input.profileId);
        if (!profile) throw new Error("Perfil não encontrado");
        const score = await db.getScoreByProfileId(input.profileId);
        const reviews = await db.getReviewsByProfileId(input.profileId);
        const competitors = await db.getCompetitorsByProfileId(input.profileId);

        const positiveReviews = reviews.filter(r => r.sentiment === "positive").length;
        const negativeReviews = reviews.filter(r => r.sentiment === "negative").length;
        const neutralReviews = reviews.filter(r => r.sentiment === "neutral").length;
        const total = reviews.length || 1;

        // Calcula posição local baseada nos concorrentes
        const allRatings = [profile.avgRating || 0, ...competitors.map((c: any) => c.rating || 0)].sort((a, b) => b - a);
        const localRank = allRatings.indexOf(profile.avgRating || 0) + 1;

        // Extrai temas das reviews
        const allText = reviews.map(r => r.comment || "").join(" ");
        const themes = extractKeywords(allText).slice(0, 8);

        const prompt = `Gere um relatório estratégico completo para "${profile.name}" (${profile.category}).

DADOS:
- Score GBP: ${score?.totalScore || 0}/100
- Nota: ${profile.avgRating || 0} (${profile.totalReviews || 0} avaliações)
- Reviews positivas: ${positiveReviews}, neutras: ${neutralReviews}, negativas: ${negativeReviews}
- Concorrentes: ${competitors.length}
- Posição local estimada: #${localRank}
- Tem site: ${!!profile.website}, tem descrição: ${!!profile.description}

Responda APENAS com JSON válido:
{
  "overallScore": ${score?.totalScore || 0},
  "localRank": ${localRank},
  "diagnosis": [
    {"item": "nome do item", "status": "ok|warn|fail", "detail": "detalhe"},
    ...mínimo 6 itens
  ],
  "sentiment": {
    "positive": ${Math.round((positiveReviews/total)*100)},
    "neutral": ${Math.round((neutralReviews/total)*100)},
    "negative": ${Math.round((negativeReviews/total)*100)},
    "themes": ${JSON.stringify(themes)}
  },
  "actionPlan": [
    {"action": "ação concreta", "why": "por que é importante", "priority": "alta|media|baixa"},
    ...mínimo 6 ações ordenadas por prioridade
  ]
}`;

        const raw = await callGroqAPI([
          { role: "system", content: "Você é consultor especialista em Google Business Profile. Responda APENAS com JSON válido." },
          { role: "user", content: prompt },
        ]);

        const clean = raw.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(clean);
      }),
  }),
});

export type AppRouter = typeof appRouter;
