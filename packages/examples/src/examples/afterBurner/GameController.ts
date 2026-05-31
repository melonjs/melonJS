/**
 * GameController — hidden Renderable that owns the per-frame game tick
 * for the AfterBurner Clone showcase. It draws nothing — its
 * `update(dt)` is called by the world container every frame and runs all
 * gameplay logic: input → player position + bank, exhaust trail, enemy
 * spawn + flight, bullet spawn + flight, collision resolution, score,
 * camera follow.
 *
 * Lives in the world so the engine delivers `dt` correctly without us
 * needing to track timestamps. All movers (bullets, enemies, exhaust
 * puffs) are stored in flat arrays and managed with O(1) swap-and-pop
 * removal — iteration order doesn't matter for gameplay.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import {
	type Application,
	audio,
	type Camera3d,
	ChromaticAberrationEffect,
	GlowEffect,
	input,
	math,
	ParticleEmitter,
	pool,
	Renderable,
	type Renderer,
	ScanlineEffect,
	Sprite,
	state,
	Tween,
	Vector3d,
} from "melonjs";
import {
	AXIS_X,
	AXIS_Y,
	AXIS_Z,
	BGM_NAME,
	BULLET_SPEED,
	CONTRAIL_INTERVAL_MS,
	CONTRAIL_LIFE_MS,
	CONTRAIL_OFFSET_X,
	CONTRAIL_OFFSET_Y,
	CONTRAIL_SCALE_END,
	CONTRAIL_SCALE_START,
	CONTRAIL_TRAIL_SPEED,
	DESPAWN_Z_FAR,
	DESPAWN_Z_NEAR,
	ENEMY_BULLET_SPEED,
	ENEMY_FIRE_CHANCE,
	ENEMY_FIRE_INTERVAL_MAX_MS,
	ENEMY_FIRE_INTERVAL_MIN_MS,
	ENEMY_ROLL_DURATION_MAX_MS,
	ENEMY_ROLL_DURATION_MIN_MS,
	ENEMY_ROLL_INTERVAL_MAX_MS,
	ENEMY_ROLL_INTERVAL_MIN_MS,
	ENEMY_SPAWN_INTERVAL_MS,
	ENEMY_SPEED,
	FIRE_COOLDOWN_MS,
	HIT_RADIUS,
	INVULN_BLINK_MS,
	INVULN_MS,
	LIVES_START,
	MAX_BANK_PITCH,
	MAX_BANK_ROLL,
	MAX_BANK_YAW,
	PLAY_BOUND_X,
	PLAY_BOUND_Y,
	PLAYER_BANK_DECAY,
	PLAYER_MAX_PITCH,
	PLAYER_MAX_ROLL,
	PLAYER_SPEED,
	PLAYER_Z,
	RETICLE_FORWARD_Z,
	SPAWN_Z,
	TINT_BULLET_RGB,
	TINT_ENEMY_BULLET_RGB,
	TINT_ENEMY_EXPLOSION,
	TINT_PLAYER_EXPLOSION,
} from "./constants";
import { HUD } from "./HUD";
import { Plane } from "./Plane";
import { Reticle } from "./Reticle";
import { SkyboxStage } from "./SkyboxStage";
import { playEnemyHit, playFire, playPlayerDeath } from "./sfx";
import {
	makeContrailPuffTexture,
	makeLaserBoltTexture,
	makeReticleTexture,
} from "./textures";
import type {
	BulletMover,
	Camera3dWithRoll,
	ContrailNode,
	EnemyBulletMover,
	EnemyMover,
} from "./types";

/**
 * Lightweight tag on bullets / enemies so the broadphase walk in
 * the per-frame bullet × enemy hit loop can filter
 * {@link adapter.querySphere} candidates by kind in O(1) —
 * `world.adapter.querySphere(center, r)` returns every non-kinematic
 * renderable centred within `r` (including particles, the player,
 * the reticle), so we tag the two we care about at spawn time and
 * skip the rest. The tag has no runtime cost — just a string field.
 */
type RenderableWithKind = (Renderable | Sprite) & {
	__kind?: "bullet" | "enemy";
};

/**
 * Module-level scratch for the `world.adapter.querySphere` centre
 * argument. Reused each frame to avoid Vector3d allocation in the
 * bullet × enemy hit check (one call per live enemy each tick).
 */
const _sphereCenter = new Vector3d();

// ─── Pool keys for `me.pool` ───────────────────────────────────────────
// One-time registered subclasses of Sprite, built on the fly inside the
// `GameController` constructor (the texture isn't available before that).
// `pool.pull(name, x, y)` reuses an existing instance (calling its
// `onResetEvent`) before falling back to construction; `world.removeChild`
// automatically returns the sprite to the pool, no manual release call.
const POOL_PLAYER_BULLET = "AfterBurnerPlayerBullet";
const POOL_ENEMY_BULLET = "AfterBurnerEnemyBullet";
const POOL_CONTRAIL_NODE = "AfterBurnerContrailNode";

/**
 * Build a `Sprite` subclass with the given texture + RGB tint pre-applied.
 * Both the constructor and `onResetEvent` take `(x, y)`, so the pool can
 * call either on `pull(name, x, y)` without the call site caring whether
 * this is a fresh instance or a recycled one.
 */
