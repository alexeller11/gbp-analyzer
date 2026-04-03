import { eq } from "drizzle-orm";
import { db } from "../db.ts";
import { businesses, gbpLocations, gbpAccounts } from "../../drizzle/schema.ts";

function calculateBusinessScore(params: {
  website: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  primaryCategory: string | null;
  isVerified: boolean;
}) {
  let score = 0;

  if (params.website) score += 20;
  if (params.phone) score += 15;
  if (params.city) score += 10;
  if (params.state) score += 10;
  if (params.primaryCategory) score += 20;
  if (params.isVerified) score += 25;

  return score;
}

function inferLeadType(score: number) {
  return score >= 40 ? "client" : "prospect";
}

export async function refreshBusinessScores(userId: number) {
  const allLocations = await db.query.gbpLocations.findMany({
    where: eq(gbpLocations.userId, userId)
  });

  const allBusinesses = await db.query.businesses.findMany({
    where: eq(businesses.userId, userId)
  });

  const businessMap = new Map(allBusinesses.map((item) => [item.id, item]));

  let updated = 0;

  for (const location of allLocations) {
    const business = businessMap.get(location.businessId);
    if (!business) continue;

    const score = calculateBusinessScore({
      website: business.website,
      phone: business.phone,
      city: business.city,
      state: business.state,
      primaryCategory: business.primaryCategory,
      isVerified: location.isVerified
    });

    const leadType = business.leadType === "client" || business.leadType === "prospect"
      ? business.leadType
      : inferLeadType(score);

    await db
      .update(businesses)
      .set({
        score,
        leadType,
        updatedAt: new Date()
      })
      .where(eq(businesses.id, business.id));

    updated += 1;
  }

  return {
    updated
  };
}

export async function getAgencyDashboard(userId: number) {
  const allAccounts = await db.query.gbpAccounts.findMany({
    where: eq(gbpAccounts.userId, userId)
  });

  const allLocations = await db.query.gbpLocations.findMany({
    where: eq(gbpLocations.userId, userId)
  });

  const allBusinesses = await db.query.businesses.findMany({
    where: eq(businesses.userId, userId)
  });

  const businessMap = new Map(allBusinesses.map((item) => [item.id, item]));
  const accountMap = new Map(allAccounts.map((item) => [item.id, item]));

  const rows = allLocations.map((location) => {
    const business = businessMap.get(location.businessId);
    const account = accountMap.get(location.gbpAccountId);

    return {
      id: location.id,
      title: location.title,
      locationId: location.locationId,
      isVerified: location.isVerified,
      verificationState: location.verificationState,
      accountId: account?.accountId || null,
      accountDisplayName: account?.accountDisplayName || null,
      accountType: account?.accountType || null,
      businessId: business?.id || null,
      businessName: business?.name || location.title,
      primaryCategory: business?.primaryCategory || null,
      city: business?.city || null,
      state: business?.state || null,
      phone: business?.phone || null,
      website: business?.website || null,
      score: business?.score || 0,
      leadType: business?.leadType || "prospect"
    };
  });

  const totalProfiles = rows.length;
  const totalAccounts = allAccounts.length;
  const totalClients = rows.filter((item) => item.leadType === "client").length;
  const totalProspects = rows.filter((item) => item.leadType === "prospect").length;
  const totalWithWebsite = rows.filter((item) => !!item.website).length;
  const totalVerified = rows.filter((item) => item.isVerified).length;

  const accountsSummary = allAccounts.map((account) => {
    const accountRows = rows.filter((row) => row.accountId === account.accountId);

    return {
      accountId: account.accountId,
      accountDisplayName: account.accountDisplayName,
      accountType: account.accountType,
      profiles: accountRows.length,
      clients: accountRows.filter((item) => item.leadType === "client").length,
      prospects: accountRows.filter((item) => item.leadType === "prospect").length,
      withWebsite: accountRows.filter((item) => !!item.website).length,
      avgScore:
        accountRows.length > 0
          ? Math.round(
              accountRows.reduce((sum, item) => sum + item.score, 0) / accountRows.length
            )
          : 0
    };
  });

  const topProfiles = [...rows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return {
    summary: {
      totalProfiles,
      totalAccounts,
      totalClients,
      totalProspects,
      totalWithWebsite,
      totalVerified
    },
    accountsSummary,
    topProfiles,
    rows
  };
}
