/// <reference types="vitest" />
import { playwright } from "@vitest/browser-playwright";
import { PackageJson } from "type-fest";
import { defineConfig } from "vitest/config";

const packageJson = (
	await import("./package.json", {
		with: { type: "json" },
	})
).default as PackageJson.PackageJsonStandard;

const version = packageJson.version;
if (!version) {
	throw new Error("Version missing from package.json");
}

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
	plugins: [
		{
			name: "transform-file",
			transform(src) {
				return {
					code: src.replace(/=\s__VERSION__/g, `= "${version}"`),
					map: null,
				};
			},
		},
	],
});
