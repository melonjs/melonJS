/**
 * melonJS — Starsweep: Bolt the robot and the space monsters.
 *
 * Every character is put together each frame from parts of Kenney's
 * Monster Builder Pack (bodies, eyes, mouths, legs, horns, antennae),
 * packed into `monsters.png`. Drawing the parts separately is what lets
 * them move on their own: legs step, arms swing, antennae sway, eyes look
 * where the character is heading, and a muncher's mouth chomps.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { loader } from "melonjs";
import { type Dir, DX, DY } from "./board";
import { drawGlow, type Renderer } from "./draw";
import type { EnemyKind } from "./levels";
import { PARTS, type PartName } from "./parts";

export const ATLAS = "starsweep-monsters";

let sheet: HTMLImageElement | null = null;

interface PartOpts {
	/** 0..1 point of the part placed at (x, y); default centre */
	ax?: number;
	ay?: number;
	rot?: number;
	flip?: boolean;
	/** extra vertical squash/stretch */
	sy?: number;
}

/** Draw one atlas part at (x, y), `s` screen pixels per atlas pixel. */
const part = (
	r: Renderer,
	name: PartName,
	x: number,
	y: number,
	s: number,
	opts: PartOpts = {},
) => {
	sheet ??= loader.getImage(ATLAS) as HTMLImageElement;
	const [sx, sy, sw, sh] = PARTS[name];
	const { ax = 0.5, ay = 0.5, rot = 0, flip = false, sy: stretch = 1 } = opts;
	const w = sw * s;
	const h = sh * s * stretch;
	if (rot === 0 && !flip) {
		r.drawImage(sheet, sx, sy, sw, sh, x - w * ax, y - h * ay, w, h);
		return;
	}
	r.save();
	r.translate(x, y);
	if (rot !== 0) {
		r.rotate(rot);
	}
	if (flip) {
		r.scale(-1, 1);
	}
	r.drawImage(sheet, sx, sy, sw, sh, -w * ax, -h * ay, w, h);
	r.restore();
};

export type Mood = "normal" | "happy" | "ko";

export interface BoltOpts {
	walking?: boolean;
	scale?: number;
	alpha?: number;
	shield?: boolean;
	mood?: Mood;
}

/**
 * Bolt, the little sweeper robot: a white body with a dark visor, big
 * shiny eyes, rosy cheeks and a bobbing antenna.
 */
