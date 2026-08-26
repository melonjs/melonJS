/**
 * Read pixels back from any renderer, in canvas coordinates.
 *
 * Three backends, three conventions, and the suite currently re-derives the
 * reconciliation in ~15 separate specs:
 *
 * - `gl.readPixels` rows are BOTTOM-up, so y must be flipped
 * - `CanvasRenderingContext2D.getImageData` rows are TOP-down already
 * - `WebGPURenderTarget.readPixels` is top-down AND un-swizzles BGRA→RGBA,
 *   but it is asynchronous — `getImageData` throws by contract on WebGPU
 *
 * Everything here is async so the WebGPU path fits the same shape as the
 * other two, rather than forcing callers to branch.
 */

/**
 * Read a single pixel in canvas coordinates (0,0 = top-left).
 * @param {object} renderer - any melonJS renderer
 * @param {number} x - canvas x
 * @param {number} y - canvas y
 * @returns {Promise<number[]>} `[r, g, b, a]`, each 0-255
 */
export async function readPixel(renderer, x, y) {
	const canvas = renderer.getCanvas();
	const px = Math.round(x);
	const py = Math.round(y);

	// WebGL: bottom-up rows
	if (typeof renderer.gl !== "undefined" && renderer.gl !== null) {
		const gl = renderer.gl;
		renderer.flush();
		const out = new Uint8Array(4);
		gl.readPixels(
			px,
			canvas.height - 1 - py,
			1,
			1,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			out,
		);
		return Array.from(out);
	}

	// WebGPU: async readback off the presented texture
	if (typeof renderer.readCanvasPixels === "function") {
		const data = await renderer.readCanvasPixels(px, py, 1, 1);
		return Array.from(data.data ?? data).slice(0, 4);
	}

	// Canvas 2D: top-down rows already
	const ctx = renderer.getContext();
	renderer.flush?.();
	return Array.from(ctx.getImageData(px, py, 1, 1).data);
}

/**
 * Read the same pixel from several renderers at once, in canvas coordinates.
 * @param {object[]} renderers - the renderers to sample
 * @param {number} x - canvas x
 * @param {number} y - canvas y
 * @returns {Promise<number[][]>} one `[r, g, b, a]` per renderer, in order
 */
export async function readPixelFrom(renderers, x, y) {
	const out = [];
	for (const renderer of renderers) {
		out.push(await readPixel(renderer, x, y));
	}
	return out;
}

/**
 * Assert two pixels match within a per-channel tolerance.
 *
 * Exact equality is the wrong bar for cross-backend comparison: a software
 * rasterizer differs from a real GPU by a few LSBs, and the GPU backends
 * composite through a premultiplied capture where Canvas works on straight
 * colour — so even a correct implementation lands a step or two off.
 * @param {number[]} actual - `[r, g, b, a]`
 * @param {number[]} expected - `[r, g, b, a]`
 * @param {number} [tolerance] - max absolute per-channel difference
 * @param {string} [label] - included in the failure message
 */
export function expectPixelClose(actual, expected, tolerance = 2, label = "") {
	const channels = ["r", "g", "b", "a"];
	const deltas = channels.map((_, i) => {
		return Math.abs(actual[i] - expected[i]);
	});
	const worst = Math.max(...deltas.slice(0, expected.length));
	if (worst > tolerance) {
		const where = label === "" ? "" : `${label}: `;
		throw new Error(
			`${where}pixel [${actual.join(", ")}] differs from [${expected.join(", ")}] by ${worst} (tolerance ${tolerance})`,
		);
	}
}

/**
 * The W3C separable blend functions, evaluated on the CPU over straight
 * (non-premultiplied) colour in 0..1. The reference the shader is checked
 * against when a Canvas oracle is unavailable or when a formula needs
 * pinning independently of any renderer.
 * @see {@link https://www.w3.org/TR/compositing-1/#blending}
 */
export const BLEND_REFERENCE = {
	difference: (b, s) => {
		return Math.abs(b - s);
	},
	"hard-light": (b, s) => {
		return s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
	},
	overlay: (b, s) => {
		return BLEND_REFERENCE["hard-light"](s, b);
	},
	"color-dodge": (b, s) => {
		if (b === 0) {
			return 0;
		}
		if (s >= 1) {
			return 1;
		}
		return Math.min(1, b / (1 - s));
	},
	"color-burn": (b, s) => {
		if (b >= 1) {
			return 1;
		}
		if (s === 0) {
			return 0;
		}
		return 1 - Math.min(1, (1 - b) / s);
	},
	darken: (b, s) => {
		return Math.min(b, s);
	},
	lighten: (b, s) => {
		return Math.max(b, s);
	},
	"soft-light": (b, s) => {
		const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
		return s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (d - b);
	},
};

/**
 * The expected 0-255 result of compositing an opaque source over an opaque
 * backdrop with the given mode — `B(Cb, Cs)`, since `as = ab = 1` collapses
 * the W3C compositing step to the blend function itself.
 * @param {string} mode - one of the advanced blend modes
 * @param {number[]} backdrop - `[r, g, b]` 0-255
 * @param {number[]} source - `[r, g, b]` 0-255
 * @returns {number[]} `[r, g, b]` 0-255
 */
export function blendReference(mode, backdrop, source) {
	const fn = BLEND_REFERENCE[mode];
	return [0, 1, 2].map((i) => {
		return Math.round(255 * fn(backdrop[i] / 255, source[i] / 255));
	});
}

/**
 * The full W3C composite of a source over an OPAQUE backdrop:
 * `Co = as·B(Cb, Cs) + (1 - as)·Cb`.
 *
 * {@link blendReference} is the `as = 1` special case, where the compositing
 * step collapses to `B` alone. That collapse is why an opaque-only test suite
 * cannot see whether the shader un-premultiplies its source, re-premultiplies
 * its result, or composites with source-over at all — every one of those steps
 * is an identity at full alpha. Use THIS for any translucent case.
 * @param {string} mode - one of the advanced blend modes
 * @param {number[]} backdrop - `[r, g, b]` 0-255, treated as opaque
 * @param {number[]} source - `[r, g, b]` 0-255
 * @param {number} alpha - source alpha, 0..1
 * @returns {number[]} `[r, g, b]` 0-255
 */
export function compositeReference(mode, backdrop, source, alpha) {
	const fn = BLEND_REFERENCE[mode];
	return [0, 1, 2].map((i) => {
		const Cb = backdrop[i] / 255;
		const Cs = source[i] / 255;
		const B = Math.min(1, Math.max(0, fn(Cb, Cs)));
		return Math.round(255 * (alpha * B + (1 - alpha) * Cb));
	});
}
