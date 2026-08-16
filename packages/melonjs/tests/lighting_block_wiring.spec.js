import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Light3d, Matrix3d, state } from "../src/index.js";
import { MAX_LIGHTS } from "../src/video/webgl/lighting/constants.ts";
import {
	BLOCK_BYTES,
	HEADER_FLOATS,
} from "../src/video/webgl/lighting/std140.ts";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * End-to-end wiring between the lit batchers and their light blocks (#1552).
 *
 * `tests/lighting_std140.spec.js` proves the writer lays out the right bytes
 * and `tests/webgl_uniformblock.spec.js` proves the buffer uploads what it is
 * handed. Neither notices if the batcher hands the buffer a *different array*
 * than the one it filled — which is exactly the bug this file was written
 * after: the batcher wrote into its own scratch, `upload` sent
 * `UniformBlock.data`, and every lit surface in the engine rendered black.
 *
 * So the assertions here read back from the **GPU**, through
 * `getBufferSubData`, rather than from any staging array. That is the only
 * vantage point from which "the data the batcher was given" and "the data the
 * shader will read" are the same thing.
 */
describe("lit batchers → light uniform block (issue #1552)", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/**
	 * Read the first `floats` entries back out of a block's GL buffer.
	 * @param {object} block - the UniformBlock to read
	 * @param {number} floats - how many floats to fetch
	 * @returns {number[]} the GPU-resident values
	 */
	const readback = (block, floats) => {
		const out = new Float32Array(floats);
		gl.bindBuffer(gl.UNIFORM_BUFFER, block.buffer);
		gl.getBufferSubData(gl.UNIFORM_BUFFER, 0, out);
		gl.bindBuffer(gl.UNIFORM_BUFFER, null);
		return Array.from(out);
	};

	describe("LitQuadBatcher / Light2dBlock", () => {
		it("puts what setLightUniforms was given on the GPU", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("litQuad");
			expect(batcher).toBeDefined();

			batcher.setLightUniforms({
				count: 2,
				// distinctive values, so a misrouted array reads as zeroes and a
				// misplaced field reads as the wrong number
				positions: new Float32Array([11, 12, 13, 14, 21, 22, 23, 24]),
				// binary fractions, so float32 round-trips them exactly and the
				// comparison below can stay exact rather than approximate
				colors: new Float32Array([0.5, 0.25, 0.125, 0.75, 0.375, 0.625]),
				heights: new Float32Array([7, 8]),
				ambient: [0.5, 0.25, 0.125],
			});

			const gpu = readback(batcher.lightBlock, HEADER_FLOATS + 16);
			// header: count, pad×3, ambient rgb, pad
			expect(gpu.slice(0, 8)).toEqual([2, 0, 0, 0, 0.5, 0.25, 0.125, 0]);
			// first light: position vec4 then colour+height vec4
			expect(gpu.slice(8, 16)).toEqual([11, 12, 13, 14, 0.5, 0.25, 0.125, 7]);
			// second light, at the next 32-byte stride
			expect(gpu.slice(16, 24)).toEqual([
				21, 22, 23, 24, 0.75, 0.375, 0.625, 8,
			]);
			expect(gl.getError()).toBe(gl.NO_ERROR);
		});

		it("occupies its binding point with a correctly sized buffer", (ctx) => {
			requireWebGL(ctx, renderer);
			const block = renderer.batchers.get("litQuad").lightBlock;
			expect(
				gl.getIndexedParameter(gl.UNIFORM_BUFFER_BINDING, block.bindingPoint),
			).toBe(block.buffer);
			expect(block.data.byteLength).toBe(BLOCK_BYTES);
		});

		it("actually points the program's block at its binding point", (ctx) => {
			requireWebGL(ctx, renderer);
			// A GLSL uniform block defaults to binding point 0, and the 2D
			// block happens to sit on point 0 — so removing the explicit
			// `bindTo` here breaks nothing today, and the whole re-bind
			// mechanism (after a context restore, or a shader swap) could rot
			// away unnoticed until the constants are renumbered or a third
			// block appears. Assert the binding the program carries, not the
			// pixels it happens to produce.
			const batcher = renderer.batchers.get("litQuad");
			batcher.bind();
			const program = (batcher.currentShader || batcher.defaultShader).program;
			const index = gl.getUniformBlockIndex(program, "Light2dBlock");
			expect(index).not.toBe(gl.INVALID_INDEX);
			expect(
				gl.getActiveUniformBlockParameter(
					program,
					index,
					gl.UNIFORM_BLOCK_BINDING,
				),
			).toBe(batcher.lightBlock.bindingPoint);
			renderer.setBatcher("quad");
		});

		it("claims its binding point from the renderer's allocator", (ctx) => {
			requireWebGL(ctx, renderer);
			// Binding points are a context-wide namespace: two blocks sharing
			// one silently overwrite each other and the loser reads the
			// winner's bytes as lights. They are handed out by the renderer
			// rather than hard-coded per feature, so a third block cannot
			// collide by picking a literal someone else already took.
			const block = renderer.batchers.get("litQuad").lightBlock;
			expect(typeof block.bindingPoint).toBe("number");
			expect(Number.isInteger(block.bindingPoint)).toBe(true);
			expect(block.bindingPoint).toBeGreaterThanOrEqual(0);
			expect(block.bindingPoint).toBeLessThan(
				gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS),
			);
			// and it is genuinely reserved — the next claim is a different one
			const next = renderer.reserveUniformBindingPoint();
			expect(next).not.toBe(block.bindingPoint);
			expect(next).not.toBe(
				renderer.batchers.get("litMesh").lightBlock.bindingPoint,
			);
		});

		it("holds its binding point when init re-runs", (ctx) => {
			requireWebGL(ctx, renderer);
			// `init()` re-runs on every context restore. Claiming a fresh point
			// each time would walk through the device's budget over a long
			// session and eventually throw, for a resource the batcher already
			// owns.
			const batcher = renderer.batchers.get("litQuad");
			const before = batcher.lightBlock.bindingPoint;
			batcher.init(renderer);
			batcher.init(renderer);
			expect(batcher.lightBlock.bindingPoint).toBe(before);
		});

		it("does not share a binding point with the 3D block", (ctx) => {
			requireWebGL(ctx, renderer);
			// both can be live in one frame (lit sprites over a lit mesh); the
			// same point would silently make the second overwrite the first
			expect(renderer.batchers.get("litQuad").lightBlock.bindingPoint).not.toBe(
				renderer.batchers.get("litMesh").lightBlock.bindingPoint,
			);
		});

		it("drops back to a zero count when the lights go away", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = renderer.batchers.get("litQuad");
			batcher.setLightUniforms({
				count: 1,
				positions: new Float32Array([1, 2, 3, 4]),
				colors: new Float32Array([1, 1, 1]),
				heights: new Float32Array([5]),
				ambient: [0.5, 0.5, 0.5],
			});
			batcher.setLightUniforms({
				count: 0,
				positions: new Float32Array(4),
				colors: new Float32Array(3),
				heights: new Float32Array(1),
				ambient: [0, 0, 0],
			});
			// the shader loops to `count`, so a stale count would keep shading
			// with last frame's light even though nothing wrote it
			expect(readback(batcher.lightBlock, 1)[0]).toBe(0);
		});
	});

	describe("LitMeshBatcher / Light3dBlock", () => {
		it("puts the active stage's 3D lights on the GPU before a draw", (ctx) => {
			requireWebGL(ctx, renderer);
			const stage = state.current();
			if (!stage) {
				ctx.skip("no active stage");
				return;
			}
			const batcher = renderer.batchers.get("litMesh");
			const light = new Light3d({
				direction: [0, 1, 0],
				color: [1, 0, 0],
				intensity: 1,
			});
			const previous = stage._activeLights3d;
			stage._activeLights3d = new Set([light]);
			try {
				// pass entry then per-draw refresh — the sequence a real draw
				// runs, since the light upload moved out of `bind()`
				batcher.bind();
				batcher.updatePassState();
				const gpu = readback(batcher.lightBlock, HEADER_FLOATS + 12);
				expect(gpu[0]).toBe(1); // one directional light
				// 12-float stride: posRange (directional sentinel range -1),
				// then dirCone with surface→light = negated travel direction
				expect(gpu[11]).toBe(-1);
				expect(gpu[12]).toBeCloseTo(0, 5);
				expect(gpu[13]).toBeCloseTo(-1, 5);
				expect(gpu[14]).toBeCloseTo(0, 5);
				// no cone on a directional light
				expect(gpu[15]).toBe(-1);
				// colour premultiplied by intensity
				expect(gpu[16]).toBeCloseTo(1, 5);
				expect(gpu[17]).toBeCloseTo(0, 5);
				expect(gl.getError()).toBe(gl.NO_ERROR);
			} finally {
				stage._activeLights3d = previous;
				renderer.setBatcher("quad");
			}
		});

		it("falls back to white ambient when the scene has no 3D lights", (ctx) => {
			requireWebGL(ctx, renderer);
			const stage = state.current();
			if (!stage) {
				ctx.skip("no active stage");
				return;
			}
			const batcher = renderer.batchers.get("litMesh");
			const previous = stage._activeLights3d;
			stage._activeLights3d = new Set();
			try {
				batcher.bind();
				batcher.updatePassState();
				const gpu = readback(batcher.lightBlock, HEADER_FLOATS);
				expect(gpu[0]).toBe(0);
				// fullbright, so an unlit-looking mesh doesn't render black
				expect(gpu.slice(4, 7)).toEqual([1, 1, 1]);
			} finally {
				stage._activeLights3d = previous;
				renderer.setBatcher("quad");
			}
		});
	});
});

