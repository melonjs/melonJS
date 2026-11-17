/**
 * melonJS — Slingshot: the PLAY stage.
 *
 * `onResetEvent` builds a round, on entering PLAY and again on each
 * `state.reload()` (PLAY AGAIN), onto a world the state manager has emptied,
 * bodies and all. What a round subscribes to, it gives back when it leaves
 * the world, so the stage has nothing to tear down itself.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, Stage } from "melonjs";
import { addKenneyCredit } from "../../kenneyCredit";
import { Round } from "./Round";

export class PlayStage extends Stage {
	override onResetEvent(app: Application) {
		app.world.addChild(new Round(app), 0);
		addKenneyCredit(app, "#1d2a3a");
	}
}
