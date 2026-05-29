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
	type Camera3d,
	input,
	ParticleEmitter,
	Renderable,
	Sprite,
	type Vector3d,
} from "melonjs";
import {
	AXIS_X,
	AXIS_Z,
	BULLET_SPEED,
	DESPAWN_Z_FAR,
	DESPAWN_Z_NEAR,
	ENEMY_SPAWN_INTERVAL_MS,
	ENEMY_SPEED,
	ENGINE_X,
	ENGINE_Y,
	ENGINE_Z,
	EXHAUST_PUFF_INTERVAL_MS,
	EXHAUST_PUFF_LIFE_MS,
	EXHAUST_PUFF_MAX,
	EXHAUST_PUFF_SCALE,
	FIRE_COOLDOWN_MS,
	HIT_RADIUS,
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
} from "./constants";
import { HUD } from "./HUD";
import { Plane } from "./Plane";
import { Reticle } from "./Reticle";
import {
	makeExhaustPuffTexture,
	makeLaserBoltTexture,
	makeReticleTexture,
} from "./textures";
import type { BulletMover, EnemyMover } from "./types";

export class GameController extends Renderable {
	app: Application;
	camera: Camera3d;
	player: Plane;
	bullets: BulletMover[] = [];
	enemies: EnemyMover[] = [];
	score = 0;
	gameOver = false;
	lastEnemySpawnMs = 0;
	lastFireMs = 0;
	hud!: HUD;
	// current bank state, smoothed toward an input-driven target each
	// frame. Player mesh transform is rebuilt from these every tick.
	playerRoll = 0;
	playerPitch = 0;
	// Tiny generated canvas used as the laser-bolt texture for bullets —
	// avoids hauling around a placeholder PNG and keeps the asset list
	// to just the Kenney mesh files.
	bulletTexture: HTMLCanvasElement;
	// One streaming `ParticleEmitter` per engine pod. The engine
	// propagates `pos.z` to particles on spawn (see
	// `ParticleEmitter.addParticles`), so trails sit at the correct
	// Camera3d depth slice. Each tick we update `pos.x` / `pos.y`
	// directly (not via `set`, which would reset `pos.z` to 0) to
	// follow the player's roll-rotated engine-pod offsets.
	exhaustL!: ParticleEmitter;
	exhaustR!: ParticleEmitter;
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
		const exhaustTexture = makeExhaustPuffTexture();
		this.exhaustL = this._makeExhaustEmitter(exhaustTexture);
		this.exhaustR = this._makeExhaustEmitter(exhaustTexture);

