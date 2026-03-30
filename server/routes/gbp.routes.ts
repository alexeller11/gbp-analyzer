import { Router } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { verifySessionToken } from "../auth/session";
import { importGoogleBusinessPortfolio } from "../services/google-import.service";
import { calculateGbpScore } from "../services/gbp-score.service";
import { generateAiAnalysis } from "../services/ai-insights.service";
import { syncVerificationForUser } from "../services/google-verification-sync.service";
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

router.post("/api/gbp/verification-sync", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const result = await syncVerificationForUser(userId);

    return res.status(200).json({
      ok: true,
      result
    });
  } catch (error: any) {
    console.error("Erro ao sincronizar verificação:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao sincronizar verificação"
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
    const portfolioType =
      typeof req.query.portfolioType === "string" ? req.query.portfolioType : null;

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
    const locationByBusinessId = new Map<number, (typeof allLocations)[number]>();

    for (const location of allLocations) {
      if (!locationByBusinessId.has(location.businessId)) {
        locationByBusinessId.set(location.businessId, location);
      }
    }

    const rows = allBusinesses
      .map((business) => {
        const location = locationByBusinessId.get(business.id) ?? null;
        const account = location ? accountMap.get(location.gbpAccountId) ?? null : null;

        const scoreData = calculateGbpScore({
          name: business.name,
          primaryCategory: business.primaryCategory,
          city: business.city,
          state: business.state,
          phone: business.phone,
          website: business.website,
          portfolioType: business.portfolioType,
          location: location
            ? {
                isVerified: location.isVerified,
                verificationState: location.verificationState,
                hasVoiceOfMerchant: location.hasVoiceOfMerchant,
                hasBusinessAuthority: location.hasBusinessAuthority
              }
            : null
        });

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
          portfolioType: business.portfolioType,
          notes: business.notes,
          aiSummaryJson: business.aiSummaryJson,
          lastAiAnalysisAt: business.lastAiAnalysisAt,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
          score: scoreData.score,
          opportunityScore: scoreData.opportunityScore,
          opportunityLevel: scoreData.opportunityLevel,
          effectiveVerified: scoreData.effectiveVerified,
          insights: scoreData.insights,
          priorities: scoreData.priorities,
          breakdown: scoreData.breakdown,
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
                hasVoiceOfMerchant: location.hasVoiceOfMerchant,
                hasBusinessAuthority: location.hasBusinessAuthority,
                verificationSource: location.verificationSource,
                lastImportedAt: location.lastImportedAt,
                lastSyncedAt: location.lastSyncedAt,
                lastVerificationSyncAt: location.lastVerificationSyncAt
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
        if (accountId && accountId !== "all" && row.account?.accountId !== accountId) {
          return false;
        }

        if (
          portfolioType &&
          portfolioType !== "all" &&
          row.portfolioType !== portfolioType
        ) {
          return false;
        }

        return true;
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

router.patch("/api/gbp/businesses/:id/classification", async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    const businessId = Number(req.params.id);
    const portfolioType = String(req.body?.portfolioType || "unclassified");
    const notes = req.body?.notes ? String(req.body.notes) : null;

    const allowed = ["client", "prospect", "ignore", "unclassified"];
    if (!allowed.includes(portfolioType)) {
      return res.status(400).json({
        ok: false,
        error: "portfolioType inválido"
      });
    }

    const target = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId)
    });

    if (!target || target.userId !== userId) {
      return res.status(404).json({
        ok: false,
        error: "Perfil não encontrado"
      });
    }

    const [updated] = await db
      .update(businesses)
      .set({
        portfolioType,
        notes,
        updatedAt: new Date()
      })
      .where(eq(businesses.id, businessId))
      .returning();

    return res.status(200).json({
      ok: true,
      business: updated
    });
  } catch (error: any) {
    console.error("Erro ao classificar perfil:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao classificar perfil"
    });
  }
});

router.post("/api/gbp/businesses/:id/ai-analysis", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        ok: false,
        error: "GEMINI_API_KEY não configurada no Railway"
      });
    }

    const userId = await getAuthenticatedUserId(req);
    const businessId = Number(req.params.id);

    const business = await db.query.businesses.findFirst({
      where: eq(businesses.id, businessId)
    });

    if (!business || business.userId !== userId) {
      return res.status(404).json({
        ok: false,
        error: "Perfil não encontrado"
      });
    }

    const location = await db.query.gbpLocations.findFirst({
      where: eq(gbpLocations.businessId, business.id)
    });

    const account = location
      ? await db.query.gbpAccounts.findFirst({
          where: eq(gbpAccounts.id, location.gbpAccountId)
        })
      : null;

    const scoreData = calculateGbpScore({
      name: business.name,
      primaryCategory: business.primaryCategory,
      city: business.city,
      state: business.state,
      phone: business.phone,
      website: business.website,
      portfolioType: business.portfolioType,
      location: location
        ? {
            isVerified: location.isVerified,
            verificationState: location.verificationState,
            hasVoiceOfMerchant: location.hasVoiceOfMerchant,
            hasBusinessAuthority: location.hasBusinessAuthority
          }
        : null
    });

    const aiResult = await generateAiAnalysis({
      name: business.name,
      primaryCategory: business.primaryCategory,
      city: business.city,
      state: business.state,
      phone: business.phone,
      website: business.website,
      accountName: account?.accountDisplayName ?? null,
      accountType: account?.accountType ?? null,
      score: scoreData.score,
      opportunityScore: scoreData.opportunityScore,
      opportunityLevel: scoreData.opportunityLevel,
      insights: scoreData.insights,
      priorities: scoreData.priorities,
      isVerified: scoreData.effectiveVerified,
      verificationState: location?.verificationState ?? null,
      portfolioType: business.portfolioType
    });

    const [updated] = await db
      .update(businesses)
      .set({
        aiSummaryJson: aiResult,
        lastAiAnalysisAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(businesses.id, business.id))
      .returning();

    return res.status(200).json({
      ok: true,
      ai: updated.aiSummaryJson,
      lastAiAnalysisAt: updated.lastAiAnalysisAt
    });
  } catch (error: any) {
    console.error("Erro ao gerar análise com IA:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao gerar análise com IA"
    });
  }
});

export default router;
