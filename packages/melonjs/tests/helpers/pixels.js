/**
 * Read pixels back from any renderer, in canvas coordinates.
 *
 * Three backends, three conventions, and the suite currently re-derives the
 * reconciliation in ~15 separate specs:
 *
 * - `gl.readPixels` rows are BOTTOM-up, so y must be flipped
 * - `CanvasRenderingContext2D.getImageData` rows are TOP-down already
 * - `RenderTarget#toImageData` is top-down AND un-swizzles BGRA→RGBA on
 *   WebGPU, and is a promise on every backend, because WebGPU can only read
 *   back asynchronously. Synchronous `getImageData` throws on that one.
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

	// WebGPU: its canvas has no synchronous readback, but still holds the
	// frame just submitted until this task ends
	if (renderer.type === "WebGPU") {
		const frame = await grabFrame(renderer);
		const o = (py * frame.width + px) * 4;
		return Array.from(frame.data.subarray(o, o + 4));
	}

	// Canvas 2D: top-down rows already
	const ctx = renderer.getContext();
	renderer.flush?.();
	return Array.from(ctx.getImageData(px, py, 1, 1).data);
}

/**
 * Have a WebGPU renderer draw its frames into a texture of its own, in place
 * of its canvas's, and return that renderer.
 *
 * A test reads a frame back from the texture it was drawn into (see
 * {@link grabFrame}), and a canvas's texture is only there until the browser
 * presents it. Presenting is also what a headless browser on a software
 * adapter cannot do: the device is lost the moment a canvas texture is
 * asked for. Drawn into a plain texture, the renderer's own work (its
 * pipelines, shaders and passes) runs and reads back the same everywhere.
 *
 * Call it right after `app.init()`, before the first frame. A renderer that
 * is not WebGPU is returned as it is.
 * @param {object} renderer - any melonJS renderer
 * @returns {object} the renderer
 */
export function drawOffscreen(renderer) {
	if (renderer.type !== "WebGPU" || renderer.context.__offscreen === true) {
		return renderer;
	}
	const canvas = renderer.getCanvas();
	const context = renderer.context;
	const format =
		context.getConfiguration?.()?.format ??
		navigator.gpu.getPreferredCanvasFormat();
	let texture;
	context.getCurrentTexture = () => {
		if (
			texture === undefined ||
			texture.width !== canvas.width ||
			texture.height !== canvas.height
		) {
			texture?.destroy();
			texture = renderer.device.createTexture({
				label: "test frame",
				size: [canvas.width, canvas.height],
				format,
				usage:
					GPUTextureUsage.RENDER_ATTACHMENT |
					GPUTextureUsage.COPY_SRC |
					GPUTextureUsage.TEXTURE_BINDING,
			});
		}
		return texture;
	};
	context.__offscreen = true;
	return renderer;
}

/**
 * The whole frame a renderer has just drawn, as straight-alpha `ImageData`,
 * rows top-down, on any backend.
 *
 * To be called in the task that drew the frame, before anything is awaited:
 * a GPU canvas only holds its frame until the browser presents it. On WebGPU
 * the frame must have been begun with `renderer.clear()`; it is submitted
 * here, and its texture copied into a buffer before this returns its promise
 * (see {@link drawOffscreen}, which a test on WebGPU wants first).
 * @param {object} renderer - any melonJS renderer
 * @returns {Promise<ImageData>} the frame
 */
export async function grabFrame(renderer) {
	renderer.flush?.();
	const source = renderer.getCanvas();
	const width = source.width;
	const height = source.height;

	if (renderer.type === "WebGPU") {
		// the canvas texture of this frame, still current until presented
		const device = renderer.device;
		const texture = renderer.context.getCurrentTexture();
		const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
		const buffer = device.createBuffer({
			size: bytesPerRow * height,
			usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
		});
		const encoder = device.createCommandEncoder();
		encoder.copyTextureToBuffer(
			{ texture },
			{ buffer, bytesPerRow },
			{ width, height },
		);
		device.queue.submit([encoder.finish()]);
		await buffer.mapAsync(GPUMapMode.READ);
		const raw = new Uint8Array(buffer.getMappedRange());
		const bgra = texture.format.startsWith("bgra");
		const out = new Uint8ClampedArray(width * height * 4);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = y * bytesPerRow + x * 4;
				const o = (y * width + x) * 4;
				out[o] = raw[i + (bgra ? 2 : 0)];
				out[o + 1] = raw[i + 1];
				out[o + 2] = raw[i + (bgra ? 0 : 2)];
				out[o + 3] = raw[i + 3];
			}
		}
		buffer.unmap();
		buffer.destroy();
		return new ImageData(out, width, height);
	}

	// WebGL and Canvas: copied through a 2D canvas, while the frame is there
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	context.drawImage(source, 0, 0);
	return context.getImageData(0, 0, width, height);
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
