import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { systemRouter } from "./systemRouter";
import { publicProcedure, router, protectedProcedure } from "./trpc";
import { z } from "zod";

// Corrigido: Aponta para a pasta 'server/' um nível acima
import * as db from "../db"; 
import { callGroqAPI } from "../groq"; 
import { reviewsRouter, generateResponseProcedure } from "../reviews-router"; 
import { getGoogleOAuthUrl, refreshAccessToken } from "../google-oauth-tokens";
import { findPlaceFromUrl, getPlaceDetails, getNearbyCompetitors, getCompetitorDetails } from "../places-api";

/* --- RESTO DO CÓDIGO PERMANECE IGUAL --- */
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
    // ... restante das rotas do ficheiro original
  }),
});

export type AppRouter = typeof appRouter;
