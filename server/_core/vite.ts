import express from "express";
import type { Express } from "express";
import fs from "fs";
import path from "path";
import type { Server } from "http";

export async function setupVite(app: Express, server: Server) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");

  if (!fs.existsSync(distPath)) {
    console.warn(`[Static] dist/public não encontrado em ${distPath}`);
    app.use("*", (_req, res) => {
      res.status(503).send("App não buildado. Execute: pnpm build");
    });
    return;
  }

  app.use(express.static(distPath));

  // SPA fallback — todas as rotas retornam index.html
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
