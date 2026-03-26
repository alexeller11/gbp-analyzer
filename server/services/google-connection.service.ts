import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  googleConnections
} from "../../drizzle/schema";
import { refreshGoogleAccessToken } from "../google/oauth.service";

export async function upsertUserFromGoogle(input: {
  openId: string;
  email: string;
  name?: string;
  picture?: string;
}) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.openId, input.openId)
  });

  if (!existingUser) {
    const [createdUser] = await db
      .insert(users)
      .values({
        openId: input.openId,
        email: input.email,
        name: input.name,
        picture: input.picture
      })
      .returning();

    return createdUser;
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      email: input.email,
      name: input.name,
      picture: input.picture,
      updatedAt: new Date()
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  return updatedUser;
}

export async function upsertGoogleConnection(input: {
  userId: number;
  googleUserId: string;
  googleEmail: string;
  googleName?: string;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresIn?: number;
  googleBusinessConnected: boolean;
}) {
  const existingConnection = await db.query.googleConnections.findFirst({
    where: eq(googleConnections.googleUserId, input.googleUserId)
  });

  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000)
    : null;

  if (!existingConnection) {
    const [createdConnection] = await db
      .insert(googleConnections)
      .values({
        userId: input.userId,
        googleUserId: input.googleUserId,
        googleEmail: input.googleEmail,
        googleName: input.googleName,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        scope: input.scope,
        expiresAt,
        googleBusinessConnected: input.googleBusinessConnected
      })
      .returning();

    return createdConnection;
  }

  const [updatedConnection] = await db
    .update(googleConnections)
    .set({
      userId: input.userId,
      googleEmail: input.googleEmail,
      googleName: input.googleName,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? existingConnection.refreshToken,
      scope: input.scope,
      expiresAt,
      googleBusinessConnected: input.googleBusinessConnected,
      updatedAt: new Date()
    })
    .where(eq(googleConnections.id, existingConnection.id))
    .returning();

  return updatedConnection;
}

export async function getGoogleConnectionByUserId(userId: number) {
  return db.query.googleConnections.findFirst({
    where: eq(googleConnections.userId, userId)
  });
}

export async function getValidGoogleAccessToken(userId: number) {
  const connection = await getGoogleConnectionByUserId(userId);

  if (!connection) {
    throw new Error("Conexão Google não encontrada");
  }

  const now = Date.now();
  const expiresAt = connection.expiresAt ? new Date(connection.expiresAt).getTime() : 0;

  if (connection.accessToken && expiresAt > now + 60_000) {
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

  const newExpiresAt = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000)
    : connection.expiresAt;

  const [updatedConnection] = await db
    .update(googleConnections)
    .set({
      accessToken: refreshed.access_token,
      scope: refreshed.scope ?? connection.scope,
      expiresAt: newExpiresAt,
      updatedAt: new Date()
    })
    .where(eq(googleConnections.id, connection.id))
    .returning();

  return {
    accessToken: updatedConnection.accessToken,
    connection: updatedConnection
  };
}
