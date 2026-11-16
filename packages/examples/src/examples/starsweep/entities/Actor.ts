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
 *   muncher, chaser and drone (whose "walk" is its rotor spinning, looking
 *   the way it flies)
 * - `shield`, the ring around Bolt while a shield is up
 *
 * where `<dir>` is `up`, `right`, `down` or `left`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type BodyDefinition,
	Ellipse,
	loader,
	Sprite,
	TextureAtlas,
} from "melonjs";
import { DIR_NAMES, type Dir } from "../rules/board";
import type { EnemyKind } from "../rules/levels";

/** the asset name of the sheet, image and JSON alike */
export const CAST = "starsweep-cast";

/** the frames are drawn at twice the game's size, for sharp phones */
const BAKED_SCALE = 2;
/** a frame's size, in pixels (see the bake script) */
const FRAME = 160;
/** where a character's centre is in its frame, in pixels */
const CENTRE = { x: 80, y: 84 };

/** the glow behind each character */
export const GLOW: Record<EnemyKind | "bolt", string> = {
	bolt: "#7fe9ff",
	wobbler: "#5dff9a",
	muncher: "#ffcf3d",
	chaser: "#ff5d7a",
	drone: "#5fb8ff",
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
		this.anchorPoint.set(CENTRE.x / FRAME, CENTRE.y / FRAME);
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

/** how far a falling character sinks, in pixels, as it shrinks away */
const FALL_DROP = 20;

/**
 * Place a character falling off into space: sinking, shrinking and fading
 * as `falling` goes from 1 down to 0.
 * @param actor - the character
 * @param x - where it stood
 * @param y - where it stood
 * @param falling - 1 as it starts to fall, 0 once gone
 */
export const placeFalling = (
	actor: Actor,
	x: number,
	y: number,
	falling: number,
) => {
	actor.place(x, y + (1 - falling) * FALL_DROP, falling, falling);
};

/** Bolt's walk or idle animation for a direction */
export const boltAnimation = (walking: boolean, facing: Dir) =>
	`bolt-${walking ? "walk" : "idle"}-${DIR_NAMES[facing]}`;

/**
 * a monster's animation: walking a way, or standing still (`-1`)
 */
export const monsterAnimation = (kind: EnemyKind, dir: Dir | -1) =>
	dir === -1 ? `${kind}-idle` : `${kind}-walk-${DIR_NAMES[dir]}`;

/**
 * A character's body for the engine's collision detection: a circle on its
 * centre, a sensor (it reports touching, and nothing is pushed apart) that
 * gravity leaves alone, as characters are moved cell to cell by the game.
 * The frames are drawn at half size, but a body is not scaled with them:
 * the radius is in screen pixels.
 * @param radius - how far from its centre it touches things, in pixels
 * @param type - what it is (a `collision.types` value)
 * @param mask - what it touches (`collision.types` values, or-ed)
 * @returns the body definition, for `bodyDef`
 */
export const characterBody = (
	radius: number,
	type: number,
	mask: number,
): BodyDefinition => ({
	type: "dynamic",
	shapes: [new Ellipse(CENTRE.x, CENTRE.y, radius * 2, radius * 2)],
	isSensor: true,
	gravityScale: 0,
	collisionType: type,
	collisionMask: mask,
});
