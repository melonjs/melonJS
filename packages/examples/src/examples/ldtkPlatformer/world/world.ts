/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type LDtkProject,
	type LDtkWorld,
	level,
	loader,
} from "melonjs";
import { WORLD } from "../config";
import { gameState, newGame } from "../gameState";

/**
 * The project, as loaded from the `.ldtk` file: its levels, its definitions
 * and its table of content, whether a level is in the game or not.
 * @returns the project
 */
export const ldtkProject = () => {
	return loader.getLDtk(WORLD) as LDtkProject;
};

/**
 * The world in the game, once `level.load` has added it: the levels that are
 * loaded, and the means to load and unload others.
 * @returns the world
 */
export const ldtkWorld = () => {
	return level.getCurrentLevel() as unknown as LDtkWorld;
};

/**
 * The background layer scrolls a little slower than its room. In LDtk this
 * is the layer's parallax factor; the sample has none, so it is given one
 * here, as if set in the editor.
 * @param project - the project
 */
function slowDownBackground(project: LDtkProject) {
	for (const layer of project.layerDefs.values()) {
		if (layer.identifier === "Background") {
			layer.parallaxFactorX = 0.06;
			layer.parallaxFactorY = 0.06;
			layer.parallaxScaling = false;
		}
	}
}

/**
 * Load the LDtk world into the game, starting with the room the player is
 * in. The other rooms come and go as the player walks (see `rooms.ts`).
 * @param app - the application
 * @param onLoaded - called once the first room is in the game
 */
export function loadWorld(app: Application, onLoaded: () => void) {
	const project = ldtkProject();
	slowDownBackground(project);

	// The player's start is in the project's table of content: known before
	// any room is loaded, it says which room to begin with.
	const [start] = project.getTableOfContent("Player");
	const first = start.level;
	if (first === undefined) {
		throw new Error("the world has no player");
	}
	newGame(first.depth);

	// the asset's name alone is the whole world; `<name>:<level>` is one level
	level.load(WORLD, {
		container: app.world,
		// the rooms to start with: the others are loaded as the player nears
		levels: [first.identifier],
		// Walls are built from the IntGrid layer named "Collisions". Of its
		// values only 1 is solid; the others (water, ladders) are read by
		// the game where the player is.
		solidValues: [1],
		// the camera is held to one room at a time, not to the whole world
		setViewportBounds: false,
		// a room that comes back does not bring back what the player took
		objects: (settings) => {
			return !gameState.taken.has(settings.id);
		},
		onLoaded,
	});
}
