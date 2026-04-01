import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { gbpAccounts, businesses, gbpLocations } from "../../drizzle/schema.ts";
import { getValidGoogleAccessToken } from "./google-connection.service.ts";

function extractAccountId(name: string) {
  const parts = name.split("/");
  return parts[parts.length - 1] || name;
}

function extractLocationId(name: string) {
  const parts = name.split("/");
  return parts[parts.length - 1] || name;
}

function parseAddress(profile: any) {
  const address = profile?.storefrontAddress;

  if (!address) {
    return {
      city: null,
      state: null
    };
  }

  return {
    city: address.locality ? String(address.locality) : null,
    state: address.administrativeArea ? String(address.administrativeArea) : null
  };
}

function parsePrimaryCategory(profile: any) {
  const category = profile?.primaryCategory;
  if (!category) return null;

  if (category.displayName) return String(category.displayName);
  if (category.name) return String(category.name);

  return null;
}

function parsePhone(profile: any) {
  return profile?.phoneNumbers?.primaryPhone
    ? String(profile.phoneNumbers.primaryPhone)
    : null;
}

function parseWebsite(profile: any) {
  return profile?.websiteUri ? String(profile.websiteUri) : null;
}

export async function importGoogleBusinessAccounts(userId: number) {
  const { accessToken, connection } = await getValidGoogleAccessToken(userId);

  const response = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Erro ao buscar contas GBP:", data);
    throw new Error("Falha ao buscar contas do Google Business Profile");
  }

  const accounts = Array.isArray(data.accounts) ? data.accounts : [];

  let imported = 0;

  for (const account of accounts) {
    const googleAccountName = String(account.name || "");
    const accountId = extractAccountId(googleAccountName);
    const accountDisplayName = account.accountName ? String(account.accountName) : null;
    const accountType = account.type ? String(account.type) : null;

    const existing = await db.query.gbpAccounts.findFirst({
      where: eq(gbpAccounts.googleAccountName, googleAccountName)
    });

    if (!existing) {
      await db.insert(gbpAccounts).values({
        userId,
        googleConnectionId: connection.id,
        googleAccountName,
        accountId,
        accountDisplayName,
        accountType,
        rawJson: account,
        updatedAt: new Date()
      });

      imported += 1;
    } else {
      await db
        .update(gbpAccounts)
        .set({
          accountId,
          accountDisplayName,
          accountType,
          rawJson: account,
          updatedAt: new Date()
        })
        .where(eq(gbpAccounts.id, existing.id));
    }
  }

  const storedAccounts = await db.query.gbpAccounts.findMany({
    where: eq(gbpAccounts.userId, userId)
  });

  return {
    imported,
    totalDiscovered: accounts.length,
    totalStored: storedAccounts.length,
    accounts: storedAccounts.map((item) => ({
      id: item.id,
      accountId: item.accountId,
      accountDisplayName: item.accountDisplayName,
      accountType: item.accountType,
      googleAccountName: item.googleAccountName
    }))
  };
}

export async function importGoogleBusinessLocations(userId: number) {
  const { accessToken } = await getValidGoogleAccessToken(userId);

  const accounts = await db.query.gbpAccounts.findMany({
    where: eq(gbpAccounts.userId, userId)
  });

  let accountsProcessed = 0;
  let locationsImported = 0;
  let businessesImported = 0;
  const collected: any[] = [];

  for (const account of accounts) {
    accountsProcessed += 1;

    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.googleAccountName}/locations?readMask=name,title,storeCode,languageCode,websiteUri,phoneNumbers,storefrontAddress,primaryCategory,metadata`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Erro ao buscar locations da conta ${account.googleAccountName}:`, data);
      continue;
    }

    const locations = Array.isArray(data.locations) ? data.locations : [];

    for (const profile of locations) {
      const googleLocationName = String(profile.name || "");
      const locationId = extractLocationId(googleLocationName);
      const title = profile.title ? String(profile.title) : "Sem título";

      const { city, state } = parseAddress(profile);
      const primaryCategory = parsePrimaryCategory(profile);
      const phone = parsePhone(profile);
      const website = parseWebsite(profile);

      const metadata = profile.metadata || null;
      const verificationState = metadata?.verification?.verificationState
        ? String(metadata.verification.verificationState)
        : null;

      const isVerified = verificationState === "VERIFIED";

      let business = await db.query.businesses.findFirst({
        where: eq(businesses.googleLocationKey, googleLocationName)
      });

      if (!business) {
        const insertedBusiness = await db
          .insert(businesses)
          .values({
            userId,
            source: "google_import",
            status: "active",
            name: title,
            primaryCategory,
            city,
            state,
            phone,
            website,
            googleLocationKey: googleLocationName,
            updatedAt: new Date()
          })
          .returning();

        business = insertedBusiness[0];
        businessesImported += 1;
      } else {
        const updatedBusiness = await db
          .update(businesses)
          .set({
            name: title,
            primaryCategory,
            city,
            state,
            phone,
            website,
            updatedAt: new Date()
          })
          .where(eq(businesses.id, business.id))
          .returning();

        business = updatedBusiness[0];
      }

      const existingLocation = await db.query.gbpLocations.findFirst({
        where: eq(gbpLocations.googleLocationName, googleLocationName)
      });

      if (!existingLocation) {
        await db.insert(gbpLocations).values({
          businessId: business.id,
          userId,
          gbpAccountId: account.id,
          googleLocationName,
          locationId,
          title,
          storeCode: profile.storeCode ? String(profile.storeCode) : null,
          languageCode: profile.languageCode ? String(profile.languageCode) : null,
          verificationState,
          isVerified,
          metadataJson: metadata,
          profileJson: profile,
          lastImportedAt: new Date(),
          lastSyncedAt: new Date(),
          updatedAt: new Date()
        });

        locationsImported += 1;
      } else {
        await db
          .update(gbpLocations)
          .set({
            businessId: business.id,
            gbpAccountId: account.id,
            title,
            storeCode: profile.storeCode ? String(profile.storeCode) : null,
            languageCode: profile.languageCode ? String(profile.languageCode) : null,
            verificationState,
            isVerified,
            metadataJson: metadata,
            profileJson: profile,
            lastImportedAt: new Date(),
            lastSyncedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(gbpLocations.id, existingLocation.id));
      }

      collected.push({
        accountId: account.accountId,
        accountDisplayName: account.accountDisplayName,
        locationId,
        title,
        verificationState
      });
    }
  }

  return {
    accountsProcessed,
    locationsImported,
    businessesImported,
    totalCollected: collected.length,
    sample: collected.slice(0, 20)
  };
}
