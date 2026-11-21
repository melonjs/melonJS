/**
 * melonJS — Aseprite animation playback example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import * as me from "melonjs";
import { createPaladin } from "./entities";

export let paladin: me.Sprite;

export class PlayScreen extends me.Stage {
	override onResetEvent() {
		paladin = createPaladin();
		me.game.world.addChild(paladin, 2);
	}
}
