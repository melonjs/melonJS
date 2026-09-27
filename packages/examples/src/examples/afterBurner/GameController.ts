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
	Light3d,
	math,
	ParticleEmitter,
	pool,
	Renderable,
	type Renderer,
	ScanlineEffect,
	Sprite,
	state,
	Tween,
	Vector2d,
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
	FLASH_DEATH_INTENSITY,
	FLASH_DEATH_MS,
	FLASH_DEATH_RANGE,
	FLASH_KILL_INTENSITY,
	FLASH_KILL_MS,
	FLASH_KILL_RANGE,
	FLASH_LIGHT_POOL,
	FLASH_MUZZLE_INTENSITY,
	FLASH_MUZZLE_MS,
	FLASH_MUZZLE_RANGE,
	GUN_CONVERGENCE_Z,
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
	RETICLE_BLINK_DIM,
	RETICLE_BLINK_MS,
	RETICLE_FORWARD_Z,
	RETICLE_SIZE,
	SPAWN_Z,
	TINT_BULLET_RGB,
	TINT_ENEMY_BULLET_RGB,
	TINT_ENEMY_EXPLOSION,
	TINT_MUZZLE_FLASH,
	TINT_PLAYER_EXPLOSION,
	TINT_RETICLE_FREE,
	TINT_RETICLE_LOCKED,
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
	ContrailNode,
	EnemyBulletMover,
	EnemyMover,
} from "./types";

/**
 * The collision callbacks are not declared on `Renderable` — it checks
 * `typeof` at dispatch time — so a renderable opts in by being widened to
 * carry one.
 */
type CollisionAware = Renderable & {
	onCollisionStart?: (response: object, other: Renderable) => boolean;
};

/**
 * Module-level scratch for the two ends of a bullet's per-frame ray.
 * `raycast3d` reads them and returns before the next call, so one pair
 * is reused for every bullet rather than allocating two vectors per
 * bullet per frame.
 */
const _rayFrom = new Vector3d();
const _rayTo = new Vector3d();
const _aimProbe = new Vector3d();
/**
 * Scratch for the screen projections in {@link GameController#framedEnemy}.
 *
 * `Camera3d.worldToScreen` allocates its result when it is not given one, and
 * that call runs for the sight, the visor's edge and EVERY live enemy on
 * every frame: about ten short-lived vectors a frame, six hundred a second,
 * all of them dead before the next tick. Handing it somewhere to write costs
 * nothing and leaves the collector out of the aiming path.
 */
