import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defaultApplicationSettings } from "../src/application/defaultApplicationSettings.ts";
import {
	Camera3d,
	InstancedMesh,
	Matrix3d,
	Mesh,
	Rect,
	Sprite3d,
	Vector3d,
	WebGLRenderer,
	WebGPURenderer,
} from "../src/index.js";
import {
	getShadowQuad,
	releaseShadowQuads,
} from "../src/renderable/groundshadow.js";
import Renderer from "../src/video/renderer.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * Ground ("blob") shadows — #1515.
 *
 * Two things are under test and they pull in opposite directions. The feature
 * itself: a soft, blended, depth-test-but-not-depth-write quad under an
 * object. And the guarantee that surrounds it: a mesh that does **not** opt in
 * must cost and render exactly what it did before any of this existed. The
 * second is the harder one, because the mesh pass keeps its blend and depth
 * state at *pass* scope — `MeshBatcher.bind()` runs only on a batcher
 * transition — so anything the shadow changes per draw it must put back.
 */
describe("Ground shadows (#1515)", () => {
	let renderer;
	let camera;

	// a quad standing upright, so it has a horizontal extent to size a shadow
	// from and something to sit above
	const GEOMETRY = {
		vertices: new Float32Array([
			-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
		]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
	};

	beforeAll(async () => {
		renderer = await getWebGLRenderer(128, 128);
		camera = new Camera3d(0, 0, 128, 128);
		// Ground shadows are ON by default application-wide, which is what the
		// "the shipped default" case below asserts. Every other test here is
		// about an EXPLICIT opt-in and its cost, so they run against a pinned
		// `false` — otherwise "an unshadowed mesh is untouched" would be
		// testing a mesh that is, in fact, shadowed.
		renderer.settings.castGroundShadow = false;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	const makeMesh = (settings = {}) => {
		return new Mesh(0, 0, {
			...GEOMETRY,
			width: 32,
			normalize: false,
			...settings,
		});
	};

	// One frame's worth of drawing for a single mesh. `flushGroundShadows` is
	// what `Application.draw` calls at end of frame, and it is not optional
	// here: a shadow is DEFERRED to the end of the mesh pass (it writes no
	// depth, so anything opaque drawn after it — the ground above all — would
	// paint straight over it). Without the drain, no shadow is ever issued.
	const drawOnce = (mesh) => {
		mesh.preDraw(renderer);
		mesh.draw(renderer, camera);
		mesh.postDraw(renderer);
		renderer.flushGroundShadows();
		renderer.flush();
	};

	// The blob's placement lives in the shared quad's own model matrix — the
	// shadow is sized by two independent ground-plane axes (so it can be an
	// oriented ellipse rather than a disc), which no single scalar captures.
	const shadowGroundY = (lit = false) => {
		return renderer._shadowQuads[lit ? "lit" : "unlit"]._modelMatrix.val[13];
	};
	// the blob's half-extent along each ground axis
	const shadowAxes = (lit = false) => {
		const m = renderer._shadowQuads[lit ? "lit" : "unlit"]._modelMatrix.val;
		return {
			x: Math.hypot(m[0], m[2]) / 2,
			z: Math.hypot(m[8], m[10]) / 2,
		};
	};

	// ── the backward-compatibility contract ─────────────────────────────

	describe("an unshadowed mesh is untouched", () => {
		it("issues exactly one draw", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeMesh();
			drawOnce(mesh);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(mesh);
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockRestore();
			mesh.destroy();
		});

		it("leaves BLEND off and depth writes on, as mesh mode requires", (ctx) => {
			requireWebGL(ctx, renderer);
			// nothing asserted this before, and it is the actual contract the
			// shadow could break: both are pass-scoped state that `bind()` only
			// re-establishes on a batcher transition
			const gl = renderer.gl;
			const mesh = makeMesh();
			drawOnce(mesh);
			expect(gl.isEnabled(gl.BLEND)).toBe(false);
			expect(gl.getParameter(gl.DEPTH_WRITEMASK)).toBe(true);
			mesh.destroy();
		});
	});

	describe("a shadowed mesh restores what it borrowed", () => {
		it("BLEND is off and depth writes are back on afterwards", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeMesh({ castGroundShadow: true });
			drawOnce(mesh);
			expect(gl.isEnabled(gl.BLEND)).toBe(false);
			expect(gl.getParameter(gl.DEPTH_WRITEMASK)).toBe(true);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			mesh.destroy();
		});

		it("ADVERSARIAL: the blend MODE cache is left exactly as found", (ctx) => {
			requireWebGL(ctx, renderer);
			// the shadow sets the blend function directly, without going
			// through setBlendMode. If it left the cache claiming one mode
			// while GL held another's function, the next 2D draw asking for
			// that mode would short-circuit and silently inherit this one.
			renderer.setBlendMode("additive");
			const before = renderer.currentBlendMode;
			const mesh = makeMesh({ castGroundShadow: true });
			drawOnce(mesh);
			expect(renderer.currentBlendMode).toBe(before);
			renderer.setBlendMode("normal");
			mesh.destroy();
		});

		it("ADVERSARIAL: the renderer tint and global alpha are unchanged", (ctx) => {
			requireWebGL(ctx, renderer);
			// the shadow darkens the tint and lowers the alpha for its own
			// draw; leaking either would tint every later object
			renderer.setGlobalAlpha(0.8);
			renderer.currentTint.setColor(10, 20, 30);
			const mesh = makeMesh({ castGroundShadow: true });
			drawOnce(mesh);
			expect(renderer.getGlobalAlpha()).toBeCloseTo(0.8, 5);
			expect(renderer.currentTint.r).toBe(10);
			expect(renderer.currentTint.g).toBe(20);
			expect(renderer.currentTint.b).toBe(30);
			renderer.setGlobalAlpha(1);
			renderer.currentTint.setColor(255, 255, 255);
			mesh.destroy();
		});
	});

	// ── the shadow itself ───────────────────────────────────────────────

	describe("the shadow draw", () => {
		it("adds exactly one draw call", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const plain = makeMesh();
			const shadowed = makeMesh({ castGroundShadow: true });
			drawOnce(plain);
			drawOnce(shadowed);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(plain);
			const plainDraws = spy.mock.calls.length;
			drawOnce(shadowed);
			const shadowedDraws = spy.mock.calls.length - plainDraws;
			expect(shadowedDraws).toBe(plainDraws + 1);
			spy.mockRestore();
			plain.destroy();
			shadowed.destroy();
		});

		it("shares one quad across every shadowed mesh", (ctx) => {
			requireWebGL(ctx, renderer);
			// one geometry upload for the whole scene, however many shadows
			const a = makeMesh({ castGroundShadow: true });
			const b = makeMesh({ castGroundShadow: true });
			drawOnce(a);
			const used = renderer._shadowQuads.unlit;
			drawOnce(b);
			// the same object, not merely an equivalent one — retained
			// geometry is keyed per mesh instance, so sharing the object is
			// what makes it one upload for the whole scene
			expect(renderer._shadowQuads.unlit).toBe(used);
			a.destroy();
			b.destroy();
		});

		it("keeps a lit owner on the lit tier", (ctx) => {
			requireWebGL(ctx, renderer);
			// a shared unlit quad between lit meshes would force a
			// litMesh -> mesh -> litMesh batcher transition per shadowed object
			const mesh = makeMesh({ castGroundShadow: true, lit: true });
			drawOnce(mesh);
			expect(renderer._shadowQuads.lit).toBeDefined();
			expect(renderer._shadowQuads.lit.lit).toBe(true);
			mesh.destroy();
		});

		it("ADVERSARIAL: the shadow sits BELOW the mesh, not above it", (ctx) => {
			requireWebGL(ctx, renderer);
			// render space is Y-DOWN, so the floor is a GREATER Y than the
			// object standing on it. The sign is the single easiest thing to
			// get backwards here, and backwards puts the blob in mid-air.
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.pos.set(0, 0, 100);
			drawOnce(mesh);
			expect(shadowGroundY()).toBeGreaterThan(mesh.pos.y);
			mesh.destroy();
		});

		it("fades out entirely once the object is high enough", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.pos.set(0, 0, 100);
			// a floor far below (greater Y) than the object
			mesh.shadowGroundY = 10000;
			drawOnce(mesh);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(mesh);
			// the object's own draw only — the shadow skipped entirely
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockRestore();
			mesh.destroy();
		});

		it("shrinks as the object rises", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.pos.set(0, 0, 100);
			mesh.shadowGroundY = mesh.getBounds3d().bottom;
			drawOnce(mesh);
			const grounded = shadowAxes().x;

			// lift it: the floor is now further below (greater Y difference)
			mesh.shadowGroundY = mesh.getBounds3d().bottom + 20;
			drawOnce(mesh);
			expect(shadowAxes().x).toBeLessThan(grounded);
			mesh.destroy();
		});
	});

	// ── the blended state, at the moment it matters ─────────────────────

	describe("the draw state each range is issued under", () => {
		/**
		 * Record the blend / depth-write state at every `drawElements`.
		 *
		 * A pixel test would be the more direct proof, but a standalone
		 * `Camera3d` never runs its own draw, so nothing establishes the view
		 * and projection uniforms and the frame comes back empty — which is
		 * why the other 3D specs count calls rather than read pixels. What is
		 * asserted here is the mechanism itself: the state each draw is issued
		 * under, which is what makes the shadow soft and what must be handed
		 * back afterwards. The look is verified visually on the forest
		 * example.
		 */
		const stateAtEachDraw = (mesh) => {
			const gl = renderer.gl;
			const seen = [];
			const original = gl.drawElements;
			gl.drawElements = function (...args) {
				seen.push({
					blend: gl.isEnabled(gl.BLEND),
					depthWrite: gl.getParameter(gl.DEPTH_WRITEMASK),
				});
				return original.apply(this, args);
			};
			try {
				drawOnce(mesh);
			} finally {
				gl.drawElements = original;
			}
			return seen;
		};

		it("the object opaque, its shadow blended and depth-write-free", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh({ castGroundShadow: true });
			drawOnce(mesh);

			const seen = stateAtEachDraw(mesh);
			expect(seen).toHaveLength(2);
			// the object itself is unchanged: opaque, writing depth
			expect(seen[0]).toEqual({ blend: false, depthWrite: true });
			// the shadow blends, and does NOT write depth — so two overlapping
			// shadows at one ground height blend instead of fighting under
			// LEQUAL
			expect(seen[1]).toEqual({ blend: true, depthWrite: false });
			mesh.destroy();
		});

		it("REGRESSION: an unshadowed mesh draws under untouched state", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			drawOnce(mesh);
			expect(stateAtEachDraw(mesh)).toEqual([
				{ blend: false, depthWrite: true },
			]);
			mesh.destroy();
		});
	});
	// ── Sprite3d, which is the whole point of the feature ───────────────

	describe("Sprite3d", () => {
		const makeSprite = (settings = {}) => {
			return new Sprite3d(0, 0, {
				image: Renderer.getWhitePixel(),
				width: 40,
				height: 60,
				...settings,
			});
		};

		it("REGRESSION: the setting survives the Sprite3d constructor", (ctx) => {
			requireWebGL(ctx, renderer);
			// Sprite3d hands `Mesh` a BUILT settings object rather than the
			// caller's, so anything it does not name is dropped. That silently
			// made every sprite shadowless while a Mesh-only test suite stayed
			// green — the one case the feature exists for.
			const sprite = makeSprite({ castGroundShadow: true });
			expect(sprite.castGroundShadow).toBe(true);
			sprite.destroy();
		});

		it("forwards the tuning settings too, not just the flag", (ctx) => {
			requireWebGL(ctx, renderer);
			const sprite = makeSprite({
				castGroundShadow: true,
				shadowOpacity: 0.9,
				shadowGroundY: 123,
			});
			expect(sprite.shadowOpacity).toBe(0.9);
			expect(sprite.shadowGroundY).toBe(123);
			sprite.destroy();
		});

		it("REGRESSION: InstancedMesh forwards it too", (ctx) => {
			requireWebGL(ctx, renderer);
			// It passes `settings` straight through today, where Sprite3d
			// whitelists — which is exactly why Sprite3d silently dropped this
			// and InstancedMesh did not. Pinned so a future refactor to a
			// whitelist has to notice.
			const mesh = new InstancedMesh(0, 0, {
				...GEOMETRY,
				width: 32,
				normalize: false,
				instanceCount: 2,
				castGroundShadow: true,
				shadowOpacity: 0.7,
			});
			expect(mesh.castGroundShadow).toBe(true);
			expect(mesh.shadowOpacity).toBe(0.7);
			mesh.destroy();
		});

		it("defaults to unset — meaning 'follow the application setting'", (ctx) => {
			requireWebGL(ctx, renderer);
			// tri-state, not a boolean: `undefined` has to survive the Sprite3d
			// settings whitelist, or a scene-wide default can never reach it
			expect(makeSprite().castGroundShadow).toBeUndefined();
		});

		it("ADVERSARIAL: a billboard's shadow still lands BELOW it", (ctx) => {
			requireWebGL(ctx, renderer);
			// the real Y-down sign trap: Sprite3d's billboard branch bypasses
			// the Y-negating axis bridge entirely and writes pos.y straight
			// into the matrix, so a Mesh-only test proves nothing here
			const sprite = makeSprite({ castGroundShadow: true, billboard: "face" });
			sprite.pos.set(0, 0, 300);
			drawOnce(sprite);
			expect(shadowGroundY()).toBeGreaterThan(sprite.pos.y);
			sprite.destroy();
		});

		it("adds exactly one draw call, as for a mesh", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const plain = makeSprite();
			const shadowed = makeSprite({ castGroundShadow: true });
			drawOnce(plain);
			drawOnce(shadowed);

			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(plain);
			const plainDraws = spy.mock.calls.length;
			drawOnce(shadowed);
			expect(spy.mock.calls.length - plainDraws).toBe(plainDraws + 1);
			spy.mockRestore();
			plain.destroy();
			shadowed.destroy();
		});
	});
	// ── the instanced tier: one draw for the whole set ──────────────────

	describe("InstancedMesh", () => {
		const makeInstanced = (count, settings = {}) => {
			const mesh = new InstancedMesh(0, 0, {
				...GEOMETRY,
				width: 32,
				normalize: false,
				instanceCount: count,
				castGroundShadow: true,
				...settings,
			});
			const placement = new Matrix3d();
			for (let i = 0; i < count; i++) {
				placement.identity().translate(i * 8, 0, 0);
				mesh.setInstance(i, placement);
			}
			return mesh;
		};

		it("costs ONE extra draw, whatever the instance count", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const few = makeInstanced(4);
			const many = makeInstanced(400);
			drawOnce(few);
			drawOnce(many);

			const spy = vi.spyOn(gl, "drawElementsInstanced");
			drawOnce(few);
			const fewDraws = spy.mock.calls.length;
			drawOnce(many);
			const manyDraws = spy.mock.calls.length - fewDraws;
			// two apiece — the trees, then every shadow in one call. 400
			// instances cost exactly what 4 do.
			expect(fewDraws).toBe(2);
			expect(manyDraws).toBe(2);
			// ...and the shadow pass covers the whole set
			expect(spy.mock.calls.at(-1)[4]).toBe(400);
			expect(gl.getError()).toBe(gl.NO_ERROR);
			spy.mockRestore();
			few.destroy();
			many.destroy();
		});

		it("REGRESSION: no shadow flag means no extra draw", (ctx) => {
			requireWebGL(ctx, renderer);
			const gl = renderer.gl;
			const mesh = makeInstanced(16, { castGroundShadow: false });
			drawOnce(mesh);

			const spy = vi.spyOn(gl, "drawElementsInstanced");
			drawOnce(mesh);
			expect(spy).toHaveBeenCalledTimes(1);
			spy.mockRestore();
			mesh.destroy();
		});

		it("ADVERSARIAL: per-instance colour and data do NOT tint the shadows", (ctx) => {
			requireWebGL(ctx, renderer);
			// The hazard the standalone shader exists to avoid: the instanced
			// mesh families multiply aInstanceColor into the tint and add
			// aInstanceData as emissive, so a variant-derived shadow would give
			// a forest coloured, glowing blobs. This shader declares neither.
			const mesh = makeInstanced(8, {
				instanceColors: true,
				instanceData: true,
			});
			for (let i = 0; i < 8; i++) {
				mesh.setInstanceData(i, 1, 0, 0, 1);
			}
			drawOnce(mesh);
			const shader = renderer.currentBatcher.shadowShader;
			expect(shader).toBeDefined();
			expect(shader.getAttribLocation("aInstanceColor")).toBe(-1);
			expect(shader.getAttribLocation("aInstanceData")).toBe(-1);
			expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
			mesh.destroy();
		});

		it("REGRESSION: a LIT instanced mesh's shadow shader links", (ctx) => {
			requireWebGL(ctx, renderer);
			// The whole instanced suite used to be unlit, and that gap hid a
			// real break: the shadow's vertex stage is GLSL ES 1.00, while the
			// LIT tier's fragment stage is `#version 300 es`, so pairing them
			// fails to link and takes every lit instanced mesh down with it.
			// A link failure surfaces as a thrown init, not a wrong pixel.
			const mesh = makeInstanced(4, { lit: true });
			expect(() => {
				drawOnce(mesh);
			}).not.toThrow();
			const shader = renderer.currentBatcher.shadowShader;
			expect(shader).toBeDefined();
			expect(shader.program).not.toBeNull();
			expect(renderer.gl.getError()).toBe(renderer.gl.NO_ERROR);
			mesh.destroy();
		});

		it("REGRESSION: the blob is sized from the PROTOTYPE, not assumed 1 unit", (ctx) => {
			requireWebGL(ctx, renderer);
			// The instanced vertex stage scales the quad by each record's
			// horizontal scale alone, so a unit quad silently assumes the
			// prototype is exactly 1 unit across. glTF meshes load unnormalised
			// and are not — a 3-unit-wide tree got a blob sized for a 1-unit
			// one, and the same asset drew a different shadow instanced than
			// standalone. Nothing about that is visible from a draw count.
			const wide = makeInstanced(2, {
				width: 40,
				vertices: new Float32Array([-3, -1, -3, 3, -1, -3, 3, 1, 3, -3, 1, 3]),
			});
			drawOnce(wide);
			const quad = wide._shadowQuad;
			expect(quad).toBeDefined();
			// half-extent 3, times the 1.2 contact spread
			const halfX = Math.max(
				...quad.originalVertices.filter((_, i) => {
					return i % 3 === 0;
				}),
			);
			expect(halfX).toBeCloseTo(3 * 1.2, 4);
			// and it is NOT the shared unit quad
			expect(quad).not.toBe(renderer._shadowQuads?.unlit);
			wide.destroy();
		});

		it("REGRESSION: the shadow draw does not rebuild the MAIN vertex state", (ctx) => {
			requireWebGL(ctx, renderer);
			// The shadow runs under its own program. Asking the main
			// instanced helper for state while that program is bound makes it
			// judge the main vertex state stale (it keys on the bound shader),
			// tear it down and rebuild it against a program missing every mesh
			// attribute — and the next frame's main draw rebuilds it back.
			// Identity comparison cannot see it: `build()` reuses the object and
			// only swaps the VAO. Counting the GL calls can.
			const mesh = makeInstanced(4, { lit: true });
			drawOnce(mesh);
			const gl = renderer.gl;
			const created = vi.spyOn(gl, "createVertexArray");
			const deleted = vi.spyOn(gl, "deleteVertexArray");
			drawOnce(mesh);
			drawOnce(mesh);
			// steady state: both vertex states are built and stay built
			expect(created).not.toHaveBeenCalled();
			expect(deleted).not.toHaveBeenCalled();
			created.mockRestore();
			deleted.mockRestore();
			mesh.destroy();
		});

		it("ADVERSARIAL: the shadow vertex state is built once, not per frame", (ctx) => {
			requireWebGL(ctx, renderer);
			// the two passes use different geometry AND different programs, so
			// sharing one state slot would make each rebuild the other's vertex
			// array every single draw
			const mesh = makeInstanced(8);
			drawOnce(mesh);
			const state = renderer.currentBatcher.instanced.get(mesh);
			const built = state.shadowVertexState;
			const main = state.vertexState;
			drawOnce(mesh);
			drawOnce(mesh);
			expect(state.shadowVertexState).toBe(built);
			expect(state.vertexState).toBe(main);
			mesh.destroy();
		});
	});

	// ── where the opt-in comes from ─────────────────────────────────────

	describe("opt-in precedence", () => {
		// the setting the renderer was built with; restored after each case so
		// a leaked `true` cannot quietly satisfy a later test
		const withAppSetting = (value, fn) => {
			const settings = renderer.settings;
			const had = settings.castGroundShadow;
			settings.castGroundShadow = value;
			try {
				fn();
			} finally {
				settings.castGroundShadow = had;
			}
		};

		const drawsShadow = (mesh) => {
			const gl = renderer.gl;
			drawOnce(mesh);
			const spy = vi.spyOn(gl, "drawElements");
			drawOnce(mesh);
			const count = spy.mock.calls.length;
			spy.mockRestore();
			return count > 1;
		};

		it("the shipped default is ON", (ctx) => {
			requireWebGL(ctx, renderer);
			// the application default ships `true` — a 3D object that opts into
			// nothing still gets its shadow. 2D games are unaffected whatever
			// this says: the shadow rides the retained Camera3d path only.
			expect(defaultApplicationSettings.castGroundShadow).toBe(true);
			const mesh = makeMesh();
			expect(mesh.castGroundShadow).toBeUndefined();
			withAppSetting(true, () => {
				expect(drawsShadow(mesh)).toBe(true);
			});
			mesh.destroy();
		});

		it("an application setting of false opts a whole game out", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			withAppSetting(false, () => {
				expect(drawsShadow(mesh)).toBe(false);
			});
			mesh.destroy();
		});

		it("the application setting opts a mesh in", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh();
			withAppSetting(true, () => {
				expect(drawsShadow(mesh)).toBe(true);
			});
			mesh.destroy();
		});

		it("a per-mesh false overrides the application setting", (ctx) => {
			requireWebGL(ctx, renderer);
			// the direction that matters for a ground plane in a scene whose
			// application default is on
			const mesh = makeMesh({ castGroundShadow: false });
			withAppSetting(true, () => {
				expect(drawsShadow(mesh)).toBe(false);
			});
			mesh.destroy();
		});

		it("a per-mesh true survives an application setting of false", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh({ castGroundShadow: true });
			withAppSetting(false, () => {
				expect(drawsShadow(mesh)).toBe(true);
			});
			mesh.destroy();
		});

		it("the blanket opt-in SKIPS a flat mesh — that is the ground plane", (ctx) => {
			requireWebGL(ctx, renderer);
			// a plane lying in the ground plane has no height to cast from, and
			// shadowing it with itself smears a blob over the whole floor
			const flat = new Mesh(0, 0, {
				vertices: new Float32Array([-9, 0, -9, 9, 0, -9, 9, 0, 9, -9, 0, 9]),
				uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]),
				width: 32,
				normalize: false,
			});
			withAppSetting(true, () => {
				expect(drawsShadow(flat)).toBe(false);
			});
			flat.destroy();
		});

		it("…but an EXPLICIT opt-in on that same flat mesh is obeyed", (ctx) => {
			requireWebGL(ctx, renderer);
			// the safeguard is for blanket defaults only — asking for it
			// directly is an instruction, e.g. a floating platform
			const flat = new Mesh(0, 0, {
				vertices: new Float32Array([-9, 0, -9, 9, 0, -9, 9, 0, 9, -9, 0, 9]),
				uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]),
				width: 32,
				normalize: false,
				castGroundShadow: true,
			});
			withAppSetting(false, () => {
				expect(drawsShadow(flat)).toBe(true);
			});
			flat.destroy();
		});

		it("REGRESSION: Sprite3d does not flatten `undefined` to false", (ctx) => {
			requireWebGL(ctx, renderer);
			// its settings whitelist used to coerce with `=== true`, which
			// would opt every sprite out of an application-wide default while
			// a Mesh-only suite stayed green — the same bug class as #1515's
			// original dropped setting
			const sprite = new Sprite3d(0, 0, {
				image: Renderer.getWhitePixel(),
				width: 40,
				height: 60,
			});
			expect(sprite.castGroundShadow).toBeUndefined();
			withAppSetting(true, () => {
				expect(drawsShadow(sprite)).toBe(true);
			});
			sprite.destroy();
		});
	});

	// ── lifetime and the deferred queue ─────────────────────────────────

	describe("the deferred queue and what owns it", () => {
		it("a reset DISCARDS pending shadows rather than replaying them", (ctx) => {
			requireWebGL(ctx, renderer);
			// `reset()` re-inits every batcher and then switches batcher, and a
			// batcher switch is itself a drain point. Replaying entries from
			// the frame being abandoned would paint them after `clear()` — and
			// on the context-lost branch would draw geometry belonging to the
			// dead context.
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.preDraw(renderer);
			mesh.draw(renderer, camera);
			mesh.postDraw(renderer);
			expect(renderer._shadowCount).toBeGreaterThan(0);

			const spy = vi.spyOn(renderer.gl, "drawElements");
			renderer.reset();
			expect(renderer._shadowCount).toBe(0);
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
			mesh.destroy();
		});

		it("does NOT drain on a batcher switch, so later meshes cannot overpaint", (ctx) => {
			requireWebGL(ctx, renderer);
			// This used to drain here, on the assumption that leaving mesh mode
			// meant the mesh pass was over. It does not: anything non-mesh that
			// sorts into the MIDDLE of a scene — a particle emitter, a sprite —
			// raises the same transition, and every mesh still to come then
			// paints straight over the blobs just put down. A scene with a
			// particle trail lost its ground shadows to exactly this.
			//
			// The queue now survives to a site that really is the end of the
			// world draw: `Container.draw` before a floating child, and
			// `Camera2d.draw` once the whole container is down.
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.preDraw(renderer);
			mesh.draw(renderer, camera);
			mesh.postDraw(renderer);
			const queued = renderer._shadowCount;
			expect(queued).toBeGreaterThan(0);

			renderer.setBatcher("quad");
			expect(renderer._shadowCount).toBe(queued);

			renderer.flushGroundShadows();
			expect(renderer._shadowCount).toBe(0);
			mesh.destroy();
		});

		it("refuses to drain while a screen projection is installed", (ctx) => {
			requireWebGL(ctx, renderer);
			// A queued blob is WORLD-space geometry. `Container.draw` installs
			// the camera's screen projection around a `floating` child, and a
			// drain raised in that window replays every blob with screen-space
			// clip coordinates — off-screen, gone. One HUD anywhere in a scene
			// silently deleted every ground shadow in it.
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.preDraw(renderer);
			mesh.draw(renderer, camera);
			mesh.postDraw(renderer);
			const queued = renderer._shadowCount;
			expect(queued).toBeGreaterThan(0);

			renderer.beginScreenSpace();
			try {
				renderer.flushGroundShadows();
				// held, not lost
				expect(renderer._shadowCount).toBe(queued);
			} finally {
				renderer.endScreenSpace();
			}
			// and released the moment the window closes
			renderer.flushGroundShadows();
			expect(renderer._shadowCount).toBe(0);
			mesh.destroy();
		});

		it("balances nested screen-space brackets", (ctx) => {
			requireWebGL(ctx, renderer);
			renderer.beginScreenSpace();
			renderer.beginScreenSpace();
			renderer.endScreenSpace();
			expect(renderer._screenSpaceDepth).toBe(1);
			renderer.endScreenSpace();
			expect(renderer._screenSpaceDepth).toBe(0);
			// never goes negative, so an unbalanced end cannot wedge the queue
			renderer.endScreenSpace();
			expect(renderer._screenSpaceDepth).toBe(0);
		});

		it("switching WITHIN mesh mode does not drain early", (ctx) => {
			requireWebGL(ctx, renderer);
			// lit <-> unlit is still inside the pass: the meshes yet to come are
			// exactly what the shadows have to be drawn on top of
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.preDraw(renderer);
			mesh.draw(renderer, camera);
			mesh.postDraw(renderer);
			const queued = renderer._shadowCount;
			expect(queued).toBeGreaterThan(0);

			renderer.setBatcher("litMesh");
			expect(renderer._shadowCount).toBe(queued);
			renderer.setBatcher("quad");
			mesh.destroy();
		});

		it("REGRESSION: a mask being stencilled in does NOT drain the queue", (ctx) => {
			requireWebGL(ctx, renderer);
			// `setMask` fills its shape through the primitive batcher with
			// colour writes OFF and `stencilOp(…, INCR)` armed. That is a
			// batcher transition, so an unguarded drain fires there — which
			// both discards every blob (nothing is written) and stamps their
			// footprints into the mask being built, so the masked renderable
			// then draws outside its own mask.
			const mesh = makeMesh({ castGroundShadow: true });
			mesh.preDraw(renderer);
			mesh.draw(renderer, camera);
			mesh.postDraw(renderer);
			const queued = renderer._shadowCount;
			expect(queued).toBeGreaterThan(0);

			renderer.setMask(new Rect(0, 0, 32, 32));
			expect(renderer._shadowCount).toBe(queued);
			renderer.clearMask();

			// and once the mask is done, the queue is still there to be drawn
			renderer.flushGroundShadows();
			expect(renderer._shadowCount).toBe(0);
			mesh.destroy();
		});

		it("each queued entry keeps its OWN matrix and tint", (ctx) => {
			requireWebGL(ctx, renderer);
			// one quad serves every caster, so `quad._modelMatrix` is rewritten
			// by the next one before the queue is drained — holding a reference
			// instead of a copy collapses every blob onto the last caster
			const a = makeMesh({ castGroundShadow: true, shadowOpacity: 0.2 });
			const b = makeMesh({ castGroundShadow: true, shadowOpacity: 0.8 });
			a.pos.set(-40, 0, 100);
			b.pos.set(40, 0, 100);
			for (const m of [a, b]) {
				m.preDraw(renderer);
				m.draw(renderer, camera);
				m.postDraw(renderer);
			}
			expect(renderer._shadowCount).toBe(2);
			const [first, second] = renderer._shadowPool;
			expect(first.matrix).not.toBe(second.matrix);
			expect(first.matrix.val[12]).not.toBe(second.matrix.val[12]);
			// alpha rides the packed ARGB tint, per entry
			expect(first.tint >>> 24).not.toBe(second.tint >>> 24);
			renderer.flushGroundShadows();
			a.destroy();
			b.destroy();
		});
	});

	describe("resource lifetime", () => {
		it("releaseShadowQuads drops the quads and their retained geometry", (ctx) => {
			requireWebGL(ctx, renderer);
			// The quads hang off the renderer and hold retained GPU geometry.
			// `releaseShadowQuads` existed but NOTHING called it, so every
			// renderer teardown leaked both quads and their buffers; it is now
			// wired into `destroy()` on both GPU backends.
			//
			// Driven through a bare bag rather than the shared test renderer:
			// `getShadowQuad` only uses it to cache on, and destroying the
			// shared renderer would take every later test with it.
			const bag = {};
			const lit = getShadowQuad(bag, true, Mesh);
			const unlit = getShadowQuad(bag, false, Mesh);
			expect(bag._shadowQuads).toBeDefined();
			expect(lit).not.toBe(unlit);
			const destroyed = [];
			for (const quad of [lit, unlit]) {
				const original = quad.destroy.bind(quad);
				quad.destroy = () => {
					destroyed.push(quad);
					original();
				};
			}

			releaseShadowQuads(bag);
			// both tiers destroyed, and the slot cleared so a later frame
			// rebuilds rather than handing out a destroyed mesh
			expect(destroyed).toHaveLength(2);
			expect(bag._shadowQuads).toBeUndefined();
			// idempotent: teardown paths run twice more often than you think
			expect(() => {
				releaseShadowQuads(bag);
			}).not.toThrow();
		});

		it("both GPU backends release them on teardown", (ctx) => {
			requireWebGL(ctx, renderer);
			// the call sites themselves — a leak returns the moment either
			// `destroy()` stops calling it
			for (const proto of [WebGLRenderer, WebGPURenderer]) {
				expect(String(proto.prototype.destroy)).toContain("releaseShadowQuads");
			}
		});
	});

	// ── the pixels (Layer 2) ────────────────────────────────────────────
	//
	// Every assertion above is about draw calls and GL state, and ALL of them
	// passed while the feature rendered nothing at all: the shadow was issued
	// correctly and then painted over by the ground, which sorts after the
	// props standing on it and is opaque. Only reading the framebuffer catches
	// that, so this block does.

	describe("pixels", () => {
		const FLOOR_Y = 60;
		const FLOOR_RGB = 200;

		// ortho over world x/z in [-100, 100], then a quarter turn about X so
		// the XZ ground plane faces the camera instead of sitting edge-on.
		// NEGATIVE quarter turn: the engine treats a greater projected z as
		// nearer, and render space is Y-DOWN, so "up" — toward a camera above
		// the floor — has to map to a greater z.
		const setupGroundView = () => {
			const projection = new Matrix3d();
			projection.ortho(-100, 100, 100, -100, -1000, 1000);
			projection.rotate(-Math.PI / 2, new Vector3d(1, 0, 0));
			renderer.setProjection(projection);
		};

		const readAt = (x, y) => {
			const gl = renderer.gl;
			const pixel = new Uint8Array(4);
			gl.finish();
			gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
			return pixel;
		};

		const makeFloor = () => {
			const F = 90;
			const floor = new Mesh(0, FLOOR_Y, {
				vertices: new Float32Array([-F, 0, -F, F, 0, -F, F, 0, F, -F, 0, F]),
				uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
				indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
				normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]),
				scale: 1,
				width: 1,
				normalize: false,
				cullBackFaces: false,
				lit: false,
			});
			floor.tint.setColor(FLOOR_RGB, FLOOR_RGB, FLOOR_RGB);
			return floor;
		};

		// what Mesh.onActivateEvent does under a Camera3d. Without it preDraw
		// leaves the anchor offset in `currentTransform` — which IS the mesh
		// view matrix — and shifts the whole scene by half the mesh width.
		const activate = (mesh) => {
			mesh._useWorldSpace = true;
			return mesh;
		};

		/**
		 * Draw a floor and one prop, in the order that broke this feature: the
		 * prop (and so its shadow) FIRST, the opaque ground plane after.
		 * @returns {Function} sampler for the resulting framebuffer
		 */
		const renderScene = (prop) => {
			// `clear()`, not just `clearColor()`: the mesh pass's one-shot depth
			// clear is armed by RENDER_TARGET_CHANGED, which only the frame-start
			// clear emits. Without it this scene renders against depth values
			// left behind by the tests above and nothing survives the depth test.
			renderer.clear();
			renderer.clearColor("#ffffff");
			setupGroundView();
			const floor = activate(makeFloor());
			// the caster first, the ground after — a large ground plane's single
			// sort key says nothing about where it sits relative to what stands
			// on it, so this order is ordinary, not contrived
			for (const mesh of [prop, floor]) {
				renderer.currentTint.copy(mesh.tint);
				mesh.preDraw(renderer);
				mesh.draw(renderer, camera);
				mesh.postDraw(renderer);
			}
			renderer.flushGroundShadows();
			renderer.flush();
			renderer.currentTint.setColor(255, 255, 255);
			floor.destroy();
			return readAt;
		};

		const makeCaster = (settings) => {
			return activate(makeMesh({ width: 40, ...settings }));
		};

		it("darkens the ground beneath the caster, even though the ground draws AFTER it", (ctx) => {
			requireWebGL(ctx, renderer);

			const plain = makeCaster({ lit: false });
			const before = renderScene(plain)(64, 64);
			plain.destroy();

			const caster = makeCaster({
				lit: false,
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			const after = renderScene(caster)(64, 64);
			caster.destroy();

			expect(before[0]).toBe(FLOOR_RGB);
			// this is the whole bug: it read exactly FLOOR_RGB — no shadow at
			// all — while every draw-call and GL-state assertion above passed
			expect(after[0]).toBeLessThan(FLOOR_RGB - 20);
		});

		it("is soft-edged, not a hard disc — intermediate alpha at the rim", (ctx) => {
			requireWebGL(ctx, renderer);
			const caster = makeCaster({
				lit: false,
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			const at = renderScene(caster);
			// sampled along the MAJOR axis (screen x here): the caster is an
			// upright quad with no depth, so its blob is a correctly elongated
			// ellipse and the minor axis is only a few pixels across
			const centre = at(64, 64)[0];
			const rim = at(69, 64)[0];
			const outside = at(100, 64)[0];
			caster.destroy();

			// a falloff that failed to reach the shader renders the quad flat,
			// which is a hard-edged SQUARE — the rim would then read either
			// fully shaded or not shaded at all, never between
			expect(centre).toBeLessThan(rim);
			expect(rim).toBeLessThan(outside);
			expect(outside).toBe(FLOOR_RGB);
		});

		it("a LIT caster's shadow lands too (it rides the lit batcher)", (ctx) => {
			requireWebGL(ctx, renderer);
			const caster = makeCaster({
				lit: true,
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			const after = renderScene(caster)(64, 64);
			caster.destroy();
			expect(after[0]).toBeLessThan(FLOOR_RGB - 20);
		});

		it("is an ellipse along the caster's footprint, not a disc", (ctx) => {
			requireWebGL(ctx, renderer);
			// the GEOMETRY quad is upright in XY — it has real width and no
			// depth at all, so a disc would read as perpendicular to it
			const caster = makeCaster({
				lit: false,
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			drawOnce(caster);
			const axes = shadowAxes();
			expect(axes.x).toBeGreaterThan(axes.z * 1.5);
			caster.destroy();
		});

		it("REGRESSION: a right-handed caster's ellipse is not MIRRORED", (ctx) => {
			requireWebGL(ctx, renderer);
			// `_composeModelMatrix` applies the axis bridge as a ROW scale, so
			// the world Z component of BOTH basis columns carries the sign.
			// Folding it into one column instead mirrors the ellipse about
			// world X, and a glTF prop rotated by θ gets a blob at −θ. A 90°
			// test cannot see this — mirrored and correct coincide there — so
			// this one turns 30°, and compares the two handednesses directly.
			const angle = Math.PI / 6;
			const axisOf = (rightHanded) => {
				const mesh = makeCaster({
					lit: false,
					rightHanded,
					castGroundShadow: true,
					shadowGroundY: FLOOR_Y,
				});
				mesh.rotate(angle, new Vector3d(0, 1, 0));
				drawOnce(mesh);
				const m = renderer._shadowQuads.unlit._modelMatrix.val;
				mesh.destroy();
				return { x: m[0], z: m[2] };
			};
			const left = axisOf(false);
			const right = axisOf(true);
			// the bridge negates Z, so the major axis's Z component must flip
			// sign between the two — mirroring makes them agree instead
			expect(Math.sign(right.z)).toBe(-Math.sign(left.z));
			expect(Math.abs(right.z)).toBeCloseTo(Math.abs(left.z), 4);
			expect(Math.sign(right.x)).toBe(Math.sign(left.x));
		});

		it("the ellipse turns with the caster", (ctx) => {
			requireWebGL(ctx, renderer);
			const caster = makeCaster({
				lit: false,
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			drawOnce(caster);
			const before = renderer._shadowQuads.unlit._modelMatrix.val.slice();
			// a quarter turn about the vertical axis has to swing the blob's
			// long axis with it — a disc would be indistinguishable here
			caster.rotate(Math.PI / 2, new Vector3d(0, 1, 0));
			drawOnce(caster);
			const after = renderer._shadowQuads.unlit._modelMatrix.val;
			// the major axis started along world X and must not still be there
			expect(Math.abs(after[0])).toBeLessThan(Math.abs(before[0]) * 0.5);
			expect(Math.abs(after[2])).toBeGreaterThan(Math.abs(before[2]) + 1);
			caster.destroy();
		});

		it("the INSTANCED tier lands on the ground too", (ctx) => {
			requireWebGL(ctx, renderer);
			// the instanced blobs ride a standalone shader over the mesh's own
			// instance buffer, so nothing above proves they reach the screen —
			// and a shader-location clash there is a pipeline error on WebGPU
			// that draw-count assertions cannot see
			const scatter = new InstancedMesh(0, 0, {
				...GEOMETRY,
				width: 40,
				normalize: false,
				instanceCount: 3,
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			const placement = new Matrix3d();
			for (let i = 0; i < 3; i++) {
				placement.identity().translate((i - 1) * 30, 0, 0);
				scatter.setInstance(i, placement);
			}
			activate(scatter);

			const after = renderScene(scatter)(64, 64);
			scatter.destroy();
			expect(after[0]).toBeLessThan(FLOOR_RGB - 10);
		});

		it("a Sprite3d billboard's shadow lands on the ground", (ctx) => {
			requireWebGL(ctx, renderer);
			// the tier the feature exists for, and the one no draw-count or
			// matrix assertion can vouch for: a billboard builds its model
			// matrix from a camera-facing basis, which is a different code path
			// from every Mesh above
			const sprite = new Sprite3d(0, 0, {
				image: Renderer.getWhitePixel(),
				width: 40,
				height: 60,
				billboard: "cylindrical",
				anchorPoint: "bottom",
				castGroundShadow: true,
				shadowGroundY: FLOOR_Y,
			});
			activate(sprite);
			const after = renderScene(sprite)(64, 64);
			sprite.destroy();
			expect(after[0]).toBeLessThan(FLOOR_RGB - 10);
		});

		it("no opt-in leaves the ground untouched", (ctx) => {
			requireWebGL(ctx, renderer);
			const caster = makeCaster({ lit: false });
			const after = renderScene(caster)(64, 64);
			caster.destroy();
			expect(after[0]).toBe(FLOOR_RGB);
		});
	});
});
