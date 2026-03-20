import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes, registerLoginRoute } from "./oauth";
import { appRouter } from "./trpc"; // Importa do ficheiro na mesma pasta
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Autenticação e OAuth
  registerLoginRoute(app);
  registerOAuthRoutes(app);

  // tRPC middleware
  app.use("/api/trpc", createExpressMiddleware({ 
    router: appRouter, 
    createContext 
  }));

  // Servir Frontend
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ Servidor ativo na porta ${port}`);
  });
}

startServer().catch(console.error);
