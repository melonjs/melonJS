import esbuild, { type BuildOptions } from "esbuild";
import packageJson from "../package.json" with { type: "json" };

const banner = [
	"/*!",
	` * ${packageJson.description} - ${packageJson.version}`,
	" * http://www.melonjs.org",
	` * ${packageJson.name} is licensed under the MIT License.`,
	" * http://www.opensource.org/licenses/mit-license",
	` * @copyright (C) 2011 - ${new Date().getFullYear()} ${packageJson.author}`,
	" */",
].join("\n");

const buildOptions = {
	entryPoints: ["src/index.js"],
	loader: {
		".png": "dataurl",
		".fnt": "text",
	},
	external: ["melonjs"],
	splitting: true,
	format: "esm",
	outdir: "build",
	sourcemap: true,
	bundle: true,
	define: { __VERSION__: JSON.stringify(packageJson.version) },
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
