import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // 本地开发：/api 代理到 wrangler dev（worker 目录）
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
