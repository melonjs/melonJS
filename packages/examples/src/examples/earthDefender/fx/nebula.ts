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
import { loader, Noise } from "melonjs";
import {
	NEBULA_NEAR_REPEAT,
	NEBULA_NEAR_SEED,
	NEBULA_REPEAT,
	NEBULA_SEED,
	NEBULA_TEX,
} from "../constants";

/**
 * The skies the game draws, by name: tile edge, repeat and seed.
 *
 * In one table so the preload and the stages cannot disagree. A sky is baked
 * once and found again by these three numbers, so a stage asking with a seed
 * typed differently from the preload's would quietly bake a second sky on the
 * frame it starts, which is the stall the preload is there to remove.
 */
const SKIES = {
	/** behind the planet in the game, and behind the title */
	far: [NEBULA_TEX, NEBULA_REPEAT, NEBULA_SEED],
	/** the game's nearer layer, which parallaxes against the far one */
	near: [NEBULA_TEX, NEBULA_NEAR_REPEAT, NEBULA_NEAR_SEED],
} as const;

/** the name of one of the game's skies */
export type SkyName = keyof typeof SKIES;

/** every sky baked so far, keyed by the three numbers that define it */
const fields = new Map<string, HTMLCanvasElement>();

/**
 * One of the game's skies, as the bitmap its backdrop quad draws.
 * @param name - which sky
 * @returns the composed field, baked by the preload in the normal course
 */
export const nebulaSky = (name: SkyName): HTMLCanvasElement => {
	const [size, repeat, seed] = SKIES[name];
	return nebulaField(size, repeat, seed);
};

/**
 * The asset type a sky is preloaded under, registered by
 * {@link registerNebulaAsset}. Not an engine type: `loader.setParser` lets a
 * game teach the loader one of its own, and this is the game's.
 */
export const NEBULA_ASSET = "nebula";

/**
 * How long one slice of a preloaded bake may hold the main thread, in ms.
 *
 * Short enough that the loading screen keeps drawing, and that the other
 * assets landing meanwhile still move the progress bar, rather than the page
 * freezing for the whole bake. Long enough that the yields add little to it:
 * each one costs a few milliseconds of timer slack, and a 512 tile is some
 * tens of slices.
 */
const SLICE_MS = 8;

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
const nebulaField = (
	size: number,
	repeat: number,
	seed: number,
): HTMLCanvasElement => {
	// Baked ONCE for a given (size, repeat, seed), and held.
	//
	// Both stages call this from `onResetEvent`, which runs on every entry
	// to that state, and the bake is 512 squared pixels times two noise
	// fields times four wrap samples times five and three octaves: some
	// millions of simplex evaluations, synchronously, on the main thread.
	// The sky is the same sky every time, which is the whole premise of this
	// module. The preload bakes both skies ahead of the stages (see
	// `registerNebulaAsset`), so this normally just finds them here; baking
	// on the spot is the fallback for a field nobody declared.
	const key = `${size}:${repeat}:${seed}`;
	const held = fields.get(key);
	if (held !== undefined) {
		return held;
	}
	const bake = startTile(size, seed);
	bake.fill(0, size);
	const field = compose(bake.finish(), size, repeat);
	fields.set(key, field);
	return field;
};

/**
 * Bake a field without holding the main thread for the whole of it.
 *
 * The same field {@link nebulaField} makes, in slices of {@link SLICE_MS},
 * yielding between them. It is what the preload runs: a stage entered later
 * then finds the field already held and pays nothing for it.
 * @param size - edge of the generated tile, in pixels
 * @param repeat - how many copies per axis
 * @param seed - deterministic: the same seed is the same sky
 * @returns the composed bitmap, held for {@link nebulaField} to return
 */
