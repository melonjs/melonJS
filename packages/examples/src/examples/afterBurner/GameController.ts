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
	input,
	ParticleEmitter,
	Renderable,
	Sprite,
	state,
	type Vector3d,
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
		// z = 4000, which is way past the engine default (`far = 1000`).
		// Anything beyond `far` gets clipped or projects with bad w-divides,
		// which is why fresh enemies were rendering huge instead of vanishing
		// at the horizon. Headroom past despawn keeps the math clean.
		this.camera.setClipPlanes(0.1, 6000);

		// (light sepia camera tint was attempted here but breaks the
		// Camera3d render — needs an engine-side fix before re-enabling)

		// Bind input. The third arg is `lock` — when true, the action
		// fires once per press (single-shot, good for jump). We want
		// hold-to-repeat for everything except restart, so default
		// `lock = false` for movement + fire (own cooldown handles
		// fire rate). Restart stays lock=true so spamming R doesn't
		// thrash the reset.
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

		// Player jet — speederA mesh facing the horizon (+Z). `addChild`
		// with z atomically sets pos.z (= depth) at insertion, so the
		// world's depth sort key is correct from the first frame.
		this.player = new Plane({ size: 60, facing: 1 });
		app.world.addChild(this.player, PLAYER_Z);

		this.bulletTexture = makeLaserBoltTexture();
		// Reticle sits at world z = PLAYER_Z + RETICLE_FORWARD_Z so
		// Camera3d shrinks it relative to the player automatically. The
		// per-frame XY follow happens in `updateReticle()`.
		this.reticle = new Reticle(makeReticleTexture());
		app.world.addChild(this.reticle, PLAYER_Z + RETICLE_FORWARD_Z);
		this.contrailTexture = makeContrailPuffTexture();
		this.muzzleEmitter = this._makeMuzzleEmitter();

		this.hud = new HUD(app);
		this.updateCamera();
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
		const sprite = new Sprite(sx, sy, { image: this.contrailTexture });
		sprite.blendMode = "additive";
		sprite.tint.parseCSS("#dfe8ff");
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
		sprite.scale(CONTRAIL_SCALE_START);
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
			n.sprite.scale(scale);
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
		const b = new Sprite(this.player.pos.x, this.player.pos.y, {
			image: this.bulletTexture,
		});
		// additive blend so overlapping bolts blow out to bright white,
		// reads like a tracer hose against the dusk sky
		b.blendMode = "additive";
		b.tint.setColor(...TINT_BULLET_RGB);
		// `addChild(child, z)` atomically sets the depth at insertion —
		// no window where the world's sort key is stale.
		this.app.world.addChild(b, PLAYER_Z + 40);
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
		const ex = (Math.random() * 2 - 1) * PLAY_BOUND_X;
		const ey = (Math.random() * 2 - 1) * PLAY_BOUND_Y;
		e.pos.set(ex, ey);
		this.app.world.addChild(e, SPAWN_Z);
		// partial homing — enemies drift toward where the player IS at
		// spawn, not where they end up. Adds genuine threat without being
		// a guaranteed hit.
		const dx = this.player.pos.x - ex;
		const dy = this.player.pos.y - ey;
		const flightTime = (SPAWN_Z - PLAYER_Z) / ENEMY_SPEED;
		const canFire = Math.random() < ENEMY_FIRE_CHANCE;
		this.enemies.push({
			mesh: e,
			vx: (dx / flightTime) * 0.4,
			vy: (dy / flightTime) * 0.4,
			vz: -ENEMY_SPEED,
			// Facing was baked into `currentTransform` by Plane(facing=-1)
			// as a rotation of π around Y. We need it as a plain number so
			// the per-frame roll animation can rebuild the transform
			// without losing the facing.
			facingY: Math.PI,
			rollTimeMs: 0,
			rollDurationMs: 0,
			nextRollMs:
				ENEMY_ROLL_INTERVAL_MIN_MS +
				Math.random() *
					(ENEMY_ROLL_INTERVAL_MAX_MS - ENEMY_ROLL_INTERVAL_MIN_MS),
			canFire,
			nextFireMs: canFire
				? ENEMY_FIRE_INTERVAL_MIN_MS +
					Math.random() *
						(ENEMY_FIRE_INTERVAL_MAX_MS - ENEMY_FIRE_INTERVAL_MIN_MS)
				: Number.POSITIVE_INFINITY,
		});
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
		const b = new Sprite(ex, ey, { image: this.bulletTexture });
		b.blendMode = "additive";
		b.tint.setColor(...TINT_ENEMY_BULLET_RGB);
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

	/**
	 * Drive each enemy's barrel-roll lifecycle for one frame: tick down
	 * the next-roll countdown and, when it expires, snapshot a fresh
	 * randomized roll duration. While a roll is in flight, rebuild the
	 * mesh's `currentTransform` to facing + roll(angle) where `angle`
	 * sweeps 0 → 2π over the roll window. When the window closes,
	 * rebuild to facing-only so the next animation starts from a clean
	 * baseline. Idle enemies skip the matrix rebuild entirely.
	 */
	updateEnemyRoll(e: EnemyMover, dt: number): void {
		if (e.rollTimeMs > 0) {
			e.rollTimeMs -= dt;
			if (e.rollTimeMs <= 0) {
				// roll just finished — reset transform to facing-only
				e.rollTimeMs = 0;
				e.mesh.currentTransform.identity();
				e.mesh.currentTransform.rotate(e.facingY, AXIS_Y);
				return;
			}
			const progress = 1 - e.rollTimeMs / e.rollDurationMs;
			const angle = progress * Math.PI * 2;
			e.mesh.currentTransform.identity();
			e.mesh.currentTransform.rotate(e.facingY, AXIS_Y);
			e.mesh.currentTransform.rotate(angle, AXIS_Z);
			return;
		}
		e.nextRollMs -= dt;
		if (e.nextRollMs <= 0) {
			e.rollDurationMs =
				ENEMY_ROLL_DURATION_MIN_MS +
				Math.random() *
					(ENEMY_ROLL_DURATION_MAX_MS - ENEMY_ROLL_DURATION_MIN_MS);
			e.rollTimeMs = e.rollDurationMs;
			e.nextRollMs =
				ENEMY_ROLL_INTERVAL_MIN_MS +
				Math.random() *
					(ENEMY_ROLL_INTERVAL_MAX_MS - ENEMY_ROLL_INTERVAL_MIN_MS);
		}
	}

	removeBullet(i: number): void {
		const b = this.bullets[i];
		this.app.world.removeChild(b.sprite);
		this.bullets[i] = this.bullets[this.bullets.length - 1];
		this.bullets.pop();
	}

	removeEnemy(i: number): void {
		const e = this.enemies[i];
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
		// Cut the music with the death — the silence sells the
		// finality, and the restart will swell it back in.
		audio.stopTrack();
		// Freeze the ground-grid scroll so the world visibly stops
		// dead in its tracks; resumed on `reset()`.
		const stage = state.current();
		if (stage instanceof SkyboxStage) {
			stage.scrollPaused = true;
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
			stage.scrollPaused = false;
		}
	}

	override update(dt: number): boolean {
		const dts = dt / 1000;

		if (this.gameOver) {
			if (input.isKeyPressed("restart")) {
				this.reset();
			}
			return true;
		}

		// Player input → XY movement, clamped to play bounds.
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
		this.player.pos.x = Math.max(
			-PLAY_BOUND_X,
			Math.min(PLAY_BOUND_X, this.player.pos.x + dx * PLAYER_SPEED * dts),
		);
		this.player.pos.y = Math.max(
			-PLAY_BOUND_Y,
			Math.min(PLAY_BOUND_Y, this.player.pos.y + dy * PLAYER_SPEED * dts),
		);

		// Bank the player mesh toward the input direction. Roll into
		// turns (left input → left wing down), pitch with vertical input
		// (up input → nose down on screen, i.e. climbing). Sign matches
		// the way the mesh is Y-flipped on output. Exponential decay so
		// the response is critically-damped, not snappy.
		const decay = 1 - Math.exp(-PLAYER_BANK_DECAY * dts);
		const targetRoll = -dx * PLAYER_MAX_ROLL;
		const targetPitch = dy * PLAYER_MAX_PITCH;
		this.playerRoll += (targetRoll - this.playerRoll) * decay;
		this.playerPitch += (targetPitch - this.playerPitch) * decay;
		this.player.currentTransform.identity();
		this.player.currentTransform.rotate(this.playerRoll, AXIS_Z);
		this.player.currentTransform.rotate(this.playerPitch, AXIS_X);

		// Post-respawn invulnerability — blink the jet so the player
		// can read the "can't be hit" window, and tick the timer down
		// to 0. When the timer expires we force opacity back to 1 so a
		// late blink frame doesn't leave the jet half-transparent.
		if (this.invulnRemainingMs > 0) {
			this.invulnRemainingMs -= dt;
			if (this.invulnRemainingMs <= 0) {
				this.invulnRemainingMs = 0;
				this.player.setOpacity(1);
			} else {
				const blinkOn =
					Math.floor((INVULN_MS - this.invulnRemainingMs) / INVULN_BLINK_MS) %
						2 ===
					0;
				this.player.setOpacity(blinkOn ? 1 : 0.35);
			}
		}

		// Tick the custom 3D vapor trail.
		this.updateContrail(dt);

		// Reticle tracks the player's XY. We assign x/y directly
		// (not via pos.set) so the world-z stays at the value set in
		// `addChild(reticle, PLAYER_Z + RETICLE_FORWARD_Z)` — Vector3d.set
		// would default z to 0 and yank the reticle to the camera plane.
		this.reticle.pos.x = this.player.pos.x;
		this.reticle.pos.y = this.player.pos.y;

		// `dt`-driven cooldowns — engine's pacing is the only clock we
		// need here, no `performance.now()` syscall per frame.
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

		// Advance bullets, despawn past the far edge.
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			const b = this.bullets[i];
			b.sprite.pos.x += b.vx * dts;
			b.sprite.pos.y += b.vy * dts;
			b.sprite.depth += b.vz * dts;
			if (b.sprite.depth > DESPAWN_Z_FAR) {
				this.removeBullet(i);
			}
		}

		// Advance enemy bullets, resolve player hit + despawn.
		for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
			const b = this.enemyBullets[i];
			b.sprite.pos.x += b.vx * dts;
			b.sprite.pos.y += b.vy * dts;
			b.sprite.depth += b.vz * dts;
			// Past the player or off the side — cull. Pretty generous
			// X/Y bounds because at speed the bolt's screen position can
			// drift well past the play rect before its z catches up.
			if (
				b.sprite.depth < DESPAWN_Z_NEAR ||
				Math.abs(b.sprite.pos.x) > PLAY_BOUND_X * 3 ||
				Math.abs(b.sprite.pos.y) > PLAY_BOUND_Y * 3
			) {
				this.removeEnemyBullet(i);
				continue;
			}
			if (this.invulnRemainingMs > 0) {
				continue;
			}
			const ddx = b.sprite.pos.x - this.player.pos.x;
			const ddy = b.sprite.pos.y - this.player.pos.y;
			const ddz = b.sprite.depth - this.player.depth;
			if (ddx * ddx + ddy * ddy + ddz * ddz < HIT_RADIUS * HIT_RADIUS) {
				this.removeEnemyBullet(i);
				this.onPlayerHit();
				if (this.gameOver) {
					return true;
				}
			}
		}

		// Advance enemies, resolve bullet hits, then player hits.
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const e = this.enemies[i];
			e.mesh.pos.x += e.vx * dts;
			e.mesh.pos.y += e.vy * dts;
			e.mesh.depth += e.vz * dts;
			this.updateEnemyRoll(e, dt);

			// Shooters tick their fire cooldown each frame; when it
			// hits 0 they fire a single bolt at the player's current
			// position, then re-randomize the next interval.
			if (e.canFire) {
				e.nextFireMs -= dt;
				if (e.nextFireMs <= 0) {
					this.spawnEnemyBullet(e);
					e.nextFireMs =
						ENEMY_FIRE_INTERVAL_MIN_MS +
						Math.random() *
							(ENEMY_FIRE_INTERVAL_MAX_MS - ENEMY_FIRE_INTERVAL_MIN_MS);
				}
			}

			if (e.mesh.depth < DESPAWN_Z_NEAR) {
				this.removeEnemy(i);
				continue;
			}

			let hit = false;
			for (let j = this.bullets.length - 1; j >= 0; j--) {
				const b = this.bullets[j];
				const ddx = e.mesh.pos.x - b.sprite.pos.x;
				const ddy = e.mesh.pos.y - b.sprite.pos.y;
				const ddz = e.mesh.depth - b.sprite.depth;
				if (ddx * ddx + ddy * ddy + ddz * ddz < HIT_RADIUS * HIT_RADIUS) {
					this.removeBullet(j);
					hit = true;
					break;
				}
			}
			if (hit) {
				this.spawnExplosion(
					e.mesh.pos.x,
					e.mesh.pos.y,
					e.mesh.depth,
					TINT_ENEMY_EXPLOSION,
				);
				// Pan the crunch with the kill X so far-off-screen hits
				// audibly sit on the right side.
				playEnemyHit(e.mesh.pos.x / PLAY_BOUND_X);
				// Tiny kick so the kill registers physically too — short
				// enough that rapid-fire hits don't compound into a jelly
				// view. Axis BOTH so the shake reads as an explosion thump
				// rather than a sideways slap.
				this.camera.shake(4, 90);
				this.removeEnemy(i);
				this.score += 100;
				this.hud.setScore(this.score);
				continue;
			}

			// Player collision — only checked when the player isn't
			// inside the post-respawn invulnerability window.
			if (this.invulnRemainingMs > 0) {
				continue;
			}
			const pddx = e.mesh.pos.x - this.player.pos.x;
			const pddy = e.mesh.pos.y - this.player.pos.y;
			const pddz = e.mesh.depth - this.player.depth;
			if (pddx * pddx + pddy * pddy + pddz * pddz < HIT_RADIUS * HIT_RADIUS) {
				this.onPlayerHit();
				this.removeEnemy(i);
				if (this.gameOver) {
					return true;
				}
			}
		}

		this.updateCamera();
		return true;
	}
}
