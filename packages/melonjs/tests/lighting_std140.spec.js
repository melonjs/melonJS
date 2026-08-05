import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_LIGHTS } from "../src/video/webgl/lighting/constants.ts";
import {
	BLOCK_BYTES,
	BLOCK_FLOATS,
	BLOCK3D_FLOATS,
	HEADER_FLOATS,
	LIGHT_FLOATS,
	LIGHT3D_FLOATS,
	writeLight2dBlock,
	writeLight3dBlock,
} from "../src/video/webgl/lighting/std140.ts";
import litMeshFragment from "../src/video/webgl/shaders/mesh-lit.frag";
import litMeshVertex from "../src/video/webgl/shaders/mesh-lit.vert";
import { buildLitMultiTextureFragment } from "../src/video/webgl/shaders/multitexture-lit.js";
import quadLitVertex from "../src/video/webgl/shaders/quad-multi-lit.vert";
import { setPrecision } from "../src/video/webgl/utils/precision.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * std140 layout for the light blocks (issue #1552).
 *
 * This is the file that has to be paranoid. A std140 mistake does not throw
 * and does not fail to upload — the shader reads whatever is at the offset it
 * computed, so every light after a mislaid byte is simply shifted. The result
 * renders *subtly* wrong: slightly off colours, a light in not-quite the right
 * place, a height that is actually somebody's blue channel. Nothing in the
 * pipeline complains.
 *
 * So every offset below is written out **by hand**, in absolute float indices,
 * rather than derived from the same constants the writer uses. Deriving them
 * would make the test agree with the implementation by construction and pass
 * whatever it did.
 */
/**
 * A staging buffer the size of one light block. Local to the spec rather than
 * imported: the batchers write straight into `UniformBlock.data`, so a factory
 * in `src` would exist only for these tests.
 * @returns {Float32Array} a zero-filled block-sized buffer
 */
const createLightBlockScratch = () => {
	return new Float32Array(BLOCK_FLOATS);
};

