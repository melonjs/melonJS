/**
 * melonJS — particle editor: the settings it edits.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { ParticleEmitterSettings as defaults, math } from "melonjs";

/**
 * The emitter settings the editor edits, as plain values that survive a
 * round trip through JSON. Angles are in DEGREES here, as the panel shows
 * them, and converted to radians only when handed to the emitter or written
 * out as code. `duration` 0 stands for "forever" (`Infinity`, which JSON
 * cannot hold).
 */
export interface Effect {
	width: number;
	height: number;
	depth: number;
	totalParticles: number;
	maxParticles: number;
	frequency: number;
	duration: number;
	framesToSkip: number;
	angle: number;
	angleVariation: number;
	elevation: number;
	elevationVariation: number;
	minSpread: number;
	maxSpread: number;
	speed: number;
	speedVariation: number;
	gravity: number;
	wind: number;
	followTrajectory: boolean;
	minLife: number;
	maxLife: number;
	minStartScale: number;
	maxStartScale: number;
	minEndScale: number;
	maxEndScale: number;
	minRotation: number;
	maxRotation: number;
	tint: string;
	tintOverLife: string[] | undefined;
	blendMode: string;
	textureSize: number;
	referenceSpace: "local" | "world";
	floating: boolean;
	onlyInViewport: boolean;
}

/** the angles, which the panel shows in degrees and the emitter takes in radians */
export const ANGLES = new Set<keyof Effect>([
	"angle",
	"angleVariation",
	"elevation",
	"elevationVariation",
	"minSpread",
	"maxSpread",
	"minRotation",
	"maxRotation",
]);

const deg = (radians: number) => {
	return Math.round(math.radToDeg(radians));
};

/** the emitter's own defaults, in the editor's units */
export const DEFAULT_EFFECT: Effect = {
	width: defaults.width,
	height: defaults.height,
	depth: defaults.depth,
	totalParticles: defaults.totalParticles,
	maxParticles: defaults.maxParticles,
	frequency: defaults.frequency,
	duration: 0,
	framesToSkip: defaults.framesToSkip,
	angle: deg(defaults.angle),
	angleVariation: deg(defaults.angleVariation),
	elevation: deg(defaults.elevation),
	elevationVariation: deg(defaults.elevationVariation),
	minSpread: deg(defaults.minSpread),
	maxSpread: deg(defaults.maxSpread),
	speed: defaults.speed,
	speedVariation: defaults.speedVariation,
	gravity: defaults.gravity,
	wind: defaults.wind,
	followTrajectory: defaults.followTrajectory,
	minLife: defaults.minLife,
	maxLife: defaults.maxLife,
	minStartScale: defaults.minStartScale,
	maxStartScale: defaults.maxStartScale,
	minEndScale: defaults.minEndScale,
	maxEndScale: defaults.maxEndScale,
	minRotation: deg(defaults.minRotation),
	maxRotation: deg(defaults.maxRotation),
	tint: defaults.tint,
	tintOverLife: undefined,
	blendMode: defaults.blendMode,
	textureSize: defaults.textureSize,
	referenceSpace: "local",
	floating: defaults.floating,
	onlyInViewport: defaults.onlyInViewport,
};

/** every blend mode the renderers share (see `video/blendmodes.js`) */
export const BLEND_MODES = [
	"normal",
	"additive",
	"screen",
	"multiply",
	"lighten",
	"darken",
	"overlay",
	"difference",
	"exclusion",
	"hard-light",
	"soft-light",
	"color-dodge",
	"color-burn",
];

interface FieldBase<K extends keyof Effect> {
	key: K;
	label: string;
	help: string;
	/** only meaningful with the 3D camera, where particles move along Z */
	only3d?: boolean;
}

export type Field =
	| (FieldBase<keyof Effect> & {
			kind: "number";
			min: number;
			max: number;
			step: number;
			unit?: string;
	  })
	| (FieldBase<keyof Effect> & { kind: "boolean" })
	| (FieldBase<keyof Effect> & { kind: "color" })
	| (FieldBase<keyof Effect> & { kind: "colors" })
	| (FieldBase<keyof Effect> & { kind: "select"; options: string[] });

