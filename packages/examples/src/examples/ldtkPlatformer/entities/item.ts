/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	collision,
	type LDtkObjectSettings,
	Rect,
	Sprite,
	Tween,
} from "melonjs";
import { gameState } from "../gameState";

const SIZE = 16;
// the frame of the sprite sheet that shows each item type of the LDtk enum
const FRAMES: Record<string, number> = {
	Gold: 6,
	GoldNuggets: 6,
	Gem: 7,
	Green_gem: 7,
	Healing_potion: 8,
	Spell: 8,
};
const OTHER = 9;

/**
 * An "Item" entity of the LDtk world. What it is comes from its fields, set
 * in LDtk: `type` (a value of the project's `ItemType` enum) and `count`.
 */
export class Item extends Sprite {
	/** the item's id in the level: what tells it from the others once taken */
	id: string;
	kind: string;
	count: number;
	collected = false;

	constructor(x: number, y: number, settings: LDtkObjectSettings) {
		// standing on the bottom of the entity's box, in its middle
		super(x + (settings.width - SIZE) / 2, y + settings.height - SIZE, {
			image: "ldtk-platformer-sprites",
			framewidth: SIZE,
			frameheight: SIZE,
			anchorPoint: { x: 0, y: 0 },
		});
		this.id = settings.id;
		this.kind = String(settings.fields.type);
		this.count = Number(settings.fields.count ?? 1);
		this.addAnimation("item", [FRAMES[this.kind] ?? OTHER]);
		this.setCurrentAnimation("item");
		if (this.kind === "Green_gem") {
			this.tint.setColor(150, 255, 150);
		}
		// touched, not bumped into
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(2, 2, SIZE - 4, SIZE - 4)],
			isSensor: true,
			collisionType: collision.types.COLLECTABLE_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
		};
	}

	/** taken by the player: remembered, so the room does not bring it back */
	collect() {
		if (this.collected) {
			return;
		}
		this.collected = true;
		gameState.taken.add(this.id);
		gameState.bag.set(
			this.kind,
			(gameState.bag.get(this.kind) ?? 0) + this.count,
		);
		// rise and fade, then leave
		new Tween(this.pos).to({ y: this.pos.y - 12 }, { duration: 250 }).start();
		new Tween(this)
			.to({ alpha: 0 }, { duration: 250 })
			.onComplete(() => {
				this.ancestor?.removeChild(this);
			})
			.start();
	}
}
