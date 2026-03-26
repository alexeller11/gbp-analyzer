import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  gbpAccounts,
  businesses,
  gbpLocations
} from "../../drizzle/schema";
import { getValidGoogleAccessToken } from "./google-connection.service";
import {
  listAccounts,
  listLocations,
  parseAccountId,
  parseLocationId
} from "../google/gbp.service";

export async function importGoogleBusinessPortfolio(userId: number) {
  const { accessToken, connection } = await getValidGoogleAccessToken(userId);

  if (!connection.googleBusinessConnected) {
    throw new Error("Google Business Profile ainda não está conectado");
  }

  const accounts = await listAccounts(accessToken);

  const result = {
    accountsImported: 0,
    locationsImported: 0,
    businessesImported: 0,
    accounts: [] as Array<{
      accountId: string;
      accountName: string | null;
      locations: number;
    }>
  };

  for (const account of accounts) {
    const accountId = parseAccountId(account.name);

    let dbAccount = await db.query.gbpAccounts.findFirst({
      where: eq(gbpAccounts.googleAccountName, account.name)
    });

    if (!dbAccount) {
      const [createdAccount] = await db
        .insert(gbpAccounts)
        .values({
          userId,
          googleConnectionId: connection.id,
          googleAccountName: account.name,
          accountId,
          accountDisplayName: account.accountName ?? null,
          accountType: account.type ?? null,
          rawJson: account
        })
        .returning();

      dbAccount = createdAccount;
      result.accountsImported++;
    } else {
      const [updatedAccount] = await db
        .update(gbpAccounts)
        .set({
          accountDisplayName: account.accountName ?? null,
          accountType: account.type ?? null,
          rawJson: account,
          updatedAt: new Date()
        })
        .where(eq(gbpAccounts.id, dbAccount.id))
        .returning();

      dbAccount = updatedAccount;
    }

    const locations = await listLocations(accessToken, accountId);

    result.accounts.push({
      accountId,
      accountName: account.accountName ?? null,
      locations: locations.length
    });

    for (const location of locations) {
      const locationId = parseLocationId(location.name);
      const city = location.storefrontAddress?.locality ?? null;
      const state = location.storefrontAddress?.administrativeArea ?? null;
      const phone = location.phoneNumbers?.primaryPhone ?? null;
      const website = location.websiteUri ?? null;
      const primaryCategory =
        location.categories?.primaryCategory?.displayName ??
        location.categories?.primaryCategory?.name ??
        null;

      let business = await db.query.businesses.findFirst({
        where: eq(businesses.googleLocationKey, location.name)
      });

      if (!business) {
        const [createdBusiness] = await db
          .insert(businesses)
          .values({
            userId,
            source: "google_import",
            status: "active",
            name: location.title,
            primaryCategory,
            city,
            state,
            phone,
            website,
            googleLocationKey: location.name
          })
          .returning();

        business = createdBusiness;
        result.businessesImported++;
      } else {
        const [updatedBusiness] = await db
          .update(businesses)
          .set({
            name: location.title,
            primaryCategory,
            city,
            state,
            phone,
            website,
            updatedAt: new Date()
          })
          .where(eq(businesses.id, business.id))
          .returning();

        business = updatedBusiness;
      }

      const verificationState =
        typeof location.metadata?.["verificationState"] === "string"
          ? String(location.metadata["verificationState"])
          : null;

      const isVerified = verificationState === "VERIFIED";

      const existingLocation = await db.query.gbpLocations.findFirst({
        where: eq(gbpLocations.googleLocationName, location.name)
      });

      if (!existingLocation) {
        await db
          .insert(gbpLocations)
          .values({
            businessId: business.id,
            userId,
            gbpAccountId: dbAccount.id,
            googleLocationName: location.name,
            locationId,
            title: location.title,
            storeCode: location.storeCode ?? null,
            languageCode: location.languageCode ?? null,
            verificationState,
            isVerified,
            metadataJson: location.metadata ?? null,
            profileJson: location.profile ?? null,
            lastImportedAt: new Date()
          });

        result.locationsImported++;
      } else {
        await db
          .update(gbpLocations)
          .set({
            businessId: business.id,
            gbpAccountId: dbAccount.id,
            title: location.title,
            storeCode: location.storeCode ?? null,
            languageCode: location.languageCode ?? null,
            verificationState,
            isVerified,
            metadataJson: location.metadata ?? null,
            profileJson: location.profile ?? null,
            lastImportedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(gbpLocations.id, existingLocation.id));
      }
    }
  }

  return result;
}
