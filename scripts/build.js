import esbuild from "esbuild";
import packageJson from "../package.json" with { type: "json" };

const banner = [
	"/*!",
	" * " + packageJson.description + " - " + packageJson.version,
	" * http://www.melonjs.org",
	" * " + packageJson.name + " is licensed under the MIT License.",
	" * http://www.opensource.org/licenses/mit-license",
	" * @copyright (C) 2011 - " +
		new Date().getFullYear() +
		" " +
		packageJson.author,
	" */",
].join("\n");

await esbuild.build({
	entryPoints: ["src/index.js"],
	loader: {
		".png": "dataurl",
		".vert": "text",
		".frag": "text",
	},
	splitting: true,
	format: "esm",
	outdir: "build",
	sourcemap: true,
	bundle: true,
	define: { __VERSION__: JSON.stringify(packageJson.version) },
	banner: {
		js: banner,
	},
});
