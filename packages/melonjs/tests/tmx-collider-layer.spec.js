import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	Container,
	collision,
	level,
	loader,
	Rect,
	Renderable,
	TMXLayer,
	TMXTileMap,
	timer,
	video,
} from "../src/index.js";

/**
 * A tile layer whose tiles are solid.
 *
 * A Tiled map's collision is drawn as shapes on an object layer. A tile
 * layer with a boolean custom property `collider` set to true is solid too:
 * each run of its tiles is a wall of the world. It is what the Sprite Fusion
 * editor writes for a layer with its "collider" box checked, so one of its
 * maps is played as exported.
 */

const TILE = 16;
const COLS = 10;
const ROWS = 6;

// a floor across the bottom row, a block of 2 x 2 standing on it, and one
// tile on its own
const SOLID = [
	"..........",
	"...#......",
	"..........",
	"......##..",
	"......##..",
	"##########",
];

/** a layer's data, a tile wherever the picture has a `#` */
const dataOf = (picture) => {
	return picture.flatMap((row) => {
		return [...row].map((cell) => {
			return cell === "#" ? 1 : 0;
		});
	});
};

const tileLayer = (name, picture, collider, extra = {}) => {
	return {
		type: "tilelayer",
		name,
		visible: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: COLS,
		height: ROWS,
		data: dataOf(picture),
		...(collider === undefined
			? {}
			: { properties: [{ name: "collider", type: "bool", value: collider }] }),
		...extra,
	};
};

const mapJSON = (layers, extra = {}) => {
	return {
		type: "map",
		version: "1.10",
		tiledversion: "1.11.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: COLS,
		height: ROWS,
		tilewidth: TILE,
		tileheight: TILE,
		nextobjectid: 1,
		tilesets: [
			{
				firstgid: 1,
				name: "tiles",
				image: "collider-tiles.png",
				imagewidth: 32,
				imageheight: 16,
				tilewidth: TILE,
				tileheight: TILE,
				tilecount: 2,
				columns: 2,
				margin: 0,
				spacing: 0,
			},
		],
		layers,
		...extra,
	};
};

const EMPTY = new Array(ROWS).fill(".".repeat(COLS));

