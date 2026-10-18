/**
 * melonJS — Earth Defender: everything an explosion throws off.
 *
 * The particle bursts, the impact lights and the blast waves that lie on the
 * globe's own curvature. Self-contained on purpose: it knows the application
 * it draws into and nothing else about the game, so it reaches for no rock,
 * no bolt, no score and no camera. That is what let it leave
 * `GameController`, where it was 465 lines sitting between the gun and the
 * scoring.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	Color,
	Light3d,
	loader,
	Mesh,
	math,
	ParticleEmitter,
	type ShaderEffect,
	Vector3d,
} from "melonjs";
import {
	BURST_DEBRIS_MAX,
	BURST_DEBRIS_MIN,
	BURST_DEBRIS_PER_AREA,
	BURST_END_SCALE_MAX,
	BURST_END_SCALE_MIN,
	BURST_LIFE,
	BURST_RING_MAX,
	BURST_RING_MIN,
	BURST_SPARK_LIFE,
	BURST_SPARK_SCALE_MAX,
	BURST_SPARK_SCALE_MIN,
	BURST_SPARK_SHARE,
	BURST_SPARK_SPEED,
	BURST_SPEED,
	BURST_SPLIT_FRACTION,
	BURST_START_SCALE_MAX,
	BURST_START_SCALE_MIN,
	BURST_TERMINAL_BOOST,
	BURST_TERMINAL_MIN,
	BURST_TEXTURE_SIZE,
	DOME_R,
	FLASH_POOL,
	FLASH_ROCK_RANGE,
	PLANET_R,
	PLANET_Z,
	RIPPLE_EXPOSURE,
	RIPPLE_LIFE_MS,
	RIPPLE_LIFT,
	RIPPLE_POOL,
	RIPPLE_RADIUS,
	RIPPLE_SHADER,
	RIPPLE_TINT,
	SHOCK_BONUS_TINT,
	SHOCK_CAP_HALF,
	SHOCK_CAP_STEPS,
	SHOCK_EXPOSURE,
	SHOCK_ICE_TINT,
	SHOCK_LIFE_MS,
	SHOCK_POOL,
	SHOCK_SHADER,
	SHOCK_SIZE_RATIO,
	SHOCK_TINT,
	TINT_ROCK_EXPLOSION,
} from "../constants";
import { bridgeY, onGlobe, surfaceMatrixWorld } from "../lib/sphereMath";
import { debrisSprite, shardSheet, sphericalCap } from "./textures";

/** the blast colours, resolved once from their CSS and shared with the game */
export const shockRgb = new Float32Array(3);
export const iceRgb = new Float32Array(3);
export const bonusRgb = new Float32Array(3);
/** and the dome ring's, which never varies per event */
const rippleRgb = new Float32Array(3);
const shockTint = new Color().parseCSS(SHOCK_TINT);

/** scratch shared by everything in this file */
const _at: [number, number, number] = [0, 0, 0];
const _bridged = new Vector3d();

export class BlastFx {
	/** idle blast waves, and the ones currently expanding */
	readonly shockPool: { quad: Mesh; fx: ShaderEffect }[] = [];
	/** the dome's own rings, a second pool sharing the machinery below */
	readonly ripplePool: { quad: Mesh; fx: ShaderEffect }[] = [];
	private shocks: {
		quad: Mesh;
		fx: ShaderEffect;
		/** where on the globe it happened, and at what altitude */
		at: Vector3d;
		altitude: number;
		ageMs: number;
		lifeMs: number;
		/** the pool it goes back to, since two kinds share this list */
		home: { quad: Mesh; fx: ShaderEffect }[];
	}[] = [];
	/** the impact lights, and what is left of each one's life */
	private flashLights: Light3d[] = [];
	private flashRemainingMs: number[] = [];
	private flashLifeMs: number[] = [];
	private flashPeak: number[] = [];
	private nextFlash = 0;
	private app: Application;

