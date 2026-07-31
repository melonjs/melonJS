/// <reference types="vitest" />
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// The panel builds real DOM and reads live engine state, so these run in a
// browser rather than a simulated DOM — same provider the engine and the
// physics adapters use.
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
