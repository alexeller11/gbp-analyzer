import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Força o carregamento do arquivo .env
dotenv.config();

export default defineConfig({
  schema: "./drizzle/schema.ts", 
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});