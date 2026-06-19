import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react({
			// Exclude Tiled .tsx tileset files from being processed as TypeScript JSX
			exclude: ["**/assets/**"],
		}),
	],
	base: process.env.VITE_BASE_PATH || "/",
	assetsInclude: [
		"**/*.tmx",
		"**/*.tmj",
		"**/*.tsj",
		"**/*.xml",
		"**/*.dds",
		"**/*.pvr",
		"**/*.pkm",
		"**/*.ktx",
		"**/*.ktx2",
	],
	resolve: {
		dedupe: ["melonjs"],
	},
	optimizeDeps: {
		// Don't pre-bundle the workspace packages. Vite caches a pre-bundled
		// copy of deps and does NOT re-bundle on a workspace rebuild, so a
		// pre-bundled `melonjs` silently serves stale engine code after
		// `pnpm build` (you edit the engine, rebuild, and the example keeps
		// running the old bundle until a `--force` restart). Excluding them
		// makes the dev server pick up `build/index.js` changes on reload.
		exclude: [
			"melonjs",
			"@melonjs/debug-plugin",
			"@melonjs/tiled-inflate-plugin",
		],
	},
});
