import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes, registerLoginRoute } from "./oauth";
import { appRouter } from "./trpc"; // ALTERADO: Deve apontar para o trpc.ts na mesma pasta
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Rotas OAuth
  registerLoginRoute(app);
  registerOAuthRoutes(app);

  // tRPC API
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  // Frontend
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000");

  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ GBP Analyzer ativo na porta ${port}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  });
}

startServer().catch(console.error);
