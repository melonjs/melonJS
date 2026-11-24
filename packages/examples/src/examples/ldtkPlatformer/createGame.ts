/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { GamepadPlugin } from "@melonjs/gamepad-plugin";
import {
	Application,
	input,
	loader,
	plugin,
	registerObjectClass,
	state,
} from "melonjs";
import { bindControls } from "./controls";
import { Item } from "./entities/item";
import { Ladder } from "./entities/ladder";
import { Player } from "./entities/player";
import { Teleport } from "./entities/teleport";
import { PlayScreen } from "./play";
import { resources } from "./resources";

/**
 * A platformer in a world made with LDtk (its "GridVania" sample): 21 rooms
 * on two depths, loaded a few at a time around the player.
 *
 * Where to look:
 * - `world/` is the LDtk part: loading the world, following the player from
 *   room to room, reading the water from an IntGrid layer;
 * - `entities/` are the classes the world's entities are built with;
 * - `effects/` and `ui/` are the particles, the sounds and the HUD.
 */
export const createGame = async () => {
	// pixel art: a small view, the size of the smallest room across, scaled
	// up to the page with its pixels sharp
	const app = new Application(256, 192, {
		parent: "screen",
		scale: "auto",
		antiAlias: false,
	});
	await app.init();

	// The debug panel: frame times and draw counts, and the collision
	// shapes drawn over the game (the walls built from the IntGrid layer,
	// the ladders, the items). On P: the panel's own key, S, climbs down.
	plugin.register(DebugPanelPlugin, "debugPanel", input.KEY.P);

	// a stick and a button on a touch screen, read as a gamepad
	plugin.register(GamepadPlugin, "gamepad", { buttons: [{ label: "A" }] });
	bindControls();

	// An entity of the LDtk world is built by the class registered under
	// its identifier. The others ("Exit", "SecretArea", "GameSaver") are
	// shown as LDtk shows them, with their tile, and do nothing.
	registerObjectClass("Player", Player);
	registerObjectClass("Item", Item);
	registerObjectClass("Ladder", Ladder);
	registerObjectClass("Teleport", Teleport);

	loader.preload(resources, () => {
		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY, true);
	});
};
