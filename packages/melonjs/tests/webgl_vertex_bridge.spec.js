import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { VERTEX_FORMATS } from "../src/video/gpu/vertexformat.ts";
import {
	resolveTopology,
	topologyFromGL,
} from "../src/video/webgl/utils/topology.js";
import {
	formatFromGL,
	glTypeForFormat,
} from "../src/video/webgl/utils/vertexformat.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * The WebGL side of the backend-neutral vocabulary (issue #1551).
 *
 * Needs a real context because the whole point is translating to and from
 * enums read off `gl` — a table checked against hard-coded numbers would pass
 * while disagreeing with the driver.
 */
describe("vertex format / topology GL bridge (issue #1551)", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
		gl = renderer?.gl;
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	describe("glTypeForFormat", () => {
		it("maps every format to the right component type", (ctx) => {
			requireWebGL(ctx, renderer);
			const expected = {
				float32: gl.FLOAT,
				uint8: gl.UNSIGNED_BYTE,
				unorm8: gl.UNSIGNED_BYTE,
				sint8: gl.BYTE,
				snorm8: gl.BYTE,
				uint16: gl.UNSIGNED_SHORT,
				unorm16: gl.UNSIGNED_SHORT,
				sint16: gl.SHORT,
				snorm16: gl.SHORT,
				uint32: gl.UNSIGNED_INT,
				sint32: gl.INT,
			};
			for (const [format, info] of Object.entries(VERTEX_FORMATS)) {
				expect(glTypeForFormat(gl, format), format).toBe(expected[info.scalar]);
			}
		});

		it("throws for an unknown format rather than returning undefined", (ctx) => {
			requireWebGL(ctx, renderer);
			// returning undefined would reach vertexAttribPointer and raise
			// INVALID_ENUM far from the cause
			expect(() => {
				glTypeForFormat(gl, "float32x9");
			}).toThrow(/float32x9/);
		});
	});

	describe("formatFromGL", () => {
		it("round-trips every format back to its own name", (ctx) => {
			requireWebGL(ctx, renderer);
			// the strongest check available: a wrong entry in either direction
			// breaks the identity
			for (const [format, info] of Object.entries(VERTEX_FORMATS)) {
				const back = formatFromGL(
					gl,
					info.components,
					glTypeForFormat(gl, format),
					info.normalized,
				);
				expect(back, format).toBe(format);
			}
		});

		// `it.for` rather than `it.each`: only `for` passes the test context, and
		// without it the WebGL guard below would be a no-op that throws on a
		// machine with no GL instead of skipping.
		it.for([
			[3, "UNSIGNED_BYTE", false],
			[3, "UNSIGNED_BYTE", true],
			[3, "BYTE", false],
			[3, "UNSIGNED_SHORT", true],
			[3, "SHORT", false],
		])(
			"returns undefined for %i x %s (normalized=%s), which has no portable name",
			([size, typeName, normalized], ctx) => {
				requireWebGL(ctx, renderer);
				// deliberately unnamed — inventing one would travel into a
				// backend that cannot honour it
				expect(
					formatFromGL(gl, size, gl[typeName], normalized),
				).toBeUndefined();
			},
		);

		it("names FLOAT with normalized:true rather than giving up", (ctx) => {
			requireWebGL(ctx, renderer);
			// WebGL accepts and ignores the flag on FLOAT; there is no
			// float32-normalized spelling, so the name keys off type and size
			expect(formatFromGL(gl, 3, gl.FLOAT, true)).toBe("float32x3");
			expect(formatFromGL(gl, 1, gl.FLOAT, true)).toBe("float32");
		});

		it("distinguishes normalized from plain integer types", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(formatFromGL(gl, 4, gl.UNSIGNED_BYTE, true)).toBe("unorm8x4");
			expect(formatFromGL(gl, 4, gl.UNSIGNED_BYTE, false)).toBe("uint8x4");
			expect(formatFromGL(gl, 2, gl.SHORT, true)).toBe("snorm16x2");
			expect(formatFromGL(gl, 2, gl.SHORT, false)).toBe("sint16x2");
		});

		it("ignores the normalized flag on 32-bit integers", (ctx) => {
			requireWebGL(ctx, renderer);
			// there is no unorm32; both spellings resolve to the plain type
			expect(formatFromGL(gl, 2, gl.UNSIGNED_INT, true)).toBe("uint32x2");
			expect(formatFromGL(gl, 2, gl.UNSIGNED_INT, false)).toBe("uint32x2");
		});

		it("returns undefined for a type it does not know", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(formatFromGL(gl, 4, gl.HALF_FLOAT, false)).toBeUndefined();
			expect(formatFromGL(gl, 4, 0, false)).toBeUndefined();
		});

		it("returns undefined for an out-of-range component count", (ctx) => {
			requireWebGL(ctx, renderer);
			for (const size of [0, 5, 8]) {
				expect(
					formatFromGL(gl, size, gl.FLOAT, false),
					`size ${size}`,
				).toBeUndefined();
			}
		});
	});

	describe("resolveTopology", () => {
		it.for([
			["point-list", "POINTS"],
			["line-list", "LINES"],
			["line-strip", "LINE_STRIP"],
			["line-loop", "LINE_LOOP"],
			["triangle-list", "TRIANGLES"],
			["triangle-strip", "TRIANGLE_STRIP"],
			["triangle-fan", "TRIANGLE_FAN"],
		])("maps %s to gl.%s", ([topology, glName], ctx) => {
			requireWebGL(ctx, renderer);
			expect(resolveTopology(gl, topology)).toBe(gl[glName]);
		});

		it("passes GL enums through untouched", (ctx) => {
			requireWebGL(ctx, renderer);
			for (const name of [
				"POINTS",
				"LINES",
				"LINE_STRIP",
				"LINE_LOOP",
				"TRIANGLES",
				"TRIANGLE_STRIP",
				"TRIANGLE_FAN",
			]) {
				expect(resolveTopology(gl, gl[name]), name).toBe(gl[name]);
			}
		});

		it("never returns POINTS for a valid non-point topology", (ctx) => {
			requireWebGL(ctx, renderer);
			// the failure this design exists to prevent: a string that slips
			// through untranslated coerces to 0, which is POINTS
			for (const topology of [
				"line-list",
				"line-strip",
				"line-loop",
				"triangle-list",
				"triangle-strip",
				"triangle-fan",
			]) {
				expect(resolveTopology(gl, topology), topology).not.toBe(gl.POINTS);
			}
		});

		it("throws for an unrecognised string instead of silently drawing points", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(() => {
				resolveTopology(gl, "triangles");
			}).toThrow(/triangles/);
			expect(() => {
				resolveTopology(gl, "");
			}).toThrow();
		});
	});

	describe("topologyFromGL", () => {
		it("round-trips every topology", (ctx) => {
			requireWebGL(ctx, renderer);
			for (const topology of [
				"point-list",
				"line-list",
				"line-strip",
				"line-loop",
				"triangle-list",
				"triangle-strip",
				"triangle-fan",
			]) {
				expect(topologyFromGL(gl, resolveTopology(gl, topology))).toBe(
					topology,
				);
			}
		});

		it("returns undefined for a mode it does not know", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(topologyFromGL(gl, 0x9999)).toBeUndefined();
		});
	});
});
