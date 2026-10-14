import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  server: {
    port: 8787,
    host: true,
  },
  plugins: [
    cloudflare(),
  ],
});
