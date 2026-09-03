import { randomFloat } from "../math/math.ts";
import type { Matrix3d } from "../math/matrix3d.ts";
import { Vector2d, vector2dPool } from "../math/vector2d.ts";
import { type Vector3d, vector3dPool } from "../math/vector3d.ts";
import type { Bounds } from "../physics/bounds.ts";

import type Container from "../renderable/container.js";
import Renderable from "../renderable/renderable.js";
import { createPool, registerPool } from "../system/pool.ts";
import CanvasRenderer from "../video/canvas/canvas_renderer.js";
import WebGLRenderer from "../video/webgl/webgl_renderer.js";
import ParticleEmitter from "./emitter.ts";

/**
 * Scratch for mapping a spawn point into the emitter's reference frame.
 * Consumed immediately, so one shared instance is enough.
 * @ignore
 * @internal
 */
const _spawn = new Vector2d();

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
	 * Whether the bounds need recomputing before anyone reads them.
	 *
	 * A `Renderable` refreshes its bounds eagerly, from a callback fired on
	 * every `pos` assignment. That is the right trade for a scene object, and
	 * the wrong one for a particle: `update()` writes `pos.x` and `pos.y`
	 * separately, so the callback fires TWICE per particle per frame, and both
	 * runs happen before `currentTransform` is rebuilt — deriving bounds from
	 * the previous frame's matrix and then throwing that away. Measured, the
	 * redundant pass was about two thirds of the whole particle update loop.
	 *
	 * So a particle invalidates instead of recomputing, and pays once, on
	 * read, for particles something actually looks at.
	 *
	 * Deliberately not a `#private` field: `updateBounds()` is reached from the
	 * base constructor chain (`Polygon.setVertices`) before a subclass's field
	 * initializers have run, and writing an undeclared private field throws.
	 * @ignore
	 * @internal
	 */
	_boundsDirty = true;

	/**
	 * @ignore
	 * @internal
	 */
	onResetEvent(emitter: ParticleEmitter, newInstance: boolean = false) {
		// reset() guarantees `settings.image` is populated before particles spawn.
		const image = emitter.settings.image as
			| HTMLCanvasElement
			| HTMLImageElement;
		// Where the particle is BORN. `getRandomPointX/Y` stay emitter-local
		// (they are public API), so under a non-local reference space the
		// point is mapped into that frame here — the particle then simulates
		// in the frame it will be measured against, which is what leaves a
		// trail behind a moving emitter instead of dragging it along.
		//
		// Assigned on every reset, new instance included: the constructor
		// seeded `pos` before the emitter's spawn mapping was consulted.
		const map = emitter._spawnMap;
		if (typeof map !== "undefined") {
			_spawn.set(emitter.getRandomPointX(), emitter.getRandomPointY());
			map.apply(_spawn);
			this.pos.set(_spawn.x, _spawn.y);
		} else {
			this.pos.set(emitter.getRandomPointX(), emitter.getRandomPointY());
		}

		if (!newInstance) {
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

		// Swap the position callback `Renderable` installs — which recomputes
		// bounds on every single assignment — for one that just marks them
		// stale. See `_boundsDirty`. Re-installed on every reset because a
		// pooled instance may have been handed back with the default.
		//
		// The cast is the `pos` type mismatch tracked in melonjs/melonJS#817:
		// `pos` is declared `Vector2d` up the shape chain but is really an
		// `ObservableVector3d`, so `setCallback` is invisible from TypeScript.
		(
			this.pos as unknown as { setCallback: (cb: () => void) => void }
		).setCallback(() => {
			this._boundsDirty = true;
			this.isDirty = true;
		});
		this._boundsDirty = true;

		// Anchor is baked into currentTransform (see update()), so reset the
		// renderable anchor to (0,0) — otherwise updateBounds() would apply
		// the default 0.5/0.5 offset on top of the already-anchored matrix.
		this.anchorPoint.set(0, 0);

		// `currentTransform` holds the COMPLETE placement, position included,
		// so the conjugation `preDraw` would otherwise apply around `pos`
		// must not run. `preDraw`/`updateBounds` are overridden below to
		// consume the matrix directly instead.
		this.autoTransform = false;

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
	 * @internal
	 * @param dt - time since the last update in milliseconds
	 */
	override update(dt: number) {
		// move things forward independent of the current frame rate
		const skew = dt * this._deltaInv;

		// Decrease particle life
		this.life = this.life > dt ? this.life - dt : 0;

		if (this.alive && this.life <= 0) {
			const parent = this.ancestor as Container;
			// IMMEDIATE removal (not the deferred `removeChild`) because the
			// instance is released to the pool on the next line: a deferred
			// removal leaves a stale `removeChildNow` pending against this
			// instance, so a same-frame respawn recycling it would be
			// silently killed by that timer, and a same-frame emitter
			// teardown would destroy an instance already sitting in the
			// pool (poisoning every later `particlePool.get()`). The
			// immediate splice is safe here — `Container.update` walks its
			// children in reverse. keepalive=true since we recycle directly.
			parent.removeChildNow(this, true);
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

		// Update particle transform — the COMPLETE placement, in one
		// setTransform(), landing the particle's centre exactly on `pos`.
		//
		// The formula itself is unchanged, but it used to be wrapped: `pos`
		// was already baked in here while `autoTransform` was left at its
		// default `true`, so `preDraw` conjugated it as `T(p)·C·T(−p)`.
		// Conjugating a matrix that already contains its own pivot is not the
		// no-op it is for a pure translation — the net translation came out as
		// `t + (I − L)p`, so the drawn centre was really `(2 − s)·p`.
		//
		// With the linear part at identity that extra term vanishes, which is
		// why it survived so long: `p` is a particle's offset from its own
		// emitter, usually a few pixels, and `minEndScale` defaults to 0 so
		// `s` fades 1 → 0 and the particle merely appeared to travel further
		// than it simulated. What made it untenable is that `p` is measured
		// from whatever frame the particle lives in — with
		// {@link ParticleEmitterSettings.referenceSpace} that can be the level
		// itself, where `p` is hundreds of pixels and a motionless particle
		// visibly flies across the screen as it fades.
		//
		// `autoTransform` is off (see `onResetEvent`) so nothing conjugates
		// this behind our back, and the position it names is the position it
		// gets.
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

		// mark as dirty if the particle is not dead yet
		this.isDirty = this.inViewport || !this.onlyInViewport;

		return super.update(dt);
	}

	/**
	 * `autoTransform` is off (see `onResetEvent`), so the base `preDraw` will
	 * not apply the matrix — append it here instead, unconjugated. Appending
	 * after `super` rather than splicing into it is order-equivalent for a
	 * particle specifically: no flip, no mask, and the anchor is zeroed, so
	 * nothing the base method emits interacts with this.
	 * @ignore
	 * @internal
	 */
	override preDraw(renderer: CanvasRenderer | WebGLRenderer) {
		super.preDraw(renderer);
		if (!this.currentTransform.isIdentity()) {
			renderer.transform(this.currentTransform);
		}
	}

	/**
	 * `currentTransform` already places the particle, so the frame it
	 * produces is positioned — only the ancestors' contribution is still
	 * missing. The base implementation would add this particle's own `pos` on
	 * top of a matrix that already contains it, counting it twice.
	 * @ignore
	 * @internal
	 */
	/**
	 * Bounds are recomputed here rather than when `pos` moves, so a particle
	 * nothing looks at this frame pays nothing at all.
	 *
	 * `updateBounds()` deliberately keeps its eager contract — a caller that
	 * asks for a recompute, such as {@link Container} aggregating child bounds
	 * under `enableChildBoundsUpdate`, still gets fresh values back.
	 * @ignore
	 * @internal
	 */
	override getBounds() {
		const bounds = super.getBounds();
		if (this._boundsDirty) {
			this.updateBounds();
		}
		return bounds;
	}

	override updateBounds(absolute = true) {
		// this IS the recompute, so whatever invalidated the bounds is now
		// satisfied. Clearing here (rather than only in `getBounds`) keeps an
		// explicit caller — `accurateBounds`, or a container aggregating child
		// bounds — from leaving the flag set and paying for a second pass.
		this._boundsDirty = false;

		if (!this.isRenderable) {
			return super.updateBounds(absolute);
		}

		const bounds: Bounds = this.getBounds();

		bounds.clear();
		// anchorPoint is (0,0) for a particle, so no anchor fixup is needed
		bounds.addFrame(0, 0, this.width, this.height, this.currentTransform);

		if (absolute && this.ancestor) {
			// ancestors only — this particle's own position is in the matrix,
			// and measured from the reference frame rather than the emitter
			// whenever those differ
			const absPos: Vector3d = this.#frameOrigin().getAbsolutePosition();
			bounds.centerOn(
				absPos.x + bounds.x + bounds.width / 2,
				absPos.y + bounds.y + bounds.height / 2,
			);
		}

		return bounds;
	}

	/**
	 * The container this particle's position is measured from — its emitter
	 * under the default local reference space, something else otherwise.
	 * @ignore
	 * @internal
	 */
	#frameOrigin(): Renderable {
		const emitter = this.ancestor as ParticleEmitter;
		const space = emitter?.settings?.referenceSpace;
		if (typeof space === "undefined" || space === "local") {
			return emitter;
		}
		if (space === "world") {
			return (emitter.ancestor as Renderable) ?? emitter;
		}
		// a destroyed container has no `pos` left to measure against
		const target = space as unknown as Renderable;
		return target && typeof target.pos !== "undefined" ? target : emitter;
	}

	/**
	 * A particle is positioned within its reference frame, which is not
	 * necessarily its parent — so summing up the ancestor chain, as the base
	 * implementation does, would measure from the wrong place.
	 * @ignore
	 * @internal
	 */
	override getAbsolutePosition() {
		const origin = this.#frameOrigin();
		if (origin === this.ancestor) {
			return super.getAbsolutePosition();
		}
		if (typeof this._absPos === "undefined") {
			this._absPos = vector3dPool.get();
		}
		// `depth` proxies to `pos.z` — the statically-declared `pos` is a
		// Vector2d even though a Renderable holds an ObservableVector3d
		this._absPos.set(this.pos.x, this.pos.y, this.depth);
		if (!this.floating) {
			this._absPos.add(origin.getAbsolutePosition());
		}
		return this._absPos;
	}

	/**
	 * With the placement in `currentTransform` and `autoTransform` off, the
	 * base composition would describe a transform this class never applies.
	 * @ignore
	 * @internal
	 */
	override getLocalTransform(out: Matrix3d) {
		return out.copy(this.currentTransform);
	}

	/**
	 * @ignore
	 * @internal
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
