import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não configurado");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool PostgreSQL:", err);
});

export const db = drizzle(pool, { schema });

export async function testDatabaseConnection() {
  const client = await pool.connect();
  try {
    const result = await client.query("select now() as now");
    console.log("Banco conectado com sucesso:", result.rows[0]?.now);
    return true;
  } finally {
    client.release();
  }
}
