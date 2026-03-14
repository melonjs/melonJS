/**
 * Tree-shaking validation tests.
 *
 * Simulates what a consumer's bundler does: imports a subset of exports
 * from the built melonJS output and verifies unused code is eliminated.
 *
 * Run with: node --test tests/treeshaking.node-test.js
 * Requires: pnpm build (or npx turbo run build --filter=melonjs) first
 *
 * @see https://github.com/melonjs/melonJS/issues/1156
 */
import assert from "node:assert";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it, todo } from "node:test";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(__dirname, "../build");
const buildEntry = resolve(buildDir, "index.js");

// verify the build exists before running
assert.ok(
	existsSync(buildEntry),
	`Built output not found at ${buildEntry}. Run 'pnpm build' first.`,
);

const commonOptions = {
	bundle: true,
	write: false,
	format: "esm",
	target: "es2022",
	treeShaking: true,
	minify: true,
	metafile: true,
	external: ["howler"],
};

/**
 * Bundle a code snippet that imports from the built melonJS entry point.
 * Returns { size, output, metafile }.
 */
async function bundle(code) {
	const result = await esbuild.build({
		...commonOptions,
		stdin: { contents: code, resolveDir: buildDir, loader: "js" },
	});
	const text = result.outputFiles[0].text;
	return { size: text.length, output: text, metafile: result.metafile };
}

describe("Tree-shaking", async () => {
	// build all variants up front in parallel
	const [full, vector2dOnly, mathOnly, geometryOnly] = await Promise.all([
		bundle(`import * as me from "./index.js"; globalThis.me = me;`),
		bundle(
			`import { Vector2d } from "./index.js"; globalThis.v = new Vector2d(1, 2);`,
		),
		bundle(`import { math } from "./index.js"; globalThis.m = math;`),
		bundle(
			`import { Rect, Polygon, Ellipse } from "./index.js"; globalThis.r = new Rect(0,0,10,10); globalThis.p = new Polygon(0,0,[]); globalThis.e = new Ellipse(0,0,5,5);`,
		),
	]);

	console.log(`  Full library:  ${(full.size / 1024).toFixed(1)} KB`);
	console.log(
		`  Vector2d only: ${(vector2dOnly.size / 1024).toFixed(1)} KB (${((vector2dOnly.size / full.size) * 100).toFixed(1)}%)`,
	);
	console.log(
		`  math only:     ${(mathOnly.size / 1024).toFixed(1)} KB (${((mathOnly.size / full.size) * 100).toFixed(1)}%)`,
	);
	console.log(
		`  Geometry only: ${(geometryOnly.size / 1024).toFixed(1)} KB (${((geometryOnly.size / full.size) * 100).toFixed(1)}%)`,
	);

	it("full library bundle should be non-trivial", () => {
		assert.ok(
			full.size > 50_000,
			`Full bundle should be >50KB, got ${full.size}B`,
		);
	});

	it("partial imports should not be larger than the full library", () => {
		assert.ok(
			vector2dOnly.size <= full.size,
			`Vector2d bundle should not exceed full bundle`,
		);
		assert.ok(
			mathOnly.size <= full.size,
			`math bundle should not exceed full bundle`,
		);
		assert.ok(
			geometryOnly.size <= full.size,
			`Geometry bundle should not exceed full bundle`,
		);
	});

	// ---------------------------------------------------------------------------
	// Aspirational targets — these document the ideal tree-shaking behavior.
	// They currently fail because the build output is a single pre-bundled file
	// with top-level side effects (new Application(), onReady(), boot()) that
	// prevent consumer bundlers from eliminating unused code.
	//
	// To make these pass, the library would need to:
	//   1. Preserve individual ES modules in the build output (no bundling)
	//   2. Remove top-level side effects from the entry point (lazy init)
	//
	// Track progress: as tree-shaking improves, convert these from todo to it.
	// ---------------------------------------------------------------------------

	todo("Vector2d-only import should be <50% of the full library", () => {
		const ratio = vector2dOnly.size / full.size;
		assert.ok(
			ratio < 0.5,
			`Vector2d: ${(ratio * 100).toFixed(1)}% of full bundle`,
		);
	});

	todo("Vector2d-only import should not contain WebGL shader code", () => {
		assert.ok(
			!vector2dOnly.output.includes("gl_Position"),
			"WebGL vertex shader code should be tree-shaken out",
		);
	});

	todo("math-only import should be <50% of the full library", () => {
		const ratio = mathOnly.size / full.size;
		assert.ok(ratio < 0.5, `math: ${(ratio * 100).toFixed(1)}% of full bundle`);
	});

	todo("geometry-only import should be <50% of the full library", () => {
		const ratio = geometryOnly.size / full.size;
		assert.ok(
			ratio < 0.5,
			`Geometry: ${(ratio * 100).toFixed(1)}% of full bundle`,
		);
	});
});
