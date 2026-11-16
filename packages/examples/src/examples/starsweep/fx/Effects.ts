/**
 * melonJS — Starsweep: bursts of particles and spark trails.
 *
 * One long-lived `ParticleEmitter` for every burst, and a `Trail` behind
 * each spark.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Container,
	ParticleEmitter,
	Trail,
	timer,
	type Vector2d,
} from "melonjs";

/** a burst's spawn area, in each axis: small, so it comes from a point */
const BURST_SIZE = 10;
/**
 * Bursts are given in pixels per second; the emitter's speed is in pixels
 * per frame at 60 fps, and a particle also eases out as it flies, so it
 * goes about this much less far than its start speed alone would take it.
 */
const BURST_SPEED_SCALE = 0.65;

/**
 * Bursts of particles and spark trails, from the engine's `ParticleEmitter`
 * and `Trail`.
 *
 * ONE long-lived emitter serves every burst: it is moved to where the next
 * one happens and given that burst's colour, speed and life just before
 * `burstParticles`. A particle copies those settings when it is born, so
 * changing them never touches the particles already flying, and
 * `referenceSpace: "world"` keeps them where they were born when the
 * emitter moves on.
 */
export class Effects {
	private readonly emitter: ParticleEmitter;
	private readonly trails = new Set<Trail>();

	constructor(
		private readonly world: Container,
		private readonly z: number,
	) {
		this.emitter = new ParticleEmitter(0, 0, {
			width: BURST_SIZE,
			height: BURST_SIZE,
			textureSize: 4,
			totalParticles: 30,
			angle: 0,
			angleVariation: Math.PI, // all the way round
			minStartScale: 0.7,
			maxStartScale: 1.4,
			minEndScale: 0,
			maxEndScale: 0.2,
			blendMode: "additive",
			referenceSpace: "world",
		});
		// level.load clears the world of everything that is not persistent
		this.emitter.isPersistent = true;
		world.addChild(this.emitter, z);
	}

	/**
	 * a burst of particles flying out from (x, y)
	 * @param speed - how fast they leave, in pixels per second
	 * @param life - how long they last, in milliseconds
	 */
	burst(
		x: number,
		y: number,
		color: string,
		count: number,
		speed: number,
		life = 220,
	) {
		const e = this.emitter;
		const s = e.settings;
		s.tint = color;
		s.speed = (speed / 60) * BURST_SPEED_SCALE;
		s.speedVariation = s.speed * 0.6;
		s.minLife = life * 0.6;
		s.maxLife = life * 1.2;
		// the spawn area hangs from the emitter's top left: centre it
		e.pos.set(x - BURST_SIZE / 2, y - BURST_SIZE / 2);
		e.burstParticles(count);
	}

	/**
	 * a glowing ribbon behind something that moves: the `Trail` follows
	 * `target` until `stop` is called
	 */
	trail(target: Vector2d) {
		const trail = new Trail({
			target,
			length: 10,
			width: 9,
			lifetime: 170,
			widthCurve: [1, 0],
			gradient: ["#ffffff", "#fff2a8", "#ffd23d00"],
		});
		trail.blendMode = "additive";
		this.world.addChild(trail, this.z);
		this.trails.add(trail);
		return trail;
	}

	/** let a trail fade out, then take it away */
	stop(trail: Trail) {
		trail.target = null;
		timer.setTimeout(() => this.drop(trail), 200);
	}

	private drop(trail: Trail) {
		if (this.trails.delete(trail) && trail.ancestor) {
			this.world.removeChild(trail);
		}
	}

	/** take everything off the world, for good */
	destroy() {
		for (const trail of [...this.trails]) {
			this.drop(trail);
		}
		if (this.emitter.ancestor) {
			this.world.removeChild(this.emitter);
		}
	}
}
