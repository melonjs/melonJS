/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 *
 * A melonJS port of "Alex the Allegator 4" (Free Lunch Design, 2003), based
 * on Alex4 Web Edition (melonJS 0.9.x) and completed with the levels,
 * enemies and guardians of the original game data.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import { Application, audio, loader, plugin, state, video } from "melonjs";
import { bindControls } from "./controls";
import { loadProgress } from "./gameState";
import { initGfx } from "./gfx";
import { registerSpawns } from "./play/spawns";
import { resources } from "./resources";
import { CreditsScreen } from "./screens/credits";
import { LevelCompleteScreen } from "./screens/levelComplete";
import { OutroScreen } from "./screens/outro";
import { PlayScreen } from "./screens/play";
import { TitleScreen } from "./screens/title";

export const createGame = async () => {
	// 4x the original 160x120 Game Boy-ish resolution
	const app = new Application(640, 480, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "fit",
		renderer: video.AUTO,
		antiAlias: false,
		subPixel: false,
	});
	await app.init();

	plugin.register(DebugPanelPlugin, "debugPanel");

	audio.init("mp3,ogg");
	loader.setOptions({ crossOrigin: "anonymous" });

	loader.preload(resources, () => {
		initGfx();
		registerSpawns();
		bindControls();
		loadProgress();

		state.set(state.MENU, new TitleScreen());
		state.set(state.PLAY, new PlayScreen());
		state.set(state.READY, new LevelCompleteScreen());
		state.set(state.GAME_END, new OutroScreen());
		state.set(state.CREDITS, new CreditsScreen());

		state.transition("fade", "#dfedd2", 250);

		audio.play("startup");
		state.change(state.MENU, false);
	});
};
