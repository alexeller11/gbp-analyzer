import "dotenv/config";
import express from "express";
import { testDatabaseConnection } from "../db";

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", async (_req, res) => {
  try {
    await testDatabaseConnection();
    return res.status(200).json({
      ok: true,
      app: "gbp-analyzer",
      database: "connected",
    });
  } catch (error) {
    console.error("Erro no healthcheck:", error);
    return res.status(500).json({
      ok: false,
      app: "gbp-analyzer",
      database: "error",
    });
  }
});

app.listen(PORT, async () => {
  console.log(`GBP Analyzer ativo na porta ${PORT}`);

  try {
    await testDatabaseConnection();
  } catch (error) {
    console.error("Falha ao conectar no banco na inicialização:", error);
  }
});
