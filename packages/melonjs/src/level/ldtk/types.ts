/**
 * The parts of an LDtk project file (`.ldtk`, format 1.x) the engine reads.
 * Field names are LDtk's own: see https://ldtk.io/json/.
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

/** the value of a custom field of a level or an entity */
export interface LDtkFieldInstance {
	__identifier: string;
	/** `Int`, `Float`, `Bool`, `String`, `Color`, `Point`, `EntityRef`, `Tile`, `LocalEnum.Name`, `Array<...>`... */
	__type: string;
	__value: unknown;
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
	__tilesetDefUid?: number | null;
	__tilesetRelPath?: string | null;
	iid: string;
	levelId: number;
	layerDefUid: number;
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
}

/** a value of an IntGrid layer */
export interface LDtkIntGridValueDef {
	value: number;
	identifier: string | null;
	color: string;
}

/** the definition of a layer */
export interface LDtkLayerDef {
	uid: number;
	identifier: string;
	type: string;
	gridSize: number;
	intGridValues: LDtkIntGridValueDef[];
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
}

/** an enum */
export interface LDtkEnumDef {
	uid: number;
	identifier: string;
	values: { id: string; color: number; tileRect?: LDtkTileRect | null }[];
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
	worldLayout: string | null;
	worldGridWidth: number;
	worldGridHeight: number;
	externalLevels: boolean;
	defs: {
		tilesets: LDtkTilesetDef[];
		layers: LDtkLayerDef[];
		entities: LDtkEntityDef[];
		enums: LDtkEnumDef[];
		externalEnums?: LDtkEnumDef[];
	};
	levels: LDtkLevelJson[];
	worlds: LDtkWorldJson[];
}
