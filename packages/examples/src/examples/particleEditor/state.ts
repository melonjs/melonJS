/**
 * melonJS — particle editor: what is being edited, and the emitter settings,
 * code and JSON made from it.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { math, type ParticleEmitter } from "melonjs";
import {
	ANGLES,
	DEFAULT_EFFECT,
	type Effect,
	type Field,
	GROUPS,
	sameValue,
} from "./fields";
import type { Mode, Motion, Preset } from "./presets";

/** what the emitter's constructor and `reset()` take */
export type EmitterSettings = NonNullable<
	ConstructorParameters<typeof ParticleEmitter>[2]
>;

/** how a sprite sheet is cut into frames */
export interface SpriteFrames {
	framewidth: number | undefined;
	frameheight: number | undefined;
	frames: number[] | undefined;
	randomFrame: boolean;
}

/** a sprite chosen from disk */
export interface Sprite extends SpriteFrames {
	/** the file name without its extension, used as the loader name */
	name: string;
	image: HTMLImageElement;
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
	/** a grid, and a floor, to judge sizes and motion against */
	grid: boolean;
}

/**
 * The state a preset starts from.
 * @param preset - the preset
 * @param camera - the camera to show it with; with 3D, the preset's 3D
 *   spread is added
 * @param background - the background in use, kept
 * @param grid - whether the grid is shown, kept
 * @returns the new state, without a sprite
 */
export const fromPreset = (
	preset: Preset,
	camera: CameraKind,
	background: Background,
	grid: boolean,
): EditorState => {
	return {
		effect: {
			...DEFAULT_EFFECT,
			...preset.effect,
			...(camera === "3d" ? preset.effect3d : {}),
		},
		texture: preset.texture,
		sprite: undefined,
		mode: preset.mode,
		camera,
		motion: preset.motion ?? "still",
		offset: preset.offset ?? { x: 0, y: 0 },
		background,
		grid,
	};
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
			? math.degToRad(value as number)
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

/** settings a burst does not use */
const STREAM_ONLY = new Set<keyof Effect>([
	"maxParticles",
	"frequency",
	"duration",
]);

/** the loader name of the image; undefined for the plain square */
const imageName = (state: EditorState) => {
	if (state.texture === "sprite") {
		return state.sprite?.name;
	}
	return state.texture === "square" ? undefined : state.texture;
};

/**
 * The settings written out as code or JSON: those that differ from the
 * emitter's defaults and do something with the current choices.
 */
const exported = (state: EditorState) => {
	const withImage = imageName(state) !== undefined;
	return (Object.keys(state.effect) as (keyof Effect)[]).filter((key) => {
		if (sameValue(state.effect[key], DEFAULT_EFFECT[key])) {
			return false;
		}
		if (key === "textureSize" && withImage) {
			return false;
		}
		return !(state.mode === "burst" && STREAM_ONLY.has(key));
	});
};

const literal = (value: unknown): string => {
	if (typeof value === "number") {
		return String(math.round(value, 3));
	}
	if (Array.isArray(value)) {
		return `[${value.map(literal).join(", ")}]`;
	}
	return JSON.stringify(value);
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
	const keys = exported(state);
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
		if (ANGLES.has(key)) {
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
	for (const key of exported(state)) {
		const value = state.effect[key];
		settings[key] = ANGLES.has(key)
			? math.round(math.degToRad(value as number), 6)
			: value;
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

/** every field of the properties panel, by setting */
const FIELDS = new Map<string, Field>(
	GROUPS.flatMap((group) => {
		return group.fields.map((field) => {
			return [field.key, field] as const;
		});
	}),
);

/**
 * A saved value, if the panel could have made it: numbers kept within the
 * field's range (a file asking for ten million particles would freeze the
 * page), choices among the field's options.
 */
const valid = (key: keyof Effect, value: unknown): unknown => {
	const field = FIELDS.get(key);
	if (!field) {
		return undefined;
	}
	switch (field.kind) {
		case "number": {
			if (typeof value !== "number" || !Number.isFinite(value)) {
				return undefined;
			}
			const n = ANGLES.has(key) ? math.round(math.radToDeg(value), 2) : value;
			return math.clamp(n, field.min, field.max);
		}
		case "boolean":
			return typeof value === "boolean" ? value : undefined;
		case "color":
			return typeof value === "string" ? value : undefined;
		case "colors":
			return Array.isArray(value) &&
				value.length > 0 &&
				value.every((c) => {
					return typeof c === "string";
				})
				? value
				: undefined;
		case "select":
			return field.options.includes(value as string) ? value : undefined;
	}
};

const positiveInteger = (value: unknown) => {
	return Number.isInteger(value) && (value as number) > 0
		? (value as number)
		: undefined;
};

/** the sprite sheet settings of a saved effect */
const savedFrames = (settings: Record<string, unknown>): SpriteFrames => {
	const frames = settings.frames;
	return {
		framewidth: positiveInteger(settings.framewidth),
		frameheight: positiveInteger(settings.frameheight),
		frames:
			Array.isArray(frames) &&
			frames.length > 0 &&
			frames.every((i) => {
				return Number.isInteger(i) && i >= 0;
			})
				? frames
				: undefined,
		randomFrame: settings.randomFrame === true,
	};
};

/** what opening a saved effect gives */
export interface Opened {
	state: EditorState;
	/** an image of the user's to choose again, and how to cut it */
	missing: { name: string; frames: SpriteFrames } | undefined;
}

/**
 * Read back an effect saved with {@link toJSON}. A built-in texture comes
 * back by name; any other image has to be chosen again.
 * @param text - the JSON text
 * @param current - the state it replaces, for what the file does not hold
 * @param builtIns - the built-in texture ids
 * @returns the new state, and the image to choose again, if any
 * @throws {Error} if the text is not a saved effect
 */
export const fromJSON = (
	text: string,
	current: EditorState,
	builtIns: readonly string[],
): Opened => {
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
		const checked = valid(key as keyof Effect, value);
		if (checked !== undefined) {
			target[key] = checked;
		}
	}
	const image = typeof saved.image === "string" ? saved.image : undefined;
	const known = image === undefined || builtIns.includes(image);
	return {
		state: {
			...current,
			effect,
			mode: saved.mode === "burst" ? "burst" : "stream",
			texture: image !== undefined && known ? image : "square",
			sprite: undefined,
		},
		missing:
			image !== undefined && !known
				? { name: image, frames: savedFrames(saved.settings) }
				: undefined,
	};
};