describe("std140 light block layout (issue #1552)", () => {
	// ── the layout, restated independently ──────────────────────────────
	//
	//   float 0     count            (int, read back with int())
	//   float 1-3   padding          (a vec3 aligns to 16, cannot share)
	//   float 4-6   ambient rgb
	//   float 7     padding
	//   float 8     first light, component 0
	//
	// per light:
	//   2D, 8 floats:  [x, y, radius, intensity]  [r, g, b, height]
	//   3D, 12 floats: [px, py, pz, range]  [dx, dy, dz, cosOuter]
	//                  [r, g, b, cosInner]  (range -1 = directional,
	//                  cosOuter -1 = no cone)
	const COUNT = 0;
	const AMBIENT = 4;
	const FIRST_LIGHT = 8;
	const PER_LIGHT = 8;
	const PER_LIGHT3D = 12;

	describe("the constants themselves", () => {
		it("puts the first light at float 8, not float 4", () => {
			// the trap: `int count` is 4 bytes, so a naive layout would start
			// ambient at float 1 and the lights at float 4. std140 aligns the
			// following vec3 to 16 bytes, so both get pushed out.
			expect(HEADER_FLOATS).toBe(FIRST_LIGHT);
		});

		it("spends 8 floats per light, not 7", () => {
			// 4 (position) + 3 (colour) + 1 (height) = 8 values, but only
			// because height rides in the padding the vec3 colour reserved.
			// Any other arrangement costs 12.
			expect(LIGHT_FLOATS).toBe(PER_LIGHT);
		});

		it("sizes the block for the full cap", () => {
			expect(BLOCK_FLOATS).toBe(FIRST_LIGHT + MAX_LIGHTS * PER_LIGHT);
			expect(BLOCK_BYTES).toBe(BLOCK_FLOATS * 4);
		});

		it("keeps every vec4 boundary 16-byte aligned", () => {
			// the whole point of std140: each light must start on a multiple
			// of 16 bytes or the driver reads it from somewhere else
			for (let i = 0; i < MAX_LIGHTS; i++) {
				const byteOffset = (HEADER_FLOATS + i * LIGHT_FLOATS) * 4;
				expect(byteOffset % 16, `light ${i}`).toBe(0);
			}
			expect(BLOCK_BYTES % 16).toBe(0);
		});

		it("stays inside the guaranteed minimum uniform block size", () => {
			// WebGL 2 guarantees at least 16 KB. If a future cap bump breaks
			// this, the block silently fails to link on conforming hardware.
			expect(BLOCK_BYTES).toBeLessThanOrEqual(16384);
		});
	});

	describe("2D light block", () => {
		/**
		 * Build packed 2D data with recognisably distinct values, so a
		 * misplaced field shows up as the wrong number rather than a
		 * plausible one.
		 * @param {number} n - how many lights
		 * @returns {object} packed light data
		 */
		const packed2d = (n) => {
			const positions = new Float32Array(MAX_LIGHTS * 4);
			const colors = new Float32Array(MAX_LIGHTS * 3);
			const heights = new Float32Array(MAX_LIGHTS);
			for (let i = 0; i < n; i++) {
				positions[i * 4] = 100 + i;
				positions[i * 4 + 1] = 200 + i;
				positions[i * 4 + 2] = 300 + i;
				positions[i * 4 + 3] = 400 + i;
				colors[i * 3] = 500 + i;
				colors[i * 3 + 1] = 600 + i;
				colors[i * 3 + 2] = 700 + i;
				heights[i] = 800 + i;
			}
			return { count: n, positions, colors, heights, ambient: [11, 22, 33] };
		};

		it("writes the header at hand-computed offsets", () => {
			const out = createLightBlockScratch();
			writeLight2dBlock(out, packed2d(1));
			expect(out[COUNT]).toBe(1);
			expect(out[AMBIENT]).toBe(11);
			expect(out[AMBIENT + 1]).toBe(22);
			expect(out[AMBIENT + 2]).toBe(33);
		});

		it("leaves the alignment padding zeroed", () => {
			// floats 1-3 and 7 exist only to satisfy alignment. Garbage there
			// is harmless today but would be read as data by any future member
			// added to the header.
			const out = createLightBlockScratch();
			out.fill(999);
			writeLight2dBlock(out, packed2d(1));
			expect(out[1]).toBe(0);
			expect(out[2]).toBe(0);
			expect(out[3]).toBe(0);
			expect(out[7]).toBe(0);
		});

		it("places every field of the first light exactly", () => {
			const out = createLightBlockScratch();
			writeLight2dBlock(out, packed2d(1));
			expect(out[FIRST_LIGHT]).toBe(100); // x
			expect(out[FIRST_LIGHT + 1]).toBe(200); // y
			expect(out[FIRST_LIGHT + 2]).toBe(300); // radius
			expect(out[FIRST_LIGHT + 3]).toBe(400); // intensity
			expect(out[FIRST_LIGHT + 4]).toBe(500); // r
			expect(out[FIRST_LIGHT + 5]).toBe(600); // g
			expect(out[FIRST_LIGHT + 6]).toBe(700); // b
			expect(out[FIRST_LIGHT + 7]).toBe(800); // height, in the padding slot
		});

		it("places the Nth light at 8 + 8N, for every slot", () => {
			// an off-by-one in the stride shows up only from the second light
			// on, which is exactly the bug a single-light test cannot see
			const out = createLightBlockScratch();
			writeLight2dBlock(out, packed2d(MAX_LIGHTS));
			for (let i = 0; i < MAX_LIGHTS; i++) {
				const o = FIRST_LIGHT + i * PER_LIGHT;
				expect(out[o], `light ${i} x`).toBe(100 + i);
				expect(out[o + 3], `light ${i} intensity`).toBe(400 + i);
				expect(out[o + 7], `light ${i} height`).toBe(800 + i);
			}
		});

		it("returns only the live prefix length", () => {
			const out = createLightBlockScratch();
			expect(writeLight2dBlock(out, packed2d(0))).toBe(FIRST_LIGHT);
			expect(writeLight2dBlock(out, packed2d(1))).toBe(FIRST_LIGHT + 8);
			expect(writeLight2dBlock(out, packed2d(3))).toBe(FIRST_LIGHT + 24);
			expect(writeLight2dBlock(out, packed2d(MAX_LIGHTS))).toBe(BLOCK_FLOATS);
		});

		it("never writes past the live prefix", () => {
			// the shader reads only `count` lights, but a writer that ran long
			// would corrupt the next frame's partial upload
			const out = createLightBlockScratch();
			out.fill(-1);
			const used = writeLight2dBlock(out, packed2d(2));
			for (let i = used; i < BLOCK_FLOATS; i++) {
				expect(out[i], `float ${i} past the prefix`).toBe(-1);
			}
		});

		it("clamps a count that exceeds the cap", () => {
			const out = createLightBlockScratch();
			const over = packed2d(MAX_LIGHTS);
			over.count = MAX_LIGHTS + 10;
			expect(writeLight2dBlock(out, over)).toBe(BLOCK_FLOATS);
			expect(out[COUNT]).toBe(MAX_LIGHTS);
		});

		it("writes a valid header for zero lights", () => {
			// the common case: every frame of a scene with no lights
			const out = createLightBlockScratch();
			const used = writeLight2dBlock(out, packed2d(0));
			expect(out[COUNT]).toBe(0);
			expect(used).toBe(FIRST_LIGHT);
		});

		it("tolerates a short ambient array", () => {
			const out = createLightBlockScratch();
			writeLight2dBlock(out, { ...packed2d(1), ambient: [] });
			expect(out[AMBIENT]).toBe(0);
			expect(out[AMBIENT + 1]).toBe(0);
			expect(out[AMBIENT + 2]).toBe(0);
		});

		it("does not confuse the colour and position vectors", () => {
			// the failure a stride bug actually produces: colour read from the
			// position slot. Distinct value ranges make it unmistakable.
			const out = createLightBlockScratch();
			writeLight2dBlock(out, packed2d(MAX_LIGHTS));
			for (let i = 0; i < MAX_LIGHTS; i++) {
				const o = FIRST_LIGHT + i * PER_LIGHT;
				expect(out[o], `light ${i}`).toBeLessThan(200);
				expect(out[o + 4], `light ${i} colour`).toBeGreaterThanOrEqual(500);
			}
		});
	});

	describe("3D light block", () => {
		const scratch3d = () => {
			return new Float32Array(BLOCK3D_FLOATS);
		};

		/**
		 * @param {number} n - how many lights
		 * @returns {object} packed mesh light data (writer shape)
		 */
		const packed3d = (n) => {
			const posRange = new Float32Array(MAX_LIGHTS * 4);
			const dirCone = new Float32Array(MAX_LIGHTS * 4);
			const colorInner = new Float32Array(MAX_LIGHTS * 4);
			for (let i = 0; i < n; i++) {
				posRange.set([10 + i, 20 + i, 30 + i, 100 + i], i * 4);
				dirCone.set([40 + i, 50 + i, 60 + i, 0.5], i * 4);
				colorInner.set([70 + i, 80 + i, 90 + i, 0.9], i * 4);
			}
			return {
				count: n,
				posRange,
				dirCone,
				colorInner,
				ambient: new Float32Array([7, 8, 9]),
			};
		};

		it("spends 12 floats per 3D light and sizes the block for the cap", () => {
			expect(LIGHT3D_FLOATS).toBe(12);
			expect(BLOCK3D_FLOATS).toBe(HEADER_FLOATS + MAX_LIGHTS * 12);
		});

		it("shares the header layout with the 2D block", () => {
			// both blocks are read by the same helper on the JS side, so a
			// divergence here would only show up in one of the two shaders
			const out = scratch3d();
			writeLight3dBlock(out, packed3d(2));
			expect(out[COUNT]).toBe(2);
			expect(out[AMBIENT]).toBe(7);
			expect(out[AMBIENT + 2]).toBe(9);
			expect(out[1]).toBe(0);
			expect(out[7]).toBe(0);
		});

		it("places every field of the first light at hand-computed offsets", () => {
			const out = scratch3d();
			writeLight3dBlock(out, packed3d(1));
			// posRange
			expect(out[FIRST_LIGHT]).toBe(10);
			expect(out[FIRST_LIGHT + 1]).toBe(20);
			expect(out[FIRST_LIGHT + 2]).toBe(30);
			expect(out[FIRST_LIGHT + 3]).toBe(100);
			// dirCone
			expect(out[FIRST_LIGHT + 4]).toBe(40);
			expect(out[FIRST_LIGHT + 5]).toBe(50);
			expect(out[FIRST_LIGHT + 6]).toBe(60);
			expect(out[FIRST_LIGHT + 7]).toBeCloseTo(0.5);
			// colorInner
			expect(out[FIRST_LIGHT + 8]).toBe(70);
			expect(out[FIRST_LIGHT + 9]).toBe(80);
			expect(out[FIRST_LIGHT + 10]).toBe(90);
			expect(out[FIRST_LIGHT + 11]).toBeCloseTo(0.9);
		});

		it("strides by 12 floats for every slot", () => {
			const out = scratch3d();
			writeLight3dBlock(out, packed3d(MAX_LIGHTS));
			for (let i = 0; i < MAX_LIGHTS; i++) {
				const o = FIRST_LIGHT + i * PER_LIGHT3D;
				expect(out[o], `light ${i} px`).toBe(10 + i);
				expect(out[o + 4], `light ${i} dx`).toBe(40 + i);
				expect(out[o + 8], `light ${i} r`).toBe(70 + i);
			}
		});

		it("returns the live prefix and writes no further", () => {
			const out = scratch3d();
			out.fill(-1);
			const used = writeLight3dBlock(out, packed3d(3));
			expect(used).toBe(FIRST_LIGHT + 3 * PER_LIGHT3D);
			for (let i = used; i < BLOCK3D_FLOATS; i++) {
				expect(out[i], `float ${i}`).toBe(-1);
			}
		});
	});

	describe("reuse across frames", () => {
		it("does not leak a previous frame's light into the live range", () => {
			// the scratch buffer is reused every frame. Dropping from 4 lights
			// to 1 must not leave light 1 readable — `count` protects the
			// shader, but a later count increase would resurrect stale data.
			const out = createLightBlockScratch();
			const many = {
				count: 4,
				positions: new Float32Array(MAX_LIGHTS * 4).fill(7),
				colors: new Float32Array(MAX_LIGHTS * 3).fill(7),
				heights: new Float32Array(MAX_LIGHTS).fill(7),
				ambient: [0, 0, 0],
			};
			writeLight2dBlock(out, many);
			expect(out[FIRST_LIGHT + PER_LIGHT]).toBe(7);

			const few = { ...many, count: 1 };
			const used = writeLight2dBlock(out, few);
			expect(out[COUNT]).toBe(1);
			// stale bytes sit beyond the uploaded prefix, so the GPU never
			// sees them — pin that the prefix really does exclude them
			expect(used).toBe(FIRST_LIGHT + PER_LIGHT);
			expect(FIRST_LIGHT + PER_LIGHT).toBeLessThanOrEqual(used);
		});
	});
});

