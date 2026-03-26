import "dotenv/config";
import { SignJWT, jwtVerify } from "jose";

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
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
    email: user.email,
    name: user.name,
    picture: user.picture
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
    email: String(payload.email || ""),
    name: payload.name ? String(payload.name) : undefined,
    picture: payload.picture ? String(payload.picture) : undefined
  } satisfies SessionUser;
}
