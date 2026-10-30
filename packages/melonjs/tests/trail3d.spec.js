import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	Color,
	Stage,
	state,
	Trail3d,
	Vector3d,
	video,
} from "../src/index.js";
import { resetWarnOnce } from "../src/lang/console.js";

/**
 * A `Trail3d` is a `Mesh`, so it needs a live renderer for the white-pixel
 * fallback its constructor resolves. Canvas is enough and cheap.
 *
 * It also means `Mesh#draw` takes the CPU projection branch, which leaves
 * FINAL WORLD COORDINATES in `mesh.vertices` — which is what lets the
 * placement tests below check the override against the engine's own
 * projection rather than against a restatement of it.
 */
describe("Trail3d", () => {
	let app;
	let camera;

	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
			cameraClass: Camera3d,
		});
		await app.init();
		const stage = new Stage({ cameraClass: Camera3d });
		state.set(state.DEFAULT, stage);
		state.change(state.DEFAULT, true);
		camera = app.viewport;
	});

	afterAll(async () => {
		app?.destroy();
		// back to a 2D viewport so later spec files do not inherit ours
		const reset = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await reset.init();
	});

	/** a recorder standing in for the renderer, enough for Mesh#draw */
	const recorder = () => {
		return {
			calls: [],
			getGlobalAlpha() {
				return 1;
			},
			setGlobalAlpha() {},
			setColor() {},
			save() {},
			restore() {},
			resetTransform() {},
			setTransform() {},
			transform() {},
			drawMesh(...args) {
				this.calls.push(args);
			},
		};
	};

	/** feed it points and run one draw through the stub */
	const drawn = (trail, points, view = camera) => {
		for (const [x, y, z] of points) {
			trail.addPoint(x, y, z);
		}
		trail.update(0);
		const r = recorder();
		trail.draw(r, view);
		return r;
	};

	// ── the point record ────────────────────────────────────────────────

	describe("points", () => {
		it("always stores z, so the record keeps one shape", () => {
			const trail = new Trail3d(0, 0, { minDistance: 0 });
			trail.addPoint(10, 20);
			const p = trail._points[0];
			expect(p).toEqual({ x: 10, y: 20, z: 0, age: 0 });
			// the monomorphic-shape pin: an omitted `z` would be absent, not 0
			expect("z" in p).toBe(true);
			trail.destroy();
		});

		it("takes a z argument and samples one from a target", () => {
			const trail = new Trail3d(0, 0, { minDistance: 0 });
			trail.addPoint(1, 2, 5);
			expect(trail._points[0].z).toBe(5);

			const followed = new Trail3d(0, 0, {
				minDistance: 0,
				target: { pos: { x: 1, y: 2, z: 3 } },
			});
			followed.update(0);
			expect(followed._points[0].z).toBe(3);
			trail.destroy();
			followed.destroy();
		});

		it("stores 0, not undefined, for a target with no z", () => {
			// `pos.z` without a `?? 0` would store undefined, and the next
			// distance test would be NaN and reject every later point
			const trail = new Trail3d(0, 0, {
				minDistance: 1,
				target: { x: 0, y: 0 },
			});
			trail.update(0);
			expect(trail._points[0].z).toBe(0);
			trail.target = { x: 100, y: 0 };
			trail.update(0);
			expect(trail._points.length).toBe(2);
			trail.destroy();
		});

		it("stops following when the target is cleared, however it is cleared", () => {
			// `trail.target = undefined` is the obvious idiom and the one the
			// 2D sibling accepts; `!== null` turned it into a throw
			const trail = new Trail3d(0, 0, {
				minDistance: 0,
				target: { x: 10, y: 20, z: 30 },
			});
			trail.update(0);
			expect(trail._points.length).toBe(1);
			trail.target = undefined;
			expect(() => {
				return trail.update(0);
			}).not.toThrow();
			expect(trail._points.length).toBe(1);
			trail.destroy();
		});

		it("counts depth in the minimum distance", () => {
			// Without dz, a ribbon flying straight at the camera measures
			// every sample as zero distance and never gets a second point.
			const trail = new Trail3d(0, 0, { minDistance: 10 });
			trail.addPoint(0, 0, 0);
			trail.addPoint(0, 0, 5);
			expect(trail._points.length).toBe(1);
			trail.addPoint(0, 0, 20);
			expect(trail._points.length).toBe(2);
			trail.destroy();
		});

		it("drops the oldest point past its capacity", () => {
			const trail = new Trail3d(0, 0, { length: 3, minDistance: 0 });
			for (let i = 0; i < 6; i++) {
				trail.addPoint(i * 10, 0, 0);
			}
			expect(trail._points.length).toBe(3);
			expect(trail._points[0].x).toBe(30);
			trail.destroy();
		});

		it("expires points past their lifetime, oldest first", () => {
			const trail = new Trail3d(0, 0, { minDistance: 0, lifetime: 100 });
			trail.addPoint(0, 0, 0);
			trail.update(60);
			trail.addPoint(50, 0, 0);
			trail.update(60);
			// the first is 120ms old, the second 60ms
			expect(trail._points.length).toBe(1);
			expect(trail._points[0].x).toBe(50);
			trail.destroy();
		});
	});

	// ── capacity is construct-time ──────────────────────────────────────

	describe("capacity", () => {
		it("sizes the geometry once, for the whole ribbon", () => {
			const trail = new Trail3d(0, 0, { length: 7 });
			expect(trail.vertexCount).toBe(14);
			expect(trail.maxPoints).toBe(7);
			trail.destroy();
		});

		it("refuses a length that is not a finite number", () => {
			// `Math.max(2, NaN)` is NaN, which sizes every buffer to zero and
			// makes the capacity test always false: the ribbon never renders
			// and the point list grows without bound. Silent and baffling.
			expect(() => {
				return new Trail3d(0, 0, { length: Number.NaN });
			}).toThrow(/finite/);
		});

		it("truncates a fractional length rather than sizing buffers against it", () => {
			// 10.5 allocated 57 index slots for a loop that writes 60, and
			// made the tail collapse write past the end of the vertex buffer
			const trail = new Trail3d(0, 0, { length: 10.5 });
			expect(trail.maxPoints).toBe(10);
			expect(trail.vertexCount).toBe(20);
			trail.destroy();
		});

		it("widens its index buffer past what 16 bits can address", () => {
			// the largest index is `2 * length - 1`, so 16 bits runs out at
			// 32768 points and wraps: triangles jump back to the ribbon's head
			const small = new Trail3d(0, 0, { length: 100 });
			expect(small.indices).toBeInstanceOf(Uint16Array);
			small.destroy();
			const big = new Trail3d(0, 0, { length: 40000 });
			expect(big.indices).toBeInstanceOf(Uint32Array);
			expect(big.indices[big.indices.length - 1]).toBeGreaterThan(65535);
			big.destroy();
		});

		it("throws on assignment rather than silently keeping the old size", () => {
			// Silence would be worse: writes past a typed array's end are
			// dropped, so the ribbon would just truncate with no clue why.
			const trail = new Trail3d(0, 0, { length: 7 });
			expect(() => {
				trail.maxPoints = 50;
			}).toThrow(/fixed at construction/);
			expect(trail.vertexCount).toBe(14);
			trail.destroy();
		});
	});

	// ── the camera requirement ──────────────────────────────────────────

	describe("camera requirement", () => {
		it("draws nothing under a 2D camera, and says so once", () => {
			// a page that has not said it yet
			resetWarnOnce();
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const flat = new Camera2d(0, 0, 800, 600);
			const a = new Trail3d(0, 0, { minDistance: 0 });
			const b = new Trail3d(0, 0, { minDistance: 0 });

			const ra = drawn(
				a,
				[
					[0, 0, 0],
					[50, 0, 0],
				],
				flat,
			);
			const rb = drawn(
				b,
				[
					[0, 0, 0],
					[50, 0, 0],
				],
				flat,
			);

			// nothing reached the mesh pipeline, on either
			expect(ra.calls.length).toBe(0);
			expect(rb.calls.length).toBe(0);
			// EXACTLY once. `toBeLessThanOrEqual(1)` passed with zero, so it
			// was green with the warning deleted outright — decoration.
			expect(warn.mock.calls.length).toBe(1);
			warn.mockRestore();
			a.destroy();
			b.destroy();
			flat.destroy?.();
		});

		it("draws through the mesh pipeline under a Camera3d", () => {
			const trail = new Trail3d(0, 0, { minDistance: 0 });
			const r = drawn(trail, [
				[0, 0, 0],
				[50, 0, 0],
			]);
			expect(r.calls.length).toBe(1);
			trail.destroy();
		});

		it("draws nothing with fewer than two points", () => {
			const trail = new Trail3d(0, 0, { minDistance: 0 });
			const r = drawn(trail, [[0, 0, 0]]);
			expect(r.calls.length).toBe(0);
			trail.destroy();
		});
	});

	// ── placement ───────────────────────────────────────────────────────

	describe("placement", () => {
		it("leaves true world coordinates in the projected vertices", () => {
			// The override's whole job. `Mesh`'s standard placement applies a
			// scale and a Y-up to Y-down bridge; forget either override and
			// the ribbon comes out mirrored about the anchor.
			const trail = new Trail3d(0, 0, {
				minDistance: 0,
				width: 10,
				widthCurve: [1, 1],
				billboard: false,
				ribbonNormal: [0, 0, -1],
			});
			drawn(trail, [
				[100, 200, 50],
				[200, 200, 50],
			]);
			// tangent is +X and the facing is -Z, so the side is +Y: the two
			// vertices of each point straddle it by half the width
			const v = trail.vertices;
			expect(v[0]).toBeCloseTo(100, 4);
			expect(v[1]).toBeCloseTo(195, 4);
			expect(v[2]).toBeCloseTo(50, 4);
			expect(v[3]).toBeCloseTo(100, 4);
			expect(v[4]).toBeCloseTo(205, 4);
			expect(v[5]).toBeCloseTo(50, 4);
			trail.destroy();
		});

		it("ignores a z written by addChild, because pos is not a placement", () => {
			// `Container#addChild(child, z)` writes `child.pos.z` as a sort
			// key. Honouring it as an offset would shift the whole ribbon by
			// it — which the driving consumer would hit immediately, since it
			// adds its trail with an explicit depth.
			const trail = new Trail3d(0, 0, {
				minDistance: 0,
				width: 10,
				widthCurve: [1, 1],
				billboard: false,
				ribbonNormal: [0, 0, -1],
			});
			drawn(trail, [
				[100, 200, 50],
				[200, 200, 50],
			]);
			const before = [...trail.vertices.slice(0, 6)];

			trail.pos.z = 500;
			trail.update(0);
			const r = recorder();
			trail.draw(r, camera);

			for (let i = 0; i < 6; i++) {
				expect(trail.vertices[i]).toBeCloseTo(before[i], 4);
			}
			trail.destroy();
		});

		it("composes an identity model matrix, translated by the anchor", () => {
			// THE GPU PATH'S ONLY PROTECTION. The retained renderer never
			// calls `_projectVerticesWorld`; it uploads `originalVertices`
			// and lets this matrix place them. Delete the override and the
			// base supplies `diag(1, -1, -1)` instead, which mirrors every
			// ribbon in Y and Z on every GPU backend — and the canvas tests
			// above cannot see it, because they take the CPU branch.
			const trail = new Trail3d(0, 0, { minDistance: 0 });
			drawn(trail, [
				[100, 200, 50],
				[200, 240, 50],
			]);
			const m = trail._composeModelMatrix().val;
			const expected = [
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				0,
				0,
				0,
				1,
				0,
				trail.pos.x,
				trail.pos.y,
				trail.depth,
				1,
			];
			for (let i = 0; i < 16; i++) {
				expect(m[i]).toBeCloseTo(expected[i], 5);
			}
			trail.destroy();
		});

		it("is culled on depth as well as width, so a receding ribbon stays visible", () => {
			// The shape this class exists for: a ribbon running AWAY from the
			// camera has almost no x or y extent. With the bounds blind to z
			// its cull sphere came out a few units across while its centroid
			// sat past the far plane, and the whole ribbon popped out while
			// most of it was still on screen.
			const trail = new Trail3d(0, 0, { minDistance: 0, width: 10 });
			drawn(trail, [
				[0, 0, 900],
				[0, 0, 2500],
			]);
			const bounds = trail.getBounds();
			// the depth span is 1600, so the extent must reflect it rather
			// than collapsing to the ribbon's own 10-unit width
			expect(bounds.width).toBeGreaterThanOrEqual(1600);
			expect(bounds.height).toBeGreaterThanOrEqual(1600);
			trail.destroy();
		});

		it("anchors on the points, so the bounds cover the whole ribbon", () => {
			// Pinned at the origin instead, a ribbon would be culled the
			// moment the origin left the frustum.
			const trail = new Trail3d(0, 0, { minDistance: 0, width: 4 });
			drawn(trail, [
				[1000, 500, 0],
				[1200, 500, 0],
			]);
			expect(trail.pos.x).toBeCloseTo(1100, 4);
			expect(trail.pos.y).toBeCloseTo(500, 4);
			const bounds = trail.getBounds();
			expect(bounds.width).toBeGreaterThanOrEqual(200);
			expect(bounds.left).toBeLessThanOrEqual(1000);
			expect(bounds.right).toBeGreaterThanOrEqual(1200);
			trail.destroy();
		});
	});

	// ── the strip ───────────────────────────────────────────────────────

	describe("strip", () => {
		it("winds two triangles per quad, consistently", () => {
			const trail = new Trail3d(0, 0, { length: 3 });
			expect([...trail.indices.slice(0, 12)]).toEqual([
				0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4,
			]);
			trail.destroy();
		});

		it("collapses the unused tail onto the last live pair", () => {
			// how a varying point count rides a buffer sized once: the
			// surplus quads are zero-area and fully transparent
			const trail = new Trail3d(0, 0, { length: 5, minDistance: 0 });
			drawn(trail, [
				[0, 0, 0],
				[50, 0, 0],
				[100, 0, 0],
			]);
			const v = trail.originalVertices;
			// pair 2 is the last live one; pairs 3 and 4 must repeat it
			for (let i = 3; i < 5; i++) {
				for (let k = 0; k < 6; k++) {
					expect(v[i * 6 + k]).toBeCloseTo(v[2 * 6 + k], 5);
				}
				expect(trail.vertexColors[i * 2]).toBe(0);
				expect(trail.vertexColors[i * 2 + 1]).toBe(0);
			}
			trail.destroy();
		});

		it("runs u from 0 at the head to 1 at the tail", () => {
			const trail = new Trail3d(0, 0, { length: 3, minDistance: 0 });
			drawn(trail, [
				[0, 0, 0],
				[50, 0, 0],
				[100, 0, 0],
			]);
			// index 0 is the OLDEST point, so it carries the tail's u
			expect(trail.uvs[0]).toBeCloseTo(1, 5);
			expect(trail.uvs[2 * 4]).toBeCloseTo(0, 5);
			// v spans the ribbon's width
			expect(trail.uvs[1]).toBe(0);
			expect(trail.uvs[3]).toBe(1);
			trail.destroy();
		});

		it("fades a point's colour with its age", () => {
			const trail = new Trail3d(0, 0, {
				length: 2,
				minDistance: 0,
				lifetime: 100,
				color: "#ffffff",
			});
			trail.addPoint(0, 0, 0);
			trail.addPoint(50, 0, 0);
			// age the oldest to half its life
			trail._points[0].age = 50;
			const r = recorder();
			trail.draw(r, camera);
			// the gradient's tail stop is already transparent, so compare the
			// HEAD, which the gradient leaves opaque: its alpha is the age
			// factor alone
			const head = trail.vertexColors[1 * 2] >>> 24;
			expect(head).toBeGreaterThan(200);
			trail._points[1].age = 50;
			trail.draw(recorder(), camera);
			const faded = trail.vertexColors[1 * 2] >>> 24;
			expect(faded).toBeLessThan(head);
			trail.destroy();
		});
	});

	// ── facing ──────────────────────────────────────────────────────────

	describe("facing", () => {
		it("uses ribbonNormal when billboarding is off, whatever the camera", () => {
			const make = () => {
				return new Trail3d(0, 0, {
					minDistance: 0,
					width: 10,
					widthCurve: [1, 1],
					billboard: false,
					ribbonNormal: [0, 0, -1],
				});
			};
			const a = make();
			drawn(a, [
				[0, 0, 0],
				[100, 0, 0],
			]);
			const first = [...a.originalVertices.slice(0, 6)];

			// move the camera a long way and rebuild
			const b = make();
			camera.pos.set(5000, -3000);
			drawn(b, [
				[0, 0, 0],
				[100, 0, 0],
			]);
			camera.pos.set(0, 0);

			for (let i = 0; i < 6; i++) {
				expect(b.originalVertices[i]).toBeCloseTo(first[i], 4);
			}
			a.destroy();
			b.destroy();
		});

		it("holds a normalized copy of ribbonNormal, not the caller's array", () => {
			const trail = new Trail3d(0, 0, {});
			const source = [0, 0, 4];
			trail.ribbonNormal = source;
			source[2] = 999;
			expect(trail.ribbonNormal).toBeInstanceOf(Vector3d);
			expect(trail.ribbonNormal.z).toBeCloseTo(1, 6);
			expect(trail.ribbonNormal.x).toBeCloseTo(0, 6);
			trail.destroy();
		});

		it("falls back to world up for a zero-length normal", () => {
			const trail = new Trail3d(0, 0, {});
			trail.ribbonNormal = [0, 0, 0];
			expect(trail.ribbonNormal.y).toBeCloseTo(-1, 6);
			expect(Number.isFinite(trail.ribbonNormal.x)).toBe(true);
			trail.destroy();
		});

		it("treats `true` as cylindrical, exactly as Sprite3d does", () => {
			// The intuitive reading is that `true` means "fully faces the
			// camera", and the engine means the opposite. Aliasing it to
			// spherical is the easy mistake; this is what catches it.
			const build = (billboard) => {
				const t = new Trail3d(0, 0, {
					minDistance: 0,
					width: 10,
					widthCurve: [1, 1],
					billboard,
				});
				drawn(t, [
					[0, 300, 400],
					[200, 300, 400],
				]);
				const v = [...t.originalVertices.slice(0, 6)];
				t.destroy();
				return v;
			};
			const asTrue = build(true);
			const asCylindrical = build("cylindrical");
			const asSpherical = build("spherical");

			for (let i = 0; i < 6; i++) {
				expect(asTrue[i]).toBeCloseTo(asCylindrical[i], 5);
			}
			// and the two modes are genuinely different, or the test above
			// would pass for the wrong reason
			let differs = false;
			for (let i = 0; i < 6; i++) {
				if (Math.abs(asTrue[i] - asSpherical[i]) > 1e-3) {
					differs = true;
				}
			}
			expect(differs).toBe(true);
		});

		it("treats an unrecognised billboard value as spherical, as Sprite3d does", () => {
			// otherwise `billboard: "sphere"` means one thing on a card and
			// another on a ribbon, which is worse than either
			const build = (billboard) => {
				const t = new Trail3d(0, 0, {
					minDistance: 0,
					width: 10,
					widthCurve: [1, 1],
					billboard,
				});
				drawn(t, [
					[0, 300, 400],
					[200, 300, 400],
				]);
				const v = [...t.originalVertices.slice(0, 6)];
				t.destroy();
				return v;
			};
			const unknown = build("sphere");
			const spherical = build("spherical");
			for (let i = 0; i < 6; i++) {
				expect(unknown[i]).toBeCloseTo(spherical[i], 5);
			}
		});

		it("keeps a cylindrical ribbon upright when the camera rises", () => {
			const build = (billboard, camY) => {
				camera.pos.set(0, camY);
				const t = new Trail3d(0, 0, {
					minDistance: 0,
					width: 10,
					widthCurve: [1, 1],
					billboard,
				});
				drawn(t, [
					[0, 0, 500],
					[200, 0, 500],
				]);
				const v = [...t.originalVertices.slice(0, 6)];
				t.destroy();
				camera.pos.set(0, 0);
				return v;
			};
			const flatCam = build("cylindrical", 0);
			const highCam = build("cylindrical", -900);
			// the upright mode drops the camera's up component, so raising it
			// changes nothing; spherical would tip
			for (let i = 0; i < 6; i++) {
				expect(highCam[i]).toBeCloseTo(flatCam[i], 4);
			}
			const sphericalFlat = build("spherical", 0);
			const sphericalHigh = build("spherical", -900);
			let tipped = false;
			for (let i = 0; i < 6; i++) {
				if (Math.abs(sphericalHigh[i] - sphericalFlat[i]) > 1e-3) {
					tipped = true;
				}
			}
			expect(tipped).toBe(true);
		});
	});

	// ── the mesh contract ───────────────────────────────────────────────

	describe("mesh settings", () => {
		it("is transparent, two-sided, casts no shadow and bakes its anchor", () => {
			const trail = new Trail3d(0, 0, {});
			// `transparent` is the one that fails invisibly: without it the
			// ribbon goes to the opaque pass with blending off and the alpha
			// fade renders toward black
			expect(trail.transparent).toBe(true);
			expect(trail.cullBackFaces).toBe(false);
			expect(trail.castGroundShadow).toBe(false);
			expect(trail.rightHanded).toBe(true);
			expect(trail._anchorBaked).toBe(true);
			// `Trail` has to force a capture because the primitive batcher
			// never reads a custom shader; the mesh path does, so this one
			// does not
			expect(trail.postEffectNeedsCapture).not.toBe(true);
			trail.destroy();
		});

		it("always updates, so a culled ribbon still ages out", () => {
			// `Container` gates `update` on `inViewport || alwaysUpdate`, so
			// without this a trail stops ageing the moment it leaves the
			// view: its points freeze and the ribbon hangs in the world for
			// good. Nothing else in the suite notices.
			const trail = new Trail3d(0, 0, {});
			expect(trail.alwaysUpdate).toBe(true);
			trail.destroy();
		});

		it("forwards depthTest and blendMode", () => {
			const trail = new Trail3d(0, 0, {
				depthTest: false,
				blendMode: "additive",
			});
			expect(trail.depthTest).toBe(false);
			expect(trail.blendMode).toBe("additive");
			trail.destroy();
		});
	});

	// ── colour ──────────────────────────────────────────────────────────

	describe("colour", () => {
		it("parses the same options Trail does", () => {
			const trail = new Trail3d(0, 0, { color: "#ff0000" });
			const out = new Color();
			trail.gradient.getColorAt(0, out);
			expect(out.r).toBe(255);
			expect(out.alpha).toBeCloseTo(1, 2);
			trail.gradient.getColorAt(1, out);
			expect(out.alpha).toBeCloseTo(0, 2);
			trail.destroy();
		});

		it("recolours after construction, which the constructor alone cannot", () => {
			const trail = new Trail3d(0, 0, { color: "#ff0000" });
			trail.setColor("#00ff00");
			const out = new Color();
			trail.gradient.getColorAt(0, out);
			expect(out.g).toBe(255);
			expect(out.r).toBe(0);

			trail.setGradient(["#0000ff", "#0000ff00"]);
			trail.gradient.getColorAt(0, out);
			expect(out.b).toBe(255);
			trail.destroy();
		});
	});

	// ── lifecycle ───────────────────────────────────────────────────────

	describe("lifecycle", () => {
		it("clears its points on request", () => {
			const trail = new Trail3d(0, 0, { minDistance: 0 });
			trail.addPoint(0, 0, 0);
			trail.addPoint(10, 0, 0);
			trail.clear();
			expect(trail._points.length).toBe(0);
			trail.destroy();
		});

		it("releases its pooled colour on destroy", () => {
			const trail = new Trail3d(0, 0, {});
			trail.destroy();
			expect(trail._segmentColor).toBeUndefined();
		});

		it("releases the gradient's pooled colours too", () => {
			// `Gradient#destroy` is the only path that returns its parsed
			// stop colours to the pool, and the pool holds them by strong
			// reference, so skipping it leaks a set per trail and another
			// per recolour. The 2D sibling has always done this.
			const trail = new Trail3d(0, 0, { color: "#ff0000" });
			const first = trail.gradient;
			const spy = vi.spyOn(first, "destroy");
			trail.setColor("#00ff00");
			expect(spy).toHaveBeenCalledTimes(1);

			const second = trail.gradient;
			const spy2 = vi.spyOn(second, "destroy");
			trail.destroy();
			expect(spy2).toHaveBeenCalledTimes(1);
			expect(trail._gradient).toBeUndefined();
		});
	});
});
