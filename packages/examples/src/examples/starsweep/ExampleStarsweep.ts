/**
 * melonJS — Starsweep: a panel-powering maze game in space.
 *
 * Guide Bolt, a little sweeper robot, around floating space stations and
 * power up every deck panel while monsters roam. Wobblers wander, munchers
 * eat the power back off and chasers come for you. Frozen panels keep you
 * sliding, conveyor pads push you, damaged panels drop away behind you.
 * Zap the monsters, grab power-ups, and don't fall off into space.
 *
 * The levels are Tiled maps (`public/assets/starsweep/levels/*.tmj`),
 * loaded with the engine's Tiled loader: see `levels.ts` for how to edit
 * them. The monsters find their way with `@melonjs/pathfinding-plugin`:
 * chasers plan round walls, gates and goo and flank Bolt, drones fly
 * straight over the gaps, and the scanner power-up shows their plans
 * (see `field.ts`). Portrait, for phones held upright. On touch screens the
 * `@melonjs/gamepad-plugin` virtual gamepad (a stick and a ZAP button)
 * sits under the board and presses the same keys as the keyboard.
 *
 * The characters are sprites from one sheet, `cast.png`, baked from
 * Kenney's Monster Builder Pack (CC0) with every animation in its JSON (see
 * `cast.ts`). On GPU renderers a custom nebula shader animates the sky,
 * bloom, vignette and chromatic aberration post-effects polish the frame,
 * and a second, 3D camera draws star dust and novas behind the game (see
 * `fx.ts`). Every sound is synthesised with `audio.tone` / `audio.noise`.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, loader, save, state } from "melonjs";
import { createExampleComponent } from "../utils";
import { CAST } from "./cast";
import { FONT } from "./draw";
import { HEIGHT, HISCORE_KEY, WIDTH } from "./field";
import {
	LEVEL_FILES,
	LEVELS,
	levelFromTiled,
	TILESET_FILE,
	type TiledMap,
	type TiledTileset,
} from "./levels";
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
	const levels = `${base}assets/starsweep/levels/`;
	await loader.preload([
		// the characters, and their animations
		{ name: CAST, type: "image", src: `${base}assets/starsweep/cast.png` },
		{ name: CAST, type: "json", src: `${base}assets/starsweep/cast.json` },
		// Kenney Future (CC0), shared with the UI example
		{
			name: FONT,
			type: "fontface",
			src: `${base}assets/ui/font/kenvector_future.woff2`,
		},
		// the levels, edited in Tiled, the tileset they share and its image
		{ name: TILESET_FILE, type: "tsx", src: `${levels}${TILESET_FILE}.tsj` },
		{ name: TILESET_FILE, type: "image", src: `${levels}${TILESET_FILE}.png` },
		...LEVEL_FILES.map((name) => ({
			name,
			type: "tmx",
			src: `${levels}${name}.tmj`,
		})),
	]);

	// turn each Tiled map into a level the game can play
	const tileset = loader.getTMX(TILESET_FILE) as TiledTileset;
	LEVELS.length = 0;
	for (const name of LEVEL_FILES) {
		LEVELS.push(levelFromTiled(loader.getTMX(name) as TiledMap, tileset, name));
	}

	state.set(state.MENU, new TitleScreen());
	state.set(state.PLAY, new PlayScreen());
	state.transition("fade", "#0b0a24", 250);
	controls.bind();
	state.change(state.MENU);

	// release the keys and listeners when leaving the example
	return () => controls.unbind();
};

export const ExampleStarsweep = createExampleComponent(createGame);
