/**
 * melonJS — Earth Defender: the textures and geometry baked at boot.
 *
 * Everything here is PURE: a canvas or a vertex array built from numbers,
 * with no reference to the scene, the app or the game's state. It was inline
 * at the top of `GameController`, where it was the first two hundred lines a
 * reader had to get past to reach the game.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { BURST_TEXTURE_CORE, BURST_TEXTURE_SIZE } from "../constants";

/**
 * A laser bolt: a long capsule with a white-hot core, running down the
 * texture's own Y axis so the sprite can be turned to face its travel.
 *
 * Built as two gradients rather than one. The cross-section gives the bolt
 * its hot filament and its coloured sheath, and the length fades both ends
 * out, so the streak tapers instead of ending in two flat caps. Generated
 * rather than loaded, so the asset list stays at the things that genuinely
 * have to be authored.
 * @param w - texture width in pixels, the bolt's thickness
 * @param h - texture height in pixels, the bolt's length
 * @param core - CSS colour of the filament
 * @param edge - CSS colour of the sheath around it
 * @returns the canvas, ready to hand to a Sprite
 */
export const makeLaserTexture = (
	w: number,
	h: number,
	core: string,
	edge: string,
): HTMLCanvasElement => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (ctx === null) {
		return canvas;
	}
	// A THIN core inside a broad sheath. The bolt is drawn additively over
	// a lit planet, and a wide hot core simply adds its way to white
	// wherever the ground under it is already bright: what carries the
	// colour is the flank, so the flank is most of the bolt.
	const across = ctx.createLinearGradient(0, 0, w, 0);
	across.addColorStop(0, "rgba(0, 0, 0, 0)");
	across.addColorStop(0.18, edge);
	across.addColorStop(0.44, edge);
	across.addColorStop(0.5, core);
	across.addColorStop(0.56, edge);
	across.addColorStop(0.82, edge);
	across.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.fillStyle = across;
	ctx.fillRect(0, 0, w, h);

	// and taper it along its length: `destination-in` keeps what is already
	// drawn, weighted by this gradient's alpha
	const along = ctx.createLinearGradient(0, 0, 0, h);
	along.addColorStop(0, "rgba(0, 0, 0, 0)");
	along.addColorStop(0.22, "rgba(0, 0, 0, 1)");
	along.addColorStop(0.78, "rgba(0, 0, 0, 1)");
	along.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.globalCompositeOperation = "destination-in";
	ctx.fillStyle = along;
	ctx.fillRect(0, 0, w, h);
	return canvas;
};

/**
 * A blank white square for a quad whose look comes entirely from a shader.
 * @param size - texture edge in pixels
 * @returns the canvas, solid white
 */
export const makeBlankQuad = (size: number): HTMLCanvasElement => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx !== null) {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, size, size);
	}
	return canvas;
};

/**
 * A patch of a UNIT sphere, centred on its own tangent point, for the
 * blast waves.
 *
 * Generated rather than authored, because what it has to be is exact: a
 * grid over the tangent plane, each point pushed out onto the unit sphere
 * and then measured FROM the tangent point. Scale the result by the radius
 * a blast happened at and it is that sphere's surface, to the pixel, at
 * any size. Local Y is the outward normal, matching `surfaceMatrix`, so
 * the dip runs the correct way.
 * @param steps - grid divisions per axis
 * @param halfWidth - tangent-plane half extent, as a fraction of the radius
 * @returns vertices, uvs and indices for the patch
 */
export const sphericalCap = (steps: number, halfWidth: number) => {
	const n = steps + 1;
	const vertices = new Float32Array(n * n * 3);
	const uvs = new Float32Array(n * n * 2);
	const indices = new Uint16Array(steps * steps * 6);
	for (let j = 0; j < n; j++) {
		for (let i = 0; i < n; i++) {
			const u = (i / steps) * 2 - 1;
			const v = (j / steps) * 2 - 1;
			const x = u * halfWidth;
			const z = v * halfWidth;
			// onto the sphere, then relative to where it touches
			const len = Math.hypot(x, 1, z);
			const k = (j * n + i) * 3;
			vertices[k] = x / len;
			vertices[k + 1] = 1 / len - 1;
			vertices[k + 2] = z / len;
			const t = (j * n + i) * 2;
			uvs[t] = i / steps;
			uvs[t + 1] = j / steps;
		}
	}
	let at = 0;
	for (let j = 0; j < steps; j++) {
		for (let i = 0; i < steps; i++) {
			const a = j * n + i;
			indices[at++] = a;
			indices[at++] = a + 1;
			indices[at++] = a + n + 1;
			indices[at++] = a;
			indices[at++] = a + n + 1;
			indices[at++] = a + n;
		}
	}
	return { vertices, uvs, indices };
};

/** the quad the dome glow is drawn on: flat in local XZ, since
 * `surfaceMatrix` maps local Y to the surface normal */
export const GLOW_QUAD = {
	vertices: new Float32Array([
		-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
	]),
	uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
	indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
};

/**
 * The sprite every burst is drawn from, built once and shared.
 *
 * Not the emitter's default, which is a hard white square: see
 * {@link BURST_TEXTURE_CORE}. Held in this module because a burst can be
 * created several times a second and this is the same canvas every time.
 * @returns the debris sprite
 */
