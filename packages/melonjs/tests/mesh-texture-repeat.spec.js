import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boot, Matrix3d, Mesh, video, WebGLRenderer } from "../src/index.js";

/**
 * Tests for issue #1503 — `Mesh`'s `textureRepeat` setting used to apply the
 * wrap mode by MUTATING `this.texture.repeat`, and `this.texture` is the
 * TextureAtlas shared per source image (`renderer.cache.get(image)`). So the
 * wrap mode leaked image-globally: two meshes pointing at the same image but
 * wanting different wrap modes were last-writer-wins, and the loser's wrap
 * silently flipped.
 *
 * The fix keeps the wrap on the Mesh (`mesh.textureRepeat`) and threads it
 * through `MeshBatcher.addMesh` → `uploadTexture` → `TextureCache.getUnit`
 * at draw time — the sampler-state-per-use model — leaving the shared atlas
 * untouched. The `(source, repeat)` unit keying (#1448) already gives each
 * wrap mode its own GL texture, so per-mesh wraps coexist on one image.
 *
 * Also covered: `TextureCache.freeTextureUnit` used to free only the unit
 * matching the atlas's CURRENT `repeat` field, leaking any other per-repeat
 * units for the same source until a full cache reset (pre-existing, but the
 * per-mesh override makes multi-repeat sources a first-class case).
 *
 * Written failing-first against the pre-fix code: every test below is RED
 * with the constructor mutation in place and GREEN with the fix.
 */
