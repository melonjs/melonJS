/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Container,
	type LDtkEntityReference,
	type LDtkFoundObject,
	type LDtkObjectSettings,
	MaskEffect,
	type ParticleEmitter,
	Rect,
	type Renderable,
	Sprite,
	Trigger,
	Tween,
} from "melonjs";
import { TILE, Z } from "../config";
import { createEmbers, particles } from "../effects/particles";
import { sounds } from "../effects/sounds";
import { TILES, worldTileset, worldTilesetImage } from "../world/tiles";
import { ldtkProject } from "../world/world";

/** what a teleport hands the object that took it */
export interface Traveller extends Renderable {
	/** be put where a teleport leads, behind the closed screen */
	arrive(target: LDtkFoundObject): void;
	/** between two teleports: the screen is closed */
	travelling: boolean;
}

/**
 * A "Teleport" entity of the LDtk world: it leads to another teleport, the
 * one its `destination` field refers to.
 *
 * It is the engine's `Trigger`: an area the player touches, with a
 * transition of the screen. A trigger loads a level; this one moves the
 * player within the world instead, behind the same transition. What the
 * transition is comes from the entity as a trigger's does from its
 * settings: a field named `transition`, `duration`, `shape` or `center` set
 * on the entity in LDtk would change it.
 */
export class Teleport extends Trigger {
	/** the entity LDtk's `EntityRef` field points at */
	destination: LDtkEntityReference | null | undefined;
	/** what shows where the teleport is: a flame of the world's tileset, and its embers */
	flame: Sprite;
	embers: ParticleEmitter;
	flicker: Tween;

	constructor(x: number, y: number, settings: LDtkObjectSettings) {
		super(x, y, {
			// the screen closes on the player in the player's own shape
			transition: "mask",
			shape: "touching",
			center: "touching",
			duration: 300,
			...settings,
			// (the entity's own `color` is the one LDtk shows it in)
			color: "#000000",
			shapes: [new Rect(0, 0, settings.width, settings.height)],
		});
		// taken by pressing up in front of it, not by touching it: a trigger
		// fires on touch under its own name only
		this.name = settings.name;
		this.destination = settings.fields.destination as
			| LDtkEntityReference
			| null
			| undefined;

		// standing on the bottom of the entity's box, in its middle
		const middle = x + settings.width / 2;
		const bottom = y + settings.height;
		this.flame = new Sprite(middle - TILE / 2, bottom - TILE, {
			image: worldTilesetImage(),
			framewidth: TILE,
			frameheight: TILE,
			anchorPoint: { x: 0, y: 0 },
		});
		// a frame of the image cut in tiles is the tile's id in the tileset
		const flame = worldTileset().tileIdAt(TILES.flame.x, TILES.flame.y);
		this.flame.addAnimation("flame", [flame]);
		this.flame.setCurrentAnimation("flame");
		this.embers = createEmbers(middle, bottom - TILE / 2);
		this.flicker = new Tween(this.flame).to(
			{ alpha: 0.8 },
			{ duration: 220, yoyo: true, repeat: Infinity },
		);
	}

	/**
	 * In the world: the flame and its embers are shown with the trigger,
	 * over the layers of its room so that the grass does not hide them.
	 */
	override onActivateEvent() {
		const container = this.ancestor as Container;
		container.addChild(this.flame, Z.particles);
		container.addChild(this.embers, Z.particles);
		this.embers.streamParticles();
		this.flicker.start();
	}

	/** out of the world, with its room: so are they */
	override onDeactivateEvent() {
		this.flicker.stop();
		(this.flame.ancestor as Container | undefined)?.removeChildNow(this.flame);
		(this.embers.ancestor as Container | undefined)?.removeChildNow(
			this.embers,
		);
	}

	/**
	 * Take the teleport. Its `destination` is a reference to an entity in a
	 * room that may not be in the game: the project finds it, with its room
	 * and its place, and the traveller is put there while the screen is
	 * closed.
	 * @param other - the player
	 */
	override triggerEvent(other?: Renderable) {
		const traveller = other as Traveller | undefined;
		const target = ldtkProject().findObject(this.destination);
		if (traveller === undefined || target === undefined || this.fading) {
			return;
		}
		this.fading = true;
		traveller.travelling = true;
		sounds.teleport();

		const viewport = this.parentApp.viewport;
		// the trigger's own transition: closed, then opened the same way
		const hide = new MaskEffect(viewport, {
			shape: traveller,
			center: traveller,
			color: this.color,
			duration: this.duration,
			direction: "hide",
			onComplete: () => {
				const reveal = hide.reverseOptions(() => {
					this.fading = false;
					traveller.travelling = false;
				});
				traveller.arrive(target);
				sounds.arrive();
				particles.burst(
					"sparkle",
					target.x + target.width / 2,
					target.y + target.height / 2,
				);
				// where the traveller is now is where the screen opens
				viewport.addCameraEffect(
					new MaskEffect(viewport, { ...reveal, center: traveller }),
				);
			},
		});
		viewport.addCameraEffect(hide);
	}
}
