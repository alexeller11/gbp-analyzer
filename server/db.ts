// Adicione isto no topo, junto com os outros imports:
import { encrypt, decrypt } from "./_core/crypto";

// Substitua as funções existentes por estas:
export async function storeGoogleToken(
  userId: number,
  googleAccountId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não conectado");

  try {
    const { googleTokens } = await import("../drizzle/schema");
    // Remove o token antigo
    await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
    
    // Insere o novo token criptografado
    await db.insert(googleTokens).values({
      userId,
      googleAccountId,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      expiresAt: expiresAt || null,
      scope: "https://www.googleapis.com/auth/business.manage",
    });
    console.log(`[DB] Token do utilizador ${userId} guardado com segurança.`);
  } catch (error) {
    console.error("[DB] Erro ao guardar Google Token:", error);
    throw error;
  }
}

export async function getGoogleToken(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const { googleTokens } = await import("../drizzle/schema");
    const result = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId)).limit(1);
    
    const tokenRecord = result[0] ?? null;
    if (tokenRecord) {
      // Descriptografa antes de entregar ao sistema
      tokenRecord.accessToken = decrypt(tokenRecord.accessToken);
      if (tokenRecord.refreshToken) {
        tokenRecord.refreshToken = decrypt(tokenRecord.refreshToken);
      }
    }
    return tokenRecord;
  } catch (error) {
    console.error("[DB] Erro ao recuperar Google Token:", error);
    return null;
  }
}
