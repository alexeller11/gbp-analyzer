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
