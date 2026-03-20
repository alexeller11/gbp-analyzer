/**
 * Auth SDK — versão standalone com Google OAuth + JWT
 * Substitui o sistema Manus por autenticação própria
 */
import { SignJWT, jwtVerify } from "jose";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import * as db from "../db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET ?? "gbp-analyzer-default-secret-change-me";
  return new TextEncoder().encode(secret);
}

export const sdk = {
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    return new SignJWT({ openId, name: options.name ?? "" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(getSecret());
  },

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, getSecret());
      if (!payload.openId || typeof payload.openId !== "string") return null;
      return { openId: payload.openId as string, appId: "gbp-analyzer", name: (payload.name as string) ?? "" };
    } catch {
      return null;
    }
  },

  async authenticateRequest(req: Request) {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const cookieValue = cookies[COOKIE_NAME];
    const session = await this.verifySession(cookieValue);
    if (!session) return null;
    const user = await db.getUserByOpenId(session.openId);
    return user ?? null;
  },
};
