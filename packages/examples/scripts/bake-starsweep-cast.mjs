/**
 * Bakes the Starsweep cast, Bolt and the three monsters, into one sprite
 * sheet: `public/assets/starsweep/cast.png` and `cast.json`.
 *
 * The characters are put together from parts of Kenney's Monster Builder
 * Pack (`public/assets/starsweep/monsters.png`): bodies, eyes, legs, horns.
 * This script poses those parts for every frame of every animation, draws
 * the frames in Chromium, trims and packs them, and writes the atlas in
 * Aseprite's JSON layout. That layout carries the animations themselves, as
 * `frameTags` with a duration on each frame, so a melonJS `Sprite` made from
 * the atlas gets every animation without a single `addAnimation` call.
 *
 * Every animation is sampled over exactly one loop of its motion (a stride,
 * a chomp, a bob), so it repeats without a jump.
 *
 * Frames are drawn at twice the game's size, for high-density screens; the
 * game draws the sprites at half scale. A character's centre (the point the
 * game places) is at ANCHOR in each CELL x CELL frame.
 *
 * Run (from packages/examples): node scripts/bake-starsweep-cast.mjs
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "public", "assets", "starsweep");

/** pixels per game pixel */
const SCALE = 2;
/** one frame, before trimming */
const CELL = 160;
/** where the character's centre sits in a frame */
const ANCHOR = { x: 80, y: 84 };
/** room left between packed frames, so filtering never bleeds a neighbour in */
const GAP = 4;
const SHEET_WIDTH = 1024;

/**
 * Where each part sits in `monsters.png` (x, y, width, height), a half-size
 * pack of the parts the cast is made from.
 */
const PARTS = {
	body_whiteA: [89, 99, 82, 82],
	body_greenD: [0, 99, 87, 91],
	body_darkB: [72, 0, 96, 96],
	body_redC: [0, 0, 70, 97],
	eye_cute_light: [160, 192, 32, 34],
	eye_cute_dark: [194, 192, 32, 34],
	eye_closed_happy: [90, 291, 21, 9],
	eye_dead: [224, 255, 16, 16],
	eye_yellow: [0, 255, 32, 34],
	eye_angry_red: [55, 255, 30, 28],
	detail_blue_antenna_large: [34, 255, 19, 29],
	detail_green_eye: [129, 192, 29, 39],
	detail_dark_horn_small: [30, 291, 16, 14],
	detail_red_horn_large: [87, 255, 20, 21],
	arm_whiteB: [173, 99, 26, 80],
	leg_whiteD: [0, 192, 36, 61],
	leg_greenD: [38, 192, 36, 61],
	leg_darkE: [76, 192, 51, 54],
	leg_redB: [201, 99, 28, 74],
	mouthA: [150, 255, 35, 17],
	mouthB: [187, 255, 35, 17],
	mouthC: [109, 255, 39, 19],
	mouth_closed_happy: [48, 291, 40, 12],
	eyebrowC: [0, 291, 28, 16],
};

const DIRS = ["up", "right", "down", "left"];

/**
 * The animations: a name, how many frames, ms per frame, and the pose of
 * each frame as a function of its phase (0 to 2π over the loop).
 */
const ANIMS = [];
DIRS.forEach((dir, d) => {
	ANIMS.push({
		name: `bolt-idle-${dir}`,
		frames: 12,
		ms: 170,
		pose: (a, k) => ({ who: "bolt", facing: d, idle: a, blink: k === 11 }),
	});
	ANIMS.push({
		name: `bolt-walk-${dir}`,
		frames: 8,
		ms: 50,
		pose: (a) => ({ who: "bolt", facing: d, step: a }),
	});
});
ANIMS.push({
	name: "bolt-cheer",
	frames: 6,
	ms: 75,
	pose: (a) => ({ who: "bolt", facing: 2, idle: a, mood: "happy" }),
});
ANIMS.push({
	name: "bolt-ko",
	frames: 1,
	ms: 1000,
	pose: () => ({ who: "bolt", facing: 2, idle: 0, mood: "ko" }),
});
ANIMS.push({
	name: "shield",
	frames: 6,
	ms: 70,
	pose: (a) => ({ who: "shield", turn: a / 3 }),
});
for (const kind of ["wobbler", "muncher", "chaser", "drone"]) {
	DIRS.forEach((dir, d) => {
		ANIMS.push({
			name: `${kind}-walk-${dir}`,
			frames: 8,
			// the drone's rotor spins faster than legs step
			ms: kind === "drone" ? 40 : 56,
			pose: (a) => ({ who: kind, dir: d, step: a }),
		});
	});
	ANIMS.push({
		name: `${kind}-idle`,
		frames: 8,
		ms: 100,
		pose: (a) => ({ who: kind, dir: -1, idle: a }),
	});
	ANIMS.push({
		name: `${kind}-frozen`,
		frames: 1,
		ms: 1000,
		pose: () => ({ who: kind, dir: 2, idle: 0, frozen: true }),
	});
}

