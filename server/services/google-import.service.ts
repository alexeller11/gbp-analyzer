import { and, eq } from "drizzle-orm";
import { db } from "../db.ts";
import { gbpAccounts, businesses, gbpLocations } from "../../drizzle/schema.ts";
import { getValidGoogleAccessToken } from "./google-connection.service.ts";
import { discoverAllAccounts } from "../google/gbp.service.ts";

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
    return { city: null, state: null };
  }

  return {
    city: address.locality ? String(address.locality) : null,
    state: address.administrativeArea ? String(address.administrativeArea) : null
  };
}

function parsePrimaryCategory(profile: any) {
  const category = profile?.primaryCategory || profile?.categories?.primaryCategory;
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

function parseVerificationState(profile: any) {
  const metadata = profile?.metadata;
  if (!metadata) return null;
  if (metadata.verification?.verificationState) {
    return String(metadata.verification.verificationState);
  }
  return null;
}

async function fetchAllLocationsForAccount(
  accessToken: string,
  googleAccountName: string
) {
  const safeReadMask = "name,title";

  let nextPageToken = "";
  const allLocations: any[] = [];

  do {
    const url = new URL(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${googleAccountName}/locations`
    );
    url.searchParams.set("readMask", safeReadMask);
    url.searchParams.set("pageSize", "100");

    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false as const,
        error: data,
        locations: [] as any[]
      };
    }

    const locations = Array.isArray(data.locations) ? data.locations : [];
    allLocations.push(...locations);
    nextPageToken = data.nextPageToken ? String(data.nextPageToken) : "";
  } while (nextPageToken);

  return {
    ok: true as const,
    locations: allLocations
  };
}

async function fetchLocationDetailsWithMask(
  accessToken: string,
  googleLocationName: string,
  readMask: string
) {
  const url = new URL(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${googleLocationName}`
  );
  url.searchParams.set("readMask", readMask);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false as const,
      error: data,
      location: null
    };
  }

  return {
    ok: true as const,
    location: data
  };
}

async function fetchLocationDetails(accessToken: string, googleLocationName: string) {
  const masks = [
    "name,title,storeCode,languageCode,websiteUri,phoneNumbers,storefrontAddress,primaryCategory,categories,metadata",
    "name,title,storeCode,languageCode,websiteUri",
    "name,title"
  ];

  for (const mask of masks) {
    const result = await fetchLocationDetailsWithMask(
      accessToken,
      googleLocationName,
      mask
    );

    if (result.ok) {
      return {
        ok: true as const,
        location: result.location,
        usedMask: mask
      };
    }
  }

  return {
    ok: false as const,
    error: "detail_fetch_failed",
    location: null,
    usedMask: null
  };
}

