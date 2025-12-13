import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	build: {
		outDir: "dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				index: resolve(__dirname, "index.html"),
				popup: resolve(__dirname, "popup.html"),
				background: resolve(__dirname, "src/background.ts"),
				worker: resolve(__dirname, "src/worker.ts"),
			},
			output: {
				entryFileNames: (chunkInfo) => {
					// Keep background.js and worker.js at root level
					if (chunkInfo.name === "background" || chunkInfo.name === "worker") {
						return "[name].js";
					}
					return "assets/[name]-[hash].js";
				},
				chunkFileNames: "assets/[name]-[hash].js",
				assetFileNames: (assetInfo) => {
					const name = assetInfo.name || '';
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
