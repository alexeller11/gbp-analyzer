import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db.ts";
import { gbpAccounts, gbpLocations, businesses } from "../../drizzle/schema.ts";
import { verifySessionToken } from "../auth/session.ts";
import * as googleImportService from "../services/google-import.service.ts";
import {
  refreshBusinessScores,
  getAgencyDashboard
} from "../services/dashboard.service.ts";
import { refreshBusinessInsights } from "../services/insights.service.ts";

const router = Router();

function getGoogleImportFunctions() {
  const defaultExport =
    (googleImportService as any).default && typeof (googleImportService as any).default === "object"
      ? (googleImportService as any).default
      : {};

  const importAccounts =
    googleImportService.importGoogleBusinessAccounts ||
    defaultExport.importGoogleBusinessAccounts ||
    defaultExport.importAccounts ||
    googleImportService.importGoogleBusinessLocations ||
    defaultExport.importGoogleBusinessLocations ||
    defaultExport.importLocations;
  const importLocations =
    googleImportService.importGoogleBusinessLocations ||
    defaultExport.importGoogleBusinessLocations ||
    defaultExport.importLocations;
  const syncLocationDetails =
    googleImportService.syncGoogleBusinessLocationDetails ||
    defaultExport.syncGoogleBusinessLocationDetails ||
    defaultExport.syncLocationDetails ||
    googleImportService.importGoogleBusinessLocations ||
    defaultExport.importGoogleBusinessLocations ||
    defaultExport.importLocations;

  if (
    typeof importLocations !== "function"
  ) {
    const available = Object.keys(googleImportService);
    const availableDefault = Object.keys(defaultExport);

    throw new Error(
      `Serviço de importação GBP inválido. Exports disponíveis: ${available.join(", ") || "nenhum"}; default: ${availableDefault.join(", ") || "nenhum"}`
    );
  }

  return {
    importAccounts: typeof importAccounts === "function" ? importAccounts : importLocations,
    importLocations,
    syncLocationDetails:
      typeof syncLocationDetails === "function" ? syncLocationDetails : importLocations
  };
}

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
    const { importAccounts } = getGoogleImportFunctions();
    const userId = await getAuthenticatedUserId(req);
    const result = await importAccounts(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao importar contas GBP:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao importar contas GBP" });
  }
});

router.post("/api/gbp/import-locations", async (req, res) => {
  try {
    const { importLocations } = getGoogleImportFunctions();
    const userId = await getAuthenticatedUserId(req);
    const result = await importLocations(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao importar locations GBP:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao importar locations GBP" });
  }
});

router.post("/api/gbp/sync-location-details", async (req, res) => {
  try {
    const { syncLocationDetails } = getGoogleImportFunctions();
    const userId = await getAuthenticatedUserId(req);
    const result = await syncLocationDetails(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao sincronizar detalhes das locations:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao sincronizar detalhes das locations" });
  }
});

router.post("/api/gbp/refresh-scores", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await refreshBusinessScores(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao atualizar scores:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao atualizar scores" });
  }
});

router.post("/api/gbp/refresh-insights", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await refreshBusinessInsights(userId);
    return res.status(200).json({ ok: true, result });
  } catch (error: any) {
    console.error("Erro ao atualizar insights:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao atualizar insights" });
  }
});

router.post("/api/gbp/businesses/:businessId/update", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const businessId = Number(req.params.businessId);

    if (!Number.isFinite(businessId) || businessId <= 0) {
      return res.status(400).json({ ok: false, error: "businessId inválido" });
    }

    const existing = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId)
    });

    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ ok: false, error: "Empresa não encontrada" });
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
        pipelineStage: payload.pipelineStage ?? existing.pipelineStage,
        notes: payload.notes ?? existing.notes,
        updatedAt: new Date()
      })
      .where(eq(businesses.id, businessId))
      .returning();

    return res.status(200).json({ ok: true, business: updated });
  } catch (error: any) {
    console.error("Erro ao atualizar empresa:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao atualizar empresa" });
  }
});

router.get("/api/gbp/dashboard", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await getAgencyDashboard(userId);
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    console.error("Erro ao carregar dashboard GBP:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao carregar dashboard GBP" });
  }
});

router.get("/api/gbp/account/:accountId/dashboard", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const requestedAccountId = String(req.params.accountId);

    const result = await getAgencyDashboard(userId);
    const rows = result.rows.filter((item) => item.accountId === requestedAccountId);

    return res.status(200).json({
      ok: true,
      account: result.accountsSummary.find((item) => item.accountId === requestedAccountId) || null,
      rows
    });
  } catch (error: any) {
    console.error("Erro ao carregar dashboard da conta:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao carregar dashboard da conta" });
  }
});

router.get("/api/gbp/export.csv", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await getAgencyDashboard(userId);

    const header = [
      "empresa",
      "conta",
      "pipeline",
      "status_atendimento",
      "prioridade",
      "score",
      "categoria",
      "cidade",
      "estado",
      "telefone",
      "site",
      "verificado"
    ];

    const lines = result.rows.map((row) => [
      row.businessName,
      row.accountDisplayName || "",
      row.pipelineStage,
      row.serviceStatus,
      row.priorityLevel,
      String(row.score),
      row.primaryCategory || "",
      row.city || "",
      row.state || "",
      row.phone || "",
      row.website || "",
      row.isVerified ? "sim" : "nao"
    ]);

    const csv = [header, ...lines]
      .map((line) =>
        line
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="gbp-carteira-clientes.csv"');
    return res.status(200).send(csv);
  } catch (error: any) {
    console.error("Erro ao exportar CSV:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao exportar CSV" });
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
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao listar contas GBP" });
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
              pipelineStage: businessMap.get(location.businessId)!.pipelineStage,
              serviceStatus: businessMap.get(location.businessId)!.serviceStatus,
              priorityLevel: businessMap.get(location.businessId)!.priorityLevel,
              priorityReason: businessMap.get(location.businessId)!.priorityReason,
              aiSummary: businessMap.get(location.businessId)!.aiSummary,
              notes: businessMap.get(location.businessId)!.notes
            }
          : null
      }))
    });
  } catch (error: any) {
    console.error("Erro ao listar locations GBP:", error);
    return res.status(500).json({ ok: false, error: error?.message || "Erro ao listar locations GBP" });
  }
});

export default router;
