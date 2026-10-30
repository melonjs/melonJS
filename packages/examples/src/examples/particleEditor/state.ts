/**
 * melonJS — particle editor: what is being edited, and the emitter settings,
 * code and JSON made from it.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { ParticleEmitter } from "melonjs";
import { ANGLES, DEFAULT_EFFECT, type Effect, sameValue } from "./fields";
import type { Mode, Motion, Preset } from "./presets";

/** what the emitter's constructor and `reset()` take */
export type EmitterSettings = NonNullable<
	ConstructorParameters<typeof ParticleEmitter>[2]
>;

/** a sprite chosen from disk, with how to cut it when it is a sheet */
export interface Sprite {
	/** the file name without its extension, used as the loader name */
	name: string;
	image: HTMLImageElement;
	framewidth: number | undefined;
	frameheight: number | undefined;
	frames: number[] | undefined;
	randomFrame: boolean;
}

export type Background = "dark" | "light" | "checker";
export type CameraKind = "2d" | "3d";

export interface EditorState {
	effect: Effect;
	/** a built-in texture id, or "sprite" for {@link EditorState.sprite} */
	texture: string;
	sprite: Sprite | undefined;
	mode: Mode;
	camera: CameraKind;
	motion: Motion;
	/** where the emitter sits, as a share of the preview from its center */
	offset: { x: number; y: number };
	background: Background;
}

/**
 * The state a preset starts from.
 * @param preset - the preset
 * @param camera - the camera in use, kept unless the preset needs 3D
 * @param background - the background in use, kept
 * @returns the new state, without a sprite
 */
export const fromPreset = (
	preset: Preset,
	camera: CameraKind,
	background: Background,
): EditorState => {
	return {
		effect: { ...DEFAULT_EFFECT, ...preset.effect },
		texture: preset.texture,
		sprite: undefined,
		mode: preset.mode,
		camera: preset.camera ?? camera,
		motion: preset.motion ?? "still",
		offset: preset.offset ?? { x: 0, y: 0 },
		background,
	};
};

const radians = (degrees: number) => {
	return (degrees * Math.PI) / 180;
};

/**
 * The settings to hand the emitter.
 * @param state - the editor state
 * @param image - the particle image, undefined for the emitter's own square
 * @returns the emitter settings
 */
export const emitterSettings = (
	state: EditorState,
	image: HTMLCanvasElement | HTMLImageElement | undefined,
): EmitterSettings => {
	const settings: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(state.effect)) {
		settings[key] = ANGLES.has(key as keyof Effect)
			? radians(value as number)
			: value;
	}
	settings.duration =
		state.effect.duration > 0 ? state.effect.duration : Infinity;
	settings.image = image;
	const sprite = state.texture === "sprite" ? state.sprite : undefined;
	if (sprite) {
		settings.framewidth = sprite.framewidth;
		settings.frameheight = sprite.frameheight;
		settings.frames = sprite.frames;
		settings.randomFrame = sprite.randomFrame;
	}
	return settings as EmitterSettings;
};

/** the settings that differ from the emitter's defaults, in editor units */
const changed = (effect: Effect) => {
	return (Object.keys(effect) as (keyof Effect)[]).filter((key) => {
		return !sameValue(effect[key], DEFAULT_EFFECT[key]);
	});
};

const round = (n: number, places = 3) => {
	const f = 10 ** places;
	return Math.round(n * f) / f;
};

const literal = (value: unknown): string => {
	if (typeof value === "number") {
		return String(round(value));
	}
	if (Array.isArray(value)) {
		return `[${value.map(literal).join(", ")}]`;
	}
	return JSON.stringify(value);
};

/** the loader name of the image, undefined for the emitter's own square */
const imageName = (state: EditorState) => {
	if (state.texture === "sprite") {
		return state.sprite?.name;
	}
	return state.texture === "square" ? undefined : state.texture;
};

export type Language = "ts" | "js";

/**
 * The code that makes this effect in a game.
 * @param state - the editor state
 * @param language - TypeScript, or JavaScript
 * @returns the source
 */