const _sightScreen = new Vector2d();
const _edgeScreen = new Vector2d();
const _enemyScreen = new Vector2d();

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
	/**
	 * The enemy the sight is on this frame, or `undefined` for empty sky.
	 *
	 * Resolved ONCE per frame and read by both the reticle tint and the
	 * gun solution, so the two cannot disagree: if it is red, those are the
	 * rounds that will be led onto that target. A reticle that lit up on
	 * one rule while the guns solved by another would be worse than no
	 * reticle at all.
	 */
	private lockedTarget: EnemyMover | undefined;
	/** phase of the lock blink, reset each time a target is acquired */
	private lockBlinkMs = 0;
	/** reusable point lights for muzzle and fireball flashes */
	private flashLights: Light3d[] = [];
	/** remaining life of each pooled flash, parallel to `flashLights` */
	private flashRemainingMs: number[] = [];
	/** peak intensity each pooled flash is decaying from */
	private flashPeak: number[] = [];
	/** total life each pooled flash was given */
	private flashLifeMs: number[] = [];
	/** round-robin cursor into the flash pool */
	private nextFlash = 0;
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
	/** horizon bank, fed to the backdrop — see `updateCamera` for why not `camera.roll` */
	bankRoll = 0;
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
		// The body comes from `Plane`'s own definition; what belongs here is
		// what a contact MEANS. `Container.addChild` reads `bodyDef` at
		// insertion, so the handler is installed before the world can
		// deliver to it.
		this.installPlayerCollision();
		app.world.addChild(this.player, PLAYER_Z);

		this.bulletTexture = makeLaserBoltTexture();
		this.contrailTexture = makeContrailPuffTexture();

		// Reticle floats ahead of the player in world z so Camera3d shrinks
		// it relative to the jet automatically. Per-frame XY follow is in
		// `tickPlayerInput`.
		this.reticle = new Reticle(makeReticleTexture());
		app.world.addChild(this.reticle, PLAYER_Z + RETICLE_FORWARD_Z);

		this.muzzleEmitter = this._makeMuzzleEmitter();
		this.initFlashLights(app);

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
			// raised from 3 with the 20.2 particle transform fix
			speed: 4.5,
			speedVariation: 3,
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
		// The HORIZON banks, the gameplay layer does not — and that is a
		// deliberate arcade cheat, not a missing feature. `Camera3d.roll`
		// exists and would bank the whole view, but this camera sits behind
		// and below the ship rather than in its cockpit: rolling the view
		// spins everything about the camera's own forward axis, which swings
		// the player's craft out of its anchored lower-centre spot and drags
		// the enemies around a screen-space reticle that does not rotate with
		// them. A chase camera banking with its subject has to rotate ABOUT
		// the subject, which is a roll plus a compensating translation. Until
		// that exists, rolling only the painted backdrop is what sells the
		// bank — the same trick the arcade original uses.
		//
		// Sign convention: banking right (positive X) rolls the cockpit left,
		// tilting the world right from the pilot's POV.
		this.bankRoll = (-this.player.pos.x / PLAY_BOUND_X) * MAX_BANK_ROLL;
		const skybox = state.current();
		if (skybox instanceof SkyboxStage) {
			skybox.setRoll(this.bankRoll);
		}
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
		// A bullet is not a thing in the broadphase, it is a RAY. It
		// carries no body and stays kinematic; what it hits is resolved
		// in `tickBullets` by casting along the segment it travelled
		// this frame. Nothing to tag, nothing to insert, nothing to
		// filter back out of a query result.
		this.bullets.push(this.aimedBullet(b));
		this.spawnMuzzleFlash();
		// Pan the blip with the player's X — sells "the bullets came from
		// where the jet is on screen" without needing a real spatial
		// audio graph.
		playFire(this.player.pos.x / PLAY_BOUND_X);
	}

	/**
	 * Resolve what the sight is on, and colour it accordingly.
	 *
	 * Red is a promise the guns keep: it appears exactly when
	 * {@link GameController#framedEnemy} finds something, which is the same
	 * call the intercept solver leads on.
	 */
	private updateLock(dt: number): void {
		this.lockedTarget = this.framedEnemy();
		if (this.lockedTarget === undefined) {
			this.lockBlinkMs = 0;
			this.reticle.tint.parseCSS(TINT_RETICLE_FREE);
			this.reticle.setOpacity(1);
			return;
		}
		this.reticle.tint.parseCSS(TINT_RETICLE_LOCKED);
		// A square wave, not a sine: a gun sight flickers, it does not
		// breathe. The phase resets on acquisition (above), so every lock
		// opens lit rather than on whatever phase the last one left behind.
		this.lockBlinkMs += dt;
		const lit = Math.floor(this.lockBlinkMs / RETICLE_BLINK_MS) % 2 === 0;
		this.reticle.setOpacity(lit ? 1 : RETICLE_BLINK_DIM);
	}

	/**
	 * The enemy closest to the middle of the sight, or `undefined` when
	 * nothing is framed.
	 *
	 * Screen distance rather than world distance on purpose: what the player
	 * means by "I am aiming at that one" is where it sits in the visor, not
	 * how near it is. Only enemies ahead of the guns count, and only those
	 * within a generous slice of the screen, so a lone straggler off in the
	 * corner does not silently re-range the guns.
	 * @returns the enemy the guns should be solving for
	 */
	private framedEnemy(): EnemyMover | undefined {
		const sight = this.camera.worldToScreen(
			_aimProbe.set(this.reticle.pos.x, this.reticle.pos.y, this.reticle.depth),
		);
		if (sight === null) {
			return undefined;
		}
		// The visor's own radius, measured on screen rather than assumed.
		// It is world geometry, so its apparent size changes with distance
		// and camera angle, and a fixed pixel figure is right at one range
		// only: the first attempt here used 70px against brackets that draw
		// about 33px across, so nearly anything ahead of the jet counted as
		// framed and the sight sat lit permanently. Projecting the reticle's
		// own edge keeps the test honest to what the player can see.
		const edge = this.camera.worldToScreen(
			_aimProbe.set(
				this.reticle.pos.x + RETICLE_SIZE / 2,
				this.reticle.pos.y,
				this.reticle.depth,
			),
			_edgeScreen,
		);
		if (edge === null) {
			return undefined;
		}
		let best: EnemyMover | undefined;
		let bestOff = Math.abs(edge.x - sight.x);
		for (const e of this.enemies) {
			if (e.mesh.depth <= PLAYER_Z) {
				continue;
			}
			const screen = this.camera.worldToScreen(
				_aimProbe.set(e.mesh.pos.x, e.mesh.pos.y, e.mesh.depth),
				_enemyScreen,
			);
			if (screen === null) {
				continue;
			}
			const off = Math.hypot(screen.x - sight.x, screen.y - sight.y);
			if (off < bestOff) {
				bestOff = off;
				best = e;
			}
		}
		return best;
	}

	/**
	 * Vector from the muzzle to where the framed enemy and a bolt fired now
	 * would arrive together, or `undefined` when nothing is framed.
	 *
	 * The intercept is the positive root of `|r + v t| = speed * t`, with `r`
	 * the offset to the target and `v` its velocity: the moment their
	 * separation closes to nothing. A head-on target makes the quadratic
	 * nearly linear, so the closed form is guarded rather than assumed.
	 * @param sprite - the bolt being launched, for its muzzle position
	 * @returns the offset to aim down, in world units
	 */
	private interceptPoint(
		sprite: Sprite,
	): { x: number; y: number; z: number } | undefined {
		const target = this.lockedTarget;
		if (target === undefined) {
			return undefined;
		}
		const rx = target.mesh.pos.x - sprite.pos.x;
		const ry = target.mesh.pos.y - sprite.pos.y;
		const rz = target.mesh.depth - sprite.depth;
		const { vx, vy, vz } = target;

		const a = vx * vx + vy * vy + vz * vz - BULLET_SPEED * BULLET_SPEED;
		const b = 2 * (rx * vx + ry * vy + rz * vz);
		const c = rx * rx + ry * ry + rz * rz;

		let t: number;
		if (Math.abs(a) < 1e-6) {
			// speeds match: the quadratic degenerates to a straight line
			t = b !== 0 ? -c / b : 0;
		} else {
			const disc = b * b - 4 * a * c;
			if (disc < 0) {
				// nothing this bolt can catch
				return undefined;
			}
			const root = Math.sqrt(disc);
			const t1 = (-b - root) / (2 * a);
			const t2 = (-b + root) / (2 * a);
			// the soonest meeting that is actually in the future, picked
			// without building an array and a closure to do it
			const lo = Math.min(t1, t2);
			const hi = Math.max(t1, t2);
			t = lo > 0 ? lo : hi;
		}
		if (!Number.isFinite(t) || t <= 0) {
			return undefined;
		}
		return { x: rx + vx * t, y: ry + vy * t, z: rz + vz * t };
	}

	/**
	 * Give a freshly spawned bolt its velocity, harmonised on the sight.
	 *
	 * Bullets used to fly straight out along +Z from wherever the jet was,
	 * which put them on a line the camera does not sit on: seen from off to
	 * one side, that line projects to a DIFFERENT screen point at every
	 * depth, while the reticle can only mark one of them. Measured with the
	 * jet at the edge of its box, the reticle and the rounds agreed exactly
	 * at the reticle's own depth and were 80px apart out where the enemies
	 * are, which is a target framed dead centre and never hit.
	 *
	 * So the rounds are aimed at the sight instead of parallel to it: the
	 * camera's line of sight runs from the camera through the reticle, and
	 * the bolt is pointed at the spot that line reaches at
	 * `GUN_CONVERGENCE_Z`. The two lines cross there, and near enough
	 * either side of it that a framed enemy is a hit rather than a moral
	 * victory.
	 *
	 * They stay two different lines on purpose. Firing ALONG the camera ray
	 * would be exact at every range, and the bolt would then sit motionless
	 * in the middle of the reticle for its whole flight, shrinking rather
	 * than travelling. The offset is what makes tracers read as tracers.
	 * @param sprite - the pooled bolt to launch
	 * @returns the mover to push onto the bullet list
	 */
	private aimedBullet(sprite: Sprite): BulletMover {
		// Lead the target that is framed, if there is one.
		//
		// Pointing at where it IS misses by about 160 units: a bolt takes the
		// better part of half a second to cross the gap, and in that time an
		// enemy closing at 600 units a second has come some 300 units nearer
		// and moved across the sight. Measured with a rig that held an enemy
		// inside the visor for 92% of frames, only one crossing in five
		// landed inside the hitbox.
		//
		// So the guns solve for the intercept instead: where the bolt and the
		// enemy will be at the same moment. That is the arcade contract this
		// game is playing by, and the one the sight promises: frame it, and
		// the rounds go where it is going to be.
		const lead = this.interceptPoint(sprite);
		if (lead !== undefined) {
			const len = Math.hypot(lead.x, lead.y, lead.z) || 1;
			const speed = BULLET_SPEED / len;
			return {
				sprite,
				vx: lead.x * speed,
				vy: lead.y * speed,
				vz: lead.z * speed,
			};
		}

		const cam = this.camera.pos as unknown as Vector3d;
		// Nothing framed: fall back to harmonising on a fixed distance.
		//
		// A gun sighted at one range agrees with the sight there and nowhere
		// else, and measured at the play-box edge the rounds were still 17px
		// wide of the reticle at z=2500 with a 15px target to hit. Ranging on
		// whatever is actually framed makes the crossing point follow the
		// enemy, so "in the visor" means "hit" at every distance instead of
		// at one. With nothing framed there is nothing to range on, and the
		// fixed distance stands in.
		const convergeZ = GUN_CONVERGENCE_Z;
		// how far along the camera-to-reticle ray the convergence point sits
		const t =
			(convergeZ - this.camera.depth) /
			(this.reticle.depth - this.camera.depth);
		const aimX = cam.x + (this.reticle.pos.x - cam.x) * t;
		const aimY = cam.y + (this.reticle.pos.y - cam.y) * t;

		const dx = aimX - sprite.pos.x;
		const dy = aimY - sprite.pos.y;
		const dz = convergeZ - sprite.depth;
		const len = Math.hypot(dx, dy, dz) || 1;
		const speed = BULLET_SPEED / len;
		return { sprite, vx: dx * speed, vy: dy * speed, vz: dz * speed };
	}

	/**
	 * Build the pool of flash lights, dark, and add them to the world once.
	 *
	 * A `Light3d` is an ordinary renderable that registers with the stage on
	 * activation, so adding and removing one per explosion would mean churning
	 * the stage's light set several times a second. They are created dark
	 * instead and lit in place: an intensity of zero contributes nothing, so
	 * an idle light is free everywhere except the uniform packer.
	 * @param app - the application to add them to
	 */
	private initFlashLights(app: Application): void {
		for (let i = 0; i < FLASH_LIGHT_POOL; i++) {
			const light = new Light3d({
				type: "point",
				intensity: 0,
				range: FLASH_KILL_RANGE,
				color: TINT_ENEMY_EXPLOSION,
			});
			app.world.addChild(light);
			this.flashLights.push(light);
			this.flashRemainingMs.push(0);
			this.flashPeak.push(0);
			this.flashLifeMs.push(1);
		}
	}

	/**
	 * Light the world from a point, briefly.
	 *
	 * Round-robin over the pool: with six lights and flashes lasting a third
	 * of a second, the only thing that can steal one is sustained fire, and
	 * the muzzle flash it steals was about to expire anyway.
	 * @param x - world x
	 * @param y - world y
	 * @param z - world depth
	 * @param color - CSS colour of the flash
	 * @param intensity - peak intensity, decaying to zero over `lifeMs`
	 * @param range - falloff distance in world units
	 * @param lifeMs - how long the flash lasts
	 */
	private flash(
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
	 * Decay the live flashes.
	 *
	 * Quadratic rather than linear: a fireball's light collapses far faster
	 * than its fire, and a linear ramp reads as a lamp being turned down
	 * rather than as something burning out.
	 * @param dt - frame time in milliseconds
	 */
	private tickFlashes(dt: number): void {
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
		// just ahead of the nose, so the jet's own nacelles catch the light
		// rather than it sitting inside the fuselage
		this.flash(
			this.player.pos.x,
			this.player.pos.y,
			this.player.depth + 40,
			TINT_MUZZLE_FLASH,
			FLASH_MUZZLE_INTENSITY,
			FLASH_MUZZLE_RANGE,
			FLASH_MUZZLE_MS,
		);
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
			// raised from 7 with the 20.2 particle transform fix — see the
			// CHANGELOG; bursts no longer gain radius as they fade
			speed: 10,
			speedVariation: 5.5,
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
		// Into the broadphase: `Mesh` defaults `isKinematic = true`, which
		// makes `World.broadphase.insertContainer` skip it, and `raycast3d`
		// walks that same Octree. An enemy outside it is an enemy no bullet
		// can hit.
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
			.to({ roll: Math.PI * 2 }, { duration })
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
	/**
	 * An enemy flying into the player, reported by the engine rather than
	 * measured by this game.
	 *
	 * `Box3d` against `Box3d` is the only contact the engine resolves in
	 * three dimensions, and both planes carry one sized from their own
	 * model, so the ram registers on the silhouette the player can see
	 * instead of on a sphere that has to be generous enough to cover the
	 * wingtips.
	 *
	 * `onCollisionStart` rather than the legacy `onCollision`: it is
	 * receiver-symmetric, so `other` is always the thing that was hit, and
	 * it is deduped to once per pair per frame. None of the collision
	 * callbacks are declared on `Renderable`, which checks `typeof`, so
	 * assigning one is how a renderable opts in.
	 */
	private installPlayerCollision(): void {
		(this.player as CollisionAware).onCollisionStart = (
			_response: object,
			other: Renderable,
		) => {
			if (this.gameOver || this.invulnRemainingMs > 0) {
				return false;
			}
			const k = this.enemies.findIndex((e) => e.mesh === other);
			if (k === -1) {
				return false;
			}
			this.removeEnemy(k);
			this.onPlayerHit();
			// A sensor: report the contact, resolve nothing. The flight
			// model owns where both planes are.
			return false;
		};
	}

	onPlayerHit(): void {
		this.spawnExplosion(
			this.player.pos.x,
			this.player.pos.y,
			this.player.depth,
			TINT_PLAYER_EXPLOSION,
		);
		this.flash(
			this.player.pos.x,
			this.player.pos.y,
			this.player.depth,
			TINT_PLAYER_EXPLOSION,
			FLASH_DEATH_INTENSITY,
			FLASH_DEATH_RANGE,
			FLASH_DEATH_MS,
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
		// Before the game-over branch, not after it. The death wash is
		// triggered BY game over, so a fade that only runs while the game is
		// live never runs at all: the frame stays flooded red and the
		// "GAME OVER" text sits unreadable on top of it.
		this.hud.update(dt);

		if (this.gameOver) {
			this.lockedTarget = undefined;
			this.reticle.tint.parseCSS(TINT_RETICLE_FREE);
			this.reticle.setOpacity(1);
			if (input.isKeyPressed("restart")) this.reset();
			return true;
		}

		this.tickPlayerInput(dt);
		// after the reticle has been placed, before anything is fired
		this.updateLock(dt);
		this.updateContrail(dt);
		this.tickFireAndSpawn(dt);
		this.tickFlashes(dt);
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
	 * Advance player bullets, resolve what each one flew THROUGH this
	 * frame, and despawn anything past the far edge.
	 *
	 * The hit test is `adapter.raycast3d(from, to)` along the segment the
	 * bullet just travelled, not a proximity test at its new position.
	 * That matters because a bullet closes on an enemy at 2400 units/s
	 * (1800 out, 600 back) while an enemy is only about 60 units across:
	 * sampling a point once a frame asks "was it near something at the
	 * instant I looked", and the answer drifts with the frame rate. The
	 * swept segment asks "what did it pass through", which does not.
	 *
	 * `raycast3d` returns the NEAREST hit along the ray, which is the one
	 * a bullet should stop at, and its `point` is on the surface of the
	 * body rather than at its centre, so the fireball lands where the
	 * round actually struck. A renderable carrying a `Box3d` body is
	 * tested against that box exactly; anything else falls back to its
	 * bounding sphere, which is why only the planes carry one.
	 */
	private tickBullets(dt: number): void {
		const dts = dt / 1000;
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const b = this.bullets[i];
			_rayFrom.set(b.sprite.pos.x, b.sprite.pos.y, b.sprite.depth);
			b.sprite.pos.x += b.vx * dts;
			b.sprite.pos.y += b.vy * dts;
			b.sprite.depth += b.vz * dts;
			_rayTo.set(b.sprite.pos.x, b.sprite.pos.y, b.sprite.depth);

			const hit = this.app.world.adapter.raycast3d?.(_rayFrom, _rayTo);
			if (hit) {
				const k = this.enemies.findIndex((e) => e.mesh === hit.renderable);
				if (k !== -1) {
					this.scoreEnemyKill(this.enemies[k], hit.point);
					this.removeEnemy(k);
					this.removeBullet(i);
					continue;
				}
			}

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
			_rayFrom.set(b.sprite.pos.x, b.sprite.pos.y, b.sprite.depth);
			b.sprite.pos.x += b.vx * dts;
			b.sprite.pos.y += b.vy * dts;
			b.sprite.depth += b.vz * dts;
			_rayTo.set(b.sprite.pos.x, b.sprite.pos.y, b.sprite.depth);

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
			// Swept, exactly as the player's rounds are. Only a hit on the
			// player counts: `raycast3d` carries no collision mask, and a
			// bolt that clips a squadron mate on its way down is not
			// something this game models.
			const hit = this.app.world.adapter.raycast3d?.(_rayFrom, _rayTo);
			if (hit?.renderable !== this.player) continue;
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
			}

			// Nothing here resolves a hit any more. A player round is a ray
			// cast in `tickBullets`, and an enemy flying INTO the player is
			// a `Box3d` against a `Box3d`, reported by the engine's own 3D
			// narrowphase to the handler installed in `installPlayerBody`.
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
	 * On a confirmed enemy kill: explosion VFX at the impact point,
	 * audio pan with the X-position, brief camera kick, score bump,
	 * HUD update.
	 *
	 * `at` is the ray's surface hit when one is available, which puts the
	 * fireball on the wing that was clipped rather than in the middle of
	 * the fuselage every time. The enemy's own position is the fallback,
	 * for a kill that did not come from a round.
	 * @param e - the enemy that died
	 * @param at - world-space impact point, if the caller has one
	 */
	private scoreEnemyKill(e: EnemyMover, at?: Vector3d): void {
		const bx = at?.x ?? e.mesh.pos.x;
		const by = at?.y ?? e.mesh.pos.y;
		const bz = at?.z ?? e.mesh.depth;
		this.spawnExplosion(bx, by, bz, TINT_ENEMY_EXPLOSION);
		this.flash(
			bx,
			by,
			bz,
			TINT_ENEMY_EXPLOSION,
			FLASH_KILL_INTENSITY,
			FLASH_KILL_RANGE,
			FLASH_KILL_MS,
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
}
