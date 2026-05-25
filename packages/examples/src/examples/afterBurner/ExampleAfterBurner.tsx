/**
 * melonJS — AfterBurner-style Camera3d showcase (MVP).
 *
 * Behind-the-plane arcade shooter. Player jet sits in the screen plane
 * (XY), enemies fly toward the camera from the horizon (high z → low z),
 * bullets fly away from the camera (low z → high z). Camera is always
 * behind+slightly-above the player, fixed forward look — no yaw, so
 * sprites stay face-on without billboarding.
 *
 * This is the v0 mechanic skeleton — monster.png as placeholder for the
 * jet and enemies. Polish (Kenney 3D meshes, particle exhaust, lock-on
 * missile, motion-blur post-FX, procedural audio) comes after the loop
 * proves out.
 *
 * Controls: arrow keys / WASD to maneuver, space to fire.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import type { CanvasRenderer, WebGLRenderer } from "melonjs";
import {
	Application,
	type Camera3d,
	Camera3d as Camera3dClass,
	type Gradient,
	input,
	loader,
	Matrix3d,
	Renderable,
	Sprite,
	Stage,
	state,
	type Vector3d,
	video,
	type World,
} from "melonjs";
import monsterImg from "../shaderEffects/assets/monster.png";
import { createExampleComponent } from "../utils";

type Renderer = CanvasRenderer | WebGLRenderer;

// World coordinate system:
//   +X right, +Y down (engine convention), +Z forward (away from camera).
//   Player anchored at z = PLAYER_Z; XY moves freely within play bounds.
//   Enemies spawn at SPAWN_Z and decrement z each frame.
//   Bullets spawn at player.z and increment z each frame.
const PLAYER_Z = 200;
const SPAWN_Z = 3000;
const DESPAWN_Z_FAR = 4000; // bullet past-horizon cleanup
const DESPAWN_Z_NEAR = 0; // enemy past-player cleanup
const PLAY_BOUND_X = 350;
const PLAY_BOUND_Y = 200;

// Movement / gameplay tuning.
const PLAYER_SPEED = 500; // world units per second
// camera banking — pitch / yaw / roll radians at the play-bound edge.
// Larger = more dramatic horizon + view tilt at the corners. Roll is
// the signature After Burner move — the whole world rotates when the
// pilot banks left/right.
const MAX_BANK_PITCH = 0.35;
const MAX_BANK_YAW = 0.22;
const MAX_BANK_ROLL = 0.18;
const BULLET_SPEED = 1800; // world units per second toward +Z
const ENEMY_SPEED = 600; // world units per second toward -Z
const ENEMY_SPAWN_INTERVAL_MS = 700;
const FIRE_COOLDOWN_MS = 140;
const HIT_RADIUS = 60; // sphere radius for collision

// ground speed-line tuning
const SPEED_LINE_COUNT = 14;
const SPEED_LINE_SCROLL_PER_S = 1.6; // cycles per second — faster = more "Mach"
const HORIZON_BASE_FRACTION = 0.55; // baseline horizon Y at pitch = 0

/**
 * Stage subclass that paints a sunset sky → horizon → desert ground
 * gradient + animated speed-line chevrons as a screen-space backdrop
 * **before** the world (and its perspective camera) draws. Done via an
 * ortho projection swap so the gradient and lines fill the canvas
 * regardless of Camera3d's perspective matrix; we restore the camera's
 * projection before delegating to `super.draw` so gameplay still
 * renders correctly.
 *
 * Two effects keyed off the camera:
 * - **horizon Y tracks `camera.pitch`** — when the player banks up the
 *   horizon drops, when they dive it climbs. Pixel offset is
 *   `pitch / (fov / 2) * (screenH / 2)`, the standard
 *   perspective→screen formula for a point at infinity.
 * - **speed-line chevrons** scroll outward from the vanishing point
 *   on the ground each frame, animated by `scrollT` advanced from
 *   `update(dt)`. Sells the "Mach-2 forward motion" feel.
 */
class SkyboxStage extends Stage {
	app: Application | null = null;
	skyR = 0;
	skyG = 0;
	skyB = 0;
	groundR = 0;
	groundG = 0;
	groundB = 0;
	sky: Gradient | null = null;
	ground: Gradient | null = null;
	orthoProjection = new Matrix3d();
	scrollT = 0; // 0..1, animated each frame

	override onResetEvent(app: Application): void {
		this.app = app;
		this.scrollT = 0;
	}

