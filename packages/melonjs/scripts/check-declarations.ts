/**
 * Type-check the PUBLISHED declarations, and guard them against internal leaks.
 *
 * `pnpm lint` and `tsc -p tsconfig.json` both check the SOURCE, where
 * `@internal`, `@ignore` and `@import` carry no meaning at all. Everything
 * those tags control happens in the emitted `.d.ts`, which until now nothing
 * compiled against, so a whole class of defect was invisible:
 *
 * - a public member reaching TypeScript as `any`, because the declaration
 *   named a type it never imported;
 * - a member stripped from the published types while the interface it
 *   implements still requires it;
 * - an `@internal` function becoming public, because an unrelated edit
 *   orphaned the JSDoc block carrying the tag;
 * - a type a public function returns that a consumer cannot name, because the
 *   module defining it is not part of the entry point.
 *
 * Every one of those shipped at least once. This compiles a fixture against
 * `build/index.d.ts` and fails the build on any of them.
 */
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const buildDir = resolve(pkgRoot, "build");
const checkDir = resolve(buildDir, ".declcheck");

const problems: string[] = [];

/**
 * A consumer's file. Each statement stands for a defect that shipped, so a
 * failure here names the thing that regressed rather than a line number.
 */
const fixture = `
import {
	BitmapText,
	Body,
	CanvasRenderTarget,
	createPool,
	getPool,
	loader,
	type PhysicsBody,
	Rect,
	Renderable,
	type RenderTarget,
	Texture2d,
} from "../index.js";

// \`createPool\` is public, and a game needs it to move off the legacy pool
const bulletPool = createPool((x: number, y: number) => {
	const instance = new Renderable(x, y, 4, 4);
	return { instance, reset: (x: number, y: number) => instance.pos.set(x, y) };
});
export const bullet: Renderable = bulletPool.get(1, 2);
bulletPool.release(bullet);

// the typed pools the engine ships, through the public key
export const label = getPool("text").get(0, 0, { font: "Arial", size: 12, text: "hi" });

// a texture of unknown kind can be asked whether it has named regions
export function regionAware(texture: Texture2d): boolean {
	return texture.isAtlas;
}

// the portable readback is a promise on the BASE class, so backend-agnostic
// code can call it without naming a backend
export async function grab(target: RenderTarget): Promise<ImageData> {
	return target.toImageData();
}

// and the canvas target still answers synchronously
export function grabSync(target: CanvasRenderTarget): ImageData {
	return target.getImageData(0, 0, 1, 1);
}

// \`Body\` has to satisfy the interface it implements: \`collisionMask\` was
// stripped from the published types while \`PhysicsBody\` required it
export function asPhysicsBody(r: Renderable): PhysicsBody {
	const body: PhysicsBody = new Body(r, new Rect(0, 0, 8, 8));
	return body;
}

// a public function's return type must be nameable by a consumer
export function nodeCount(name: string): number {
	const data: loader.GLTFData | null = loader.getGLTF(name);
	return data === null ? 0 : data.nodes.length;
}

// chaining returns the subclass, not the base
export function chained(t: BitmapText): BitmapText {
	return t.resize(2).resize(3);
}
`;

// inside `build/` so the fixture resolves `../index.js` the way a consumer
// resolves the package, and removed again before anything publishes: `build`
// is in package.json's `files`
mkdirSync(checkDir, { recursive: true });
writeFileSync(join(checkDir, "fixture.ts"), fixture);

try {
	execFileSync(
		"npx",
		[
			"tsc",
			"--noEmit",
			"--strict",
			"--target",
			"es2022",
			"--module",
			"esnext",
			"--moduleResolution",
			"bundler",
			"--lib",
			"es2022,dom",
			"--skipLibCheck",
			"--ignoreConfig",
			join(checkDir, "fixture.ts"),
		],
		{ cwd: pkgRoot, stdio: "pipe", encoding: "utf8" },
	);
} catch (error) {
	const output = (error as { stdout?: string; stderr?: string }).stdout ?? "";
	problems.push(
		"the published declarations do not type-check against a consumer:\n" +
			output.trim(),
	);
}

rmSync(checkDir, { recursive: true, force: true });

/**
 * Names that must never reach a `.d.ts`.
 *
 * `strip-internal.ts` reads `@internal` off the JSDoc block ATTACHED to a
 * declaration, so inserting anything between the block and the declaration
 * silently un-tags it. These are the engine internals most likely to leak
 * that way: a parser entry point, the pool registry's innards, the cache
 * helpers and the recycle hooks.
 */
const mustNotLeak = [
	"preloadGLTF",
	"getRegisteredPools",
	"registerBuiltinTiledClass",
	"releaseToOwningPool",
	"resetRenderableState",
	"CACHED_TYPES",
	"deleteAsset",
	"hasAsset",
	"assetNames",
];

/** every emitted declaration file */
const declarations: string[] = [];
const walk = (dir: string) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name !== ".declcheck") {
				walk(full);
			}
		} else if (entry.name.endsWith(".d.ts")) {
			declarations.push(full);
		}
	}
};
walk(buildDir);

for (const file of declarations) {
	// comments are prose: `@internal` is often MENTIONED in a doc block that
	// documents something else, so only code lines count
	const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
	for (const name of mustNotLeak) {
		if (new RegExp(`\\b${name}\\b`).test(code)) {
			problems.push(
				`${file.slice(pkgRoot.length + 1)} declares the internal \`${name}\`. ` +
					"Its `@internal` tag is most likely orphaned: check that nothing " +
					"was inserted between the JSDoc block and the declaration.",
			);
		}
	}
}

if (problems.length > 0) {
	console.error("\ncheck-declarations failed:\n");
	for (const problem of problems) {
		console.error(`  - ${problem}\n`);
	}
	process.exit(1);
}

console.log(
	`check-declarations: ${declarations.length} declaration file(s) checked, consumer fixture compiles`,
);
