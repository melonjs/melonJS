import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { loader, plugin, state, video } from "melonjs";
import paladinJson from "./assets/paladin.json?url";
import paladinPng from "./assets/paladin.png";
import { PlayScreen } from "./play";

const resources = [
	{ name: "paladin", type: "json", src: paladinJson },
	{ name: "paladin", type: "image", src: paladinPng },
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
