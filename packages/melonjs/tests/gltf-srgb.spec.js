/**
 * glTF `baseColorFactor` is LINEAR; a melonJS tint is 8-bit sRGB.
 *
 * The loader used to hand the linear number straight to `tint.setColor(f*255)`,
 * which rendered every untextured glTF material far too light and desaturated
 * — an authored mid-green came out as pale mint. Surfaced by the 2.5D
 * platformer's road, whose authored colour did not survive the round trip.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { Application, boot, GLTFModel, video } from "../src/index.js";
import { linearToSrgb8 } from "../src/level/gltf/srgb.js";

describe("glTF linear → sRGB tint encode", () => {
	it("maps the endpoints exactly", () => {
		expect(linearToSrgb8(0)).toEqual(0);
		expect(linearToSrgb8(1)).toEqual(255);
	});

	it("lightens mid-tones the way the sRGB transfer function does", () => {
		// linear 0.5 is sRGB ~0.7354 → 188. The old `f * 255` gave 128.
		expect(linearToSrgb8(0.5)).toEqual(188);
		expect(linearToSrgb8(0.5)).not.toEqual(Math.round(0.5 * 255));
	});

	it("round-trips the value the road material is authored at", () => {
		// sRGB 0.29 stored as linear 0.0684 must come back out as ~0.29
		expect(linearToSrgb8(0.0684)).toBeCloseTo(0.29 * 255, -0.5);
		expect(linearToSrgb8(0.3931)).toBeCloseTo(0.66 * 255, -0.5);
	});

	it("uses the linear segment near black", () => {
		// below the 0.0031308 knee the curve is a plain 12.92x ramp
		expect(linearToSrgb8(0.002)).toEqual(Math.round(0.002 * 12.92 * 255));
	});

	it("clamps out-of-range factors instead of returning NaN", () => {
		// `Math.pow` on a negative base is NaN, which would poison the tint;
		// exporters do occasionally emit slightly out-of-range factors
		expect(linearToSrgb8(-0.2)).toEqual(0);
		expect(linearToSrgb8(1.4)).toEqual(255);
		expect(Number.isNaN(linearToSrgb8(-0.2))).toBe(false);
	});

	it("is monotonic across the range", () => {
		let prev = -1;
		for (let i = 0; i <= 20; i++) {
			const v = linearToSrgb8(i / 20);
			expect(v).toBeGreaterThanOrEqual(prev);
			prev = v;
		}
	});
});

/**
 * The tests above only exercise the helper — they would ALL still pass if the
 * loader stopped calling it. These pin the wiring: a material factor has to
 * arrive on the mesh tint sRGB-encoded, which is the thing that was actually
 * broken.
 */
describe("glTF loader applies the encode to the mesh tint", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	/** one-triangle node carrying `factor` as its baseColorFactor */
	const modelWith = (factor) => {
		return new GLTFModel(
			{
				bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
				graph: {
					roots: [0],
					nodes: {
						0: {
							index: 0,
							name: "solid",
							translation: [0, 0, 0],
							rotation: [0, 0, 0, 1],
							scale: [1, 1, 1],
							matrix: null,
							children: [],
							primitives: [
								{
									vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
									uvs: new Float32Array([0, 0, 0, 0, 0, 0]),
									indices: new Uint16Array([0, 1, 2]),
									normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
									vertexCount: 3,
									baseColorFactor: factor,
									colors: undefined,
									doubleSided: false,
								},
							],
						},
					},
				},
				animations: [],
			},
			{ scale: 1, rightHanded: false },
		);
	};

	const tintOf = (factor) => {
		const mesh = modelWith(factor).getChildByName("solid")[0];
		return [mesh.tint.r, mesh.tint.g, mesh.tint.b];
	};

	it("encodes a mid-tone factor rather than scaling it by 255", () => {
		// linear 0.5 → sRGB 188, NOT 128. This is the assertion that fails if
		// the loader goes back to `Math.round(f * 255)`.
		expect(tintOf([0.5, 0.5, 0.5, 1])).toEqual([188, 188, 188]);
	});

	it("carries the road material's authored green through intact", () => {
		// the case that surfaced the bug: linear 0.0684 must land near sRGB
		// 0.29 (74), not at 17
		const [r, g, b] = tintOf([0.0684, 0.3931, 0.0783, 1]);
		expect(r).toBeCloseTo(74, -0.7);
		expect(g).toBeCloseTo(168, -0.7);
		expect(b).toBeCloseTo(79, -0.7);
	});

	it("leaves white and black exactly at the endpoints", () => {
		expect(tintOf([1, 1, 1, 1])).toEqual([255, 255, 255]);
		expect(tintOf([0, 0, 0, 1])).toEqual([0, 0, 0]);
	});

	it("survives an out-of-range factor without NaN-ing the tint", () => {
		const tint = tintOf([-0.1, 1.3, 0.5, 1]);
		expect(
			tint.every((c) => {
				return Number.isFinite(c);
			}),
		).toBe(true);
		expect(tint[0]).toEqual(0);
		expect(tint[1]).toEqual(255);
	});
});
