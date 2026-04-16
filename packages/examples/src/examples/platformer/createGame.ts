import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	AUTO,
	audio,
	device,
	event,
	input,
	loader,
	plugin,
	pool,
	state,
	TextureAtlas,
} from "melonjs";
import { CoinEntity } from "./entities/coin.js";
import { FlyEnemyEntity, SlimeEnemyEntity } from "./entities/enemies.js";
import { PlayerEntity } from "./entities/player.js";
import { gameState } from "./gameState.js";
import { PlayScreen } from "./play.js";
import { resources } from "./resources.js";

export const createGame = () => {
	// create a new melonJS Application
	const _app = new Application(800, 600, {
		parent: "screen",
		scaleMethod: "flex-width",
		renderer: AUTO,
		preferWebGL1: false,
		subPixel: false,
		highPrecisionShader: !device.isMobile,
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

		// load the texture atlas
		gameState.texture = new TextureAtlas(
			loader.getJSON("texture"),
			loader.getImage("texture"),
		);

		// keyboard shortcuts for volume and fullscreen
		event.on(event.KEYDOWN, (_action, keyCode) => {
			if (keyCode === input.KEY.PLUS) {
				audio.setVolume(audio.getVolume() + 0.1);
			} else if (keyCode === input.KEY.MINUS) {
				audio.setVolume(audio.getVolume() - 0.1);
			}
			if (keyCode === input.KEY.F) {
				if (!device.isFullscreen()) {
					device.requestFullscreen();
				} else {
					device.exitFullscreen();
				}
			}
		});

		// switch to the Play state
		state.change(state.PLAY);
	});
};