	override update(dt: number): boolean {
		this.scrollT = (this.scrollT + (dt / 1000) * SPEED_LINE_SCROLL_PER_S) % 1;
		return super.update(dt);
	}

	override draw(renderer: Renderer, world: World): void {
		if (this.app) {
			const w = renderer.width;
			const h = renderer.height;

			// Read the live Camera3d from this stage's own cameras map
			// — `app.viewport` is set at reset and can lag a stage swap.
			const camera = this.cameras.get("default") as Camera3d | undefined;
			if (!camera) {
				super.draw(renderer, world);
				return;
			}

			// Horizon Y from camera pitch. With Y-down + the lookAt
			// math in Camera3d, negative pitch = looking down (target
			// below camera) → horizon rises on screen; positive pitch
			// = looking up → horizon drops. `tan(pitch) / tan(fov/2)`
			// gives the NDC offset, *h/2 converts to pixels.
			const fov = camera.fov;
			const pitchOffsetPx =
				(Math.tan(camera.pitch) / Math.tan(fov / 2)) * (h / 2);
			const horizon = h * HORIZON_BASE_FRACTION + pitchOffsetPx;
			// clamp so the ground is always at least a sliver visible
			// (prevents pathological all-sky / all-ground frames during
			// extreme pitches)
			const horizonClamped = Math.max(40, Math.min(h - 40, horizon));

			// Swap to a screen-space ortho projection so fillRect lands
			// on actual pixels, not perspective-projected world rects.
			renderer.save();
			renderer.resetTransform();
			this.orthoProjection.ortho(0, w, h, 0, -1, 1);
			renderer.setProjection(this.orthoProjection);

			// Apply the camera roll to the backdrop. Camera3d doesn't
			// have a built-in `roll` field, so we hang one on the
			// camera object from GameController.updateCamera and read
			// it back here (typed via cast). When the player banks,
			// the horizon and speed-line fan tilt with the cockpit.
			const roll = (camera as Camera3d & { roll?: number }).roll ?? 0;
			if (roll !== 0) {
				renderer.translate(w / 2, h / 2);
				renderer.rotate(roll);
				renderer.translate(-w / 2, -h / 2);
			}

			// Rebuild the gradients per frame so they stretch correctly
			// with the moving horizon. Two `createLinearGradient` calls
			// per frame is cheap (just object allocation + stop list)
			// and lets the horizon Y be fully dynamic.
			this.sky = renderer.createLinearGradient(0, 0, 0, horizonClamped);
			this.sky.addColorStop(0, "#0d1442"); // deep blue zenith
			this.sky.addColorStop(0.55, "#4a2a82"); // purple mid-sky
			this.sky.addColorStop(0.85, "#d4476a"); // pink lower-sky
			this.sky.addColorStop(1, "#ff9c4a"); // bright orange at horizon

			this.ground = renderer.createLinearGradient(0, horizonClamped, 0, h);
			this.ground.addColorStop(0, "#b8623c"); // warm sand at horizon
			this.ground.addColorStop(0.3, "#5c2e1a"); // mid-ground brown
			this.ground.addColorStop(1, "#1a0e08"); // near-black under-camera

			// Oversize the rects by `pad` on every side so the roll
			// rotation doesn't reveal black corners. 200px buffer covers
			// the maximum bank without over-painting noticeably.
			const pad = 200;
			renderer.setColor(this.sky);
			renderer.fillRect(-pad, -pad, w + pad * 2, horizonClamped + pad);
			renderer.setColor(this.ground);
			renderer.fillRect(
				-pad,
				horizonClamped,
				w + pad * 2,
				h - horizonClamped + pad,
			);

			// Speed-line chevrons. Each line goes from the vanishing
			// point (centerX, horizon) outward to a position on the
			// bottom edge. We animate by interpolating each line's
			// progress 0→1 from vanishing point to bottom edge — t
			// near 0 is short stub near the horizon, t near 1 is a
			// long streak reaching the bottom of the screen. As t
			// wraps, lines disappear off-screen and respawn at the
			// horizon: instant Mach-2 forward-motion cue.
			const vpX = w / 2;
			const vpY = horizonClamped;
			renderer.setColor("#ffd89c"); // warm cream — matches the sunset palette
			renderer.lineWidth = 2;
			for (let i = 0; i < SPEED_LINE_COUNT; i++) {
				const t = (i / SPEED_LINE_COUNT + this.scrollT) % 1;
				// non-linear distribution: lines accelerate as they
				// approach the camera (matches real perspective motion)
				const progress = t * t;
				const groundHeight = h - vpY;
				// each line's X spread at t=0 is 0 (at vp), at t=1 is
				// half the canvas width on each side
				const spread = w * 0.7;
				// distribute lines around the screen by their index —
				// avoids all lines being on top of each other when scrollT
				// is the same for every line at evenly spaced t's
				const angleOffset = (i / SPEED_LINE_COUNT) * 2 * Math.PI;
				const sideX = Math.cos(angleOffset) * spread * progress;
				const endX = vpX + sideX;
				const endY = vpY + groundHeight * progress;
				// fade the line in as it leaves the horizon, fade out
				// just before exiting bottom — avoids hard pop-in/out
				const alpha =
					t < 0.1
						? t / 0.1 // fade in
						: t > 0.9
							? (1 - t) / 0.1 // fade out
							: 1;
				renderer.setGlobalAlpha(alpha * 0.7);
				renderer.strokeLine(vpX, vpY, endX, endY);
			}
			renderer.setGlobalAlpha(1);

			renderer.restore();
		}
		super.draw(renderer, world);
	}
}

