import { calculateGbpScore } from "../services/gbp-score.service";
import { Router } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { verifySessionToken } from "../auth/session";
import { importGoogleBusinessPortfolio } from "../services/google-import.service";
import { db } from "../db";
import { gbpAccounts, gbpLocations, businesses } from "../../drizzle/schema";

const router = Router();

async function getAuthenticatedUserId(req: any) {
  const token = req.cookies?.gbp_session;

  if (!token) {
    throw new Error("Não autenticado");
  }

  const user = await verifySessionToken(token);
  const numericUserId = Number(user.id);

  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    throw new Error("Sessão inválida");
  }

  return numericUserId;
}

router.post("/api/gbp/import", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await importGoogleBusinessPortfolio(userId);

    return res.status(200).json({
      ok: true,
      result
    });
  } catch (error: any) {
    console.error("Erro ao importar portfolio GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao importar portfolio GBP"
    });
  }
});

router.get("/api/gbp/accounts", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);

    const accounts = await db.query.gbpAccounts.findMany({
      where: eq(gbpAccounts.userId, userId),
      orderBy: [asc(gbpAccounts.accountDisplayName), asc(gbpAccounts.accountId)]
    });

    const locations = await db.query.gbpLocations.findMany({
      where: eq(gbpLocations.userId, userId)
    });

    const locationsByAccountId = new Map<number, number>();
    for (const location of locations) {
      locationsByAccountId.set(
        location.gbpAccountId,
        (locationsByAccountId.get(location.gbpAccountId) ?? 0) + 1
      );
    }

    const payload = accounts.map((account) => ({
      id: account.id,
      googleAccountName: account.googleAccountName,
      accountId: account.accountId,
      accountDisplayName: account.accountDisplayName,
      accountType: account.accountType,
      locationsCount: locationsByAccountId.get(account.id) ?? 0,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    }));

    return res.status(200).json({
      ok: true,
      accounts: payload
    });
  } catch (error: any) {
    console.error("Erro ao listar contas GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao listar contas GBP"
    });
  }
});

router.get("/api/gbp/businesses", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const accountId = typeof req.query.accountId === "string" ? req.query.accountId : null;

    const allBusinesses = await db.query.businesses.findMany({
      where: eq(businesses.userId, userId),
      orderBy: [asc(businesses.name), desc(businesses.updatedAt)]
    });

    const allLocations = await db.query.gbpLocations.findMany({
      where: eq(gbpLocations.userId, userId),
      orderBy: [asc(gbpLocations.title)]
    });

    const allAccounts = await db.query.gbpAccounts.findMany({
      where: eq(gbpAccounts.userId, userId)
    });

    const accountMap = new Map(allAccounts.map((account) => [account.id, account]));
    const locationByBusinessId = new Map<number, typeof allLocations[number]>();

    for (const location of allLocations) {
      if (!locationByBusinessId.has(location.businessId)) {
        locationByBusinessId.set(location.businessId, location);
      }
    }

    const rows = allBusinesses
      .map((business) => {
        const location = locationByBusinessId.get(business.id);
        const account = location ? accountMap.get(location.gbpAccountId) : null;

        return {
          id: business.id,
          name: business.name,
          primaryCategory: business.primaryCategory,
          city: business.city,
          state: business.state,
          phone: business.phone,
          website: business.website,
          status: business.status,
          source: business.source,
          googleLocationKey: business.googleLocationKey,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
          location: location
            ? {
                id: location.id,
                googleLocationName: location.googleLocationName,
                locationId: location.locationId,
                title: location.title,
                storeCode: location.storeCode,
                languageCode: location.languageCode,
                verificationState: location.verificationState,
                isVerified: location.isVerified,
                lastImportedAt: location.lastImportedAt,
                lastSyncedAt: location.lastSyncedAt
              }
            : null,
          account: account
            ? {
                id: account.id,
                accountId: account.accountId,
                accountDisplayName: account.accountDisplayName,
                accountType: account.accountType,
                googleAccountName: account.googleAccountName
              }
            : null
        };
      })
      .filter((row) => {
        if (!accountId) return true;
        return row.account?.accountId === accountId;
      });

    return res.status(200).json({
      ok: true,
      businesses: rows,
      total: rows.length
    });
  } catch (error: any) {
    console.error("Erro ao listar negócios GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao listar negócios GBP"
    });
  }
});

export default router;
