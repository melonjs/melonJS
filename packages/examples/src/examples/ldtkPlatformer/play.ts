/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, Stage } from "melonjs";
import { Z } from "./config";
import { particles } from "./effects/particles";
import type { Player } from "./entities/player";
import { HUD } from "./ui/hud";
import { trackRoom } from "./world/rooms";
import { loadWorld } from "./world/world";

/** the game: the LDtk world, the player LDtk places in it, and the HUD over it */
export class PlayScreen extends Stage {
	override onResetEvent(app: Application) {
		loadWorld(app, () => {
			const world = app.world;
			const viewport = app.viewport;

			// The player is an object of the first room, found by its name
			// in LDtk. It is drawn over the layers of every room and depth.
			const [player] = world.getChildByName("Player") as Player[];
			player.depth = Z.player;

			particles.start(world);
			world.addChild(new HUD(viewport.width, viewport.height), Z.hud);
			// (a depth set on a child already in the world needs a sort)
			world.sort();

			// the room the player starts in: the camera is held to it, and
			// its neighbours are loaded
			const { x, y } = player.centre;
			trackRoom(app, x, y);

			// the screen opens from black
			viewport.fadeOut("#000000", 600);
		});
	}
}
