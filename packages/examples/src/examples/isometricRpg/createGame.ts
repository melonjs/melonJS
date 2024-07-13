import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { loader, plugin, pool, state, video } from "melonjs";
import { PlayerEntity } from "./PlayerEntity.js";
import { PlayScreen } from "./play.js";
import { resources } from "./resources.js";

export const createGame = () => {
	video.init(800, 600, {
		parent: "screen",
		scale: "auto",
	});

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// set all ressources to be loaded
	loader.preload(resources, () => {
		// set the "Play/Ingame" Screen Object
		state.set(state.PLAY, new PlayScreen());

		// set the fade transition effect
		state.transition("fade", "#FFFFFF", 250);

		// register our objects entity in the object pool
		pool.register("mainPlayer", PlayerEntity);

		// switch to PLAY state
		state.change(state.PLAY);
	});
};
