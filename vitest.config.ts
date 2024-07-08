import { defineConfig } from "vitest/config";
import glsl from "vite-plugin-glsl";
import { PackageJson } from "type-fest";

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
			name: "chromium",
			provider: "playwright",
			headless: true,
		},
	},
	publicDir: "tests/public",
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
});
