import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../drizzle/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurado");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const db = drizzle(pool, { schema });

export async function testDatabaseConnection() {
  const client = await pool.connect();
  try {
    await client.query("select 1");
    console.log("Banco conectado com sucesso:", new Date().toISOString());
  } finally {
    client.release();
  }
}
