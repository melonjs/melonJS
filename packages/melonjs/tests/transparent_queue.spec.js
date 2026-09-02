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

			renderer.resetScreenSpace(); // what `Application.draw` does per frame
			renderer.flushTransparent();
			expect(renderer._transparentCount).toBe(0);
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
			renderer.removeQueuedTransparent(doomed);
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
