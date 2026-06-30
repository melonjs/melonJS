import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Matrix3d,
	Renderable,
	RenderState,
	video,
	WebGLRenderer,
} from "../src/index.js";

// `setDepth` only feeds depth into the vertex stream under a perspective
// projection (a depth scene / Camera3d); under the default ortho projection it
// keeps currentDepth at 0 so a sort key can't clip (see sprite-depth.spec.js).
// These suites exercise the depth-carrying pipeline, so they run "in 3D".
const PERSPECTIVE = new Matrix3d().perspective(Math.PI / 4, 1.333, 0.1, 2000);

/**
 * Test suite for per-renderable depth plumbing (19.7).
 *
 * Covers the path that takes a `renderable.depth` value, threads it through
 * `Renderable.preDraw` → `renderer.setDepth` → `renderer.currentDepth` →
 * batcher emit functions → vertex stream as the `z` component of each
 * vertex. Verifies that:
 *
 *  1. RenderState's save/restore stack honors `currentDepth`.
 *  2. `Renderer.setDepth(v)` writes to `currentDepth`.
 *  3. `Renderable.preDraw(renderer)` forwards `this.depth` to `setDepth`.
 *  4. Default depth is 0.
 *  5. WebGL batchers (`quad`, `litQuad`, `primitive`) declare `aVertex` at
 *     size 3 with the expected stride.
 *  6. After a draw, the vertex buffer carries the current depth at the
 *     expected z offset of every emitted vertex.
 *  7. A composite renderable (single preDraw → many addQuad calls) writes
 *     the same depth to every emitted vertex.
 *  8. Custom shaders declaring `vec2 aVertex` continue to render without
 *     GL errors after the layout widened (backward compatibility).
 */
describe("RenderState — currentDepth", () => {
	let state;

	beforeAll(() => {
		state = new RenderState();
	});

	it("should default currentDepth to 0", () => {
		const fresh = new RenderState();
		expect(fresh.currentDepth).toBe(0);
	});

	it("should preserve currentDepth across save/restore", () => {
		state.currentDepth = 5;
		state.save();
		state.currentDepth = 99;
		state.restore(800, 600);

		expect(state.currentDepth).toBe(5);
	});

	it("should preserve currentDepth across nested save/restore", () => {
		state.currentDepth = 1;
		state.save();
		state.currentDepth = 2;
		state.save();
		state.currentDepth = 3;
		state.restore(800, 600);
		expect(state.currentDepth).toBe(2);
		state.restore(800, 600);
		expect(state.currentDepth).toBe(1);
	});

	it("should reset currentDepth to 0 on full reset", () => {
		state.currentDepth = 42;
		state.reset(800, 600);
		expect(state.currentDepth).toBe(0);
	});
});

describe("Renderer.setDepth", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		renderer.setProjection(PERSPECTIVE); // depth-carry path
	});

	afterAll(() => {
		// hand the world back to the default renderer for any later test files
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("should set renderer.currentDepth to the given value", () => {
		renderer.setDepth(0);
		expect(renderer.currentDepth).toBe(0);

		renderer.setDepth(7);
		expect(renderer.currentDepth).toBe(7);

		renderer.setDepth(-42);
		expect(renderer.currentDepth).toBe(-42);
	});

	it("should be reset by save/restore", () => {
		renderer.setDepth(10);
		renderer.save();
		renderer.setDepth(20);
		expect(renderer.currentDepth).toBe(20);
		renderer.restore();
		expect(renderer.currentDepth).toBe(10);
	});

	it("should default to 0 after renderer.reset", () => {
		renderer.setDepth(50);
		renderer.reset();
		expect(renderer.currentDepth).toBe(0);
	});
});

describe("Renderable.preDraw forwards depth", () => {
	let renderer;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		renderer.setProjection(PERSPECTIVE); // depth-carry path
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	it("should call renderer.setDepth with renderable.depth during preDraw", () => {
		const r = new Renderable(0, 0, 32, 32);
		r.depth = 17;

		// spy on setDepth — preserve original so save/restore still works
		const calls = [];
		const original = renderer.setDepth.bind(renderer);
		renderer.setDepth = (depth) => {
			calls.push(depth);
			original(depth);
		};

		try {
			r.preDraw(renderer);
			r.postDraw(renderer);
		} finally {
			renderer.setDepth = original;
		}

		expect(calls).toContain(17);
	});

	it("should default to depth 0 when not explicitly set", () => {
		const r = new Renderable(0, 0, 32, 32);
		expect(r.depth).toBe(0);

		const calls = [];
		const original = renderer.setDepth.bind(renderer);
		renderer.setDepth = (depth) => {
			calls.push(depth);
			original(depth);
		};

		try {
			r.preDraw(renderer);
			r.postDraw(renderer);
		} finally {
			renderer.setDepth = original;
		}

		expect(calls).toContain(0);
	});
});