export const drawBolt = (
	r: Renderer,
	cx: number,
	cy: number,
	facing: Dir,
	time: number,
	opts: BoltOpts = {},
) => {
	const {
		walking = false,
		scale: u = 1,
		alpha = 1,
		shield = false,
		mood = "normal",
	} = opts;
	const step = walking ? time * 16 : 0;
	const bob = walking
		? Math.abs(Math.sin(step)) * 2 * u
		: Math.sin(time * 3) * 0.8 * u;
	const by = cy - 4 * u - bob;
	const happy = mood === "happy";
	const back = facing === 0 && mood === "normal";
	const side = facing === 1 ? 1 : facing === 3 ? -1 : 0;

	drawGlow(r, cx, cy, 28 * u, "#7fe9ff", alpha * 0.8);
	r.setGlobalAlpha(alpha);

	// legs step in turn
	const lift = (k: number) =>
		walking ? Math.max(0, Math.sin(step + k * Math.PI)) * 4 * u : 0;
	part(r, "leg_whiteD", cx - 6 * u, cy + 8 * u - lift(0), 0.27 * u, { ay: 0 });
	part(r, "leg_whiteD", cx + 6 * u, cy + 8 * u - lift(1), 0.27 * u, {
		ay: 0,
		flip: true,
	});

	// arms swing, or go up in a cheer
	const swing = walking ? Math.sin(step) * 0.5 : Math.sin(time * 2) * 0.08;
	const armUp = happy ? 2.6 + Math.sin(time * 14) * 0.25 : 0;
	part(r, "arm_whiteB", cx - 15 * u, by + 2 * u, 0.22 * u, {
		ay: 0.08,
		rot: 0.25 + swing + armUp,
	});
	part(r, "arm_whiteB", cx + 15 * u, by + 2 * u, 0.22 * u, {
		ay: 0.08,
		rot: -0.25 - swing - armUp,
		flip: true,
	});

	// antenna sways behind the head
	part(r, "detail_blue_antenna_large", cx + 4 * u, by - 13 * u, 0.5 * u, {
		ax: 0.25,
		ay: 1,
		rot: Math.sin(time * 5) * 0.25 + side * 0.2,
	});

	part(r, "body_whiteA", cx, by, 0.38 * u);

	if (back) {
		// seen from behind: a little battery pack
		r.setColor("#c9cfe0");
		r.fillRoundRect(cx - 9 * u, by - 7 * u, 18 * u, 14 * u, 4 * u);
		r.setColor("#3fd7ff");
		r.fillRoundRect(cx - 6 * u, by - 2 * u, 12 * u, 4 * u, 2 * u);
		r.setGlobalAlpha(1);
		drawShield(r, cx, cy, time, shield, u);
		return;
	}

	// visor, slid towards where Bolt looks
	const vx = cx + side * 3 * u;
	r.setColor("#1b2140");
	r.fillRoundRect(vx - 12 * u, by - 11 * u, 24 * u, 15 * u, 6 * u);
	r.setGlobalAlpha(alpha * 0.25);
	r.setColor("#ffffff");
	r.fillRoundRect(vx - 9 * u, by - 10 * u, 10 * u, 3 * u, 1.5 * u);
	r.setGlobalAlpha(alpha);

	const lookX = side * 2 * u;
	const lookY = facing === 2 ? 1 * u : 0;
	const ey = by - 4 * u + lookY;
	if (mood === "ko") {
		part(r, "eye_dead", vx - 5 * u, ey, 0.28 * u);
		part(r, "eye_dead", vx + 5 * u, ey, 0.28 * u);
	} else if (happy || Math.sin(time * 1.3) > 0.985) {
		// ^ ^ when happy, and now and then a blink
		part(r, "eye_closed_happy", vx - 5 * u, ey, 0.32 * u, {
			sy: happy ? 1 : 0.6,
		});
		part(r, "eye_closed_happy", vx + 5 * u, ey, 0.32 * u, {
			sy: happy ? 1 : 0.6,
		});
	} else {
		part(r, "eye_cute_light", vx - 5 * u + lookX, ey, 0.27 * u);
		part(r, "eye_cute_light", vx + 5 * u + lookX, ey, 0.27 * u);
	}

	// rosy cheeks
	r.setGlobalAlpha(alpha * 0.55);
	r.setColor("#ff8fb4");
	r.fillEllipse(vx - 11 * u, by + 6 * u, 3.5 * u, 2 * u);
	r.fillEllipse(vx + 11 * u, by + 6 * u, 3.5 * u, 2 * u);
	r.setGlobalAlpha(alpha);
	if (happy) {
		part(r, "mouth_closed_happy", vx, by + 8 * u, 0.3 * u);
	}

	r.setGlobalAlpha(1);
	drawShield(r, cx, cy, time, shield, u);
};

const drawShield = (
	r: Renderer,
	cx: number,
	cy: number,
	time: number,
	on: boolean,
	u: number,
) => {
	if (!on) {
		return;
	}
	r.setColor("#7ff7ff");
	r.lineWidth = 3;
	const a = time * 5;
	for (let i = 0; i < 3; i++) {
		const s = a + (i * Math.PI * 2) / 3;
		r.strokeArc(cx, cy - 4 * u, 24 * u, s, s + 1.2);
	}
};

const GLOW: Record<EnemyKind, string> = {
	wobbler: "#5dff9a",
	muncher: "#ffcf3d",
	chaser: "#ff5d7a",
};

export interface MonsterOpts {
	walking?: boolean;
	scale?: number;
	alpha?: number;
	frozen?: boolean;
}

/**
 * One of the monsters:
 * - wobbler: a green blob with an eye on a stalk, wanders about,
 * - muncher: a horned one-eyed fuzzball that chomps the power back off,
 * - chaser: a red horned grump that comes straight for you.
 */
