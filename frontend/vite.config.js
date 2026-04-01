import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // During development, proxy API calls to FastAPI backend
      "/routines":    "http://localhost:8000",
      "/submissions": "http://localhost:8000",
      "/jobs":        "http://localhost:8000",
      "/uploads":     "http://localhost:8000",
      "/results":     "http://localhost:8000",
      "/health":      "http://localhost:8000",
    },
  },
});