const createGame = () => {
	const app = new Application(1024, 768, {
		parent: "screen",
		renderer: video.WEBGL,
		scale: "auto",
		cameraClass: Camera3dClass,
	});

	// world.backgroundColor stays transparent (alpha 0) — the SkyboxStage
	// paints the actual visible background each frame
	app.world.backgroundColor.setColor(0, 0, 0, 0);

	loader.preload([{ name: "monster", type: "image", src: monsterImg }], () => {
		// swap in the gradient-painting stage as the default
		state.set(state.DEFAULT, new SkyboxStage());
		state.change(state.DEFAULT, true);

		const controller = new GameController(app);
		app.world.addChild(controller);
	});
};

interface Mover {
	sprite: Sprite;
	vx: number; // world units / second
	vy: number;
	vz: number;
}

/**
 * Hidden Renderable that owns the per-frame game tick. It draws
 * nothing — its `update(dt)` is called by the world container every
 * frame and runs all gameplay logic. Lives in the world so the engine
 * delivers `dt` correctly without us needing to track timestamps.
 */
class GameController extends Renderable {
	app: Application;
	camera: Camera3d;
	player: Sprite;
	bullets: Mover[] = [];
	enemies: Mover[] = [];
	score = 0;
	gameOver = false;
	lastEnemySpawnMs = 0;
	lastFireMs = 0;
	hud: HTMLElement | null = null;
	overlay: HTMLElement | null = null;

	// Always-behind camera offsets. Y-down convention → negative Y is up.
	static readonly CAM_OFFSET_Y = -80;
	static readonly CAM_OFFSET_Z = -350;

	constructor(app: Application) {
		// Renderable with zero bounds — it doesn't draw, just ticks.
		super(0, 0, 1, 1);
		this.app = app;
		this.camera = app.viewport as Camera3d;
		this.alwaysUpdate = true; // tick even when off-camera

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

		// Player jet placeholder.
		this.player = new Sprite(0, 0, { image: "monster" });
		this.player.scale(0.35);
		app.world.addChild(this.player);
		this.player.depth = PLAYER_Z;

		this.setupHud();
		this.updateCamera();
	}

	setupHud(): void {
		const parent = this.app.renderer.getCanvas().parentElement;
		if (!parent) return;
		parent.style.position = "relative";

		this.hud = document.createElement("div");
		this.hud.style.cssText =
			"position:absolute;top:60px;left:16px;color:#ffe066;" +
			"font-family:'Courier New',monospace;font-size:20px;font-weight:bold;" +
			"text-shadow:0 0 4px #000;z-index:1000;pointer-events:none;";
		parent.appendChild(this.hud);

		this.overlay = document.createElement("div");
		this.overlay.style.cssText =
			"position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
			"color:#ff5566;font-family:'Courier New',monospace;font-size:42px;" +
			"font-weight:bold;text-shadow:0 0 12px #000;z-index:1000;display:none;" +
			"text-align:center;pointer-events:none;";
		parent.appendChild(this.overlay);

		this.refreshHud();
	}

	refreshHud(): void {
		if (this.hud) {
			this.hud.textContent = `SCORE  ${this.score.toString().padStart(6, "0")}`;
		}
	}