	constructor(app: Application) {
		this.app = app;
		this.initShockTints();
		this.initFlashLights(app);
		this.initCapPool(
			SHOCK_SHADER,
			SHOCK_EXPOSURE,
			shockRgb,
			SHOCK_POOL,
			this.shockPool,
		);
		// Its own pool, not a bigger shared one: a dome ring and a blast wave
		// must never compete for the same quad, or a hit on the glass
		// silently eats the wave from a rock dying in the same frame.
		this.initCapPool(
			RIPPLE_SHADER,
			RIPPLE_EXPOSURE,
			rippleRgb,
			RIPPLE_POOL,
			this.ripplePool,
		);
	}

	/**
	 * Hand back everything this holds that the world does not.
	 *
	 * The stage's own reset destroys world CHILDREN, which is the lights and
	 * any quad currently in flight. The idle quads sitting in the two pools
	 * are not children of anything, so nothing would ever free them or the
	 * shader clone each one carries. That did not matter while a run ended
	 * in place; now that a death goes back to the menu and a new game builds
	 * a fresh scene, it would leak a set per game.
	 */
	destroy(): void {
		for (const w of this.shocks) {
			this.app.world.removeChild(w.quad);
		}
		this.shocks.length = 0;
		for (const pool of [this.shockPool, this.ripplePool]) {
			for (const { fx } of pool) {
				// The shader clone is the expensive half and `ShaderEffect`
				// exposes `destroy()`. The quad itself is left to the
				// collector: `Renderable#destroy` is `@internal`, so a game
				// has no public way to free a renderable it owns outside a
				// container. Its vertex data is a plain array; the GPU
				// buffers belong to the renderer's batcher, not to it.
				fx.destroy();
			}
			pool.length = 0;
		}
		for (const light of this.flashLights) {
			this.app.world.removeChild(light);
		}
		this.flashLights.length = 0;
	}

	/**
	 * Lay every live wave on the curvature it happened at.
	 *
	 * Called from `placeWorld`, the one place the sphere meets the engine:
	 * the waves are placed alongside everything else rather than each
	 * subsystem reaching for the globe on its own.
	 */
	place(): void {
		for (const w of this.shocks) {
			onGlobe(w.at, w.altitude, PLANET_Z, _at);
			w.quad.setPosition(_at[0], _at[1], _at[2]);
			// The Y-down bridge, undone before the orientation is built. Only
			// Y, because these quads are not `rightHanded` and so take the
			// reflection form rather than the rotation form: see `bridgeY`.
			bridgeY(w.at, false, _bridged);
			surfaceMatrixWorld(_bridged, w.quad.currentTransform);
			// the patch is a UNIT sphere's surface, so the scale that gives
			// it the planet's curvature is simply the radius it happened at
			w.quad.currentTransform.scale(w.altitude, w.altitude, w.altitude);
		}
	}

	/**
	 * Build the impact lights up front and leave them in the world at zero
	 * intensity. See {@link FLASH_POOL}.
	 * @param app - the application to add them to
	 */
	initFlashLights(app: Application): void {
		for (let i = 0; i < FLASH_POOL; i++) {
			const light = new Light3d({
				type: "point",
				intensity: 0,
				range: FLASH_ROCK_RANGE,
				color: TINT_ROCK_EXPLOSION,
			});
			app.world.addChild(light);
			this.flashLights.push(light);
			this.flashRemainingMs.push(0);
			this.flashLifeMs.push(1);
			this.flashPeak.push(0);
		}
	}

