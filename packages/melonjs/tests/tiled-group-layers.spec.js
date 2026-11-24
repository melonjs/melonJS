import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	collision,
	ImageLayer,
	loader,
	Renderable,
	registerObjectClass,
	state,
	TileMap,
	TMXLayer,
	video,
} from "../src/index.js";
import * as TMXUtils from "../src/level/tiled/TMXUtils.js";
import { copyFrame } from "./helpers/pixels.js";

/**
 * A Tiled group layer holds layers of any kind: tile layers, object layers,
 * image layers and other groups. Each is read as what it is, in Tiled's
 * order, with what the group gives the layers inside it (its offset, its
 * opacity, its tint, its blend mode, its parallax factor) on top of their
 * own.
 */

const WIDTH = 96;
const HEIGHT = 64;
const TILE = 16;

// the tiles of the test's tileset, each of one color: gid 1 is the first
const TILE_COLORS = [
	[200, 40, 40],
	[40, 200, 40],
	[40, 40, 200],
	[200, 200, 40],
	[40, 200, 200],
	[200, 40, 200],
	[120, 120, 120],
	[240, 240, 240],
];
const PICTURE_COLOR = [255, 128, 0];
const BLACK = [0, 0, 0];

const flat = (width, height, paint) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	paint(canvas.getContext("2d"));
	return canvas.toDataURL("image/png");
};

const tilesImage = () => {
	return flat(TILE * 4, TILE * 2, (c) => {
		TILE_COLORS.forEach((color, id) => {
			c.fillStyle = `rgb(${color.join(",")})`;
			c.fillRect((id % 4) * TILE, Math.floor(id / 4) * TILE, TILE, TILE);
		});
	});
};

const pictureImage = () => {
	return flat(32, 16, (c) => {
		c.fillStyle = `rgb(${PICTURE_COLOR.join(",")})`;
		c.fillRect(0, 0, 32, 16);
	});
};

