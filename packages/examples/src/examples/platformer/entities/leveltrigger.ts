/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Trigger } from "melonjs";

type TriggerSettings = ConstructorParameters<typeof Trigger>[2];

/**
 * The door to the next level. Its mask transition is the player's own
 * silhouette, the frame it shows as it walks in, closing on the player;
 * the next level opens from the same place. "touching" is whoever set the
 * trigger off, so nothing here needs to find the player.
 */
export class LevelTrigger extends Trigger {
	constructor(x: number, y: number, settings: TriggerSettings) {
		super(x, y, {
			...settings,
			transition: "mask",
			shape: "touching",
			center: "touching",
			color: "#000",
			duration: 400,
		});
	}
}
