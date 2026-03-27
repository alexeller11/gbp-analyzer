import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";

export type SessionUser = {
  id: string;
  googleOpenId?: string;
  email: string;
  name?: string;
  picture?: string;
  scopes?: string[];
  googleBusinessConnected?: boolean;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET não configurado");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    sub: user.id,
    googleOpenId: user.googleOpenId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    scopes: user.scopes ?? [],
    googleBusinessConnected: Boolean(user.googleBusinessConnected)
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());

  return {
    id: String(payload.sub || ""),
    googleOpenId: payload.googleOpenId ? String(payload.googleOpenId) : undefined,
    email: String(payload.email || ""),
    name: payload.name ? String(payload.name) : undefined,
    picture: payload.picture ? String(payload.picture) : undefined,
    scopes: Array.isArray(payload.scopes)
      ? payload.scopes.map((item) => String(item))
      : [],
    googleBusinessConnected: Boolean(payload.googleBusinessConnected)
  } satisfies SessionUser;
}
