import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import path from "path";

export default defineConfig({
  plugins: [solid(), tailwindcss(), wasm()],
  build: {
    target: "esnext",
  },
  resolve: {
    alias: {
      "~shared": path.resolve(__dirname, "../shared"),
    },
  },
  worker: {
    plugins: () => [wasm()],
  },
  server: {
    proxy: {
      "/parties": {
        target: "http://localhost:8787",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