export interface Group {
	title: string;
	fields: Field[];
}

/**
 * The properties panel. The ranges are what a slider offers; where the
 * emitter rejects or clamps a value, the range stops short of it (a frequency
 * of at least 1 ms, life and scale never negative), so the panel cannot
 * produce a setting the emitter refuses.
 */
export const GROUPS: Group[] = [
	{
		title: "Emission",
		fields: [
			{
				key: "totalParticles",
				label: "Total particles",
				kind: "number",
				min: 1,
				max: 2000,
				step: 1,
				help: "how many particles a burst throws out, and the most a stream keeps alive",
			},
			{
				key: "maxParticles",
				label: "Per emission",
				kind: "number",
				min: 1,
				max: 200,
				step: 1,
				help: "the most particles a stream launches each time it emits",
			},
			{
				key: "frequency",
				label: "Frequency",
				kind: "number",
				min: 1,
				max: 2000,
				step: 1,
				unit: "ms",
				help: "how often a stream emits",
			},
			{
				key: "duration",
				label: "Duration",
				kind: "number",
				min: 0,
				max: 30000,
				step: 100,
				unit: "ms",
				help: "how long a stream emits for; 0 for no end",
			},
			{
				key: "width",
				label: "Area width",
				kind: "number",
				min: 0,
				max: 800,
				step: 1,
				unit: "px",
				help: "the width of the area particles are born in",
			},
			{
				key: "height",
				label: "Area height",
				kind: "number",
				min: 0,
				max: 800,
				step: 1,
				unit: "px",
				help: "the height of the area particles are born in",
			},
			{
				key: "depth",
				label: "Area depth",
				kind: "number",
				min: 0,
				max: 800,
				step: 1,
				unit: "px",
				only3d: true,
				help: "the depth of the area particles are born in, along Z: a volume instead of a flat sheet",
			},
		],
	},
	{
		title: "Direction",
		fields: [
			{
				key: "angle",
				label: "Angle",
				kind: "number",
				min: -180,
				max: 180,
				step: 1,
				unit: "°",
				help: "the direction particles are thrown in: 90 is up, 0 to the right",
			},
			{
				key: "angleVariation",
				label: "Angle variation",
				kind: "number",
				min: 0,
				max: 180,
				step: 1,
				unit: "°",
				help: "how far the direction can stray from the angle, either way: 180 is every direction",
			},
			{
				key: "elevation",
				label: "Elevation",
				kind: "number",
				min: -90,
				max: 90,
				step: 1,
				unit: "°",
				only3d: true,
				help: "the direction out of the screen: 90 toward the viewer, -90 away",
			},
			{
				key: "elevationVariation",
				label: "Elevation variation",
				kind: "number",
				min: 0,
				max: 90,
				step: 1,
				unit: "°",
				only3d: true,
				help: "how far the elevation can stray; 90 with an angle variation of 180 fills a sphere",
			},
			{
				key: "minSpread",
				label: "Min spread",
				kind: "number",
				min: 0,
				max: 180,
				step: 1,
				unit: "°",
				only3d: true,
				help: "with a max spread, the narrowest angle off the axis set by the angle and elevation",
			},
			{
				key: "maxSpread",
				label: "Max spread",
				kind: "number",
				min: 0,
				max: 180,
				step: 1,
				unit: "°",
				only3d: true,
				help: "throw particles in a cone around the axis instead (0 to 180 is the whole sphere, 90 to 90 a ring)",
			},
		],
	},
	{
		title: "Motion",
		fields: [
			{
				key: "speed",
				label: "Speed",
				kind: "number",
				min: 0,
				max: 20,
				step: 0.1,
				help: "how fast particles leave the emitter",
			},
			{
				key: "speedVariation",
				label: "Speed variation",
				kind: "number",
				min: 0,
				max: 20,
				step: 0.1,
				help: "how much the speed can vary",
			},
			{
				key: "gravity",
				label: "Gravity",
				kind: "number",
				min: -1,
				max: 1,
				step: 0.01,
				help: "a pull down (or up, below 0) on every particle",
			},
			{
				key: "wind",
				label: "Wind",
				kind: "number",
				min: -1,
				max: 1,
				step: 0.01,
				help: "a push to the right (or left, below 0) on every particle",
			},
			{
				key: "followTrajectory",
				label: "Follow trajectory",
				kind: "boolean",
				help: "turn each particle the way it flies; the sprite should point right",
			},
		],
	},
	{
		title: "Life and size",
		fields: [
			{
				key: "minLife",
				label: "Min life",
				kind: "number",
				min: 0,
				max: 10000,
				step: 50,
				unit: "ms",
				help: "the shortest a particle lives",
			},
			{
				key: "maxLife",
				label: "Max life",
				kind: "number",
				min: 0,
				max: 10000,
				step: 50,
				unit: "ms",
				help: "the longest a particle lives",
			},
			{
				key: "minStartScale",
				label: "Min start scale",
				kind: "number",
				min: 0,
				max: 5,
				step: 0.05,
				help: "the smallest a particle is born",
			},
			{
				key: "maxStartScale",
				label: "Max start scale",
				kind: "number",
				min: 0,
				max: 5,
				step: 0.05,
				help: "the largest a particle is born",
			},
			{
				key: "minEndScale",
				label: "Min end scale",
				kind: "number",
				min: 0,
				max: 5,
				step: 0.05,
				help: "the smallest a particle ends",
			},
			{
				key: "maxEndScale",
				label: "Max end scale",
				kind: "number",
				min: 0,
				max: 5,
				step: 0.05,
				help: "the largest a particle ends",
			},
			{
				key: "minRotation",
				label: "Min rotation",
				kind: "number",
				min: -180,
				max: 180,
				step: 1,
				unit: "°",
				help: "the least a particle is turned at birth",
			},
			{
				key: "maxRotation",
				label: "Max rotation",
				kind: "number",
				min: -180,
				max: 180,
				step: 1,
				unit: "°",
				help: "the most a particle is turned at birth",
			},
		],
	},
	{
		title: "Look",
		fields: [
			{
				key: "tint",
				label: "Tint",
				kind: "color",
				help: "the color the texture is tinted with",
			},
			{
				key: "tintOverLife",
				label: "Tint over life",
				kind: "colors",
				help: "colors a particle goes through from birth to death, in place of the tint",
			},
			{
				key: "blendMode",
				label: "Blend mode",
				kind: "select",
				options: BLEND_MODES,
				help: "how particles mix with what is behind them; additive glows",
			},
			{
				key: "textureSize",
				label: "Square size",
				kind: "number",
				min: 1,
				max: 64,
				step: 1,
				unit: "px",
				help: "the size of the plain square used without a sprite",
			},
		],
	},
	{
		title: "Advanced",
		fields: [
			{
				key: "referenceSpace",
				label: "Reference space",
				kind: "select",
				options: ["local", "world"],
				help: "local: particles move with the emitter; world: they stay where they were born (try it with the emitter moving)",
			},
			{
				key: "framesToSkip",
				label: "Frames to skip",
				kind: "number",
				min: 0,
				max: 10,
				step: 1,
				help: "update the particles only every n + 1 frames, to save work on large effects",
			},
			{
				key: "onlyInViewport",
				label: "Only in viewport",
				kind: "boolean",
				help: "skip redrawing particles that are off screen",
			},
			{
				key: "floating",
				label: "Floating",
				kind: "boolean",
				help: "draw in screen space, ignoring the camera",
			},
		],
	},
];

/** whether two values of a setting are the same, comparing color lists by content */
export const sameValue = (a: unknown, b: unknown): boolean => {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((v, i) => v === b[i]);
	}
	return a === b;
};
