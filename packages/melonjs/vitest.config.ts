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
		// Anchor to this package. `pnpm test` invokes this config from the repo
		// root, where an unanchored `include` globs every workspace package —
		// so the adapters' and debug-plugin's specs were pulled into this run
		// *as well as* being run by their own `pnpm -F ... test` jobs. Besides
		// the duplicate work, each extra spec file that calls `video.init`
		// creates another WebGL context in the one shared browser session, and
		// past the browser's context cap a later `beforeAll` stalls.
		root: __dirname,
		test: {
			include: ["tests/**/*.{test,spec}.[jt]s?(x)"],
			// Several specs create a WebGL context in `beforeAll`. On a CI
			// container with no GPU that runs through a software rasterizer and
			// can genuinely take tens of seconds under load, so the default hook
			// timeout fails correct suites. Raised for headroom — this is a slow
			// hook, not a hanging one.
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
