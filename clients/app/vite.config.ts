import react from "@vitejs/plugin-react";
import path from "path"
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { defineConfig } from "vite";

// Custom plugin for detailed logging
const logTimingsPlugin = () => {
	const startTime = Date.now();
	let buildStartTime = 0;
	
	return {
		name: 'log-timings',
		buildStart() {
			buildStartTime = Date.now();
			console.log(`[${new Date().toLocaleTimeString()}] 🏗️  Build started`);
		},
		resolveId(id: string, importer: string | undefined) {
			if (id.includes('@electric-sql') || id.includes('pglite')) {
				console.log(`[${new Date().toLocaleTimeString()}] 🔍 Resolving: ${id}`);
			}
		},
		load(id: string) {
			if (id.includes('@electric-sql') || id.includes('pglite')) {
				console.log(`[${new Date().toLocaleTimeString()}] 📂 Loading: ${id.split('/').slice(-2).join('/')}`);
			}
		},
		transform(code: string, id: string) {
			if (id.includes('@electric-sql') || id.includes('pglite')) {
				console.log(`[${new Date().toLocaleTimeString()}] ⚙️  Transforming: ${id.split('/').slice(-2).join('/')}`);
			}
		},
		buildEnd() {
			const buildDuration = ((Date.now() - buildStartTime) / 1000).toFixed(2);
			console.log(`[${new Date().toLocaleTimeString()}] ✅ Build completed in ${buildDuration}s`);
		},
		closeBundle() {
			const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
			console.log(`[${new Date().toLocaleTimeString()}] 🎉 Bundle closed. Total time: ${totalDuration}s`);
		}
	}
};

export default defineConfig({
	logLevel: 'info',
	plugins: [react(), tailwindcss()],
	resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
	  "@design-system": path.resolve(__dirname, "../../packages/design-system"),
    },
  },
	cacheDir: 'node_modules/.vite',
	optimizeDeps: {
		exclude: ['@electric-sql/pglite'],
		esbuildOptions: {
			define: {
				global: 'globalThis'
			}
		}
	},
	define: {
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
		global: 'globalThis',
	},
	base: "./",
	build: {
		outDir: "dist",
		emptyOutDir: false,
		reportCompressedSize: false,
		// Enable more aggressive caching
		minify: 'esbuild',
		target: 'esnext',
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