const bakeNebulaField = async (
	size: number,
	repeat: number,
	seed: number,
): Promise<HTMLCanvasElement> => {
	const key = `${size}:${repeat}:${seed}`;
	const held = fields.get(key);
	if (held !== undefined) {
		return held;
	}
	const bake = startTile(size, seed);
	let y = 0;
	while (y < size) {
		const start = performance.now();
		while (y < size && performance.now() - start < SLICE_MS) {
			bake.fill(y, y + 1);
			y++;
		}
		// a timer rather than a frame callback: the loader keeps going in a
		// hidden tab, where frame callbacks stop and a bake waiting on one
		// would hold the whole preload with it
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}
	const field = compose(bake.finish(), size, repeat);
	fields.set(key, field);
	return field;
};

/** guards against registering the parser twice: a remount runs the setup again */
let registered = false;

/**
 * Teach the loader to bake a sky, so the bake lands behind the loading screen.
 *
 * Each sky is then one ordinary entry in the preload list,
 * `{ name: "far", type: NEBULA_ASSET }`, named after its row in the sky
 * table. It counts as one step of the progress bar, and the stage that draws
 * it later finds it already baked. Without this, the first entry into the title paid for the
 * bake on the frame the scene was built, behind a black screen, and the first
 * game paid again for the near cloud. Call before `loader.preload`.
 */
export const registerNebulaAsset = () => {
	if (registered) {
		return;
	}
	registered = true;
	loader.setParser(
		NEBULA_ASSET,
		(
			asset: { name: SkyName },
			onload: () => void,
			onerror: (e: unknown) => void,
		) => {
			const sky = SKIES[asset.name] as (typeof SKIES)[SkyName] | undefined;
			if (sky === undefined) {
				onerror(new Error(`nebula: no sky named "${asset.name}"`));
				return 1;
			}
			const [size, repeat, seed] = sky;
			bakeNebulaField(size, repeat, seed).then(() => {
				onload();
			}, onerror);
			// one asset, finished asynchronously
			return 1;
		},
	);
};

/**
 * Stamp the tile `repeat` times per axis into the bitmap the backdrop draws.
 * @param tile - the generated tile
 * @param size - tile edge in pixels
 * @param repeat - how many copies per axis
 * @returns the composed bitmap, or the tile alone without a 2D context
 */
const compose = (
	tile: HTMLCanvasElement,
	size: number,
	repeat: number,
): HTMLCanvasElement => {
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
	return field;
};

/**
 * One tile of the field, generated a band of rows at a time.
 *
 * `Noise` gives a coherent field but its samples are not periodic, so the tile
 * is made to wrap here: each pixel is a weighted blend of the field at four
 * positions, one per corner of the tile, with the weights running linearly
 * across it. Opposite edges then sample identically and the seam disappears,
 * which is the standard trick for turning any noise into a tileable one.
 *
 * Split into `fill` and `finish` so the same bake can run in one go or in
 * slices: rows are independent of each other, so the order they are filled in
 * changes nothing.
 * @param size - tile edge in pixels
 * @param seed - deterministic: the same seed is the same sky
 * @returns the bake: fill rows `[y0, y1)`, then finish to get the tile
 */
const startTile = (size: number, seed: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
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

	const img = ctx?.createImageData(size, size);

	return {
		fill(y0: number, y1: number) {
			if (img === undefined) {
				return;
			}
			const px = img.data;
			for (let y = y0; y < y1; y++) {
				for (let x = 0; x < size; x++) {
					const a = 0.5 + 0.5 * wrapped(cloud, x, y);
					const b = 0.5 + 0.5 * wrapped(veil, x, y);
					// dense cores fade out fast, so the cloud reads as depth
					const density = Math.max(0, a * a * 1.5 - 0.22);
					const hot = Math.max(0, b - 0.55) * 1.7;
					const i = (y * size + x) * 4;
					// indigo body, magenta in the folds, a cold teal in the thin
					px[i] = Math.min(255, (38 + 150 * hot + 60 * density) * density * 2);
					px[i + 1] = Math.min(
						255,
						(26 + 40 * hot + 120 * density) * density * 2,
					);
					px[i + 2] = Math.min(
						255,
						(92 + 60 * hot + 150 * density) * density * 2,
					);
					px[i + 3] = 255;
				}
			}
		},
		finish(): HTMLCanvasElement {
			if (ctx === null || img === undefined) {
				return canvas;
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
		},
	};
};
