/**
 * melonJS — particle editor: a random effect.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DEFAULT_EFFECT, type Effect } from "./fields";
import type { EditorState } from "./state";

const between = (min: number, max: number, step = 0.01) => {
	return Math.round((min + Math.random() * (max - min)) / step) * step;
};

const chance = (p: number) => {
	return Math.random() < p;
};

const pick = <T>(list: readonly T[]): T => {
	return list[Math.floor(Math.random() * list.length)];
};

/** a CSS color from hue, saturation and lightness */
const hsl = (h: number, s: number, l: number) => {
	const k = (n: number) => {
		return (n + h / 30) % 12;
	};
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const v = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
		return Math.round(v * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * Colors over a life that read as one effect: a hue walked a little from
 * bright toward dark, as embers, magic or water fade.
 */
const palette = () => {
	const hue = Math.random() * 360;
	const drift = between(-60, 60, 1);
	const count = pick([2, 3, 4]);
	return Array.from({ length: count }, (_, i) => {
		const t = i / (count - 1);
		return hsl(
			(hue + drift * t + 360) % 360,
			0.85,
			// start near white, end dark
			0.92 - t * 0.7,
		);
	});
};

/**
 * A random effect. The values are drawn from ranges that make a visible,
 * reasonable effect, not from the whole range of every slider: a random
 * draw over those would mostly give nothing on screen or a white-out.
 * @param current - the state it replaces, for the camera, background and grid
 * @param textures - the built-in texture ids to choose from
 * @returns the new state
 */
export const randomState = (
	current: EditorState,
	textures: readonly string[],
): EditorState => {
	const mode = chance(0.7) ? "stream" : "burst";
	const texture = pick(textures.filter((t) => t !== "square"));
	const additive = chance(0.55);
	const speed = between(0.5, 7, 0.1);
	const minLife = between(300, 1500, 50);
	// additive particles add up to white where they overlap: keep them smaller
	const startScale = additive
		? between(0.3, 0.8, 0.05)
		: between(0.4, 1.4, 0.05);
	const endScale = chance(0.6) ? between(0, 0.4, 0.05) : between(1, 2.5, 0.05);
	const wide = chance(0.3);
	const is3d = current.camera === "3d";
	const motion = chance(0.2) ? pick(["sway", "circle"] as const) : "still";

	const effect: Effect = {
		...DEFAULT_EFFECT,
		width: wide ? between(150, 500, 1) : between(0, 40, 1),
		height: wide ? between(0, 60, 1) : between(0, 40, 1),
		totalParticles:
			mode === "burst" ? between(80, 500, 1) : between(60, 400, 1),
		maxParticles: additive ? between(1, 4, 1) : between(1, 8, 1),
		frequency: between(10, 120, 1),
		// mostly up, sometimes any way
		angle: chance(0.6) ? 90 : between(-180, 180, 1),
		angleVariation: mode === "burst" && chance(0.5) ? 180 : between(0, 60, 1),
		speed,
		speedVariation: between(0, speed * 0.6, 0.1),
		gravity: chance(0.4) ? between(-0.1, 0.3, 0.01) : 0,
		wind: chance(0.25) ? between(-0.05, 0.05, 0.01) : 0,
		followTrajectory: texture === "spark",
		minLife,
		maxLife: minLife + between(200, 1500, 50),
		minStartScale: startScale,
		maxStartScale: startScale + between(0, 0.6, 0.05),
		minEndScale: endScale,
		maxEndScale: endScale + between(0, 0.3, 0.05),
		minRotation: chance(0.3) ? -180 : 0,
		maxRotation: chance(0.3) ? 180 : 0,
		tint: hsl(Math.random() * 360, 0.8, 0.65),
		tintOverLife: chance(0.6) ? palette() : undefined,
		blendMode: additive ? "additive" : pick(["normal", "normal", "screen"]),
		// a moving emitter mostly leaves a trail
		referenceSpace: motion !== "still" && chance(0.7) ? "world" : "local",
	};
	if (is3d && chance(0.6)) {
		// a cone, a ring or a sphere around a random axis
		effect.elevation = between(-60, 60, 1);
		const shape = pick(["cone", "ring", "sphere"]);
		effect.minSpread = shape === "ring" ? 90 : 0;
		effect.maxSpread =
			shape === "ring" ? 90 : shape === "sphere" ? 180 : between(10, 45, 1);
	}

	return {
		...current,
		effect,
		texture,
		sprite: current.sprite,
		mode,
		motion,
		offset: { x: 0, y: mode === "stream" && effect.angle === 90 ? 0.2 : 0 },
	};
};
