/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type LDtkProject,
	level,
	loader,
	Stage,
} from "melonjs";
import type { Player } from "./entities/player";
import { gameState } from "./gameState";
import { HUD } from "./hud";
import { ldtkWorld, trackRoom } from "./rooms";

/** above every layer of every depth of the world */
const PLAYER_Z = 100000;
const HUD_Z = PLAYER_Z + 1;

export class PlayScreen extends Stage {
	override onResetEvent(app: Application) {
		const project = loader.getLDtk("gridvania") as LDtkProject;

		// The background layer scrolls a little slower than its room. In
		// LDtk this is the layer's parallax factor; the sample has none, so
		// it is given one here, as if set in the editor.
		for (const layer of project.layerDefs.values()) {
			if (layer.identifier === "Background") {
				layer.parallaxFactorX = 0.06;
				layer.parallaxFactorY = 0.06;
				layer.parallaxScaling = false;
			}
		}

		// The player's start is in the project's table of content: known
		// before any room is loaded, it says which room to begin with.
		const [start] = project.getTableOfContent("Player");
		const first = start.level;
		if (first === undefined) {
			throw new Error("the world has no player");
		}
		gameState.depth = first.depth;
		gameState.room = undefined;

		// the whole world by the asset's name, starting with one room
		level.load("gridvania", {
			container: app.world,
			levels: [first.identifier],
			// of the "Collisions" layer's values, the walls are solid: water
			// is read where the player is, and swum in
			solidValues: [1],
			// the camera is held to a room at a time, not to the world
			setViewportBounds: false,
			// a room that comes back does not bring back what was taken
			entities: (entity) => {
				return !gameState.taken.has(entity.iid);
			},
			onLoaded: () => {
				const world = ldtkWorld();
				// the player belongs to the room it starts in: kept, it is
				// the game's, and stays when that room leaves
				const [player] = world.getEntities("Player") as Player[];
				world.keep(player);
				player.depth = PLAYER_Z;
				app.world.addChild(new HUD(project, app.viewport.width), HUD_Z);
				app.world.sort();
				const { x, y } = player.centre;
				trackRoom(app, x, y);
			},
		});
	}
}