function buildBulletClass(
	texture: HTMLCanvasElement,
	tint: readonly [number, number, number],
) {
	return class BulletSprite extends Sprite {
		constructor(x: number, y: number) {
			super(x, y, { image: texture });
			this.blendMode = "additive";
			this.tint.setColor(...tint);
		}
		onResetEvent(x: number, y: number): void {
			this.pos.x = x;
			this.pos.y = y;
			this.tint.setColor(...tint);
		}
	};
}

/**
 * Same idea for the cool-white contrail puffs — but the lifecycle ages
 * scale + alpha, so `onResetEvent` has to put both BACK to their
 * "freshly spawned" values when a recycled sprite gets reused.
 */
function buildContrailClass(texture: HTMLCanvasElement, renderer: Renderer) {
	return class ContrailSprite extends Sprite {
		constructor(x: number, y: number) {
			super(x, y, { image: texture });
			this.blendMode = "additive";
			this.tint.parseCSS("#dfe8ff");
			// Warm-orange outer glow against the cool-white puff core —
			// the GlowEffect samples 8 neighbours in transparent pixels
			// and bleeds the color outward, so the cool vapor reads as
			// hot afterburner exhaust. One effect per pooled instance;
			// pool reuse keeps it alive across re-spawns.
			this.addPostEffect(
				new GlowEffect(renderer, {
					color: [1.0, 0.55, 0.15],
					width: 4,
					intensity: 1.8,
					textureSize: [texture.width, texture.height],
				}),
			);
		}
		onResetEvent(x: number, y: number): void {
			this.pos.x = x;
			this.pos.y = y;
			this.setOpacity(1);
			this.tint.parseCSS("#dfe8ff");
		}
	};
}

export class GameController extends Renderable {
	app: Application;
	camera: Camera3d;
	player: Plane;
	bullets: BulletMover[] = [];
	enemies: EnemyMover[] = [];
	// Same shape as `bullets` but travels enemy → player, with its own
	// hot-pink visual so the player can read incoming fire vs outgoing.
	enemyBullets: EnemyBulletMover[] = [];
	score = 0;
	gameOver = false;
	// `dt`-driven countdown timers. Each frame we subtract the engine-
	// delivered `dt`; when the value crosses 0 the corresponding event
	// (spawn enemy / fire bullet / spawn contrail node) is allowed and
	// the timer is re-armed to the interval. No `performance.now()` /
	// wall-clock involved — `dt` is the right reference because the
	// engine already paces it (frame-skipping, pause gating).
	enemySpawnTimerMs = 0;
	fireCooldownMs = 0;
	hud!: HUD;
	// Lives + post-respawn invulnerability. `lives` counts down on each
	// hit; when it reaches zero the next hit triggers game-over. While
	// `invulnRemainingMs > 0` the player ignores enemy collisions and
	// blinks visibly so the player can read the "you can't be hit"
	// window. `invulnRemainingMs` is decremented in `update()`.
	lives = LIVES_START;
	invulnRemainingMs = 0;
	// current bank state, smoothed toward an input-driven target each
	// frame. Player mesh transform is rebuilt from these every tick.
	playerRoll = 0;
	playerPitch = 0;
	// Tiny generated canvas used as the laser-bolt texture for bullets —
	// avoids hauling around a placeholder PNG and keeps the asset list
	// to just the Kenney mesh files.
	bulletTexture: HTMLCanvasElement;
	// Hand-rolled vapor trail. Each entry is a single additive sprite
	// that starts at the engine outlet and advances in +Z each frame
	// so it recedes away from the camera in world space — Camera3d's
	// perspective then projects older nodes higher on screen (toward
	// the horizon) and smaller, giving the classic "vapor vanishing
	// into the distance" silhouette without any ParticleEmitter
	// painter-sort surprises. New nodes spawn from `update()` at
	// `CONTRAIL_INTERVAL_MS` cadence; aging + cleanup is driven by
	// {@link GameController#updateContrail}.
	contrail: ContrailNode[] = [];
	contrailTexture!: HTMLCanvasElement;
	contrailSpawnTimerMs = 0;
	contrailStreaming = true;
	// Long-lived ParticleEmitter for the muzzle-flash burst — created
	// once in the constructor and re-aimed at the player's nose on each
	// shot via `burstParticles(8)`. The previous per-shot
	// `new ParticleEmitter(…)` was tossed every 140 ms of sustained
	// fire (~7 allocations/s) plus the `autoDestroyOnComplete`
	// teardown each cycle. Pooling drops both.
	muzzleEmitter!: ParticleEmitter;
	// Targeting reticle floating in world space ahead of the player.
	// Tracks player XY each frame so the crosshair leads the jet during
	// banks — matches After Burner's signature aim indicator.
	reticle!: Reticle;

	// Always-behind camera offsets. Y-down convention → negative Y is up.
	static readonly CAM_OFFSET_Y = -80;
	static readonly CAM_OFFSET_Z = -350;

