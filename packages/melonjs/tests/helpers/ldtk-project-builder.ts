import type {
	LDtkLayerInstance,
	LDtkLevelJson,
	LDtkProjectJson,
	LDtkTile,
} from "../../src/index.js";

/**
 * The pieces of an LDtk project file, to write one in a test: what the
 * samples that come with LDtk do not hold has to be made.
 */

/** the size of the tiles of the test tileset, in pixels */
export const TILE = 16;

/** a tileset image: eight 16 px tiles, each its own color with a white corner */
export const tilesetImage = () => {
	const canvas = document.createElement("canvas");
	canvas.width = TILE * 4;
	canvas.height = TILE * 2;
	const c = canvas.getContext("2d") as CanvasRenderingContext2D;
	for (let id = 0; id < 8; id++) {
		const x = (id % 4) * TILE;
		const y = Math.floor(id / 4) * TILE;
		c.fillStyle = `rgb(${String(30 + id * 28)}, ${String(230 - id * 25)}, ${String((id * 67) % 256)})`;
		c.fillRect(x, y, TILE, TILE);
		c.fillStyle = "#ffffff";
		c.fillRect(x, y, 5, 3);
	}
	return canvas.toDataURL("image/png");
};

export const tile = (
	x: number,
	y: number,
	t: number,
	f = 0,
	a = 1,
): LDtkTile => {
	return {
		px: [x, y],
		src: [(t % 4) * TILE, Math.floor(t / 4) * TILE],
		f,
		t,
		a,
	};
};

export const layer = (
	identifier: string,
	type: string,
	gridSize: number,
	cols: number,
	rows: number,
	tiles: LDtkTile[],
	extra: Partial<LDtkLayerInstance> = {},
): LDtkLayerInstance => {
	return {
		__identifier: identifier,
		__type: type,
		__cWid: cols,
		__cHei: rows,
		__gridSize: gridSize,
		__opacity: 1,
		__pxTotalOffsetX: 0,
		__pxTotalOffsetY: 0,
		__tilesetDefUid: 1,
		__tilesetRelPath: "art/ldtk-test-tiles.png",
		iid: `${identifier}-iid`,
		levelId: 0,
		layerDefUid: type === "Tiles" ? 10 : 11,
		visible: true,
		intGridCsv: [],
		autoLayerTiles: type === "Tiles" ? [] : tiles,
		gridTiles: type === "Tiles" ? tiles : [],
		entityInstances: [],
		...extra,
	};
};

export const levelJson = (
	identifier: string,
	layers: LDtkLayerInstance[],
	extra: Partial<LDtkLevelJson> = {},
): LDtkLevelJson => {
	return {
		identifier,
		iid: `${identifier}-iid`,
		uid: 0,
		worldX: 0,
		worldY: 0,
		worldDepth: 0,
		pxWid: 160,
		pxHei: 96,
		__bgColor: "#203040",
		fieldInstances: [],
		layerInstances: layers,
		__neighbours: [],
		...extra,
	};
};

export const defs = (): LDtkProjectJson["defs"] => {
	return {
		tilesets: [
			{
				uid: 1,
				identifier: "Tiles",
				relPath: "art/ldtk-test-tiles.png",
				pxWid: 64,
				pxHei: 32,
				tileGridSize: TILE,
				spacing: 0,
				padding: 0,
				__cWid: 4,
				__cHei: 2,
				customData: [
					{ tileId: 3, data: "slippery" },
					{ tileId: 5, data: '{"damage": 2}' },
				],
				enumTags: [
					{ enumValueId: "Solid", tileIds: [0, 1, 5] },
					{ enumValueId: "Hazard", tileIds: [5] },
				],
			},
		],
		layers: [
			{
				uid: 10,
				identifier: "Tiles",
				type: "Tiles",
				gridSize: 8,
				intGridValues: [],
			},
			{
				uid: 11,
				identifier: "Auto",
				type: "AutoLayer",
				gridSize: 16,
				intGridValues: [],
			},
			{
				// values with a name, with none, and with an empty one
				uid: 12,
				identifier: "Zones",
				type: "IntGrid",
				gridSize: 16,
				intGridValues: [
					{ value: 1, identifier: "water", color: "#2060c0" },
					{ value: 2, identifier: null, color: "#c02020" },
					{ value: 3, identifier: "", color: "#20c020" },
				],
			},
		],
		entities: [],
		enums: [],
	};
};

/**
 * an entity, as LDtk saves it
 * @param identifier - its identifier
 * @param x - where its pivot is
 * @param y - where its pivot is
 * @returns the entity
 */
export const entity = (identifier: string, x: number, y: number) => {
	return {
		__identifier: identifier,
		iid: `${identifier}-iid`,
		defUid: 1,
		px: [x, y] as [number, number],
		__pivot: [0, 0] as [number, number],
		__grid: [0, 0] as [number, number],
		width: 16,
		height: 16,
		__tags: [],
		fieldInstances: [],
	};
};