describe("a Tiled tile layer with the collider property", () => {
	let app;
	let serial = 0;
	let savedTick;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		const image = document.createElement("canvas");
		image.width = 32;
		image.height = 16;
		await loader.load({
			name: "collider-tiles",
			type: "image",
			src: image.toDataURL("image/png"),
		});
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(() => {
		app.world.reset();
		savedTick = timer.tick;
	});

	afterEach(() => {
		timer.tick = savedTick;
		vi.restoreAllMocks();
	});

	/** load a map made of these layers into the world */
	const load = async (layers, options = {}, extra = {}) => {
		const name = `collider-map-${String(serial++)}`;
		await loader.load({
			name,
			type: "tmx",
			data: mapJSON(layers, extra),
		});
		await level.load(name, {
			container: app.world,
			async: true,
			...options,
		});
		return level.getCurrentLevel();
	};

	/** the walls in a container: the static world shapes, as rectangles */
	const wallsIn = (container = app.world) => {
		return container
			.getChildByProp("isRenderable", true)
			.filter((child) => {
				return child.bodyDef?.collisionType === collision.types.WORLD_SHAPE;
			})
			.map((wall) => {
				return [wall.pos.x, wall.pos.y, wall.width, wall.height];
			})
			.sort((a, b) => {
				return a[1] - b[1] || a[0] - b[0];
			});
	};

	// the picture above, as few rectangles: runs of tiles, joined down
	// where they span the same columns
	const SOLID_WALLS = [
		[3 * TILE, TILE, TILE, TILE],
		[6 * TILE, 3 * TILE, 2 * TILE, 2 * TILE],
		[0, 5 * TILE, COLS * TILE, TILE],
	];

	it("builds walls over its tiles, a run of them as one", async () => {
		await load([tileLayer("ground", SOLID, true)]);
		expect(wallsIn()).toEqual(SOLID_WALLS);
		// each is a static body, a wall of the world
		const walls = app.world.getChildren().filter((child) => {
			return child.bodyDef !== undefined;
		});
		expect(walls).toHaveLength(3);
		for (const wall of walls) {
			expect(wall.bodyDef.type).toBe("static");
			expect(wall.bodyDef.collisionType).toBe(collision.types.WORLD_SHAPE);
			// it says which layer it is of, and has no name: the layer is
			// still the one found by its name
			expect(wall.layer).toBe("ground");
			expect(wall.name).not.toBe("ground");
		}
		const [ground] = app.world.getChildByName("ground");
		expect(ground).toBeInstanceOf(TMXLayer);
		expect(app.world.getChildByName("ground")).toHaveLength(1);
		expect(ground.collider).toBe(true);
	});

	it("covers every tile of the layer, and no empty cell", async () => {
		await load([tileLayer("ground", SOLID, true)]);
		const walls = wallsIn();
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const x = col * TILE + TILE / 2;
				const y = row * TILE + TILE / 2;
				const covering = walls.filter(([wx, wy, w, h]) => {
					return x > wx && x < wx + w && y > wy && y < wy + h;
				});
				expect(covering.length, `cell ${String(col)}, ${String(row)}`).toBe(
					SOLID[row][col] === "#" ? 1 : 0,
				);
			}
		}
	});

	it("leaves a layer without the property, or with it false, as it was", async () => {
		await load([
			tileLayer("back", SOLID, false),
			tileLayer("plain", SOLID, undefined),
			// a property of another type is not the checkbox
			tileLayer("named", SOLID, undefined, {
				properties: [{ name: "collider", type: "string", value: "yes" }],
			}),
		]);
		expect(wallsIn()).toEqual([]);
		expect(app.world.getChildren()).toHaveLength(3);
	});

	it("moves the walls with the layer's offset", async () => {
		await load([
			tileLayer("ground", SOLID, true, { offsetx: 24, offsety: -8 }),
		]);
		expect(wallsIn()).toEqual(
			SOLID_WALLS.map(([x, y, w, h]) => {
				return [x + 24, y - 8, w, h];
			}),
		);
		// where the layer's tiles are: a point of each wall is on a tile
		const [ground] = app.world.getChildByName("ground");
		for (const [x, y] of wallsIn()) {
			expect(ground.getTile(x + 1, y + 1)).not.toBeNull();
		}
		expect(ground.getTile(1, 1)).toBeNull();
	});

	it("builds each solid layer's walls, at the layer's draw order", async () => {
		const upper = [
			"####......",
			"..........",
			"..........",
			"..........",
			"..........",
			"..........",
		];
		await load([
			tileLayer("back", EMPTY, false),
			tileLayer("ground", SOLID, true),
			tileLayer("ledge", upper, true),
		]);
		expect(wallsIn()).toEqual([[0, 0, 4 * TILE, TILE], ...SOLID_WALLS]);
		const [ledge] = app.world.getChildByName("ledge");
		const ledgeWall = app.world.getChildren().find((child) => {
			return child.layer === "ledge";
		});
		expect(ledgeWall.pos.z).toBe(ledge.pos.z);
	});

	it("builds them whatever the choice of objects: they are the layer's", async () => {
		await load([tileLayer("ground", SOLID, true)], { objects: false });
		expect(wallsIn()).toEqual(SOLID_WALLS);
	});

	it("builds them for a solid layer of a group layer, flattened or not", async () => {
		const grouped = () => {
			return [
				{
					type: "group",
					name: "world",
					visible: true,
					opacity: 1,
					offsetx: 16,
					layers: [tileLayer("ground", SOLID, true)],
				},
			];
		};
		const moved = SOLID_WALLS.map(([x, y, w, h]) => {
			return [x + 16, y, w, h];
		});
		await load(grouped());
		expect(wallsIn()).toEqual(moved);
		app.world.reset();
		await load(grouped(), { flatten: false });
		const [group] = app.world.getChildByName("world");
		expect(group).toBeInstanceOf(Container);
		expect(wallsIn(group)).toEqual(moved);
	});

	it("puts the walls where the tiles are, on a map that starts left of and above 0", async () => {
		// a chunk of 16 x 16 cells at (-16, -16): two tiles side by side in
		// its second row, and one alone in its last cell
		const chunk = new Array(16 * 16).fill(0);
		chunk[16 + 2] = 1;
		chunk[16 + 3] = 1;
		chunk[16 * 16 - 1] = 1;
		await load(
			[
				{
					type: "tilelayer",
					name: "wide",
					visible: true,
					opacity: 1,
					x: 0,
					y: 0,
					offsetx: 8,
					startx: -16,
					starty: -16,
					width: 16,
					height: 16,
					chunks: [{ x: -16, y: -16, width: 16, height: 16, data: chunk }],
					properties: [{ name: "collider", type: "bool", value: true }],
				},
			],
			{},
			{ infinite: true },
		);
		const [wide] = app.world.getChildByName("wide");
		expect([wide.startx, wide.starty]).toEqual([-16, -16]);
		expect(wallsIn()).toEqual([
			// cells (-14, -15) and (-13, -15), moved by the layer's offset
			[-14 * TILE + 8, -15 * TILE, 2 * TILE, TILE],
			// cell (-1, -1)
			[-1 * TILE + 8, -1 * TILE, TILE, TILE],
		]);
	});

	it("is read by the map itself, built with no level director", () => {
		const map = new TMXTileMap(
			"direct",
			mapJSON([tileLayer("ground", SOLID, true)]),
		);
		const container = new Container(0, 0, 160, 96);
		map.addTo(container, true, false);
		expect(wallsIn(container)).toEqual(SOLID_WALLS);
	});

	it("says so, and builds none, on a map that is not orthogonal", async () => {
		const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
		await load(
			[tileLayer("ground", SOLID, true)],
			{},
			{ orientation: "isometric" },
		);
		expect(wallsIn()).toEqual([]);
		expect(
			warned.mock.calls.some(([message]) => {
				return /collider.*orthogonal maps only/.test(String(message));
			}),
		).toBe(true);
	});

	it("holds what falls on it", async () => {
		await load([tileLayer("ground", SOLID, true)]);
		// a box dropped over the floor, clear of the blocks
		const box = new Renderable(TILE, 0, 12, 12);
		box.anchorPoint.set(0, 0);
		box.alwaysUpdate = true;
		box.bodyDef = {
			type: "dynamic",
			shapes: [new Rect(0, 0, 12, 12)],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask: collision.types.WORLD_SHAPE,
			maxVelocity: { x: 4, y: 4 },
		};
		box.onCollision = () => {
			return true;
		};
		app.world.addChild(box);
		timer.tick = 1;
		for (let i = 0; i < 120; i++) {
			app.world.update(16);
		}
		// resting on the floor's top, at row 5
		expect(Math.abs(box.pos.y + 12 - 5 * TILE)).toBeLessThanOrEqual(1);
		expect(app.world.adapter.isGrounded(box)).toBe(true);
		// and the same box with no solid layer falls through
		app.world.reset();
		await load([tileLayer("ground", SOLID, false)]);
		const falling = new Renderable(TILE, 0, 12, 12);
		falling.anchorPoint.set(0, 0);
		falling.alwaysUpdate = true;
		falling.bodyDef = { ...box.bodyDef, shapes: [new Rect(0, 0, 12, 12)] };
		app.world.addChild(falling);
		for (let i = 0; i < 120; i++) {
			app.world.update(16);
		}
		expect(falling.pos.y).toBeGreaterThan(ROWS * TILE);
	});
});

