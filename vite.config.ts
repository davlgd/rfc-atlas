import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { generateSeoPages } from "./scripts/lib/seo-pages.ts";
import { DATA_CONFIG } from "./src/config.ts";

function seoPrerender(siteUrl: string): Plugin {
  return {
    name: "rfc-atlas-seo-prerender",
    apply: "build",
    async closeBundle() {
      const pageCount = await generateSeoPages(
        resolve(process.cwd(), "public", `.${DATA_CONFIG.graphPath}`),
        resolve(process.cwd(), "dist"),
        siteUrl,
      );
      console.log(`SEO: pre-rendered ${pageCount.toLocaleString("en-US")} RFC pages`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const { VITE_SITE_URL } = loadEnv(mode, ".", "VITE_");
  if (!VITE_SITE_URL) throw new Error("VITE_SITE_URL must be defined");
  const siteHostname = new URL(VITE_SITE_URL).hostname;
  const port = Number.parseInt(process.env.PORT ?? "4173", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    plugins: [react(), seoPrerender(VITE_SITE_URL)],
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("/node_modules/three/")) return "three";
          },
        },
      },
    },
    server: { port: 4173 },
    preview: { host: "0.0.0.0", port, strictPort: true, allowedHosts: [siteHostname] },
  };
});
