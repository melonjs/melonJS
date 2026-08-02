import { describe, expect, it } from "vitest";
import { normalizeBlendMode } from "../src/video/webgpu/pipeline_cache.js";

/**
 * Device-free units of the WebGPU 2D pipeline — the pure CPU pieces
 * (key normalization, staging math) that must hold on every runner,
 * with or without a GPU. The device-dependent draw paths are covered by
 * webgpu_renderer.spec.js behind the availability skip, and visually by
 * the Hello WebGPU example.
 */
describe("WebGPU pipeline (device-free units)", () => {
	describe("blend-mode key normalization (GL-backend parity)", () => {
		it("collapses the additive aliases", () => {
			expect(normalizeBlendMode("add")).toBe("additive");
			expect(normalizeBlendMode("lighter")).toBe("additive");
			expect(normalizeBlendMode("additive")).toBe("additive");
		});

		it("passes the supported modes through", () => {
			for (const mode of [
				"normal",
				"multiply",
				"screen",
				"darken",
				"lighten",
				"none",
			]) {
				expect(normalizeBlendMode(mode)).toBe(mode);
			}
		});

		it("falls back to normal for unsupported CSS modes, like the GL backend", () => {
			expect(normalizeBlendMode("overlay")).toBe("normal");
			expect(normalizeBlendMode("color-dodge")).toBe("normal");
			expect(normalizeBlendMode("nonsense")).toBe("normal");
		});
	});

	describe("frozen vertex layouts (the #1492 declarative consumption)", () => {
		it("quad layout resolves to the 28-byte GL-parity stride", async () => {
			const { resolveVertexFormat } = await import(
				"../src/video/gpu/vertexformat.ts"
			);
			// aVertex float32x3 @0, aRegion float32x2 @12, aColor unorm8x4
			// @20, aTextureId float32 @24 → stride 28
			const layout = [
				["float32x3", 0],
				["float32x2", 12],
				["unorm8x4", 20],
				["float32", 24],
			];
			let stride = 0;
			for (const [format, offset] of layout) {
				const resolved = resolveVertexFormat(format);
				expect(offset).toBe(stride);
				stride = offset + resolved.bytes;
			}
			expect(stride).toBe(28);
		});

		it("primitive layout resolves to the 24-byte GL-parity stride", async () => {
			const { resolveVertexFormat } = await import(
				"../src/video/gpu/vertexformat.ts"
			);
			const layout = [
				["float32x3", 0],
				["float32x2", 12],
				["unorm8x4", 20],
			];
			let stride = 0;
			for (const [format, offset] of layout) {
				const resolved = resolveVertexFormat(format);
				expect(offset).toBe(stride);
				stride = offset + resolved.bytes;
			}
			expect(stride).toBe(24);
		});
	});

	describe("packed color byte order (unorm8x4 contract)", () => {
		it("Color.toUint32 little-endian bytes read back as B,G,R,A", async () => {
			const { Color } = await import("../src/math/color.ts");
			// R=0x11, G=0x22, B=0x33, alpha 1 → packed (A<<24)|(R<<16)|(G<<8)|B
			const packed = new Color(0x11, 0x22, 0x33).toUint32(1.0);
			const bytes = new Uint8Array(Uint32Array.of(packed).buffer);
			// unorm8x4 maps byte i → component i: the attribute arrives as
			// (B, G, R, A), which the shaders' `.bgr` swizzle re-orders —
			// the exact convention both the GLSL and WGSL sources rely on
			expect([...bytes]).toEqual([0x33, 0x22, 0x11, 0xff]);
		});
	});
});
