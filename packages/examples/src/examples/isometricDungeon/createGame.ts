/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	Application,
	audio,
	loader,
	plugin,
	registerTiledObjectClass,
	state,
} from "melonjs";
import { VIEW_H, VIEW_W } from "./constants";
import { Hero } from "./entities/Hero";
import { Chest, Door, Exit, Gate } from "./entities/usables";
import { WallTorch } from "./entities/WallTorch";
import { prepareEffects } from "./fx/effects";
import { resources } from "./resources";
import { EscapedStage } from "./scenes/EscapedStage";
import { PlayStage } from "./scenes/PlayStage";

export const createGame = async () => {
	const app = new Application(VIEW_W, VIEW_H, {
		parent: "screen",
		scale: "auto",
		// the same number of updates every frame, so the scrolling is steady
		syncToDisplay: true,
		// and the world and the hero move by fractions of a pixel together,
		// rather than each snapping to whole pixels on its own
		subPixel: true,
		// rendered art, not pixel art: textures sampled smoothly, so a
		// fraction of a pixel shows as such instead of a whole pixel jump,
		// while the canvas is still scaled up to the window crisp. And from
		// the mipmaps where it is drawn small: the minimap, at a tenth of
		// its size, would shimmer as the hero walks
		textureFilter: "linear-mipmap",
	});
	await app.init();

	// debug panel, toggled with S
	plugin.register(DebugPanelPlugin, "debugPanel");

	// the classes in the map: the hero's spawn point has its own, the rest
	// are set on tiles in the tileset, and every object placed from one of
	// those tiles is built by its class
	registerTiledObjectClass("Hero", Hero);
	registerTiledObjectClass("Chest", Chest);
	registerTiledObjectClass("Door", Door);
	registerTiledObjectClass("Gate", Gate);
	registerTiledObjectClass("Exit", Exit);
	registerTiledObjectClass("WallTorch", WallTorch);

	// must be called before loading any audio
	audio.init("mp3,ogg");

	await loader.preload(resources);
	// the level's shader effects, made while the loading screen is still up,
	// so their shaders compile here and not behind the fade into the level
	prepareEffects(app);

	state.set(state.PLAY, new PlayStage());
	state.set(state.GAME_END, new EscapedStage());
	state.transition("fade", "#000000", 400);
	state.change(state.PLAY);
};