describe("Mesh textureRepeat vs shared TextureAtlas (issue #1503)", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.WEBGL,
				// Chromium headless uses a software GL backend that trips the
				// "major performance caveat" flag — opt out so the tests run
				// on SwiftShader instead of silently falling back to Canvas.
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// Genuine WebGL absence — tests skip below.
		}
		if (video.renderer instanceof WebGLRenderer) {
			renderer = video.renderer;
		}
	});

	afterAll(() => {
		// Restore the video subsystem to AUTO so this spec doesn't leak a
		// forced-WebGL renderer into other test files sharing the `video`
		// global (same cleanup pattern as webgl_mesh_depth.spec.js).
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.AUTO,
			});
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	// a fresh 4x4 solid-white canvas per test — each test needs its own
	// source object so unit-cache state can't bleed between tests
	const makeSolidImage = () => {
		const canvas = document.createElement("canvas");
		canvas.width = 4;
		canvas.height = 4;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 4, 4);
		return canvas;
	};

	// 4x4 canvas, left half red / right half blue — under `"repeat"` a UV of
	// u=1.25 wraps to 0.25 (red half); under `"no-repeat"` it clamps to the
	// right edge (blue). Rows are uniform so v-precision doesn't matter.
	const makeSplitImage = () => {
		const canvas = document.createElement("canvas");
		canvas.width = 4;
		canvas.height = 4;
		const ctx = canvas.getContext("2d");
		ctx.fillStyle = "#ff0000";
		ctx.fillRect(0, 0, 2, 4);
		ctx.fillStyle = "#0000ff";
		ctx.fillRect(2, 0, 2, 4);
		return canvas;
	};

	// minimal quad geometry for real Mesh construction (unit quad — the
	// constructor normalizes and scales it to `width`, we never draw these
	// for pixel assertions)
	const quadSettings = (image, textureRepeat) => {
		return {
			vertices: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
			uvs: [0, 0, 2, 0, 2, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			texture: image,
			width: 32,
			textureRepeat,
		};
	};

	it("constructing a Mesh with textureRepeat leaves the shared per-image atlas untouched", (ctx) => {
		requireWebGL(ctx);
		const image = makeSolidImage();
		const shared = renderer.cache.get(image);
		expect(shared.repeat).toBe("no-repeat");

		const mesh = new Mesh(0, 0, quadSettings(image, "repeat"));

		// the wrap belongs to the mesh, not to the image-global atlas
		expect(mesh.textureRepeat).toBe("repeat");
		expect(shared.repeat).toBe("no-repeat");
		// the mesh still resolved the shared atlas (no private copy churn)
		expect(mesh.texture).toBe(shared);
	});

	it("two meshes sharing one image each draw with their own wrap mode", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		const image = makeSolidImage();
		const meshRepeat = new Mesh(0, 0, quadSettings(image, "repeat"));
		const meshClamp = new Mesh(0, 0, quadSettings(image, "no-repeat"));

		// capture the TEXTURE_WRAP_S values actually sent to the GPU
		const wrapS = [];
		const origTexParameteri = gl.texParameteri.bind(gl);
		gl.texParameteri = (target, pname, value) => {
			if (pname === gl.TEXTURE_WRAP_S) {
				wrapS.push(value);
			}
			return origTexParameteri(target, pname, value);
		};
		try {
			renderer.drawMesh(meshRepeat);
			renderer.drawMesh(meshClamp);
		} finally {
			gl.texParameteri = origTexParameteri;
		}

		// each wrap mode got its own (source, repeat) texture unit …
		const perRepeat = renderer.cache.units.get(image);
		expect(perRepeat).toBeDefined();
		expect(perRepeat.has("repeat")).toBe(true);
		expect(perRepeat.has("no-repeat")).toBe(true);
		expect(perRepeat.get("repeat")).not.toBe(perRepeat.get("no-repeat"));
		// … and both wrap modes reached the GL sampler state (pre-fix, the
		// shared-field mutation meant only the LAST constructed mesh's wrap
		// was ever uploaded)
		expect(wrapS).toContain(gl.REPEAT);
		expect(wrapS).toContain(gl.CLAMP_TO_EDGE);
	});

	it("pixel readback: repeat tiles and no-repeat clamps on the same source image", (ctx) => {
		requireWebGL(ctx);
		const gl = renderer.gl;
		const image = makeSplitImage();
		const atlas = renderer.cache.get(image);

		// duck-typed meshes (the shape drawMesh/addMesh consume — same
		// pattern as webgl_mesh_depth.spec.js) sharing ONE atlas object,
		// differing only in the per-mesh wrap. u spans 0..2 so the right
		// half of each quad samples u > 1 — where wrap vs clamp diverge.
		const makeQuad = (cx, textureRepeat) => {
			const half = 24;
			const cy = 64;
			return {
				vertices: new Float32Array([
					cx - half,
					cy - half,
					0,
					cx + half,
					cy - half,
					0,
					cx + half,
					cy + half,
					0,
					cx - half,
					cy + half,
					0,
				]),
				uvs: new Float32Array([0, 0, 2, 0, 2, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				texture: atlas,
				textureRepeat,
				cullBackFaces: false,
				alphaCutoff: 0,
			};
		};

		const proj = new Matrix3d();
		proj.ortho(0, 128, 128, 0, -1000, 1000);
		renderer.setProjection(proj);
		renderer.currentTint.setColor(255, 255, 255, 1);
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();

		// left quad tiles, right quad clamps — same image, same frame
		renderer.drawMesh(makeQuad(32, "repeat"));
		renderer.drawMesh(makeQuad(96, "no-repeat"));
		gl.finish();

		// sample each quad at u = 1.25 (30px past its left edge), mid-height.
		// repeat → u wraps to 0.25 → red half; no-repeat → clamps to the
		// right edge → blue half.
		const readPixel = (x, y) => {
			const px = new Uint8Array(4);
			gl.readPixels(x, 128 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return px;
		};
		const tiled = readPixel(32 - 24 + 30, 64);
		const clamped = readPixel(96 - 24 + 30, 64);

		expect(tiled[0]).toBeGreaterThan(200); // red: wrapped back into the red half
		expect(tiled[2]).toBeLessThan(50);
		expect(clamped[2]).toBeGreaterThan(200); // blue: clamped to the right edge
		expect(clamped[0]).toBeLessThan(50);
	});

	it("cache.delete(image) frees every per-repeat texture unit for the source", (ctx) => {
		requireWebGL(ctx);
		const image = makeSolidImage();
		const atlas = renderer.cache.get(image);

		// upload the same source under two wrap modes via the per-use
		// override — what the per-mesh `textureRepeat` produces at draw
		// time; the shared atlas is never touched
		renderer.setBatcher("quad");
		renderer.currentBatcher.uploadTexture(
			atlas,
			undefined,
			undefined,
			false,
			true,
			"repeat",
		);
		renderer.currentBatcher.uploadTexture(atlas); // atlas's own wrap: "no-repeat"
		expect(renderer.cache.units.get(image).size).toBe(2);

		const usedBefore = renderer.cache.usedUnits.size;
		renderer.cache.delete(image);

		// pre-fix, delete's per-atlas freeTextureUnit only released the
		// unit matching each atlas's CURRENT repeat field — the "repeat"
		// unit stayed pinned in units/usedUnits until a full cache reset
		expect(renderer.cache.units.has(image)).toBe(false);
		expect(renderer.cache.usedUnits.size).toBe(usedBefore - 2);
	});

	it("deleteTexture2D purges the GL binding of every per-repeat unit (no stale rebinds)", (ctx) => {
		requireWebGL(ctx);
		const image = makeSolidImage();
		const atlas = renderer.cache.get(image);
		renderer.setBatcher("quad");
		const batcher = renderer.currentBatcher;

		batcher.uploadTexture(atlas, undefined, undefined, false, true, "repeat");
		batcher.uploadTexture(atlas); // atlas's own wrap: "no-repeat"
		const units = [...renderer.cache.units.get(image).values()];
		expect(units.length).toBe(2);
		for (const unit of units) {
			expect(batcher.getTexture2D(unit)).toBeDefined();
		}

		batcher.deleteTexture2D(atlas);

		// the cache freed the units AND the batcher dropped both GL
		// bindings. A stale `boundTextures[unit]` entry on a freed unit
		// would make the next texture allocated on that unit look
		// "already uploaded" and silently bind the wrong texture (the
		// hazard flagged in the #1537 review).
		expect(renderer.cache.units.has(image)).toBe(false);
		for (const unit of units) {
			expect(batcher.getTexture2D(unit)).toBeUndefined();
		}
	});
});