export const toCode = (state: EditorState, language: Language): string => {
	const name = imageName(state);
	const lines: string[] = [];
	const keys = changed(state.effect).filter((key) => {
		return !(name !== undefined && key === "textureSize");
	});
	const usesMath = keys.some((key) => {
		return ANGLES.has(key);
	});

	const imports = [
		...(name !== undefined ? ["loader"] : []),
		...(usesMath ? ["math"] : []),
		"ParticleEmitter",
	];
	lines.push(`import { ${imports.join(", ")} } from "melonjs";`, "");
	if (name !== undefined) {
		lines.push(
			"// in the list of assets to preload:",
			`// { name: "${name}", type: "image", src: "data/img/${name}.png" },`,
			"",
		);
	}
	lines.push(
		"// x, y: where the effect goes in your level",
		"const emitter = new ParticleEmitter(x, y, {",
	);
	if (name !== undefined) {
		// `getImage` is typed for every kind of image the loader holds, wider
		// than what an emitter draws, so TypeScript needs it narrowed
		const cast = language === "ts" ? " as HTMLImageElement" : "";
		lines.push(`\timage: loader.getImage("${name}")${cast},`);
	}
	const sprite = state.texture === "sprite" ? state.sprite : undefined;
	if (sprite) {
		if (sprite.framewidth !== undefined) {
			lines.push(`\tframewidth: ${sprite.framewidth},`);
		}
		if (sprite.frameheight !== undefined) {
			lines.push(`\tframeheight: ${sprite.frameheight},`);
		}
		if (sprite.frames !== undefined) {
			lines.push(`\tframes: ${literal(sprite.frames)},`);
		}
		if (sprite.randomFrame) {
			lines.push("\trandomFrame: true,");
		}
	}
	for (const key of keys) {
		const value = state.effect[key];
		if (key === "duration") {
			// only a stream has a duration
			if (state.mode === "stream") {
				lines.push(`\tduration: ${literal(value)},`);
			}
		} else if (ANGLES.has(key)) {
			lines.push(`\t${key}: math.degToRad(${literal(value)}),`);
		} else {
			lines.push(`\t${key}: ${literal(value)},`);
		}
	}
	lines.push("});", "app.world.addChild(emitter);");
	lines.push(
		state.mode === "stream"
			? "emitter.streamParticles();"
			: "emitter.burstParticles();",
	);
	return `${lines.join("\n")}\n`;
};

/** what a saved effect holds */
interface SavedEffect {
	format: "melonjs-particle-effect";
	version: 1;
	/** the loader name of the image, absent for the emitter's own square */
	image?: string;
	mode: Mode;
	/** the settings that differ from the defaults, as the emitter takes them */
	settings: Record<string, unknown>;
}

/**
 * The effect as JSON, with the settings in the emitter's own units, so a game
 * can load it and spread it into the emitter:
 * `new ParticleEmitter(x, y, { ...saved.settings, image })`.
 * @param state - the editor state
 * @returns the JSON text
 */
export const toJSON = (state: EditorState): string => {
	const settings: Record<string, unknown> = {};
	const name = imageName(state);
	for (const key of changed(state.effect)) {
		const value = state.effect[key];
		if (key === "duration") {
			if (state.mode === "stream") {
				settings.duration = value;
			}
		} else if (key === "textureSize" && name !== undefined) {
			// unused with an image
		} else {
			settings[key] = ANGLES.has(key)
				? round(radians(value as number), 6)
				: value;
		}
	}
	const sprite = state.texture === "sprite" ? state.sprite : undefined;
	if (sprite) {
		for (const key of ["framewidth", "frameheight", "frames"] as const) {
			if (sprite[key] !== undefined) {
				settings[key] = sprite[key];
			}
		}
		if (sprite.randomFrame) {
			settings.randomFrame = true;
		}
	}
	const saved: SavedEffect = {
		format: "melonjs-particle-effect",
		version: 1,
		...(name !== undefined ? { image: name } : {}),
		mode: state.mode,
		settings,
	};
	return `${JSON.stringify(saved, null, "\t")}\n`;
};

/**
 * Read back an effect saved with {@link toJSON}. A built-in texture comes
 * back by name; any other image has to be chosen again.
 * @param text - the JSON text
 * @param current - the state it replaces, for what the file does not hold
 * @param builtIns - the built-in texture ids, which come back by name
 * @returns the new state, and the name of an image to choose again, if any
 * @throws {Error} if the text is not a saved effect
 */
export const fromJSON = (
	text: string,
	current: EditorState,
	builtIns: readonly string[],
): { state: EditorState; missing: string | undefined } => {
	const saved = JSON.parse(text) as Partial<SavedEffect>;
	if (
		saved?.format !== "melonjs-particle-effect" ||
		typeof saved.settings !== "object" ||
		saved.settings === null
	) {
		throw new Error("this is not a particle effect saved by the editor");
	}
	const effect: Effect = { ...DEFAULT_EFFECT };
	const target = effect as unknown as Record<string, unknown>;
	for (const [key, value] of Object.entries(saved.settings)) {
		if (!(key in DEFAULT_EFFECT)) {
			continue;
		}
		const expected = typeof DEFAULT_EFFECT[key as keyof Effect];
		if (key === "tintOverLife") {
			if (
				Array.isArray(value) &&
				value.length > 0 &&
				value.every((c) => {
					return typeof c === "string";
				})
			) {
				target[key] = value;
			}
		} else if (typeof value === expected) {
			target[key] = ANGLES.has(key as keyof Effect)
				? round(((value as number) * 180) / Math.PI, 2)
				: value;
		}
	}
	const image = typeof saved.image === "string" ? saved.image : undefined;
	const known = image === undefined || builtIns.includes(image);
	return {
		state: {
			...current,
			effect,
			mode: saved.mode === "burst" ? "burst" : "stream",
			texture: image === undefined ? "square" : known ? image : "square",
			sprite: undefined,
		},
		missing: known ? undefined : image,
	};
};
