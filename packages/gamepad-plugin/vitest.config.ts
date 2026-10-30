/// <reference types="vitest" />
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// The controls listen to real pointer events and draw with the renderer, so
// the tests run in a browser, as the engine's do.
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
