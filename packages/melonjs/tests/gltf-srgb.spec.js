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

/**
 * The WIRING: a material factor has to arrive on the mesh tint sRGB-encoded.
 *
 * The transfer function itself belongs to {@link Color#setLinear} now and is
 * tested in `color.spec.ts`; those tests would all still pass if the loader
 * stopped calling it, which is why this file exists separately.
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
		// linear 0.5 is sRGB 0.7354, NOT 0.5. This is the assertion that fails
		// if the loader goes back to `Math.round(f * 255)`, which would give
		// 128.
		//
		// 187 and not 188: `setLinear` keeps the encoded value as a float and
		// the byte getters truncate, where the old 8-bit helper rounded on the
		// way in. What reaches the renderer is the float, so this is the more
		// accurate of the two by half a count.
		expect(tintOf([0.5, 0.5, 0.5, 1])).toEqual([187, 187, 187]);
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
