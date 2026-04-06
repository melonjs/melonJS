import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Application, loader, plugin, state, video } from "melonjs";
import { createExampleComponent } from "../utils.tsx";
import { TextScreen } from "./text.ts";

const base = `${import.meta.env.BASE_URL}assets/text/`;

const createGame = () => {
	const _app = new Application(640, 480, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
	});

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// set all resources to be loaded
	loader.preload(
		[
			{ name: "xolo12", type: "image", src: `${base}xolo12.png` },
			{ name: "xolo12", type: "binary", src: `${base}xolo12.fnt` },
			{ name: "arialfancy", type: "image", src: `${base}arialfancy.png` },
			{ name: "arialfancy", type: "binary", src: `${base}arialfancy.fnt` },
		],
		() => {
			state.set(state.PLAY, new TextScreen());
			state.change(state.PLAY);
		},
	);
};

export const ExampleText = createExampleComponent(createGame);
