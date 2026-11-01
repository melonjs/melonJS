/**
 * melonJS — Starsweep: a panel-powering maze game in space.
 *
 * Guide Bolt, a little sweeper robot, around floating space stations and
 * power up every deck panel while monsters roam. Wobblers wander, munchers
 * eat the power back off and chasers come for you. Frozen panels keep you
 * sliding, conveyor pads push you, damaged panels drop away behind you.
 * Zap the monsters, grab power-ups, and don't fall off into space.
 *
 * Portrait, for phones held upright. On touch screens the
 * `@melonjs/gamepad-plugin` virtual gamepad (a stick and a ZAP button)
 * sits under the board and presses the same keys as the keyboard.
 *
 * The characters are put together from Kenney's Monster Builder Pack
 * (CC0) and the station is drawn from shapes. On GPU renderers a custom
 * nebula shader animates the sky, bloom, vignette and chromatic
 * aberration post-effects polish the frame, and 3D Space Kit ships fly
 * under the station (see `fx.ts`). Every sound is synthesised with
 * `audio.tone` / `audio.noise`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, loader, save, state } from "melonjs";
import { createExampleComponent } from "../utils";
import { ATLAS } from "./characters";
import { FONT } from "./draw";
import { HEIGHT, HISCORE_KEY, WIDTH } from "./field";
import { CRUISER_BASE, CRUISER_MODELS } from "./fx";
import { controls, PlayScreen, TitleScreen } from "./scenes";

const createGame = async () => {
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		scale: "auto",
		backgroundColor: "#0b0a24",
		// smooth cartoon art: soft edges, and parts drawn smaller than
		// the atlas stay clean
		antiAlias: true,
		textureFilter: "linear-mipmap",
	});
	await app.init();

	// keep the best score between visits
	save.add({ [HISCORE_KEY]: 0 });

	const base = import.meta.env.BASE_URL;
	await loader.preload([
		{ name: ATLAS, type: "image", src: `${base}assets/starsweep/monsters.png` },
		// Kenney Future (CC0), shared with the UI example
		{
			name: FONT,
			type: "fontface",
			src: `${base}assets/ui/font/kenvector_future.woff2`,
		},
		// Kenney Space Kit ships (CC0), shared with the multi-material mesh example
		...CRUISER_MODELS.flatMap((name) => [
			{ name, type: "obj", src: `${base}${CRUISER_BASE}${name}.obj` },
			{ name, type: "mtl", src: `${base}${CRUISER_BASE}${name}.mtl` },
		]),
	]);

	state.set(state.MENU, new TitleScreen());
	state.set(state.PLAY, new PlayScreen());
	state.transition("fade", "#0b0a24", 250);
	controls.bind();
	state.change(state.MENU);

	// release the keys and listeners when leaving the example
	return () => controls.unbind();
};

export const ExampleStarsweep = createExampleComponent(createGame);
