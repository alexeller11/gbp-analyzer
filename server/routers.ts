import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { callGroqAPI } from "./groq";
import { reviewsRouter, generateResponseProcedure } from "./reviews-router";
import { getGoogleOAuthUrl, refreshAccessToken } from "./google-oauth-tokens";

/* ─── Helpers ─────────────────────────────────────────────────────── */

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
  }),

  metrics: router({
    getByProfile: protectedProcedure
      .input(z.object({ profileId: z.number() }))
      .query(async ({ input }) => db.getMetricsByProfileId(input.profileId)),
  }),

  sync: router({
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
  }),
});

export type AppRouter = typeof appRouter;