const poses = [];
for (const anim of ANIMS) {
	for (let k = 0; k < anim.frames; k++) {
		poses.push(anim.pose((k / anim.frames) * Math.PI * 2, k));
	}
}

/**
 * Runs in the page: draws each pose into its own cell, trims it, and packs
 * the trimmed frames into one sheet.
 */
const bakeInPage = async ({
	poses,
	parts,
	sheetUrl,
	CELL,
	ANCHOR,
	SCALE,
	GAP,
	SHEET_WIDTH,
}) => {
	const sheet = new Image();
	sheet.src = sheetUrl;
	await sheet.decode();

	const DX = [0, 1, 0, -1];
	const DY = [-1, 0, 1, 0];

	const cell = document.createElement("canvas");
	cell.width = cell.height = CELL;
	const g = cell.getContext("2d");

	/** one part, `s` frame pixels per atlas pixel, placed by its (ax, ay) point */
	const part = (name, x, y, s, o = {}) => {
		const [sx, sy, sw, sh] = parts[name];
		const { ax = 0.5, ay = 0.5, rot = 0, flip = false, sy: stretch = 1 } = o;
		const w = sw * s;
		const h = sh * s * stretch;
		g.save();
		g.translate(x, y);
		g.rotate(rot);
		if (flip) g.scale(-1, 1);
		g.drawImage(sheet, sx, sy, sw, sh, -w * ax, -h * ay, w, h);
		g.restore();
	};
	const roundRect = (x, y, w, h, r, color) => {
		g.fillStyle = color;
		g.beginPath();
		g.roundRect(x, y, w, h, r);
		g.fill();
	};
	const ellipse = (x, y, rx, ry, color) => {
		g.fillStyle = color;
		g.beginPath();
		g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
		g.fill();
	};

	const bolt = (p) => {
		const u = SCALE;
		const cx = ANCHOR.x;
		const cy = ANCHOR.y;
		const walking = p.step !== undefined;
		const step = p.step ?? 0;
		const idle = p.idle ?? 0;
		const mood = p.mood ?? "normal";
		const happy = mood === "happy";
		const bob = walking
			? Math.abs(Math.sin(step)) * 2 * u
			: Math.sin(idle) * 0.8 * u;
		const by = cy - 4 * u - bob;
		const back = p.facing === 0 && mood === "normal";
		const side = p.facing === 1 ? 1 : p.facing === 3 ? -1 : 0;

		// legs step in turn
		const lift = (k) =>
			walking ? Math.max(0, Math.sin(step + k * Math.PI)) * 4 * u : 0;
		part("leg_whiteD", cx - 6 * u, cy + 8 * u - lift(0), 0.27 * u, { ay: 0 });
		part("leg_whiteD", cx + 6 * u, cy + 8 * u - lift(1), 0.27 * u, {
			ay: 0,
			flip: true,
		});

		// arms swing, or go up in a cheer
		const swing = walking ? Math.sin(step) * 0.5 : Math.sin(idle) * 0.08;
		const armUp = happy ? 2.6 + Math.sin(idle) * 0.25 : 0;
		part("arm_whiteB", cx - 15 * u, by + 2 * u, 0.22 * u, {
			ay: 0.08,
			rot: 0.25 + swing + armUp,
		});
		part("arm_whiteB", cx + 15 * u, by + 2 * u, 0.22 * u, {
			ay: 0.08,
			rot: -0.25 - swing - armUp,
			flip: true,
		});

		// the antenna sways behind the head
		const sway = walking ? Math.sin(step) * 0.2 : Math.sin(idle * 2) * 0.25;
		part("detail_blue_antenna_large", cx + 4 * u, by - 13 * u, 0.5 * u, {
			ax: 0.25,
			ay: 1,
			rot: sway + side * 0.2,
		});

		part("body_whiteA", cx, by, 0.38 * u);

		if (back) {
			// seen from behind: a little battery pack
			roundRect(cx - 9 * u, by - 7 * u, 18 * u, 14 * u, 4 * u, "#c9cfe0");
			roundRect(cx - 6 * u, by - 2 * u, 12 * u, 4 * u, 2 * u, "#3fd7ff");
			return;
		}

		// the visor, slid towards where Bolt looks
		const vx = cx + side * 3 * u;
		roundRect(vx - 12 * u, by - 11 * u, 24 * u, 15 * u, 6 * u, "#1b2140");
		g.globalAlpha = 0.25;
		roundRect(vx - 9 * u, by - 10 * u, 10 * u, 3 * u, 1.5 * u, "#ffffff");
		g.globalAlpha = 1;

		const lookX = side * 2 * u;
		const ey = by - 4 * u + (p.facing === 2 ? u : 0);
		if (mood === "ko") {
			part("eye_dead", vx - 5 * u, ey, 0.28 * u);
			part("eye_dead", vx + 5 * u, ey, 0.28 * u);
		} else if (happy || p.blink) {
			// ^ ^ when happy, and a blink now and then
			part("eye_closed_happy", vx - 5 * u, ey, 0.32 * u, {
				sy: happy ? 1 : 0.6,
			});
			part("eye_closed_happy", vx + 5 * u, ey, 0.32 * u, {
				sy: happy ? 1 : 0.6,
			});
		} else {
			part("eye_cute_light", vx - 5 * u + lookX, ey, 0.27 * u);
			part("eye_cute_light", vx + 5 * u + lookX, ey, 0.27 * u);
		}

		// rosy cheeks
		g.globalAlpha = 0.55;
		ellipse(vx - 11 * u, by + 6 * u, 3.5 * u, 2 * u, "#ff8fb4");
		ellipse(vx + 11 * u, by + 6 * u, 3.5 * u, 2 * u, "#ff8fb4");
		g.globalAlpha = 1;
		if (happy) {
			part("mouth_closed_happy", vx, by + 8 * u, 0.3 * u);
		}
	};

	const shield = (p) => {
		const u = SCALE;
		g.strokeStyle = "#7ff7ff";
		g.lineWidth = 3 * u;
		g.lineCap = "round";
		for (let i = 0; i < 3; i++) {
			const s = p.turn + (i * Math.PI * 2) / 3;
			g.beginPath();
			g.arc(ANCHOR.x, ANCHOR.y - 4 * u, 24 * u, s, s + 1.2);
			g.stroke();
		}
	};

	/** the drone: a flying saucer with a spinning rotor and one big eye */
	const drone = (p) => {
		const u = SCALE;
		const cx = ANCHOR.x;
		const t = p.step ?? p.idle ?? 0;
		const spin = p.frozen ? 0.6 : t;
		const by = ANCHOR.y - 4 * u + (p.frozen ? 0 : Math.sin(t) * 1.5 * u);
		const lx = p.dir === -1 ? 0 : DX[p.dir] * 3 * u;
		const ly = p.dir === -1 ? 0 : DY[p.dir] * 2 * u;
		// the rotor: two blades seen edge-on as they turn
		g.fillStyle = "#c9cfe0";
		for (const k of [Math.cos(spin), Math.sin(spin)]) {
			const rx = Math.max(1.5 * u, 19 * u * Math.abs(k));
			g.beginPath();
			g.ellipse(cx, by - 17 * u, rx, 2 * u, 0, 0, Math.PI * 2);
			g.fill();
		}
		roundRect(cx - 1.5 * u, by - 17 * u, 3 * u, 7 * u, u, "#8a8fbf");
		ellipse(cx, by - 17 * u, 3 * u, 2.5 * u, "#8a8fbf");
		// the hull, its dark rim and a glass dome
		ellipse(cx, by + 5 * u, 17 * u, 6 * u, "#1b2140");
		ellipse(cx, by, 15 * u, 11 * u, "#3a7bd5");
		g.globalAlpha = 0.35;
		ellipse(cx - 5 * u, by - 5 * u, 6 * u, 3.5 * u, "#ffffff");
		g.globalAlpha = 1;
		// lights round the rim, blinking in turn
		const blink = Math.sin(t * 2) > 0;
		ellipse(
			cx - 13 * u,
			by + 5 * u,
			2 * u,
			2 * u,
			blink ? "#5dff9a" : "#1f5a35",
		);
		ellipse(
			cx + 13 * u,
			by + 5 * u,
			2 * u,
			2 * u,
			blink ? "#1f5a35" : "#5dff9a",
		);
		part("eye_cute_light", cx + lx, by + ly, 0.42 * u);
		if (p.frozen) {
			g.globalAlpha = 0.45;
			ellipse(cx, by, 18 * u, 14 * u, "#bff4ff");
			g.globalAlpha = 1;
		}
	};

	const monster = (p) => {
		if (p.who === "drone") {
			drone(p);
			return;
		}
		const u = SCALE;
		const cx = ANCHOR.x;
		const cy = ANCHOR.y;
		const walking = p.step !== undefined;
		const t = walking ? p.step : (p.idle ?? 0);
		const lift = (k) =>
			walking ? Math.max(0, Math.sin(t + k * Math.PI)) * 4 * u : 0;
		const lx = p.dir === -1 ? 0 : DX[p.dir] * 2.5 * u;
		const ly = p.dir === -1 ? 0 : DY[p.dir] * 1.5 * u;
		// a little squash and stretch as it hops along
		const squish = walking ? 1 + Math.sin(t * 2) * 0.05 : 1;

		if (p.who === "wobbler") {
			const by = cy - 4 * u;
			part("leg_greenD", cx - 7 * u, by + 10 * u - lift(0), 0.24 * u, {
				ay: 0,
			});
			part("leg_greenD", cx + 7 * u, by + 10 * u - lift(1), 0.24 * u, {
				ay: 0,
				flip: true,
			});
			part("detail_green_eye", cx + 3 * u, by - 12 * u, 0.42 * u, {
				ax: 0.2,
				ay: 0.95,
				rot: Math.sin(t) * 0.35,
			});
			part("body_greenD", cx, by, 0.34 * u, { sy: squish });
			part("eye_cute_dark", cx - 6 * u + lx, by - 3 * u + ly, 0.3 * u);
			part("eye_cute_dark", cx + 6 * u + lx, by - 3 * u + ly, 0.3 * u);
			part("mouthA", cx + lx * 0.5, by + 7 * u, 0.32 * u);
		} else if (p.who === "muncher") {
			const by = cy - 3 * u;
			part("leg_darkE", cx - 8 * u, by + 10 * u - lift(0), 0.22 * u, { ay: 0 });
			part("leg_darkE", cx + 8 * u, by + 10 * u - lift(1), 0.22 * u, {
				ay: 0,
				flip: true,
			});
			part("detail_dark_horn_small", cx - 10 * u, by - 13 * u, 0.7 * u, {
				rot: -0.4,
			});
			part("detail_dark_horn_small", cx + 10 * u, by - 13 * u, 0.7 * u, {
				rot: 0.4,
				flip: true,
			});
			part("body_darkB", cx, by, 0.34 * u, { sy: squish });
			part("eye_yellow", cx + lx, by - 5 * u + ly, 0.48 * u);
			// chomp chomp
			const chomp = p.frozen ? 0.5 : 0.35 + Math.abs(Math.sin(t)) * 0.75;
			part("mouthC", cx + lx * 0.5, by + 8 * u, 0.42 * u, { sy: chomp });
		} else {
			const by = cy - 6 * u;
			part("leg_redB", cx - 6 * u, by + 9 * u - lift(0), 0.2 * u, { ay: 0 });
			part("leg_redB", cx + 6 * u, by + 9 * u - lift(1), 0.2 * u, {
				ay: 0,
				flip: true,
			});
			part("detail_red_horn_large", cx - 8 * u, by - 15 * u, 0.55 * u, {
				rot: -0.3,
			});
			part("detail_red_horn_large", cx + 8 * u, by - 15 * u, 0.55 * u, {
				rot: 0.3,
				flip: true,
			});
			part("body_redC", cx, by, 0.34 * u, { sy: squish });
			part("eye_angry_red", cx - 5 * u + lx, by - 4 * u + ly, 0.3 * u);
			part("eye_angry_red", cx + 5 * u + lx, by - 4 * u + ly, 0.3 * u, {
				flip: true,
			});
			part("eyebrowC", cx - 6 * u + lx, by - 10 * u, 0.3 * u, { rot: 0.35 });
			part("eyebrowC", cx + 6 * u + lx, by - 10 * u, 0.3 * u, {
				rot: -0.35,
				flip: true,
			});
			part("mouthB", cx + lx * 0.5, by + 7 * u, 0.3 * u);
		}

		if (p.frozen) {
			// a coat of ice
			g.globalAlpha = 0.45;
			ellipse(cx, cy - 4 * u, 18 * u, 18 * u, "#bff4ff");
			g.fillStyle = "#ffffff";
			g.fillRect(cx - 9 * u, cy - 14 * u, 4 * u, 8 * u);
			g.globalAlpha = 1;
		}
	};

	/** the smallest box around the frame's visible pixels */
	const trim = () => {
		const { data } = g.getImageData(0, 0, CELL, CELL);
		let x0 = CELL;
		let y0 = CELL;
		let x1 = -1;
		let y1 = -1;
		for (let y = 0; y < CELL; y++) {
			for (let x = 0; x < CELL; x++) {
				if (data[(y * CELL + x) * 4 + 3] > 0) {
					x0 = Math.min(x0, x);
					y0 = Math.min(y0, y);
					x1 = Math.max(x1, x);
					y1 = Math.max(y1, y);
				}
			}
		}
		if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
		if (x0 === 0 || y0 === 0 || x1 === CELL - 1 || y1 === CELL - 1) {
			throw new Error("a frame touches the edge of its cell: make CELL bigger");
		}
		return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
	};

	const frames = [];
	for (const p of poses) {
		g.clearRect(0, 0, CELL, CELL);
		if (p.who === "bolt") bolt(p);
		else if (p.who === "shield") shield(p);
		else monster(p);
		const box = trim();
		const bitmap = await createImageBitmap(cell, box.x, box.y, box.w, box.h);
		frames.push({ box, bitmap });
	}

	// shelf packing, tallest first
	const order = frames
		.map((_, i) => i)
		.sort((a, b) => frames[b].box.h - frames[a].box.h);
	let x = GAP;
	let y = GAP;
	let shelf = 0;
	for (const i of order) {
		const { box } = frames[i];
		if (x + box.w + GAP > SHEET_WIDTH) {
			x = GAP;
			y += shelf + GAP;
			shelf = 0;
		}
		frames[i].at = { x, y };
		x += box.w + GAP;
		shelf = Math.max(shelf, box.h);
	}
	const height = y + shelf + GAP;

	const out = document.createElement("canvas");
	out.width = SHEET_WIDTH;
	out.height = height;
	const o = out.getContext("2d");
	for (const f of frames) {
		o.drawImage(f.bitmap, f.at.x, f.at.y);
	}
	return {
		png: out.toDataURL("image/png"),
		width: SHEET_WIDTH,
		height,
		frames: frames.map((f) => ({ box: f.box, at: f.at })),
	};
};

