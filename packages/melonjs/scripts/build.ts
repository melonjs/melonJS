import { readFile } from "node:fs/promises";
import esbuild, { BuildOptions, Plugin } from "esbuild";
import packageJson from "../package.json" with { type: "json" };
import { stripShaderComments } from "./strip-shader-comments.ts";

const banner = [
	"/*!",
	` * ${packageJson.description} - ${packageJson.version}`,
	" * http://www.melonjs.org",
	` * ${packageJson.name} is licensed under the MIT License.`,
	" * http://www.opensource.org/licenses/mit-license",
	` * @copyright (C) 2011 - ${new Date().getFullYear()} ${packageJson.author}`,
	" */",
].join("\n");

// Shaders are bundled as text, which no minifier reads: their comments are
// taken out here, or they are shipped to every game
const shaders: Plugin = {
	name: "strip-shader-comments",
	setup(build) {
		build.onLoad({ filter: /\.(vert|frag|wgsl)$/ }, async (args) => {
			return {
				contents: stripShaderComments(await readFile(args.path, "utf8")),
				loader: "text",
			};
		});
	},
};

const buildOptions = {
	entryPoints: ["src/index.ts"],
	loader: {
		".png": "dataurl",
		".vert": "text",
		".frag": "text",
		".wgsl": "text",
	},
	splitting: true,
	format: "esm",
	outdir: "build",
	sourcemap: true,
	target: "es2022",
	bundle: true,
	define: { __VERSION__: JSON.stringify(packageJson.version) },
	plugins: [shaders],
	banner: {
		js: banner,
	},
} satisfies BuildOptions;

if (process.argv[2] === "watch") {
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch({});
} else {
	await esbuild.build(buildOptions);
}
