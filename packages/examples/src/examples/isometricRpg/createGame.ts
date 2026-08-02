/**
 * melonJS — isometric Tiled-map RPG demo example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Application, loader, plugin, pool, state } from "melonjs";
import { PlayerEntity } from "./PlayerEntity.js";
import { PlayScreen } from "./play.js";
import { resources } from "./resources.js";

export const createGame = async () => {
	const app = new Application(800, 600, {
		parent: "screen",
		scale: "auto",
	});
	await app.init();

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