	/**
	 * One pool of curved patches, for a shader that draws rings on the shell.
	 *
	 * The blast waves and the dome's rings are the same object with a
	 * different shader on it: a unit spherical cap, additive, unlit, scaled
	 * per event to the curvature it is lying on. They were two near-identical
	 * builders that each generated the same patch geometry, so the mesh was
	 * built and held twice.
	 *
	 * Separate POOLS, though, deliberately: a ring and a blast must never
	 * compete for the same quad, or a dome hit can silently eat the wave from
	 * a rock dying in the same frame.
	 * @param shaderName - the loaded shader to clone onto each quad
	 * @param exposure - how hard that shader is driven
	 * @param rgb - its colour, as a linear triple
	 * @param count - how many to build
	 * @param into - the pool array to fill
	 */
	initCapPool(
		shaderName: string,
		exposure: number,
		rgb: Float32Array,
		count: number,
		into: { quad: Mesh; fx: ShaderEffect }[],
	): void {
		const cap = sphericalCap(SHOCK_CAP_STEPS, SHOCK_CAP_HALF);
		const shader = loader.getShader(shaderName) as ShaderEffect;
		for (let i = 0; i < count; i++) {
			const quad = new Mesh(0, 0, {
				vertices: cap.vertices,
				uvs: cap.uvs,
				indices: cap.indices,
				normalize: false,
				// a UNIT patch: the scale that makes it the planet's curvature
				// is applied per event, and it is that event's altitude
				scale: 1,
				// bounds only, and generous: the real extent is set per event
				width: PLANET_R * 2,
				height: PLANET_R * 2,
				lit: false,
				cullBackFaces: false,
				transparent: true,
				alphaCutoff: 0,
			});
			quad.tint.parseCSS("#ffffff");
			quad.blendMode = "additive";
			const fx = shader.clone();
			fx.setUniform("uExposure", exposure);
			fx.setUniform("uColor", rgb);
			quad.addPostEffect(fx);
			into.push({ quad, fx });
		}
	}

	/** the three blast colours, resolved once from their CSS */
	initShockTints(): void {
		const linear = (css: string, out: Float32Array) => {
			const c = new Color().parseCSS(css);
			out[0] = c.r / 255;
			out[1] = c.g / 255;
			out[2] = c.b / 255;
		};
		shockRgb[0] = shockTint.r / 255;
		shockRgb[1] = shockTint.g / 255;
		shockRgb[2] = shockTint.b / 255;
		linear(SHOCK_ICE_TINT, iceRgb);
		linear(SHOCK_BONUS_TINT, bonusRgb);
		linear(RIPPLE_TINT, rippleRgb);
	}

	/**
	 * Put one curved patch on the shell and let it age out.
	 *
	 * The blast wave and the dome's ring were the same twenty lines twice
	 * over, differing only in where the radius came from and how long it
	 * lived. Nothing happens if the pool is empty: several events together is
	 * exactly when one more ring adds least.
	 * @param home - the pool to take from, and to hand back to
	 * @param at - the unit surface point it happened at
	 * @param altitude - the scene radius that point is drawn at
	 * @param worldRadius - how wide the ring should grow, in world units
	 * @param lifeMs - how long it takes to do it
	 * @param rgb - a colour for this one, when the pool's own is not it
	 */
	private emitCap(
		home: { quad: Mesh; fx: ShaderEffect }[],
		at: Vector3d,
		altitude: number,
		worldRadius: number,
		lifeMs: number,
		rgb?: Float32Array,
	): void {
		const free = home.pop();
		if (free === undefined) {
			return;
		}
		free.fx.setUniform("uAge", 0);
		if (rgb !== undefined) {
			// per event, so ice reads cold and rock reads hot
			free.fx.setUniform("uColor", rgb);
		}
		// how much of the patch this event fills: its own radius against the
		// patch's, which at this altitude is `altitude * SHOCK_CAP_HALF`
		free.fx.setUniform(
			"uSize",
			Math.min(1, worldRadius / (altitude * SHOCK_CAP_HALF)),
		);
		this.app.world.addChild(free.quad, PLANET_Z);
		this.shocks.push({
			quad: free.quad,
			fx: free.fx,
			at,
			altitude,
			ageMs: 0,
			lifeMs,
			home,
		});
	}

	/**
	 * Ring the shell from a point on it.
	 *
	 * Placed at the DOME's radius rather than at whatever altitude the
	 * impact happened at: the thing that rings is the glass.
	 * @param at - the surface point under the impact
	 */
	ripple(at: Vector3d): void {
		this.emitCap(
			this.ripplePool,
			at,
			DOME_R + RIPPLE_LIFT,
			RIPPLE_RADIUS,
			RIPPLE_LIFE_MS,
		);
	}

