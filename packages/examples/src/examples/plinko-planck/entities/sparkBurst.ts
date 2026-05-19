/**
 * melonJS — Plinko (Planck) example: spark-burst helper.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Thin wrapper around the engine's `ParticleEmitter` that spawns a
 * one-shot radial burst of tinted particles, attaches it to the world
 * container, fires the burst, and lets the emitter auto-destroy on
 * completion. Used by `Slot.collect` to spray sparks when a ball
 * lands.
 */

import type { Container } from "melonjs";
import { ParticleEmitter } from "melonjs";

/**
 * Spawn a one-shot radial spark burst at (x, y) inside `world`. The
 * emitter handles its own lifetime + cleanup via
 * `autoDestroyOnComplete: true`.
 * @param world parent container to attach the emitter to
 * @param x world-space X centre of the burst
 * @param y world-space Y centre of the burst
 * @param count number of particles to spawn
 * @param tint CSS colour string to tint the default white particles
 * @param speed peak emission speed in px/frame
 */
export const spawnSparkBurst = (
	world: Container,
	x: number,
	y: number,
	count: number,
	tint: string,
	speed = 4,
): void => {
	const emitter = new ParticleEmitter(x, y, {
		width: 4,
		height: 4,
		tint,
		totalParticles: count,
		// full 2π radial spread
		angle: 0,
		angleVariation: Math.PI * 2,
		minLife: 250,
		maxLife: 500,
		speed,
		// Speed variation gives the burst a less synthetic, more
		// "fireworks" look — some particles shoot out fast, others
		// linger near the origin.
		speedVariation: speed * 0.6,
		autoDestroyOnComplete: true,
	});
	world.addChild(emitter, 50);
	emitter.burstParticles();
};
