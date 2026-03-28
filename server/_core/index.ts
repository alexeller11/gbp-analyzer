import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { testDatabaseConnection } from "../db";
import googleAuthRoutes from "../routes/google-auth.routes";
import gbpRoutes from "../routes/gbp.routes";
import systemRoutes from "../routes/system.routes";

const app = express();
const PORT = Number(process.env.PORT || 8080);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, "public");
const indexHtmlPath = path.join(publicPath, "index.html");

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(googleAuthRoutes);
app.use(gbpRoutes);
app.use(systemRoutes);

app.get("/health", async (_req, res) => {
  try {
    await testDatabaseConnection();

    return res.status(200).json({
      ok: true,
      app: "gbp-analyzer",
      database: "connected"
    });
  } catch (error) {
    console.error("Erro no healthcheck:", error);

    return res.status(500).json({
      ok: false,
      app: "gbp-analyzer",
      database: "error"
    });
  }
});

if (existsSync(indexHtmlPath)) {
  app.use(express.static(publicPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) {
      return next();
    }

    return res.sendFile(indexHtmlPath);
  });
} else {
  app.get("/", (_req, res) => {
    return res.status(200).send("GBP Analyzer online");
  });
}

app.listen(PORT, async () => {
  console.log(`✅ GBP Analyzer ativo na porta ${PORT}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);

  try {
    await testDatabaseConnection();
  } catch (error) {
    console.error("Falha ao conectar no banco na inicialização:", error);
  }
});
