/**
 * The backdrop sky: a seamless nebula field, generated rather than loaded.
 *
 * Stock imagery is the obvious route and the wrong one twice over: it cannot
 * be redistributed with an MIT example, and a photograph does not tile, so the
 * edges show the moment the field is repeated.
 *
 * Its own module because two stages want the same sky. The game builds one
 * behind the planet and the title screen builds another behind the title, and
 * generating it in one place is what keeps them the same place.
 */
import { Noise } from "melonjs";

/**
 * Repeat the generated tile into the single bitmap the backdrop draws.
 *
 * `drawImage` at whole-pixel offsets is a straight copy, so the joins inside
 * here are exact and the tile is seamless across them. That is the whole
 * point: the same repeat expressed as adjacent quads has real edges, and real
 * edges show.
 * @param size - edge of the generated tile, in pixels
 * @param repeat - how many copies per axis
 * @param seed - deterministic: the same seed is the same sky
 * @returns the composed bitmap, `size * repeat` square
 */
/** every sky baked so far, keyed by the three numbers that define it */
const fields = new Map<string, HTMLCanvasElement>();

export const nebulaField = (
	size: number,
	repeat: number,
	seed: number,
): HTMLCanvasElement => {
	// Baked ONCE for a given (size, repeat, seed), and held.
	//
	// Both stages call this from `onResetEvent`, which runs on every entry
	// to that state, and the bake is 512 squared pixels times two noise
	// fields times four wrap samples times five and three octaves: some
	// millions of simplex evaluations, synchronously, on the main thread,
	// AFTER the loading screen has gone. It was therefore paid again on
	// every return to the title and every new game. The sky is the same sky
	// every time, which is the whole premise of this module.
	const key = `${size}:${repeat}:${seed}`;
	const held = fields.get(key);
	if (held !== undefined) {
		return held;
	}
	const tile = nebulaTile(size, seed);
	const field = document.createElement("canvas");
	field.width = size * repeat;
	field.height = size * repeat;
	const ctx = field.getContext("2d");
	if (ctx === null) {
		return tile;
	}
	for (let y = 0; y < repeat; y++) {
		for (let x = 0; x < repeat; x++) {
			ctx.drawImage(tile, x * size, y * size);
		}
	}
	fields.set(key, field);
	return field;
};

/**
 * One tile of the field.
 *
 * `Noise` gives a coherent field but its samples are not periodic, so the tile
 * is made to wrap here: each pixel is a weighted blend of the field at four
 * positions, one per corner of the tile, with the weights running linearly
 * across it. Opposite edges then sample identically and the seam disappears,
 * which is the standard trick for turning any noise into a tileable one.
 * @param size - tile edge in pixels
 * @param seed - deterministic: the same seed is the same sky
 * @returns the tile, ready to repeat
 */
const nebulaTile = (size: number, seed: number): HTMLCanvasElement => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx === null) {
		return canvas;
	}
	const cloud = new Noise({
		type: "simplex",
		seed,
		frequency: 0.0075,
		octaves: 5,
		fractalType: "fbm",
	});
	const veil = new Noise({
		type: "simplex",
		seed: seed + 91,
		frequency: 0.017,
		octaves: 3,
		fractalType: "ridged",
	});

	/** the four-corner blend that makes an aperiodic field periodic */
	const wrapped = (n: Noise, x: number, y: number): number => {
		const fx = x / size;
		const fy = y / size;
		return (
			n.getNoise2d(x, y) * (1 - fx) * (1 - fy) +
			n.getNoise2d(x - size, y) * fx * (1 - fy) +
			n.getNoise2d(x, y - size) * (1 - fx) * fy +
			n.getNoise2d(x - size, y - size) * fx * fy
		);
	};

	const img = ctx.createImageData(size, size);
	const px = img.data;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const a = 0.5 + 0.5 * wrapped(cloud, x, y);
			const b = 0.5 + 0.5 * wrapped(veil, x, y);
			// dense cores fade out fast, so the cloud reads as depth
			const density = Math.max(0, a * a * 1.5 - 0.22);
			const hot = Math.max(0, b - 0.55) * 1.7;
			const i = (y * size + x) * 4;
			// indigo body, magenta in the folds, a cold teal in the thin
			px[i] = Math.min(255, (38 + 150 * hot + 60 * density) * density * 2);
			px[i + 1] = Math.min(255, (26 + 40 * hot + 120 * density) * density * 2);
			px[i + 2] = Math.min(255, (92 + 60 * hot + 150 * density) * density * 2);
			px[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);

	// a dusting of stars baked in, so the field carries its own detail
	// at every repeat rather than needing a sprite per point of light
	for (let i = 0; i < size / 2; i++) {
		const r = Math.random() < 0.92 ? 0.6 : 1.3;
		ctx.fillStyle = `rgba(255,255,255,${(0.35 + Math.random() * 0.6).toFixed(2)})`;
		ctx.beginPath();
		ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
		ctx.fill();
	}
	return canvas;
};
