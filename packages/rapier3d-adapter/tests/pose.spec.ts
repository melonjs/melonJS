/**
 * Writing a body's turn onto its renderable, through melonJS's `Quaternion`
 * and `Matrix3d`, computes what the hand-written matrix it replaced did: for
 * every bridge a renderable can have (none, a mesh's Y-up space, and a
 * right-handed mesh's), any turn, and any transform the renderable started
 * from.
 */
import { Matrix3d, Renderable } from "melonjs";
import { describe, expect, it } from "vitest";
import { type Pose, writePose } from "../src/bodies/pose";
import { Units } from "../src/math/units";

// the code it replaced: currentTransform = (D · R · D) · base
const oldWrite = (
	out: Float32Array,
	q: { x: number; y: number; z: number; w: number },
	base: ArrayLike<number>,
	[d0, d1, d2]: [number, number, number],
) => {
	const { x, y, z, w } = q;
	const r00 = 1 - 2 * (y * y + z * z);
	const r01 = 2 * (x * y - z * w);
	const r02 = 2 * (x * z + y * w);
	const r10 = 2 * (x * y + z * w);
	const r11 = 1 - 2 * (x * x + z * z);
	const r12 = 2 * (y * z - x * w);
	const r20 = 2 * (x * z - y * w);
	const r21 = 2 * (y * z + x * w);
	const r22 = 1 - 2 * (x * x + y * y);
	const m = [
		r00,
		r01 * d0 * d1,
		r02 * d0 * d2,
		r10 * d1 * d0,
		r11,
		r12 * d1 * d2,
		r20 * d2 * d0,
		r21 * d2 * d1,
		r22,
	];
	for (let col = 0; col < 4; col++) {
		const o = col * 4;
		const b0 = base[o];
		const b1 = base[o + 1];
		const b2 = base[o + 2];
		out[o] = m[0] * b0 + m[1] * b1 + m[2] * b2;
		out[o + 1] = m[3] * b0 + m[4] * b1 + m[5] * b2;
		out[o + 2] = m[6] * b0 + m[7] * b1 + m[8] * b2;
		out[o + 3] = base[o + 3];
	}
};

let seed = 777;
const rand = () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 2147483647;
};
const randomTurn = () => {
	const q = [rand() - 0.5, rand() - 0.5, rand() - 0.5, rand() - 0.5];
	const len = Math.hypot(...q);
	return { x: q[0] / len, y: q[1] / len, z: q[2] / len, w: q[3] / len };
};
const body = (q: { x: number; y: number; z: number; w: number }) => {
	return {
		translation: () => {
			return { x: 1, y: 2, z: 3 };
		},
		rotation: () => {
			return q;
		},
	} as unknown as Parameters<typeof writePose>[1];
};

describe("writePose", () => {
	const units = new Units(32);
	const bridges: [number, number, number][] = [
		[1, 1, 1],
		[1, -1, 1],
		[1, -1, -1],
	];

	for (const bridge of bridges) {
		it(`writes the turn the old matrix did, bridge ${bridge.join(", ")}`, () => {
			for (let i = 0; i < 300; i++) {
				const base = new Matrix3d()
					.translate(rand() * 40 - 20, rand() * 40 - 20, rand() * 40 - 20)
					.rotate(rand() * 6, { x: rand(), y: rand(), z: rand() } as never)
					.scale(rand() + 0.5, rand() + 0.5, rand() + 0.5);
				const q = randomTurn();
				const r = new Renderable(0, 0, 10, 10);
				const pose: Pose = { base: base.clone(), bridge };
				writePose(r, body(q), pose, units);
				const expected = new Float32Array(16);
				oldWrite(expected, q, base.val, bridge);
				for (let k = 0; k < 16; k++) {
					expect(r.currentTransform.val[k]).toBeCloseTo(expected[k], 5);
				}
			}
		});
	}

	it("with no pose, writes the position only, and no turn", () => {
		const r = new Renderable(0, 0, 10, 10);
		r.currentTransform.rotate(0.3);
		// the turn: the upper 3×3 (moving `pos` may shift the translation
		// column, as it did before)
		const turn = (m: Matrix3d) => {
			return [0, 1, 2, 4, 5, 6, 8, 9, 10].map((k) => {
				return m.val[k];
			});
		};
		const before = turn(r.currentTransform);
		writePose(r, body(randomTurn()), undefined, units);
		expect([r.pos.x, r.pos.y, r.depth]).toEqual([32, 64, 96]);
		expect(turn(r.currentTransform)).toEqual(before);
	});

	it("an unturned body gives back the transform the renderable had", () => {
		const base = new Matrix3d().translate(5, -3, 2).rotate(0.7).scale(2);
		for (const bridge of bridges) {
			const r = new Renderable(0, 0, 10, 10);
			writePose(r, body({ x: 0, y: 0, z: 0, w: 1 }), { base, bridge }, units);
			expect(Array.from(r.currentTransform.val)).toEqual(Array.from(base.val));
		}
	});
});
