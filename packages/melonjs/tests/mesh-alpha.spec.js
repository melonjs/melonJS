/**
 * A fully transparent mesh must not draw.
 *
 * `CanvasRenderer.drawMesh` has skipped at `getGlobalAlpha() < 1 / 255` since
 * forever — it is the same guard nine other Canvas draw methods use. The GPU
 * renderers had no such guard, and `MeshBatcher.bind()` disables `GL_BLEND`, so
 * the alpha byte never reached the blend stage: the shader multiplied the
 * colour by zero and wrote it OPAQUE BLACK. The same `alpha = 0` that hides a
 * sprite painted a black silhouette of the mesh.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, Mesh } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

const SIZE = 64;

describe("Mesh opacity", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// genuinely unavailable — every test below skips
		}
		if (renderer) {
			renderer.projectionMatrix.ortho(0, SIZE, SIZE, 0, -1000, 1000);
			renderer.currentBatcher.setProjection(renderer.projectionMatrix);
		}
	});

	afterAll(() => {
		try {
			releaseWebGLRenderer();
		} catch {
			// ignore
		}
	});

	const requireWebGL = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL renderer not available in this environment");
		}
	};

	/** a quad covering the whole target, in raw pixel coordinates */
	const quad = () => {
		const mesh = new Mesh(0, 0, {
			vertices: new Float32Array([
				0,
				0,
				0,
				SIZE,
				0,
				0,
				SIZE,
				SIZE,
				0,
				0,
				SIZE,
				0,
			]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			normalize: false,
			scale: 1,
			width: SIZE,
			height: SIZE,
		});
		// `vertices` is the PROJECTED output buffer, filled during `draw()`.
		// This harness calls `drawMesh` directly, so seed it from the source —
		// the ortho projection above already maps these to pixels.
		mesh.vertices.set(mesh.originalVertices);
		return mesh;
	};

	/**
	 * `drawMesh` selects a batcher as its first act, so a draw that was
	 * skipped never gets that far. Cheaper and far more deterministic than a
	 * pixel probe, which in a bare renderer harness measures nothing.
	 */
	const reachesTheBatcher = (alpha) => {
		const spy = vi.spyOn(renderer, "setBatcher");
		renderer.save();
		renderer.setGlobalAlpha(alpha);
		let reached;
		try {
			renderer.drawMesh(quad());
		} finally {
			// read BEFORE restoring: mockRestore() clears the call history
			reached = spy.mock.calls.length > 0;
			renderer.restore();
			spy.mockRestore();
		}
		return reached;
	};

	it("does not draw at alpha 0", (ctx) => {
		requireWebGL(ctx);
		// with GL_BLEND off on the mesh path, a mesh that reaches the batcher
		// at alpha 0 is multiplied to black and written OPAQUE — a black
		// silhouette where the caller asked for nothing
		expect(reachesTheBatcher(0)).toBe(false);
	});

	it("skips below the 1/255 threshold the Canvas renderer already uses", (ctx) => {
		requireWebGL(ctx);
		expect(reachesTheBatcher(0.5 / 255)).toBe(false);
	});

	it("still draws at one full step of alpha", (ctx) => {
		requireWebGL(ctx);
		// the guard must not swallow draws that would be visible
		expect(reachesTheBatcher(2 / 255)).toBe(true);
	});

	it("still draws at full alpha", (ctx) => {
		requireWebGL(ctx);
		expect(reachesTheBatcher(1)).toBe(true);
	});
});
