import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes, registerLoginRoute } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const s = net.createServer();
    s.listen(port, () => { s.close(() => resolve(true)); });
    s.on("error", () => resolve(false));
  });
}

async function findPort(start = 3000): Promise<number> {
  for (let p = start; p < start + 20; p++) {
    if (await isPortAvailable(p)) return p;
  }
  throw new Error("Nenhuma porta disponível");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Rotas OAuth — devem vir ANTES do tRPC e do static
  registerLoginRoute(app);
  registerOAuthRoutes(app);

  // Rota de teste da Places API
  app.get("/api/test-places", async (req: any, res: any) => {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return res.json({ error: "GOOGLE_PLACES_API_KEY não definida" });
    const query = (req.query.q as string) || "Pizzaria";
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}&language=pt-BR`;
    const r = await fetch(url);
    const data = await r.json();
    res.json({ status: data.status, count: data.results?.length, first: data.results?.[0]?.name, error_message: data.error_message });
  });

  // tRPC API
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  // Frontend
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferred = parseInt(process.env.PORT || "3000");
  const port = await findPort(preferred);

  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ GBP Analyzer em http://localhost:${port}`);
    console.log(`   APP_URL: ${process.env.APP_URL || "(não definido)"}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   DATABASE: ${process.env.DATABASE_URL ? "✓ configurado" : "✗ faltando"}`);
    console.log(`   GOOGLE_OAUTH: ${process.env.GOOGLE_OAUTH_CLIENT_ID ? "✓ configurado" : "✗ faltando"}`);
  });
}

startServer().catch(console.error);
