import { SignJWT, jwtVerify } from "jose";

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET não configurado");
}

const key = new TextEncoder().encode(secret);

export type SessionPayload = {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  googleBusinessConnected?: boolean;
};

export async function createSessionToken(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as SessionPayload;
}
