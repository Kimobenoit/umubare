import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  publicDir: "public",
  build: {
    outDir: "www",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://umubareapp.onrender.com",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
