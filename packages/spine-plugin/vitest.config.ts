/// <reference types="vitest" />
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// A Spine object draws through the engine's real renderers, so the tests run
// in a browser, as the engine's do.
export default defineConfig({
	test: {
		include: ["**/*.{test,spec}.[jt]s?(x)"],
		// creating a WebGL context through a software rasterizer can take a
		// while on a machine with no GPU (the engine's suite raises it too)
		hookTimeout: 90000,
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [
				{
					browser: "chromium",
					headless: true,
					screenshotFailures: false,
				},
			],
		},
	},
});