// CHROMIUM_PATH: a Chromium of your own, when Playwright's is not installed
const browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();
const sheetUrl = `data:image/png;base64,${readFileSync(join(ASSETS, "monsters.png")).toString("base64")}`;
const baked = await page.evaluate(bakeInPage, {
	poses,
	parts: PARTS,
	sheetUrl,
	CELL,
	ANCHOR,
	SCALE,
	GAP,
	SHEET_WIDTH,
});
await browser.close();

// the atlas, in Aseprite's JSON layout (hash form): frames in animation
// order, and one frame tag per animation
const json = {
	frames: {},
	meta: {
		app: "bake-starsweep-cast.mjs (aseprite json layout)",
		image: "cast",
		format: "RGBA8888",
		size: { w: baked.width, h: baked.height },
		scale: "1",
		frameTags: [],
	},
};
let index = 0;
for (const anim of ANIMS) {
	json.meta.frameTags.push({
		name: anim.name,
		from: index,
		to: index + anim.frames - 1,
		direction: "forward",
	});
	for (let k = 0; k < anim.frames; k++, index++) {
		const { box, at } = baked.frames[index];
		json.frames[`${anim.name}/${k}`] = {
			frame: { x: at.x, y: at.y, w: box.w, h: box.h },
			rotated: false,
			trimmed: true,
			spriteSourceSize: { x: box.x, y: box.y, w: box.w, h: box.h },
			sourceSize: { w: CELL, h: CELL },
			duration: anim.ms,
		};
	}
}

writeFileSync(
	join(ASSETS, "cast.png"),
	Buffer.from(baked.png.split(",")[1], "base64"),
);
writeFileSync(
	join(ASSETS, "cast.json"),
	`${JSON.stringify(json, null, "\t")}\n`,
);
console.log(
	`cast.png ${baked.width}x${baked.height}, ${index} frames in ${ANIMS.length} animations`,
);