export const drawMonster = (
	r: Renderer,
	kind: EnemyKind,
	cx: number,
	cy: number,
	dir: Dir | -1,
	time: number,
	seed: number,
	opts: MonsterOpts = {},
) => {
	const { walking = true, scale: u = 1, alpha = 1, frozen = false } = opts;
	const t = frozen ? 0 : time;
	const step = walking ? t * 14 + seed : 0;
	const lift = (k: number) =>
		walking ? Math.max(0, Math.sin(step + k * Math.PI)) * 4 * u : 0;
	const lx = dir === -1 ? 0 : DX[dir] * 2.5 * u;
	const ly = dir === -1 ? 0 : DY[dir] * 1.5 * u;
	// a little squash and stretch as it hops along
	const squish = 1 + Math.sin(step * 2) * 0.05;

	drawGlow(r, cx, cy, 26 * u, GLOW[kind], alpha * 0.7);
	r.setGlobalAlpha(alpha);

	if (kind === "wobbler") {
		const by = cy - 4 * u;
		part(r, "leg_greenD", cx - 7 * u, by + 10 * u - lift(0), 0.24 * u, {
			ay: 0,
		});
		part(r, "leg_greenD", cx + 7 * u, by + 10 * u - lift(1), 0.24 * u, {
			ay: 0,
			flip: true,
		});
		part(r, "detail_green_eye", cx + 3 * u, by - 12 * u, 0.42 * u, {
			ax: 0.2,
			ay: 0.95,
			rot: Math.sin(t * 4 + seed) * 0.35,
		});
		part(r, "body_greenD", cx, by, 0.34 * u, { sy: squish });
		part(r, "eye_cute_dark", cx - 6 * u + lx, by - 3 * u + ly, 0.3 * u);
		part(r, "eye_cute_dark", cx + 6 * u + lx, by - 3 * u + ly, 0.3 * u);
		part(r, "mouthA", cx + lx * 0.5, by + 7 * u, 0.32 * u);
	} else if (kind === "muncher") {
		const by = cy - 3 * u;
		part(r, "leg_darkE", cx - 8 * u, by + 10 * u - lift(0), 0.22 * u, {
			ay: 0,
		});
		part(r, "leg_darkE", cx + 8 * u, by + 10 * u - lift(1), 0.22 * u, {
			ay: 0,
			flip: true,
		});
		part(r, "detail_dark_horn_small", cx - 10 * u, by - 13 * u, 0.7 * u, {
			rot: -0.4,
		});
		part(r, "detail_dark_horn_small", cx + 10 * u, by - 13 * u, 0.7 * u, {
			rot: 0.4,
			flip: true,
		});
		part(r, "body_darkB", cx, by, 0.34 * u, { sy: squish });
		part(r, "eye_yellow", cx + lx, by - 5 * u + ly, 0.48 * u);
		// chomp chomp
		const chomp = frozen ? 0.5 : 0.35 + Math.abs(Math.sin(t * 9 + seed)) * 0.75;
		part(r, "mouthC", cx + lx * 0.5, by + 8 * u, 0.42 * u, { sy: chomp });
	} else {
		const by = cy - 6 * u;
		part(r, "leg_redB", cx - 6 * u, by + 9 * u - lift(0), 0.2 * u, { ay: 0 });
		part(r, "leg_redB", cx + 6 * u, by + 9 * u - lift(1), 0.2 * u, {
			ay: 0,
			flip: true,
		});
		part(r, "detail_red_horn_large", cx - 8 * u, by - 15 * u, 0.55 * u, {
			rot: -0.3,
		});
		part(r, "detail_red_horn_large", cx + 8 * u, by - 15 * u, 0.55 * u, {
			rot: 0.3,
			flip: true,
		});
		part(r, "body_redC", cx, by, 0.34 * u, { sy: squish });
		part(r, "eye_angry_red", cx - 5 * u + lx, by - 4 * u + ly, 0.3 * u);
		part(r, "eye_angry_red", cx + 5 * u + lx, by - 4 * u + ly, 0.3 * u, {
			flip: true,
		});
		part(r, "eyebrowC", cx - 6 * u + lx, by - 10 * u, 0.3 * u, { rot: 0.35 });
		part(r, "eyebrowC", cx + 6 * u + lx, by - 10 * u, 0.3 * u, {
			rot: -0.35,
			flip: true,
		});
		part(r, "mouthB", cx + lx * 0.5, by + 7 * u, 0.3 * u);
	}

	if (frozen) {
		r.setGlobalAlpha(alpha * 0.45);
		r.setColor("#bff4ff");
		r.fillEllipse(cx, cy - 4 * u, 18 * u, 18 * u);
		r.setColor("#ffffff");
		r.fillRect(cx - 9 * u, cy - 14 * u, 4 * u, 8 * u);
	}
	r.setGlobalAlpha(1);
};
