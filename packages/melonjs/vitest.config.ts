/// <reference types="vitest" />
/// <reference types="vite/client" />
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { PackageJson } from "type-fest";
import { default as glsl } from "vite-plugin-glsl";
import { defineConfig } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const packageJson = (
	await import("../../package.json", {
		with: { type: "json" },
	})
).default as PackageJson.PackageJsonStandard;

const version = packageJson.version;
if (!version) {
	throw new Error("Version missing from package.json");
}

export default defineConfig(() =>
	defineConfig({
		test: {
			include: ["**/*.{test,spec}.[jt]s?(x)"],
			browser: {
				enabled: true,
				// Swiftshader flags enable software WebGL2 in headless
				// chromium so pixel-level renderer tests (mesh depth,
				// TMX layer shader) run in CI instead of skipping. The
				// flags belong on the `playwright()` provider call, not
				// on the per-instance config — `BrowserInstanceOption`
				// has no `launchOptions` field.
				provider: playwright({
					launchOptions: {
						args: [
							"--use-gl=angle",
							"--use-angle=swiftshader",
							"--enable-unsafe-swiftshader",
							"--ignore-gpu-blocklist",
						],
					},
				}),
				instances: [
					{
						browser: "chromium",
						headless: true,
						screenshotFailures: false,
					},
				],
			},
		},
		publicDir: resolve(__dirname, "tests/public"),
		plugins: [
			glsl(),
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
	}),
);
