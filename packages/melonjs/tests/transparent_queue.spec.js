import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { boot, Matrix3d, Mesh, TextureAtlas } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
} from "./helpers/webgl-context.js";

/**
 * The transparent pass (#1516).
 *
 * The mesh tier renders opaque: `MeshBatcher.bind()` disables `GL_BLEND`, and
 * the vertex stage premultiplies. So a faded mesh used to write
 * `(rgb × a, a)` straight into the target — **darkened toward black, with the
 * background contributing nothing**. Measured before this existed: a white mesh
 * at `setOpacity(0.5)` over a blue background read `[127, 127, 127]`, not
 * `[127, 127, 255]`.
 *
 * Draws that resolve to fractional alpha now go into a queue instead, replayed
 * back-to-front with blending on and depth writes off once the world draw is
 * finished. Ground-shadow decals are the same queue's first client.
 */
describe("the transparent pass (#1516)", () => {
	const SIZE = 128;
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			renderer = await getWebGLRenderer(SIZE, SIZE);
		} catch {
			// genuinely unavailable — every test below skips
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

	let _atlas = null;
	const whiteAtlas = () => {
		if (_atlas === null) {
			const canvas = document.createElement("canvas");
			canvas.width = 1;
			canvas.height = 1;
			const c2d = canvas.getContext("2d");
			c2d.fillStyle = "#ffffff";
			c2d.fillRect(0, 0, 1, 1);
			_atlas = new TextureAtlas(
				{ framewidth: 1, frameheight: 1, image: canvas },
				canvas,
			);
		}
		return _atlas;
	};

	/** a small quad centred on the world origin, on the retained path */
	const quad = (half = 16) => {
		const mesh = new Mesh(0, 0, {
			vertices: [
				-half,
				-half,
				0,
				half,
				-half,
				0,
				half,
				half,
				0,
				-half,
				half,
				0,
			],
			uvs: [0, 0, 1, 0, 1, 1, 0, 1],
			indices: [0, 1, 2, 0, 2, 3],
			texture: whiteAtlas(),
			width: half * 2,
			height: half * 2,
			cullBackFaces: false,
			lit: false,
		});
		mesh._useWorldSpace = true;
		return mesh;
	};

	/** world (0,0) at the canvas centre; a wide z range so depth is free */
	const EYE_Z = 5000;

	const setup = (bg = [0, 0, 255]) => {
		const proj = new Matrix3d();
		proj.ortho(-SIZE / 2, SIZE / 2, SIZE / 2, -SIZE / 2, -10000, 10000);
		renderer.setProjection(proj);
		// Put the eye beyond the scene rather than at the origin. Under this
		// projection a GREATER z is nearer (measured, not assumed — the
		// convention here is the inverse of the OpenGL one), and the queue
		// sorts on distance from the eye, so an eye at the origin would rank
		// the two in opposite directions. A real `Camera3d` installs a view
		// that makes them agree; this stands in for it.
		renderer.currentTransform.identity().translate(0, 0, -EYE_Z);
		renderer.backgroundColor.setColor(bg[0], bg[1], bg[2], 255);
		renderer.clear();
	};

	const readPixel = (x = SIZE / 2, y = SIZE / 2) => {
		const gl = renderer.gl;
		const px = new Uint8Array(4);
		gl.finish();
		gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	const draw = (mesh, depth = 0) => {
		mesh.depth = depth;
		mesh.preDraw(renderer);
		mesh.draw(renderer);
		mesh.postDraw(renderer);
	};

	describe("the symptom", () => {
		it("fades a half-opacity mesh instead of darkening it toward black", (ctx) => {
			requireWebGL(ctx);
			// The measured failure signature is [127,127,127] — the background
			// contributing nothing because the premultiplied colour REPLACED
			// it. Correct is [127,127,255]: white over blue at half coverage.
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.tint.setColor(255, 255, 255);
			mesh.setOpacity(0.5);
			draw(mesh);
			renderer.flushTransparent();
			const px = readPixel();
			expect(px[2]).toBeGreaterThan(200); // the blue SURVIVES
			expect(px[0]).toBeGreaterThan(100);
			expect(px[0]).toBeLessThan(155);
		});

		it("still writes an opaque mesh straight through", (ctx) => {
			requireWebGL(ctx);
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.tint.setColor(255, 255, 255);
			draw(mesh);
			renderer.flushTransparent();
			expect(Array.from(readPixel()).slice(0, 3)).toEqual([255, 255, 255]);
		});

		it("`transparent: false` pins the old opaque behaviour", (ctx) => {
			requireWebGL(ctx);
			// the escape hatch: darkened, background replaced
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.transparent = false;
			mesh.tint.setColor(255, 255, 255);
			mesh.setOpacity(0.5);
			draw(mesh);
			renderer.flushTransparent();
			const px = readPixel();
			expect(px[2]).toBeLessThan(155); // blue did NOT survive
		});

		it("`transparent: true` queues even at full opacity", (ctx) => {
			requireWebGL(ctx);
			// the texture-alpha case the automatic check cannot see
			setup();
			const mesh = quad();
			mesh.transparent = true;
			draw(mesh);
			expect(renderer._transparentCount).toBe(1);
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(0);
		});
	});

	describe("the additive guarantee", () => {
		it("never enters the queue for an opaque scene", (ctx) => {
			requireWebGL(ctx);
			setup();
			const spy = vi.spyOn(renderer, "queueTransparent");
			draw(quad(), 0);
			draw(quad(), 10);
			const calls = spy.mock.calls.length;
			spy.mockRestore();
			expect(calls).toBe(0);
			expect(renderer._transparentCount ?? 0).toBe(0);
		});

		it("a flush on an empty queue draws nothing and throws nothing", (ctx) => {
			requireWebGL(ctx);
			setup();
			const spy = vi.spyOn(renderer, "drawMesh");
			expect(() => {
				return renderer.flushTransparent();
			}).not.toThrow();
			const calls = spy.mock.calls.length;
			spy.mockRestore();
			expect(calls).toBe(0);
		});
	});

	describe("ordering", () => {
		/** near red over far blue, both half alpha, over white */
		const composite = (nearFirst) => {
			setup([255, 255, 255]);
			const near = quad();
			near.tint.setColor(255, 0, 0);
			near.setOpacity(0.5);
			const far = quad();
			far.tint.setColor(0, 0, 255);
			far.setOpacity(0.5);
			if (nearFirst) {
				draw(near, 900);
				draw(far, 100);
			} else {
				draw(far, 100);
				draw(near, 900);
			}
			renderer.flushTransparent();
			return readPixel();
		};

		it("composites identically whichever order the two were submitted", (ctx) => {
			requireWebGL(ctx);
			// the sort is the whole point: submission order must not matter
			const a = composite(true);
			const b = composite(false);
			for (const channel of [0, 1, 2]) {
				expect(Math.abs(a[channel] - b[channel])).toBeLessThan(3);
			}
		});

		it("puts the near object on top, not the one submitted last", (ctx) => {
			requireWebGL(ctx);
			// near is RED; if the far blue won, the blue channel would dominate
			const px = composite(true);
			expect(px[0]).toBeGreaterThan(px[2]);
		});

		it("is not painted over by an opaque mesh submitted afterwards", (ctx) => {
			requireWebGL(ctx);
			// The reason the pass is deferred at all. A transparent draw writes
			// no depth, so an opaque mesh BEHIND it, drawn later, would replace
			// it outright if the transparent one had gone down immediately.
			setup([255, 255, 255]);
			const ghost = quad();
			ghost.tint.setColor(255, 0, 0);
			ghost.setOpacity(0.5);
			draw(ghost, 900);
			const floor = quad(48);
			floor.tint.setColor(0, 255, 0);
			draw(floor, 100);
			renderer.flushTransparent();
			const px = readPixel();
			// red survives over the green floor rather than being replaced
			expect(px[0]).toBeGreaterThan(100);
		});

		it("is still occluded by opaque geometry genuinely in front of it", (ctx) => {
			requireWebGL(ctx);
			// depth TEST stays on; only depth WRITES are off
			setup([255, 255, 255]);
			const wall = quad(48);
			wall.tint.setColor(0, 255, 0);
			draw(wall, 900);
			const ghost = quad();
			ghost.tint.setColor(255, 0, 0);
			ghost.setOpacity(0.5);
			draw(ghost, 100);
			renderer.flushTransparent();
			const px = readPixel();
			expect(px[1]).toBeGreaterThan(200);
			expect(px[0]).toBeLessThan(60);
		});
	});

	describe("the drain contract", () => {
		const queueOne = () => {
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			expect(renderer._transparentCount).toBe(1);
			return mesh;
		};

		it("does not drain on a batcher switch", (ctx) => {
			requireWebGL(ctx);
			// #1630: anything non-mesh sorting mid-scene raises this, and every
			// mesh still to come would then paint over what was replayed
			queueOne();
			renderer.setBatcher("quad");
			expect(renderer._transparentCount).toBe(1);
			renderer.setBatcher("mesh");
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(0);
		});

		it("refuses to drain while a screen projection is installed", (ctx) => {
			requireWebGL(ctx);
			// #1630: the entries are WORLD-space geometry; replayed under the
			// screen ortho they land off-screen and are silently lost
			queueOne();
			renderer.beginScreenSpace();
			try {
				renderer.flushTransparent();
				expect(renderer._transparentCount).toBe(1);
			} finally {
				renderer.endScreenSpace();
			}
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(0);
		});
	});

	describe("adversarial", () => {
		it("keeps a mesh queued twice apart, with its own matrix and alpha", (ctx) => {
			requireWebGL(ctx);
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh, 100);
			draw(mesh, 900);
			expect(renderer._transparentCount).toBe(2);
			const [a, b] = renderer._transparentPool;
			// the matrix is COPIED, not referenced — one entry must not carry
			// the other's placement
			expect(a.matrix.val[14]).not.toBe(b.matrix.val[14]);
			renderer.flushTransparent();
		});

		it("drops a destroyed mesh instead of replaying it", (ctx) => {
			requireWebGL(ctx);
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			expect(renderer._transparentCount).toBe(1);
			renderer.removeQueuedTransparent(mesh);
			expect(renderer._transparentCount).toBe(0);
			const spy = vi.spyOn(renderer, "drawMesh");
			renderer.flushTransparent();
			const calls = spy.mock.calls.length;
			spy.mockRestore();
			expect(calls).toBe(0);
		});

		it("keeps the other entries when one is removed", (ctx) => {
			requireWebGL(ctx);
			setup();
			const doomed = quad();
			const keep = quad();
			doomed.setOpacity(0.5);
			keep.setOpacity(0.5);
			draw(doomed, 100);
			draw(keep, 200);
			renderer.removeQueuedTransparent(doomed);
			expect(renderer._transparentCount).toBe(1);
			expect(renderer._transparentPool[0].mesh).toBe(keep);
			renderer.flushTransparent();
		});

		it("reuses pooled entries and releases their references after a drain", (ctx) => {
			requireWebGL(ctx);
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			const entry = renderer._transparentPool[0];
			const length = renderer._transparentPool.length;
			renderer.flushTransparent();
			// nothing retained: a destroyed mesh must not be reachable from a
			// pooled slot until that slot happens to be reused
			expect(entry.mesh).toBe(null);
			expect(entry.instanced).toBe(null);
			setup();
			draw(mesh);
			expect(renderer._transparentPool[0]).toBe(entry);
			expect(renderer._transparentPool.length).toBe(length);
			renderer.flushTransparent();
		});

		it("does not re-queue during its own replay", (ctx) => {
			requireWebGL(ctx);
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			renderer.flushTransparent();
			// a replay that re-queued would never converge
			expect(renderer._transparentCount).toBe(0);
		});

		it("leaves mesh-mode state as it found it", (ctx) => {
			requireWebGL(ctx);
			const gl = renderer.gl;
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			renderer.flushTransparent();
			// blending off and depth writes back on, or the next opaque mesh
			// silently draws with the transparent pass's state
			expect(gl.getParameter(gl.BLEND)).toBe(false);
			expect(gl.getParameter(gl.DEPTH_WRITEMASK)).toBe(true);
		});

		it("does not let one entry's blend mode leak into the next", (ctx) => {
			requireWebGL(ctx);
			setup([0, 0, 0]);
			const glow = quad();
			glow.transparent = true;
			glow.blendMode = "additive";
			glow.tint.setColor(255, 0, 0);
			const plain = quad();
			plain.transparent = true;
			plain.tint.setColor(0, 0, 255);
			draw(glow, 900);
			draw(plain, 100);
			renderer.flushTransparent();
			// the 2D cache must not have learned the per-entry state
			expect(renderer.currentBlendMode).toBe("normal");
		});
	});
});
