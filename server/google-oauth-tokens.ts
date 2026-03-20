/**
 * Google OAuth Token Management — versão standalone para deploy
 */

export interface GoogleOAuthToken {
  userId: number;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

/**
 * Gera a URL de autorização do Google OAuth
 */
export function getGoogleOAuthUrl(state: string, origin?: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID não configurado");

  // Prioridade: APP_URL env > origin param > localhost
  const baseOrigin =
    (process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, "") : null) ??
    origin ??
    `http://localhost:${process.env.PORT ?? 3000}`;

  const redirectUri = `${baseOrigin}/api/oauth/google/callback`;

  const scope = [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Troca o authorization code pelo access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Google OAuth não configuradas");
  }

  const baseOrigin = process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, "")
    : `http://localhost:${process.env.PORT ?? 3000}`;
  const redirectUri = `${baseOrigin}/api/oauth/google/callback`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Google OAuth error: ${error.error_description ?? response.statusText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Busca informações do usuário Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  name: string;
  picture?: string;
}> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google API error: ${response.statusText}`);
  }

  const data = await response.json();
  return { id: data.id, email: data.email, name: data.name, picture: data.picture };
}

/**
 * Renova o access token usando o refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciais não configuradas");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) throw new Error(`Token refresh failed: ${response.statusText}`);
  const data = await response.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in || 3600 };
}
