import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { game, loader, plugin, video } from "melonjs";
import { createExampleComponent } from "../utils.tsx";
import { TextTest } from "./text.ts";

const base = `${import.meta.env.BASE_URL}assets/text/`;

const createGame = () => {
	video.init(640, 480, {
		parent: "screen",
		scale: "auto",
		renderer: video.AUTO,
		preferWebGL1: false,
	});

	// register the debug plugin
	plugin.register(DebugPanelPlugin, "debugPanel");

	// set all ressources to be loaded
	loader.preload(
		[
			{ name: "xolo12", type: "image", src: `${base}xolo12.png` },
			{ name: "xolo12", type: "binary", src: `${base}xolo12.fnt` },
			{ name: "arialfancy", type: "image", src: `${base}arialfancy.png` },
			{ name: "arialfancy", type: "binary", src: `${base}arialfancy.fnt` },
		],
		() => {
			game.world.reset();
			game.world.addChild(new TextTest(), 1);
		},
	);
};

export const ExampleText = createExampleComponent(createGame);
