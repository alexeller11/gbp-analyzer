import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db } from "../db.ts";
import { gbpAccounts } from "../../drizzle/schema.ts";
import { verifySessionToken } from "../auth/session.ts";
import { importGoogleBusinessAccounts } from "../services/google-import.service.ts";

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

    return res.status(200).json({
      ok: true,
      result
    });
  } catch (error: any) {
    console.error("Erro ao importar contas GBP:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Erro ao importar contas GBP"
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

export default router;
