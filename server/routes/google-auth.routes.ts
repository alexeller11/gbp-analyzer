import { Router } from "express";
import { randomBytes } from "node:crypto";
import {
  getGoogleLoginUrl,
  getGoogleBusinessConnectUrl,
  exchangeCodeForToken,
  getGoogleUserInfo,
  parseScopes,
  hasBusinessManageScope
} from "../google/oauth.service";
import { createSessionToken, verifySessionToken } from "../auth/session";

const router = Router();

router.get("/api/auth/google-login", async (_req, res) => {
  try {
    const state = randomBytes(16).toString("hex");

    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60 * 1000
    });

    return res.redirect(getGoogleLoginUrl(state));
  } catch (error: any) {
    console.error("Erro ao iniciar login Google:", error);
    return res.status(500).send(error?.message || "Erro ao iniciar login Google");
  }
});

router.get("/api/auth/google-business-connect", async (_req, res) => {
  try {
    const state = randomBytes(16).toString("hex");

    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60 * 1000
    });

    return res.redirect(getGoogleBusinessConnectUrl(state));
  } catch (error: any) {
    console.error("Erro ao iniciar conexão com Google Business:", error);
    return res.status(500).send(error?.message || "Erro ao iniciar conexão com Google Business");
  }
});

router.get("/api/oauth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      return res.status(400).send("code/state ausente");
    }

    const cookieState = req.cookies?.google_oauth_state;

    if (!cookieState || cookieState !== state) {
      return res.status(400).send("state inválido");
    }

    const token = await exchangeCodeForToken(code);
    const userInfo = await getGoogleUserInfo(token.access_token);
    const scopes = parseScopes(token.scope);
    const googleBusinessConnected = hasBusinessManageScope(scopes);

    console.log("OAuth Google concluído:", {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      scope: token.scope,
      googleBusinessConnected
    });

    const sessionToken = await createSessionToken({
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      scopes,
      googleBusinessConnected
    });

    res.clearCookie("google_oauth_state");

    res.cookie("gbp_session", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const appUrl = process.env.APP_URL || "/";
    const redirectSuffix = googleBusinessConnected
      ? "?googleBusiness=connected"
      : "?googleLogin=success";

    return res.redirect(`${appUrl}${redirectSuffix}`);
  } catch (error: any) {
    console.error("Erro no callback Google:", error);
    return res.status(500).send(error?.message || "Erro no callback Google");
  }
});

router.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.gbp_session;

    if (!token) {
      return res.status(401).json({
        authenticated: false
      });
    }

    const user = await verifySessionToken(token);

    return res.status(200).json({
      authenticated: true,
      user
    });
  } catch (error) {
    return res.status(401).json({
      authenticated: false
    });
  }
});

router.post("/api/auth/logout", async (_req, res) => {
  res.clearCookie("gbp_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: true
  });

  return res.status(200).json({
    ok: true
  });
});

export default router;
