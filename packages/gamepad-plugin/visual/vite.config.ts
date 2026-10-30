import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The plugin's visual test page, for developers: `pnpm -F
// @melonjs/gamepad-plugin visual`. Not part of the published package.
export default defineConfig({
	root: dirname(fileURLToPath(import.meta.url)),
	server: {
		// reachable from a phone on the same network, to try real touches
		host: true,
	},
	resolve: {
		dedupe: ["melonjs"],
	},
	optimizeDeps: {
		// serve the engine as built, picked up again after `pnpm build`
		exclude: ["melonjs"],
	},
});
