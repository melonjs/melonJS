import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Camera3d,
	Matrix3d,
	Mesh,
	Vector3d,
	video,
	WebGLRenderer,
} from "../src/index.js";

/**
 * Regression tests for the glTF "prop sinks into the platform" bug.
 *
 * Symptom: under `Camera3d`, scene props rendered LOWER than they should,
 * overlapping the platform they rested on — even though every parsed world
 * transform was numerically identical to the authoring tool (Blender), and
 * `Mesh._projectVerticesWorld` emitted correct world coordinates.
 *
 * Root cause (the reason it hid for so long): the bug was NOT in placement
 * or in `_projectVerticesWorld` — it was one step DOWNSTREAM, in the view
 * matrix the mesh batcher applies. `Renderable.preDraw` ran
 * `renderer.translate(-ax, -ay)` (the anchor-point offset, `ax = width *
 * anchorPoint.x`) into `renderer.currentTransform`, and the `MeshBatcher`
 * uses that very transform as its `viewMatrix`. The world-space (Camera3d)
 * path already bakes the final world position into the vertices, so that
 * anchor translate was applied a SECOND time — and because each scene mesh
 * sizes its bounds box (`width`/`height`) per node, the offset DIFFERED per
 * mesh. A big platform shifted up a lot, a small prop shifted up a little →
 * they drifted apart and overlapped.
 *
 * Every diagnostic probe that inspected `_projectVerticesWorld` output saw
 * correct coordinates, so the tests below deliberately exercise the FULL
 * draw path (`preDraw` → `draw` → the live view matrix) — that's the only
 * place the bug is observable.
 *
 * The fix: a `Renderable#applyAnchorTransform` opt-out flag (default `true`,
 * so sprites/2D are unchanged). `Mesh.preDraw` sets it to `false` on the
 * world-space path, so the anchor translate is SUPPRESSED rather than
 * compensated — width never enters the world-space pipeline at all. This
 * mirrors how Three.js/pixi3d keep `anchor`/`center` on the Sprite class
 * only, never on the 3D node. The invariant these tests lock in: **the net
 * rendered position of a world-space mesh must not depend on its
 * `width`/`height`**, and **the flag is exactly what gates that.**
 *
 * Like the sibling `webgl_mesh_depth.spec.js`, every test skips when WebGL2
 * isn't available (headless CI without GPU flags).
 */
