import type {
	LDtkEntityDef,
	LDtkEntityInstance,
	LDtkEntityReference,
	LDtkEnumDef,
	LDtkFieldInstance,
	LDtkLayerDef,
	LDtkLevelJson,
	LDtkProjectJson,
	LDtkTilesetDef,
	LDtkWorldJson,
} from "./types.ts";

/** the space LDtk leaves between the levels of a linear world, in pixels */
const LINEAR_SPACING = 48;

/** a level of a project, and where it stands in its world */
export interface LDtkLevelInfo {
	/** the level's identifier in LDtk */
	identifier: string;
	/** the level's unique id in LDtk */
	iid: string;
	/** the id the level is loaded by: `level.load(id)` */
	id: string;
	/** the identifier of the world the level belongs to; empty in a project of one world */
	world: string;
	/** where the level's top left corner is in its world, in pixels */
	x: number;
	/** where the level's top left corner is in its world, in pixels */
	y: number;
	/** the level's depth in its world: a higher one is drawn over a lower one */
	depth: number;
	/** the level's width, in pixels */
	width: number;
	/** the level's height, in pixels */
	height: number;
	/** the level's background color, as `#rrggbb` */
	bgColor: string;
	/** the level's custom fields, by name */
	fields: Record<string, unknown>;
	/** the levels next to it: their identifier, and the side they are on (`n`, `s`, `w`, `e`, a diagonal, `<` below, `>` above, `o` overlapping) */
	neighbours: { identifier: string; dir: string }[];
	/** the level as LDtk saves it */
	json: LDtkLevelJson;
}

/** a world of a project: its levels, laid out */
export interface LDtkWorldInfo {
	/** the world's identifier; empty in a project of one world */
	identifier: string;
	/** the id the whole world is loaded by: `level.load(id)` */
	id: string;
	/** `Free`, `GridVania`, `LinearHorizontal` or `LinearVertical` */
	layout: string;
	/** the world's levels, in LDtk's order */
	levels: LDtkLevelInfo[];
	/** the area the levels cover, in pixels */
	bounds: { x: number; y: number; width: number; height: number };
}

/**
 * An entity the project's table of content lists: LDtk writes there every
 * entity whose definition has "Add to table of content" checked, so that a
 * game finds them (a player's start, the doors of a world) without reading
 * the levels.
 */
export interface LDtkListedEntity {
	/** the entity's identifier in LDtk */
	identifier: string;
	/** the entity's unique id in LDtk */
	iid: string;
	/** the level it is in */
	level: LDtkLevelInfo | undefined;
	/** the entity, and the layer, level and world it is in, by their unique ids */
	iids: LDtkEntityReference;
	/**
	 * where its pivot is in its world, in pixels: the coordinates a whole
	 * world is loaded in. Undefined in a file saved before LDtk 1.5, which
	 * lists the references alone
	 */
	x: number | undefined;
	y: number | undefined;
	/** its size, in pixels; undefined in a file saved before LDtk 1.5 */
	width: number | undefined;
	height: number | undefined;
	/** the fields LDtk was told to list with it, by name */
	fields: Record<string, unknown>;
}

/** an entity of the project, found without its level being loaded */
export interface LDtkFoundEntity {
	/** the level it is in */
	level: LDtkLevelInfo;
	/** the identifier of the layer it is in */
	layer: string;
	/** the entity as LDtk saves it: its identifier, its fields, its tile */
	instance: LDtkEntityInstance;
	/**
	 * the left edge of its box in its world, in pixels: where the entity
	 * built from it is, in a world loaded whole (in a level loaded alone,
	 * less the level's own `x`)
	 */
	x: number;
	/** the top edge of its box in its world */
	y: number;
	/** the width of its box */
	width: number;
	/** the height of its box */
	height: number;
}

/**
 * the values of custom fields, by name, as LDtk gives them: numbers, strings
 * and booleans, a color as `#rrggbb`, an enum as the name of its value, a
 * point as `{ cx, cy }` in cells, an entity reference as
 * `{ entityIid, layerIid, levelIid, worldIid }`, a tile as a rectangle of its
 * tileset, an array as an array, and null for a field left empty
 * @param fields - the fields, as LDtk saves them
 * @returns the values, by field name
 */
export function fieldValues(
	fields: LDtkFieldInstance[],
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const field of fields) {
		values[field.__identifier] = field.__value;
	}
	return values;
}

/**
 * An LDtk project, as loaded from a `.ldtk` file: its levels and worlds, and
 * the definitions they are read with. `loader.getLDtk(name)` returns it.
 * @category Tilemap
 */
