import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { googleConnections } from "../../drizzle/schema.ts";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} não configurado`);
  }
  return value;
}

export async function getGoogleConnectionByUserId(userId: number) {
  const connection = await db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId)
  });

  if (!connection) {
    throw new Error("Conexão Google não encontrada para este usuário");
  }

  return connection;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = getRequiredEnv("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro ao renovar token Google:", data);
    throw new Error("Falha ao renovar access token Google");
  }

  return {
    accessToken: String(data.access_token),
    expiresAt: data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000)
      : null
  };
}

export async function getValidGoogleAccessToken(userId: number) {
  const connection = await getGoogleConnectionByUserId(userId);

  const stillValid =
    connection.expiresAt && connection.expiresAt.getTime() > Date.now() + 60_000;

  if (stillValid) {
    return {
      accessToken: connection.accessToken,
      connection
    };
  }

  if (!connection.refreshToken) {
    return {
      accessToken: connection.accessToken,
      connection
    };
  }

  const refreshed = await refreshGoogleAccessToken(connection.refreshToken);

  const [updated] = await db
    .update(googleConnections)
    .set({
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
      updatedAt: new Date()
    })
    .where(eq(googleConnections.id, connection.id))
    .returning();

  return {
    accessToken: updated.accessToken,
    connection: updated
  };
}