/**
 * The hand-written layout above states what we *believe* std140 does. This
 * suite asks the driver what it actually did.
 *
 * `getActiveUniforms(..., UNIFORM_OFFSET)` reports the byte offset the GLSL
 * compiler assigned to each block member, and `UNIFORM_BLOCK_DATA_SIZE` the
 * total it reserved. If our writer and the shader ever disagree — a member
 * reordered, a scalar promoted to a vec3, an array stride changed — these
 * numbers move and nothing else in the engine would notice.
 *
 * These run against the shaders as the batchers build them, not against a
 * simplified stand-in, so a change to either declaration is caught.
 */
describe("std140 light block — driver-reported layout (issue #1552)", () => {
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
	 * Compile, link, and report the block's size and member offsets.
	 * @param {string} vertexSource - vertex stage
	 * @param {string} fragmentSource - fragment stage
	 * @param {string} blockName - the std140 block to inspect
	 * @param {string[]} members - fully-qualified member names to locate
	 * @returns {{size: number, offsets: number[]}} bytes, and one offset per member
	 */
	const inspect = (vertexSource, fragmentSource, blockName, members) => {
		const build = (type, src) => {
			const sh = gl.createShader(type);
			gl.shaderSource(sh, setPrecision(src, "highp"));
			gl.compileShader(sh);
			// surfaced as the assertion message rather than a bare `false`
			expect(gl.getShaderInfoLog(sh)).toBe("");
			return sh;
		};
		const program = gl.createProgram();
		gl.attachShader(program, build(gl.VERTEX_SHADER, vertexSource));
		gl.attachShader(program, build(gl.FRAGMENT_SHADER, fragmentSource));
		gl.linkProgram(program);
		expect(gl.getProgramInfoLog(program)).toBe("");

		const blockIndex = gl.getUniformBlockIndex(program, blockName);
		expect(blockIndex).not.toBe(gl.INVALID_INDEX);
		const size = gl.getActiveUniformBlockParameter(
			program,
			blockIndex,
			gl.UNIFORM_BLOCK_DATA_SIZE,
		);
		const indices = gl.getUniformIndices(program, members);
		const offsets = gl.getActiveUniforms(program, indices, gl.UNIFORM_OFFSET);
		gl.deleteProgram(program);
		return { size, offsets };
	};

	it("Light2dBlock matches the writer byte for byte", (ctx) => {
		requireWebGL(ctx, renderer);
		const { size, offsets } = inspect(
			quadLitVertex,
			buildLitMultiTextureFragment(8),
			"Light2dBlock",
			[
				"uLightCount",
				"uAmbient",
				"uLights[0].posRadiusIntensity",
				"uLights[0].colorHeight",
				"uLights[1].posRadiusIntensity",
			],
		);
		expect(size).toBe(BLOCK_BYTES);
		// count at 0; ambient at 16 (a vec3 aligns to 16, so it cannot share
		// the scalar's slot); lights start at 32 and stride 32
		expect(offsets).toEqual([0, 16, 32, 48, 64]);
	});

	it("Light3dBlock matches the writer byte for byte", (ctx) => {
		requireWebGL(ctx, renderer);
		const { size, offsets } = inspect(
			litMeshVertex,
			litMeshFragment.replaceAll("__MAX_LIGHTS__", String(MAX_LIGHTS)),
			"Light3dBlock",
			[
				"uLightCount",
				"uAmbient",
				"uLights[0].posRange",
				"uLights[0].dirCone",
				"uLights[0].colorInner",
				"uLights[1].posRange",
			],
		);
		expect(size).toBe(BLOCK3D_FLOATS * Float32Array.BYTES_PER_ELEMENT);
		expect(offsets).toEqual([0, 16, 32, 48, 64, 80]);
	});

	it("the last light fits inside the block the driver reserved", (ctx) => {
		requireWebGL(ctx, renderer);
		// the off-by-one that would corrupt a neighbouring binding point:
		// writing MAX_LIGHTS lights must land entirely within the block
		const { offsets } = inspect(
			quadLitVertex,
			buildLitMultiTextureFragment(8),
			"Light2dBlock",
			[`uLights[${MAX_LIGHTS - 1}].colorHeight`],
		);
		const lastMemberEnd = offsets[0] + 4 * Float32Array.BYTES_PER_ELEMENT;
		expect(lastMemberEnd).toBe(BLOCK_BYTES);

		// and the writer agrees about where that light's floats go
		const out = createLightBlockScratch();
		const live = writeLight2dBlock(out, {
			count: MAX_LIGHTS,
			positions: new Float32Array(MAX_LIGHTS * 4).fill(1),
			colors: new Float32Array(MAX_LIGHTS * 3).fill(1),
			heights: new Float32Array(MAX_LIGHTS).fill(1),
			ambient: [0, 0, 0],
		});
		expect(live).toBe(BLOCK_FLOATS);
		expect(live * Float32Array.BYTES_PER_ELEMENT).toBe(BLOCK_BYTES);
	});
});
