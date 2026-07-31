import { describe, expect, it } from "vitest";
import {
	isPortableTopology,
	isTopology,
	PORTABLE_TOPOLOGIES,
} from "../src/video/gpu/topology.ts";
import {
	isVertexFormat,
	resolveVertexFormat,
	VERTEX_FORMATS,
} from "../src/video/gpu/vertexformat.ts";

/**
 * The backend-neutral vocabulary (issue #1551).
 *
 * These tables are load-bearing in a way that fails quietly: `bytes` feeds
 * `Batcher.stride`, and a stride that is wrong by even one byte does not
 * throw — it makes every vertex read from the wrong offset, which renders as
 * garbage geometry rather than an error. So every entry is pinned explicitly
 * here rather than trusted to the derivation that produced it.
 *
 * No WebGL is needed: this tier deliberately holds no GL references, which is
 * what lets a non-WebGL backend consume it.
 */
describe("vertex format vocabulary (issue #1551)", () => {
	/**
	 * The full table, transcribed independently of the source's derivation.
	 * Written out longhand on purpose — deriving the expectation the same way
	 * the implementation derives it would pass whatever the implementation did.
	 * @type {Array<[string, number, number, boolean, string]>}
	 */
	const EXPECTED = [
		// format, components, bytes, normalized, scalar
		["float32", 1, 4, false, "float32"],
		["float32x2", 2, 8, false, "float32"],
		["float32x3", 3, 12, false, "float32"],
		["float32x4", 4, 16, false, "float32"],

		["uint8", 1, 1, false, "uint8"],
		["uint8x2", 2, 2, false, "uint8"],
		["uint8x4", 4, 4, false, "uint8"],
		["sint8", 1, 1, false, "sint8"],
		["sint8x2", 2, 2, false, "sint8"],
		["sint8x4", 4, 4, false, "sint8"],

		["unorm8", 1, 1, true, "unorm8"],
		["unorm8x2", 2, 2, true, "unorm8"],
		["unorm8x4", 4, 4, true, "unorm8"],
		["snorm8", 1, 1, true, "snorm8"],
		["snorm8x2", 2, 2, true, "snorm8"],
		["snorm8x4", 4, 4, true, "snorm8"],

		["uint16", 1, 2, false, "uint16"],
		["uint16x2", 2, 4, false, "uint16"],
		["uint16x4", 4, 8, false, "uint16"],
		["sint16", 1, 2, false, "sint16"],
		["sint16x2", 2, 4, false, "sint16"],
		["sint16x4", 4, 8, false, "sint16"],

		["unorm16", 1, 2, true, "unorm16"],
		["unorm16x2", 2, 4, true, "unorm16"],
		["unorm16x4", 4, 8, true, "unorm16"],
		["snorm16", 1, 2, true, "snorm16"],
		["snorm16x2", 2, 4, true, "snorm16"],
		["snorm16x4", 4, 8, true, "snorm16"],

		["uint32", 1, 4, false, "uint32"],
		["uint32x2", 2, 8, false, "uint32"],
		["uint32x3", 3, 12, false, "uint32"],
		["uint32x4", 4, 16, false, "uint32"],
		["sint32", 1, 4, false, "sint32"],
		["sint32x2", 2, 8, false, "sint32"],
		["sint32x3", 3, 12, false, "sint32"],
		["sint32x4", 4, 16, false, "sint32"],
	];

	describe("the table", () => {
		it.each(EXPECTED)(
			"%s resolves to %i components, %i bytes, normalized=%s",
			(format, components, bytes, normalized, scalar) => {
				const info = resolveVertexFormat(format);
				expect(info.components).toBe(components);
				expect(info.bytes).toBe(bytes);
				expect(info.normalized).toBe(normalized);
				expect(info.scalar).toBe(scalar);
			},
		);

		it("contains exactly the formats listed above, no more", () => {
			// a format present in the table but absent here would ship
			// unverified; one listed here but missing would throw above
			expect(Object.keys(VERTEX_FORMATS).sort()).toEqual(
				EXPECTED.map(([f]) => {
					return f;
				}).sort(),
			);
		});

		it("keeps bytes consistent with components for every entry", () => {
			// guards the derivation itself: bytes must be a whole multiple of
			// the component count, or the scalar size is wrong
			for (const [format, info] of Object.entries(VERTEX_FORMATS)) {
				expect(info.bytes % info.components, format).toBe(0);
				expect([1, 2, 4]).toContain(info.bytes / info.components);
			}
		});

		it("marks exactly the unorm/snorm formats as normalized", () => {
			for (const [format, info] of Object.entries(VERTEX_FORMATS)) {
				expect(info.normalized, format).toBe(
					format.startsWith("norm") ||
						format.startsWith("unorm") ||
						format.startsWith("snorm"),
				);
			}
		});
	});

	describe("excluded formats stay excluded", () => {
		// each of these was left out for a specific reason; a future change
		// that adds one must also handle its consequence, so make the absence
		// deliberate rather than incidental
		it.each([
			["float16", "needs HALF_FLOAT, and no vertex buffer view can write it"],
			["float16x2", "same"],
			["float16x4", "same"],
			["unorm10-10-10-2", "packed single word, breaks components × size"],
			["unorm8x4-bgra", "no WebGL equivalent, needs a shader swizzle"],
			["uint8x3", "no 8-bit x3 in the GPU vocabulary"],
			["unorm16x3", "no 16-bit x3 in the GPU vocabulary"],
		])("%s is not offered (%s)", (format) => {
			expect(isVertexFormat(format)).toBe(false);
		});
	});

	describe("isVertexFormat", () => {
		it("accepts every shipped format", () => {
			for (const format of Object.keys(VERTEX_FORMATS)) {
				expect(isVertexFormat(format), format).toBe(true);
			}
		});

		it.each([
			["FLOAT", "a GL enum name"],
			["float32x5", "an implausible component count"],
			["Float32x3", "wrong case"],
			[" float32x3", "leading space"],
			["", "empty string"],
		])("rejects %s (%s)", (value) => {
			expect(isVertexFormat(value)).toBe(false);
		});

		it.each([
			[5126, "a raw GL enum"],
			[undefined, "undefined"],
			[null, "null"],
			[{ format: "float32x3" }, "an object"],
			[["float32x3"], "an array"],
		])("rejects a non-string (%s)", (value) => {
			expect(isVertexFormat(value)).toBe(false);
		});

		it("is not fooled by inherited object properties", () => {
			// `"toString"` and friends are on Object.prototype; a naive `in`
			// check would accept them
			expect(isVertexFormat("toString")).toBe(false);
			expect(isVertexFormat("constructor")).toBe(false);
			expect(isVertexFormat("hasOwnProperty")).toBe(false);
		});
	});

	describe("resolveVertexFormat", () => {
		it("throws a named error for an unknown format", () => {
			expect(() => {
				resolveVertexFormat("float32x9");
			}).toThrow(/float32x9/);
		});

		it("lists the supported formats in the error, so the fix is obvious", () => {
			expect(() => {
				resolveVertexFormat("nope");
			}).toThrow(/float32x3/);
		});
	});
});