/** an object of the game's: a box of one color, which keeps what it was given */
class Gem extends Renderable {
	constructor(x, y, settings) {
		super(x, y, settings.width, settings.height);
		this.anchorPoint.set(0, 0);
		this.name = settings.name;
		this.color = settings.color ?? "#00ff00";
		this.given = settings;
	}

	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

/** an object as Tiled saves it */
const object = (id, name, x, y, extra = {}) => {
	return {
		id,
		name,
		type: "GroupGem",
		x,
		y,
		width: 16,
		height: 16,
		rotation: 0,
		visible: true,
		...extra,
	};
};

const objectLayer = (name, objects, extra = {}) => {
	return {
		type: "objectgroup",
		name,
		visible: true,
		opacity: 1,
		x: 0,
		y: 0,
		objects,
		...extra,
	};
};

/** a tile layer of 4 x 2 cells: the gid of each, 0 for none */
const tileLayer = (name, data, extra = {}) => {
	return {
		type: "tilelayer",
		name,
		visible: true,
		opacity: 1,
		x: 0,
		y: 0,
		width: 4,
		height: 2,
		data,
		...extra,
	};
};

const imageLayer = (name, extra = {}) => {
	return {
		type: "imagelayer",
		name,
		image: "group-picture",
		visible: true,
		opacity: 1,
		properties: { repeat: "no-repeat" },
		...extra,
	};
};

const group = (name, layers, extra = {}) => {
	return {
		type: "group",
		name,
		visible: true,
		opacity: 1,
		layers,
		...extra,
	};
};

let serial = 0;
/** a map of 4 x 2 tiles, as Tiled saves it in JSON */
const mapOf = (layers) => {
	return new TileMap(`group-map-${serial++}`, {
		type: "map",
		version: "1.10",
		tiledversion: "1.12.0",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: 4,
		height: 2,
		tilewidth: TILE,
		tileheight: TILE,
		nextobjectid: 100,
		tilesets: [
			{
				firstgid: 1,
				name: "tiles",
				image: "group-tiles.png",
				imagewidth: 64,
				imageheight: 32,
				tilewidth: TILE,
				tileheight: TILE,
				tilecount: 8,
				columns: 4,
				margin: 0,
				spacing: 0,
			},
		],
		layers,
	});
};

/** the names of what was built, each with its kind */
const kinds = (built) => {
	return built.map((child) => {
		const kind =
			child instanceof TMXLayer
				? "tiles"
				: child instanceof ImageLayer
					? "image"
					: child instanceof Container
						? "container"
						: child instanceof Gem
							? "gem"
							: "other";
		return `${kind}:${child.name}`;
	});
};

describe.each([
	["Canvas", video.CANVAS],
	["WebGL", video.WEBGL],
])("a Tiled group layer (%s)", (label, renderer) => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(WIDTH, HEIGHT, {
			parent: "screen",
			renderer,
			consoleHeader: false,
			antiAlias: false,
		});
		await app.init();
		state.change(state.DEFAULT, true);
		app.reset();
		await loader.load({
			name: "group-tiles",
			type: "image",
			src: tilesImage(),
		});
		await loader.load({
			name: "group-picture",
			type: "image",
			src: pictureImage(),
		});
		registerObjectClass("GroupGem", Gem);
	});

	afterAll(() => {
		loader.unloadAll();
		app?.destroy();
	});

	beforeEach(() => {
		app.world.reset();
		app.world.pos.set(0, 0);
		app.world.backgroundColor.parseCSS("#000000");
		app.viewport.setBounds(-4000, -4000, 8000, 8000);
		app.viewport.moveTo(0, 0);
	});

	/** add a map to the world, draw a frame, and read the color at the middle of cells */
	const colors = async (map, flatten, ...cells) => {
		map.addTo(app.world, flatten, false);
		// (a container sorts its children once what added them is done)
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
		app.world.sortNow?.(true);
		app.viewport.setBounds(-4000, -4000, 8000, 8000);
		app.viewport.moveTo(0, 0);
		app.world.update(16);
		app.viewport.update(16);
		app.repaint();
		app.draw();
		const frame = copyFrame(app.renderer);
		return cells.map(([col, row]) => {
			const at =
				((row * TILE + TILE / 2) * frame.width + col * TILE + TILE / 2) * 4;
			return [frame.data[at], frame.data[at + 1], frame.data[at + 2]];
		});
	};

	describe("holding an object layer", () => {
		const withObjects = (
			groupExtra = {},
			layerExtra = {},
			objectExtra = {},
		) => {
			return mapOf([
				group(
					"upstairs",
					[
						objectLayer(
							"more",
							[object(21, "gem", 32, 16, objectExtra)],
							layerExtra,
						),
					],
					groupExtra,
				),
			]);
		};

		it("loads, and builds the layer's objects", () => {
			const built = withObjects().getObjects(true);
			expect(kinds(built)).toEqual(["gem:gem"]);
			expect([built[0].pos.x, built[0].pos.y]).toEqual([32, 16]);
		});

		it("moves them by the group's offset, on top of their layer's", () => {
			const [gem] = withObjects(
				{ offsetx: 8, offsety: 4 },
				{ offsetx: 2, offsety: 1 },
			).getObjects(true);
			expect([gem.pos.x, gem.pos.y]).toEqual([42, 21]);
		});

		it("fades them by the group's opacity, times their layer's", () => {
			const [gem] = withObjects({ opacity: 0.5 }, { opacity: 0.5 }).getObjects(
				true,
			);
			expect(gem.getOpacity()).toBeCloseTo(0.25, 6);
			// and times the object's own
			const [faint] = withObjects(
				{ opacity: 0.5 },
				{ opacity: 0.5 },
				{ opacity: 0.4 },
			).getObjects(true);
			expect(faint.getOpacity()).toBeCloseTo(0.1, 6);
		});

		it("hides them with the group, or with their layer", () => {
			const [inHiddenGroup] = withObjects({ visible: false }).getObjects(true);
			expect(inHiddenGroup.getOpacity()).toBe(0);
			const [inHiddenLayer] = withObjects({}, { visible: false }).getObjects(
				true,
			);
			expect(inHiddenLayer.getOpacity()).toBe(0);
		});

		it("tints them with the group's tint, unless their layer has its own", () => {
			const [tinted] = withObjects({ tintcolor: "#ff0000" }).getObjects(true);
			expect(tinted.given.tint?.toHex().toLowerCase()).toBe("#ff0000");
			const [own] = withObjects(
				{ tintcolor: "#ff0000" },
				{ tintcolor: "#0000ff" },
			).getObjects(true);
			expect(own.given.tint?.toHex().toLowerCase()).toBe("#0000ff");
			const [none] = withObjects().getObjects(true);
			expect(none.given.tint).toBeUndefined();
		});

		it("blends them as the group says, unless their layer says otherwise", () => {
			const [blended] = withObjects({ mode: "multiply" }).getObjects(true);
			expect(blended.blendMode).toBe("multiply");
			const [own] = withObjects(
				{ mode: "multiply" },
				{ mode: "screen" },
			).getObjects(true);
			expect(own.blendMode).toBe("screen");
		});

		it("keeps a container for the group and one for the layer, when not flattened", () => {
			const built = withObjects({ opacity: 0.5 }, { opacity: 0.25 }).getObjects(
				false,
			);
			expect(kinds(built)).toEqual(["container:upstairs"]);
			const upstairs = built[0];
			expect(upstairs.getOpacity()).toBe(0.5);
			expect(kinds(upstairs.getChildren())).toEqual(["container:more"]);
			const more = upstairs.getChildren()[0];
			expect(more.getOpacity()).toBe(0.25);
			expect(kinds(more.getChildren())).toEqual(["gem:gem"]);
			// each fades what is in it: the object keeps its own opacity
			expect(more.getChildren()[0].getOpacity()).toBe(1);
		});

		it("leaves the objects out when the game asks for none, and asks about each", () => {
			expect(withObjects().getObjects(true, false)).toEqual([]);
			const asked = [];
			withObjects().getObjects(true, (settings) => {
				asked.push(settings.name);
				return true;
			});
			expect(asked).toEqual(["gem"]);
		});

		it("makes walls of the unnamed shapes of a layer named collision", () => {
			const map = mapOf([
				group("physics", [
					objectLayer("collision", [
						{
							id: 30,
							name: "",
							type: "",
							x: 0,
							y: 16,
							width: 64,
							height: 16,
							rotation: 0,
							visible: true,
						},
					]),
				]),
			]);
			const [wall] = map.getObjects(true);
			expect(wall.bodyDef.collisionType).toBe(collision.types.WORLD_SHAPE);
			expect(wall.bodyDef.type).toBe("static");
			// and not of a layer of any other name
			const [thing] = mapOf([
				group("physics", [
					objectLayer("things", [
						{
							id: 31,
							name: "",
							type: "",
							x: 0,
							y: 16,
							width: 64,
							height: 16,
							rotation: 0,
							visible: true,
						},
					]),
				]),
			]).getObjects(true);
			expect(thing.bodyDef.collisionType).not.toBe(collision.types.WORLD_SHAPE);
		});
	});

	describe("holding an image layer", () => {
		const withImage = (groupExtra = {}, layerExtra = {}) => {
			return mapOf([
				group("backdrop", [imageLayer("sky", layerExtra)], groupExtra),
			]);
		};

		it("loads, and builds the image layer", () => {
			const built = withImage().getObjects(true);
			expect(kinds(built)).toEqual(["image:sky"]);
			expect(built[0].repeat).toBe("no-repeat");
		});

		it("builds it whatever objects the game asks for: it is a layer", () => {
			expect(kinds(withImage().getObjects(true, false))).toEqual(["image:sky"]);
			const asked = [];
			withImage().getObjects(true, (settings) => {
				asked.push(settings.name);
				return false;
			});
			expect(asked).toEqual([]);
		});

		it("places it by the group's offset, on top of its own", () => {
			const [sky] = withImage(
				{ offsetx: 8, offsety: 4 },
				{ offsetx: 16, offsety: 2 },
			).getObjects(true);
			expect([sky.offset.x, sky.offset.y]).toEqual([24, 6]);
		});

		it("scrolls it at the group's parallax factor, times its own", () => {
			const [sky] = withImage(
				{ parallaxx: 0.5, parallaxy: 0.5 },
				{ parallaxx: 0.5, parallaxy: 1 },
			).getObjects(true);
			expect([sky.ratio.x, sky.ratio.y]).toEqual([0.25, 0.5]);
		});

		it("fades it by the group's opacity, times its own", () => {
			const [sky] = withImage({ opacity: 0.5 }, { opacity: 0.5 }).getObjects(
				true,
			);
			expect(sky.getOpacity()).toBeCloseTo(0.25, 6);
			const [hidden] = withImage({ visible: false }).getObjects(true);
			expect(hidden.getOpacity()).toBe(0);
		});

		it("tints it with the group's tint, unless it has its own", () => {
			const [tinted] = withImage({ tintcolor: "#ff0000" }).getObjects(true);
			expect(tinted.tint.toHex().toLowerCase()).toBe("#ff0000");
			const [own] = withImage(
				{ tintcolor: "#ff0000" },
				{ tintcolor: "#0000ff" },
			).getObjects(true);
			expect(own.tint.toHex().toLowerCase()).toBe("#0000ff");
		});

		it("is in the group's container when not flattened", () => {
			const built = withImage().getObjects(false);
			expect(kinds(built)).toEqual(["container:backdrop"]);
			expect(kinds(built[0].getChildren())).toEqual(["image:sky"]);
		});

		it("is drawn where it is, once", async () => {
			// the picture is 32 x 16: at 16, 16 it covers two cells of the second row
			for (const flatten of [true, false]) {
				app.world.reset();
				app.world.backgroundColor.parseCSS("#000000");
				expect(
					await colors(
						withImage({ offsetx: 16 }, { offsety: 16 }),
						flatten,
						[0, 1],
						[1, 1],
						[2, 1],
						[3, 1],
						[1, 0],
					),
					`flatten ${flatten}`,
				).toEqual([BLACK, PICTURE_COLOR, PICTURE_COLOR, BLACK, BLACK]);
			}
		});
	});

	describe("holding another group", () => {
		const nested = (outer = {}, inner = {}, layerExtra = {}) => {
			return mapOf([
				group(
					"outer",
					[
						group(
							"inner",
							[
								tileLayer("deep", [2, 0, 0, 0, 0, 0, 0, 0], layerExtra),
								objectLayer("things", [object(41, "gem", 0, 16)], layerExtra),
								imageLayer("far", layerExtra),
							],
							inner,
						),
					],
					outer,
				),
			]);
		};

		it("loads, and builds what the inner group holds, in Tiled's order", () => {
			expect(kinds(nested().getObjects(true))).toEqual([
				"tiles:deep",
				"gem:gem",
				"image:far",
			]);
		});

		it("adds up the offsets of both groups and of the layer", () => {
			const [deep, gem, far] = nested(
				{ offsetx: 8, offsety: 4 },
				{ offsetx: 16, offsety: 0 },
				{ offsetx: 2, offsety: 1 },
			).getObjects(true);
			expect([deep.pos.x, deep.pos.y]).toEqual([26, 5]);
			expect([gem.pos.x, gem.pos.y]).toEqual([26, 21]);
			expect([far.offset.x, far.offset.y]).toEqual([26, 5]);
		});

		it("multiplies their opacities", () => {
			const [deep, gem, far] = nested(
				{ opacity: 0.5 },
				{ opacity: 0.5 },
				{ opacity: 0.5 },
			).getObjects(true);
			expect(deep.getOpacity()).toBeCloseTo(0.125, 6);
			expect(gem.getOpacity()).toBeCloseTo(0.125, 6);
			expect(far.getOpacity()).toBeCloseTo(0.125, 6);
		});

		it("multiplies their parallax factors", () => {
			const [deep, , far] = nested(
				{ parallaxx: 0.5, parallaxy: 0.5 },
				{ parallaxx: 0.5, parallaxy: 1 },
				{ parallaxx: 0.5, parallaxy: 0.5 },
			).getObjects(true);
			expect([deep.ratio.x, deep.ratio.y]).toEqual([0.125, 0.25]);
			expect([far.ratio.x, far.ratio.y]).toEqual([0.125, 0.25]);
		});

		it("tints a tile layer with the nearest group's tint, unless it has its own", () => {
			const [outer] = nested({ tintcolor: "#ff0000" }).getObjects(true);
			expect(outer.tint.toHex().toLowerCase()).toBe("#ff0000");
			const [inner] = nested(
				{ tintcolor: "#ff0000" },
				{ tintcolor: "#00ff00" },
			).getObjects(true);
			expect(inner.tint.toHex().toLowerCase()).toBe("#00ff00");
			const [own] = nested(
				{ tintcolor: "#ff0000" },
				{ tintcolor: "#00ff00" },
				{ tintcolor: "#0000ff" },
			).getObjects(true);
			expect(own.tint.toHex().toLowerCase()).toBe("#0000ff");
			const [none] = nested().getObjects(true);
			expect(none.tint.toHex().toLowerCase()).toBe("#ffffff");
		});

		it("takes the blend mode of the nearest group that has one", () => {
			const [, outerOnly] = nested({ mode: "multiply" }).getObjects(true);
			expect(outerOnly.blendMode).toBe("multiply");
			const [, innerWins] = nested(
				{ mode: "multiply" },
				{ mode: "screen" },
			).getObjects(true);
			expect(innerWins.blendMode).toBe("screen");
		});

		it("keeps a container for each group and each object layer, when not flattened", () => {
			const built = nested({ opacity: 0.5 }, { opacity: 0.25 }).getObjects(
				false,
			);
			expect(kinds(built)).toEqual(["container:outer"]);
			expect(built[0].getOpacity()).toBe(0.5);
			expect(kinds(built[0].getChildren())).toEqual(["container:inner"]);
			const inner = built[0].getChildren()[0];
			expect(inner.getOpacity()).toBe(0.25);
			expect(kinds(inner.getChildren()).sort()).toEqual([
				"container:things",
				"image:far",
				"tiles:deep",
			]);
		});

		it("builds nothing for a group that holds nothing, or only empty layers", () => {
			const map = mapOf([
				group("empty", []),
				group("hollow", [group("inner", []), objectLayer("none", [])]),
				// (as the XML reader gives a group with no child: no `layers` at all)
				{ type: "group", name: "bare", visible: true, opacity: 1 },
			]);
			expect(map.getObjects(true)).toEqual([]);
			expect(map.getObjects(false)).toEqual([]);
		});

		it("ignores a layer of a kind it does not know", () => {
			const map = mapOf([
				group("odd", [
					{ type: "somethingelse", name: "what" },
					objectLayer("things", [object(51, "gem", 0, 0)]),
				]),
			]);
			expect(kinds(map.getObjects(true))).toEqual(["gem:gem"]);
		});
	});

	describe("draw order", () => {
		// along the first row: each layer covers the cell of the one before
		// and one more, so each cell shows which of two is on top
		const stacked = () => {
			return mapOf([
				tileLayer("below", [1, 1, 1, 1, 1, 1, 1, 1]),
				group("g", [
					tileLayer("a", [2, 2, 0, 0, 0, 0, 0, 0]),
					objectLayer("objs", [
						object(61, "gem", 16, 0, {
							width: 32,
							height: 16,
							properties: { color: "#ff00ff" },
						}),
					]),
					imageLayer("pic", { offsetx: 32 }),
					group("h", [tileLayer("b", [0, 0, 0, 3, 3, 0, 0, 0])]),
				]),
				tileLayer("above", [0, 0, 0, 0, 4, 0, 0, 0]),
			]);
		};

		it.each([
			["flattened", true],
			["in containers", false],
		])("follows Tiled's layer order, %s", async (name, flatten) => {
			expect(
				await colors(
					stacked(),
					flatten,
					[0, 0],
					[1, 0],
					[2, 0],
					[3, 0],
					[0, 1],
					[1, 1],
				),
			).toEqual([
				// the group's first tile layer, over the layer below the group
				TILE_COLORS[1],
				// the object, over that tile layer
				[255, 0, 255],
				// the image layer, over the object
				PICTURE_COLOR,
				// the nested group's tile layer, over the image layer
				TILE_COLORS[2],
				// the layer after the group, over the group's last layer
				TILE_COLORS[3],
				// and the layer below the group, where nothing covers it
				TILE_COLORS[0],
			]);
		});

		it("draws a layer that follows a group over the group's layers, however many", async () => {
			// tile layers only: three in a group, each covering one cell less
			// than the one before, then a layer of the map over the first cell
			for (const flatten of [true, false]) {
				app.world.reset();
				app.world.backgroundColor.parseCSS("#000000");
				const map = mapOf([
					group("g", [
						tileLayer("a", [2, 2, 2, 2, 0, 0, 0, 0]),
						tileLayer("b", [3, 3, 3, 0, 0, 0, 0, 0]),
						tileLayer("c", [4, 4, 0, 0, 0, 0, 0, 0]),
					]),
					tileLayer("above", [5, 0, 0, 0, 0, 0, 0, 0]),
				]);
				expect(
					await colors(map, flatten, [0, 0], [1, 0], [2, 0], [3, 0]),
					`flatten ${flatten}`,
				).toEqual([
					TILE_COLORS[4],
					TILE_COLORS[3],
					TILE_COLORS[2],
					TILE_COLORS[1],
				]);
			}
		});

		it("gives each layer a depth of its own, in Tiled's order", () => {
			const map = mapOf([
				tileLayer("below", [1, 0, 0, 0, 0, 0, 0, 0]),
				group("g", [
					tileLayer("a", [2, 0, 0, 0, 0, 0, 0, 0]),
					objectLayer("objs", [
						object(91, "gem", 0, 0),
						object(92, "gem", 16, 0),
					]),
					imageLayer("pic"),
					group("h", [tileLayer("b", [3, 0, 0, 0, 0, 0, 0, 0])]),
				]),
				tileLayer("above", [4, 0, 0, 0, 0, 0, 0, 0]),
				objectLayer("last", [object(93, "gem", 0, 0)]),
			]);
			const depth = Object.fromEntries(
				[...map.getLayers(), ...map.getObjects(true)].map((child) => {
					return [
						child.name === "gem" ? `gem ${child.id}` : child.name,
						child.pos.z,
					];
				}),
			);
			expect(depth).toEqual({
				below: 0,
				a: 1,
				// the objects of one layer share its depth
				"gem 91": 2,
				"gem 92": 2,
				pic: 3,
				b: 4,
				above: 5,
				"gem 93": 6,
			});
		});
	});

	describe("read from a TMX file", () => {
		const TMX = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.12.0" orientation="orthogonal" renderorder="right-down" width="4" height="2" tilewidth="16" tileheight="16" infinite="0" nextlayerid="9" nextobjectid="100">
 <tileset firstgid="1" name="tiles" tilewidth="16" tileheight="16" tilecount="8" columns="4">
  <image source="group-tiles.png" width="64" height="32"/>
 </tileset>
 <group id="1" name="outer" offsetx="8" offsety="4" opacity="0.5">
  <layer id="2" name="deep" width="4" height="2">
   <data encoding="csv">
2,0,0,0,
0,0,0,0
</data>
  </layer>
  <objectgroup id="3" name="things" offsetx="2" offsety="1">
   <object id="71" name="gem" type="GroupGem" x="0" y="16" width="16" height="16"/>
  </objectgroup>
  <imagelayer id="4" name="far" offsetx="16" offsety="2" repeatx="1">
   <image source="group-picture.png" width="32" height="16"/>
  </imagelayer>
  <group id="5" name="inner" offsetx="16">
   <objectgroup id="6" name="more">
    <object id="72" name="jewel" type="GroupGem" x="0" y="0" width="16" height="16"/>
   </objectgroup>
  </group>
 </group>
</map>`;

		const fromXML = () => {
			return new TileMap(
				`group-xml-${serial++}`,
				TMXUtils.parse(new DOMParser().parseFromString(TMX, "text/xml")).map,
			);
		};

		it("loads, and builds each layer as what it is", () => {
			const built = fromXML().getObjects(true);
			expect(kinds(built)).toEqual([
				"tiles:deep",
				"gem:gem",
				"image:far",
				"gem:jewel",
			]);
			const [deep, gem, far, jewel] = built;
			expect([deep.pos.x, deep.pos.y]).toEqual([8, 4]);
			expect([gem.pos.x, gem.pos.y]).toEqual([10, 21]);
			expect([far.offset.x, far.offset.y]).toEqual([24, 6]);
			expect(far.repeat).toBe("repeat-x");
			expect([jewel.pos.x, jewel.pos.y]).toEqual([24, 4]);
			for (const child of built) {
				expect(child.getOpacity()).toBeCloseTo(0.5, 6);
			}
		});

		it("keeps the groups as containers when not flattened", () => {
			const built = fromXML().getObjects(false);
			expect(kinds(built)).toEqual(["container:outer"]);
			expect(kinds(built[0].getChildren()).sort()).toEqual([
				"container:inner",
				"container:things",
				"image:far",
				"tiles:deep",
			]);
		});
	});

	it("finds an object of a nested group by the id the map gives it", async () => {
		const map = mapOf([
			group("outer", [
				group("inner", [objectLayer("things", [object(81, "gem", 0, 0)])]),
			]),
		]);
		for (const flatten of [true, false]) {
			app.world.reset();
			map.addTo(app.world, flatten, false);
			const found = app.world.getChildByProp("id", 81);
			expect(found.length, `flatten ${flatten}`).toBe(1);
			expect(found[0]).toBeInstanceOf(Gem);
		}
	});
});
