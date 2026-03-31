import { eq } from "drizzle-orm";
import { db } from "../db";
import { gbpLocations } from "../../drizzle/schema";
import { getValidGoogleAccessToken } from "./google-connection.service";

export async function syncVerificationForUser(userId: number) {
  const { accessToken } = await getValidGoogleAccessToken(userId);

  const locations = await db.query.gbpLocations.findMany({
    where: eq(gbpLocations.userId, userId)
  });

  let synced = 0;

  for (const location of locations) {
    try {
      // TEMPORÁRIO (pra não quebrar build)
      await db
        .update(gbpLocations)
        .set({
          updatedAt: new Date()
        })
        .where(eq(gbpLocations.id, location.id));

      synced++;
    } catch (err) {
      console.error("Erro:", err);
    }
  }

  return {
    total: locations.length,
    synced
  };
}
