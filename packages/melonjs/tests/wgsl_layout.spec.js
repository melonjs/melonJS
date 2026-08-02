import { describe, expect, it } from "vitest";
import {
	computeUniformLayout,
	normalizeWGSLType,
} from "../src/video/effects/wgsl/layout.js";

/**
 * Hand-computed WGSL uniform-address-space layouts. A mislaid offset is
 * SILENT at runtime (the value lands in the wrong struct member), so every
 * rule the calculator implements is pinned here explicitly — same
 * discipline as the std140 light-block spec.
 */
describe("WGSL uniform layout calculator", () => {
	function layoutOf(members) {
		return computeUniformLayout(
			members.map(([name, type]) => {
				return { name, type };
			}),
		);
	}

	it("scalars pack tightly, struct size rounds up to 16", () => {
		const { map, size } = layoutOf([
			["a", "f32"],
			["b", "f32"],
			["c", "i32"],
		]);
		expect(map.get("a")).toMatchObject({ offset: 0, size: 4 });
		expect(map.get("b")).toMatchObject({ offset: 4, size: 4 });
		expect(map.get("c")).toMatchObject({ offset: 8, size: 4, type: "i32" });
		expect(size).toBe(16);
	});

	it("vec2 aligns to 8", () => {
		const { map, size } = layoutOf([
			["a", "f32"],
			["b", "vec2f"],
		]);
		expect(map.get("b").offset).toBe(8);
		expect(size).toBe(16);
	});

	it("vec3 aligns to 16 with 12 bytes of data — the classic trap", () => {
		const { map, size } = layoutOf([
			["a", "f32"],
			["b", "vec3f"],
			["c", "f32"],
		]);
		expect(map.get("b")).toMatchObject({ offset: 16, size: 12 });
		// c packs into vec3's tail padding
		expect(map.get("c").offset).toBe(28);
		expect(size).toBe(32);
	});

	it("matrices: mat4x4f is 64 bytes, mat3x3f is 48 (16-byte column stride)", () => {
		const { map, size } = layoutOf([
			["v", "vec4f"],
			["m", "mat4x4f"],
		]);
		expect(map.get("m")).toMatchObject({ offset: 16, size: 64 });
		expect(size).toBe(80);
		expect(layoutOf([["m", "mat3x3f"]]).map.get("m").size).toBe(48);
	});

	it("array<vec4f, N> occupies 16·N with 16-byte alignment", () => {
		const { map, size } = layoutOf([
			["arr", "array<vec4f, 3>"],
			["x", "f32"],
		]);
		expect(map.get("arr")).toMatchObject({ offset: 0, size: 48 });
		expect(map.get("x").offset).toBe(48);
		expect(size).toBe(64);
	});

	it("long-form spellings normalize onto the short forms", () => {
		expect(normalizeWGSLType("vec3<f32>")).toBe("vec3f");
		expect(normalizeWGSLType("mat4x4<f32>")).toBe("mat4x4f");
		const { map } = layoutOf([["b", "vec3<f32>"]]);
		expect(map.get("b")).toMatchObject({ offset: 0, size: 12, type: "vec3f" });
	});

	it("an unsupported member type fails the whole layout (null), never guesses", () => {
		expect(
			layoutOf([
				["ok", "f32"],
				["bad", "bool"],
			]),
		).toBeNull();
		expect(layoutOf([["bad", "array<f32, 4>"]])).toBeNull();
	});
});
