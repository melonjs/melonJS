/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 *
 * Alex4 Web Edition, the melonJS 0.9 remake, brought up to date and completed
 * with the levels, enemies and guardians of the original game.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	audio,
	loader,
	plugin,
	registerTiledObjectClass,
	state,
	TextureAtlas,
	video,
} from "melonjs";
import { FADE_COLOR, HEIGHT, WIDTH } from "./constants";
import { GroundPounderEntity, SpikeTruckEntity } from "./entities/bosses";
import {
	CherryEntity,
	EggEntity,
	HeartEntity,
	OneUpEntity,
	StarEntity,
} from "./entities/collectables";
import {
	CrusherEntity,
	Enemy1Entity,
	Enemy2Entity,
	JellyFishEntity,
	SpikeFishEntity,
} from "./entities/enemies";
import {
	Breakable,
	CannonEntity,
	ExitEntity,
	LolaEntity,
	RollBlock,
	SpikeEntity,
	WaterEntity,
} from "./entities/level";
import { PlayerEntity } from "./entities/player";
import { gameState } from "./gameState";
import { resources } from "./resources";
import { CreditsScreen } from "./screens/credits";
import { INTRO, IntroScreen } from "./screens/intro";
import { LevelCompleteScreen } from "./screens/levelComplete";
import { OutroScreen } from "./screens/outro";
import { PlayScreen } from "./screens/play";
import { TitleScreen } from "./screens/title";
import { shaders } from "./shaders";

export const createGame = async () => {
	// 4 times the original 160x120 resolution
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "fit",
		renderer: video.AUTO,
		antiAlias: false,
		// steady motion on any display (one update every other frame at 120 Hz)
		syncToDisplay: true,
	});
	await app.init();

	// add "#debug" to the URL to enable the debug Panel
	plugin.register(DebugPanelPlugin, "debugPanel");

	// a touch of modern shading
	shaders.init(app);

	// initialize the "audio"
	audio.init("mp3,ogg");

	// set all resources to be loaded
	loader.preload(resources, () => {
		gameState.atlas = new TextureAtlas(
			loader.getJSON("sprites"),
			loader.getImage("sprites") as HTMLImageElement,
		);

		// the screens
		state.set(INTRO, new IntroScreen());
		state.set(state.MENU, new TitleScreen());
		state.set(state.PLAY, new PlayScreen());
		state.set(state.READY, new LevelCompleteScreen());
		state.set(state.GAME_END, new OutroScreen());
		state.set(state.CREDITS, new CreditsScreen());

		// set a global fading transition for the screen
		state.transition("fade", FADE_COLOR, 250);
		// but not when the level is done
		state.setTransition(state.READY, false);

		// the objects placed in the Tiled maps
		registerTiledObjectClass("player", PlayerEntity);
		registerTiledObjectClass("cherry", CherryEntity);
		registerTiledObjectClass("star", StarEntity);
		registerTiledObjectClass("heart", HeartEntity);
		registerTiledObjectClass("oneup", OneUpEntity);
		registerTiledObjectClass("egg", EggEntity);
		registerTiledObjectClass("lola", LolaEntity);
		registerTiledObjectClass("enemy1", Enemy1Entity);
		registerTiledObjectClass("enemy2", Enemy2Entity);
		registerTiledObjectClass("crusher", CrusherEntity);
		registerTiledObjectClass("spikefish", SpikeFishEntity);
		registerTiledObjectClass("jellyfish", JellyFishEntity);
		registerTiledObjectClass("cannon", CannonEntity);
		registerTiledObjectClass("boss1", SpikeTruckEntity);
		registerTiledObjectClass("boss2", GroundPounderEntity);
		registerTiledObjectClass("spike", SpikeEntity);
		registerTiledObjectClass("spin", RollBlock);
		registerTiledObjectClass("breakable", Breakable);
		registerTiledObjectClass("water", WaterEntity);
		registerTiledObjectClass("exit", ExitEntity);

		// startup sound, and the story begins
		audio.play("startup");
		state.change(INTRO);
	});
};
