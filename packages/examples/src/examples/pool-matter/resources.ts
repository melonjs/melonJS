/**
 * melonJS — Pool (Matter) example: asset manifest.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 *
 * The pool table backdrop (`table.png`) and the 16 numbered ball
 * sprites (`ball_1.png` … `ball_16.png`) under `public/assets/
 * pool-matter/img/` are adapted from "8-ball Pool Assets" by Casino RPG
 * on OpenGameArt.org, released under CC0 1.0 (Public Domain):
 *
 *   https://opengameart.org/content/8-ball-pool-assets?destination=node/68636
 *
 * The originals are 141×141 each; the assets shipped here have been
 * pre-shrunk to 32×32 so the loader doesn't ship 16 × 9 KB just to
 * draw them at thumbnail size. `ball_16` is the cue ball (solid white).
 */

const base = `${import.meta.env.BASE_URL}assets/pool-matter/`;

export const resources = [
	{ name: "table", type: "image", src: `${base}img/table.png` },
	// 16 numbered ball sprites, generated in one pass — keeps the
	// manifest in sync with the asset folder (rename one constant and
	// the loader entries follow).
	...Array.from({ length: 16 }, (_, i) => ({
		name: `ball_${i + 1}`,
		type: "image",
		src: `${base}img/ball_${i + 1}.png`,
	})),
];