export class LDtkProject {
	/** the name the project was loaded under */
	readonly name: string;
	/** the project file's content */
	readonly json: LDtkProjectJson;
	/** the project's worlds: one, unless the project was set up for several */
	readonly worlds: LDtkWorldInfo[] = [];
	/** every level of the project, in LDtk's order */
	readonly levels: LDtkLevelInfo[] = [];
	/** the tilesets, by their uid */
	readonly tilesets = new Map<number, LDtkTilesetDef>();
	/** the layer definitions, by their uid */
	readonly layerDefs = new Map<number, LDtkLayerDef>();
	/** the entity definitions, by their uid */
	readonly entityDefs = new Map<number, LDtkEntityDef>();
	/** the enums, by their identifier */
	readonly enums = new Map<string, LDtkEnumDef>();
	/**
	 * the name each image the project names is kept under by the loader, by
	 * its path in the project: the file's name, unless another file of that
	 * name was loaded already
	 */
	readonly images: Map<string, string>;

	/**
	 * @param name - the name the project was loaded under
	 * @param json - the project file's content, the levels saved apart put back in
	 * @param images - the name each image is kept under, by its path in the project
	 */
	constructor(
		name: string,
		json: LDtkProjectJson,
		images: Map<string, string> = new Map(),
	) {
		this.name = name;
		this.json = json;
		this.images = images;
		for (const def of json.defs.tilesets) {
			this.tilesets.set(def.uid, def);
		}
		for (const def of json.defs.layers) {
			this.layerDefs.set(def.uid, def);
		}
		for (const def of json.defs.entities) {
			this.entityDefs.set(def.uid, def);
		}
		for (const def of [
			...json.defs.enums,
			...(json.defs.externalEnums ?? []),
		]) {
			this.enums.set(def.identifier, def);
		}

		// one world in most projects; several where the project was set up
		// for them, each with a layout of its own
		// a project saved before LDtk had several worlds has no list of them
		const listed = (json as { worlds?: LDtkWorldJson[] }).worlds ?? [];
		const worlds =
			listed.length > 0
				? listed.map((world) => {
						return {
							identifier: world.identifier,
							layout: world.worldLayout ?? "Free",
							levels: world.levels,
						};
					})
				: [
						{
							identifier: "",
							layout: json.worldLayout ?? "Free",
							levels: json.levels,
						},
					];
		const byIid = new Map<string, LDtkLevelInfo>();
		for (const [index, world] of worlds.entries()) {
			const info: LDtkWorldInfo = {
				identifier: world.identifier,
				// the first world by the project's name alone
				id: index === 0 ? name : `${name}@${world.identifier}`,
				layout: world.layout,
				levels: [],
				bounds: { x: 0, y: 0, width: 0, height: 0 },
			};
			// a linear world has no positions of its own: LDtk lays its
			// levels out in a row or a column, a fixed space apart
			let next = 0;
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;
			for (const json of world.levels) {
				let x = json.worldX;
				let y = json.worldY;
				if (world.layout === "LinearHorizontal") {
					x = next;
					y = 0;
					next += json.pxWid + LINEAR_SPACING;
				} else if (world.layout === "LinearVertical") {
					x = 0;
					y = next;
					next += json.pxHei + LINEAR_SPACING;
				}
				const level: LDtkLevelInfo = {
					identifier: json.identifier,
					iid: json.iid,
					id: `${name}:${json.identifier}`,
					world: world.identifier,
					x,
					y,
					depth: json.worldDepth,
					width: json.pxWid,
					height: json.pxHei,
					bgColor: json.__bgColor,
					fields: fieldValues(json.fieldInstances),
					neighbours: [],
					json,
				};
				info.levels.push(level);
				this.levels.push(level);
				byIid.set(level.iid, level);
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x + level.width);
				maxY = Math.max(maxY, y + level.height);
			}
			if (info.levels.length > 0) {
				info.bounds = {
					x: minX,
					y: minY,
					width: maxX - minX,
					height: maxY - minY,
				};
			}
			this.worlds.push(info);
		}
		for (const level of this.levels) {
			for (const neighbour of level.json.__neighbours) {
				const other = byIid.get(neighbour.levelIid);
				if (other !== undefined) {
					level.neighbours.push({
						identifier: other.identifier,
						dir: neighbour.dir,
					});
				}
			}
		}
	}

	/**
	 * a level of the project
	 * @param identifier - the level's identifier in LDtk, or its iid
	 * @returns the level, or undefined if the project has none of that name
	 */
	getLevel(identifier: string): LDtkLevelInfo | undefined {
		return this.levels.find((level) => {
			return level.identifier === identifier || level.iid === identifier;
		});
	}

	/**
	 * a world of the project
	 * @param identifier - the world's identifier in LDtk; the first world by default
	 * @returns the world, or undefined if the project has none of that name
	 */
	getWorld(identifier?: string): LDtkWorldInfo | undefined {
		if (identifier === undefined) {
			return this.worlds[0];
		}
		return this.worlds.find((world) => {
			return world.identifier === identifier;
		});
	}

	/**
	 * An entity of the project, by its unique id: what an `EntityRef` field
	 * points at (a teleport's destination, the door a lever opens), found
	 * whether its level is loaded or not.
	 * @param reference - the entity's `iid`, or the value of an `EntityRef` field
	 * @returns the entity, its level and where it is, or undefined
	 * @example
	 * const target = project.findEntity(teleport.fields.destination);
	 * ldtkWorld.loadLevel(target.level.identifier);
	 * player.pos.set(target.x, target.y);
	 */
	findEntity(
		reference: string | LDtkEntityReference | null | undefined,
	): LDtkFoundEntity | undefined {
		if (reference === null || reference === undefined) {
			return undefined;
		}
		const iid = typeof reference === "string" ? reference : reference.entityIid;
		// the level a reference names is looked in first
		const named =
			typeof reference === "string"
				? undefined
				: this.getLevel(reference.levelIid);
		const levels =
			named === undefined
				? this.levels
				: [
						named,
						...this.levels.filter((level) => {
							return level !== named;
						}),
					];
		for (const level of levels) {
			for (const layer of level.json.layerInstances ?? []) {
				for (const instance of layer.entityInstances) {
					if (instance.iid === iid) {
						return {
							level,
							layer: layer.__identifier,
							instance,
							x:
								level.x +
								layer.__pxTotalOffsetX +
								instance.px[0] -
								instance.__pivot[0] * instance.width,
							y:
								level.y +
								layer.__pxTotalOffsetY +
								instance.px[1] -
								instance.__pivot[1] * instance.height,
							width: instance.width,
							height: instance.height,
						};
					}
				}
			}
		}
		return undefined;
	}

	/**
	 * The entities the project's table of content lists: those whose
	 * definition has "Add to table of content" checked in LDtk. They are known
	 * without a level being loaded, which is what tells a game where to
	 * start in a world loaded a few levels at a time.
	 * @param identifier - the entities' identifier in LDtk; every listed entity by default
	 * @returns the entities, in LDtk's order
	 * @example
	 * const [start] = loader.getLDtk("world").getTableOfContent("PlayerStart");
	 * level.load("world", { levels: [start.level.identifier] });
	 */
	getTableOfContent(identifier?: string): LDtkListedEntity[] {
		const listed: LDtkListedEntity[] = [];
		for (const entry of this.json.toc ?? []) {
			if (identifier !== undefined && entry.identifier !== identifier) {
				continue;
			}
			if (entry.instancesData !== undefined) {
				for (const instance of entry.instancesData) {
					listed.push({
						identifier: entry.identifier,
						iid: instance.iids.entityIid,
						level: this.getLevel(instance.iids.levelIid),
						iids: instance.iids,
						x: instance.worldX,
						y: instance.worldY,
						width: instance.widPx,
						height: instance.heiPx,
						fields: instance.fields,
					});
				}
			} else {
				// a file saved before LDtk 1.5: the references alone
				for (const iids of entry.instances ?? []) {
					listed.push({
						identifier: entry.identifier,
						iid: iids.entityIid,
						level: this.getLevel(iids.levelIid),
						iids,
						x: undefined,
						y: undefined,
						width: undefined,
						height: undefined,
						fields: {},
					});
				}
			}
		}
		return listed;
	}

	/**
	 * the text typed for a tile in LDtk's tileset view ("custom data")
	 * @param tileset - the tileset's identifier in LDtk
	 * @param tileId - the tile's id in the tileset
	 * @returns the text, or undefined for a tile with none
	 */
	getTileData(tileset: string, tileId: number): string | undefined {
		for (const def of this.tilesets.values()) {
			if (def.identifier === tileset) {
				return def.customData.find((entry) => {
					return entry.tileId === tileId;
				})?.data;
			}
		}
		return undefined;
	}

	/**
	 * the values of a tileset's enum a tile is tagged with in LDtk
	 * @param tileset - the tileset's identifier in LDtk
	 * @param tileId - the tile's id in the tileset
	 * @returns the names of the enum values the tile carries
	 */
	getTileTags(tileset: string, tileId: number): string[] {
		const tags: string[] = [];
		for (const def of this.tilesets.values()) {
			if (def.identifier === tileset) {
				for (const tag of def.enumTags) {
					if (tag.tileIds.includes(tileId)) {
						tags.push(tag.enumValueId);
					}
				}
			}
		}
		return tags;
	}
}
