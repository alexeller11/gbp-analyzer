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
      void accessToken;

      await db
        .update(gbpLocations)
        .set({
          updatedAt: new Date()
        })
        .where(eq(gbpLocations.id, location.id));

      synced += 1;
    } catch (error) {
      console.error(
        "Erro ao sincronizar verificação da location:",
        location.locationId,
        error
      );
    }
  }

  return {
    total: locations.length,
    synced
  };
}
