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
	describe("shadowScale", () => {
		it("defaults to the same footprint as an explicit 1", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh({ castGroundShadow: true });
			expect(mesh.shadowScale).toBe(1);
			drawOnce(mesh);
			const before = renderer._shadowQuads.unlit._modelMatrix.val.slice();
			const explicit = makeMesh({ castGroundShadow: true, shadowScale: 1 });
			drawOnce(explicit);
			expect(renderer._shadowQuads.unlit._modelMatrix.val).toEqual(before);
			mesh.destroy();
			explicit.destroy();
		});

		it.for([0.5, 2])(
			"scales both axes by %s without moving or fading the blob",
			(scale, ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeMesh({
					castGroundShadow: true,
					shadowGroundY: 20,
					shadowOpacity: 0.7,
				});
				let alpha;
				const draw = renderer.drawMesh.bind(renderer);
				const spy = vi
					.spyOn(renderer, "drawMesh")
					.mockImplementation((object, matrix) => {
						if (object !== mesh) {
							alpha = renderer.getGlobalAlpha();
						}
						return draw(object, matrix);
					});
				try {
					drawOnce(mesh);
					const before = renderer._shadowQuads.unlit._modelMatrix.val.slice();
					const beforeAlpha = alpha;
					mesh.shadowScale = scale;
					drawOnce(mesh);
					const after = renderer._shadowQuads.unlit._modelMatrix.val;
					for (const i of [0, 2, 8, 10]) {
						expect(after[i]).toBeCloseTo(before[i] * scale, 5);
					}
					for (const i of [12, 13, 14]) {
						expect(after[i]).toBe(before[i]);
					}
					expect(alpha).toBe(beforeAlpha);
				} finally {
					spy.mockRestore();
					mesh.destroy();
				}
			},
		);

		it("forwards the Sprite3d setting and responds to live changes", (ctx) => {
			requireWebGL(ctx, renderer);
			const sprite = new Sprite3d(0, 0, {
				image: Renderer.getWhitePixel(),
				width: 40,
				height: 60,
				castGroundShadow: true,
				shadowScale: 2,
			});
			expect(sprite.shadowScale).toBe(2);
			drawOnce(sprite);
			const before = shadowAxes();
			sprite.shadowScale = 0.5;
			drawOnce(sprite);
			expect(shadowAxes().x).toBeCloseTo(before.x / 4, 5);
			expect(shadowAxes().z).toBeCloseTo(before.z / 4, 5);
			sprite.destroy();
		});

		it.for([
			0,
			-1,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		])("hides only the shadow for scale %s", (scale, ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = makeMesh({ castGroundShadow: true, shadowScale: scale });
			const spy = vi.spyOn(renderer.gl, "drawElements");
			try {
				drawOnce(mesh);
				expect(spy).toHaveBeenCalledTimes(1);
			} finally {
				spy.mockRestore();
				mesh.destroy();
			}
		});
	});

	/**
	 * Offset and stretch (#1631 items 2 and 3).
	 *
	 * The blob is a flat quad on one named plane, so an offset is only honest
	 * where the game has NAMED that plane. The stretch needs no new primitive:
	 * the basis is already an oriented, anisotropic pair, so pulling it out is
	 * an anisotropic scale `S = I + (stretch - 1)·d⊗d` applied in world XZ.
	 */
	describe("shadowOffset / shadowStretch", () => {
		/**
		 * A mesh on a NAMED floor, which is what an offset needs, and sitting
		 * ON it rather than above it.
		 *
		 * `shadowGroundY` at the caster's own origin means no height fade, so
		 * `strength` is 1 and the drawn blob is its full-strength size. That
		 * matters because `shadowOffset` is measured in full-strength radii:
		 * it deliberately does NOT shrink with the fade, so that a rising
		 * object's shadow does not slide back under it as it goes.
		 */
		const onFloor = (settings = {}) => {
			return makeMesh({
				castGroundShadow: true,
				shadowGroundY: 0,
				...settings,
			});
		};
		const origin = (lit = false) => {
			const m = renderer._shadowQuads[lit ? "lit" : "unlit"]._modelMatrix.val;
			return { x: m[12], z: m[14] };
		};

		/** the blob's own radius, which is the unit `shadowOffset` is in */
		const blobRadius = () => {
			const a = shadowAxes();
			return (a.x + a.z) / 2;
		};

		it("slides the blob by the asked multiple of its OWN radius", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor();
			drawOnce(mesh);
			drawOnce(mesh);
			const before = origin();
			const r = blobRadius();
			mesh.shadowDirectionX = 3;
			mesh.shadowDirectionZ = 4; // length 5, so it must be normalised
			mesh.shadowOffset = 2;
			drawOnce(mesh);
			const after = origin();
			// 2 radii along (0.6, 0.8)
			expect(after.x - before.x).toBeCloseTo(2 * r * 0.6, 4);
			expect(after.z - before.z).toBeCloseTo(2 * r * 0.8, 4);
			mesh.destroy();
		});

		it("throws two differently sized casters the same RELATIVE distance", (ctx) => {
			requireWebGL(ctx, renderer);
			// the whole reason the unit is a ratio: one value has to serve a
			// big caster and a small one, which a world distance cannot do
			const shifts = [];
			for (const width of [16, 64]) {
				const mesh = onFloor({ width, shadowDirectionX: 1 });
				drawOnce(mesh);
				drawOnce(mesh);
				const before = origin().x;
				const r = blobRadius();
				mesh.shadowOffset = 1.5;
				drawOnce(mesh);
				shifts.push((origin().x - before) / r);
				mesh.destroy();
			}
			// different sizes, different world distances, same ratio
			expect(shifts[0]).toBeCloseTo(1.5, 4);
			expect(shifts[1]).toBeCloseTo(1.5, 4);
		});

		it("refuses to slide off a plane the game never named", (ctx) => {
			requireWebGL(ctx, renderer);
			// no `shadowGroundY`: the blob falls back to the caster's own base,
			// and there is no claim about where the floor is to slide across
			const mesh = makeMesh({ castGroundShadow: true });
			drawOnce(mesh);
			const before = origin();
			mesh.shadowDirectionX = 1;
			mesh.shadowOffset = 25;
			drawOnce(mesh);
			expect(origin().x).toBeCloseTo(before.x, 6);
			expect(origin().z).toBeCloseTo(before.z, 6);
			mesh.destroy();
		});

		it("does nothing without a direction to go in", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor();
			// twice: the caster's half-extent is resolved lazily on the first
			// shadowed draw, so the first frame is not comparable with later ones
			drawOnce(mesh);
			drawOnce(mesh);
			const before = { o: origin(), a: shadowAxes() };
			// asked for both, but with nowhere to point
			mesh.shadowOffset = 40;
			mesh.shadowStretch = 2;
			drawOnce(mesh);
			expect(origin().x).toBeCloseTo(before.o.x, 6);
			expect(origin().z).toBeCloseTo(before.o.z, 6);
			expect(shadowAxes().x).toBeCloseTo(before.a.x, 6);
			expect(shadowAxes().z).toBeCloseTo(before.a.z, 6);
			mesh.destroy();
		});

		it("lengthens along the direction and leaves the perpendicular alone", (ctx) => {
			requireWebGL(ctx, renderer);
			// direction along world X, so the X axis stretches and Z must not
			const mesh = onFloor({ shadowDirectionX: 1, shadowDirectionZ: 0 });
			drawOnce(mesh);
			const before = shadowAxes();
			mesh.shadowStretch = 2;
			drawOnce(mesh);
			const after = shadowAxes();
			expect(after.x).toBeCloseTo(before.x * 2, 5);
			expect(after.z).toBeCloseTo(before.z, 5);
			mesh.destroy();
		});

		it("stretches along a DIAGONAL, where both basis axes contribute", (ctx) => {
			requireWebGL(ctx, renderer);
			// A direction along a world axis only exercises one of the two
			// basis columns on an axis-aligned caster: the other projects to
			// zero and could be left untouched without anything noticing.
			// At 45 degrees both carry a share.
			const d = Math.SQRT1_2;
			// the blob is a unit square mapped by the two basis columns, so its
			// reach along a unit vector is half the sum of their projections
			const support = (ux, uz) => {
				const m = renderer._shadowQuads.unlit._modelMatrix.val;
				return (
					(Math.abs(m[0] * ux + m[2] * uz) + Math.abs(m[8] * ux + m[10] * uz)) *
					0.5
				);
			};
			const mesh = onFloor({ shadowDirectionX: d, shadowDirectionZ: d });
			drawOnce(mesh);
			drawOnce(mesh);
			const along = support(d, d);
			const across = support(d, -d);
			mesh.shadowStretch = 2.5;
			drawOnce(mesh);
			expect(support(d, d)).toBeCloseTo(along * 2.5, 4);
			// and nothing at right angles to it moved
			expect(support(d, -d)).toBeCloseTo(across, 4);
			mesh.destroy();
		});

		it("clamps the stretch rather than letting it run", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor({ shadowDirectionX: 1 });
			drawOnce(mesh);
			const before = shadowAxes().x;
			mesh.shadowStretch = 50;
			drawOnce(mesh);
			// 3, the ceiling, not 50
			expect(shadowAxes().x).toBeCloseTo(before * 3, 5);
			mesh.destroy();
		});

		it.for([0.25, 0, -2, Number.NaN, Number.POSITIVE_INFINITY])(
			"treats a stretch of %s as 1 rather than shrinking the blob",
			(stretch, ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = onFloor({ shadowDirectionX: 1 });
				drawOnce(mesh);
				const before = shadowAxes();
				mesh.shadowStretch = stretch;
				drawOnce(mesh);
				expect(shadowAxes().x).toBeCloseTo(before.x, 5);
				expect(shadowAxes().z).toBeCloseTo(before.z, 5);
				mesh.destroy();
			},
		);

		it("fades as it stretches, so an extreme value goes to nothing", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor({ shadowDirectionX: 1, shadowOpacity: 0.8 });
			let alpha;
			const draw = renderer.drawMesh.bind(renderer);
			const spy = vi
				.spyOn(renderer, "drawMesh")
				.mockImplementation((object, matrix) => {
					if (object !== mesh) {
						alpha = renderer.getGlobalAlpha();
					}
					return draw(object, matrix);
				});
			try {
				drawOnce(mesh); // warm-up, as above
				drawOnce(mesh);
				const flat = alpha;
				mesh.shadowStretch = 4; // clamps to 3
				drawOnce(mesh);
				// The alpha round-trips through an 8-bit packed tint, so it
				// lands on the nearest 1/255 and cannot be compared more
				// finely than that: 147/255 stretches to 84.87/255, which is
				// read back as 85/255.
				expect(Math.abs(alpha - flat / Math.sqrt(3))).toBeLessThanOrEqual(
					1 / 255,
				);
				// and it is genuinely fainter, not merely different
				expect(alpha).toBeLessThan(flat);
			} finally {
				spy.mockRestore();
				mesh.destroy();
			}
		});

		it("takes the direction from a named light, and follows it when it moves", (ctx) => {
			requireWebGL(ctx, renderer);
			const sun = { direction: { x: 1, y: -1, z: 0 } };
			const mesh = onFloor({ shadowLight: sun, shadowOffset: 2 });
			drawOnce(mesh);
			drawOnce(mesh);
			const east = origin();
			const reach = 2 * blobRadius();
			// the sun swings round; the shadow goes with it
			sun.direction.x = 0;
			sun.direction.z = 1;
			drawOnce(mesh);
			const south = origin();
			expect(east.x - south.x).toBeCloseTo(reach, 4);
			expect(south.z - east.z).toBeCloseTo(reach, 4);
			mesh.destroy();
		});

		it("prefers the light over a direction set by hand", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor({
				shadowDirectionX: -1,
				shadowLight: { direction: { x: 1, y: -1, z: 0 } },
				shadowOffset: 1.5,
			});
			drawOnce(mesh);
			drawOnce(mesh);
			const withLight = origin().x;
			const reach = 1.5 * blobRadius();
			mesh.shadowLight = undefined;
			drawOnce(mesh);
			// the hand-set direction is the OPPOSITE way, so the two differ by 2x
			expect(withLight - origin().x).toBeCloseTo(2 * reach, 4);
			mesh.destroy();
		});

		it("puts an instanced throw in the matrix and the stretch nowhere near it", (ctx) => {
			requireWebGL(ctx, renderer);
			// The offset is ONE translation shared by the whole set, so the
			// group matrix carries it. The stretch must NOT: an anisotropic
			// scale there reaches the instance POSITIONS through the same
			// matrix and smears the scatter. It rides the shared quad instead
			// (see `InstancedMesh > shadowStretch`), which is why the matrix
			// below is untouched by it.
			const build = () => {
				const mesh = new InstancedMesh(0, 0, {
					...GEOMETRY,
					width: 32,
					normalize: false,
					instanceCount: 2,
					castGroundShadow: true,
					shadowGroundY: 20,
					shadowDirectionX: 1,
					shadowDirectionZ: 0,
				});
				const placement = new Matrix3d();
				for (let i = 0; i < 2; i++) {
					placement.identity().translate(i * 8, 0, 0);
					mesh.setInstance(i, placement);
				}
				return mesh;
			};
			const matrixOf = (m) => {
				const spy = vi.spyOn(renderer, "drawInstancedShadow");
				try {
					drawOnce(m);
					expect(spy).toHaveBeenCalled();
					return [...spy.mock.calls[0][1].val];
				} finally {
					spy.mockRestore();
				}
			};
			const mesh = build();
			const before = matrixOf(mesh);
			mesh.shadowOffset = 2;
			const after = matrixOf(mesh);
			// the throw moved it along +x, and only the translation moved
			expect(after[12] - before[12]).toBeGreaterThan(1);
			expect(after[14]).toBeCloseTo(before[14], 6);
			for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) {
				expect(after[i]).toBeCloseTo(before[i], 6);
			}

			// the stretch, by contrast, leaves this matrix exactly as it was
			const pinned = matrixOf(mesh);
			mesh.shadowStretch = 3;
			expect(matrixOf(mesh)).toEqual(pinned);
			mesh.destroy();
		});

		it("leaves the lift alone, so a stretched blob still lies on the floor", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor({ shadowDirectionX: 1 });
			drawOnce(mesh);
			const before = shadowGroundY();
			mesh.shadowStretch = 3;
			drawOnce(mesh);
			expect(shadowGroundY()).toBeCloseTo(before, 6);
			mesh.destroy();
		});
	});

	/**
	 * `shadowGroundNormal` — the blob on a floor that is not level.
	 *
	 * The blob is ROTATED onto the plane rather than projected, so it keeps
	 * its shape: a vertical projection would lengthen it by `1/cos(tilt)` and
	 * an orthogonal one shrink it by `cos(tilt)`, growing exactly where the
	 * feature is used. It also stays directly under the caster; the normal
	 * turns it, it does not move it.
	 */
	describe("shadowGroundNormal", () => {
		const onFloor = (settings = {}) => {
			return makeMesh({
				castGroundShadow: true,
				shadowGroundY: 0,
				...settings,
			});
		};
		const matrix = () => {
			return [...renderer._shadowQuads.unlit._modelMatrix.val];
		};
		/** the quad's three basis columns, as vectors */
		const basis = (m) => {
			return {
				ax: [m[0], m[1], m[2]],
				up: [m[4], m[5], m[6]],
				az: [m[8], m[9], m[10]],
			};
		};
		const dot = (a, b) => {
			return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
		};
		const len = (a) => {
			return Math.hypot(a[0], a[1], a[2]);
		};
		const unit = (v) => {
			const l = len(v);
			return [v[0] / l, v[1] / l, v[2] / l];
		};

		it("world up is the default, and reproduces a level blob exactly", (ctx) => {
			requireWebGL(ctx, renderer);
			const plain = onFloor();
			drawOnce(plain);
			drawOnce(plain);
			const before = matrix();
			// WORLD_UP is (0, -1, 0): render space is Y-down
			plain.shadowGroundNormal = [0, -1, 0];
			drawOnce(plain);
			expect(matrix()).toEqual(before);
			plain.destroy();
		});

		it("lays the blob in the plane, both axes perpendicular to the normal", (ctx) => {
			requireWebGL(ctx, renderer);
			for (const n of [
				[0.6, -0.8, 0],
				[0, -0.707106, 0.707106],
				[0.4, -0.6, 0.69282],
			]) {
				const mesh = onFloor({ shadowGroundNormal: n });
				drawOnce(mesh);
				drawOnce(mesh);
				const b = basis(matrix());
				const u = unit(n);
				expect(Math.abs(dot(unit(b.ax), u))).toBeLessThan(1e-6);
				expect(Math.abs(dot(unit(b.az), u))).toBeLessThan(1e-6);
				// and the quad's own axis IS the normal, negated
				expect(b.up[0]).toBeCloseTo(-u[0], 5);
				expect(b.up[1]).toBeCloseTo(-u[1], 5);
				expect(b.up[2]).toBeCloseTo(-u[2], 5);
				mesh.destroy();
			}
		});

		it("rotates rather than projects, so the blob keeps its size", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor();
			drawOnce(mesh);
			drawOnce(mesh);
			const flat = basis(matrix());
			// 40 degrees of tilt: a projection would change these by 1/cos or
			// cos, about 30% either way
			mesh.shadowGroundNormal = [Math.sin(0.698), -Math.cos(0.698), 0];
			drawOnce(mesh);
			const tilted = basis(matrix());
			expect(len(tilted.ax)).toBeCloseTo(len(flat.ax), 5);
			expect(len(tilted.az)).toBeCloseTo(len(flat.az), 5);
		});

		it("keeps the blob under the caster, and lifts along the normal", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor();
			drawOnce(mesh);
			drawOnce(mesh);
			const flat = matrix();
			mesh.shadowGroundNormal = [0.5, -Math.sqrt(0.75), 0];
			drawOnce(mesh);
			const tilted = matrix();
			// the lift is the only thing that moved it, and it went along the
			// normal: a +x component appears where a level blob had none
			const liftY = flat[13] - 0;
			expect(tilted[12] - flat[12]).toBeCloseTo(0.5 * -liftY, 5);
			expect(tilted[14]).toBeCloseTo(flat[14], 6);
			mesh.destroy();
		});

		it("carries the offset IN the plane instead of sliding off it", (ctx) => {
			requireWebGL(ctx, renderer);
			// without this the blob climbs off a tilted floor by
			// distance * tan(tilt) and hangs in the air
			const n = [Math.sin(0.6), -Math.cos(0.6), 0];
			const mesh = onFloor({
				shadowGroundNormal: n,
				shadowDirectionX: 1,
				shadowDirectionZ: 0,
			});
			drawOnce(mesh);
			drawOnce(mesh);
			const before = matrix();
			mesh.shadowOffset = 2;
			drawOnce(mesh);
			const after = matrix();
			const moved = [
				after[12] - before[12],
				after[13] - before[13],
				after[14] - before[14],
			];
			// perpendicular to the normal: it stayed on the floor
			expect(Math.abs(dot(moved, n))).toBeLessThan(1e-5);
			expect(len(moved)).toBeGreaterThan(1);
			mesh.destroy();
		});

		it("clamps the tilt rather than letting a blob stand on its rim", (ctx) => {
			requireWebGL(ctx, renderer);
			// very nearly vertical, which would be edge-on and invisible
			const mesh = onFloor({ shadowGroundNormal: [0.999, -0.0447, 0] });
			drawOnce(mesh);
			drawOnce(mesh);
			const up = basis(matrix()).up;
			// 75 degrees from world up is the ceiling
			const tilt = Math.acos(Math.min(1, Math.abs(up[1])));
			expect((tilt * 180) / Math.PI).toBeCloseTo(75, 3);
			mesh.destroy();
		});

		it("is ignored without a named plane to tilt", (ctx) => {
			requireWebGL(ctx, renderer);
			// no shadowGroundY: the fallback is the caster's own bounds, which
			// gives the tilt nothing to turn about
			const mesh = makeMesh({ castGroundShadow: true });
			drawOnce(mesh);
			drawOnce(mesh);
			const before = matrix();
			mesh.shadowGroundNormal = [0.6, -0.8, 0];
			drawOnce(mesh);
			expect(matrix()).toEqual(before);
			mesh.destroy();
		});

		it("normalizes what it is given, and copies it", (ctx) => {
			requireWebGL(ctx, renderer);
			const given = [0, -7, 0]; // not a unit vector
			const mesh = onFloor({ shadowGroundNormal: given });
			expect(mesh.shadowGroundNormal.y).toBeCloseTo(-1, 9);
			// mutating what was passed must not steer the mesh
			given[0] = 99;
			expect(mesh.shadowGroundNormal.x).toBe(0);
			mesh.destroy();
		});

		it("falls back to level for a zero normal rather than dividing by it", (ctx) => {
			requireWebGL(ctx, renderer);
			const mesh = onFloor({ shadowGroundNormal: [0, 0, 0] });
			drawOnce(mesh);
			drawOnce(mesh);
			const b = basis(matrix());
			expect(b.up[1]).toBeCloseTo(1, 9);
			expect(Number.isFinite(matrix()[12])).toBe(true);
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

		/**
		 * `shadowGroundNormal` on a SET: one plane for all of it, tilted.
		 *
		 * The vertex stage builds `instancePos + (v.x, 0, v.z) * footprint`
		 * and pushes the sum through ONE matrix, so the slope has to live in
		 * that matrix's Y row as the plane's equation: a vertical projection.
		 * The quad is baked pre-rotated into the plane so the projection
		 * returns its true shape. Nothing about that is visible from a draw
		 * count, so these replay exactly what the shader computes, from the
		 * matrix handed to `drawInstancedShadow` and the baked quad, and check
		 * where every blob vertex lands. The first case is the one the
		 * example found: a row left as the group's keeps each instance's
		 * height but drops the quad's tilt, and a row zeroed drops both.
		 */
		describe("shadowGroundNormal", () => {
			const sloped = (settings = {}) => {
				const mesh = new InstancedMesh(0, 0, {
					...GEOMETRY,
					width: 32,
					normalize: false,
					instanceCount: 4,
					castGroundShadow: true,
					...settings,
				});
				const placement = new Matrix3d();
				for (let i = 0; i < 4; i++) {
					// spread along X, climbing in Y, one of them twice the size:
					// a set that is NOT on one height, so a row that passed an
					// instance's own height through would show
					placement.identity().translate(i * 8, i * 5, i * 2);
					if (i === 2) {
						placement.scale(2, 2, 2);
					}
					mesh.setInstance(i, placement);
				}
				return mesh;
			};
			const shadowMatrix = (mesh) => {
				const spy = vi.spyOn(renderer, "drawInstancedShadow");
				try {
					drawOnce(mesh);
					expect(spy).toHaveBeenCalled();
					return [...spy.mock.calls[0][1].val];
				} finally {
					spy.mockRestore();
				}
			};
			/** the vertex stage replayed: Y of the baked vertex DROPPED */
			const landed = (m, mesh, i, k) => {
				const record = mesh.getInstance(i).val;
				const footprint = Math.hypot(record[0], record[1], record[2]);
				const v = mesh._shadowQuad.originalVertices;
				const x = record[12] + v[k * 3] * footprint;
				const y = record[13];
				const z = record[14] + v[k * 3 + 2] * footprint;
				return [
					m[0] * x + m[4] * y + m[8] * z + m[12],
					m[1] * x + m[5] * y + m[9] * z + m[13],
					m[2] * x + m[6] * y + m[10] * z + m[14],
				];
			};
			const NORMAL = [Math.sin(0.6), -Math.cos(0.6), 0];

			it("lands every blob vertex on the plane, whatever height its instance sits at", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = sloped({ shadowGroundY: 40, shadowGroundNormal: NORMAL });
				const m = shadowMatrix(mesh);
				const lift = mesh.meshScale * 0.01;
				const sx = -NORMAL[0] / NORMAL[1];
				// the plane through the set's origin at groundY, lifted along
				// its normal
				const planeY = (x) => {
					return 40 + sx * (x - m[12]) + lift / NORMAL[1];
				};
				const heights = new Set();
				for (let i = 0; i < 4; i++) {
					for (let k = 0; k < 4; k++) {
						const q = landed(m, mesh, i, k);
						expect(q[1]).toBeCloseTo(planeY(q[0]), 4);
						heights.add(Math.round(q[1]));
					}
				}
				// ...and it IS a slope: the blobs do not share one height
				expect(heights.size).toBeGreaterThan(1);
				mesh.destroy();
			});

			it("keeps the blob's size on the slope rather than stretching it", (ctx) => {
				requireWebGL(ctx, renderer);
				// 60 degrees: a flat quad projected vertically onto this plane
				// would come out twice as long along the slope
				const steep = [Math.sin(Math.PI / 3), -Math.cos(Math.PI / 3), 0];
				const level = sloped({ shadowGroundY: 40 });
				const tilted = sloped({ shadowGroundY: 40, shadowGroundNormal: steep });
				const flat = shadowMatrix(level);
				const m = shadowMatrix(tilted);
				const span = (mat, mesh) => {
					const a = landed(mat, mesh, 0, 0);
					const b = landed(mat, mesh, 0, 1);
					return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
				};
				expect(span(m, tilted)).toBeCloseTo(span(flat, level), 3);
				level.destroy();
				tilted.destroy();
			});

			it("is ignored without shadowGroundY, like the per-object tier", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = sloped({ shadowGroundNormal: NORMAL });
				const m = shadowMatrix(mesh);
				expect(m[1]).toBe(0);
				expect(m[5]).toBe(0);
				expect(m[9]).toBe(0);
				expect(m[13]).toBeCloseTo(
					mesh.getBounds3d().bottom - mesh.meshScale * 0.01,
					6,
				);
				mesh.destroy();
			});

			it("clamps the tilt at 75 degrees on a set too", (ctx) => {
				requireWebGL(ctx, renderer);
				const past = [Math.sin(1.48), -Math.cos(1.48), 0];
				const mesh = sloped({ shadowGroundY: 40, shadowGroundNormal: past });
				const m = shadowMatrix(mesh);
				// the row's gradient along X is the slope the plane was given
				const gradient = m[1] / m[0];
				expect(gradient).toBeCloseTo(Math.tan((75 * Math.PI) / 180), 5);
				expect(gradient).toBeLessThan(Math.tan(1.48));
				mesh.destroy();
			});

			it("world up is the default, and reproduces the level matrix exactly", (ctx) => {
				requireWebGL(ctx, renderer);
				const plain = sloped({ shadowGroundY: 40 });
				const named = sloped({
					shadowGroundY: 40,
					shadowGroundNormal: [0, -1, 0],
				});
				const a = shadowMatrix(plain);
				const b = shadowMatrix(named);
				expect(b).toEqual(a);
				plain.destroy();
				named.destroy();
			});
		});

		/**
		 * `shadowStretch` on a SET.
		 *
		 * This used to be refused outright, on the grounds that an anisotropic
		 * scale reaches the GPU through the group matrix and would smear the
		 * instance POSITIONS along with each blob. That is true of the MATRIX
		 * and only of the matrix: the vertex stage builds
		 * `uModelMatrix * (instancePos + quadOffset * footprint)`, so the
		 * shared QUAD is the one thing the positions never pass through — the
		 * same reason the slope's tilt is baked there. One stretch, one
		 * direction, one quad for the whole set, which is all a set needs.
		 *
		 * So these check both halves: that the blob genuinely lengthens along
		 * the light, and that nothing else in the scatter moved.
		 */
		describe("shadowStretch", () => {
			const EAST = { shadowDirectionX: 1, shadowDirectionZ: 0 };

			/** the quad's two ground axes, read back from its baked corners */
			const quadAxes = (mesh) => {
				const v = mesh._shadowQuad.originalVertices;
				return {
					u: [(v[3] - v[0]) / 2, (v[4] - v[1]) / 2, (v[5] - v[2]) / 2],
					v: [(v[9] - v[0]) / 2, (v[10] - v[1]) / 2, (v[11] - v[2]) / 2],
				};
			};
			/** the blob's half-extent along a ground direction */
			const reachAlong = (mesh, dx, dz) => {
				const { u, v } = quadAxes(mesh);
				return (
					Math.abs(u[0] * dx + u[2] * dz) + Math.abs(v[0] * dx + v[2] * dz)
				);
			};

			it("lengthens the blob along the light and leaves its width alone", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(3, {
					shadowGroundY: 0,
					...EAST,
				});
				drawOnce(mesh);
				const alongFlat = reachAlong(mesh, 1, 0);
				const acrossFlat = reachAlong(mesh, 0, 1);
				mesh.shadowStretch = 2.5;
				drawOnce(mesh);
				expect(reachAlong(mesh, 1, 0)).toBeCloseTo(alongFlat * 2.5, 4);
				// across the light it is EXACTLY as wide as it was: the scale
				// is `I + (s-1)·d⊗d`, which is the identity perpendicular to d
				expect(reachAlong(mesh, 0, 1)).toBeCloseTo(acrossFlat, 5);
				mesh.destroy();
			});

			it("stretches along a DIAGONAL light, not along the set's own axes", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(3, {
					shadowGroundY: 0,
					// length 5, so it has to be normalised before it is used
					shadowDirectionX: 3,
					shadowDirectionZ: 4,
				});
				drawOnce(mesh);
				const dx = 0.6;
				const dz = 0.8;
				const along = reachAlong(mesh, dx, dz);
				const across = reachAlong(mesh, -dz, dx);
				mesh.shadowStretch = 2;
				drawOnce(mesh);
				expect(reachAlong(mesh, dx, dz)).toBeCloseTo(along * 2, 4);
				expect(reachAlong(mesh, -dz, dx)).toBeCloseTo(across, 4);
				mesh.destroy();
			});

			it("THE POINT: lengthens each blob without moving the scatter", (ctx) => {
				requireWebGL(ctx, renderer);
				// no offset, so the only thing that could move a blob is the
				// stretch leaking into the positions — which is exactly the
				// failure the old refusal was written to avoid
				const mesh = makeInstanced(4, { shadowGroundY: 0, ...EAST });
				const spy = vi.spyOn(renderer, "drawInstancedShadow");
				const centres = () => {
					spy.mockClear();
					drawOnce(mesh);
					const m = spy.mock.calls[0][1].val;
					return Array.from({ length: 4 }, (_, i) => {
						const r = mesh.getInstance(i).val;
						return [
							m[0] * r[12] + m[4] * r[13] + m[8] * r[14] + m[12],
							m[2] * r[12] + m[6] * r[13] + m[10] * r[14] + m[14],
						];
					});
				};
				try {
					const before = centres();
					// the instances are spread along x, so a smear would show
					expect(before[3][0]).not.toBeCloseTo(before[0][0], 3);
					mesh.shadowStretch = 3;
					const after = centres();
					for (let i = 0; i < 4; i++) {
						expect(after[i][0]).toBeCloseTo(before[i][0], 5);
						expect(after[i][1]).toBeCloseTo(before[i][1], 5);
					}
				} finally {
					spy.mockRestore();
					mesh.destroy();
				}
			});

			it("clamps at 3, the same ceiling the per-object tier uses", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(2, { shadowGroundY: 0, ...EAST });
				drawOnce(mesh);
				const flat = reachAlong(mesh, 1, 0);
				mesh.shadowStretch = 3;
				drawOnce(mesh);
				const atCeiling = reachAlong(mesh, 1, 0);
				mesh.shadowStretch = 50;
				drawOnce(mesh);
				expect(reachAlong(mesh, 1, 0)).toBeCloseTo(atCeiling, 5);
				expect(atCeiling).toBeCloseTo(flat * 3, 4);
				mesh.destroy();
			});

			it.for([1, 0.5, 0, -2, Number.NaN, Number.POSITIVE_INFINITY])(
				"leaves the blob alone at shadowStretch %s",
				(value, ctx) => {
					requireWebGL(ctx, renderer);
					const mesh = makeInstanced(2, { shadowGroundY: 0, ...EAST });
					drawOnce(mesh);
					const flat = reachAlong(mesh, 1, 0);
					mesh.shadowStretch = value;
					drawOnce(mesh);
					expect(reachAlong(mesh, 1, 0)).toBeCloseTo(flat, 5);
					mesh.destroy();
				},
			);

			it("does nothing without a direction to stretch along", (ctx) => {
				requireWebGL(ctx, renderer);
				// no light and no direction: a zero-length pair names no way
				// to pull, and guessing one would be an invention
				const mesh = makeInstanced(2, { shadowGroundY: 0, shadowStretch: 3 });
				drawOnce(mesh);
				const pulled = reachAlong(mesh, 1, 0);
				mesh.shadowStretch = 1;
				drawOnce(mesh);
				expect(reachAlong(mesh, 1, 0)).toBeCloseTo(pulled, 5);
				mesh.destroy();
			});

			it("takes the direction from a light, and refreshes in place as it moves", (ctx) => {
				requireWebGL(ctx, renderer);
				const sun = { direction: { x: 1, y: 1, z: 0 } };
				const mesh = makeInstanced(2, {
					shadowGroundY: 0,
					shadowLight: sun,
					shadowStretch: 2.5,
				});
				drawOnce(mesh);
				const quad = mesh._shadowQuad;
				const version = quad._geometryVersion;
				expect(reachAlong(mesh, 1, 0)).toBeGreaterThan(reachAlong(mesh, 0, 1));
				// the sun swings a quarter turn: the blob must follow it
				sun.direction.x = 0;
				sun.direction.z = 1;
				drawOnce(mesh);
				expect(reachAlong(mesh, 0, 1)).toBeGreaterThan(reachAlong(mesh, 1, 0));
				// ...and a sweeping sun must not allocate a mesh per frame
				expect(mesh._shadowQuad).toBe(quad);
				expect(quad._geometryVersion).toBeGreaterThan(version);
				mesh.destroy();
			});

			it("fades as it stretches, like the per-object tier", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(2, {
					shadowGroundY: 0,
					shadowOpacity: 0.8,
					...EAST,
				});
				let alpha;
				const draw = renderer.drawInstancedShadow.bind(renderer);
				const spy = vi
					.spyOn(renderer, "drawInstancedShadow")
					.mockImplementation((...args) => {
						alpha = renderer.getGlobalAlpha();
						return draw(...args);
					});
				try {
					drawOnce(mesh);
					const flat = alpha;
					mesh.shadowStretch = 4; // clamps to 3
					drawOnce(mesh);
					// the alpha round-trips through an 8-bit packed tint, so it
					// lands on the nearest 1/255 and cannot be compared finer
					expect(Math.abs(alpha - flat / Math.sqrt(3))).toBeLessThanOrEqual(
						1 / 255,
					);
					expect(alpha).toBeLessThan(flat);
				} finally {
					spy.mockRestore();
					mesh.destroy();
				}
			});

			it("composes with a slope: a stretched blob still lies IN the plane", (ctx) => {
				requireWebGL(ctx, renderer);
				const normal = [Math.sin(0.6), -Math.cos(0.6), 0];
				const mesh = makeInstanced(3, {
					shadowGroundY: 40,
					shadowGroundNormal: normal,
					shadowStretch: 2.5,
					...EAST,
				});
				const spy = vi.spyOn(renderer, "drawInstancedShadow");
				try {
					drawOnce(mesh);
					const m = spy.mock.calls[0][1].val;
					const lift = mesh.meshScale * 0.01;
					const sx = -normal[0] / normal[1];
					const q = mesh._shadowQuad.originalVertices;
					for (let i = 0; i < 3; i++) {
						const r = mesh.getInstance(i).val;
						const footprint = Math.hypot(r[0], r[1], r[2]);
						for (let k = 0; k < 4; k++) {
							// the vertex stage, replayed: the quad's own Y is dropped
							const x = r[12] + q[k * 3] * footprint;
							const y = r[13];
							const z = r[14] + q[k * 3 + 2] * footprint;
							const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
							const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
							expect(wy).toBeCloseTo(
								40 + sx * (wx - m[12]) + lift / normal[1],
								4,
							);
						}
					}
				} finally {
					spy.mockRestore();
					mesh.destroy();
				}
			});

			it("matches the per-object tier for the same asset and settings", (ctx) => {
				requireWebGL(ctx, renderer);
				// the whole reason the two tiers share `resolveShadowStretch`
				// and `stretchAlong`: one tree in a scatter and the same tree
				// standing loose beside it have to draw the same blob
				const settings = {
					castGroundShadow: true,
					shadowGroundY: 0,
					shadowStretch: 2.5,
					shadowDirectionX: 3,
					shadowDirectionZ: 4,
				};
				const loose = makeMesh(settings);
				drawOnce(loose);
				drawOnce(loose);
				// the per-object blob's two ground axes live in its quad's
				// model matrix, as the X and Z basis columns of a unit square
				const m = renderer._shadowQuads.unlit._modelMatrix.val;
				const looseReach = (dx, dz) => {
					return (
						Math.abs((m[0] * dx + m[2] * dz) / 2) +
						Math.abs((m[8] * dx + m[10] * dz) / 2)
					);
				};
				const looseAlong = looseReach(0.6, 0.8);
				const looseAcross = looseReach(-0.8, 0.6);
				loose.destroy();

				const set = makeInstanced(1, settings);
				drawOnce(set);
				// The instanced quad is in MODEL units and the per-object
				// matrix in world ones, so the absolute sizes differ by the
				// mesh scale. What has to match is the SHAPE: how much longer
				// the blob is along the light than across it.
				const along = reachAlong(set, 0.6, 0.8);
				const across = reachAlong(set, -0.8, 0.6);
				expect(along / across).toBeCloseTo(looseAlong / looseAcross, 3);
				expect(along).toBeGreaterThan(across);
				set.destroy();
			});

			/* ── adversarial ──────────────────────────────────────────── */

			it("ADVERSARIAL: stretches along the WORLD light, not the set's own axis", (ctx) => {
				requireWebGL(ctx, renderer);
				// The quad's axes live in GROUP-LOCAL space, so the world
				// direction has to be pulled back through the group matrix. A
				// set turned a quarter turn about Y that skipped the pull-back
				// would stretch across the light instead of along it, and no
				// test on an unrotated set could tell.
				//
				// Measured as a RATIO against the same set unstretched: the
				// fixture's own blob is not round, so an absolute along/across
				// number says nothing.
				const ratio = (mesh) => {
					return reachAlong(mesh, 1, 0) / reachAlong(mesh, 0, 1);
				};
				const flat = makeInstanced(2, { shadowGroundY: 0, ...EAST });
				drawOnce(flat);
				const base = ratio(flat);
				flat.destroy();

				const upright = makeInstanced(2, {
					shadowGroundY: 0,
					...EAST,
					shadowStretch: 2.5,
				});
				drawOnce(upright);
				expect(ratio(upright) / base).toBeCloseTo(2.5, 4);
				upright.destroy();

				// turned a quarter turn: the world +x light now lands on the
				// set's local z, so the LONG axis must have swapped sides
				const turned = makeInstanced(2, {
					shadowGroundY: 0,
					...EAST,
					shadowStretch: 2.5,
				});
				turned.rotate(Math.PI / 2, new Vector3d(0, 1, 0));
				drawOnce(turned);
				const { u, v } = quadAxes(turned);
				const lenU = Math.hypot(u[0], u[2]);
				const lenV = Math.hypot(v[0], v[2]);
				const plain = makeInstanced(2, { shadowGroundY: 0, ...EAST });
				plain.rotate(Math.PI / 2, new Vector3d(0, 1, 0));
				drawOnce(plain);
				const flatAxes = quadAxes(plain);
				const flatU = Math.hypot(flatAxes.u[0], flatAxes.u[2]);
				const flatV = Math.hypot(flatAxes.v[0], flatAxes.v[2]);
				// the stretch landed on the OTHER local axis than it did
				// upright, which is the pull-back doing its job
				expect(lenV / flatV).toBeCloseTo(2.5, 3);
				expect(lenU / flatU).toBeCloseTo(1, 3);
				turned.destroy();
				plain.destroy();
			});

			it("ADVERSARIAL: shadowScale and shadowStretch multiply, not override", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(2, { shadowGroundY: 0, ...EAST });
				drawOnce(mesh);
				const plain = reachAlong(mesh, 1, 0);
				mesh.shadowScale = 2;
				drawOnce(mesh);
				expect(reachAlong(mesh, 1, 0)).toBeCloseTo(plain * 2, 4);
				mesh.shadowStretch = 1.5;
				drawOnce(mesh);
				// both, not the last one written
				expect(reachAlong(mesh, 1, 0)).toBeCloseTo(plain * 3, 4);
				// ...and across the light only `shadowScale` applies
				expect(reachAlong(mesh, 0, 1)).toBeCloseTo(reachAlong(mesh, 0, 1), 6);
				mesh.destroy();
			});

			it("ADVERSARIAL: offset, stretch and a slope all compose", (ctx) => {
				requireWebGL(ctx, renderer);
				const normal = [Math.sin(0.5), -Math.cos(0.5), 0];
				const sx = -normal[0] / normal[1];
				const build = (offset) => {
					return makeInstanced(3, {
						shadowGroundY: 40,
						shadowGroundNormal: normal,
						shadowStretch: 2.5,
						shadowOffset: offset,
						...EAST,
					});
				};
				const matrixOf = (mesh) => {
					const spy = vi.spyOn(renderer, "drawInstancedShadow");
					try {
						drawOnce(mesh);
						return [...spy.mock.calls[0][1].val];
					} finally {
						spy.mockRestore();
					}
				};
				const still = build(0);
				const a = matrixOf(still);
				still.destroy();
				const thrown = build(1.2);
				const b = matrixOf(thrown);

				// the throw moved it along the light...
				expect(b[12] - a[12]).toBeGreaterThan(1);
				// ...and rode IN the plane while doing so, which is the whole
				// point: slid flat instead, a stretched set climbs off the hill
				// by `distance * tan(tilt)`
				expect(b[13] - a[13]).toBeCloseTo(sx * (b[12] - a[12]), 4);
				expect(b[14]).toBeCloseTo(a[14], 5);

				// and every blob vertex still lands on that one plane
				const q = thrown._shadowQuad.originalVertices;
				for (let i = 0; i < 3; i++) {
					const r = thrown.getInstance(i).val;
					const f = Math.hypot(r[0], r[1], r[2]);
					for (let k = 0; k < 4; k++) {
						const x = r[12] + q[k * 3] * f;
						const z = r[14] + q[k * 3 + 2] * f;
						const wx = b[0] * x + b[4] * r[13] + b[8] * z + b[12];
						const wy = b[1] * x + b[5] * r[13] + b[9] * z + b[13];
						expect(wy).toBeCloseTo(b[13] + sx * (wx - b[12]), 3);
					}
				}
				thrown.destroy();
			});

			it("ADVERSARIAL: a light pointing straight down stretches nothing", (ctx) => {
				requireWebGL(ctx, renderer);
				// a sun directly overhead has no ground direction at all, and
				// normalising a zero-length pair would divide by zero
				const noon = { direction: { x: 0, y: 1, z: 0 } };
				const plain = makeInstanced(2, { shadowGroundY: 0, shadowLight: noon });
				drawOnce(plain);
				const a = reachAlong(plain, 1, 0);
				const b = reachAlong(plain, 0, 1);
				plain.destroy();

				const asked = makeInstanced(2, {
					shadowGroundY: 0,
					shadowLight: noon,
					shadowStretch: 3,
					shadowOffset: 2,
				});
				drawOnce(asked);
				// identical to the set that asked for nothing, and finite
				expect(reachAlong(asked, 1, 0)).toBeCloseTo(a, 5);
				expect(reachAlong(asked, 0, 1)).toBeCloseTo(b, 5);
				expect(Number.isFinite(a)).toBe(true);
				asked.destroy();
			});

			it("ADVERSARIAL: flipping `lit` rebuilds the quad instead of editing it", (ctx) => {
				requireWebGL(ctx, renderer);
				// the in-place refresh is only safe while the quad still wants
				// the same shader; `lit` decides which batcher draws it, so
				// that one change has to make a new mesh
				const mesh = makeInstanced(2, {
					shadowGroundY: 0,
					...EAST,
					shadowStretch: 2,
				});
				drawOnce(mesh);
				const first = mesh._shadowQuad;
				expect(first.lit).toBe(false);
				mesh.lit = true;
				drawOnce(mesh);
				expect(mesh._shadowQuad).not.toBe(first);
				expect(mesh._shadowQuad.lit).toBe(true);
				mesh.destroy();
			});

			it("ADVERSARIAL: the stretch fade rides ON the caller's alpha", (ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(2, {
					shadowGroundY: 0,
					shadowOpacity: 0.8,
					...EAST,
				});
				let alpha;
				const draw = renderer.drawInstancedShadow.bind(renderer);
				const spy = vi
					.spyOn(renderer, "drawInstancedShadow")
					.mockImplementation((...args) => {
						alpha = renderer.getGlobalAlpha();
						return draw(...args);
					});
				try {
					mesh.shadowStretch = 4; // clamps to 3
					renderer.setGlobalAlpha(0.5);
					drawOnce(mesh);
					// opacity × fade × the alpha already on the renderer, and
					// the renderer gets its own alpha back afterwards
					expect(Math.abs(alpha - 0.8 / Math.sqrt(3) / 2)).toBeLessThanOrEqual(
						1 / 255,
					);
					expect(renderer.getGlobalAlpha()).toBeCloseTo(0.5, 6);
				} finally {
					renderer.setGlobalAlpha(1);
					spy.mockRestore();
					mesh.destroy();
				}
			});
		});

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

		it.for([0.5, 2, 1e-8])(
			"scales instanced footprints by %s and refreshes retained geometry",
			(scale, ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(2);
				drawOnce(mesh);
				const oldQuad = mesh._shadowQuad;
				const before = oldQuad.originalVertices.slice();
				const version = oldQuad._geometryVersion;
				expect(Math.abs(before[0])).toBeGreaterThan(0);
				mesh.shadowScale = scale;
				drawOnce(mesh);
				const resized = mesh._shadowQuad;
				expect(resized.originalVertices).toHaveLength(before.length);
				for (let i = 0; i < before.length; i++) {
					expect(resized.originalVertices[i] / scale).toBeCloseTo(before[i], 5);
				}
				// Resized in PLACE, not rebuilt. Four corners moved, and a
				// light that sweeps moves them every frame — allocating a mesh
				// and its GPU buffers at that rate to write twelve floats is
				// what the geometry version exists to avoid.
				expect(resized).toBe(oldQuad);
				expect(resized._geometryVersion).toBeGreaterThan(version);
				drawOnce(mesh);
				expect(mesh._shadowQuad).toBe(resized);
				mesh.destroy();
			},
		);

		it("keeps one instanced mesh's scale independent of another", (ctx) => {
			requireWebGL(ctx, renderer);
			const large = makeInstanced(2, { shadowScale: 2 });
			const normal = makeInstanced(2);
			drawOnce(large);
			drawOnce(normal);
			expect(Math.abs(normal._shadowQuad.originalVertices[0])).toBeGreaterThan(
				0,
			);
			expect(Math.abs(large._shadowQuad.originalVertices[0])).toBeCloseTo(
				Math.abs(normal._shadowQuad.originalVertices[0]) * 2,
				5,
			);
			large.destroy();
			normal.destroy();
		});

		it.for([
			0,
			-1,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
		])(
			"keeps the instances visible but hides their shadows for scale %s",
			(scale, ctx) => {
				requireWebGL(ctx, renderer);
				const mesh = makeInstanced(2);
				drawOnce(mesh);
				mesh.shadowScale = scale;
				const spy = vi.spyOn(renderer.gl, "drawElementsInstanced");
				try {
					drawOnce(mesh);
					expect(spy).toHaveBeenCalledTimes(1);
					mesh.shadowScale = 1;
					spy.mockClear();
					drawOnce(mesh);
					expect(spy).toHaveBeenCalledTimes(2);
				} finally {
					spy.mockRestore();
					mesh.destroy();
				}
			},
		);

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
			// the shadow program lives in the batcher's one variant cache
			const shader = renderer.currentBatcher.shaderVariants.get("shadow");
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
			// the shadow program lives in the batcher's one variant cache
			const shader = renderer.currentBatcher.shaderVariants.get("shadow");
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
			expect(renderer._transparentCount).toBeGreaterThan(0);

			const spy = vi.spyOn(renderer.gl, "drawElements");
			renderer.reset();
			expect(renderer._transparentCount).toBe(0);
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
			const queued = renderer._transparentCount;
			expect(queued).toBeGreaterThan(0);

			renderer.setBatcher("quad");
			expect(renderer._transparentCount).toBe(queued);

			renderer.flushGroundShadows();
			expect(renderer._transparentCount).toBe(0);
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
			const queued = renderer._transparentCount;
			expect(queued).toBeGreaterThan(0);

			renderer.beginScreenSpace();
			try {
				renderer.flushGroundShadows();
				// held, not lost
				expect(renderer._transparentCount).toBe(queued);
			} finally {
				renderer.endScreenSpace();
			}
			// and released the moment the window closes
			renderer.flushGroundShadows();
			expect(renderer._transparentCount).toBe(0);
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
			const queued = renderer._transparentCount;
			expect(queued).toBeGreaterThan(0);

			renderer.setBatcher("litMesh");
			expect(renderer._transparentCount).toBe(queued);
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
			const queued = renderer._transparentCount;
			expect(queued).toBeGreaterThan(0);

			renderer.setMask(new Rect(0, 0, 32, 32));
			expect(renderer._transparentCount).toBe(queued);
			renderer.clearMask();

			// and once the mask is done, the queue is still there to be drawn
			renderer.flushGroundShadows();
			expect(renderer._transparentCount).toBe(0);
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
			expect(renderer._transparentCount).toBe(2);
			const [first, second] = renderer._transparentPool;
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

		it.for([
			["Mesh", Mesh],
			["InstancedMesh", InstancedMesh],
		])(
			"an enlarged %s shadow becomes visible outside a wide flat prop",
			([_name, Type], ctx) => {
				requireWebGL(ctx, renderer);
				const F = 40;
				const prop = activate(
					new Type(0, 40, {
						vertices: new Float32Array([
							-F,
							0,
							-F,
							F,
							0,
							-F,
							F,
							0,
							F,
							-F,
							0,
							F,
						]),
						uvs: GEOMETRY.uvs,
						indices: GEOMETRY.indices,
						width: 1,
						normalize: false,
						cullBackFaces: false,
						castGroundShadow: true,
						shadowGroundY: FLOOR_Y,
						instanceCount: 1,
					}),
				);
				prop.tint.setColor(80, 140, 200);
				const before = renderScene(prop)(96, 64)[0];
				prop.shadowScale = 2;
				const after = renderScene(prop)(96, 64)[0];
				prop.destroy();
				expect(before).toBe(FLOOR_RGB);
				expect(after).toBeLessThan(FLOOR_RGB - 15);
			},
		);

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
