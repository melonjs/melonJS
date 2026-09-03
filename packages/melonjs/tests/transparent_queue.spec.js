import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	boot,
	Camera3d,
	Container,
	InstancedMesh,
	Matrix3d,
	Mesh,
	ShaderEffect,
	Sprite3d,
	TextureAtlas,
} from "../src/index.js";
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

	afterEach(() => {
		// A test that fails part-way leaves entries queued, and the next test
		// then reports a count from its predecessor's leftovers rather than
		// its own — one real failure cascades into several misleading ones.
		renderer?.reset();
	});

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

	describe("the sort key survives a scaled ancestor", () => {
		it("orders by true view distance, not by an extracted eye", (ctx) => {
			requireWebGL(ctx);
			// `Container.draw` folds every ancestor transform into
			// `currentTransform`, so what the queue sees is not just the
			// camera's view — one scaled container makes the upper 3x3
			// non-orthonormal. Recovering the eye as -Rᵀ·t is invalid there,
			// and the two formulas disagree about which object is farther.
			//
			// View: scale (3, 1, 1) then translate (0, 0, -1000).
			//   A at (300, 0,    0) -> view ( 900, 0, -1000), d² = 1_810_000
			//   B at (  0, 0, -200) -> view (   0, 0, -1200), d² = 1_440_000
			// so A is farther. The eye extraction gives eye = (0, 0, 1000):
			//   A -> (300, 0, -1000), d² = 1_090_000
			//   B -> (  0, 0, -1200), d² = 1_440_000
			// which ranks B farther — the opposite order, and B would then be
			// composited on top of something actually in front of it.
			setup();
			const v = renderer.currentTransform;
			v.identity();
			v.val[0] = 3; // non-uniform scale, as a scaled container leaves
			v.val[14] = -1000;

			const near = quad();
			near.transparent = true;
			draw(near, -200);
			const far = quad();
			far.transparent = true;
			far.pos.set(300, 0, 0);
			draw(far, 0);

			const [b, a] = renderer._transparentPool;
			expect(Math.round(b.key)).toBe(1_440_000);
			expect(Math.round(a.key)).toBe(1_810_000);
			expect(a.key).toBeGreaterThan(b.key); // fails under -Rᵀ·t
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

		it("keeps submission order for entries at the same distance", (ctx) => {
			requireWebGL(ctx);
			// Coplanar decals and a mesh queued twice land on identical keys,
			// and blending is order-dependent — so the binary insertion has to
			// be stable, which the strict `<` gives it. With `<=` the pair
			// silently swaps and the wrong one wins the pixel.
			setup([255, 255, 255]);
			const first = quad();
			first.transparent = true;
			first.tint.setColor(255, 0, 0);
			const second = quad();
			second.transparent = true;
			second.tint.setColor(0, 0, 255);
			draw(first, 0);
			draw(second, 0); // same depth => same key
			expect(renderer._transparentPool[0].key).toBe(
				renderer._transparentPool[1].key,
			);
			renderer.flushTransparent();
			const px = readPixel();
			expect(px[2]).toBeGreaterThan(px[0]); // the LATER submission on top
		});

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
			// through the production call site, not the internal method: a
			// destroyed mesh reaches the queue via `deleteMeshGeometry`, and
			// severing that link left both of these tests passing
			renderer.deleteMeshGeometry(mesh);
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

	// ──────────────────────────────────────────────────────────────────────
	// What the review found: the routing predicate reads nothing about
	// instancing, nothing about the blend token's validity, and nothing about
	// where the queue will be drained. Each of those was a real defect.
	// ──────────────────────────────────────────────────────────────────────

	describe("the paths the predicate reaches but the replay forgot", () => {
		/** an instanced quad of the same size as `quad()`, one instance at the origin */
		const instancedQuad = (half = 16) => {
			const mesh = new InstancedMesh(0, 0, {
				vertices: new Float32Array([
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
				]),
				uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				texture: whiteAtlas(),
				width: half * 2,
				height: half * 2,
				cullBackFaces: false,
				lit: false,
				normalize: false,
				instanceCount: 1,
			});
			mesh._useWorldSpace = true;
			mesh.setInstance(0, new Matrix3d());
			return mesh;
		};

		it("fades an InstancedMesh instead of darkening it", (ctx) => {
			requireWebGL(ctx);
			// The predicate defers an instanced mesh exactly as it defers a
			// retained one — nothing in it looks at `instanceLayout`. The
			// replay has to honour that: a set queued and then drawn opaque
			// anyway is strictly WORSE than never deferring it, because the
			// draw has also been reordered to end of frame for nothing.
			// Measured before the fix: [127,127,127], the same darkening
			// signature the whole pass exists to remove.
			setup([0, 0, 255]);
			const mesh = instancedQuad();
			mesh.tint.setColor(255, 255, 255);
			mesh.setOpacity(0.5);
			draw(mesh);
			expect(renderer._transparentCount).toBe(1);
			renderer.flushTransparent();
			const px = readPixel();
			expect(px[2]).toBeGreaterThan(200); // the blue SURVIVES
			expect(px[0]).toBeGreaterThan(100);
			expect(px[0]).toBeLessThan(155);
			mesh.destroy();
		});

		it("leaves mesh-mode state clean after an INSTANCED replay", (ctx) => {
			requireWebGL(ctx);
			// The retained path's teardown is pinned; the instanced one was
			// not, and it is the same hazard: `depthMask(false)` left on makes
			// the next frame's one-shot depth clear a no-op, so the whole frame
			// renders against stale depth.
			const gl = renderer.gl;
			setup();
			const mesh = instancedQuad();
			mesh.setOpacity(0.5);
			draw(mesh);
			renderer.flushTransparent();
			expect(gl.getParameter(gl.DEPTH_WRITEMASK)).toBe(true);
			expect(gl.isEnabled(gl.BLEND)).toBe(false);
			mesh.destroy();
		});

		it('replays a `blendMode` of "none" without throwing', (ctx) => {
			requireWebGL(ctx);
			// `blendMode` is a plain property and `"none"` is a supported
			// token, so a faded mesh may legally carry it — and `"none"` has
			// no blend state by contract (it is replace). Dereferencing the
			// missing state threw mid-frame, out of the drain.
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.blendMode = "none";
			mesh.tint.setColor(255, 255, 255);
			mesh.setOpacity(0.5);
			draw(mesh);
			expect(() => {
				renderer.flushTransparent();
			}).not.toThrow();
			// replace semantics: the source overwrites, so the premultiplied
			// half-alpha white lands as-is and the background does NOT survive
			expect(readPixel()[2]).toBeLessThan(200);
		});

		it("replays under the transform it was queued with", (ctx) => {
			requireWebGL(ctx);
			// A queued entry carries a model matrix but the view is live on
			// the renderer, and `Container.draw` translates by its own
			// position before walking its children. Drained after that bracket
			// closed, the entry used to draw at the container's offset from
			// where it belongs — a visible jump the instant a mesh fades.
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.tint.setColor(255, 255, 255);
			mesh.setOpacity(0.5);
			const OFFSET = 40;
			renderer.save();
			renderer.translate(OFFSET, 0);
			draw(mesh);
			renderer.restore();
			renderer.flushTransparent();
			// centre of the canvas is where the OPAQUE draw would land; the
			// faded one belongs `OFFSET` to the right of it
			const atOffset = readPixel(SIZE / 2 + OFFSET, SIZE / 2);
			const atOrigin = readPixel(SIZE / 2, SIZE / 2);
			expect(atOffset[0]).toBeGreaterThan(100); // drawn here...
			expect(atOffset[2]).toBeGreaterThan(200); // ...and blended
			expect(Array.from(atOrigin).slice(0, 3)).toEqual([0, 0, 255]);
		});

		it("fades a lit mesh too", (ctx) => {
			requireWebGL(ctx);
			// the lit batcher inherits the replay, and an override that
			// dropped `_replayBlend` would silently un-fade the lit tier
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.lit = true;
			mesh.tint.setColor(255, 255, 255);
			mesh.setOpacity(0.5);
			draw(mesh);
			expect(renderer._transparentCount).toBe(1);
			renderer.flushTransparent();
			expect(readPixel()[2]).toBeGreaterThan(200); // blue survives
		});
	});

	describe("a replayed draw keeps the shader it was queued with", () => {
		it("carries the mesh's custom shader into the replay", (ctx) => {
			requireWebGL(ctx);
			// Both backends read `customShader` LIVE at draw time, and by the
			// time the pass replays, the renderable's `postDraw` has restored
			// it to whatever was current before. A mesh hosting a custom
			// shader therefore lost it the instant it faded, silently falling
			// back to the built-in shading — and at FULL opacity too under
			// `transparent: true`, which is not a pre-existing defect but a
			// regression the pass would have introduced.
			setup();
			const fx = new ShaderEffect(
				renderer,
				`
				vec4 apply(vec4 color, vec2 uv) {
					return color;
				}
			`,
			);
			try {
				const mesh = quad();
				mesh.setOpacity(0.5);
				// the production path: one effect on a non-managed renderable
				// takes `beginPostEffect`'s fast path, which installs it as
				// `customShader` — and `postDraw` -> `restore()` takes it away
				// again, before the drain
				mesh.addPostEffect(fx);
				draw(mesh);
				expect(renderer._transparentCount).toBe(1);
				expect(renderer.customShader).toBeUndefined();

				const seen = [];
				const drawMesh = renderer.drawMesh.bind(renderer);
				renderer.drawMesh = (...args) => {
					seen.push(renderer.customShader);
					return drawMesh(...args);
				};
				try {
					renderer.flushTransparent();
				} finally {
					renderer.drawMesh = drawMesh;
				}
				expect(seen).toHaveLength(1);
				expect(seen[0]).toBe(fx);
				// and it must not leak out of the pass
				expect(renderer.customShader).toBeUndefined();
			} finally {
				fx.destroy();
			}
		});

		it("replays an ordinary mesh with no shader at all", (ctx) => {
			requireWebGL(ctx);
			// the restore has to put back what was there, including nothing
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			const seen = [];
			const drawMesh = renderer.drawMesh.bind(renderer);
			renderer.drawMesh = (...args) => {
				seen.push(renderer.customShader);
				return drawMesh(...args);
			};
			try {
				renderer.flushTransparent();
			} finally {
				renderer.drawMesh = drawMesh;
			}
			expect(seen[0]).toBeUndefined();
		});
	});

	describe("the blend state actually reaches the GPU", () => {
		it("an additive entry really adds", (ctx) => {
			requireWebGL(ctx);
			// Asserting the 2D blend cache is left clean says nothing about
			// whether the entry's own mode was ever installed: an
			// `applyBlendFunction` that ignored `mode` passed every existing
			// test. Red additive over blue must read magenta.
			setup([0, 0, 255]);
			const mesh = quad();
			mesh.transparent = true;
			mesh.blendMode = "additive";
			mesh.tint.setColor(255, 0, 0);
			draw(mesh);
			renderer.flushTransparent();
			const px = readPixel();
			expect(px[0]).toBeGreaterThan(200); // the red ADDED
			expect(px[2]).toBeGreaterThan(200); // on top of the blue
		});

		it("restores the blend FUNCTION, not just the enable bit", (ctx) => {
			requireWebGL(ctx);
			// The replay overwrites the function behind the 2D cache's back,
			// so leaving only `GL_BLEND` off would let the next 2D draw
			// short-circuit its `setBlendMode` and inherit `additive`.
			const gl = renderer.gl;
			setup([0, 0, 0]);
			const mesh = quad();
			mesh.transparent = true;
			mesh.blendMode = "additive";
			draw(mesh);
			renderer.flushTransparent();
			expect(gl.getParameter(gl.BLEND_DST_RGB)).toBe(gl.ONE_MINUS_SRC_ALPHA);
		});
	});

	describe("the deprecated aliases still work", () => {
		it("`queueGroundShadow` routes into the transparent queue", (ctx) => {
			requireWebGL(ctx);
			// no caller left in src, so nothing exercised it — but it ships as
			// a documented deprecation and has to keep working
			setup();
			renderer.queueGroundShadow(quad(), new Matrix3d(), 0x80ffffff);
			expect(renderer._transparentCount).toBe(1);
			renderer.flushGroundShadows();
			expect(renderer._transparentCount).toBe(0);
		});
	});

	describe("the queue holds nothing alive", () => {
		it("`reset()` releases the queued references", (ctx) => {
			requireWebGL(ctx);
			// the drain's own release was pinned; `reset()`'s was not, so a
			// revert to a bare `_transparentCount = 0` passed the suite while
			// pinning a destroyed mesh alive in a pooled slot
			setup();
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			expect(renderer._transparentPool[0].mesh).not.toBe(null);
			renderer.reset();
			expect(renderer._transparentCount).toBe(0);
			expect(renderer._transparentPool[0].mesh).toBe(null);
			expect(renderer._transparentPool[0].instanced).toBe(null);
		});
	});

	describe("an overlay puts its own transparency down before it leaves", () => {
		// A `floating` child shares the render TARGET with the world — only
		// the projection swaps — so its transparent meshes land in the world's
		// queue. Replayed after the bracket closes they go through the
		// camera's perspective instead of the flat screen ortho, and their
		// vertices sit at view-space z = 0: the camera itself. The divide
		// deletes them. Measured before the fix: a faded HUD mesh drew ZERO
		// pixels anywhere in the frame, while the same mesh at full opacity
		// drew correctly — so fading a HUD model made it vanish.

		// A REAL `Camera3d`, not a stub: `Mesh.draw` decides between the
		// world-space GPU path and the 2D CPU projection by testing
		// `viewport instanceof Camera3d`, so a look-alike silently takes the
		// other path and tests nothing that matters here. `isDefault` is
		// forced because a standalone camera is not the application's, and
		// `Container.draw` skips floating children on a non-default camera.
		const camera3d = () => {
			const camera = new Camera3d(0, 0, SIZE, SIZE);
			Object.defineProperty(camera, "isDefault", {
				get: () => {
					return true;
				},
			});
			camera.pos.set(0, 0, -EYE_Z);
			// `Camera2d.draw` is what normally fills this in, and it is a
			// TOP-LEFT origin ortho — which is why the HUD below sits at the
			// middle of the screen rather than at the world origin
			// the wide z range Camera3d itself uses: its perspective near plane is
			// 0.1, so floating content left at the default depth 0 would be clipped
			camera.screenProjection.ortho(0, SIZE, SIZE, 0, -1e6, 1e6);
			return camera;
		};

		/** a faded quad placed centre-screen, as an overlay would be */
		const hudQuad = () => {
			const hud = quad();
			hud.floating = true;
			// screen coordinates: the floating projection is a top-left-origin
			// ortho over the canvas, so this is the middle of the screen
			hud.pos.set(SIZE / 2, SIZE / 2, 0);
			hud.tint.setColor(255, 255, 255);
			hud.setOpacity(0.5);
			return hud;
		};

		it("draws a faded mesh inside a floating child", (ctx) => {
			requireWebGL(ctx);
			const viewport = camera3d();
			renderer.setProjection(viewport.projectionMatrix);
			renderer.currentTransform.identity().translate(0, 0, -EYE_Z);
			renderer.backgroundColor.setColor(0, 0, 255, 255);
			renderer.clear();

			const hud = hudQuad();
			const world = new Container(0, 0, SIZE, SIZE);
			world.addChild(hud);

			world.preDraw(renderer);
			world.draw(renderer, viewport);
			world.postDraw(renderer);
			renderer.flushTransparent();

			// white over blue at half coverage, drawn under the SCREEN ortho.
			// Before the fix this read [0,0,255] — and a scan of the whole
			// frame found ZERO non-background pixels, so the mesh was not
			// displaced, it was gone.
			const px = readPixel();
			expect(px[2]).toBeGreaterThan(200);
			expect(px[0]).toBeGreaterThan(100);
			expect(px[0]).toBeLessThan(155);
		});

		it("puts world transparency DOWN before opening the overlay bracket", (ctx) => {
			requireWebGL(ctx);
			// `Container.draw` drains just before the screen-space bracket
			// opens, and that ordering is the whole point of the comment
			// there: over the world, under the overlay. The contract is that
			// the queue is EMPTY by the time the bracket opens — asserted at
			// that instant, because asserting on the final pixel is defeated
			// by the child walk order.
			const viewport = camera3d();
			const flat = new Matrix3d();
			flat.ortho(0, SIZE, SIZE, 0, -1e6, 1e6);
			viewport.projectionMatrix.copy(flat);
			viewport.worldProjection.copy(flat);
			renderer.setProjection(flat);
			renderer.currentTransform.identity();
			renderer.clear();

			const world = new Container(0, 0, SIZE, SIZE);
			world.autoSort = false; // keep the draw order predictable
			// children are walked BACKWARDS, so the overlay goes in first to
			// be drawn last
			const overlay = hudQuad();
			world.addChild(overlay);
			const faded = quad();
			faded.pos.set(SIZE / 2, SIZE / 2, 0);
			faded.setOpacity(0.5);
			// a NON-floating child is gated on `inViewport`, which nothing sets
			// in this bare harness — without it the child is skipped and the
			// test proves nothing
			faded.inViewport = true;
			world.addChild(faded);

			const atBracket = [];
			const begin = renderer.beginScreenSpace.bind(renderer);
			renderer.beginScreenSpace = (...a) => {
				atBracket.push(renderer._transparentCount);
				return begin(...a);
			};
			try {
				world.preDraw(renderer);
				world.draw(renderer, viewport);
				world.postDraw(renderer);
			} finally {
				renderer.beginScreenSpace = begin;
			}
			renderer.flushTransparent();

			expect(atBracket).toHaveLength(1);
			// the world's transparency is already down
			expect(atBracket[0]).toBe(0);
		});

		it("drains before restoring the world projection, not after", (ctx) => {
			requireWebGL(ctx);
			// order is the whole fix: after the restore the entry replays
			// through the perspective and is annihilated
			const viewport = camera3d();
			renderer.setProjection(viewport.projectionMatrix);
			renderer.currentTransform.identity().translate(0, 0, -EYE_Z);
			renderer.clear();

			const order = [];
			const drain = renderer.flushTransparentPass.bind(renderer);
			const project = renderer.setProjection.bind(renderer);
			renderer.flushTransparentPass = (...a) => {
				// only a drain that actually had something to put down counts:
				// `Container.draw` also drains BEFORE opening the bracket, and
				// on an empty queue that call would otherwise satisfy this
				// assertion all by itself
				if (renderer._transparentCount > 0) {
					order.push("drain");
				}
				return drain(...a);
			};
			renderer.setProjection = (m) => {
				if (m === viewport.worldProjection || m === viewport.projectionMatrix) {
					order.push("restore");
				}
				return project(m);
			};
			try {
				const hud = hudQuad();
				const world = new Container(0, 0, SIZE, SIZE);
				world.addChild(hud);
				world.preDraw(renderer);
				world.draw(renderer, viewport);
				world.postDraw(renderer);
			} finally {
				renderer.flushTransparentPass = drain;
				renderer.setProjection = project;
			}
			expect(order.indexOf("drain")).toBeGreaterThanOrEqual(0);
			expect(order.indexOf("drain")).toBeLessThan(order.lastIndexOf("restore"));
		});
	});

	describe("an unbalanced overlay bracket cannot disable the pass", () => {
		it("recovers at the frame boundary", (ctx) => {
			requireWebGL(ctx);
			// `Container.draw` opens the screen-space bracket without a
			// `finally`, so a floating child that throws leaves it open — and
			// while it is open every drain is skipped. Left to `reset()` that
			// would persist until the next STAGE CHANGE, not the next frame,
			// so the pass would stay dead and the queue grow all the while.
			setup();
			renderer.beginScreenSpace(); // ...and never closed
			const mesh = quad();
			mesh.setOpacity(0.5);
			draw(mesh);
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(1); // blocked, as designed

			renderer.resetFrameState(); // what `Application.draw` does per frame
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(0);
		});

		it("purges a queue an abandoned frame left behind", (ctx) => {
			requireWebGL(ctx);
			// A frame that dies between `beginPostEffect` and `endPostEffect`
			// never drains that pass's queue, and the pool hands its key to a
			// LATER pass — which would then replay a dead frame's geometry into
			// its own target. Only `reset()` cleared this, and that runs on a
			// stage change, not per frame.
			setup();
			renderer._renderTargetPool.begin(false, 2, SIZE, SIZE);
			const stranded = renderer.transparentTarget();
			const mesh = quad();
			mesh.transparent = true;
			draw(mesh);
			expect(renderer.transparentQueue(stranded).count).toBe(1);
			renderer._renderTargetPool.end(); // pass unwinds without draining

			renderer.resetFrameState();
			expect(renderer.transparentQueue(stranded).count).toBe(0);
			expect(renderer.transparentQueue(stranded).pool[0].mesh).toBe(null);
		});
	});

	describe("the camera closes the pass before its own effects", () => {
		it("drains before drawFX, so a flash covers the transparency too", (ctx) => {
			requireWebGL(ctx);
			// The camera's flash/fade is painted over the finished world. Drain
			// after it and transparent geometry lands ON TOP of the flash —
			// the one thing it must never do. Nothing pinned the ordering.
			const camera = new Camera3d(0, 0, SIZE, SIZE);
			const order = [];
			const drain = renderer.flushTransparent.bind(renderer);
			renderer.flushTransparent = (...a) => {
				order.push("drain");
				return drain(...a);
			};
			const fx = camera.drawFX.bind(camera);
			camera.drawFX = (...a) => {
				order.push("drawFX");
				return fx(...a);
			};
			try {
				camera.draw(renderer, new Container(0, 0, SIZE, SIZE));
			} finally {
				renderer.flushTransparent = drain;
				camera.drawFX = fx;
			}
			expect(order).toEqual(["drain", "drawFX"]);
		});
	});

	// ──────────────────────────────────────────────────────────────────────
	// One queue PER RENDER TARGET.
	//
	// A post effect binds its own offscreen target part-way through a scene.
	// With a single renderer-wide queue, a drain that fired inside that
	// bracket replayed the WORLD's queued geometry into the effect's buffer —
	// baking the scene's transparent objects into one renderable's texture,
	// and removing them from the scene. Keyed per target the two never meet.
	// ──────────────────────────────────────────────────────────────────────

	describe("a queue belongs to the target it was recorded for", () => {
		/** a renderable stand-in with two effects, which forces the FBO path */
		const effectPass = () => {
			const passthrough = () => {
				return new ShaderEffect(
					renderer,
					`
					vec4 apply(vec4 color, vec2 uv) {
						return color;
					}
				`,
				);
			};
			return {
				postEffects: [passthrough(), passthrough()],
				_postEffectManaged: false,
			};
		};

		const destroyPass = (pass) => {
			for (const fx of pass.postEffects) {
				fx.destroy();
			}
		};

		it("keeps the world's entries out of an effect's queue", (ctx) => {
			requireWebGL(ctx);
			setup();
			const world = quad();
			world.setOpacity(0.5);
			draw(world);
			expect(renderer._transparentCount).toBe(1);

			const pass = effectPass();
			expect(renderer.beginPostEffect(pass)).toBe(true);
			// inside the bracket the current target is the effect's own, and
			// its queue is empty — the world's entry is NOT visible here
			expect(renderer._transparentCount).toBe(0);
			// ...and a drain in here must not consume it
			renderer.flushTransparent();
			renderer.endPostEffect(pass);
			renderer.flush();

			// back outside, the world's entry survived untouched
			expect(renderer._transparentCount).toBe(1);
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(0);
			destroyPass(pass);
		});

		it("gives each target its own queue", (ctx) => {
			requireWebGL(ctx);
			setup();
			draw(Object.assign(quad(), { transparent: true }));
			const outside = renderer.transparentTarget();
			const pass = effectPass();
			renderer.beginPostEffect(pass);
			const inside = renderer.transparentTarget();
			draw(Object.assign(quad(), { transparent: true }));
			expect(renderer.transparentQueue(inside).count).toBe(1);
			expect(renderer.transparentQueue(outside).count).toBe(1);
			expect(inside).not.toBe(outside);
			renderer.endPostEffect(pass);
			renderer.flush();
			renderer.flushTransparent();
			destroyPass(pass);
		});

		it("drains a pass's own queue before its target is unbound", (ctx) => {
			requireWebGL(ctx);
			// otherwise the entries are stranded: the key returns to the pool
			// and a later pass reusing it would replay them into ITS target
			setup();
			const pass = effectPass();
			renderer.beginPostEffect(pass);
			const inside = renderer.transparentTarget();
			draw(Object.assign(quad(), { transparent: true }));
			expect(renderer.transparentQueue(inside).count).toBe(1);
			renderer.endPostEffect(pass);
			renderer.flush();
			expect(renderer.transparentQueue(inside).count).toBe(0);
			destroyPass(pass);
		});

		it("sweeps every target when a queued mesh is destroyed", (ctx) => {
			requireWebGL(ctx);
			setup();
			const doomed = quad();
			doomed.transparent = true;
			draw(doomed);
			const pass = effectPass();
			renderer.beginPostEffect(pass);
			// destroyed from inside a pass, while queued OUTSIDE it
			renderer.deleteMeshGeometry(doomed);
			renderer.endPostEffect(pass);
			renderer.flush();
			expect(renderer._transparentCount).toBe(0);
			destroyPass(pass);
		});

		it("`reset()` clears every target's queue, not just the current one", (ctx) => {
			requireWebGL(ctx);
			setup();
			draw(Object.assign(quad(), { transparent: true }));
			const outside = renderer.transparentTarget();
			renderer._renderTargetPool.begin(false, 2, SIZE, SIZE);
			const inside = renderer.transparentTarget();
			draw(Object.assign(quad(), { transparent: true }));
			renderer._renderTargetPool.end();
			expect(renderer.transparentQueue(inside).count).toBe(1);
			renderer.reset();
			expect(renderer.transparentQueue(inside).count).toBe(0);
			expect(renderer.transparentQueue(outside).count).toBe(0);
			expect(renderer.transparentQueue(inside).pool[0].mesh).toBe(null);
		});
	});
});

describe("Mesh reads `transparent` from its settings", () => {
	// Every routing test assigns the property after construction, so the
	// documented constructor path — the one the JSDoc example itself uses —
	// was never exercised: a glTF BLEND glow built with `transparent: true`
	// could silently draw opaque.
	beforeAll(async () => {
		await boot();
	});

	const build = (settings) => {
		return new Mesh(0, 0, {
			vertices: [0, 0, 0, 1, 0, 0, 1, 1, 0],
			uvs: [0, 0, 1, 0, 1, 1],
			indices: [0, 1, 2],
			width: 1,
			height: 1,
			...settings,
		});
	};

	it("keeps `true`", () => {
		expect(build({ transparent: true }).transparent).toBe(true);
	});

	it("keeps `false`", () => {
		expect(build({ transparent: false }).transparent).toBe(false);
	});

	it("leaves it unset when omitted, for the automatic check", () => {
		expect(build({}).transparent).toBeUndefined();
	});
});

/**
 * `Sprite3d` picks the cutout threshold that decides whether a fading sprite
 * survives, so the two interact and the choice is pinned here.
 */
describe("Sprite3d and the alpha cutout", () => {
	beforeAll(async () => {
		await boot();
	});

	it("drops the cutoff to the floor when explicitly transparent", () => {
		const sprite = new Sprite3d(0, 0, {
			width: 16,
			height: 16,
			transparent: true,
		});
		expect(sprite.alphaCutoff).toBeCloseTo(1 / 255, 6);
	});

	it("keeps the 0.5 default otherwise", () => {
		const sprite = new Sprite3d(0, 0, { width: 16, height: 16 });
		expect(sprite.alphaCutoff).toBe(0.5);
	});

	it("forwards the transparent flag, not just the cutoff", () => {
		// the cutoff drop was pinned, the flag it depends on was not — so the
		// sprite could get the 1/255 cutoff for being transparent and then
		// draw opaque anyway, which is the exact artefact the flag prevents
		const sprite = new Sprite3d(0, 0, {
			width: 16,
			height: 16,
			transparent: true,
		});
		expect(sprite.transparent).toBe(true);
	});

	it("an explicit cutoff always wins", () => {
		const sprite = new Sprite3d(0, 0, {
			width: 16,
			height: 16,
			transparent: true,
			alphaCutoff: 0.25,
		});
		expect(sprite.alphaCutoff).toBe(0.25);
	});
});
