import { randomFloat } from "../math/math.ts";
import { Vector2d, vector2dPool } from "../math/vector2d.ts";

import type Container from "../renderable/container.js";
import Renderable from "../renderable/renderable.js";
import { createPool, registerPool } from "../system/pool.ts";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import WebGLRenderer from "../video/webgl/webgl_renderer.js";
import ParticleEmitter from "./emitter.ts";

/**
 * Single Particle Object.
 * @category Particles
 */
export default class Particle extends Renderable {
	vel: Vector2d;
	image: HTMLCanvasElement | HTMLImageElement;
	life: number;
	startLife: number;
	startScale: number;
	endScale: number;
	gravity: number;
	wind: number;
	followTrajectory: boolean;
	onlyInViewport: boolean;
	accurateBounds: boolean;
	_deltaInv: number;
	_halfW: number;
	_halfH: number;
	_angle: number;
	alive: boolean;

	/**
	 * @param emitter - the particle emitter
	 */
	constructor(emitter: ParticleEmitter) {
		// reset() ensures `settings.image` is set to either the user image or a
		// fallback canvas before any particle is spawned.
		const image = emitter.settings.image as
			| HTMLCanvasElement
			| HTMLImageElement;
		super(
			emitter.getRandomPointX(),
			emitter.getRandomPointY(),
			image.width,
			image.height,
		);
		// particle velocity
		this.vel = vector2dPool.get();
		this.onResetEvent(emitter, true);
	}

	/**
	 * @ignore
	 */
	onResetEvent(emitter: ParticleEmitter, newInstance: boolean = false) {
		// reset() guarantees `settings.image` is populated before particles spawn.
		const image = emitter.settings.image as
			| HTMLCanvasElement
			| HTMLImageElement;
		if (!newInstance) {
			this.pos.set(emitter.getRandomPointX(), emitter.getRandomPointY());
			this.resize(image.width, image.height);
			this.currentTransform.identity();
		}

		this.image = image;

		// cache half-sizes — used every frame in the transform construction;
		// width/height stay fixed for the particle's lifetime.
		this._halfW = this.width / 2;
		this._halfH = this.height / 2;

		// Particle will always update
		this.alwaysUpdate = true;

		// Anchor is baked into currentTransform (see update()), so reset the
		// renderable anchor to (0,0) — otherwise updateBounds() would apply
		// the default 0.5/0.5 offset on top of the already-anchored matrix.
		this.anchorPoint.set(0, 0);

		if (typeof emitter.settings.tint === "string") {
			this.tint.parseCSS(emitter.settings.tint);
		}

		this.blendMode = emitter.settings.textureAdditive ? "additive" : "normal";

		if (emitter.settings.blendMode !== "normal") {
			this.blendMode = emitter.settings.blendMode;
		}

		// Sample start angle and speed around the emitter's base + variation.
		// `Math.random() * 2 - 1` gives a symmetric [-1, 1] multiplier; when the
		// variation is 0 the term collapses to 0 with no special-casing needed.
		const angle =
			emitter.settings.angle +
			(Math.random() * 2 - 1) * emitter.settings.angleVariation;
		const speed =
			emitter.settings.speed +
			(Math.random() * 2 - 1) * emitter.settings.speedVariation;

		this.vel.set(speed * Math.cos(angle), -speed * Math.sin(angle));

		// randomFloat already returns a value in [min, max] — no extra clamp needed.
		this.life = randomFloat(emitter.settings.minLife, emitter.settings.maxLife);
		this.startLife = this.life;
		this.startScale = randomFloat(
			emitter.settings.minStartScale,
			emitter.settings.maxStartScale,
		);
		this.endScale = randomFloat(
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

		// whether to refresh bounds every frame (debug-grade hitbox accuracy)
		this.accurateBounds = emitter.settings.accurateBounds;

		// read the cached delta inverse from the emitter (constant after boot)
		this._deltaInv = emitter._deltaInv;

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

		// Update particle transform — closed-form of the 4-step builder
		//   ScaleAndTranslate · T(half) · R(θ) · T(−half)
		// folded into a single setTransform() to skip 3 matrix multiplies per
		// particle per frame. See `closed-form equivalence` tests in
		// tests/emitter.spec.js for derivation + regression coverage.
		const halfW = this._halfW;
		const halfH = this._halfH;
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const sCos = scale * cos;
		const sSin = scale * sin;
		this.currentTransform.setTransform(
			sCos,
			sSin,
			0,
			0,
			-sSin,
			sCos,
			0,
			0,
			0,
			0,
			1,
			0,
			this.pos.x - scale * (halfW * cos - halfH * sin),
			this.pos.y - scale * (halfW * sin + halfH * cos),
			0,
			1,
		);

		// Refresh bounds only when the user opted in to per-frame accuracy.
		// Without this, the hitbox lags one frame behind the visual — fine for
		// viewport culling, visible only if you draw debug bounds.
		if (this.accurateBounds) {
			this.updateBounds();
		}

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
		// the transform already places (0,0) at the visual top-left corner.
		renderer.drawImage(this.image, 0, 0, w, h, 0, 0, w, h);
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

registerPool("particle", particlePool);
