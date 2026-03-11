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
	assetsInclude: ["**/*.tmx", "**/*.tmj", "**/*.tsj", "**/*.xml"],
	resolve: {
		dedupe: ["melonjs"],
	},
	optimizeDeps: {
		// Prevent pre-bundling the plugin so it resolves melonjs from the workspace
		exclude: ["@melonjs/tiled-inflate-plugin"],
	},
});