/**
 * The point of #1552: the light cap is no longer 8.
 *
 * Everything else here proves the *transport* carries 32 lights — the writer
 * places them, the driver reserves room for them, the buffer uploads them.
 * None of that proves the GLSL loop reads past index 7, which is the claim a
 * user actually cares about. So this draws a real lit quad and reads the
 * framebuffer back.
 *
 * The scene is arranged so the answer cannot be produced by accident: every
 * light below the index under test is black, so the only thing that can
 * colour the pixel is the one high-index light.
 */
describe("light cap above 8 (issue #1552)", () => {
	let renderer;
	let gl;
	const SIZE = 64;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(SIZE, SIZE);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/**
	 * A solid-colour canvas usable as an albedo or normal-map source.
	 * @param {string} fill - CSS colour
	 * @returns {HTMLCanvasElement} the filled canvas
	 */
	const solid = (fill) => {
		const c = document.createElement("canvas");
		c.width = 16;
		c.height = 16;
		const ctx = c.getContext("2d");
		ctx.fillStyle = fill;
		ctx.fillRect(0, 0, 16, 16);
		return c;
	};

	/**
	 * Draw one lit quad covering the framebuffer, lit only by light `index`.
	 * @param {number} index - which light slot carries the colour
	 * @param {number} count - how many lights to declare
	 * @returns {Uint8Array} the centre pixel, RGBA
	 */
	const drawLitBy = (index, count) => {
		const lit = renderer.batchers.get("litQuad");
		const positions = new Float32Array(count * 4);
		const colors = new Float32Array(count * 3);
		const heights = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			// every light sits on the quad with a generous radius, so the only
			// thing distinguishing them is their colour
			positions[i * 4] = SIZE / 2;
			positions[i * 4 + 1] = SIZE / 2;
			positions[i * 4 + 2] = SIZE * 4; // radius
			positions[i * 4 + 3] = 1; // intensity
			heights[i] = SIZE;
			// black except the one under test — pure green, a channel the
			// white albedo and the flat normal cannot manufacture on their own
			colors[i * 3 + 1] = i === index ? 1 : 0;
		}

		renderer.clearColor("#000000", true);
		renderer.setLightUniforms(undefined, undefined, 0, 0);
		// bypass the Light2d/Stage packing so the test controls the slot
		// directly; `activeLightCount` is what gates the lit dispatch
		lit.setLightUniforms({
			count,
			positions,
			colors,
			heights,
			ambient: [0, 0, 0],
		});
		renderer.activeLightCount = count;
		// a flat normal map: (0.5, 0.5, 1) decodes to +Z, facing the viewer
		renderer.currentNormalMap = solid("rgb(128,128,255)");
		renderer.drawImage(solid("#ffffff"), 0, 0, 16, 16, 0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.currentNormalMap = null;
		renderer.activeLightCount = 0;

		const px = new Uint8Array(4);
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	it("shades from a light at index 0 (control)", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitBy(0, 1);
		expect(px[1]).toBeGreaterThan(40); // green channel lit
		expect(px[0]).toBeLessThan(20); // and only green
	});

	// #1585 collapsed the lit shader from TWO sampler sets (uSampler* plus
	// uNormalSampler*) to ONE addressed by two per-quad ids. A colour/normal slot
	// collision used to be structurally impossible; now it is prevented only by
	// an invariant in `resolveNormalUnit`, so it needs a test that can SEE one.
	//
	// The scaffold's normal map is flat +Z under a light directly overhead, so
	// NdotL is 1 and the centre pixel reads green 141. Driving the normal ladder
	// from the COLOUR id instead — the collision — makes the normal decode from
	// the WHITE albedo, normalize(1,1,1), NdotL 0.577, and the pixel reads 81.
	// Both numbers are measured, not derived. Every other lit assertion in this
	// file is `> 40` and cannot tell them apart.
	it("the colour id and the normal id select DIFFERENT samplers", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitBy(0, 1);
		expect(px[1]).toBeGreaterThan(120);
	});

	// The `_cacheEpoch` re-resolution path: claiming the normal map's slot can
	// exhaust the pool and wipe every assignment — including the colour unit
	// resolved moments earlier AND the normal's own, since the wipe frees
	// occupancy while the texture stays bound in GL. Both must be re-resolved or
	// the vertex stream carries a stale unit.
	it("exhausting the pool on the normal map re-resolves both ids", (ctx) => {
		requireWebGL(ctx, renderer);
		const lit = renderer.batchers.get("litQuad");
		const cache = renderer.cache;
		const original = cache.max_size;
		const albedo = solid("#ffffff");

		cache.resetUnitAssignments();
		// exactly two usable units: one albedo + one normal fills the pool, so a
		// second distinct normal map cannot fit and must force the wipe
		cache.max_size = 2;
		const before = lit._cacheEpoch;

		renderer.clearColor("#000000", true);
		renderer.setLightUniforms(undefined, undefined, 0, 0);
		lit.setLightUniforms({
			count: 1,
			positions: new Float32Array([SIZE / 2, SIZE / 2, SIZE * 4, 1]),
			colors: new Float32Array([0, 1, 0]),
			heights: new Float32Array([SIZE]),
			ambient: [0, 0, 0],
		});
		renderer.activeLightCount = 1;

		renderer.currentNormalMap = solid("rgb(128,128,255)");
		renderer.drawImage(albedo, 0, 0, 16, 16, 0, 0, SIZE, SIZE);
		// same albedo (a cache hit, allocating nothing), a DIFFERENT normal —
		// that claim is what runs the pool dry mid-quad
		renderer.currentNormalMap = solid("rgb(129,128,255)");
		renderer.drawImage(albedo, 0, 0, 16, 16, 0, 0, SIZE, SIZE);
		renderer.flush();
		renderer.currentNormalMap = null;
		renderer.activeLightCount = 0;

		// the wipe really happened, or this test proves nothing
		expect(lit._cacheEpoch).toBeGreaterThan(before);

		const px = new Uint8Array(4);
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		// a stale or collided id would sample the white albedo as a normal (81)
		expect(px[1]).toBeGreaterThan(120);

		cache.max_size = original;
		cache.resetUnitAssignments();
	});

	// The collision guard. Reservations can leave a single assignable slot, and
	// then the normal claims it and the color's re-resolve wipes and takes the
	// same one. Rather than sample the sprite's own albedo as a normal map — 81
	// instead of 141, wrong lighting with no error — the quad takes the unlit
	// path, which the shader signals with `vNormalTextureId < -0.5`.
	//
	// Unlit is `albedo * vertexColor`, so the WHITE albedo comes back white:
	// red 255. Both lit readings have red 0 (the light is pure green), which is
	// what makes the red channel an unambiguous discriminator here.
	it("falls back to unlit rather than let the two ids collide", (ctx) => {
		requireWebGL(ctx, renderer);
		const cache = renderer.cache;
		const original = cache.max_size;
		try {
			cache.resetUnitAssignments();
			cache.max_size = 2;
			cache.reserveUnit(1); // exactly one assignable slot left
			const px = drawLitBy(0, 1);
			expect(px[0]).toBeGreaterThan(200); // unlit: albedo passed through
			expect(px[1]).not.toBe(81); // and NOT the collided lit reading
		} finally {
			// restore in `finally`, or a failure here silently shrinks the pool
			// for every test that follows
			cache.releaseUnit(1);
			cache.max_size = original;
			cache.resetUnitAssignments();
		}
	});

	it("shades from a light at index 20 — past the old cap of 8", (ctx) => {
		requireWebGL(ctx, renderer);
		// under the previous `uniform vec4 uLightPos[8]` transport this slot
		// did not exist, and the loop could not have reached it either
		const px = drawLitBy(20, 21);
		expect(px[1]).toBeGreaterThan(40);
		expect(px[0]).toBeLessThan(20);
	});

	it("shades from the last slot the cap allows", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitBy(MAX_LIGHTS - 1, MAX_LIGHTS);
		expect(px[1]).toBeGreaterThan(40);
	});

	it("ignores a slot past the cap", (ctx) => {
		requireWebGL(ctx, renderer);
		// the clamp still holds: asking for MAX_LIGHTS + 1 must not read off
		// the end of the block into whatever the next binding point holds
		const px = drawLitBy(MAX_LIGHTS, MAX_LIGHTS + 1);
		expect(px[1]).toBeLessThan(20); // the coloured light was dropped
	});
});