	constructor(app: Application) {
		// Renderable with zero bounds — it doesn't draw, just ticks.
		super(0, 0, 1, 1);
		this.app = app;
		this.camera = app.viewport as Camera3d;
		this.alwaysUpdate = true; // tick even when off-camera

		// Push the far plane out — enemies spawn at z = 3000 and despawn at
		// z = 4000, way past the engine default (`far = 1000`). Anything
		// beyond `far` clips or projects with bad w-divides; headroom past
		// despawn keeps the math clean.
		this.camera.setClipPlanes(0.1, 6000);

		// Light sepia tint uniforms the palette across the skybox, mesh
		// materials, and HUD into one warm wash — sells the After Burner
		// look without dimming readability. Superlight scanlines stack on
		// top for an arcade-cabinet feel; both compose via the camera's
		// post-FX pipeline.
		this.camera.colorMatrix.sepia(0.18);
		this.camera.addPostEffect(
			new ScanlineEffect(app.renderer, { opacity: 0.08 }),
		);
		this.camera.addPostEffect(
			new ChromaticAberrationEffect(app.renderer, {
				offset: 1.5,
				textureSize: [this.camera.width, this.camera.height],
			}),
		);

		this.bindInputs();

		// Player jet — speederA mesh facing the horizon (+Z). `addChild(z)`
		// atomically sets `pos.z`, so the world's depth sort key is correct
		// from the first frame.
		this.player = new Plane({ size: 60, facing: 1 });
		app.world.addChild(this.player, PLAYER_Z);

		this.bulletTexture = makeLaserBoltTexture();
		this.contrailTexture = makeContrailPuffTexture();

		// Reticle floats ahead of the player in world z so Camera3d shrinks
		// it relative to the jet automatically. Per-frame XY follow is in
		// `tickPlayerInput`.
		this.reticle = new Reticle(makeReticleTexture());
		app.world.addChild(this.reticle, PLAYER_Z + RETICLE_FORWARD_Z);

		this.muzzleEmitter = this._makeMuzzleEmitter();

		this.registerPools();

		this.hud = new HUD(app);
		this.updateCamera();
	}

