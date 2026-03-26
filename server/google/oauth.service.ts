import "dotenv/config";

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  id: string;
  email: string;
  verified_email?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não configurado`);
  }
  return value;
}

function buildGoogleAuthUrl(state: string, scopes: string[]) {
  const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const redirectUri = getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: scopes.join(" "),
    state
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export function getGoogleLoginUrl(state: string) {
  return buildGoogleAuthUrl(state, [
    "openid",
    "email",
    "profile"
  ]);
}

export function getGoogleBusinessConnectUrl(state: string) {
  return buildGoogleAuthUrl(state, [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/business.manage"
  ]);
}

export async function exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");
  const redirectUri = getRequiredEnv("GOOGLE_OAUTH_REDIRECT_URI");

  const response = await fetch(GOOGLE_TOKEN_URL, {
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
    }).toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao trocar code por token: ${errorText}`);
  }

  return response.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao buscar userinfo: ${errorText}`);
  }

  return response.json();
}

export function parseScopes(scope?: string): string[] {
  if (!scope) return [];
  return scope
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function hasBusinessManageScope(scopes: string[]) {
  return scopes.includes("https://www.googleapis.com/auth/business.manage");
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    }).toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao renovar token: ${errorText}`);
  }

  return response.json();
}
