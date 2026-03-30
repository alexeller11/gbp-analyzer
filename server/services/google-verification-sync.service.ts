import { eq } from "drizzle-orm";
import { db } from "../db";
import { gbpLocations } from "../../drizzle/schema";
import { getValidGoogleAccessToken } from "./google-connection.service";
import { getVoiceOfMerchantState } from "../google/verification.service";

export async function syncVerificationForUser(userId: number) {
  const { accessToken } = await getValidGoogleAccessToken(userId);

  const locations = await db.query.gbpLocations.findMany({
    where: eq(gbpLocations.userId, userId)
  });

  let synced = 0;
  let confirmed = 0;

  for (const location of locations) {
    const state = await getVoiceOfMerchantState(accessToken, location.locationId);

    if (!state) {
      continue;
    }

    await db
      .update(gbpLocations)
      .set({
        hasVoiceOfMerchant: Boolean(state.hasVoiceOfMerchant),
        hasBusinessAuthority: Boolean(state.hasBusinessAuthority),
        verificationSource: "voice_of_merchant",
        verificationJson: state,
        lastVerificationSyncAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(gbpLocations.id, location.id));

    synced += 1;

    if (state.hasVoiceOfMerchant || state.hasBusinessAuthority) {
      confirmed += 1;
    }
  }

  return {
    totalLocations: locations.length,
    synced,
    confirmed
  };
}