export const debrisSprite = (): HTMLCanvasElement => {
	debrisTex ??= disc(BURST_TEXTURE_SIZE, "#fff", BURST_TEXTURE_CORE);
	return debrisTex;
};

let debrisTex: HTMLCanvasElement | undefined;

/**
 * Four rock chunks on one sheet, for the body of a burst.
 *
 * {@link debrisSprite} is a soft dot, which is right for a spark and wrong
 * for a fragment of a rock: every piece of every explosion was the same
 * glowing blob. These are irregular silhouettes, so a burst reads as rubble
 * coming apart rather than as a shower of sparks, and `randomFrame: true`
 * on the emitter means each particle picks one and holds it for its whole
 * life instead of animating through them.
 *
 * Three things about the layout are load bearing:
 *
 * - **The cell is {@link BURST_TEXTURE_SIZE}, the size the single sprite
 *   was.** A particle is sized by its FRAME, so keeping the cell the same
 *   leaves every existing `BURST_*_SCALE` constant tuned exactly as it was.
 *   The match is closer than that: these come out 26.6 to 27.2 pixels wide,
 *   against the dot's solid core at `2 * BURST_TEXTURE_CORE * 32`, or 26.9.
 *   So a chunk covers what the dot's opaque middle covered, and the burst
 *   keeps its size as well as its tuning.
 * - **Nothing touches a cell edge.** Neighbouring cells are adjacent texels
 *   in one canvas, so bilinear sampling at a boundary reaches into the cell
 *   next door; the inset below is what stops a chunk growing a sliver of its
 *   neighbour.
 * - **The chunks are drawn WHITE.** `tint` multiplies, so a coloured texture
 *   comes out muddy once a rock's own brown or a bomb's orange is applied.
 *   The shading is a white-to-grey gradient, which survives any tint.
 *
 * The silhouettes are written out rather than generated: four shapes is art
 * direction, not noise, and a literal table is both deterministic for the
 * screenshot harness and readable.
 * @returns the sheet, 2 by 2 cells of {@link BURST_TEXTURE_SIZE}
 */
export const shardSheet = (): HTMLCanvasElement => {
	shardTex ??= buildShardSheet();
	return shardTex;
};

let shardTex: HTMLCanvasElement | undefined;

/** cells per row, and so per column: four chunks in a square */
const SHARD_COLUMNS = 2;

/**
 * Radii for each chunk, as a fraction of the cell's half extent, one entry
 * per vertex at equal angles around the centre. Uneven counts and uneven
 * radii are the point: equal ones would be a polygon, not a fragment.
 */
const SHARD_SHAPES: readonly (readonly number[])[] = [
	[0.95, 0.52, 0.78, 0.44, 0.88, 0.61],
	[0.6, 0.92, 0.5, 0.84, 0.97, 0.55, 0.72],
	[0.88, 0.7, 0.95, 0.48, 0.66, 0.9, 0.53, 0.8],
	[0.5, 0.86, 0.95, 0.58, 0.74],
];

/**
 * Paint {@link SHARD_SHAPES} into a grid, one chunk per cell.
 * @returns the finished canvas
 */
const buildShardSheet = (): HTMLCanvasElement => {
	const cell = BURST_TEXTURE_SIZE;
	const rows = Math.ceil(SHARD_SHAPES.length / SHARD_COLUMNS);
	const canvas = document.createElement("canvas");
	canvas.width = cell * SHARD_COLUMNS;
	canvas.height = cell * rows;
	const ctx = canvas.getContext("2d");
	if (ctx === null) {
		return canvas;
	}
	// the margin that keeps a chunk clear of its neighbours under bilinear
	// sampling, and the half extent left for the chunk itself
	const inset = 2;
	const reach = cell / 2 - inset;
	for (const [i, radii] of SHARD_SHAPES.entries()) {
		const cx = (i % SHARD_COLUMNS) * cell + cell / 2;
		const cy = Math.floor(i / SHARD_COLUMNS) * cell + cell / 2;
		ctx.beginPath();
		for (const [v, r] of radii.entries()) {
			// Started at a quarter turn per shape so the four do not all
			// present the same vertex upward, which reads as one shape
			// rotated rather than as four different ones.
			const a = (v / radii.length) * Math.PI * 2 + i * 0.4;
			const x = cx + Math.cos(a) * reach * r;
			const y = cy + Math.sin(a) * reach * r;
			if (v === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		}
		ctx.closePath();
		// lit from the top, so a tumbling chunk has a near and a far face
		const shade = ctx.createLinearGradient(0, cy - reach, 0, cy + reach);
		shade.addColorStop(0, "#ffffff");
		shade.addColorStop(1, "#6e6e6e");
		ctx.fillStyle = shade;
		ctx.fill();
	}
	return canvas;
};

/**
 * A soft dot, for stars, for the far worlds and for a spark.
 * @param size - texture edge in pixels
 * @param core - CSS colour at the centre
 * @param falloff - where the fade reaches zero, 0..1 of the radius
 * @returns the canvas, ready to hand to a Sprite
 */
export const disc = (
	size: number,
	core: string,
	falloff: number,
): HTMLCanvasElement => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx === null) {
		return canvas;
	}
	const r = size / 2;
	const g = ctx.createRadialGradient(r, r, 0, r, r, r);
	g.addColorStop(0, core);
	g.addColorStop(falloff, core);
	g.addColorStop(1, "rgba(0, 0, 0, 0)");
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	return canvas;
};
