/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { GamepadPlugin } from "@melonjs/gamepad-plugin";
import {
	Application,
	loader,
	plugin,
	registerObjectClass,
	state,
} from "melonjs";
import { Item } from "./entities/item";
import { Player } from "./entities/player";
import { Ladder, Teleport } from "./entities/zones";
import { PlayScreen } from "./play";
import { resources } from "./resources";

export const createGame = async () => {
	// pixel art: a small view, the size of the smallest room across, scaled
	// up to the page with its pixels sharp
	const app = new Application(256, 192, {
		parent: "screen",
		scale: "auto",
		antiAlias: false,
	});
	await app.init();

	// a stick and a button on a touch screen, read as a gamepad
	plugin.register(GamepadPlugin, "gamepad", { buttons: [{ label: "A" }] });

	// The entities of the LDtk world are built by the classes registered
	// under their identifier. The others ("Exit", "SecretArea", "GameSaver")
	// are shown as LDtk shows them, with their tile, and do nothing.
	registerObjectClass("Player", Player);
	registerObjectClass("Item", Item);
	registerObjectClass("Ladder", Ladder);
	registerObjectClass("Teleport", Teleport);

	loader.preload(resources, () => {
		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY, true);
	});
};
