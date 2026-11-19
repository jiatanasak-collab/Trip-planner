import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PORT = Number(process.env.API_PORT || 8787);

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
  build: { chunkSizeWarningLimit: 800, outDir: process.env.VITE_OUT_DIR || "dist" },
  server: {
    proxy: { "/api": `http://localhost:${API_PORT}` },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
} as any);
