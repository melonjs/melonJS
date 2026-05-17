/**
 * melonJS — Aseprite animation playback example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { loader, plugin, state, video } from "melonjs";
import { PlayScreen } from "./play";

const base = `${import.meta.env.BASE_URL}assets/aseprite/`;
const resources = [
	{ name: "paladin", type: "json", src: `${base}paladin.json` },
	{ name: "paladin", type: "image", src: `${base}paladin.png` },
];

export const createGame = () => {
	video.init(640, 480);

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	loader.setOptions({ withCredentials: true });

	// set all ressources to be loaded
	loader.preload(resources, () => {
		state.set(state.PLAY, new PlayScreen());

		// Start the game.
		state.change(state.PLAY);
	});
};
