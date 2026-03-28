import { Router } from "express";

const router = Router();

router.get("/api/system/status", async (_req, res) => {
  return res.status(200).json({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || null,
    nodeEnv: process.env.NODE_ENV || null
  });
});

export default router;