	/**
	 * Start a blast wave where a rock just died, sized to the rock.
	 * @param at - the surface point it happened at
	 * @param altitude - the scene radius that point is drawn at
	 * @param radius - the rock's own radius, in world units
	 * @param rgb - the blast's colour, as a linear triple
	 */
	shock(at: Vector3d, altitude: number, radius: number, rgb = shockRgb): void {
		this.emitCap(
			this.shockPool,
			at,
			altitude,
			radius * SHOCK_SIZE_RATIO,
			SHOCK_LIFE_MS,
			rgb,
		);
	}

	/**
	 * Age the live waves and hand the spent ones back.
	 * @param dt - frame time in milliseconds
	 */
	tickShocks(dt: number): void {
		for (let i = this.shocks.length - 1; i >= 0; i--) {
			const w = this.shocks[i];
			w.ageMs += dt;
			if (w.ageMs >= w.lifeMs) {
				// immediate, not deferred: it goes straight back into the
				// pool and the next blast may want it this same frame
				this.app.world.removeChildNow(w.quad, true);
				w.home.push({ quad: w.quad, fx: w.fx });
				this.shocks[i] = this.shocks[this.shocks.length - 1];
				this.shocks.pop();
				continue;
			}
			w.fx.setUniform("uAge", w.ageMs / w.lifeMs);
		}
	}

	/**
	 * Put one of them at a point in the scene and start it burning down.
	 *
	 * Round-robin rather than "find a free one": with the pool full, the
	 * oldest flash is the one worth losing, and a burst that finds nothing
	 * free should still light something.
	 * @param x - scene x
	 * @param y - scene y
	 * @param z - scene depth
	 * @param color - CSS colour of the light
	 * @param intensity - peak intensity, decaying to nothing
	 * @param range - how far it reaches, in world units
	 * @param lifeMs - how long it takes to die
	 */
	flash(
		x: number,
		y: number,
		z: number,
		color: string,
		intensity: number,
		range: number,
		lifeMs: number,
	): void {
		const i = this.nextFlash;
		this.nextFlash = (this.nextFlash + 1) % this.flashLights.length;
		const light = this.flashLights[i];
		light.position.set(x, y, z);
		light.color.parseCSS(color);
		light.range = range;
		light.intensity = intensity;
		this.flashPeak[i] = intensity;
		this.flashLifeMs[i] = lifeMs;
		this.flashRemainingMs[i] = lifeMs;
	}

	/**
	 * Burn the live ones down. Squared, so the light drops away fast and
	 * then lingers, which is what a fireball does.
	 * @param dt - frame time in milliseconds
	 */
	tickFlashes(dt: number): void {
		for (let i = 0; i < this.flashLights.length; i++) {
			if (this.flashRemainingMs[i] <= 0) {
				continue;
			}
			this.flashRemainingMs[i] -= dt;
			if (this.flashRemainingMs[i] <= 0) {
				this.flashRemainingMs[i] = 0;
				this.flashLights[i].intensity = 0;
				continue;
			}
			const k = this.flashRemainingMs[i] / this.flashLifeMs[i];
			this.flashLights[i].intensity = this.flashPeak[i] * k * k;
		}
	}

