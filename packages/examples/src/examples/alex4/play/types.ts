/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */

/** actor status (mutually exclusive), as in the original game */
export const AC_NORM = 1;
export const AC_EAT = 2;
export const AC_FULL = 3;
export const AC_SPIT = 4;
export const AC_DEAD = 5;
export const AC_BALL = 6;
export const AC_FLAT = 7;

/** actor attribute flags */
export const ACF_JUMPABLE = 0x01;
export const ACF_FLATABLE = 0x02;
export const ACF_HURTS = 0x04;
export const ACF_SHOOTABLE = 0x08;
export const ACF_BOUNCEABLE = 0x10;
export const ACF_ROLLABLE = 0x20;
export const ACF_ROLLABLE_BACK = 0x40;

export type ActorType =
	| "enemy1"
	| "enemy2"
	| "crusher"
	| "spikefish"
	| "jellyfish"
	| "cannon"
	| "boss1"
	| "boss2";

/**
 * Everything that moves on a map. Positions are in original pixels, `x` is
 * the left side and `y` the bottom (feet) of the actor.
 */
export class Actor {
	active = true;
	status = AC_NORM;
	type: ActorType | "alex";
	x: number;
	y: number;
	dx = 0;
	dy = 0;
	w = 16;
	h = 16;
	ox = 0;
	oy = 0;
	/** target x position (jumping bosses) */
	tx = 0;
	/** 0 = facing left, 1 = facing right (the sprites face left) */
	direction = 0;
	frames: string[] = [];
	flatFrame = "";
	hitFrames: string[] = [];
	frame = 0;
	animCounter = 0;
	animMax = 4;
	counter = 0;
	flags = 0;
	mode = 0;
	toggle = 0;
	ymax = 0;
	energy = 1;
	isHit = false;
	/** optional patrol range from the Alex4-WE maps */
	patrolStart = -Infinity;
	patrolEnd = Infinity;

	constructor(type: ActorType | "alex", x: number, y: number) {
		this.type = type;
		this.x = x;
		this.y = y;
	}

	/** advance the animation one tick */
	animate() {
		this.animCounter++;
		if (this.animCounter > this.animMax) {
			this.animCounter = 0;
			this.frame++;
			if (this.frame >= this.frames.length) {
				this.frame = 0;
			}
		}
	}
}

export type Bullet = {
	x: number;
	y: number;
	dx: number;
	dy: number;
	/** remaining life in ticks */
	exist: number;
	sprite: string;
	sprite2: string;
	w: number;
	h: number;
	/** true when the bullet hurts Alex */
	bad: boolean;
	animate: boolean;
	gravity: boolean;
};

export type Particle = {
	x: number;
	y: number;
	dx: number;
	dy: number;
	/** palette color (1-4), or -1 to animate the sprite */
	color: number;
	life: number;
	/** sprite name, or "" for a single pixel */
	sprite: string;
	count: number;
};

/** axis aligned bounding box overlap test, as used by the original game */
export function bbCollision(
	x1: number,
	y1: number,
	w1: number,
	h1: number,
	x2: number,
	y2: number,
	w2: number,
	h2: number,
) {
	return !(x1 >= x2 + w2 || x2 >= x1 + w1 || y1 >= y2 + h2 || y2 >= y1 + h1);
}

/** C-style random integer */
export function rand() {
	return Math.floor(Math.random() * 0x7fff);
}
