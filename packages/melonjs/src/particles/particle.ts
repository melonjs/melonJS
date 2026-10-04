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
	/**
	 * Launch velocity.
	 *
	 * `x` and `y` are the emitter's plane. `z` is only ever non-zero when the
	 * emitter was given an {@link ParticleEmitterSettings.elevation}, and the
	 * integration below skips it entirely when it is not: a 2D emitter runs
	 * exactly the path it ran before, rather than the 3D path with a zero in
	 * it.
	 */
	vel: Vector2d;
	/**
	 * Velocity along Z, kept beside `vel` rather than in it.
	 *
	 * `vel` is pooled as a `Vector2d` and every existing effect reads it as
	 * one; widening the pooled type would make every 2D emitter carry a third
	 * component it never uses. A separate number costs one double per particle
	 * and leaves the 2D path untouched.
	 */
	velZ: number;
	/** whether this particle has any Z motion at all; see {@link Particle#velZ} */
	moves3d: boolean;
	image: HTMLCanvasElement | HTMLImageElement;
	life: number;
	startLife: number;
	startScale: number;
	endScale: number;
	gravity: number;
	wind: number;
	followTrajectory: boolean;
	onlyInViewport: boolean;
	/**
	 * @ignore
	 * @internal
	 */
	_deltaInv: number;
	/**
	 * @ignore
	 * @internal
	 */
	_halfW: number;
	/**
	 * @ignore
	 * @internal
	 */
	_halfH: number;
	/**
	 * @ignore
	 * @internal
	 */
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

		// The launch. `angle` is the azimuth within the emitter's plane, and
		// `elevation` lifts out of it.
		//
		// Gated rather than generalized: an emitter with no elevation and no
		// variation runs the two trig call path it always ran and sets no Z at
		// all, so nothing existing pays for this. Only an emitter that asked
		// for depth does the extra two.
		const maxSpread = emitter.settings.maxSpread;
		if (maxSpread > 0) {
			// Aimed RELATIVE TO AN AXIS rather than within a rectangle of
			// azimuth x elevation. `angle` and `elevation` give the axis; a
			// particle leaves at a polar angle `theta` off it, around a
			// uniformly random azimuth `phi`.
			//
			// This is the only way to describe a shape defined against a
			// direction. A ring of debris tangent to a sphere is the set of
			// directions perpendicular to the surface normal, and on the
			// independent path the elevation that satisfies that is a
			// function of the azimuth, which independent sampling cannot
			// express at any variation.
			// Both taken UNJITTERED, straight off the settings: the axis is
			// the one direction the whole burst is measured against, so
			// `angleVariation` must not wobble it per particle the way it
			// does on the independent path. `minSpread`/`maxSpread` own the
			// spread here, and an axis that moves would add a second,
			// invisible one.
			const axisAngle = emitter.settings.angle;
			const axisElev = emitter.settings.elevation;
			const ce = Math.cos(axisElev);
			const ax = ce * Math.cos(axisAngle);
			const ay = -ce * Math.sin(axisAngle);
			const az = Math.sin(axisElev);

			// Any basis perpendicular to the axis will do, and the usual
			// warning about a continuous choice does not apply: `phi` is
			// uniform over the whole circle, so rotating the basis only
			// relabels which particle got which angle. The pick just has to
			// avoid being parallel to the axis, hence the branch.
			let ux: number;
			let uy: number;
			let uz: number;
			if (Math.abs(az) < 0.9) {
				// cross(axis, world Z)
				ux = ay;
				uy = -ax;
				uz = 0;
			} else {
				// cross(axis, world X)
				ux = 0;
				uy = az;
				uz = -ay;
			}
			const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
			ux /= ul;
			uy /= ul;
			uz /= ul;
			// v = axis x u, already unit since both are and they are
			// perpendicular
			const vx = ay * uz - az * uy;
			const vy = az * ux - ax * uz;
			const vz = ax * uy - ay * ux;

			const theta = randomFloat(emitter.settings.minSpread, maxSpread);
			const phi = Math.random() * Math.PI * 2;
			const ct = Math.cos(theta);
			const st = Math.sin(theta);
			const cp = Math.cos(phi);
			const sp = Math.sin(phi);
			// d = cos(theta) * axis + sin(theta) * (cos(phi) * u + sin(phi) * v)
			const dx = ct * ax + st * (cp * ux + sp * vx);
			const dy = ct * ay + st * (cp * uy + sp * vy);
			const dz = ct * az + st * (cp * uz + sp * vz);
			this.vel.set(speed * dx, speed * dy);
			this.velZ = speed * dz;
			// A ring or cone off an axis is a 3D launch whatever the numbers
			// work out to, and treating a zero `velZ` as 2D here would hand
			// the particle a stale `moves3d` from its last life in the pool.
			this.moves3d = true;
		} else {
			const elevationVariation = emitter.settings.elevationVariation;
			const elevation =
				emitter.settings.elevation +
				(Math.random() * 2 - 1) * elevationVariation;
			if (elevation === 0) {
				this.vel.set(speed * Math.cos(angle), -speed * Math.sin(angle));
				this.velZ = 0;
				this.moves3d = false;
			} else {
				// speed is the length of the whole 3D vector, so the in-plane
				// part is foreshortened by the elevation exactly as a sphere
				// requires: without the cosine an "all directions" burst would
				// bunch toward the poles instead of covering the sphere evenly
				const flat = speed * Math.cos(elevation);
				this.vel.set(flat * Math.cos(angle), -flat * Math.sin(angle));
				this.velZ = speed * Math.sin(elevation);
				this.moves3d = true;
			}
		}

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
		// Only for a particle that was actually launched out of the plane.
		// `gravity` and `wind` stay 2D: they are screen space stylings and a
		// Z equivalent has no obvious meaning until something asks for one.
		if (this.moves3d) {
			this.depth += this.velZ * skew;
		}

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
		// The emitter's own `preDraw` left its depth on the renderer, and a
		// particle's is an OFFSET from it: `Renderable#preDraw` assigns
		// `setDepth(this.depth)` rather than accumulating, so taken as is a
		// particle would be drawn at its drift alone — on the plane through
		// the world origin, whatever slice its emitter is on.
		//
		// Added here rather than stamped onto `pos.z` at spawn. A particle's
		// `pos` is local to its emitter and `getAbsolutePosition()` sums the
		// chain, so an absolute z held there is counted TWICE — which is what
		// {@link Camera3d#isVisible} then culled against, and why a burst on
		// anything but the near face of a 3D scene silently drew nothing.
		const inherited = renderer.currentDepth;
		super.preDraw(renderer);
		renderer.setDepth(inherited + this.depth);
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
			// Z is measured from the EMITTER even when x and y are not.
			// `_spawnMap` re-bases the birth point within the emitter's PLANE
			// — it is applied to a `Vector2d` — so a particle's `depth` stays
			// an offset from the emitter it left, whatever frame its x and y
			// are measured in. Read before `origin`, since both chains end at
			// the same root and the second walk overwrites the first's
			// scratch vector.
			const emitterZ = (this.ancestor as Renderable).getAbsolutePosition().z;
			const frame = origin.getAbsolutePosition();
			this._absPos.x += frame.x;
			this._absPos.y += frame.y;
			this._absPos.z += emitterZ;
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
