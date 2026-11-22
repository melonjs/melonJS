/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Camera2d,
	collision,
	type LDtkEntityReference,
	type LDtkFoundObject,
	type LDtkObjectSettings,
	type LDtkProject,
	loader,
	MaskEffect,
	type PlacedTile,
	PlacedTileLayer,
	Rect,
	type Renderable,
	type Renderer,
	Tileset,
	Trigger,
} from "melonjs";

const TILE = 16;
// where the tiles used here are in the project's tileset image, in pixels
const LADDER = { x: 96, y: 144 };
const FLAME = { x: 256, y: 304 };

let tiles: Tileset | undefined;
/**
 * The world's own tileset, to draw the areas below with: the image LDtk
 * names is loaded with the project, under a name the project gives.
 * @returns a tileset over that image
 */
const tileset = () => {
	if (tiles === undefined) {
		const project = loader.getLDtk("gridvania") as LDtkProject;
		tiles = new Tileset({
			name: "SunnyLand",
			image: project.images.get("atlas/SunnyLand_by_Ansimuz-extended.png"),
			tilewidth: TILE,
			tileheight: TILE,
		});
	}
	return tiles;
};

/**
 * An entity of the LDtk world that is an area the player can be in: a few
 * tiles of the world's tileset placed over its box (a `PlacedTileLayer`,
 * built in code), with a body that is touched and not bumped into.
 */
class Zone extends PlacedTileLayer {
	/** the entity's fields, as set in LDtk */
	fields: Record<string, unknown>;

	constructor(settings: LDtkObjectSettings, placed: PlacedTile[]) {
		super({
			name: settings.name,
			tileset: tileset(),
			offsetx: settings.x,
			offsety: settings.y,
			width: settings.width,
			height: settings.height,
			tiles: placed,
		});
		this.fields = settings.fields;
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, settings.width, settings.height)],
			isSensor: true,
			collisionType: collision.types.ACTION_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
		};
	}
}

/** a ladder: the player climbs while in it */
export class Ladder extends Zone {
	constructor(_x: number, _y: number, settings: LDtkObjectSettings) {
		const rung = tileset().tileIdAt(LADDER.x, LADDER.y);
		const placed: PlacedTile[] = [];
		// the ladder tile, down the height of the entity's box
		for (let y = 0; y < settings.height; y += TILE) {
			placed.push({ x: (settings.width - TILE) / 2, y, tileId: rung });
		}
		super(settings, placed);
	}
}

/** what a teleport hands the object that took it */
export interface Traveller extends Renderable {
	/** be put where a teleport leads, behind the closed screen */
	arrive(target: LDtkFoundObject): void;
	/** between two teleports: the screen is closed */
	travelling: boolean;
}

/**
 * A teleport: it leads to another, named by its `destination` field.
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
	/** the flame the teleport is shown as, a tile of the world's tileset */
	flame: PlacedTileLayer;

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
		this.flame = new PlacedTileLayer({
			name: "flame",
			tileset: tileset(),
			offsetx: x + (settings.width - TILE) / 2,
			offsety: y + settings.height - TILE,
			tiles: [{ x: 0, y: 0, tileId: tileset().tileIdAt(FLAME.x, FLAME.y) }],
		});
	}

	override draw(renderer: Renderer, viewport?: Camera2d) {
		this.flame.preDraw(renderer);
		this.flame.draw(renderer, viewport);
		this.flame.postDraw(renderer);
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
		const project = loader.getLDtk("gridvania") as LDtkProject;
		const target = project.findObject(this.destination);
		if (traveller === undefined || target === undefined || this.fading) {
			return;
		}
		this.fading = true;
		traveller.travelling = true;
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
				// where the traveller is now is where the screen opens
				viewport.addCameraEffect(
					new MaskEffect(viewport, { ...reveal, center: traveller }),
				);
			},
		});
		viewport.addCameraEffect(hide);
	}
}
