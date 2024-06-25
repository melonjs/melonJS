import { defineConfig } from "vitest/config";
import glsl from "vite-plugin-glsl";
import packageJson from "./package.json" with { type: "json" };

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
					code: src.replace(/__VERSION__/g, packageJson.version),
					map: null,
				};
			},
		},
	],
});