describe("WebGL batchers carry depth as vec3 aVertex (PR A)", () => {
	let renderer;
	let isWebGL;

	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.WEBGL,
			failIfMajorPerformanceCaveat: false,
		});
		renderer = video.renderer;
		renderer.setProjection(PERSPECTIVE); // depth-carry path
		isWebGL = renderer instanceof WebGLRenderer;
	});

	afterAll(() => {
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
	});

	const skipIfNoWebGL = (ctx) => {
		if (!isWebGL) {
			ctx.skip("WebGL renderer not available in this environment");
			return true;
		}
		return false;
	};

	// QuadBatcher layout: aVertex(3) + aRegion(2) + aColor(4 UBYTE = 1 float-slot)
	// + aTextureId(1) = 7 float-slots * 4 bytes = 28 bytes
	it("QuadBatcher declares aVertex size 3, stride 28", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		const aVertex = batcher.attributes.find((a) => {
			return a.name === "aVertex";
		});
		expect(aVertex).toBeDefined();
		expect(aVertex.size).toBe(3);
		expect(batcher.stride).toBe(28);
	});

	// LitQuadBatcher adds aNormalTextureId at the tail → 8 float-slots = 32 bytes
	it("LitQuadBatcher declares aVertex size 3, stride 32", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("litQuad");
		const aVertex = batcher.attributes.find((a) => {
			return a.name === "aVertex";
		});
		expect(aVertex).toBeDefined();
		expect(aVertex.size).toBe(3);
		expect(batcher.stride).toBe(32);
	});

	// PrimitiveBatcher: aVertex(3) + aNormal(2) + aColor(4 UBYTE = 1 float-slot)
	// = 6 float-slots * 4 bytes = 24 bytes
	it("PrimitiveBatcher declares aVertex size 3, stride 24", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("primitive");
		const aVertex = batcher.attributes.find((a) => {
			return a.name === "aVertex";
		});
		expect(aVertex).toBeDefined();
		expect(aVertex.size).toBe(3);
		expect(batcher.stride).toBe(24);
	});

	it("renderer.setDepth value is emitted as the z component of every vertex (quad)", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}

		// switch to the quad batcher and clear any in-flight vertices
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();

		// install a depth and draw one sprite — should produce 4 vertices,
		// each carrying z = 42 at float-slot 2 (after x, y).
		const tex = video.createCanvas(16, 16);
		renderer.save();
		renderer.setDepth(42);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.restore();

		// don't flush — read back from the still-pending vertex buffer
		const vertexSize = batcher.vertexSize;
		const f32 = batcher.vertexData.toFloat32();
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(4);

		// z is at float-slot 2 of each vertex
		for (let v = 0; v < 4; v++) {
			expect(f32[v * vertexSize + 2]).toBeCloseTo(42, 5);
		}

		// cleanup
		batcher.vertexData.clear();
	});

	it("default depth = 0 produces z = 0 in the vertex stream", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();

		const tex = video.createCanvas(16, 16);
		renderer.save();
		renderer.setDepth(0);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.restore();

		const vertexSize = batcher.vertexSize;
		const f32 = batcher.vertexData.toFloat32();
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(4);
		for (let v = 0; v < 4; v++) {
			expect(f32[v * vertexSize + 2]).toBe(0);
		}
		batcher.vertexData.clear();
	});

	it("emits the same depth across all vertices of a primitive draw", (ctx) => {
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("primitive");
		batcher.vertexData.clear();

		renderer.save();
		renderer.setDepth(-13);
		renderer.fillRect(10, 10, 50, 30);
		renderer.restore();

		const vertexSize = batcher.vertexSize;
		const f32 = batcher.vertexData.toFloat32();
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(3);
		for (let v = 0; v < batcher.vertexData.vertexCount; v++) {
			expect(f32[v * vertexSize + 2]).toBeCloseTo(-13, 5);
		}
		batcher.vertexData.clear();
	});

	it("tint slot survives at the correct offset after vertex layout widening (regression)", (ctx) => {
		// The original PR A had a bug where `VertexArrayBuffer.push()` still
		// indexed by the old (pre-vec3) positional layout. The caller passed
		// (x, y, z, u, v, tint, textureId) but push() wrote arg 4 ("v") to
		// the tint-slot as UINT32 — corrupting tint into a bit-reinterpretation
		// of a float v value, producing black/garbage rendering across every
		// example.
		//
		// Guard: verify that after a drawImage with a known tint, the tint
		// slot at the new offset 5 contains the actual tint uint32 — NOT a
		// reinterpreted float.
		if (skipIfNoWebGL(ctx)) {
			return;
		}
		const batcher = renderer.setBatcher("quad");
		batcher.vertexData.clear();

		const tex = video.createCanvas(16, 16);
		// distinctive tint: solid red with full alpha = 0xff0000ff in ABGR
		// (drawImage's currentTint converts to uint32 via toUint32(alpha))
		renderer.save();
		// `setTint` accepts a CSS color string and parses it via
		// `Color.copy`; using the public surface keeps the test from
		// depending on Color's private backing array shape.
		renderer.setTint("#ff0000", 1.0);
		renderer.setDepth(11);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.restore();

		const f32 = batcher.vertexData.toFloat32();
		const u32 = batcher.vertexData.toUint32();
		expect(batcher.vertexData.vertexCount).toBeGreaterThanOrEqual(4);

		// z at slot 2 must be 11 (proves z plumbing)
		expect(f32[2]).toBeCloseTo(11, 5);

		// tint at slot 5 must be a meaningful UINT32 (non-zero, non-NaN-bit-pattern)
		// — the actual value depends on currentTint × alpha encoding, but it
		// MUST NOT be the bit-pattern of a float UV (which is in [0, 1] range
		// → bit-pattern around 0 or 0x3F800000, NOT 0xff... — pre-fix bug
		// produced exactly that)
		const tintSlot = u32[5];
		expect(tintSlot).not.toBe(0);
		// a normal tint uint32 with non-trivial alpha has high bits set;
		// reinterpreted floats from UVs in [0,1] cluster around 0x3F800000 or 0
		expect(tintSlot).toBeGreaterThan(0xff_00_00_00 >>> 0);

		batcher.vertexData.clear();
	});

	it("draws without GL error after vertex layout widening (regression)", (ctx) => {
		// End-to-end: a frame of sprite + primitive draws at non-zero depth
		// must not produce INVALID_OPERATION (stride mismatch) or
		// INVALID_VALUE (out-of-range attribute) on either path.
		if (skipIfNoWebGL(ctx)) {
			return;
		}

		const gl = renderer.gl;
		while (gl.getError() !== gl.NO_ERROR) {
			/* drain */
		}

		const tex = video.createCanvas(16, 16);
		renderer.save();
		renderer.setDepth(25);
		renderer.drawImage(tex, 0, 0, 16, 16, 0, 0, 16, 16);
		renderer.currentBatcher.flush();

		renderer.setDepth(-5);
		renderer.strokeRect(20, 20, 40, 40);
		renderer.currentBatcher.flush();
		renderer.restore();

		expect(gl.getError()).toBe(gl.NO_ERROR);
	});

	it("Camera2d default near/far cover large depth values without clip-culling (regression)", async () => {
		// Pre-PR-A, `aVertex` was vec2 and `gl_Position` hardcoded z=0 in the
		// vertex shader — clipspace.z was always 0, so the camera's near/far
		// values didn't affect sprite clipping. With vec3 aVertex carrying
		// per-sprite depth, clipspace.z = -depth / (near-far range). Any
		// `Renderable.depth` outside the [near, far] range maps outside
		// clip space and the GPU silently culls the fragment.
		//
		// Failure modes this catches:
		// - `Container.autoDepth = true` (default!) assigns `pos.z = childCount`
		//   so any container with >old-far children would clip-cull
		// - Y-sort on tall maps: `sprite.depth = sprite.pos.y` easily exceeds
		//   the old ±1000 default
		//
		// 19.7 widens Camera2d's default near/far from ±1000 to ±1e6 to keep
		// every realistic 2D depth value visible. This test pins those defaults.
		const { Camera2d } = await import("../src/index.js");
		const cam = new Camera2d(0, 0, 800, 600);
		expect(cam.near).toBeLessThanOrEqual(-1e5);
		expect(cam.far).toBeGreaterThanOrEqual(1e5);

		// end-to-end: render a sprite at depth=10000 (10× the pre-19.7 default
		// far plane) and verify it produces no GL error AND the vertex still
		// carries the depth in the buffer. If clip-culling fires, no GL error
		// would surface, but the vertex itself would still be in the buffer.
		// A more discriminating check: project depth=10000 through the camera's
		// ortho matrix and verify clipspace.z lands inside [-1, 1].
		const m = cam.projectionMatrix.val;
		// ortho row 3: clipspace.z = a[10] * z + a[14] * 1
		const clipZAtFar2D = m[10] * 10000 + m[14];
		expect(Math.abs(clipZAtFar2D)).toBeLessThan(1);
	});
});
