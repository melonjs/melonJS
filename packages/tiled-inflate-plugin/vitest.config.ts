/// <reference types="vitest" />
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// The maps are loaded by the engine's own loader and level director, so the
// tests run in a browser, as the engine's do.
export default defineConfig({
	test: {
		include: ["**/*.{test,spec}.[jt]s?(x)"],
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