describe("topology vocabulary (issue #1551)", () => {
	const ALL = [
		"point-list",
		"line-list",
		"line-strip",
		"line-loop",
		"triangle-list",
		"triangle-strip",
		"triangle-fan",
	];

	it.each(ALL)("accepts %s", (topology) => {
		expect(isTopology(topology)).toBe(true);
	});

	it.each([
		["TRIANGLES", "a GL enum name"],
		["triangles", "the GL name lowercased"],
		["triangle_list", "underscore instead of hyphen"],
		["", "empty string"],
	])("rejects %s (%s)", (value) => {
		expect(isTopology(value)).toBe(false);
	});

	it.each([
		[4, "a raw GL enum"],
		[undefined, "undefined"],
		[null, "null"],
	])("rejects a non-string (%s)", (value) => {
		expect(isTopology(value)).toBe(false);
	});

	describe("portability", () => {
		it.each([
			"point-list",
			"line-list",
			"line-strip",
			"triangle-list",
			"triangle-strip",
		])("%s is portable", (topology) => {
			expect(isPortableTopology(topology)).toBe(true);
		});

		it.each(["line-loop", "triangle-fan"])(
			"%s is an engine extension a future backend must emulate",
			(topology) => {
				expect(isPortableTopology(topology)).toBe(false);
			},
		);

		it("keeps the portable set a strict subset of the accepted set", () => {
			for (const topology of PORTABLE_TOPOLOGIES) {
				expect(isTopology(topology), topology).toBe(true);
			}
			expect(PORTABLE_TOPOLOGIES.length).toBeLessThan(ALL.length);
		});
	});
});
