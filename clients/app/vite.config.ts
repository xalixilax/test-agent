import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig, type Plugin } from "vite";

const devAutoReload = (): Plugin => {
  let outDir = "";
  let watching = false;
  let backgroundHash: string | null = null;
  const bgStampPath = () => resolve(outDir, "dev-bg-stamp");
  return {
    name: "dev-auto-reload",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      watching = Boolean(config.build.watch);
      if (watching) {
        try {
          backgroundHash = readFileSync(bgStampPath(), "utf8").trim() || null;
        } catch {
          backgroundHash = null;
        }
      }
    },
    writeBundle(_options, bundle) {
      if (!watching) return;
      for (const file of Object.values(bundle)) {
        if (file.type !== "chunk" || file.fileName !== "background.js") continue;
        const hash = createHash("sha256").update(file.code).digest("hex");
        if (hash === backgroundHash) continue;
        backgroundHash = hash;
        writeFileSync(bgStampPath(), hash);
      }
      writeFileSync(resolve(outDir, "dev-reload-stamp"), String(Date.now()));
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), devAutoReload()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@design-system": path.resolve(__dirname, "../../packages/design-system"),
    },
  },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "production"),
    global: "globalThis",
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: false,
    reportCompressedSize: false,
    // Enable more aggressive caching
    minify: "esbuild",
    target: "esnext",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        popup: resolve(__dirname, "popup.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep background.js at root level
          if (chunkInfo.name === "background") {
            return "[name].js";
          }
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "";
          if (name === "index.html" || name === "popup.html" || name.endsWith(".html")) {
            return "[name][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  publicDir: "public",
});
