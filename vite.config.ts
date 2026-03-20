import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import url from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
      // Garante que o runtime do React seja o correto para produção
      jsxRuntime: 'automatic',
    }), 
    tailwindcss()
  ],
  root: path.resolve(__dirname, "client"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Previne erros de resolução de módulos básicos do React
    rollupOptions: {
      external: [],
    },
  },
  server: {
    host: true,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
