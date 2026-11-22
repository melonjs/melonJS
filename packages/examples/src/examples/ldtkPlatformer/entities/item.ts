/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	collision,
	type LDtkObjectSettings,
	Rect,
	ShineEffect,
	Sprite,
	Tween,
	timer,
} from "melonjs";
import { SPRITES, TILE } from "../config";
import { particles } from "../effects/particles";
import { sounds } from "../effects/sounds";
import { gameState } from "../gameState";

/** the frame of the sprite sheet that shows each value of LDtk's `ItemType` enum */
const FRAMES: Record<string, number> = {
	Gold: 6,
	GoldNuggets: 6,
	Gem: 7,
	Green_gem: 7,
	Healing_potion: 8,
	Spell: 8,
};
const OTHER_FRAME = 9;
/** the frames across the sprite sheet: one glint of the shine for each */
const SHEET_FRAMES = 10;

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
	/** a glint that sweeps across the item, and the item bobbing up and down */
	shine: ShineEffect | undefined;
	bob: Tween;

	constructor(x: number, y: number, settings: LDtkObjectSettings) {
		// standing on the bottom of the entity's box, in its middle
		super(x + (settings.width - TILE) / 2, y + settings.height - TILE, {
			image: SPRITES,
			framewidth: TILE,
			frameheight: TILE,
			anchorPoint: { x: 0, y: 0 },
		});
		this.id = settings.id;
		this.kind = String(settings.fields.type);
		this.count = Number(settings.fields.count ?? 1);
		this.addAnimation("item", [FRAMES[this.kind] ?? OTHER_FRAME]);
		this.setCurrentAnimation("item");
		if (this.kind === "Green_gem") {
			this.tint.setColor(150, 255, 150);
		}
		// touched, not bumped into
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(2, 2, TILE - 4, TILE - 4)],
			isSensor: true,
			collisionType: collision.types.COLLECTABLE_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
		};
		this.bob = new Tween(this.pos).to(
			{ y: this.pos.y - 2 },
			{
				duration: 700,
				easing: Tween.Easing.Sinusoidal.InOut,
				yoyo: true,
				repeat: Infinity,
				// not every item of a room in step
				delay: Math.random() * 700,
			},
		);
	}

	override onActivateEvent() {
		this.bob.start();
		// (a shader effect: it does nothing on the Canvas renderer)
		this.shine ??= new ShineEffect(this.parentApp.renderer, {
			bands: SHEET_FRAMES,
			speed: 0.4,
			intensity: 0.5,
		});
		this.addPostEffect(this.shine);
	}

	override onDeactivateEvent() {
		this.bob.stop();
	}

	override update(dt: number) {
		this.shine?.setTime(timer.getTime() / 1000);
		return super.update(dt) || true;
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
		sounds.pickup();
		particles.burst("sparkle", this.centerX, this.centerY);

		// rise and fade, then leave
		this.bob.stop();
		new Tween(this.pos)
			.to({ y: this.pos.y - 12 }, { duration: 250 })
			.easing(Tween.Easing.Quadratic.Out)
			.start();
		new Tween(this)
			.to({ alpha: 0 }, { duration: 250 })
			.onComplete(() => {
				this.ancestor?.removeChild(this);
			})
			.start();
	}
}
