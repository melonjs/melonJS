/**
 * An LDtk project file (`.ldtk`, format 1.x), as LDtk's JSON schema for
 * games describes it (https://ldtk.io/files/MINIMAL_JSON_SCHEMA.json): every
 * field a game is meant to read, under LDtk's own names. The fields LDtk keeps
 * for its editor are left out. See https://ldtk.io/json/ for each of them.
 *
 * A field LDtk added along the way is optional here, so that a file saved by
 * an older version still loads.
 */

/** a tile of a tile layer, or of an auto-layer */
export interface LDtkTile {
	/** where its top left corner is, in pixels from the layer's origin */
	px: [number, number];
	/** where it is in the tileset image, in pixels */
	src: [number, number];
	/** bit 0: mirrored across; bit 1: mirrored down */
	f: number;
	/** its id in the tileset */
	t: number;
	/** its opacity, from 0 to 1 */
	a?: number;
}

/** a rectangle of a tileset: what an entity or an enum value is drawn with */
export interface LDtkTileRect {
	tilesetUid: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

/** a cell: the value of a `Point` field */
export interface LDtkGridPoint {
	cx: number;
	cy: number;
}

/** an entity somewhere in the project: the value of an `EntityRef` field */
export interface LDtkEntityReference {
	entityIid: string;
	layerIid: string;
	levelIid: string;
	worldIid: string;
}

/** the value of a custom field of a level or an entity */
export interface LDtkFieldInstance {
	__identifier: string;
	/** `Int`, `Float`, `Bool`, `String`, `Multilines`, `Color`, `FilePath`, `Point`, `EntityRef`, `Tile`, `LocalEnum.Name`, `ExternEnum.Name`, `Array<...>`... */
	__type: string;
	/**
	 * a number, a boolean or a string for the simple types (a color is
	 * `"#rrggbb"`, an enum the name of its value), an
	 * {@link LDtkGridPoint} for a `Point`, an {@link LDtkEntityReference} for
	 * an `EntityRef`, an {@link LDtkTileRect} for a `Tile`, an array of those
	 * for an `Array<...>`, and null where nothing was set
	 */
	__value: unknown;
	/** the tile LDtk shows the field with: its own, or the one of its enum value */
	__tile?: LDtkTileRect | null;
	defUid?: number;
}

/** an entity placed in an Entities layer */
export interface LDtkEntityInstance {
	__identifier: string;
	iid: string;
	defUid: number;
	/** where its pivot is, in pixels from the layer's origin */
	px: [number, number];
	/** where the pivot is in the entity's box, each from 0 to 1 */
	__pivot: [number, number];
	/** its cell */
	__grid: [number, number];
	width: number;
	height: number;
	__tags: string[];
	__tile?: LDtkTileRect | null;
	__smartColor?: string;
	__worldX?: number | null;
	__worldY?: number | null;
	fieldInstances: LDtkFieldInstance[];
}

/** a layer of a level */
export interface LDtkLayerInstance {
	__identifier: string;
	/** `IntGrid`, `Entities`, `Tiles` or `AutoLayer` */
	__type: string;
	__cWid: number;
	__cHei: number;
	__gridSize: number;
	__opacity: number;
	__pxTotalOffsetX: number;
	__pxTotalOffsetY: number;
	/** the tileset the layer draws with: its own choice where it has one (`overrideTilesetUid`), its definition's otherwise */
	__tilesetDefUid?: number | null;
	__tilesetRelPath?: string | null;
	iid: string;
	levelId: number;
	layerDefUid: number;
	/** a tileset this layer uses in place of its definition's; `__tilesetDefUid` already says which */
	overrideTilesetUid?: number | null;
	/** the layer's own offset, without its definition's: `__pxTotalOffsetX` is both */
	pxOffsetX?: number;
	pxOffsetY?: number;
	visible: boolean;
	intGridCsv: number[];
	autoLayerTiles: LDtkTile[];
	gridTiles: LDtkTile[];
	entityInstances: LDtkEntityInstance[];
}

/** where a level's background image is drawn */
export interface LDtkBackgroundPosition {
	/** the part of the image that shows: x, y, width, height */
	cropRect: [number, number, number, number];
	scale: [number, number];
	topLeftPx: [number, number];
}

/** a level next to another */
export interface LDtkNeighbour {
	levelIid: string;
	/** `n`, `s`, `w`, `e`, `ne`, `nw`, `se`, `sw`, `<` (below), `>` (above) or `o` (overlapping) */
	dir: string;
}

/** a level */
export interface LDtkLevelJson {
	identifier: string;
	iid: string;
	uid: number;
	worldX: number;
	worldY: number;
	worldDepth: number;
	pxWid: number;
	pxHei: number;
	__bgColor: string;
	bgRelPath?: string | null;
	__bgPos?: LDtkBackgroundPosition | null;
	/** the file holding the level's layers, when levels are saved apart */
	externalRelPath?: string | null;
	fieldInstances: LDtkFieldInstance[];
	/** top-most first; null in a project that saves its levels apart */
	layerInstances: LDtkLayerInstance[] | null;
	__neighbours: LDtkNeighbour[];
}

/** a tileset */
export interface LDtkTilesetDef {
	uid: number;
	identifier: string;
	/** the image, relative to the project file; null for LDtk's own icons */
	relPath: string | null;
	embedAtlas?: string | null;
	pxWid: number;
	pxHei: number;
	tileGridSize: number;
	spacing: number;
	padding: number;
	__cWid: number;
	__cHei: number;
	/** a text per tile, as typed in LDtk */
	customData: { tileId: number; data: string }[];
	/** the tiles carrying each value of the tileset's enum */
	enumTags: { enumValueId: string; tileIds: number[] }[];
	tagsSourceEnumUid?: number | null;
	/** the tags given to the tileset itself in LDtk */
	tags?: string[];
}

/** a value of an IntGrid layer */
export interface LDtkIntGridValueDef {
	value: number;
	identifier?: string | null;
	color: string;
	/** the group the value is in, 0 for none */
	groupUid?: number;
	/** the tile LDtk shows the value with */
	tile?: LDtkTileRect | null;
}

/** a group of values of an IntGrid layer */
export interface LDtkIntGridValueGroupDef {
	uid: number;
	identifier?: string | null;
	color?: string | null;
}

/** the definition of a layer */
export interface LDtkLayerDef {
	uid: number;
	identifier: string;
	/** `IntGrid`, `Entities`, `Tiles` or `AutoLayer` */
	__type: string;
	gridSize: number;
	/** its opacity, from 0 to 1: a layer instance's `__opacity` */
	displayOpacity?: number;
	/** the definition's offset: a layer instance's `__pxTotalOffsetX` holds it, with the instance's own */
	pxOffsetX?: number;
	pxOffsetY?: number;
	/**
	 * how much of the camera's movement the layer's tiles follow, from -1
	 * to 1, 0 for a layer that scrolls with its level: the layers built from
	 * it carry it as their `ratio`
	 */
	parallaxFactorX?: number;
	parallaxFactorY?: number;
	/** whether a layer with a parallax factor is scaled by it too */
	parallaxScaling?: boolean;
	/** the tileset the layer draws with, unless a layer instance overrides it */
	tilesetDefUid?: number | null;
	/** for an auto-layer, the IntGrid layer its rules read */
	autoSourceLayerDefUid?: number | null;
	/** in no particular order: find a value by its `value`, not by its place */
	intGridValues: LDtkIntGridValueDef[];
	intGridValuesGroups?: LDtkIntGridValueGroupDef[];
}

/** the definition of an entity */
export interface LDtkEntityDef {
	uid: number;
	identifier: string;
	width: number;
	height: number;
	color: string;
	tags: string[];
	/** how the entity's tile fills its box: `Cover`, `FitInside`, `Repeat`, `Stretch`, `FullSizeCropped`, `FullSizeUncropped` or `NineSlice` */
	tileRenderMode: string;
	/** in `NineSlice` mode, the borders that are not stretched: up, right, down, left, in pixels */
	nineSliceBorders?: number[];
	pivotX: number;
	pivotY: number;
	/** the entity's tile, before a field changes it: an instance's `__tile` is the one to draw */
	tileRect?: LDtkTileRect | null;
	/** the tileset of that tile */
	tilesetId?: number | null;
	/** the tile LDtk lists the entity with */
	uiTileRect?: LDtkTileRect | null;
}

/** an enum */
export interface LDtkEnumDef {
	uid: number;
	identifier: string;
	values: { id: string; color: number; tileRect?: LDtkTileRect | null }[];
	/** the file the enum was read from, for an external one */
	externalRelPath?: string | null;
	/** the tileset its values' tiles are from */
	iconTilesetUid?: number | null;
	tags?: string[];
}

/** an entity listed in the project's table of content */
export interface LDtkTocInstance {
	/** the entity, and the layer, level and world it is in */
	iids: LDtkEntityReference;
	/** where it is in its world, in pixels */
	worldX: number;
	worldY: number;
	widPx: number;
	heiPx: number;
	/** the values of the fields LDtk was told to list with it, by name */
	fields: Record<string, unknown>;
}

/** the entities of one kind in the project's table of content */
export interface LDtkTocEntry {
	identifier: string;
	/** since LDtk 1.5; a file saved before has `instances`, the references alone */
	instancesData?: LDtkTocInstance[];
	instances?: LDtkEntityReference[];
}

/** a world of a project that has several */
export interface LDtkWorldJson {
	identifier: string;
	iid: string;
	worldLayout: string | null;
	worldGridWidth: number;
	worldGridHeight: number;
	levels: LDtkLevelJson[];
}

/** a project file */
export interface LDtkProjectJson {
	jsonVersion: string;
	iid: string;
	bgColor: string;
	defaultGridSize: number;
	/** `Free`, `GridVania`, `LinearHorizontal` or `LinearVertical`; null in a project of several worlds */
	worldLayout?: string | null;
	/** the size of a GridVania world's cells; null in a project of several worlds, where each world has its own */
	worldGridWidth?: number | null;
	worldGridHeight?: number | null;
	externalLevels: boolean;
	defs: {
		tilesets: LDtkTilesetDef[];
		layers: LDtkLayerDef[];
		entities: LDtkEntityDef[];
		enums: LDtkEnumDef[];
		externalEnums?: LDtkEnumDef[];
		levelFields?: unknown[];
	};
	/** empty in a project of several worlds: its levels are in `worlds` */
	levels: LDtkLevelJson[];
	/** empty unless the project was set up for several worlds */
	worlds: LDtkWorldJson[];
	/** the entities whose definition asks to be listed, wherever they are */
	toc?: LDtkTocEntry[];
}
