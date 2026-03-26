import { Router } from "express";
import { verifySessionToken } from "../auth/session";
import { importGoogleBusinessPortfolio } from "../services/google-import.service";

const router = Router();

async function getAuthenticatedUserId(req: any) {
  const token = req.cookies?.gbp_session;

  if (!token) {
    throw new Error("Não autenticado");
  }

  const user = await verifySessionToken(token);
  const numericUserId = Number(user.id);

  if (!Number.isFinite(numericUserId)) {
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

export default router;
