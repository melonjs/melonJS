import { createFilter } from "@rollup/pluginutils";
import { Plugin, transformWithEsbuild } from "vite";
import loadShader from "./loadShader.js";

/**
 * @default
 */
const DEFAULT_EXTENSION = "glsl";

/**
 * @default
 */
const DEFAULT_SHADERS = Object.freeze([
	"**/*.glsl",
	"**/*.wgsl",
	"**/*.vert",
	"**/*.frag",
	"**/*.vs",
	"**/*.fs",
]);

export default function ({
	include = DEFAULT_SHADERS,
	exclude = undefined,
	warnDuplicatedImports = true,
	defaultExtension = DEFAULT_EXTENSION,
	compress = false,
	watch = true,
	root = "/",
} = {}): Plugin {
	let sourcemap: boolean | "inline" | "hidden" = false;
	const filter = createFilter(include, exclude);
	const prod = process.env.NODE_ENV === "production";

	return {
		enforce: "pre",
		name: "vite-plugin-glsl",

		configResolved(resolvedConfig) {
			sourcemap = resolvedConfig.build.sourcemap;
		},

		async transform(source, shader) {
			if (!filter(shader)) return;

			const { dependentChunks, outputShader } = loadShader(source, shader, {
				warnDuplicatedImports,
				defaultExtension,
				compress,
				root,
			});

			if (watch && !prod) {
				const chunks = Array.from(dependentChunks.values()).flat();
				chunks.forEach((chunk) => {
					this.addWatchFile(chunk);
				});
			}

			return transformWithEsbuild(outputShader, shader, {
				sourcemap: sourcemap && "external",
				loader: "text",
				format: "esm",
				minifyWhitespace: prod,
			});
		},
	};
}
