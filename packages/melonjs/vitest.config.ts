/// <reference types="vitest" />
/// <reference types="vite/client" />
import { defineConfig } from "vitest/config";
import { default as glsl } from "vite-plugin-glsl";
import { PackageJson } from "type-fest";

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
				name: "chromium",
				provider: "playwright",
				headless: true,
				screenshotFailures: false,
			},
		},
		publicDir: "./tests/public",
		plugins: [
			glsl() as Plugin,
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
