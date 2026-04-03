import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db.ts";
import { gbpAccounts, gbpLocations, businesses } from "../../drizzle/schema.ts";
import { verifySessionToken } from "../auth/session.ts";
import {
  importGoogleBusinessAccounts,
  importGoogleBusinessLocations,
  syncGoogleBusinessLocationDetails
} from "../services/google-import.service.ts";
import {
  refreshBusinessScores,
  getAgencyDashboard
} from "../services/dashboard.service.ts";

const router = Router();

function parseSessionUserId(rawId: unknown): number | null {
  if (typeof rawId !== "string" && typeof rawId !== "number") {
    return null;
  }

  const numericUserId = Number(rawId);

  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    return null;
  }

  return numericUserId;
}

async function getAuthenticatedUserId(req: any) {
  const token = req.cookies?.gbp_session;

  if (!token) {
    throw new Error("Não autenticado");
  }

  const session = await verifySessionToken(token);
  const userId = parseSessionUserId(session.id);

  if (!userId) {
    throw new Error("Sessão inválida");
  }

  return userId;
}

router.post("/api/gbp/import", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await importGoogleBusinessAccounts(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao importar contas GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao importar contas GBP"
    });
  }
});

router.post("/api/gbp/import-locations", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await importGoogleBusinessLocations(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao importar locations GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao importar locations GBP"
    });
  }
});

router.post("/api/gbp/sync-location-details", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await syncGoogleBusinessLocationDetails(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao sincronizar detalhes das locations:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao sincronizar detalhes das locations"
    });
  }
});

router.post("/api/gbp/refresh-scores", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await refreshBusinessScores(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao atualizar scores:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao atualizar scores"
    });
  }
});

router.post("/api/gbp/businesses/:businessId/update", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const businessId = Number(req.params.businessId);

    if (!Number.isFinite(businessId) || businessId <= 0) {
      return res.status(400).json({
        ok: false,
        error: "businessId inválido"
      });
    }

    const existing = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId)
    });

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({
        ok: false,
        error: "Empresa não encontrada"
      });
    }

    const payload = req.body || {};

    const [updated] = await db
      .update(businesses)
      .set({
        name: payload.name ?? existing.name,
        primaryCategory: payload.primaryCategory ?? existing.primaryCategory,
        city: payload.city ?? existing.city,
        state: payload.state ?? existing.state,
        phone: payload.phone ?? existing.phone,
        website: payload.website ?? existing.website,
        leadType: payload.leadType ?? existing.leadType,
        updatedAt: new Date()
      })
      .where(eq(businesses.id, businessId))
      .returning();

    return res.status(200).json({
      ok: true,
      business: updated
    });
  } catch (error: any) {
    console.error("Erro ao atualizar empresa:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao atualizar empresa"
    });
  }
});

router.get("/api/gbp/dashboard", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await getAgencyDashboard(userId);
    return res.status(200).json({
      ok: true,
      ...result
    });
  } catch (error: any) {
    console.error("Erro ao carregar dashboard GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao carregar dashboard GBP"
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

    return res.status(200).json({
      ok: true,
      accounts: accounts.map((item) => ({
        id: item.id,
        accountId: item.accountId,
        accountDisplayName: item.accountDisplayName,
        accountType: item.accountType,
        googleAccountName: item.googleAccountName,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    });
  } catch (error: any) {
    console.error("Erro ao listar contas GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao listar contas GBP"
    });
  }
});

router.get("/api/gbp/locations", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);

    const locations = await db.query.gbpLocations.findMany({
      where: eq(gbpLocations.userId, userId),
      orderBy: [asc(gbpLocations.title)]
    });

    const allBusinesses = await db.query.businesses.findMany({
      where: eq(businesses.userId, userId)
    });

    const allAccounts = await db.query.gbpAccounts.findMany({
      where: eq(gbpAccounts.userId, userId)
    });

    const businessMap = new Map(allBusinesses.map((item) => [item.id, item]));
    const accountMap = new Map(allAccounts.map((item) => [item.id, item]));

    return res.status(200).json({
      ok: true,
      locations: locations.map((location) => ({
        id: location.id,
        title: location.title,
        locationId: location.locationId,
        googleLocationName: location.googleLocationName,
        verificationState: location.verificationState,
        isVerified: location.isVerified,
        account: accountMap.get(location.gbpAccountId)
          ? {
              id: accountMap.get(location.gbpAccountId)!.id,
              accountId: accountMap.get(location.gbpAccountId)!.accountId,
              accountDisplayName: accountMap.get(location.gbpAccountId)!.accountDisplayName,
              accountType: accountMap.get(location.gbpAccountId)!.accountType
            }
          : null,
        business: businessMap.get(location.businessId)
          ? {
              id: businessMap.get(location.businessId)!.id,
              name: businessMap.get(location.businessId)!.name,
              primaryCategory: businessMap.get(location.businessId)!.primaryCategory,
              city: businessMap.get(location.businessId)!.city,
              state: businessMap.get(location.businessId)!.state,
              phone: businessMap.get(location.businessId)!.phone,
              website: businessMap.get(location.businessId)!.website,
              score: businessMap.get(location.businessId)!.score,
              leadType: businessMap.get(location.businessId)!.leadType
            }
          : null
      }))
    });
  } catch (error: any) {
    console.error("Erro ao listar locations GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao listar locations GBP"
    });
  }
});

export default router;