export async function importGoogleBusinessAccounts(userId: number) {
  const { accessToken, connection } = await getValidGoogleAccessToken(userId);
  const accounts = await discoverAllAccounts(accessToken);

  let imported = 0;

  for (const account of accounts) {
    const googleAccountName = String(account.name || "");
    const accountId = extractAccountId(googleAccountName);
    const accountDisplayName = account.accountName ? String(account.accountName) : null;
    const accountType = account.type ? String(account.type) : null;

    const existing = await db.query.gbpAccounts.findFirst({
      where: and(
        eq(gbpAccounts.userId, userId),
        eq(gbpAccounts.googleAccountName, googleAccountName)
      )
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

  const accountSyncResult = await importGoogleBusinessAccounts(userId);

  const accounts = await db.query.gbpAccounts.findMany({
    where: eq(gbpAccounts.userId, userId)
  });

  let accountsProcessed = 0;
  let locationsImported = 0;
  let businessesImported = 0;
  const collected: any[] = [];
  const accountDiagnostics: any[] = [];

  for (const account of accounts) {
    accountsProcessed += 1;

    const result = await fetchAllLocationsForAccount(accessToken, account.googleAccountName);

    if (!result.ok) {
      accountDiagnostics.push({
        accountId: account.accountId,
        accountDisplayName: account.accountDisplayName,
        accountType: account.accountType,
        googleAccountName: account.googleAccountName,
        locationsFound: 0,
        status: "error",
        error: result.error
      });
      continue;
    }

    const locations = result.locations;

    accountDiagnostics.push({
      accountId: account.accountId,
      accountDisplayName: account.accountDisplayName,
      accountType: account.accountType,
      googleAccountName: account.googleAccountName,
      locationsFound: locations.length,
      status: "ok"
    });

    for (const rawProfile of locations) {
      const googleLocationName = String(rawProfile.name || "");
      const locationId = extractLocationId(googleLocationName);

      const detailResult = await fetchLocationDetails(accessToken, googleLocationName);
      const profile =
        detailResult.ok && detailResult.location ? detailResult.location : rawProfile;

      const title = profile.title ? String(profile.title) : "Sem título";
      const { city, state } = parseAddress(profile);
      const primaryCategory = parsePrimaryCategory(profile);
      const phone = parsePhone(profile);
      const website = parseWebsite(profile);
      const verificationState = parseVerificationState(profile);
      const isVerified = verificationState === "VERIFIED";

      const existingBusinesses = await db
        .select({
          id: businesses.id,
          userId: businesses.userId,
          name: businesses.name,
          primaryCategory: businesses.primaryCategory,
          city: businesses.city,
          state: businesses.state,
          phone: businesses.phone,
          website: businesses.website,
          googleLocationKey: businesses.googleLocationKey
        })
        .from(businesses)
        .where(
          and(
            eq(businesses.userId, userId),
            eq(businesses.googleLocationKey, googleLocationName)
          )
        )
        .limit(1);

      let business = existingBusinesses[0];

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
            primaryCategory: primaryCategory ?? business.primaryCategory,
            city: city ?? business.city,
            state: state ?? business.state,
            phone: phone ?? business.phone,
            website: website ?? business.website,
            updatedAt: new Date()
          })
          .where(eq(businesses.id, business.id))
          .returning();

        business = updatedBusiness[0];
      }

      const existingLocation = await db.query.gbpLocations.findFirst({
        where: and(
          eq(gbpLocations.userId, userId),
          eq(gbpLocations.googleLocationName, googleLocationName)
        )
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
          metadataJson: profile.metadata || null,
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
            verificationState: verificationState ?? existingLocation.verificationState,
            isVerified: isVerified || existingLocation.isVerified,
            metadataJson: profile.metadata || existingLocation.metadataJson,
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
        primaryCategory,
        city,
        state,
        phone,
        website,
        verificationState,
        usedMask: detailResult.ok ? detailResult.usedMask : null
      });
    }
  }

  return {
    accountsDiscovered: accountSyncResult.totalDiscovered,
    accountsSynced: accountSyncResult.totalStored,
    accountsProcessed,
    locationsImported,
    businessesImported,
    totalCollected: collected.length,
    sample: collected.slice(0, 20),
    diagnostics: accountDiagnostics
  };
}

export async function syncGoogleBusinessLocationDetails(userId: number) {
  const { accessToken } = await getValidGoogleAccessToken(userId);

  const locations = await db.query.gbpLocations.findMany({
    where: eq(gbpLocations.userId, userId)
  });

  let synced = 0;
  let enriched = 0;
  const errors: any[] = [];
  const sample: any[] = [];

  for (const location of locations) {
    const detailResult = await fetchLocationDetails(accessToken, location.googleLocationName);

    if (!detailResult.ok || !detailResult.location) {
      errors.push({
        locationId: location.locationId,
        googleLocationName: location.googleLocationName,
        error: detailResult.error || "unknown_error"
      });
      continue;
    }

    const profile = detailResult.location;
    const title = profile.title ? String(profile.title) : location.title;
    const { city, state } = parseAddress(profile);
    const primaryCategory = parsePrimaryCategory(profile);
    const phone = parsePhone(profile);
    const website = parseWebsite(profile);
    const verificationState = parseVerificationState(profile);
    const isVerified = verificationState === "VERIFIED";

    await db
      .update(gbpLocations)
      .set({
        title,
        storeCode: profile.storeCode ? String(profile.storeCode) : null,
        languageCode: profile.languageCode ? String(profile.languageCode) : null,
        verificationState: verificationState ?? location.verificationState,
        isVerified: isVerified || location.isVerified,
        metadataJson: profile.metadata || location.metadataJson,
        profileJson: profile,
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(gbpLocations.id, location.id));

    await db
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
      .where(eq(businesses.id, location.businessId));

    synced += 1;

    if (primaryCategory || city || state || phone || website || verificationState) {
      enriched += 1;
    }

    if (sample.length < 20) {
      sample.push({
        locationId: location.locationId,
        title,
        primaryCategory,
        city,
        state,
        phone,
        website,
        verificationState,
        usedMask: detailResult.usedMask
      });
    }
  }

  return {
    totalLocations: locations.length,
    synced,
    enriched,
    sample,
    errors: errors.slice(0, 20)
  };
}
