/**
 * melonJS — Water Overworld example (shader builtins showcase).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { loader, plugin, state, video } from "melonjs";
import { registerEntities } from "./entities";
import { WaterOverworldStage } from "./play";

const base = `${import.meta.env.BASE_URL}assets/waterOverworld/`;
const resources = [
	{ name: "level1", type: "tmx", src: `${base}level/level1.json` },
	{ name: "foreground", type: "tsx", src: `${base}tileset/foreground.json` },
	{
		name: "Floor Tiles1",
		type: "image",
		src: `${base}image/Floor Tiles1.webp`,
	},
	{
		name: "texture_image_0",
		type: "image",
		src: `${base}image/texture_image_0.webp`,
	},
	{
		name: "texture_image_0",
		type: "json",
		src: `${base}json/texture_image_0.json`,
	},
];

export const createGame = () => {
	// the water shader needs WebGL (ShaderEffect is inert under Canvas)
	try {
		if (
			!video.init(960, 640, {
				parent: "screen",
				renderer: video.WEBGL,
				scale: "auto",
				scaleMethod: "fit",
				antiAlias: false,
				subPixel: false,
			})
		) {
			alert("This example requires WebGL");
			return;
		}
	} catch {
		alert("This example requires WebGL");
		return;
	}

	// register the debug plugin (press "S" to toggle the panel)
	plugin.register(DebugPanelPlugin, "debugPanel");

	registerEntities();

	loader.preload(resources, () => {
		state.set(state.PLAY, new WaterOverworldStage());
		state.change(state.PLAY, false);
	});
};
