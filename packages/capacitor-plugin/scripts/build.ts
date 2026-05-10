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

// Strip the npm range prefix (`>=`, `^`, `~`, etc.) off the melonjs
// peer dep so we can pass a bare semver string into the source as the
// plugin's compatibility floor.
const melonjsPeer = packageJson.peerDependencies.melonjs.replace(
	/^[^0-9]*/,
	"",
);

const buildOptions = {
	entryPoints: ["src/index.ts"],
	external: [
		"melonjs",
		"@capacitor/app",
		"@capacitor/screen-orientation",
		"@capacitor/splash-screen",
	],
	splitting: true,
	format: "esm",
	outdir: "build",
	sourcemap: true,
	bundle: true,
	define: {
		__VERSION__: JSON.stringify(packageJson.version),
		__MELONJS_PEER__: JSON.stringify(melonjsPeer),
	},
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
