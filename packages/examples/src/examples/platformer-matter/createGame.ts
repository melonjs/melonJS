/**
 * melonJS — Platformer (Matter) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { MatterAdapter } from "@melonjs/matter-adapter";
import {
	Application,
	audio,
	type Container,
	collision,
	device,
	event,
	input,
	loader,
	plugin,
	pool,
	Rect,
	type Renderable,
	state,
	TextureAtlas,
	video,
} from "melonjs";
import { CoinEntity } from "./entities/coin.js";
import { FlyEnemyEntity, SlimeEnemyEntity } from "./entities/enemies.js";
import { LevelTrigger } from "./entities/leveltrigger.js";
import { PlayerEntity } from "./entities/player.js";
import { gameState } from "./gameState.js";
import { PlayScreen } from "./play.js";
import { resources } from "./resources.js";

/**
 * One-way platform registry. Each platform is assigned its own
 * collision-filter bit during level load so the player can dynamically
 * include or exclude individual platforms via `collisionFilter.mask`.
 *
 * Why per-platform bits instead of a shared bit + `pair.isActive = false`:
 * matter's event order is `beforeSolve → Detector.collisions → Pairs.update
 * → collisionStart → Resolver`. `Pairs.update` calls `Pair.update` which
 * forces `pair.isActive = true` for every currently-colliding pair, so any
 * write to `isActive` in `beforeSolve` is immediately overwritten before
 * the Resolver reads it. `collisionStart` runs after `Pairs.update` but
 * only fires for *new* pairs, and even then the write only survives one
 * step. The only durable hook is broad-phase filtering via
 * `collisionFilter.mask` — disabled platforms never enter pair detection
 * at all, so the Resolver never sees them.
 *
 * Each platform's bit is unique starting at `1 << 9` (bits 0-7 are the
 * standard melonJS collision types). With ~7 platforms per level and 23
 * available bits (9..31) there is plenty of headroom.
 */
export const oneWayPlatforms: Array<{
	renderable: Renderable;
	top: number;
	bit: number;
}> = [];

/**
 * Vertical tolerance (px) for the "player is above this platform" test.
 * Set just larger than the per-step gravity drop so the player doesn't
 * pop off the platform mid-stand from one frame of Verlet jitter.
 */
export const LAND_TOLERANCE = 4;

