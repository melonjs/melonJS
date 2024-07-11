import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	TextureAtlas,
	audio,
	device,
	event,
	input,
	loader,
	plugin,
	pool,
	state,
	video,
} from "melonjs";
import { CoinEntity } from "./entities/coin.js";
import { FlyEnemyEntity, SlimeEnemyEntity } from "./entities/enemies.js";
import { PlayerEntity } from "./entities/player.js";
import { gameState } from "./gameState.js";
import { PlayScreen } from "./play.js";
import { resources } from "./resources.js";

export const createGame = () => {
	// init the video
	if (
		!video.init(800, 600, {
			parent: "screen",
			scaleMethod: "flex-width",
			renderer: video.WEBGL,
			preferWebGL1: false,
			depthTest: "z-buffer",
			subPixel: false,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// initialize the "sound engine"
	audio.init("mp3,ogg");

	// allow cross-origin for image/texture loading
	loader.setOptions({ crossOrigin: "anonymous" });

	// set all ressources to be loaded
	loader.preload(resources, () => {
		// set the "Play/Ingame" Screen Object
		state.set(state.PLAY, new PlayScreen());

		// set the fade transition effect
		state.transition("fade", "#FFFFFF", 250);

		// register our objects entity in the object pool
		pool.register("mainPlayer", PlayerEntity);
		pool.register("SlimeEntity", SlimeEnemyEntity);
		pool.register("FlyEntity", FlyEnemyEntity);
		pool.register("CoinEntity", CoinEntity, true);

		// load the texture atlas file
		// this will be used by renderable object later
		gameState.texture = new TextureAtlas(
			loader.getJSON("texture"),
			loader.getImage("texture"),
		);

		// add some keyboard shortcuts
		event.on(event.KEYDOWN, (action, keyCode /*, edge */) => {
			// change global volume setting
			if (keyCode === input.KEY.PLUS) {
				// increase volume
				audio.setVolume(audio.getVolume() + 0.1);
			} else if (keyCode === input.KEY.MINUS) {
				// decrease volume
				audio.setVolume(audio.getVolume() - 0.1);
			}

			// toggle fullscreen on/off
			if (keyCode === input.KEY.F) {
				if (!device.isFullscreen()) {
					device.requestFullscreen();
				} else {
					device.exitFullscreen();
				}
			}
		});

		// switch to PLAY state
		state.change(state.PLAY);
	});
};
