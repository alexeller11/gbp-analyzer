import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, or } from 'drizzle-orm';
import * as schema from '../drizzle/schema';
import { encrypt, decrypt } from './_core/crypto';

// Otimiza a ligação serverless ao Neon
neonConfig.fetchConnectionCache = true;

let dbInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Inicia ou recupera a ligação ao banco de dados Neon
 */
export async function getDb() {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error("[DB] ERRO: DATABASE_URL não está definida no ficheiro .env");
      throw new Error("DATABASE_URL não encontrada");
    }
    const sql = neon(databaseUrl);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

/**
 * Guarda o token do Google de forma encriptada na base de dados
 */
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
    const { googleTokens } = schema;
    
    // Remove o token antigo, se existir, para evitar duplicações
    await db.delete(googleTokens).where(eq(googleTokens.userId, userId));
    
    // Insere o novo token devidamente encriptado
    await db.insert(googleTokens).values({
      userId,
      googleAccountId,
      accessToken: encrypt(accessToken),
      refreshToken: refreshToken ? encrypt(refreshToken) : null,
      expiresAt: expiresAt || null,
      scope: "https://www.googleapis.com/auth/business.manage",
    });
    
    console.log(`[DB] Token do utilizador ${userId} guardado com segurança (Encriptado).`);
  } catch (error) {
    console.error("[DB] Erro ao guardar Google Token:", error);
    throw error;
  }
}

/**
 * Recupera e desencripta o token do Google para ser usado nas APIs
 */
export async function getGoogleToken(userId: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    const { googleTokens } = schema;
    const result = await db.select()
      .from(googleTokens)
      .where(eq(googleTokens.userId, userId))
      .limit(1);
    
    const tokenRecord = result[0] ?? null;
    
    if (tokenRecord) {
      // Desencripta os tokens antes de os entregar ao sistema para uso
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

/**
 * Cria um novo perfil de empresa (Google Business Profile)
 */
export async function createProfile(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados não conectado");

  try {
    const result = await db.insert(schema.profiles).values({
      userId,
      ...data
    }).returning();
    return result[0];
  } catch (error) {
    console.error("[DB] Erro ao criar perfil:", error);
    throw error;
  }
}
// No topo do db.ts, certifique-se de que tem as importações do Drizzle
import { desc, eq } from "drizzle-orm";
import { geoGridScans } from "../drizzle/schema"; // Ajuste o caminho conforme seu projeto

// Adicione esta função:
export async function getLastGeoGridScan(profileId: number) {
  const db = await getDb(); // ou como você chama sua instância do banco
  if (!db) return null;

  const [lastScan] = await db
    .select()
    .from(geoGridScans)
    .where(eq(geoGridScans.profileId, profileId))
    .orderBy(desc(geoGridScans.createdAt))
    .limit(1);

  return lastScan || null;
}