export const createGame = () => {
	// create a new melonJS Application running on the matter-js physics
	// adapter. Same entity code and Tiled map as the canonical platformer
	// — the only difference is the `physic` setting below.
	//
	// Gravity tuning: matter-js's native default of `(0, 1)` with its
	// internal `scale = 0.001` produces a moon-like feel at the
	// platformer's 32×32 sprite scale. After accounting for Verlet
	// integration (`force/mass * dt²`), a `gravity.y = 5` gives ~1.4
	// px/frame of downward velocity per step — close to the legacy
	// 0.98 px/frame arcade gravity, leaving headroom for a Newtonian
	// applyForce-driven jump to actually carry the player up before
	// gravity decelerates it.
	const _app = new Application(800, 600, {
		parent: "screen",
		scaleMethod: "flex-width",
		renderer: video.AUTO,
		preferWebGL1: false,
		subPixel: false,
		highPrecisionShader: false,
		physic: new MatterAdapter({ gravity: { x: 0, y: 5 } }),
	});

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// initialize the sound engine
	audio.init("mp3,ogg");

	// allow cross-origin for image/texture loading
	loader.setOptions({ crossOrigin: "anonymous" });

	// preload all resources
	loader.preload(resources, () => {
		// set the Play screen
		state.set(state.PLAY, new PlayScreen());

		// set the fade transition effect
		state.transition("fade", "#FFFFFF", 250);

		// register entity classes in the object pool
		pool.register("mainPlayer", PlayerEntity);
		pool.register("SlimeEntity", SlimeEnemyEntity);
		pool.register("FlyEntity", FlyEnemyEntity);
		pool.register("CoinEntity", CoinEntity, true);
		// override the built-in trigger with star mask transition
		pool.register("me.Trigger", LevelTrigger, true);

		// load the texture atlas
		gameState.texture = new TextureAtlas(
			loader.getJSON("texture"),
			loader.getImage("texture"),
		);

		// keyboard shortcuts for volume and fullscreen
		event.on(event.KEYDOWN, (_action, keyCode) => {
			if (keyCode === input.KEY.PLUS) {
				audio.setVolume(Math.min(1, audio.getVolume() + 0.1));
			} else if (keyCode === input.KEY.MINUS) {
				audio.setVolume(Math.max(0, audio.getVolume() - 0.1));
			}
			if (keyCode === input.KEY.F) {
				if (!device.isFullscreen()) {
					device.requestFullscreen();
				} else {
					device.exitFullscreen();
				}
			}
		});

		// Per-shape fix-ups for TMX geometry that matter handles differently
		// from the built-in SAT solver:
		//   - Platforms are zero-thickness polylines (matter can't make a
		//     body from collinear vertices); swap to a thin solid rect.
		//   - Each platform gets a unique collision-filter bit so the
		//     player can include/exclude individual platforms from its
		//     mask each frame (see `oneWayPlatforms` doc above for why
		//     this is the only matter-durable approach). Platforms are
		//     SOLID — the player's mask is what controls pass-through.
		//   - Slopes are sensors with manual position snap in the player
		//     handler (matter has no built-in slope-climb support).
		const PLATFORM_THICKNESS = 6;
		event.on(event.LEVEL_LOADED, () => {
			const adapter = _app.world.adapter as MatterAdapter;
			// Reset the registry on each level load (level.reload() on
			// death re-fires LEVEL_LOADED with a freshly-rebuilt world).
			oneWayPlatforms.length = 0;
			let nextPlatformBit = 1 << 9;
			// Accumulator of every per-platform bit assigned in this pass.
			// Used in the second walk below to extend enemies' masks so
			// they can rest on the map2 pyramid platforms.
			let allPlatformBits = 0;
			const walk = (c: Container | Renderable) => {
				const children = (c as Container).children;
				if (!children) return;
				for (const child of children) {
					if (child.type === "platform") {
						const width = child.width ?? 0;
						// skip degenerate platforms (zero-width / missing geometry)
						// — they'd build a zero-area body that matter can't
						// resolve a contact for.
						if (width > 0) {
							adapter.updateShape(child, [
								new Rect(0, 0, width, PLATFORM_THICKNESS),
							]);
							const bit = nextPlatformBit;
							nextPlatformBit <<= 1;
							allPlatformBits |= bit;
							adapter.setCollisionType(child, bit);
							// Mask: PLAYER (for one-way pass-through, driven
							// by per-frame mask updates on the player) and
							// ENEMY (so slimes can stand on the map2 pyramid
							// platforms). Coins are static sensors with their
							// own broad-phase filter — they don't need to see
							// platforms.
							adapter.setCollisionMask(
								child,
								collision.types.PLAYER_OBJECT | collision.types.ENEMY_OBJECT,
							);
							oneWayPlatforms.push({
								renderable: child,
								top: child.pos.y,
								bit,
							});
						}
					} else if (child.type === "slope") {
						adapter.setSensor(child, true);
					}
					walk(child);
				}
			};
			walk(_app.world);

			// Second pass: extend each enemy's mask to include every
			// per-platform bit assigned above. The default enemy mask
			// (`PLAYER_OBJECT | WORLD_SHAPE`) doesn't match any of those
			// bits, so without this step the broad phase drops every
			// enemy-vs-platform pair and dynamic enemies fall straight
			// through the map2 pyramid to the ground.
			if (allPlatformBits !== 0) {
				const extendEnemyMasks = (c: Container | Renderable) => {
					const children = (c as Container).children;
					if (!children) return;
					for (const child of children) {
						if (child.body?.collisionType === collision.types.ENEMY_OBJECT) {
							adapter.setCollisionMask(
								child,
								child.body.collisionMask | allPlatformBits,
							);
						}
						extendEnemyMasks(child);
					}
				};
				extendEnemyMasks(_app.world);
			}
		});

		// switch to the Play state
		state.change(state.PLAY);
	});
};
