import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebGLBatcher } from "../src/index.js";
import {
	getWebGLRenderer,
	releaseWebGLRenderer,
	requireWebGL,
} from "./helpers/webgl-context.js";

/**
 * `Batcher.addAttribute` accepting both vocabularies (issue #1551).
 *
 * The GL form is public API with an out-of-tree consumer, so it is tested
 * here as thoroughly as the new one — every supported component type, every
 * component count, both normalization settings. A mistake in either path
 * changes `stride`, and a wrong stride does not throw: it makes every vertex
 * read from the wrong offset, which renders as garbage rather than an error.
 */
describe("Batcher attribute vocabulary (issue #1551)", () => {
	let renderer;
	let gl;

	beforeAll(async () => {
		renderer = await getWebGLRenderer(64, 64);
		gl = renderer?.gl;
	});

	beforeAll(() => {
		if (renderer !== undefined) {
			scratch = build([{ name: "aVertex", format: "float32x3", offset: 0 }]);
		}
	});

	afterAll(() => {
		releaseWebGLRenderer();
	});

	/** minimal shader so a Batcher can be constructed at all */
	const SHADER = {
		vertex:
			"attribute vec4 aTest;\nattribute vec4 aPad;\nattribute vec4 aPad1;\nattribute vec4 aPad2;\nattribute vec4 a;\nattribute vec4 b;\nattribute vec4 aVertex;\nattribute vec4 aRegion;\nattribute vec4 aColor;\nattribute vec4 aId;\nattribute vec4 aExtra;\nattribute vec4 aBad;\nvoid main(void) { gl_Position = vec4(0.0); }",
		fragment: "void main(void) {}",
	};

	/**
	 * Build a batcher from a layout, in whichever vocabulary the caller wrote.
	 * @param {Array<object>} attributes - layout descriptors
	 * @returns {Batcher} the constructed batcher
	 */
	const build = (attributes) => {
		return new WebGLBatcher(renderer, { attributes, shader: SHADER });
	};

	/**
	 * A single reusable batcher for the table-driven cases below.
	 *
	 * Constructing one compiles a shader program and allocates a vertex array
	 * and buffers, and nothing frees them — building one per case left ~80
	 * live programs in the shared context, which is enough to starve a
	 * software renderer late in a CI run. `addAttribute` only needs a real
	 * `Batcher` because it calls private methods, so reuse one and reset the
	 * layout between cases.
	 * @type {Batcher}
	 */
	let scratch;

	/**
	 * Reset the reusable batcher to an empty, unfrozen layout.
	 * @returns {Batcher} the scratch batcher
	 */
	const blank = () => {
		scratch.attributes.length = 0;
		scratch.stride = 0;
		scratch.vertexSize = 0;
		scratch.vertexState = null;
		return scratch;
	};

	// component type, bytes per component, and the neutral names it maps to
	// when plain / when normalized. `null` = no portable name exists.
	const GL_TYPES = [
		["BYTE", 1, "sint8", "snorm8"],
		["UNSIGNED_BYTE", 1, "uint8", "unorm8"],
		["SHORT", 2, "sint16", "snorm16"],
		["UNSIGNED_SHORT", 2, "uint16", "unorm16"],
		["INT", 4, "sint32", "sint32"],
		["UNSIGNED_INT", 4, "uint32", "uint32"],
		["FLOAT", 4, "float32", "float32"],
	];

	describe("the GL form — every type, every component count", () => {
		it.for(
			GL_TYPES.flatMap(([typeName, perComponent, plain, norm]) => {
				return [1, 2, 3, 4].flatMap((size) => {
					return [false, true].map((normalized) => {
						return [
							typeName,
							size,
							normalized,
							perComponent,
							normalized ? norm : plain,
						];
					});
				});
			}),
		)(
			"%s x%i (normalized=%s) contributes the right stride",
			([typeName, size, normalized, perComponent, scalar], ctx) => {
				requireWebGL(ctx, renderer);
				// 32-bit types must land on a 4-byte boundary for the buffer's
				// float-indexed writes; pad the layout when they would not
				const batcher = blank();
				batcher.addAttribute({
					name: "aTest",
					size,
					type: gl[typeName],
					normalized,
					offset: 0,
				});

				const record = batcher.attributes[0];
				expect(record.size).toBe(size);
				expect(record.type).toBe(gl[typeName]);
				expect(record.normalized).toBe(normalized);
				expect(record.offset).toBe(0);

				// the attribute's own contribution, independent of any padding
				expect(record.bytes).toBe(size * perComponent);

				// a portable name is derived where one exists; 8- and 16-bit
				// x3 have none and must stay undefined rather than invented
				const expectedFormat = size === 1 ? scalar : `${scalar}x${size}`;
				const portable = !(size === 3 && perComponent !== 4);
				expect(record.format).toBe(portable ? expectedFormat : undefined);
			},
		);

		it("rejects an unrecognised GL type with the original message", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(() => {
				build([
					{ name: "aBad", size: 4, type: 0x9999, normalized: false, offset: 0 },
				]);
			}).toThrow(/Invalid GL Attribute type/);
		});

		it("still accepts the five-argument positional call", (ctx) => {
			requireWebGL(ctx, renderer);
			// the documented public signature; nothing may require the object form
			const batcher = build([
				{
					name: "aVertex",
					size: 3,
					type: gl.FLOAT,
					normalized: false,
					offset: 0,
				},
			]);
			batcher.vertexState = null; // pretend the layout is not yet frozen
			expect(() => {
				batcher.addAttribute("aExtra", 1, gl.FLOAT, false, 12);
			}).not.toThrow();
			expect(batcher.stride).toBe(16);
		});
	});

	describe("the two vocabularies agree", () => {
		it.for([
			[["float32x3", 3, "FLOAT", false]],
			[["float32x2", 2, "FLOAT", false]],
			[["float32", 1, "FLOAT", false]],
			[["unorm8x4", 4, "UNSIGNED_BYTE", true]],
			[["uint8x4", 4, "UNSIGNED_BYTE", false]],
			[["snorm16x2", 2, "SHORT", true]],
			[["sint32x4", 4, "INT", false]],
			[["uint32x2", 2, "UNSIGNED_INT", false]],
		])(
			"%s produces the same record as its GL spelling",
			([[format, size, typeName, normalized]], ctx) => {
				requireWebGL(ctx, renderer);
				blank().addAttribute({ name: "a", format, offset: 0 });
				const viaFormat = {
					record: scratch.attributes[0],
					stride: scratch.stride,
				};
				blank().addAttribute({
					name: "a",
					size,
					type: gl[typeName],
					normalized,
					offset: 0,
				});
				expect(viaFormat.record).toEqual(scratch.attributes[0]);
				expect(viaFormat.stride).toBe(scratch.stride);
			},
		);

		it("accepts both vocabularies mixed in one layout", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([
				{ name: "aVertex", format: "float32x3", offset: 0 },
				{
					name: "aRegion",
					size: 2,
					type: gl.FLOAT,
					normalized: false,
					offset: 12,
				},
				{ name: "aColor", format: "unorm8x4", offset: 20 },
				{ name: "aId", size: 1, type: gl.FLOAT, normalized: false, offset: 24 },
			]);
			expect(batcher.stride).toBe(28);
			expect(
				batcher.attributes.map((a) => {
					return a.format;
				}),
			).toEqual(["float32x3", "float32x2", "unorm8x4", "float32"]);
		});

		it("accepts the positional (name, format, offset) form", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", format: "float32x3", offset: 0 }]);
			batcher.vertexState = null; // unfreeze so more can be added
			batcher.addAttribute("b", "unorm8x4", 12);
			const record = batcher.attributes[1];
			expect(record.name).toBe("b");
			expect(record.format).toBe("unorm8x4");
			expect(record.size).toBe(4);
			expect(record.type).toBe(gl.UNSIGNED_BYTE);
			expect(record.normalized).toBe(true);
			expect(record.offset).toBe(12);
			expect(batcher.stride).toBe(16);
		});

		it("packs the positional form tightly when the offset is omitted", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", format: "float32x3", offset: 0 }]);
			batcher.vertexState = null;
			batcher.addAttribute("b", "float32");
			expect(batcher.attributes[1].offset).toBe(12);
		});

		it("rejects a non-numeric offset in the positional form", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", format: "float32x4", offset: 0 }]);
			batcher.vertexState = null;
			expect(() => {
				batcher.addAttribute("b", "float32x4", "16");
			}).toThrow(/offset must be a number/);
		});

		it("accepts a format string in the type field as a migration alias", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", type: "float32x3", offset: 0 }]);
			// no string may survive into the record: one reaching
			// vertexAttribPointer coerces to 0 and raises INVALID_ENUM
			expect(typeof batcher.attributes[0].type).toBe("number");
			expect(batcher.attributes[0].type).toBe(gl.FLOAT);
			expect(batcher.stride).toBe(12);
		});
	});

	describe("adversarial", () => {
		it("throws when a format contradicts an explicit size", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(() => {
				build([{ name: "a", format: "float32x3", size: 2, offset: 0 }]);
			}).toThrow(/3 components but size 2/);
		});

		it("throws when a format contradicts an explicit normalized flag", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(() => {
				build([
					{ name: "a", format: "unorm8x4", normalized: false, offset: 0 },
				]);
			}).toThrow(/normalized/);
		});

		it("allows a redundant but agreeing size and normalized", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(() => {
				build([
					{
						name: "a",
						format: "unorm8x4",
						size: 4,
						normalized: true,
						offset: 0,
					},
				]);
			}).not.toThrow();
		});

		it("does not throw for FLOAT with normalized:true", (ctx) => {
			requireWebGL(ctx, renderer);
			// legal in WebGL, which accepts and ignores the flag; there is no
			// float32-normalized spelling, so this must not be treated as a
			// contradiction
			const batcher = build([
				{ name: "a", size: 3, type: gl.FLOAT, normalized: true, offset: 0 },
			]);
			expect(batcher.attributes[0].format).toBe("float32x3");
			expect(batcher.attributes[0].normalized).toBe(true);
		});

		it("throws for an unknown format name", (ctx) => {
			requireWebGL(ctx, renderer);
			expect(() => {
				build([{ name: "a", format: "float32x9", offset: 0 }]);
			}).toThrow(/float32x9/);
		});

		it("rejects the positional format form given a legacy arity", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", format: "float32x4", offset: 0 }]);
			batcher.vertexState = null;
			expect(() => {
				// `false` would otherwise land in `offset` and silently place
				// the attribute at byte 0, overlapping the previous one
				batcher.addAttribute("b", "float32x4", false, 16);
			}).toThrow(/takes \(name, format, offset\)/);
		});

		it("defaults an omitted offset to the running stride", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([
				{ name: "a", format: "float32x3" },
				{ name: "b", format: "float32x2" },
				{ name: "c", format: "unorm8x4" },
			]);
			expect(
				batcher.attributes.map((a) => {
					return a.offset;
				}),
			).toEqual([0, 12, 20]);
			expect(batcher.stride).toBe(24);
		});

		it("reports the frozen layout before complaining about arguments", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", format: "float32x4", offset: 0 }]);
			// both wrong: layout frozen AND an unknown format. The frozen error
			// is the actionable one and must win.
			expect(() => {
				batcher.addAttribute({ name: "b", format: "nonsense" });
			}).toThrow(/frozen/);
		});

		it("freezes each record so a later edit cannot reach a context restore", (ctx) => {
			requireWebGL(ctx, renderer);
			const batcher = build([{ name: "a", format: "float32x3", offset: 0 }]);
			expect(Object.isFrozen(batcher.attributes[0])).toBe(true);
			expect(() => {
				batcher.attributes[0].size = 99;
			}).toThrow();
		});

		it("rejects a stride that is not a whole number of floats", (ctx) => {
			requireWebGL(ctx, renderer);
			// two bytes: `vertexSize` would be 0.5, and every buffer write
			// would land off-grid and be discarded without error
			expect(() => {
				build([{ name: "a", format: "unorm8x2", offset: 0 }]);
			}).toThrow(/multiple of 4 bytes/);
		});
	});
});