	/**
	 * Aim a burst away from the planet.
	 *
	 * Particles move in the emitter's own frame: `angle` is the azimuth across
	 * the screen and `elevation` lifts out of it along depth. What "outward"
	 * means in that frame depends on WHERE on the globe the thing blew up: for
	 * a rock in front of the player it is straight toward the camera, and at
	 * the limb it is sideways across the screen. So the surface normal has to
	 * be carried into the view frame and read back as those two angles.
	 *
	 * `fromView` composes a view vector as `+right*cx - up*cy - out*cz`, so
	 * the inverse of each component is a dot product with the matching axis,
	 * two of them negated.
	 * @param at - the unit surface point the explosion happened at
	 * @returns the azimuth and elevation that point away from the planet
	 */
	private aimOutward(at: Vector3d): { angle: number; elevation: number } {
		// In WORLD terms, because that is the frame the particles move in:
		// `vel.x` and `vel.y` add to `pos.x`/`pos.y` and `velZ` adds to
		// `depth`, and the emitter is a child of `app.world` placed at the
		// world coordinates `onGlobe` returns. This used to resolve `at`
		// against the camera basis, which was right while this scene ran on a
		// 2D camera, where the screen axes ARE the world axes, and stopped
		// being right at the `Camera3d` conversion: the triple came out as
		// `at` expressed in camera space and was then planted in world space,
		// so the ring was tilted by whatever pose the camera happened to hold
		// and swung around as the player carried it round the globe.
		//
		// `at` is already the unit surface normal in world terms, so the
		// launch axis is just its azimuth and elevation. The sign on y is the
		// one the launch applies, `(cos a, -sin a)`, coming back out.
		return {
			angle: Math.atan2(-at.y, at.x),
			elevation: Math.asin(math.clamp(at.z, -1, 1)),
		};
	}

	/**
	 * How much debris a destroyed rock is worth.
	 *
	 * Quadratic in `grade`, so it tracks how much of the rock the player can
	 * SEE rather than how wide it is. A fixed count per event cannot work on a
	 * size ladder: it makes the smallest fragment pop exactly as hard as the
	 * boulder it came off, and then the ladder says nothing.
	 * @param grade - the rock's size, as a multiple of `ROCK_SCALE`
	 * @param terminal - whether this destruction leaves fragments behind. One
	 * that does spends only part of the budget, because the pieces carry the
	 * rest of the moment; one that leaves nothing gets the real explosion.
	 * @returns how many particles to throw
	 */
	debrisCount(grade: number, terminal: boolean): number {
		const budget =
			BURST_DEBRIS_PER_AREA *
			grade *
			grade *
			(terminal ? BURST_TERMINAL_BOOST : BURST_SPLIT_FRACTION);
		return Math.max(
			terminal ? BURST_TERMINAL_MIN : BURST_DEBRIS_MIN,
			Math.min(BURST_DEBRIS_MAX, Math.round(budget)),
		);
	}

	/**
	 * A burst of debris, thrown away from the surface it happened on.
	 *
	 * The particles move in 3D rather than across the screen: without an
	 * elevation they keep the depth they were born at for their whole life, so
	 * an explosion anywhere but dead ahead reads as a flat disc pasted onto
	 * the scene. With one, the same burst is a dome of debris leaving the
	 * surface, and it is correct at the limb as well as in the middle.
	 *
	 * Additive, so the independent depths cost no sort: an additive blend is
	 * commutative and the emitter leaves `autoSort` off for it.
	 * @param x - scene x
	 * @param y - scene y
	 * @param z - scene depth
	 * @param tint - what colour the debris is
	 * @param count - how many pieces
	 * @param outward - the unit surface point it leaves from, if it has one
	 * @param speed - how hard it is thrown
	 * @param life - how long the pieces last, in ms
	 * @param spread - the width of the area they are born over. Defaults to
	 * a point, for the callers that are explosions rather than bodies.
	 */
	burst(
		x: number,
		y: number,
		z: number,
		tint: string,
		count: number,
		outward: Vector3d,
		speed = BURST_SPEED,
		life = BURST_LIFE,
		spread = 0,
	): void {
		// Aimed away from the surface it happened on. REQUIRED: every one of
		// the ten call sites passes a real surface point, including the bomb
		// blasts, so the "mid air, fire in every direction" fallback this
		// used to carry was unreachable and both its branches were dead.
		const aim = this.aimOutward(outward);
		// The area they are born over, rather than a single point. Offset by
		// half, because `getRandomPointX/Y` are `randomFloat(0, width)` and so
		// measure from the emitter's own position: an area set without this
		// correction is anchored at its top-left CORNER, and the whole burst
		// sits a radius down and to the right of what it came off.
		const area = Math.max(1, spread);

		// TWO layers, because one cannot be both.
		//
		// Everything here used to be additive, and additive soft sprites
		// leaving the same place sum to white in the middle however they are
		// tinted: zoomed in, a rock coming apart was a white smear with a
		// warm edge, not rock. Additive is also commutative, so those bursts
		// never sorted and the debris had no depth among itself either.
		//
		// So the body of the debris is drawn NORMALLY — it keeps its colour,
		// it occludes, and being non-commutative it is depth sorted, which is
		// what makes a burst read as a cloud with a near and a far side. The
		// additive layer is kept for what additive is actually good at: a
		// smaller, faster, shorter-lived spray of sparks on top, too sparse
		// to saturate.
		const sparks = Math.round(count * BURST_SPARK_SHARE);
		this.emitDebris(x, y, z, area, aim, {
			tint,
			count: count - sparks,
			additive: false,
			shards: true,
			speed,
			life,
			startMin: BURST_START_SCALE_MIN,
			startMax: BURST_START_SCALE_MAX,
			endMin: BURST_END_SCALE_MIN,
			endMax: BURST_END_SCALE_MAX,
		});
		if (sparks > 0) {
			this.emitDebris(x, y, z, area, aim, {
				tint,
				count: sparks,
				additive: true,
				shards: false,
				speed: speed * BURST_SPARK_SPEED,
				life: Math.round(life * BURST_SPARK_LIFE),
				startMin: BURST_SPARK_SCALE_MIN,
				startMax: BURST_SPARK_SCALE_MAX,
				endMin: 0.05,
				endMax: 0.2,
			});
		}
	}