		this.hud = new HUD(app);
		this.updateCamera();
	}

	/**
	 * Build one engine-exhaust ParticleEmitter, parent it to the world
	 * at the engine-pod depth slice, and start it streaming. Both pods
	 * share the same texture / settings — they only differ in spawn
	 * position, which `updateExhaustTrail` updates per frame.
	 */
	_makeExhaustEmitter(texture: HTMLCanvasElement): ParticleEmitter {
		const e = new ParticleEmitter(0, 0, {
			image: texture,
			tint: "#ffb45a",
			textureAdditive: true,
			frequency: EXHAUST_PUFF_INTERVAL_MS,
			minLife: EXHAUST_PUFF_LIFE_MS,
			maxLife: EXHAUST_PUFF_LIFE_MS,
			minStartScale: EXHAUST_PUFF_SCALE,
			maxStartScale: EXHAUST_PUFF_SCALE,
			minEndScale: 0,
			maxEndScale: 0,
			angle: -Math.PI / 2,
			angleVariation: 0.15,
			speed: 0.5,
			speedVariation: 0.2,
			totalParticles: EXHAUST_PUFF_MAX,
			duration: Number.POSITIVE_INFINITY,
			// Refresh per-particle bounds every frame so Camera3d's
			// frustum culling tests the particle's WORLD position (via
			// `updateBounds(absolute=true)`), not the stale local
			// bounds from construction. Without this, particles get
			// `inViewport: false` and are silently skipped by the
			// container's draw walk under Camera3d.
			accurateBounds: true,
		});
		this.app.world.addChild(e, PLAYER_Z + ENGINE_Z);
		e.streamParticles();
		return e;
	}

	/**
	 * Move both exhaust emitters to the current engine-pod positions.
	 * Pod offsets are player-local; we rotate by the current roll so the
	 * trails stay glued to the pods through banks. (Pitch is ignored —
	 * its effect on engine-pod screen position is small enough not to
	 * matter visually.) `pos.x` / `pos.y` are assigned directly so we
	 * don't touch `pos.z` (which `addChild` set to `PLAYER_Z + ENGINE_Z`
	 * and which propagates to each newly-spawned particle).
	 */
	updateExhaustTrail(): void {
		const cosR = Math.cos(this.playerRoll);
		const sinR = Math.sin(this.playerRoll);
		const ly = ENGINE_Y;
		const px = this.player.pos.x;
		const py = this.player.pos.y;
		this.exhaustL.pos.x = px + -ENGINE_X * cosR - ly * sinR;
		this.exhaustL.pos.y = py + -ENGINE_X * sinR + ly * cosR;
		this.exhaustR.pos.x = px + ENGINE_X * cosR - ly * sinR;
		this.exhaustR.pos.y = py + ENGINE_X * sinR + ly * cosR;
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
		(this.camera as Camera3d & { roll: number }).roll =
			(-this.player.pos.x / PLAY_BOUND_X) * MAX_BANK_ROLL;
	}

	spawnBullet(): void {
		const b = new Sprite(this.player.pos.x, this.player.pos.y, {
			image: this.bulletTexture,
		});
		// additive blend so overlapping bolts blow out to bright white,
		// reads like a tracer hose against the dusk sky
		b.blendMode = "additive";
		b.tint.setColor(255, 230, 90);
		// `addChild(child, z)` atomically sets the depth at insertion —
		// no window where the world's sort key is stale.
		this.app.world.addChild(b, PLAYER_Z + 40);
		this.bullets.push({ sprite: b, vx: 0, vy: 0, vz: BULLET_SPEED });
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
		this.enemies.push({
			mesh: e,
			vx: (dx / flightTime) * 0.4,
			vy: (dy / flightTime) * 0.4,
			vz: -ENEMY_SPEED,
		});
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

	setGameOver(): void {
		this.gameOver = true;
		// engines out — stop streaming new puffs. The already-in-flight
		// particles will finish their lifetime + fade naturally.
		this.exhaustL.stopStream();
		this.exhaustR.stopStream();
		this.hud.showGameOver(this.score);
	}

	reset(): void {
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			this.removeBullet(i);
		}
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			this.removeEnemy(i);
		}
		// Assign x/y directly — Vector3d.set(x, y) would default z to 0
		// and yank the player to the camera plane (= "player huge after
		// restart" bug); we want PLAYER_Z preserved.
		this.player.pos.x = 0;
		this.player.pos.y = 0;
		this.score = 0;
		this.gameOver = false;
		this.exhaustL.streamParticles();
		this.exhaustR.streamParticles();
		this.hud.hideGameOver();
		this.hud.setScore(0);
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

		// Keep the engine emitters glued to the player's engine pods.
		// The ParticleEmitter handles spawn + lifetime + fade.
		this.updateExhaustTrail();

		// Reticle tracks the player's XY. We assign x/y directly
		// (not via pos.set) so the world-z stays at the value set in
		// `addChild(reticle, PLAYER_Z + RETICLE_FORWARD_Z)` — Vector3d.set
		// would default z to 0 and yank the reticle to the camera plane.
		this.reticle.pos.x = this.player.pos.x;
		this.reticle.pos.y = this.player.pos.y;

		const nowMs = performance.now();
		if (
			input.isKeyPressed("fire") &&
			nowMs - this.lastFireMs >= FIRE_COOLDOWN_MS
		) {
			this.spawnBullet();
			this.lastFireMs = nowMs;
		}
		if (nowMs - this.lastEnemySpawnMs >= ENEMY_SPAWN_INTERVAL_MS) {
			this.spawnEnemy();
			this.lastEnemySpawnMs = nowMs;
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

		// Advance enemies, resolve bullet hits, then player hits.
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const e = this.enemies[i];
			e.mesh.pos.x += e.vx * dts;
			e.mesh.pos.y += e.vy * dts;
			e.mesh.depth += e.vz * dts;

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
					"#ffae3a",
				);
				this.removeEnemy(i);
				this.score += 100;
				this.hud.setScore(this.score);
				continue;
			}

			const pddx = e.mesh.pos.x - this.player.pos.x;
			const pddy = e.mesh.pos.y - this.player.pos.y;
			const pddz = e.mesh.depth - this.player.depth;
			if (pddx * pddx + pddy * pddy + pddz * pddz < HIT_RADIUS * HIT_RADIUS) {
				// big red player-death burst — at the player's position so
				// the explosion fills the cockpit view.
				this.spawnExplosion(
					this.player.pos.x,
					this.player.pos.y,
					this.player.depth,
					"#ff4a3a",
				);
				this.removeEnemy(i);
				this.setGameOver();
				return true;
			}
		}

		this.updateCamera();
		return true;
	}
}
