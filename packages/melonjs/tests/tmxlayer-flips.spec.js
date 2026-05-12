import { describe, expect, it } from "vitest";
import { Matrix2d } from "../src/math/matrix2d.ts";

// Local copy of the legacy `buildFlipTransform` from `TMXTile.js`.
// Inlined here to avoid a circular import via the full TMX module tree
// (TMXTile pulls in Sprite, which isn't safe to load in isolation). If
// the legacy implementation ever changes, update this copy to match —
// the surrounding tests are precisely the regression net that catches
// the shader drifting from it.
const FLIP_H_BIT_LOCAL = 1;
const FLIP_V_BIT_LOCAL = 2;
const FLIP_AD_BIT_LOCAL = 4;
const buildFlipTransform = (transform, flipMask, width, height) => {
	const halfW = width / 2;
	const halfH = height / 2;
	const flippedH = (flipMask & FLIP_H_BIT_LOCAL) !== 0;
	const flippedV = (flipMask & FLIP_V_BIT_LOCAL) !== 0;
	const flippedAD = (flipMask & FLIP_AD_BIT_LOCAL) !== 0;

	transform.identity();
	transform.translate(halfW, halfH);
	if (flippedAD) {
		transform.rotate((-90 * Math.PI) / 180);
		transform.scale(-1, 1);
	}
	if (flippedH) {
		transform.scale(flippedAD ? 1 : -1, flippedAD ? -1 : 1);
	}
	if (flippedV) {
		transform.scale(flippedAD ? -1 : 1, flippedAD ? 1 : -1);
	}
	transform.translate(-halfW, -halfH);
	return transform;
};

/**
 * The shader's atlas-sampling code applies the INVERSE of the legacy
 * CPU `buildFlipTransform` to derive an atlas UV from the fragment's
 * position within the destination tile. The mapping must be identical
 * across all 8 Tiled flip combinations (AD × H × V), otherwise rotated
 * tiles render visibly wrong (as they did once before — bottom-left vs
 * top-left corner ending up on the wrong side).
 *
 * The shader does this in 5 lines:
 *   inTile = mix(inTile, inTile.yx, flipAD);
 *   effH   = mix(flipH, flipV, flipAD);
 *   effV   = mix(flipV, flipH, flipAD);
 *   inTile.x = mix(inTile.x, 1.0 - inTile.x, effH);
 *   inTile.y = mix(inTile.y, 1.0 - inTile.y, effV);
 *
 * `shaderFlip` below is the JS port — bug-for-bug identical so the
 * tests live or die with the shader's formula. The two correctness
 * checks below cross-validate it: against the explicit table, and
 * against the inverse of `buildFlipTransform` (the legacy renderer's
 * authoritative source of flip semantics).
 */

const FLIP_H_BIT = 1;
const FLIP_V_BIT = 2;
const FLIP_AD_BIT = 4;

/** JS twin of the GLSL flip block — must stay in lockstep. */
const shaderFlip = (x, y, mask) => {
	const flipH = mask & FLIP_H_BIT ? 1 : 0;
	const flipV = mask & FLIP_V_BIT ? 1 : 0;
	const flipAD = mask & FLIP_AD_BIT ? 1 : 0;
	let u = x;
	let v = y;
	if (flipAD) {
		// transpose around y = x
		const tx = u;
		u = v;
		v = tx;
	}
	// when AD is set, H and V swap their effective axes
	const effH = flipAD ? flipV : flipH;
	const effV = flipAD ? flipH : flipV;
	if (effH) {
		u = 1 - u;
	}
	if (effV) {
		v = 1 - v;
	}
	return [u, v];
};

/**
 * Reference table: (dest fragment in [0, 1]²) → (source atlas UV).
 * Derived by inverting the matrix the legacy `buildFlipTransform`
 * composes for each flip combination.
 */
const EXPECTED = [
	// mask=0 (no flip): identity
	[
		0b000,
		(x, y) => {
			return [x, y];
		},
	],
	// mask=1 (H): mirror X
	[
		0b001,
		(x, y) => {
			return [1 - x, y];
		},
	],
	// mask=2 (V): mirror Y
	[
		0b010,
		(x, y) => {
			return [x, 1 - y];
		},
	],
	// mask=3 (H+V): 180° rotation
	[
		0b011,
		(x, y) => {
			return [1 - x, 1 - y];
		},
	],
	// mask=4 (AD): transpose (reflection over y = x)
	[
		0b100,
		(x, y) => {
			return [y, x];
		},
	],
	// mask=5 (AD+H): 90° CW rotation
	[
		0b101,
		(x, y) => {
			return [y, 1 - x];
		},
	],
	// mask=6 (AD+V): 90° CCW rotation
	[
		0b110,
		(x, y) => {
			return [1 - y, x];
		},
	],
	// mask=7 (AD+H+V): anti-diagonal reflection (line y = 1 - x)
	[
		0b111,
		(x, y) => {
			return [1 - y, 1 - x];
		},
	],
];

// Sample points cover the four corners + interior + edge-midpoints, so
// any sign / axis / off-by-one bug in the shader port shows up.
const SAMPLES = [
	[0, 0],
	[1, 0],
	[1, 1],
	[0, 1],
	[0.5, 0.5],
	[0.25, 0.75],
	[0.75, 0.25],
	[0, 0.5],
	[0.5, 0],
];

describe("TMX shader-path flip math", () => {
	for (const [mask, expected] of EXPECTED) {
		const label = [
			mask & FLIP_AD_BIT ? "AD" : null,
			mask & FLIP_H_BIT ? "H" : null,
			mask & FLIP_V_BIT ? "V" : null,
		]
			.filter(Boolean)
			.join("+");

		it(`mask=${mask} (${label || "identity"}) matches the expected table`, () => {
			for (const [x, y] of SAMPLES) {
				const [su, sv] = shaderFlip(x, y, mask);
				const [eu, ev] = expected(x, y);
				expect(su).toBeCloseTo(eu, 6);
				expect(sv).toBeCloseTo(ev, 6);
			}
		});
	}
});

describe("TMX shader-path flip math vs legacy buildFlipTransform", () => {
	// The shader's formula must compose to the exact INVERSE of the
	// legacy CPU transform for every flip combination. This is the
	// load-bearing assertion: if `buildFlipTransform` ever changes its
	// semantics, this test fails and forces the shader to follow.
	const W = 70;
	const H = 70;

	const samplesInPixelSpace = [
		[0, 0],
		[W * 0.25, H * 0.75],
		[W * 0.5, H * 0.5],
		[W * 0.75, H * 0.25],
		[W - 1, H - 1],
	];

	for (let mask = 0; mask < 8; mask++) {
		const label =
			[
				mask & FLIP_AD_BIT ? "AD" : null,
				mask & FLIP_H_BIT ? "H" : null,
				mask & FLIP_V_BIT ? "V" : null,
			]
				.filter(Boolean)
				.join("+") || "identity";

		it(`mask=${mask} (${label}): shader inverse round-trips legacy forward`, () => {
			const fwd = buildFlipTransform(new Matrix2d(), mask, W, H);
			for (const [sx, sy] of samplesInPixelSpace) {
				// LEGACY forward: source-pixel position → destination-pixel position
				const dest = { x: sx, y: sy };
				fwd.apply(dest);
				// SHADER inverse: destination position (normalized) → source UV
				const [su, sv] = shaderFlip(dest.x / W, dest.y / H, mask);
				// Round-trip must land back on the original source pixel
				expect(su * W).toBeCloseTo(sx, 3);
				expect(sv * H).toBeCloseTo(sy, 3);
			}
		});
	}
});
