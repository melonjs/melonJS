import { describe, expect, it } from "vitest";
import VertexArrayBuffer from "../src/video/buffer/vertex.js";
import { buildMultiTextureFragment } from "../src/video/webgl/shaders/multitexture.js";

describe("VertexArrayBuffer", () => {
	describe("push()", () => {
		// PR A (19.7) widened aVertex to vec3, adding a per-vertex `z`
		// component at slot 2. All downstream offsets shifted by 1.
		it("should write vertex data at the correct offsets (6 floats)", () => {
			// vertexSize=6 matches the primitive format: x, y, z, nx, ny, color
			const buf = new VertexArrayBuffer(6, 4);

			buf.push(10, 20, 5, 0.0, 1.0, 0xffffffff);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10); // x
			expect(buf.bufferF32[1]).toBe(20); // y
			expect(buf.bufferF32[2]).toBe(5); // z
			expect(buf.bufferF32[3]).toBe(0.0); // u / nx
			expect(buf.bufferF32[4]).toBe(1.0); // v / ny
			expect(buf.bufferU32[5]).toBe(0xffffffff); // tint
		});

		it("should write vertex data with textureId (7 floats)", () => {
			// vertexSize=7 matches the multi-texture quad format
			const buf = new VertexArrayBuffer(7, 4);

			buf.push(10, 20, 5, 0.0, 1.0, 0xffffffff, 3);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10); // x
			expect(buf.bufferF32[1]).toBe(20); // y
			expect(buf.bufferF32[2]).toBe(5); // z
			expect(buf.bufferF32[3]).toBe(0.0); // u
			expect(buf.bufferF32[4]).toBe(1.0); // v
			expect(buf.bufferU32[5]).toBe(0xffffffff); // tint
			expect(buf.bufferF32[6]).toBe(3); // textureId
		});

		it("should write default textureId 0 when not provided (vertexSize 7)", () => {
			const buf = new VertexArrayBuffer(7, 4);

			buf.push(10, 20, 0, 0.0, 1.0, 0xffffffff);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[6]).toBe(0); // default 0
		});

		it("should not write textureId when vertexSize is 6", () => {
			const buf = new VertexArrayBuffer(6, 4);

			// write a sentinel at offset 6
			buf.bufferF32[6] = 99;
			buf.push(10, 20, 0, 0.0, 1.0, 0xffffffff);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[6]).toBe(99); // untouched
		});

		it("should write multiple vertices sequentially", () => {
			const buf = new VertexArrayBuffer(6, 4);

			buf.push(1, 2, 0, 0.0, 0.0, 0xff000000);
			buf.push(3, 4, 7, 1.0, 1.0, 0x00ff0000);

			expect(buf.vertexCount).toBe(2);
			// second vertex starts at offset 6
			expect(buf.bufferF32[6]).toBe(3); // x
			expect(buf.bufferF32[7]).toBe(4); // y
			expect(buf.bufferF32[8]).toBe(7); // z
			expect(buf.bufferF32[9]).toBe(1.0); // u / nx
			expect(buf.bufferF32[10]).toBe(1.0); // v / ny
			expect(buf.bufferU32[11]).toBe(0x00ff0000); // tint
		});

		it("should write multiple vertices with textureId sequentially", () => {
			const buf = new VertexArrayBuffer(7, 4);

			buf.push(1, 2, 0, 0.0, 0.0, 0xff000000, 0);
			buf.push(3, 4, 0, 1.0, 1.0, 0x00ff0000, 5);

			expect(buf.vertexCount).toBe(2);
			expect(buf.bufferF32[6]).toBe(0); // textureId vertex 0
			expect(buf.bufferF32[13]).toBe(5); // textureId vertex 1
		});

		it("should write vertex data with textureId + normalTextureId (8 floats)", () => {
			// vertexSize=8 matches the lit-pipeline quad format:
			// x, y, z, u, v, tint, textureId, normalTextureId
			const buf = new VertexArrayBuffer(8, 4);

			buf.push(10, 20, 5, 0.0, 1.0, 0xffffffff, 3, 2);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10);
			expect(buf.bufferF32[1]).toBe(20);
			expect(buf.bufferF32[2]).toBe(5); // z
			expect(buf.bufferF32[3]).toBe(0.0);
			expect(buf.bufferF32[4]).toBe(1.0);
			expect(buf.bufferU32[5]).toBe(0xffffffff);
			expect(buf.bufferF32[6]).toBe(3); // textureId
			expect(buf.bufferF32[7]).toBe(2); // normalTextureId
		});

		it("should default normalTextureId to -1 when not provided (vertexSize 8)", () => {
			// Regression test: with vertexSize=8, omitting `normalTextureId`
			// must NOT leave stale data at offset 7. The shader's lit path
			// activates on `vNormalTextureId >= 0`; reading garbage there
			// causes unlit sprites to render through the lit path with
			// random normal-map / light state — visible as broken
			// hemispheric shading on every WebGL example after the
			// normal-map vertex format was introduced.
			const buf = new VertexArrayBuffer(8, 4);
			// poison the slot to prove push() actively writes -1
			buf.bufferF32[7] = 99;

			buf.push(10, 20, 0, 0.0, 1.0, 0xffffffff, 3);

			expect(buf.bufferF32[7]).toBe(-1);
		});

		it("should accept negative normalTextureId (sentinel for unlit)", () => {
			const buf = new VertexArrayBuffer(8, 4);
			buf.push(0, 0, 0, 0, 0, 0, 0, -1);
			expect(buf.bufferF32[7]).toBe(-1);
		});

		it("should not touch offset 7 when vertexSize is 7 (backward compat)", () => {
			// older quad batchers using vertexSize=7 mustn't get any
			// writes past offset 6
			const buf = new VertexArrayBuffer(7, 4);
			// pre-fill the next vertex's first slot with a sentinel
			buf.bufferF32[7] = 77;

			// pass a normalTextureId — should be silently dropped because
			// vertexSize is 7 (the unlit layout has no `aNormalTextureId`)
			buf.push(10, 20, 0, 0, 0, 0xff, 1, 9);
			// offset 7 is the next vertex's first float — verify push()
			// didn't bleed into it
			expect(buf.bufferF32[7]).toBe(77);
		});
	});

	describe("buildMultiTextureFragment()", () => {
		it("should generate correct number of sampler uniforms", () => {
			const src = buildMultiTextureFragment(4);
			expect(src).toContain("uniform sampler2D uSampler0;");
			expect(src).toContain("uniform sampler2D uSampler1;");
			expect(src).toContain("uniform sampler2D uSampler2;");
			expect(src).toContain("uniform sampler2D uSampler3;");
			expect(src).not.toContain("uSampler4");
		});

		it("should generate if/else chain with 0.5 thresholds", () => {
			const src = buildMultiTextureFragment(3);
			expect(src).toContain("if (vTextureId < 0.5)");
			expect(src).toContain("else if (vTextureId < 1.5)");
			expect(src).toContain("else if (vTextureId < 2.5)");
		});

		it("should include fallback to uSampler0", () => {
			const src = buildMultiTextureFragment(2);
			expect(src).toContain("} else {");
			expect(src).toContain("color = texture2D(uSampler0, vRegion);");
		});

		it("should generate a single sampler for maxTextures=1", () => {
			const src = buildMultiTextureFragment(1);
			expect(src).toContain("uniform sampler2D uSampler0;");
			expect(src).not.toContain("uSampler1");
			expect(src).toContain("if (vTextureId < 0.5)");
		});

		it("should include vColor multiplication", () => {
			const src = buildMultiTextureFragment(2);
			expect(src).toContain("gl_FragColor = color * vColor;");
		});
	});

	describe("pushFloats()", () => {
		it("should copy float data for a single vertex", () => {
			const buf = new VertexArrayBuffer(4, 4);
			const data = new Float32Array([10, 20, 0.5, 0.5]);

			buf.pushFloats(data, 0, 4);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(10);
			expect(buf.bufferF32[1]).toBe(20);
			expect(buf.bufferF32[2]).toBe(0.5);
			expect(buf.bufferF32[3]).toBe(0.5);
		});

		it("should copy from a source offset", () => {
			const buf = new VertexArrayBuffer(3, 4);
			const data = new Float32Array([99, 99, 99, 1, 2, 3]);

			buf.pushFloats(data, 3, 3);

			expect(buf.vertexCount).toBe(1);
			expect(buf.bufferF32[0]).toBe(1);
			expect(buf.bufferF32[1]).toBe(2);
			expect(buf.bufferF32[2]).toBe(3);
		});
	});

	describe("isFull()", () => {
		it("should return true when adding vertices would exceed capacity", () => {
			const buf = new VertexArrayBuffer(6, 2);

			expect(buf.isFull(2)).toBe(true);
			expect(buf.isFull(1)).toBe(false);

			buf.push(0, 0, 0, 0, 0, 0);
			expect(buf.isFull(1)).toBe(true);
		});
	});

	describe("clear()", () => {
		it("should reset vertex count to zero", () => {
			const buf = new VertexArrayBuffer(6, 4);

			buf.push(1, 2, 0, 3, 4, 0);
			expect(buf.vertexCount).toBe(1);

			buf.clear();
			expect(buf.vertexCount).toBe(0);
		});
	});

	// ---------------------------------------------------------------------
	// NaN-pattern packed-color regression (Apple Metal / ANGLE black-mesh
	// bug). Many MTL-baked vertex colors form NaN bit patterns when their
	// Uint32 packing is reinterpreted as Float32 — namely any color whose
	// alpha byte (MSB) is 0xFF AND whose R channel (next byte) has its
	// high bit set (R >= 0x80). The Kenney `craft_speederA` palette hits
	// this for `metal`, `metalRed`, and `metalDark` materials, leaving
	// only `dark` (R = 0x46) safe.
	//
	// Some V8 + driver combinations canonicalize NaN-pattern Uint32
	// values written through a Uint32Array view to 0 — somewhere along
	// the path between the JS write and the GPU's `aColor`
	// UNSIGNED_BYTE × 4 fetch. The result is a zeroed alpha byte, which
	// in the premultiplied-alpha mesh shader (`vColor.rgb = aColor.bgr *
	// aColor.a`) renders the mesh fully transparent — black silhouettes
	// against the page background.
	//
	// Fix in `vertex.js`: write the packed color as 4 individual bytes
	// through `bufferU8` instead of as a Uint32 through `bufferU32`. The
	// underlying ArrayBuffer is identical either way, but the byte path
	// is immune to whatever Float32-view tracking V8 / the driver does on
	// the slot.
	//
	// These tests inspect the buffer state directly (no GL needed) — any
	// future regression that goes back to the Uint32 write would surface
	// here as either wrong bytes in `bufferU8`, or as `NaN` showing up in
	// the Float32 view of the same slot.
	describe("packed-color byte-write (NaN-pattern Metal/ANGLE black-mesh regression)", () => {
		// Real packed-ARGB values from `craft_speederA.mtl` (alpha = 0xFF,
		// `mulPackedARGB` against a white runtime tint = MTL Kd
		// unchanged). Each entry would be a NaN bit pattern as a Float32.
		const NAN_PATTERN_COLORS = [
			{
				name: "metal (0xFFD7DEE8)",
				tint: 0xffd7dee8,
				b: 0xe8,
				g: 0xde,
				r: 0xd7,
				a: 0xff,
			},
			{
				name: "metalRed (0xFFFFA133)",
				tint: 0xffffa133,
				b: 0x33,
				g: 0xa1,
				r: 0xff,
				a: 0xff,
			},
			{
				name: "metalDark (0xFFACB5C5)",
				tint: 0xffacb5c5,
				b: 0xc5,
				g: 0xb5,
				r: 0xac,
				a: 0xff,
			},
			// pure white — the player's default `tint` post-mulPackedARGB
			{
				name: "pure white (0xFFFFFFFF)",
				tint: 0xffffffff,
				b: 0xff,
				g: 0xff,
				r: 0xff,
				a: 0xff,
			},
		];

		describe("pushMesh() — unpacks ARGB Uint32 into 4 normalized floats", () => {
			// `pushMesh` writes color as 4 floats in `[0, 1]` (RGBA), NOT
			// as packed bytes — see `mesh_batcher.init` for why
			// (`UNSIGNED_BYTE × 4 normalized` on Apple Metal canonicalizes
			// NaN-pattern values). Vertex size for the mesh layout is
			// 9 floats: x, y, z, u, v, r, g, b, a.
			const MESH_VERTEX_SIZE = 9;

			it.each(
				NAN_PATTERN_COLORS,
			)("$name unpacks to RGBA floats in [0, 1] (no NaN possible)", ({
				tint,
				b,
				g,
				r,
				a,
			}) => {
				const buf = new VertexArrayBuffer(MESH_VERTEX_SIZE, 4);
				buf.pushMesh(0, 0, 0, 0, 0, tint);

				// Color floats sit at offsets 5..8 of the first vertex.
				expect(buf.bufferF32[5]).toBeCloseTo(r / 255, 5);
				expect(buf.bufferF32[6]).toBeCloseTo(g / 255, 5);
				expect(buf.bufferF32[7]).toBeCloseTo(b / 255, 5);
				expect(buf.bufferF32[8]).toBeCloseTo(a / 255, 5);
			});

			it("never produces a NaN float for any of the historical NaN-pattern packed colors", () => {
				// The whole point of the FLOAT × 4 path: by writing
				// normalized [0, 1] values, the resulting float bit
				// pattern is never NaN regardless of the input. Pin this
				// — a regression that goes back to packed Uint32 would
				// re-introduce NaN-pattern floats on this code path.
				const buf = new VertexArrayBuffer(MESH_VERTEX_SIZE, 4);
				for (const { tint } of NAN_PATTERN_COLORS) {
					buf.clear();
					buf.pushMesh(0, 0, 0, 0, 0, tint);
					expect(Number.isNaN(buf.bufferF32[5])).toBe(false);
					expect(Number.isNaN(buf.bufferF32[6])).toBe(false);
					expect(Number.isNaN(buf.bufferF32[7])).toBe(false);
					expect(Number.isNaN(buf.bufferF32[8])).toBe(false);
				}
			});

			it("alpha float is ALWAYS 1.0 for any packed color with A=0xFF (smoke for the original symptom)", () => {
				// The visible signature of the bug: alpha was 0 →
				// premultiplied output black. With float colors this
				// can't happen — alpha is written as `0xFF / 255 = 1.0`,
				// not as a byte that could be canonicalized.
				const buf = new VertexArrayBuffer(MESH_VERTEX_SIZE, 4);
				for (const { tint } of NAN_PATTERN_COLORS) {
					buf.clear();
					buf.pushMesh(0, 0, 0, 0, 0, tint);
					expect(buf.bufferF32[8], `alpha for 0x${tint.toString(16)}`).toBe(1);
				}
			});

			it("preserves color across multiple vertices in the same buffer", () => {
				// Three vertices, three NaN-pattern packed colors.
				// Catches an offset arithmetic regression on vertex N>0.
				const buf = new VertexArrayBuffer(MESH_VERTEX_SIZE, 4);
				buf.pushMesh(0, 0, 0, 0, 0, 0xffd7dee8);
				buf.pushMesh(0, 0, 0, 0, 0, 0xffffa133);
				buf.pushMesh(0, 0, 0, 0, 0, 0xffacb5c5);

				// Vertex k's color slot starts at offset k*9 + 5.
				const colorOffsets = [
					5,
					MESH_VERTEX_SIZE + 5,
					2 * MESH_VERTEX_SIZE + 5,
				];

				expect(buf.bufferF32[colorOffsets[0]]).toBeCloseTo(0xd7 / 255, 5); // v0 R
				expect(buf.bufferF32[colorOffsets[0] + 3]).toBe(1); // v0 A
				expect(buf.bufferF32[colorOffsets[1]]).toBeCloseTo(0xff / 255, 5); // v1 R
				expect(buf.bufferF32[colorOffsets[1] + 3]).toBe(1); // v1 A
				expect(buf.bufferF32[colorOffsets[2]]).toBeCloseTo(0xac / 255, 5); // v2 R
				expect(buf.bufferF32[colorOffsets[2] + 3]).toBe(1); // v2 A
			});

			it("non-NaN packed colors (R < 0x80) unpack identically", () => {
				// Sanity: the float path treats every packed input the
				// same way; no special case for NaN-vs-non-NaN inputs.
				const buf = new VertexArrayBuffer(MESH_VERTEX_SIZE, 4);
				buf.pushMesh(0, 0, 0, 0, 0, 0xff464c57); // `dark` MTL
				expect(buf.bufferF32[5]).toBeCloseTo(0x46 / 255, 5); // R
				expect(buf.bufferF32[6]).toBeCloseTo(0x4c / 255, 5); // G
				expect(buf.bufferF32[7]).toBeCloseTo(0x57 / 255, 5); // B
				expect(buf.bufferF32[8]).toBe(1); // A
			});
		});

		describe("push() (sprite / particle / bullet path)", () => {
			// `push()` writes the packed color via `bufferU32[i] = tint`
			// — the cheaper single-store path. The bytes are
			// byte-identical to a 4×Uint8 write (V8 doesn't canonicalize
			// at the typed-array write site), and the upload-time
			// canonicalization risk is handled separately by
			// `toUint8()` on the upload path. These tests pin both
			// invariants: the Uint32 slot reads back the value we
			// wrote, AND the byte view sees the same little-endian
			// layout the GPU's `UNSIGNED_BYTE × 4 normalized` aColor
			// attribute expects.
			it.each(
				NAN_PATTERN_COLORS,
			)("$name round-trips through the Uint32 view AND lays out bytes the GPU expects", ({
				tint,
				b,
				g,
				r,
				a,
			}) => {
				// vertexSize=6: x, y, z, u, v, color (sprite format).
				const buf = new VertexArrayBuffer(6, 4);
				buf.push(0, 0, 0, 0, 0, tint);

				// The exact packed value sits at the Uint32 slot
				expect(buf.bufferU32[5]).toBe(tint);

				// Little-endian byte layout: B, G, R, A — matches
				// what the GPU's UNSIGNED_BYTE × 4 attribute reads.
				const byteOffset = 5 * 4;
				expect(buf.bufferU8[byteOffset]).toBe(b);
				expect(buf.bufferU8[byteOffset + 1]).toBe(g);
				expect(buf.bufferU8[byteOffset + 2]).toBe(r);
				expect(buf.bufferU8[byteOffset + 3]).toBe(a);
			});

			it("textureId slot in vertexSize=7 writes through the float view", () => {
				// Color sits at slot 5 (Uint32); textureId at slot 6
				// stays Float32 — its value range (small integers
				// 0..N) never forms a NaN pattern.
				const buf = new VertexArrayBuffer(7, 4);
				buf.push(0, 0, 0, 0, 0, 0xffd7dee8, 3);
				expect(buf.bufferF32[6]).toBe(3);
				expect(buf.bufferU32[5]).toBe(0xffd7dee8);
				expect(buf.bufferU8[5 * 4 + 3]).toBe(0xff);
			});

			it("the Float32 view of the color slot DOES see NaN — proves V8 preserves the bit pattern", () => {
				// Critical invariant: V8 does NOT canonicalize NaN at
				// Uint32-slot write time. The same 4 bytes the GPU
				// reads as UNSIGNED_BYTE × 4 (where 0xFF is alpha) are
				// the bytes the Float32 view sees as NaN. If a future
				// V8 release ever canonicalized this slot, the
				// `toUint8()` upload path is what protects against
				// driver-side canonicalization — but THIS test would
				// fail loudly, telling us to revisit.
				const buf = new VertexArrayBuffer(6, 4);
				buf.push(0, 0, 0, 0, 0, 0xffffa133);
				expect(Number.isNaN(buf.bufferF32[5])).toBe(true);
				expect(buf.bufferU8[5 * 4 + 3]).toBe(0xff);
			});
		});
	});
});