/**
 * The 3D counterpart of the cap proof above.
 *
 * `LitMeshBatcher` gets far less example coverage than the quad path — of all
 * the in-tree examples only `night-city` passes `lit: true`, so the lit mesh
 * shader has one visual witness and it is a dark scene. These draw a real lit
 * quad mesh and read the framebuffer, which is the only way to show that the
 * GLSL loop reads the block at all, reaches past index 7, and stops at the cap.
 */
describe("lit mesh shading through Light3dBlock (issue #1552)", () => {
	let renderer;
	let gl;
	const SIZE = 64;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(SIZE, SIZE);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/**
	 * A directional light travelling along −Z, so `packMeshLights` stores
	 * surface→light as +Z — head-on to the quad's normal, making half-Lambert
	 * exactly 1 and the shaded colour exactly the light colour.
	 * @param {number[]} color - `[r, g, b]` in 0..1
	 * @returns {Light3d} the light
	 */
	const facingLight = (color) => {
		return new Light3d({
			type: "directional",
			direction: [0, 0, -1],
			color,
			intensity: 1,
		});
	};

	/**
	 * Draw a white lit quad filling the framebuffer under `lights`.
	 * @param {Light3d[]} lights - the stage's active 3D lights
	 * @returns {Uint8Array} the centre pixel, RGBA
	 */
	/**
	 * A white lit quad filling the framebuffer, facing the viewer.
	 * @returns {object} mesh-shaped input for `drawMesh`
	 */
	const litQuadMesh = () => {
		const canvas = document.createElement("canvas");
		canvas.width = 4;
		canvas.height = 4;
		const c2d = canvas.getContext("2d");
		c2d.fillStyle = "#ffffff";
		c2d.fillRect(0, 0, 4, 4);
		return {
			lit: true,
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
			// every vertex faces the viewer, so shading is uniform across the
			// quad and one sample speaks for the whole surface
			normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
			uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
			indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
			texture: renderer.cache.get(canvas),
			cullBackFaces: false,
			alphaCutoff: 0,
		};
	};

	const drawLitMesh = (lights) => {
		const proj = new Matrix3d();
		proj.ortho(0, SIZE, SIZE, 0, -1000, 1000);
		renderer.setProjection(proj);
		renderer.currentTint.setColor(255, 255, 255, 1);
		renderer.backgroundColor.setColor(0, 0, 0, 255);
		renderer.clear();

		const stage = state.current();
		const previous = stage._activeLights3d;
		stage._activeLights3d = new Set(lights);
		try {
			// Light data is uploaded on pass entry (`bind`), and `setBatcher`
			// early-returns when the batcher is already current — so two
			// back-to-back lit-mesh draws share one upload. A real frame
			// interleaves sprites and UI, which is what forces the switch;
			// reproduce that here or each test would shade with the previous
			// test's lights. (Pinned below as its own case.)
			renderer.setBatcher("quad");
			renderer.drawMesh(litQuadMesh());
			renderer.flush();
			gl.finish();
		} finally {
			stage._activeLights3d = previous;
		}

		const px = new Uint8Array(4);
		gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
		return px;
	};

	/**
	 * `n` black lights with a single green one at `index`.
	 * @param {number} index - the slot carrying the colour
	 * @param {number} n - how many lights in total
	 * @returns {Light3d[]} the light set
	 */
	const greenAt = (index, n) => {
		const lights = [];
		for (let i = 0; i < n; i++) {
			lights.push(facingLight(i === index ? [0, 1, 0] : [0, 0, 0]));
		}
		return lights;
	};

	it("shades from a light at index 0 (control)", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitMesh(greenAt(0, 1));
		expect(px[1]).toBeGreaterThan(200);
		// only green: a white pixel would mean the unlit MeshBatcher drew it
		expect(px[0]).toBeLessThan(30);
		expect(px[2]).toBeLessThan(30);
	});

	it("shades from a light at index 20 — past the old cap of 8", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitMesh(greenAt(20, 21));
		expect(px[1]).toBeGreaterThan(200);
		expect(px[0]).toBeLessThan(30);
	});

	it("shades from the last slot the cap allows", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitMesh(greenAt(MAX_LIGHTS - 1, MAX_LIGHTS));
		expect(px[1]).toBeGreaterThan(200);
		expect(px[0]).toBeLessThan(30);
	});

	it("drops a light past the cap rather than reading off the end", (ctx) => {
		requireWebGL(ctx, renderer);
		// the slot that would sit one stride past the block. Reading it would
		// pick up whatever the next binding point holds instead of erroring.
		const px = drawLitMesh(greenAt(MAX_LIGHTS, MAX_LIGHTS + 1));
		expect(px[1]).toBeLessThan(30);
	});

	it("accumulates two lights at different slots", (ctx) => {
		requireWebGL(ctx, renderer);
		// a stride error is invisible with one light — it only shows when a
		// second one has to be found 32 bytes further along
		const px = drawLitMesh([facingLight([1, 0, 0]), facingLight([0, 1, 0])]);
		expect(px[0]).toBeGreaterThan(200); // red from slot 0
		expect(px[1]).toBeGreaterThan(200); // green from slot 1
		expect(px[2]).toBeLessThan(30);
	});

	it("shades an ambient-only scene from the block's ambient", (ctx) => {
		requireWebGL(ctx, renderer);
		const px = drawLitMesh([
			new Light3d({ type: "ambient", color: [0, 0, 1], intensity: 1 }),
		]);
		// blue ambient, no directional: the fullbright fallback must not kick
		// in here or the quad would come out white
		expect(px[2]).toBeGreaterThan(200);
		expect(px[0]).toBeLessThan(30);
		expect(px[1]).toBeLessThan(30);
	});

	it("renders a lit mesh fullbright when the scene has no 3D lights", (ctx) => {
		requireWebGL(ctx, renderer);
		// the documented fallback: a `lit` mesh in a lightless scene should
		// look like the unlit path, not black
		const px = drawLitMesh([]);
		expect(px[0]).toBeGreaterThan(200);
		expect(px[1]).toBeGreaterThan(200);
		expect(px[2]).toBeGreaterThan(200);
	});

	it("picks up a light change between draws with no batcher switch", (ctx) => {
		requireWebGL(ctx, renderer);
		// The regression this guards: light data used to be uploaded in
		// `bind()`, and `WebGLRenderer.setBatcher` returns early when the
		// requested batcher is already current. A scene of nothing but lit
		// meshes therefore bound once and shaded every later frame with its
		// first frame's lights — moving a `Light3d` did nothing. Most scenes
		// escaped it because a sprite or an unlit mesh forces a switch, so it
		// hid behind whatever else happened to be on screen.
		//
		// Two consecutive lit-mesh draws with different lights and nothing in
		// between is the minimal shape of that scene.
		const stage = state.current();
		const previous = stage._activeLights3d;
		try {
			renderer.setBatcher("quad");
			const first = drawLitMesh([facingLight([0, 1, 0])]);
			expect(first[1]).toBeGreaterThan(200);
			expect(first[0]).toBeLessThan(30);

			// swap green for red and draw again, litMesh still current
			stage._activeLights3d = new Set([facingLight([1, 0, 0])]);
			renderer.drawMesh(litQuadMesh());
			renderer.flush();
			gl.finish();
			const px = new Uint8Array(4);
			gl.readPixels(SIZE / 2, SIZE / 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			expect(px[0]).toBeGreaterThan(200); // red now
			expect(px[1]).toBeLessThan(30); // and no longer green
		} finally {
			stage._activeLights3d = previous;
			renderer.setBatcher("quad");
		}
	});
});