/**
 * A map as the Sprite Fusion editor exports it to TMX: an XML Tiled map with
 * one embedded tileset over `spritesheet.png`, a `collider` property on each
 * layer, and the attributes given to a tile as that tile's properties in the
 * tileset. (The fixture is written for this test, in the form of an export
 * made with the editor: the same elements, attributes and property types.)
 */
describe("a map in the form of a Sprite Fusion TMX export", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
		const image = document.createElement("canvas");
		image.width = 32;
		image.height = 32;
		await loader.preload(
			[
				// the image the tileset names, under its file's name
				{
					name: "spritesheet",
					type: "image",
					src: image.toDataURL("image/png"),
				},
				{
					name: "spritefusion-map",
					type: "tmx",
					src: new URL("./fixtures/spritefusion/map.tmx", import.meta.url).href,
				},
			],
			undefined,
			false,
		);
	});

	afterAll(() => {
		app?.destroy();
	});

	beforeEach(async () => {
		app.world.reset();
		await level.load("spritefusion-map", {
			container: app.world,
			async: true,
		});
	});

	it("loads as a Tiled map: its layers, bottom-most first", () => {
		const layers = level.getCurrentLevel().getLayers();
		expect(
			layers.map((layer) => {
				return [layer.name, layer.collider];
			}),
		).toEqual([
			["Background", false],
			["Ground", true],
			["Pickups", false],
		]);
		for (const layer of layers) {
			expect(layer).toBeInstanceOf(TMXLayer);
		}
	});

	it("makes the layers checked as colliders solid", () => {
		const walls = app.world
			.getChildren()
			.filter((child) => {
				return child.bodyDef?.collisionType === collision.types.WORLD_SHAPE;
			})
			.map((wall) => {
				return [wall.layer, wall.pos.x, wall.pos.y, wall.width, wall.height];
			})
			.sort((a, b) => {
				return a[2] - b[2] || a[1] - b[1];
			});
		// the floor, and the one tile standing on it
		expect(walls).toEqual([
			["Ground", 4 * TILE, 2 * TILE, TILE, TILE],
			["Ground", 0, 3 * TILE, 6 * TILE, TILE],
		]);
	});

	it("gives a tile's attributes as its properties, each of its type", () => {
		const [ground] = app.world.getChildByName("Ground");
		// the lava tile, the tileset's second, in the floor
		const lava = ground.cellAt(2, 3);
		expect(lava.tileId).toBe(2);
		const properties = lava.tileset.getTileProperties(lava.tileId);
		expect(properties).toEqual({
			type: "lava",
			damage: 25,
			slow: 0.5,
			isDangerous: true,
			isSolid: false,
		});
		// a number is a number, a boolean a boolean: not their text
		expect(properties.damage).toBeTypeOf("number");
		expect(properties.isSolid).toBe(false);
		// the tile next to it has none
		const plain = ground.cellAt(0, 3);
		expect(plain.tileset.getTileProperties(plain.tileId)).toBeUndefined();
		// a tile of another layer, by where it is in the world
		const [pickups] = app.world.getChildByName("Pickups");
		const marker = pickups.getTile(TILE + 3, TILE + 3);
		expect(marker.tileset.getTileProperties(marker.tileId)).toEqual({
			spawn: "enemy",
		});
	});
});