describe("Mesh anchor-point leak under Camera3d (glTF prop-sink bug)", () => {
	let renderer;

	beforeAll(async () => {
		await boot();
		try {
			video.init(128, 128, {
				parent: "screen",
				renderer: video.WEBGL,
				failIfMajorPerformanceCaveat: false,
			});
		} catch {
			// genuine WebGL absence — tests skip below
		}
		if (
			video.renderer instanceof WebGLRenderer &&
			video.renderer.WebGLVersion === 2
		) {
			renderer = video.renderer;
		}
	});

	afterAll(() => {
		try {
			video.init(128, 128, { parent: "screen", renderer: video.AUTO });
		} catch {
			// ignore — nothing to restore if init never succeeded
		}
	});

	const requireWebGL2 = (ctx) => {
		if (renderer === undefined) {
			ctx.skip("WebGL2 renderer not available in this environment");
		}
	};

	// a 1×1 solid-color canvas, used as the mesh's baseColor texture
	const colorTex = (r, g, b) => {
		const c = document.createElement("canvas");
		c.width = 1;
		c.height = 1;
		const x = c.getContext("2d");
		x.fillStyle = `rgb(${r},${g},${b})`;
		x.fillRect(0, 0, 1, 1);
		return c;
	};

	// a unit quad (half-extent 20) centered on the local origin, z = 0 — the
	// same shape a flat glTF prop reduces to. `scale: 1` so the on-screen
	// size is identical regardless of the `width` bounds value under test.
	const QUAD_VERTS = [-20, -20, 0, 20, -20, 0, 20, 20, 0, -20, 20, 0];
	const QUAD_UVS = [0, 0, 1, 0, 1, 1, 0, 1];
	const QUAD_IDX = [0, 1, 2, 0, 2, 3];

	const makeMesh = (width, rgb, x = 64, y = 64, z = 0) => {
		const m = new Mesh(0, 0, {
			vertices: new Float32Array(QUAD_VERTS),
			uvs: new Float32Array(QUAD_UVS),
			indices: new Uint16Array(QUAD_IDX),
			texture: colorTex(rgb[0], rgb[1], rgb[2]),
			// `width` === `height` === the per-node bounds box. The bug made
			// the rendered position depend on THIS value; the fix must not.
			width,
			height: width,
			scale: 1,
			normalize: false,
			rightHanded: true,
			cullBackFaces: false,
		});
		m.pos.set(x, y);
		m.depth = z;
		m.currentTransform.identity();
		// mark world-space (as `onActivateEvent` would under a Camera3d stage)
		// so `Mesh.preDraw` opts out of the anchor transform. Tests that want
		// the 2D path flip this back to false.
		m._useWorldSpace = true;
		return m;
	};

	// a real Camera3d so `Mesh.draw` takes the world-space branch
	let cam;
	beforeAll(() => {
		if (renderer !== undefined) {
			cam = new Camera3d(0, 0, 128, 128);
		}
	});

	// run the FULL draw path against an identity camera view, then apply the
	// live view matrix exactly as the mesh batcher does (per-vertex). The
	// result is the position each vertex actually reaches on the GPU. Driving
	// the real `preDraw` is essential — that is where the base class would
	// inject the anchor translate into the view matrix, and where `Mesh`
	// opts out of it for the world-space path.
	const _v = new Vector3d();
	const renderedVertices = (mesh) => {
		// identity camera view: isolate the anchor effect from any scroll
		renderer.currentTransform.identity();
		mesh.preDraw(renderer); // world-space mesh → anchor transform suppressed
		mesh.draw(renderer, cam); // world-space projection emits final world coords
		const view = renderer.currentTransform; // == identity (no anchor leak)
		const out = [];
		for (let i = 0; i < mesh.vertices.length; i += 3) {
			_v.set(mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]);
			view.apply(_v);
			out.push(
				Math.round(_v.x * 1000) / 1000,
				Math.round(_v.y * 1000) / 1000,
				Math.round(_v.z * 1000) / 1000,
			);
		}
		mesh.postDraw(renderer); // balances preDraw's save()
		return out;
	};

	// ──────────────────────────────────────────────────────────────────────
	// The core invariant — net rendered position is width-independent
	// ──────────────────────────────────────────────────────────────────────

	it("net rendered position is INDEPENDENT of the mesh width/height", (ctx) => {
		requireWebGL2(ctx);
		// identical geometry + world placement, only the bounds box differs.
		// width never enters the world-space path (the anchor offset is
		// suppressed entirely, not compensated), so there is no float
		// round-trip — even an odd, pathological 250:1 width is EXACT.
		const small = renderedVertices(makeMesh(40, [200, 50, 50]));
		const big = renderedVertices(makeMesh(900, [50, 200, 50]));
		const huge = renderedVertices(makeMesh(4000, [50, 50, 200]));
		const odd = renderedVertices(makeMesh(9999, [80, 80, 80]));
		// pre-fix: each shifted by -width/2 → all differ by hundreds of px.
		// post-fix: width plays no part → all identical, to the bit.
		expect(big).toEqual(small);
		expect(huge).toEqual(small);
		expect(odd).toEqual(small);
	});

	it("ADVERSARIAL: a 250:1 width ratio still renders at the same spot (no fractional drift)", (ctx) => {
		requireWebGL2(ctx);
		// a coin (tiny bounds) and a long platform (huge bounds) sharing a
		// world position is exactly the failing diorama case
		const coin = renderedVertices(makeMesh(16, [255, 215, 0]));
		const platform = renderedVertices(makeMesh(4000, [120, 80, 40]));
		expect(platform).toEqual(coin);
	});

	it("ADVERSARIAL: the relative gap between a prop and the platform it sits on survives rendering", (ctx) => {
		requireWebGL2(ctx);
		// platform top and prop bottom are coplanar in WORLD space (gap = 0),
		// the platform far larger than the prop. The render-space Y of the
		// shared contact edge must come out EQUAL — pre-fix the larger
		// platform shifted up more than the prop, opening a negative gap
		// (prop sinks below the platform top).
		const platform = renderedVertices(makeMesh(4000, [120, 80, 40], 64, 64, 0));
		const prop = renderedVertices(makeMesh(60, [220, 40, 40], 64, 64, 0));
		// lowest render-Y (top edge) of each — both quads are centered on the
		// same world pos, so post-fix their top edges coincide exactly
		const topY = (verts) => {
			return Math.min(verts[1], verts[4], verts[7], verts[10]);
		};
		const botY = (verts) => {
			return Math.max(verts[1], verts[4], verts[7], verts[10]);
		};
		// the platform is wider but the QUAD geometry is the same size (scale 1),
		// so after the fix the two quads occupy the identical render rectangle
		expect(topY(prop)).toBeCloseTo(topY(platform), 3);
		expect(botY(prop)).toBeCloseTo(botY(platform), 3);
	});

	// ──────────────────────────────────────────────────────────────────────
	// Pixel-level proof through the real GPU
	// ──────────────────────────────────────────────────────────────────────

	const setupOrtho = () => {
		const proj = new Matrix3d();
		proj.ortho(0, 128, 128, 0, -1000, 1000);
		renderer.setProjection(proj);
	};

	const drawFull = (mesh) => {
		renderer.currentTransform.identity();
		mesh.preDraw(renderer);
		mesh.draw(renderer, cam);
		mesh.postDraw(renderer);
	};

	const readCenter = () => {
		const gl = renderer.gl;
		const px = new Uint8Array(4);
		gl.finish();
		gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	it("ADVERSARIAL: a huge-width mesh still covers its true world center pixel", (ctx) => {
		requireWebGL2(ctx);
		setupOrtho();
		const gl = renderer.gl;
		// neutral background
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// small red quad at the canvas center — establishes the center is covered
		drawFull(makeMesh(40, [220, 20, 20]));
		let px = readCenter();
		expect(px[0]).toBeGreaterThan(150); // red present

		// HUGE-width green quad at the SAME world center. Pre-fix its anchor
		// offset (≈ -2000 px) flings it off-screen, leaving the center red.
		// Post-fix it lands dead center and overwrites with green.
		drawFull(makeMesh(4000, [20, 220, 20]));
		px = readCenter();
		expect(px[1]).toBeGreaterThan(150); // green now wins the center
		expect(px[0]).toBeLessThan(120); // red was overdrawn
	});

	// ──────────────────────────────────────────────────────────────────────
	// The flag itself — directly toggled, WITH vs WITHOUT
	// ──────────────────────────────────────────────────────────────────────

	// Render a world-space mesh with the anchor flag ON or OFF, returning the
	// first vertex as it reaches the GPU (after the live view matrix). The flag
	// is driven through the REAL `Mesh.preDraw` via `_useWorldSpace` (`draw`
	// still takes the world-space path because we pass a `Camera3d`), so we
	// observe the production code's behavior, not a stubbed flag.
	const firstVertexWithFlag = (width, anchorOn) => {
		const m = makeMesh(width, [255, 255, 255], 50, 70, 10);
		// Mesh.preDraw sets applyAnchorTransform = (_useWorldSpace !== true)
		m._useWorldSpace = anchorOn ? false : true;
		renderer.currentTransform.identity();
		m.preDraw(renderer);
		expect(m.applyAnchorTransform).toBe(anchorOn); // flag wired as intended
		m.draw(renderer, cam); // Camera3d → world-space projection regardless
		const view = renderer.currentTransform;
		_v.set(m.vertices[0], m.vertices[1], m.vertices[2]);
		view.apply(_v);
		const out = { x: _v.x, y: _v.y };
		m.postDraw(renderer);
		return out;
	};

	it("ADVERSARIAL with vs without the flag: ON reproduces the bug, OFF fixes it", (ctx) => {
		requireWebGL2(ctx);
		const width = 4000;
		const ax = width * 0.5; // anchorPoint.x === 0.5
		const ay = width * 0.5;

		// flag OFF (applyAnchorTransform = false): the world-space mesh lands
		// at its true world position — the fix.
		const off = firstVertexWithFlag(width, false);

		// flag ON (applyAnchorTransform = true): the base anchor translate
		// leaks `(-ax, -ay)` into the view matrix — this is the ORIGINAL BUG.
		const on = firstVertexWithFlag(width, true);

		// the ON case is shifted from the OFF case by exactly the anchor
		// offset (thousands of px for this width) — proving the flag is what
		// gates the bug, and that OFF is the correct position.
		expect(off.x - on.x).toBeCloseTo(ax, 3);
		expect(off.y - on.y).toBeCloseTo(ay, 3);
		expect(Math.abs(off.x - on.x)).toBeGreaterThan(100); // not a rounding nit
	});

	it("the flag is the ONLY width-dependent term: OFF is width-invariant, ON is not", (ctx) => {
		requireWebGL2(ctx);
		// OFF: position identical across wildly different widths
		const offSmall = firstVertexWithFlag(40, false);
		const offHuge = firstVertexWithFlag(9999, false);
		expect(offHuge.x).toBeCloseTo(offSmall.x, 3);
		expect(offHuge.y).toBeCloseTo(offSmall.y, 3);
		// ON: position diverges with width (the bug scales with the bounds box)
		const onSmall = firstVertexWithFlag(40, true);
		const onHuge = firstVertexWithFlag(9999, true);
		expect(Math.abs(onHuge.x - onSmall.x)).toBeGreaterThan(1000);
	});

	// ──────────────────────────────────────────────────────────────────────
	// Wiring — Mesh.preDraw derives the flag from the active render path
	// ──────────────────────────────────────────────────────────────────────

	it("Mesh.preDraw opts the world-space path OUT of the anchor, keeps it for 2D", (ctx) => {
		requireWebGL2(ctx);
		const ws = makeMesh(80, [255, 255, 255]); // _useWorldSpace = true
		ws.preDraw(renderer);
		expect(ws.applyAnchorTransform).toBe(false); // 3D → suppressed
		ws.postDraw(renderer);

		const twoD = makeMesh(80, [255, 255, 255]);
		twoD._useWorldSpace = false;
		twoD.preDraw(renderer);
		expect(twoD.applyAnchorTransform).toBe(true); // 2D → anchor kept
		twoD.postDraw(renderer);
	});

	it("the base class default is applyAnchorTransform = true (sprites/2D unchanged)", (ctx) => {
		requireWebGL2(ctx);
		// the fix must not change the default for sprites / 2D renderables —
		// the base class ships the anchor ON. A freshly constructed Mesh,
		// before any world-space preDraw has run, carries the base default.
		const fresh = makeMesh(80, [255, 255, 255]);
		expect(fresh.applyAnchorTransform).toBe(true);
	});

	it("world-space draw() emits pure world coordinates (anchor never baked into vertices)", (ctx) => {
		requireWebGL2(ctx);
		const m = makeMesh(80, [255, 255, 255], 50, 70, 10);
		// reference: the bare world-space projection
		m._projectVerticesWorld(m.pos.x, m.pos.y, m.depth);
		const pureWorld = Array.from(m.vertices);
		// the real draw path must produce the SAME vertices (no offset baked in;
		// the anchor is handled by suppressing the view-matrix translate, not by
		// moving vertices)
		const stub = { drawMesh() {} };
		m.draw(stub, cam);
		expect(Array.from(m.vertices)).toEqual(pureWorld);
	});

	it("the 2D (non-Camera3d) path still uses its own projection, unchanged", (ctx) => {
		requireWebGL2(ctx);
		// without a Camera3d viewport, draw() takes the legacy 2D branch
		// (`_projectVertices`), untouched by this fix.
		const m = makeMesh(80, [255, 255, 255], 50, 70, 10);
		const stub = { drawMesh() {} };
		m._useWorldSpace = false;
		m.draw(stub /* no viewport → 2D path */);
		const twoD = Array.from(m.vertices);
		// the world-space projection produces a different vertex set
		m._projectVerticesWorld(m.pos.x, m.pos.y, m.depth);
		expect(twoD).not.toEqual(Array.from(m.vertices));
	});
});
