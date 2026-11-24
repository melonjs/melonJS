/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Container,
	ParticleEmitter,
	type ParticleEmitterSettings,
} from "melonjs";
import { Z } from "../config";

/**
 * What every effect here has in common: particles with no image are squares,
 * two pixels across to go with the pixel art, and they stay where they were
 * emitted when their emitter moves on.
 */
const PIXELS: Partial<ParticleEmitterSettings> = {
	textureSize: 2,
	referenceSpace: "world",
	minStartScale: 1,
	maxStartScale: 1.5,
};

const UP = Math.PI / 2;
const ALL_AROUND = Math.PI * 2;

/** the settings of each burst, and how many particles one launches */
const BURSTS = {
	// kicked up from under the player's feet
	dust: {
		count: 8,
		settings: {
			...PIXELS,
			width: 10,
			height: 2,
			tint: "#cdbfa8",
			angle: UP,
			angleVariation: 1.3,
			speed: 0.7,
			speedVariation: 0.4,
			minLife: 200,
			maxLife: 450,
		},
	},
	// thrown up where the player goes through the water's surface
	splash: {
		count: 14,
		settings: {
			...PIXELS,
			width: 12,
			height: 2,
			tintOverLife: ["#ffffff", "#9fd8ff", "#4f8fd0"],
			angle: UP,
			angleVariation: 0.9,
			speed: 2.2,
			speedVariation: 0.8,
			gravity: 0.12,
			minLife: 300,
			maxLife: 600,
		},
	},
	// let out by a stroke under water: they rise
	bubbles: {
		count: 5,
		settings: {
			...PIXELS,
			width: 8,
			height: 4,
			tint: "#cfeeff",
			angle: UP,
			angleVariation: 0.5,
			speed: 0.5,
			speedVariation: 0.2,
			gravity: -0.01,
			minLife: 500,
			maxLife: 900,
		},
	},
	// an item taken, a teleport reached
	sparkle: {
		count: 16,
		settings: {
			...PIXELS,
			width: 8,
			height: 8,
			tintOverLife: ["#ffffff", "#ffe066", "#f0a020"],
			blendMode: "additive",
			angle: 0,
			angleVariation: ALL_AROUND,
			speed: 1.6,
			speedVariation: 0.6,
			gravity: 0.03,
			minLife: 300,
			maxLife: 650,
		},
	},
} satisfies Record<
	string,
	{ count: number; settings: Partial<ParticleEmitterSettings> }
>;

type Burst = keyof typeof BURSTS;

/**
 * The game's bursts of particles. Each kind has one emitter, made once and
 * aimed again at every use, rather than an emitter for every puff of dust.
 */
class Particles {
	private emitters = new Map<Burst, ParticleEmitter>();

	/**
	 * put the emitters in the world: once, when the game starts
	 * @param world - the container the game is in
	 */
	start(world: Container) {
		this.emitters.clear();
		for (const [name, { settings }] of Object.entries(BURSTS)) {
			const emitter = new ParticleEmitter(0, 0, settings);
			world.addChild(emitter, Z.particles);
			this.emitters.set(name as Burst, emitter);
		}
	}

	/**
	 * launch a burst
	 * @param name - which one
	 * @param x - the middle of where it starts, in the world
	 * @param y - the middle of where it starts, in the world
	 */
	burst(name: Burst, x: number, y: number) {
		const emitter = this.emitters.get(name);
		if (emitter === undefined) {
			return;
		}
		// an emitter's `pos` is the top left corner of the area its
		// particles are born in
		const { width, height } = BURSTS[name].settings;
		emitter.pos.set(x - width / 2, y - height / 2);
		emitter.burstParticles(BURSTS[name].count);
	}
}

export const particles = new Particles();

/**
 * The embers of a flame: a stream, for as long as its emitter is in the
 * world. (A teleport has its own, next to its flame.)
 * @param x - the middle of the flame
 * @param y - the base of the flame
 * @returns the emitter, to add and to start with `streamParticles()`
 */
export function createEmbers(x: number, y: number): ParticleEmitter {
	return new ParticleEmitter(x, y, {
		...PIXELS,
		maxStartScale: 1,
		width: 8,
		height: 2,
		tintOverLife: ["#fff3b0", "#ffc455", "#ff8a26", "#a0280c"],
		blendMode: "additive",
		totalParticles: 12,
		// one ember at a time, ten a second
		maxParticles: 1,
		frequency: 100,
		angle: UP,
		angleVariation: 0.4,
		speed: 0.45,
		speedVariation: 0.15,
		minLife: 700,
		maxLife: 1400,
	});
}
