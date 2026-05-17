/**
 * melonJS — Aseprite animation playback example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import * as me from "melonjs";
import { Paladin } from "./entities";

export let paladin: me.Entity;

export class PlayScreen extends me.Stage {
	override onResetEvent() {
		paladin = new Paladin();
		me.game.world.addChild(paladin, 2);
	}
}