	/**
	 * One layer of a burst.
	 *
	 * Split out only so {@link GameController#burst} can lay a sparse
	 * additive spray over a solid body of debris without saying all of it
	 * twice.
	 * @param x - scene x
	 * @param y - scene y
	 * @param z - scene depth
	 * @param area - the width of the box the particles are born in
	 * @param aim - the azimuth and elevation to throw them along
	 * goes in every direction instead of into a cone
	 * @param opts - what this layer is made of
	 */
	private emitDebris(
		x: number,
		y: number,
		z: number,
		area: number,
		aim: { angle: number; elevation: number },
		opts: {
			tint: string;
			count: number;
			additive: boolean;
			shards: boolean;
			speed: number;
			life: number;
			startMin: number;
			startMax: number;
			endMin: number;
			endMax: number;
		},
	): void {
		const emitter = new ParticleEmitter(x - area / 2, y - area / 2, {
			width: area,
			height: area,
			// A sheet of chunks for the body of the burst, one picked per
			// particle and held; the soft dot for the sparks, which are a
			// glow rather than a shape. The cell is the dot's own size, so
			// the scale constants below mean what they always did.
			...(opts.shards
				? {
						image: shardSheet(),
						framewidth: BURST_TEXTURE_SIZE,
						frameheight: BURST_TEXTURE_SIZE,
						randomFrame: true,
					}
				: { image: debrisSprite() }),
			tint: opts.tint,
			textureAdditive: opts.additive,
			totalParticles: opts.count,
			// `angle`/`elevation` are the AXIS here, not a rectangle's
			// centre: with `maxSpread` set the emitter throws each particle
			// at a polar angle off that axis instead of sampling azimuth and
			// elevation independently. A ring tangent to the planet is
			// exactly the set of directions at ninety degrees to its normal,
			// which independent sampling cannot describe at any variation.
			angle: aim.angle,
			elevation: aim.elevation,
			minSpread: BURST_RING_MIN,
			// no surface to leave means no ring to leave along: a bomb going
			// off in mid air gets the whole sphere
			maxSpread: BURST_RING_MAX,
			minLife: Math.round(opts.life * 0.42),
			maxLife: opts.life,
			speed: opts.speed,
			speedVariation: opts.speed * 0.55,
			minStartScale: opts.startMin,
			maxStartScale: opts.startMax,
			minEndScale: opts.endMin,
			maxEndScale: opts.endMax,
			autoDestroyOnComplete: true,
		});
		this.app.world.addChild(emitter, z);
		emitter.burstParticles();
	}
}