	updateCamera(): void {
		// Decoupled chase cam: position follows the player loosely so
		// the jet feels mobile on-screen (full follow = player
		// stuck-at-center, defeats the input feedback), but
		// pitch/yaw/roll are driven DIRECTLY from player position so
		// the view-tilt is dramatic at the play-bound corners. Skips
		// `lookAt` entirely — we set the rotation we want.
		(this.camera.pos as Vector3d).set(
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
		const b = new Sprite(0, 0, { image: "monster" });
		b.scale(0.15); // bigger than a real bullet, but the placeholder
		// is alpha-edged so the visible mass is smaller than the bounds
		b.tint.setColor(255, 230, 90);
		this.app.world.addChild(b);
		b.pos.set(this.player.pos.x, this.player.pos.y);
		b.depth = PLAYER_Z + 40;
		this.bullets.push({ sprite: b, vx: 0, vy: 0, vz: BULLET_SPEED });
	}

	spawnEnemy(): void {
		const e = new Sprite(0, 0, { image: "monster" });
		e.scale(0.5);
		this.app.world.addChild(e);
		const ex = (Math.random() * 2 - 1) * PLAY_BOUND_X;
		const ey = (Math.random() * 2 - 1) * PLAY_BOUND_Y;
		e.pos.set(ex, ey);
		e.depth = SPAWN_Z;
		// partial homing — enemies drift toward where the player IS at
		// spawn, not where they end up. Adds genuine threat without being
		// a guaranteed hit.
		const dx = this.player.pos.x - ex;
		const dy = this.player.pos.y - ey;
		const flightTime = (SPAWN_Z - PLAYER_Z) / ENEMY_SPEED;
		this.enemies.push({
			sprite: e,
			vx: (dx / flightTime) * 0.4,
			vy: (dy / flightTime) * 0.4,
			vz: -ENEMY_SPEED,
		});
	}

	removeMover(arr: Mover[], i: number): void {
		const m = arr[i];
		this.app.world.removeChild(m.sprite);
		// swap-with-last: O(1), iteration order doesn't matter for gameplay
		arr[i] = arr[arr.length - 1];
		arr.pop();
	}

	setGameOver(): void {
		this.gameOver = true;
		if (this.overlay) {
			this.overlay.style.display = "block";
			this.overlay.innerHTML = `GAME OVER<br><span style="font-size:18px;color:#ccc">SCORE ${this.score} — press R to restart</span>`;
		}
	}

	reset(): void {
		for (let i = this.bullets.length - 1; i >= 0; i--) {
			this.removeMover(this.bullets, i);
		}
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			this.removeMover(this.enemies, i);
		}
		this.player.pos.set(0, 0);
		this.score = 0;
		this.gameOver = false;
		if (this.overlay) {
			this.overlay.style.display = "none";
		}
		this.refreshHud();
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
				this.removeMover(this.bullets, i);
			}
		}

		// Advance enemies, resolve bullet hits, then player hits.
		for (let i = this.enemies.length - 1; i >= 0; i--) {
			const e = this.enemies[i];
			e.sprite.pos.x += e.vx * dts;
			e.sprite.pos.y += e.vy * dts;
			e.sprite.depth += e.vz * dts;

			if (e.sprite.depth < DESPAWN_Z_NEAR) {
				this.removeMover(this.enemies, i);
				continue;
			}

			let hit = false;
			for (let j = this.bullets.length - 1; j >= 0; j--) {
				const b = this.bullets[j];
				const ddx = e.sprite.pos.x - b.sprite.pos.x;
				const ddy = e.sprite.pos.y - b.sprite.pos.y;
				const ddz = e.sprite.depth - b.sprite.depth;
				if (ddx * ddx + ddy * ddy + ddz * ddz < HIT_RADIUS * HIT_RADIUS) {
					this.removeMover(this.bullets, j);
					hit = true;
					break;
				}
			}
			if (hit) {
				this.removeMover(this.enemies, i);
				this.score += 100;
				this.refreshHud();
				continue;
			}

			const pddx = e.sprite.pos.x - this.player.pos.x;
			const pddy = e.sprite.pos.y - this.player.pos.y;
			const pddz = e.sprite.depth - this.player.depth;
			if (pddx * pddx + pddy * pddy + pddz * pddz < HIT_RADIUS * HIT_RADIUS) {
				this.removeMover(this.enemies, i);
				this.setGameOver();
				return true;
			}
		}

		this.updateCamera();
		return true;
	}
}

export const ExampleAfterBurner = createExampleComponent(createGame);
