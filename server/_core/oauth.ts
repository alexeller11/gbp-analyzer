import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function qp(req: Request, key: string) {
  const v = req.query[key];
  return typeof v === "string" ? v : undefined;
}

// Rota: inicia o fluxo OAuth → redireciona para Google
export function registerLoginRoute(app: Express) {
  app.get("/api/auth/google-login", async (_req: Request, res: Response) => {
    try {
      const { getGoogleOAuthUrl } = await import("../google-oauth-tokens");
      const state = Buffer.from(JSON.stringify({ returnUrl: "/dashboard" })).toString("base64");
      const origin = process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
      const url = getGoogleOAuthUrl(state, origin);
      res.redirect(302, url);
    } catch (error) {
      console.error("[Login] Erro ao gerar URL OAuth:", error);
      res.status(500).send(`<h2>Erro de configuração</h2><p>Verifique GOOGLE_OAUTH_CLIENT_ID e APP_URL</p><pre>${error}</pre>`);
    }
  });
}

// Rota: callback do Google → salva token → cria sessão → redireciona
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = qp(req, "code");
    const state = qp(req, "state");
    const errorParam = qp(req, "error");

    if (errorParam) {
      console.error("[OAuth] Google retornou erro:", errorParam);
      res.redirect(302, `/?error=${encodeURIComponent("Login cancelado ou negado.")}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send("Parâmetros inválidos");
      return;
    }

    try {
      const { exchangeCodeForToken, getGoogleUserInfo } = await import("../google-oauth-tokens");

      const tokenData = await exchangeCodeForToken(code);
      const userInfo = await getGoogleUserInfo(tokenData.accessToken);

      // Criar/atualizar usuário
      await db.upsertUser({
        openId: `google_${userInfo.id}`,
        name: userInfo.name ?? null,
        email: userInfo.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(`google_${userInfo.id}`);

      // Salvar token Google para chamadas à GBP API
      if (user) {
        await db.storeGoogleToken(
          user.id,
          userInfo.id,
          tokenData.accessToken,
          tokenData.refreshToken,
          tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : undefined
        );
      }

      // Criar sessão JWT
      const sessionToken = await sdk.createSessionToken(`google_${userInfo.id}`, {
        name: userInfo.name ?? "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirecionar
      let returnUrl = "/dashboard";
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64").toString());
        returnUrl = stateData.returnUrl || "/dashboard";
      } catch {}

      console.log(`[OAuth] Login bem-sucedido: ${userInfo.email}`);
      res.redirect(302, returnUrl);
    } catch (error) {
      console.error("[OAuth] Callback falhou:", error);
      res.redirect(302, `/?error=${encodeURIComponent("Falha no login. Tente novamente.")}`);
    }
  });
}
