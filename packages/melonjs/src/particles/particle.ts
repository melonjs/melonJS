import timer from "../system/timer.ts";
import { randomFloat, clamp } from "../math/math.ts";
import Renderable from "../renderable/renderable.js";
import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { createPool } from "../pool.ts";
import ParticleEmitter from "./emitter.js";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import WebGLRenderer from "../video/webgl/webgl_renderer.js";
import Container from "../renderable/container.js";

/**
 * @import ParticleEmitter from "./emitter.js";
 */

/**
 * Single Particle Object.
 */
export default class Particle extends Renderable {
	vel: Vector2d;
	image: any;
	life: number;
	startLife: number;
	startScale: number;
	endScale: number;
	gravity: number;
	wind: number;
	followTrajectory: boolean;
	onlyInViewport: boolean;
	_deltaInv: number;
	_angle: number;
	alive: boolean;

	/**
	 * @param emitter - the particle emitter
	 */
	constructor(emitter: ParticleEmitter) {
		// Call the super constructor
		super(
			emitter.getRandomPointX(),
			emitter.getRandomPointY(),
			emitter.settings.image.width,
			emitter.settings.image.height,
		);
		// particle velocity
		this.vel = vector2dPool.get();
		this.onResetEvent(emitter, true);
	}

	/**
	 * @ignore
	 */
	onResetEvent(emitter: ParticleEmitter, newInstance: boolean = false) {
		if (!newInstance) {
			this.pos.set(emitter.getRandomPointX(), emitter.getRandomPointY());
			this.resize(emitter.settings.image.width, emitter.settings.image.height);
			this.currentTransform.identity();
		}

		this.image = emitter.settings.image;

		// Particle will always update
		this.alwaysUpdate = true;

		if (typeof emitter.settings.tint === "string") {
			this.tint.parseCSS(emitter.settings.tint as any);
		}

		this.blendMode = emitter.settings.textureAdditive ? "additive" : "normal";

		if (emitter.settings.blendMode !== "normal") {
			this.blendMode = emitter.settings.blendMode;
		}

		// Set the start particle Angle and Speed as defined in emitter
		const angle =
			emitter.settings.angle +
			(emitter.settings.angleVariation > 0
				? (randomFloat(0, 2) - 1) * emitter.settings.angleVariation
				: 0);
		const speed =
			emitter.settings.speed +
			(emitter.settings.speedVariation > 0
				? (randomFloat(0, 2) - 1) * emitter.settings.speedVariation
				: 0);

		// Set the start particle Velocity
		this.vel.set(speed * Math.cos(angle), -speed * Math.sin(angle));

		// Set the start particle Time of Life as defined in emitter
		this.life = randomFloat(emitter.settings.minLife, emitter.settings.maxLife);
		this.startLife = this.life;

		// Set the start and end particle Scale as defined in emitter
		// clamp the values as minimum and maximum scales range
		this.startScale = clamp(
			randomFloat(
				emitter.settings.minStartScale,
				emitter.settings.maxStartScale,
			),
			emitter.settings.minStartScale,
			emitter.settings.maxStartScale,
		);
		this.endScale = clamp(
			randomFloat(emitter.settings.minEndScale, emitter.settings.maxEndScale),
			emitter.settings.minEndScale,
			emitter.settings.maxEndScale,
		);

		// Set the particle Gravity and Wind (horizontal gravity) as defined in emitter
		this.gravity = emitter.settings.gravity;
		this.wind = emitter.settings.wind;

		// Set if the particle update the rotation in accordance the trajectory
		this.followTrajectory = emitter.settings.followTrajectory;

		// Set if the particle update only in Viewport
		this.onlyInViewport = emitter.settings.onlyInViewport;

		// cache inverse of the expected delta time
		this._deltaInv = timer.maxfps / 1000;

		// Set the start particle rotation as defined in emitter
		// if the particle not follow trajectory
		if (!emitter.settings.followTrajectory) {
			this._angle = randomFloat(
				emitter.settings.minRotation,
				emitter.settings.maxRotation,
			);
		}

		this.alive = true;
	}

	/**
	 * Update the Particle <br>
	 * This is automatically called by the game manager {@link game}
	 * @ignore
	 * @param dt - time since the last update in milliseconds
	 */
	override update(dt: number) {
		// move things forward independent of the current frame rate
		const skew = dt * this._deltaInv;

		// Decrease particle life
		this.life = this.life > dt ? this.life - dt : 0;

		if (this.alive && this.life <= 0) {
			const parent = this.ancestor as Container;
			// use true for keepalive since we recycle the instance directly here after
			parent.removeChild(this, true);
			particlePool.release(this);
			this.alive = false;
			return false;
		}

		// Calculate the particle Age Ratio
		const ageRatio = this.life / this.startLife;

		// Resize the particle as particle Age Ratio
		let scale = this.startScale;
		if (this.startScale > this.endScale) {
			scale *= ageRatio;
			scale = scale < this.endScale ? this.endScale : scale;
		} else if (this.startScale < this.endScale) {
			scale /= ageRatio;
			scale = scale > this.endScale ? this.endScale : scale;
		}

		// Set the particle opacity as Age Ratio
		this.alpha = ageRatio;

		// Adjust the particle velocity
		this.vel.x += this.wind * skew;
		this.vel.y += this.gravity * skew;

		// If necessary update the rotation of particle in accordance the particle trajectory
		const angle = this.followTrajectory
			? Math.atan2(this.vel.y, this.vel.x)
			: this._angle;

		this.pos.x += this.vel.x * skew;
		this.pos.y += this.vel.y * skew;

		// Update particle transform
		this.currentTransform
			.setTransform(scale, 0, 0, 0, scale, 0, this.pos.x, this.pos.y, 1)
			.rotate(angle);

		// mark as dirty if the particle is not dead yet
		this.isDirty = this.inViewport || !this.onlyInViewport;

		return super.update(dt);
	}

	/**
	 * @ignore
	 */
	override draw(renderer: CanvasRenderer | WebGLRenderer) {
		const w = this.width;
		const h = this.height;
		renderer.drawImage(this.image, 0, 0, w, h, -w / 2, -h / 2, w, h);
	}
}

export const particlePool = createPool<Particle, [emitter: ParticleEmitter]>(
	(emitter) => {
		const instance = new Particle(emitter);

		return {
			instance,
			reset(emitter) {
				instance.onResetEvent(emitter, false);
			},
		};
	},
);
