/**
 * melonJS — Starsweep: Bolt the robot and the space monsters, as sprites.
 *
 * Every frame of every character is in one sprite sheet, `cast.png`, baked
 * by `scripts/bake-starsweep-cast.mjs` from Kenney's Monster Builder Pack.
 * Its JSON (`cast.json`, in Aseprite's layout) holds the animations too, with
 * the time of each frame, so a `Sprite` made from the atlas gets them all:
 *
 * - `bolt-idle-<dir>`, `bolt-walk-<dir>`, `bolt-cheer`, `bolt-ko`
 * - `<kind>-walk-<dir>`, `<kind>-idle`, `<kind>-frozen`, for the wobbler,
 *   muncher and chaser
 * - `shield`, the ring around Bolt while a shield is up
 *
 * where `<dir>` is `up`, `right`, `down` or `left`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { loader, Sprite, TextureAtlas } from "melonjs";
import type { Dir } from "./board";
import type { EnemyKind } from "./levels";

/** the asset name of the sheet, image and JSON alike */
export const CAST = "starsweep-cast";

/** the frames are drawn at twice the game's size, for sharp phones */
const BAKED_SCALE = 2;
/** where a character's centre is in its 160 x 160 frame (see the bake script) */
const CENTRE = { x: 80 / 160, y: 84 / 160 };

export const DIR_NAMES = ["up", "right", "down", "left"] as const;

/** the glow behind each character */
export const GLOW: Record<EnemyKind | "bolt", string> = {
	bolt: "#7fe9ff",
	wobbler: "#5dff9a",
	muncher: "#ffcf3d",
	chaser: "#ff5d7a",
};

let atlas: TextureAtlas | null = null;

/**
 * A character: a `Sprite` over the whole cast sheet, so it can play any of
 * the animations above.
 */
export class Actor extends Sprite {
	private shownScale = -1;

	constructor(animation: string) {
		atlas ??= new TextureAtlas(
			loader.getJSON(CAST),
			loader.getImage(CAST) as HTMLImageElement,
		);
		super(0, 0, atlas.getAnimationSettings());
		this.anchorPoint.set(CENTRE.x, CENTRE.y);
		// the play screen loads levels into the world: keep the cast across it
		this.isPersistent = true;
		this.place(0, 0);
		this.play(animation);
	}

	/**
	 * put the character's centre at (x, y)
	 * @param scale - 1 is its size in the game
	 * @param alpha - 0 hides it
	 */
	place(x: number, y: number, scale = 1, alpha = 1) {
		this.pos.x = x;
		this.pos.y = y;
		if (scale !== this.shownScale) {
			// `scale()` multiplies: start again from the identity
			this.shownScale = scale;
			this.currentTransform.identity();
			this.scale(scale / BAKED_SCALE);
		}
		this.alpha = alpha;
		return this;
	}
}

/** the walk or idle animation for a direction */
export const boltAnimation = (walking: boolean, facing: Dir) =>
	`bolt-${walking ? "walk" : "idle"}-${DIR_NAMES[facing]}`;

export const monsterAnimation = (kind: EnemyKind, dir: Dir | -1) =>
	dir === -1 ? `${kind}-idle` : `${kind}-walk-${DIR_NAMES[dir]}`;