	/**
	 * Map the keys this game cares about onto named actions. Movement +
	 * fire are hold-to-repeat (default `lock = false`); restart uses
	 * `lock = true` so spamming R can't thrash the reset.
	 */
	private bindInputs(): void {
		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.UP, "up");
		input.bindKey(input.KEY.W, "up");
		input.bindKey(input.KEY.DOWN, "down");
		input.bindKey(input.KEY.S, "down");
		input.bindKey(input.KEY.SPACE, "fire");
		input.bindKey(input.KEY.R, "restart", true);
	}

	/**
	 * Register the three pooled Sprite subclasses with `me.pool`. After
	 * this, `pool.pull(name, x, y)` recycles instances and
	 * `world.removeChild(sprite)` auto-returns them. Re-registering on
	 * each example mount overwrites the prior entry, no leak.
	 */
	private registerPools(): void {
		pool.register(
			POOL_PLAYER_BULLET,
			buildBulletClass(this.bulletTexture, TINT_BULLET_RGB),
			true,
		);
		pool.register(
			POOL_ENEMY_BULLET,
			buildBulletClass(this.bulletTexture, TINT_ENEMY_BULLET_RGB),
			true,
		);
		pool.register(
			POOL_CONTRAIL_NODE,
			buildContrailClass(this.contrailTexture, this.app.renderer),
			true,
		);
	}

	/**
	 * Build the single pooled muzzle-flash emitter. `autoDestroyOnComplete`
	 * stays `false` so the world tree retains the emitter across shots;
	 * each fire reassigns its world XY then calls `burstParticles(8)`.
	 */
	_makeMuzzleEmitter(): ParticleEmitter {
		const e = new ParticleEmitter(0, 0, {
			textureSize: 10,
			tint: "#fff2c4",
			textureAdditive: true,
			totalParticles: 8,
			angle: 0,
			angleVariation: Math.PI * 2,
			minLife: 50,
			maxLife: 110,
			speed: 3,
			speedVariation: 2,
			minStartScale: 0.8,
			maxStartScale: 1.4,
			minEndScale: 0.05,
			maxEndScale: 0.1,
			autoDestroyOnComplete: false,
		});
		// Sit just ahead of the player so painter's-sort lands the
		// burst in front of the jet's cockpit, like a real gun port.
		this.app.world.addChild(e, PLAYER_Z + 20);
		return e;
	}

	/**
	 * Spawn one trail node at the rear-engine outlet, factoring in the
	 * current player roll so the spawn position stays glued to the
	 * (rotated) tail through banks. The new node starts at the player's
	 * own depth (just behind the plane in world Z) and ages in
	 * {@link GameController#updateContrail}.
	 */
	spawnContrailNode(): void {
		const cosR = Math.cos(this.playerRoll);
		const sinR = Math.sin(this.playerRoll);
		const ox = CONTRAIL_OFFSET_X;
		const oy = CONTRAIL_OFFSET_Y;
		const sx = this.player.pos.x + ox * cosR - oy * sinR;
		const sy = this.player.pos.y + ox * sinR + oy * cosR;
		const sprite = pool.pull(POOL_CONTRAIL_NODE, sx, sy) as Sprite;
		// Spawn at the plane's own depth — the trail then advances
		// TOWARD the camera each frame, so node 0 is co-planar with
		// the plane and node N is in front of it (closer to camera =
		// painted later = trails over the plane silhouette, matching
		// real vapor extending past the tail).
		this.app.world.addChild(sprite, this.player.depth);
		this.contrail.push({
			sprite,
			ageMs: 0,
			startScale: CONTRAIL_SCALE_START,
		});
		// Reset transform then apply the spawn scale — `Renderable.scale`
		// is multiplicative on top of `currentTransform`, so a pooled
		// sprite would otherwise carry its previous run's scale, and
		// the per-frame scale update below would compound each tick.
		sprite.currentTransform.identity();
		sprite.currentTransform.scale(
			CONTRAIL_SCALE_START,
			CONTRAIL_SCALE_START,
			1,
		);
	}

	removeContrailNode(i: number): void {
		const node = this.contrail[i];
		this.app.world.removeChild(node.sprite);
		this.contrail[i] = this.contrail[this.contrail.length - 1];
		this.contrail.pop();
	}

	/**
	 * Per-frame tick: spawn new trail nodes at the cadence set by
	 * `CONTRAIL_INTERVAL_MS`, then advance every existing node — push
	 * its depth in +Z (away from camera, recede into the distance),
	 * fade alpha + shrink scale toward zero, and despawn once it's
	 * lived `CONTRAIL_LIFE_MS`. Skips spawning while the trail is
	 * stopped (game-over) but keeps aging the in-flight nodes so they
	 * fade out cleanly.
	 */
	updateContrail(dt: number): void {
		this.contrailSpawnTimerMs -= dt;
		if (this.contrailStreaming && this.contrailSpawnTimerMs <= 0) {
			this.spawnContrailNode();
			this.contrailSpawnTimerMs = CONTRAIL_INTERVAL_MS;
		}
		const dts = dt / 1000;
		for (let i = this.contrail.length - 1; i >= 0; i--) {
			const n = this.contrail[i];
			n.ageMs += dt;
			if (n.ageMs >= CONTRAIL_LIFE_MS) {
				this.removeContrailNode(i);
				continue;
			}
			const t = n.ageMs / CONTRAIL_LIFE_MS;
			n.sprite.depth -= CONTRAIL_TRAIL_SPEED * dts;
			n.sprite.setOpacity(1 - t);
			const scale = n.startScale + (CONTRAIL_SCALE_END - n.startScale) * t;
			// Absolute scale set: identity + scale, so this frame's
			// scale is THE scale (not multiplied onto last frame's).
			n.sprite.currentTransform.identity();
			n.sprite.currentTransform.scale(scale, scale, 1);
		}
	}

	updateCamera(): void {
		// Decoupled chase cam: position follows the player loosely so
		// the jet feels mobile on-screen (full follow = player
		// stuck-at-center, defeats the input feedback), but
		// pitch/yaw/roll are driven DIRECTLY from player position so
		// the view-tilt is dramatic at the play-bound corners. Skips
		// `lookAt` entirely — we set the rotation we want.
		(this.camera.pos as unknown as Vector3d).set(
			this.player.pos.x * 0.3,
			this.player.pos.y * 0.3 + GameController.CAM_OFFSET_Y,
			PLAYER_Z + GameController.CAM_OFFSET_Z,
		);
		this.camera.pitch = (-this.player.pos.y / PLAY_BOUND_Y) * MAX_BANK_PITCH;
		this.camera.yaw = (this.player.pos.x / PLAY_BOUND_X) * MAX_BANK_YAW;
		// Roll lives as an ad-hoc property on the camera (Camera3d
		// doesn't have a built-in roll field for now). SkyboxStage
		// reads it back to rotate the horizon. Sign convention: banking
		// right (positive X) rolls the cockpit left, which tilts the
		// world to the right from the pilot's POV.
		(this.camera as Camera3dWithRoll).roll =
			(-this.player.pos.x / PLAY_BOUND_X) * MAX_BANK_ROLL;
	}

	spawnBullet(): void {
		// `pool.pull` reuses an existing sprite (running its
		// `onResetEvent`) before allocating a new one — the additive
		// blend mode + gold tint are pre-baked into the registered
		// subclass.
		const b = pool.pull(
			POOL_PLAYER_BULLET,
			this.player.pos.x,
			this.player.pos.y,
		) as Sprite;
		// `addChild(child, z)` atomically sets the depth at insertion —
		// no window where the world's sort key is stale.
		this.app.world.addChild(b, PLAYER_Z + 40);
		// Tag bullets so the per-frame bullet×enemy broadphase walk
		// (see the enemy-update loop) can filter sphere candidates by
		// kind without having to call `indexOf` against `this.bullets`.
		(b as RenderableWithKind).__kind = "bullet";
		// `Sprite` defaults `isKinematic = true`, which means
		// `World.broadphase.insertContainer` skips it. We need the
		// bullet to live in the broadphase so the per-frame
		// `querySphere(enemy.pos, HIT_RADIUS)` walk can find it as a
		// candidate. Opt the bullet in by flipping isKinematic before
		// the world's next update tick. This costs nothing — bullets
		// have no body, so there's no SAT side effect; pointer events
		// don't fire on bullets either.
		b.isKinematic = false;
		this.bullets.push({ sprite: b, vx: 0, vy: 0, vz: BULLET_SPEED });
		this.spawnMuzzleFlash();
		// Pan the blip with the player's X — sells "the bullets came from
		// where the jet is on screen" without needing a real spatial
		// audio graph.
		playFire(this.player.pos.x / PLAY_BOUND_X);
	}

	/**
	 * Tiny additive burst at the muzzle. Re-aims the pooled emitter at
	 * the current player position then triggers an 8-particle burst.
	 * Sustained fire (~7/s) is just emitter mutations + Particle pool
	 * allocations under the hood — no ParticleEmitter teardown / new
	 * world-tree child per shot.
	 */
	spawnMuzzleFlash(): void {
		this.muzzleEmitter.pos.x = this.player.pos.x;
		this.muzzleEmitter.pos.y = this.player.pos.y;
		this.muzzleEmitter.burstParticles(8);
	}

	/**
	 * One-shot radial particle burst at the given world position. The
	 * emitter is positioned in world XY, with `depth` set to the enemy's
	 * Z so the painter's sort under Camera3d places it correctly behind
	 * closer renderables. Particle spread is generous + additive blending
	 * for a fireball look that reads against the dark ground.
	 *
	 * `ParticleEmitter.addParticles()` propagates the emitter's `depth` to
	 * each spawned particle, so the burst projects from the explosion's
	 * world-z, not from `z = 0`.
	 */
	spawnExplosion(x: number, y: number, z: number, tint: string): void {
		const emitter = new ParticleEmitter(x, y, {
			textureSize: 14,
			tint,
			textureAdditive: true,
			totalParticles: 60,
			angle: 0,
			angleVariation: Math.PI * 2,
			minLife: 320,
			maxLife: 720,
			speed: 7,
			speedVariation: 4,
			minStartScale: 0.6,
			maxStartScale: 1.4,
			minEndScale: 0.05,
			maxEndScale: 0.2,
			autoDestroyOnComplete: true,
		});
		this.app.world.addChild(emitter, z);
		emitter.burstParticles();
	}

	spawnEnemy(): void {
		// Enemies share the speederA model with the player but face the
		// camera. `Plane.randomizeTint` rolls a pastel hue per spawn so
		// the squadron reads as a varied flight (the multiplicative tint
		// sits on top of the baked MTL palette).
		const e = new Plane({ size: 80, facing: -1 });
		e.randomizeTint();
		const ex = math.randomFloat(-PLAY_BOUND_X, PLAY_BOUND_X);
		const ey = math.randomFloat(-PLAY_BOUND_Y, PLAY_BOUND_Y);
		e.pos.set(ex, ey);
		this.app.world.addChild(e, SPAWN_Z);
		// Tag for the broadphase-filter walk; see {@link RenderableWithKind}.
		(e as unknown as RenderableWithKind).__kind = "enemy";
		// Opt the enemy into the broadphase (see the matching note in
		// `spawnBullet`). The bullet-side `querySphere` walk doesn't
		// need this — it queries around the enemy and only filters for
		// bullets — but flipping it now keeps the broadphase the
		// authoritative spatial index for any future query in the
		// other direction (e.g. enemy-of-bullet for explosion AoE).
		e.isKinematic = false;
		// partial homing — enemies drift toward where the player IS at
		// spawn, not where they end up. Adds genuine threat without being
		// a guaranteed hit.
		const dx = this.player.pos.x - ex;
		const dy = this.player.pos.y - ey;
		const flightTime = (SPAWN_Z - PLAYER_Z) / ENEMY_SPEED;
		const canFire = Math.random() < ENEMY_FIRE_CHANCE;
		const mover: EnemyMover = {
			mesh: e,
			vx: (dx / flightTime) * 0.4,
			vy: (dy / flightTime) * 0.4,
			vz: -ENEMY_SPEED,
			// Facing was baked into `currentTransform` by Plane(facing=-1)
			// as a rotation of π around Y. We need it as a plain number so
			// the roll Tween can rebuild the transform each frame without
			// losing the facing.
			facingY: Math.PI,
			rollTween: this.makeRollTween(e, Math.PI),
			canFire,
			nextFireMs: canFire
				? math.randomFloat(
						ENEMY_FIRE_INTERVAL_MIN_MS,
						ENEMY_FIRE_INTERVAL_MAX_MS,
					)
				: Number.POSITIVE_INFINITY,
		};
		this.enemies.push(mover);
	}

	/**
	 * Build (and start) a self-rescheduling barrel-roll Tween for this
	 * enemy mesh. The Tween waits a randomized delay, sweeps a `roll`
	 * state from 0 → 2π over a randomized duration, then re-creates
	 * itself to cycle indefinitely. Replaces the previous hand-rolled
	 * `rollTimeMs` / `rollDurationMs` / `nextRollMs` state machine —
	 * Tween is the right primitive for "interpolate this property over
	 * a known duration with easing".
	 */
	private makeRollTween(mesh: Plane, facingY: number): Tween {
		const state = { roll: 0 };
		const delay = math.randomFloat(
			ENEMY_ROLL_INTERVAL_MIN_MS,
			ENEMY_ROLL_INTERVAL_MAX_MS,
		);
		const duration = math.randomFloat(
			ENEMY_ROLL_DURATION_MIN_MS,
			ENEMY_ROLL_DURATION_MAX_MS,
		);
		return new Tween(state)
			.to({ roll: Math.PI * 2 }, duration)
			.delay(delay)
			.onUpdate(() => {
				mesh.currentTransform.identity();
				mesh.currentTransform.rotate(facingY, AXIS_Y);
				mesh.currentTransform.rotate(state.roll, AXIS_Z);
			})
			.onComplete(() => {
				// Snap back to facing-only so the next idle period
				// starts from a clean baseline.
				mesh.currentTransform.identity();
				mesh.currentTransform.rotate(facingY, AXIS_Y);
				// Schedule the next cycle. Locate THIS enemy in the
				// mover list to swap in the fresh tween — direct
				// reference closure would leak the old mover if the
				// enemy was already removed.
				const idx = this.enemies.findIndex((m) => m.mesh === mesh);
				if (idx === -1) return;
				this.enemies[idx].rollTween = this.makeRollTween(mesh, facingY);
			})
			.start();
	}

	/**
	 * Spawn a hot-pink bolt from the given enemy aimed straight at
	 * where the player is RIGHT NOW (no leading — keeps the dodge
	 * window honest at this game speed). Direction is normalized then
	 * scaled to `ENEMY_BULLET_SPEED` so all enemy bullets travel at a
	 * constant world-space speed regardless of distance.
	 */
	spawnEnemyBullet(e: EnemyMover): void {
		const ex = e.mesh.pos.x;
		const ey = e.mesh.pos.y;
		const ez = e.mesh.depth;
		const dx = this.player.pos.x - ex;
		const dy = this.player.pos.y - ey;
		const dz = this.player.depth - ez;
		const len = Math.hypot(dx, dy, dz) || 1;
		const inv = ENEMY_BULLET_SPEED / len;
		const b = pool.pull(POOL_ENEMY_BULLET, ex, ey) as Sprite;
		this.app.world.addChild(b, ez);
		this.enemyBullets.push({
			sprite: b,
			vx: dx * inv,
			vy: dy * inv,
			vz: dz * inv,
		});
	}

	removeEnemyBullet(i: number): void {
		const b = this.enemyBullets[i];
		this.app.world.removeChild(b.sprite);
		this.enemyBullets[i] = this.enemyBullets[this.enemyBullets.length - 1];
		this.enemyBullets.pop();
	}

	removeBullet(i: number): void {
		const b = this.bullets[i];
		this.app.world.removeChild(b.sprite);
		this.bullets[i] = this.bullets[this.bullets.length - 1];
		this.bullets.pop();
	}

	removeEnemy(i: number): void {
		const e = this.enemies[i];
		// Stop the roll Tween BEFORE detaching the mesh — otherwise its
		// onUpdate would fire one more frame against a destroyed
		// renderable, and its onComplete would re-create a new Tween
		// for an enemy that's already gone.
		e.rollTween.stop();
		this.app.world.removeChild(e.mesh);
		this.enemies[i] = this.enemies[this.enemies.length - 1];
		this.enemies.pop();
	}

	/**
	 * Apply one hit. Always spawn the explosion + sound; if the player
	 * has lives remaining, knock one off and start the post-respawn
	 * invulnerability window. The last life triggers the full death
	 * sequence via {@link GameController#setGameOver}.
	 */
	onPlayerHit(): void {
		this.spawnExplosion(
			this.player.pos.x,
			this.player.pos.y,
			this.player.depth,
			TINT_PLAYER_EXPLOSION,
		);
		playPlayerDeath();
		if (this.lives > 1) {
			this.lives -= 1;
			this.hud.setLives(this.lives);
			// Mid-life hit — moderate shake, no full red overlay (the
			// player's still flying). Recenter so the next enemy isn't
			// already on top of us at respawn.
			this.camera.shake(12, 360, undefined, undefined, true);
			this.player.pos.x = 0;
			this.player.pos.y = 0;
			this.invulnRemainingMs = INVULN_MS;
		} else {
			this.lives = 0;
			this.hud.setLives(0);
			this.camera.shake(22, 900, undefined, undefined, true);
			this.hud.flashDeath();
			this.setGameOver();
		}
	}

	setGameOver(): void {
		this.gameOver = true;
		// engines out — stop streaming new puffs. The already-in-flight
		// particles will finish their lifetime + fade naturally.
		// Stop spawning new contrail nodes; the existing ones keep
		// ageing + fading via `updateContrail`.
		this.contrailStreaming = false;
		// Freeze the in-flight enemies. `tickEnemies` won't run while
		// `gameOver` is true so their motion stops, but the roll
		// Tweens run on the engine's tween clock — independent of our
		// update loop — so without this they'd keep spinning while the
		// game-over overlay is up.
		for (const enemy of this.enemies) enemy.rollTween.stop();
		// Cut the music with the death — the silence sells the
		// finality, and the restart will swell it back in.
		audio.stopTrack();
		// Freeze the ground-grid scroll so the world visibly stops
		// dead in its tracks; resumed on `reset()`.
		const stage = state.current();
		if (stage instanceof SkyboxStage) {
			stage.setScrollPaused(true);
		}
		this.hud.showGameOver(this.score);
	}

	reset(): void {
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			this.removeBullet(i);
		}
		for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
			this.removeEnemyBullet(i);
		}
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			this.removeEnemy(i);
		}
		for (let i = this.contrail.length - 1; i >= 0; i--) {
			this.removeContrailNode(i);
		}
		// Assign x/y directly — Vector3d.set(x, y) would default z to 0
		// and yank the player to the camera plane (= "player huge after
		// restart" bug); we want PLAYER_Z preserved.
		this.player.pos.x = 0;
		this.player.pos.y = 0;
		this.score = 0;
		this.lives = LIVES_START;
		this.invulnRemainingMs = 0;
		// Reset cooldown timers so the first frame after restart can
		// fire / spawn immediately instead of being half-way into the
		// previous run's countdown.
		this.fireCooldownMs = 0;
		this.enemySpawnTimerMs = 0;
		this.contrailSpawnTimerMs = 0;
		this.player.setOpacity(1);
		this.gameOver = false;
		this.contrailStreaming = true;
		this.hud.hideGameOver();
		this.hud.setScore(0);
		this.hud.setLives(this.lives);
		// Music was stopped at game-over; bring it back in on restart.
		// `playTrack` re-registers BGM_NAME as the engine's current
		// track so the next blur cycle pauses it automatically again.
		audio.playTrack(BGM_NAME, 0.45);
		// Un-freeze the ground-grid scroll alongside the music.
		const stage = state.current();
		if (stage instanceof SkyboxStage) {
			stage.setScrollPaused(false);
		}
	}

	override update(dt: number): boolean {
		if (this.gameOver) {
			if (input.isKeyPressed("restart")) this.reset();
			return true;
		}

		this.tickPlayerInput(dt);
		this.updateContrail(dt);
		this.tickFireAndSpawn(dt);
		this.tickBullets(dt);
		if (this.tickEnemyBullets(dt)) return true; // game-over fast path
		if (this.tickEnemies(dt)) return true;
		this.updateCamera();
		return true;
	}

	/**
	 * Read the input axes → clamped XY movement → mesh bank/pitch
	 * transform → reticle follow → invulnerability blink.
	 * Self-contained: nothing else reads input or writes
	 * `player.currentTransform`.
	 */
	private tickPlayerInput(dt: number): void {
		const dts = dt / 1000;

		// Input → unit vector in the play plane.
		let dx = 0;
		let dy = 0;
		if (input.isKeyPressed("left")) dx -= 1;
		if (input.isKeyPressed("right")) dx += 1;
		if (input.isKeyPressed("up")) dy -= 1;
		if (input.isKeyPressed("down")) dy += 1;
		if (dx !== 0 && dy !== 0) {
			const inv = 1 / Math.sqrt(2);
			dx *= inv;
			dy *= inv;
		}

		// Advance + clamp to play bounds.
		const px = this.player.pos.x + dx * PLAYER_SPEED * dts;
		const py = this.player.pos.y + dy * PLAYER_SPEED * dts;
		this.player.pos.x = math.clamp(px, -PLAY_BOUND_X, PLAY_BOUND_X);
		this.player.pos.y = math.clamp(py, -PLAY_BOUND_Y, PLAY_BOUND_Y);

		// Frame-rate independent damping toward the input-driven bank
		// target. Sign matches the Y-flipped mesh output (left input
		// → left wing down; up input → nose down on screen = climb).
		const targetRoll = -dx * PLAYER_MAX_ROLL;
		const targetPitch = dy * PLAYER_MAX_PITCH;
		this.playerRoll = math.damp(
			this.playerRoll,
			targetRoll,
			PLAYER_BANK_DECAY,
			dts,
		);
		this.playerPitch = math.damp(
			this.playerPitch,
			targetPitch,
			PLAYER_BANK_DECAY,
			dts,
		);
		this.player.currentTransform.identity();
		this.player.currentTransform.rotate(this.playerRoll, AXIS_Z);
		this.player.currentTransform.rotate(this.playerPitch, AXIS_X);

		// Reticle follows player XY. Assign per-component so the world-z
		// set by `addChild(reticle, PLAYER_Z + RETICLE_FORWARD_Z)`
		// survives — `pos.set(x, y)` would default z to 0.
		this.reticle.pos.x = this.player.pos.x;
		this.reticle.pos.y = this.player.pos.y;

		this.tickInvulnBlink(dt);
	}

	/**
	 * Decrement the post-respawn invulnerability window and pulse the
	 * jet opacity so the "can't be hit" state is readable. Snaps opacity
	 * back to 1 on expiry so a half-frame can't leave the jet
	 * see-through.
	 */
	private tickInvulnBlink(dt: number): void {
		if (this.invulnRemainingMs <= 0) return;
		this.invulnRemainingMs -= dt;
		if (this.invulnRemainingMs <= 0) {
			this.invulnRemainingMs = 0;
			this.player.setOpacity(1);
			return;
		}
		const blinkOn =
			Math.floor((INVULN_MS - this.invulnRemainingMs) / INVULN_BLINK_MS) % 2 ===
			0;
		this.player.setOpacity(blinkOn ? 1 : 0.35);
	}

	/**
	 * Tick the `dt`-driven fire cooldown + enemy spawn timer. Each
	 * crosses zero independently, fires the matching spawn, then
	 * re-arms.
	 */
	private tickFireAndSpawn(dt: number): void {
		this.fireCooldownMs -= dt;
		if (input.isKeyPressed("fire") && this.fireCooldownMs <= 0) {
			this.spawnBullet();
			this.fireCooldownMs = FIRE_COOLDOWN_MS;
		}
		this.enemySpawnTimerMs -= dt;
		if (this.enemySpawnTimerMs <= 0) {
			this.spawnEnemy();
			this.enemySpawnTimerMs = ENEMY_SPAWN_INTERVAL_MS;
		}
	}

	/**
	 * Advance player bullets, despawning anything past the far edge.
	 */
	private tickBullets(dt: number): void {
		const dts = dt / 1000;
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const b = this.bullets[i];
			b.sprite.pos.x += b.vx * dts;
			b.sprite.pos.y += b.vy * dts;
			b.sprite.depth += b.vz * dts;
			if (b.sprite.depth > DESPAWN_Z_FAR) this.removeBullet(i);
		}
	}

	/**
	 * Advance enemy bullets, despawn off-bounds, then test each
	 * surviving bullet against the player. Returns `true` if a hit
	 * triggered game-over so the caller can fast-path out of update().
	 */
	private tickEnemyBullets(dt: number): boolean {
		const dts = dt / 1000;
		for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
			const b = this.enemyBullets[i];
			b.sprite.pos.x += b.vx * dts;
			b.sprite.pos.y += b.vy * dts;
			b.sprite.depth += b.vz * dts;

			// Cull bolts past the player or way off-screen. Generous XY
			// bounds: at speed the bolt's projected screen position can
			// drift far past the play rect before its z catches up.
			if (
				b.sprite.depth < DESPAWN_Z_NEAR ||
				Math.abs(b.sprite.pos.x) > PLAY_BOUND_X * 3 ||
				Math.abs(b.sprite.pos.y) > PLAY_BOUND_Y * 3
			) {
				this.removeEnemyBullet(i);
				continue;
			}

			if (this.invulnRemainingMs > 0) continue;
			if (
				!this.withinPlayerHitRadius(
					b.sprite.pos.x,
					b.sprite.pos.y,
					b.sprite.depth,
				)
			) {
				continue;
			}
			this.removeEnemyBullet(i);
			this.onPlayerHit();
			if (this.gameOver) return true;
		}
		return false;
	}

	/**
	 * Advance enemies, tick their AI fire cadence, then resolve
	 * collisions (player bullets first, then the player itself).
	 * Returns `true` if a hit triggered game-over.
	 */
	private tickEnemies(dt: number): boolean {
		const dts = dt / 1000;
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const e = this.enemies[i];
			e.mesh.pos.x += e.vx * dts;
			e.mesh.pos.y += e.vy * dts;
			e.mesh.depth += e.vz * dts;
			// Roll animation runs as a Tween (self-rescheduling) —
			// nothing to tick here per frame.
			this.tickEnemyFire(e, dt);

			if (e.mesh.depth < DESPAWN_Z_NEAR) {
				this.removeEnemy(i);
				continue;
			}

			if (this.enemyHitByPlayerBullet(e)) {
				this.scoreEnemyKill(e);
				this.removeEnemy(i);
				continue;
			}

			if (this.invulnRemainingMs > 0) continue;
			if (
				this.withinPlayerHitRadius(e.mesh.pos.x, e.mesh.pos.y, e.mesh.depth)
			) {
				this.onPlayerHit();
				this.removeEnemy(i);
				if (this.gameOver) return true;
			}
		}
		return false;
	}

	/**
	 * Decrement an enemy's fire-cooldown; on expiry, fire one bolt at
	 * the player's current position and randomize the next interval.
	 * Non-shooter enemies have `nextFireMs = +Infinity` so the branch
	 * inside never trips.
	 */
	private tickEnemyFire(e: EnemyMover, dt: number): void {
		if (!e.canFire) return;
		e.nextFireMs -= dt;
		if (e.nextFireMs > 0) return;
		this.spawnEnemyBullet(e);
		e.nextFireMs = math.randomFloat(
			ENEMY_FIRE_INTERVAL_MIN_MS,
			ENEMY_FIRE_INTERVAL_MAX_MS,
		);
	}

	/**
	 * Walk the world's broadphase for player bullets within HIT_RADIUS
	 * of this enemy. Returns `true` (and removes the bullet that hit)
	 * on the first match. Without this pass the bullet × enemy check is
	 * O(K × M) per frame; the Octree-backed broadphase brings it to
	 * O(M × candidates-near-enemy) — sparse in 3D because the tree
	 * partitions in z as well as x/y.
	 *
	 * Bullets opt into the broadphase via `isKinematic = false` at
	 * spawn time AND carry `__kind = "bullet"` so we can drop the
	 * unrelated candidates (particles, player, reticle, contrail) in
	 * O(1) per hit.
	 */
	private enemyHitByPlayerBullet(e: EnemyMover): boolean {
		_sphereCenter.set(e.mesh.pos.x, e.mesh.pos.y, e.mesh.depth);
		const candidates =
			this.app.world.adapter.querySphere?.(_sphereCenter, HIT_RADIUS) ?? [];
		for (let k = 0; k < candidates.length; k++) {
			const c = candidates[k] as RenderableWithKind;
			if (c.__kind !== "bullet") continue;
			// Linear-in-bullets indexOf, but only on a confirmed hit —
			// keeps the per-frame complexity at O(M × candidates).
			const sprite = c as Sprite;
			for (let j = this.bullets.length - 1; j >= 0; j--) {
				if (this.bullets[j].sprite === sprite) {
					this.removeBullet(j);
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * On a confirmed enemy kill: explosion VFX at the enemy position,
	 * audio pan with the X-position, brief camera kick, score bump,
	 * HUD update.
	 */
	private scoreEnemyKill(e: EnemyMover): void {
		this.spawnExplosion(
			e.mesh.pos.x,
			e.mesh.pos.y,
			e.mesh.depth,
			TINT_ENEMY_EXPLOSION,
		);
		// Pan the crunch with the kill's X so far-off-screen hits sit
		// on the right side audibly.
		playEnemyHit(e.mesh.pos.x / PLAY_BOUND_X);
		// Tiny shake — short enough that rapid-fire kills don't compound
		// into a jelly view; long enough that the kill registers as a
		// physical event.
		this.camera.shake(4, 90);
		this.score += 100;
		this.hud.setScore(this.score);
	}

	/**
	 * Squared-distance sphere test against the player. Inlines the
	 * narrow phase used by both `tickEnemyBullets` and `tickEnemies`
	 * for the player-hit check, dropping three copies of the same
	 * `dx²+dy²+dz² < r²` math down to one.
	 */
	private withinPlayerHitRadius(x: number, y: number, z: number): boolean {
		const dx = x - this.player.pos.x;
		const dy = y - this.player.pos.y;
		const dz = z - this.player.depth;
		return dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS;
	}
}
