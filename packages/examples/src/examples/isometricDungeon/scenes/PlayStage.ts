/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	audio,
	BloomEffect,
	type Camera2d,
	input,
	Light2d,
	level,
	type Renderer,
	Stage,
	state,
	type TMXLayer,
	timer,
	type World,
} from "melonjs";
import {
	DARKNESS,
	MOTES_Z,
	SIGHT_RADIUS,
	SIGHT_SQUASH,
	TORCH_COLOR,
	TORCH_INTENSITY,
	TORCH_RADIUS,
} from "../constants";
import { Dungeon } from "../entities/dungeon";
import type { Hero } from "../entities/Hero";
import type { Usable } from "../entities/usables";
import { footDust, Motes } from "../fx/dust";
import { SFX } from "../fx/sound";
import { Hud } from "../ui/Hud";
import { Minimap } from "../ui/Minimap";

const KEYS: [number, string][] = [
	[input.KEY.UP, "up"],
	[input.KEY.DOWN, "down"],
	[input.KEY.LEFT, "left"],
	[input.KEY.RIGHT, "right"],
];
const ACTION_KEYS = [input.KEY.SPACE, input.KEY.E, input.KEY.ENTER];

export class PlayStage extends Stage {
	private started = 0;
	private bloom: BloomEffect | undefined;
	private hud: Hud | undefined;

	override onResetEvent(app: Application) {
		this.started = timer.getTime();
		app.world.gravity.set(0, 0);
		audio.playTrack(SFX.ambience, { sprite: "loop", volume: 0.6 });

		for (const [key, action] of KEYS) {
			input.bindKey(key, action);
		}
		for (const key of ACTION_KEYS) {
			// locked, so holding the key doesn't repeat the action
			input.bindKey(key, "action", true);
		}

		level.load("dungeon", {
			container: app.world,
			onLoaded: () => {
				this.build(app);
			},
		});
	}

	private build(app: Application) {
		// isometric depth: lower on screen means in front
		app.world.sortOn = "y";
		// the darkness every light cuts a soft hole in
		this.ambientLight.parseCSS(DARKNESS);

		const hero = app.world.getChildByName("hero")[0] as Hero;
		const hud = new Hud();
		this.hud = hud;
		const dungeon = new Dungeon(app.world, {
			chest: (opened, total) => {
				hud.chests(opened, total);
				if (opened < total) {
					hud.say(`${total - opened} to go`, 1200);
				}
			},
			locked: () => {
				hud.say("Locked. Open every chest first.");
			},
			gate: () => {
				hud.say("Somewhere, a gate creaks open...");
				app.viewport.shake(7, 800);
				app.viewport.fadeOut("rgba(255, 214, 150, 0.4)", 700);
				audio.play(SFX.gate, false, null, 0.9);
				const creak = audio.play(SFX.gateCreak, false, null, 0.8);
				audio.rate(SFX.gateCreak, 0.6, creak);
			},
			exit: () => {
				// nothing else to use while fading out
				hero.dungeon = undefined;
				const seconds = (timer.getTime() - this.started) / 1000;
				state.change(state.GAME_END, false, seconds);
			},
		});
		hud.chests(0, dungeon.chests);
		hud.say(`Find the ${dungeon.chests} chests`);

		hero.dungeon = dungeon;
		// a second camera, drawing the map in a corner
		const floor = app.world.getChildByName("floor")[0] as TMXLayer;
		this.cameras.set("minimap", new Minimap(hero, dungeon, floor));
		hero.onReach = (target: Usable | undefined) => {
			hud.hint(target?.hint ?? "");
		};
		hero.torch = new Light2d(
			hero.feetX,
			hero.feetY - 50,
			TORCH_RADIUS,
			TORCH_RADIUS * 0.75,
			TORCH_COLOR,
			TORCH_INTENSITY,
		);
		hero.torch.softness = 1;
		// below the sprites, so the light falls on the floor and not on the hero
		app.world.addChild(hero.torch, hero.depth - 0.5);
		// the darkness opens wider than the torch's glow: a light that only
		// cuts it, and draws nothing
		hero.sight = new Light2d(
			hero.feetX,
			hero.feetY - 70,
			SIGHT_RADIUS,
			SIGHT_RADIUS * SIGHT_SQUASH,
		);
		hero.sight.illuminationOnly = true;
		hero.sight.softness = 1;
		app.world.addChild(hero.sight, hero.depth - 0.5);
		app.world.addChild(new Motes(hero), MOTES_Z);
		hero.dust = footDust();
		app.world.addChild(hero.dust, hero.depth - 0.25);

		// positional sounds are heard from the hero
		audio.setListener(hero);

		// a shader effect: on the Canvas renderer it does nothing. The
		// threshold is high enough that only the sparks bloom, not the lit
		// floor
		this.bloom = new BloomEffect(app.renderer, {
			threshold: 0.94,
			intensity: 0.6,
			radius: 3,
		});
		app.viewport.addPostEffect(this.bloom);

		app.viewport.follow(hero.focus, app.viewport.AXIS.BOTH, 0.12);
		// frame the hero's body rather than the feet
		app.viewport.offset.set(0, -70);
	}

	// the HUD is not in the world, so the darkness drawn over the world does
	// not cover it: it is drawn here, over everything the cameras drew
	override draw(renderer: Renderer, world: World) {
		super.draw(renderer, world);
		const camera = this.cameras.get("default");
		if (this.hud && camera) {
			this.hud.preDraw(renderer);
			this.hud.draw(renderer, camera);
			this.hud.postDraw(renderer);
		}
	}

	// every camera draws the stage's darkness: keep it off the minimap, so
	// the map is lit
	override drawLighting(
		renderer: Renderer,
		camera: Camera2d,
		translateX: number,
		translateY: number,
	) {
		if (!(camera instanceof Minimap)) {
			super.drawLighting(renderer, camera, translateX, translateY);
		}
	}

	override onDestroyEvent(app: Application) {
		audio.setListener(null);
		// it is in no container, so nothing else frees its texts and logo
		this.hud?.reset();
		this.hud = undefined;
		// the viewport outlives the stage (removing the effect also destroys it)
		if (this.bloom) {
			app.viewport.removePostEffect(this.bloom);
			this.bloom = undefined;
		}
		for (const [key] of KEYS) {
			input.unbindKey(key);
		}
		for (const key of ACTION_KEYS) {
			input.unbindKey(key);
		}
	}
}
