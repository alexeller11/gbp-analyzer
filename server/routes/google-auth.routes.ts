import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { users, googleConnections } from "../../drizzle/schema.ts";
import { createSessionToken, verifySessionToken } from "../auth/session.ts";

const router = Router();

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não configurado`);
  }
  return value;
}

function getBaseUrl(req: any) {
  return process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
}

function getGoogleRedirectUri(req: any) {
  return `${getBaseUrl(req)}/api/auth/google/callback`;
}

function parseSessionUserId(rawId: unknown): number | null {
  if (typeof rawId !== "string" && typeof rawId !== "number") {
    return null;
  }

  const numericUserId = Number(rawId);

  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    return null;
  }

  return numericUserId;
}

router.get("/api/auth/google-login", async (req, res) => {
  try {
    const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const redirectUri = getGoogleRedirectUri(req);

    const scope = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ].join(" ");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return res.redirect(url.toString());
  } catch (error: any) {
    console.error("Erro ao iniciar login Google:", error);
    return res.status(500).send(error?.message || "Erro ao iniciar login Google");
  }
});

router.get("/api/auth/google-business-connect", async (req, res) => {
  try {
    const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const redirectUri = getGoogleRedirectUri(req);

    const scope = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/business.manage"
    ].join(" ");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return res.redirect(url.toString());
  } catch (error: any) {
    console.error("Erro ao iniciar conexão Google Business:", error);
    return res.status(500).send(error?.message || "Erro ao iniciar conexão Google Business");
  }
});

router.get("/api/auth/google/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    if (!code) {
      return res.status(400).send("Código OAuth ausente");
    }

    const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
    const clientSecret = getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");
    const redirectUri = getGoogleRedirectUri(req);

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Erro token Google:", tokenData);
      return res.status(400).send("Falha ao trocar código por token");
    }

    const accessToken = String(tokenData.access_token || "");
    const refreshToken = tokenData.refresh_token ? String(tokenData.refresh_token) : null;
    const expiresIn = Number(tokenData.expires_in || 0);
    const scope = String(tokenData.scope || "");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const profile = await profileResponse.json();

    if (!profileResponse.ok) {
      console.error("Erro userinfo Google:", profile);
      return res.status(400).send("Falha ao obter perfil do Google");
    }

    const googleOpenId = String(profile.sub);
    const email = String(profile.email);
    const name = profile.name ? String(profile.name) : null;
    const picture = profile.picture ? String(profile.picture) : null;

    let user = await db.query.users.findFirst({
      where: eq(users.openId, googleOpenId)
    });

    if (!user) {
      const inserted = await db
        .insert(users)
        .values({
          openId: googleOpenId,
          email,
          name,
          picture,
          updatedAt: new Date()
        })
        .returning();

      user = inserted[0];
    } else {
      const updated = await db
        .update(users)
        .set({
          email,
          name,
          picture,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id))
        .returning();

      user = updated[0];
    }

    const googleBusinessConnected = scope.includes("business.manage");
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

    const existingConnection = await db.query.googleConnections.findFirst({
      where: eq(googleConnections.userId, user.id)
    });

    if (!existingConnection) {
      await db.insert(googleConnections).values({
        userId: user.id,
        googleUserId: googleOpenId,
        googleEmail: email,
        googleName: name,
        accessToken,
        refreshToken,
        scope,
        expiresAt,
        googleBusinessConnected,
        updatedAt: new Date()
      });
    } else {
      await db
        .update(googleConnections)
        .set({
          googleUserId: googleOpenId,
          googleEmail: email,
          googleName: name,
          accessToken,
          refreshToken: refreshToken || existingConnection.refreshToken,
          scope,
          expiresAt,
          googleBusinessConnected,
          updatedAt: new Date()
        })
        .where(eq(googleConnections.id, existingConnection.id));
    }

    const sessionToken = await createSessionToken({
      id: String(user.id),
      email: user.email,
      name: user.name,
      picture: user.picture,
      googleBusinessConnected
    });

    res.cookie("gbp_session", sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 30
    });

    return res.redirect("/");
  } catch (error: any) {
    console.error("Erro no callback Google:", error);
    return res.status(500).send(error?.message || "Erro no callback Google");
  }
});

router.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.gbp_session;

    if (!token) {
      return res.status(200).json({
        authenticated: false
      });
    }

    const session = await verifySessionToken(token);
    const userId = parseSessionUserId(session.id);

    if (!userId) {
      res.clearCookie("gbp_session", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/"
      });

      return res.status(200).json({
        authenticated: false
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      return res.status(200).json({
        authenticated: false
      });
    }

    const connection = await db.query.googleConnections.findFirst({
      where: eq(googleConnections.userId, user.id)
    });

    return res.status(200).json({
      authenticated: true,
      user: {
        id: String(user.id),
        googleOpenId: user.openId,
        email: user.email,
        name: user.name,
        picture: user.picture,
        googleBusinessConnected: connection?.googleBusinessConnected || false,
        scopes: connection?.scope ? connection.scope.split(" ") : []
      }
    });
  } catch (error: any) {
    console.error("Erro em /api/auth/me:", error);
    return res.status(200).json({
      authenticated: false
    });
  }
});

router.post("/api/auth/logout", async (_req, res) => {
  res.clearCookie("gbp_session", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/"
  });

  return res.status(200).json({
    ok: true
  });
});

export default router;
