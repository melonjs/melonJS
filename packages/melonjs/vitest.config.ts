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
		// *as well as* being run by their own `pnpm -F ... test` jobs, doubling
		// the work.
		//
		// This comment used to claim the specs also shared one browser session,
		// so contexts accumulated across files until the browser's cap stalled a
		// later `beforeAll`. That is NOT true here: vitest isolates each spec
		// file, verified by a probe — a global set in one file is undefined in
		// the next, and a context opened in one is dead by the next. Contexts do
		// accumulate WITHIN a file across its describe blocks, which is worth
		// releasing, but it is not a cross-file effect.
		root: __dirname,
		test: {
			include: ["tests/**/*.{test,spec}.[jt]s?(x)"],
			// Several specs create a WebGL context in `beforeAll`. On a CI
			// container with no GPU that runs through a software rasterizer and
			// can genuinely take tens of seconds under load, so the default hook
			// timeout fails correct suites. Raised for headroom — this is a slow
			// hook, not a hanging one. (`video.init` no longer exists; a context
			// comes from `new Application(...)` + `await app.init()`.)
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
		// Surface CI-ness to the browser side. Vitest's `env` does not reach the
		// page, so the WebGL tripwire (tests/webgl_available.spec.js) reads this
		// to decide whether a missing WebGL context is a hard failure (CI, where
		// the image is pinned and WebGL must be present) or a visible skip (a
		// contributor's machine that genuinely has no GL).
		define: {
			"import.meta.env.VITE_CI": JSON.stringify(process.env.CI ?? ""),
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
