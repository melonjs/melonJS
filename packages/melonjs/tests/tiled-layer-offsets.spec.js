/**
 * The offset Tiled gives a layer (`offsetx`, `offsety`), on the layers that
 * are not tile layers: an object layer moves its objects, and a group layer
 * moves the tile layers inside it, on top of their own offset.
 *
 * Objects are compared with the same map loaded with no offset, so that how
 * an orientation places an object (an isometric map projects it) is not
 * worked out twice. Tile layers in a group are held to the picture painted
 * with no engine (see `helpers/tile-layer-compare.js`) of the same layers,
 * out of the group, carrying the sum of the offsets themselves.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { TMXLayer, video } from "../src/index.js";
import {
	diff,
	drawIn,
	drawn,
	fill,
	inBlock,
	makeApp,
	makeMap,
	makeTileset,
	reference,
	show,
} from "./helpers/tile-layer-compare.js";

const WIDTH = 320;
const HEIGHT = 240;

const filled = (cols, rows, seed = 0) => {
	return fill(cols, rows, (c, r) => {
		return (c * 3 + r + seed) % 5 === 0 ? 0 : 1 + ((c + r * 2 + seed) % 8);
	});
};

const GEOMETRY = {
	orthogonal: { cols: 10, rows: 8, tw: 32, th: 32, tall: 32 },
	isometric: { cols: 8, rows: 6, tw: 64, th: 32, tall: 64 },
};

/**
 * One tileset for each orientation, made once: two scenes are compared, and
 * every tileset made has pictures of its own
 */
const TILESETS = {};
const tilesetOf = (orientation) => {
	const { tw, th, tall } = GEOMETRY[orientation];
	TILESETS[orientation] ??= makeTileset({
		tw,
		th: tall,
		opaque: (x, y) => {
			return inBlock(x, y, tw, tall, tw, th);
		},
	});
	return TILESETS[orientation];
};

/** a map of one orientation, with the given layers after a plain tile layer */
const scene = (orientation, layers) => {
	const { cols, rows, tw, th } = GEOMETRY[orientation];
	return {
		orientation,
		cols,
		rows,
		tw,
		th,
		tilesets: [tilesetOf(orientation)],
		layers: [{ data: filled(cols, rows) }, ...layers],
	};
};

/** a tile layer as a group holds one: all that `makeMap` fills in itself */
const inner = (orientation, name, seed, more = {}) => {
	const { cols, rows } = GEOMETRY[orientation];
	return {
		type: "tilelayer",
		name,
		width: cols,
		height: rows,
		visible: true,
		opacity: 1,
		data: filled(cols, rows, seed),
		...more,
	};
};

/** an object layer with one object of each kind */
const objectLayer = (more = {}) => {
	const object = (id, name, rest) => {
		return { id, name, type: "", rotation: 0, visible: true, ...rest };
	};
	return {
		type: "objectgroup",
		name: "things",
		draworder: "topdown",
		objects: [
			object(1, "box", { x: 40, y: 50, width: 20, height: 10 }),
			object(2, "spot", { x: 100, y: 60, width: 0, height: 0, point: true }),
			object(3, "tri", {
				x: 120,
				y: 80,
				width: 0,
				height: 0,
				polygon: [
					{ x: 0, y: 0 },
					{ x: 20, y: 0 },
					{ x: 10, y: 15 },
				],
			}),
			object(4, "round", {
				x: 30,
				y: 90,
				width: 24,
				height: 24,
				ellipse: true,
			}),
			object(5, "crate", { x: 64, y: 96, width: 32, height: 32, gid: 1 }),
		],
		...more,
	};
};

const NAMES = ["box", "spot", "tri", "round", "crate"];

describe("the offset of an object layer and of a group layer in Tiled", () => {
	let app;
	beforeAll(async () => {
		app = await makeApp(video.CANVAS, "CANVAS", WIDTH, HEIGHT);
	});
	afterAll(() => {
		app?.destroy();
		vi.restoreAllMocks();
	});

	/** load a map, and say where each named object stands in the world */
	const whereObjectsAre = (map, flatten) => {
		app.world.reset();
		app.world.pos.set(0, 0, app.world.pos.z);
		map.addTo(app.world, flatten, false);
		const places = {};
		for (const name of NAMES) {
			const found = app.world.getChildByName(name);
			expect(found, name).toHaveLength(1);
			const at = found[0].getAbsolutePosition();
			places[name] = { x: at.x, y: at.y };
		}
		return places;
	};

	/** the tile layers a group holds, as the map read them */
	const groupLayers = (map) => {
		map.getLayers();
		return map.objectGroups.flatMap((group) => {
			return group.objects.filter((object) => {
				return object instanceof TMXLayer;
			});
		});
	};

	describe("an object layer moves its objects", () => {
		for (const orientation of ["orthogonal", "isometric"]) {
			for (const flatten of [true, false]) {
				for (const [ox, oy] of [
					[37, -21],
					[-130, 75],
				]) {
					it(`${orientation}, ${flatten ? "flattened" : "in its container"}, by (${ox}, ${oy})`, () => {
						const unmoved = whereObjectsAre(
							makeMap(scene(orientation, [objectLayer()])),
							flatten,
						);
						const moved = whereObjectsAre(
							makeMap(
								scene(orientation, [objectLayer({ offsetx: ox, offsety: oy })]),
							),
							flatten,
						);
						for (const name of NAMES) {
							expect(moved[name].x - unmoved[name].x, `${name} x`).toBeCloseTo(
								ox,
								6,
							);
							expect(moved[name].y - unmoved[name].y, `${name} y`).toBeCloseTo(
								oy,
								6,
							);
						}
					});
				}
			}
		}

		it("its collision shapes move with the objects", () => {
			const shapeOf = (map) => {
				app.world.reset();
				map.addTo(app.world, true, false);
				const box = app.world.getChildByName("box")[0];
				const bounds = box.getBounds();
				return { left: bounds.left, top: bounds.top, width: bounds.width };
			};
			const unmoved = shapeOf(makeMap(scene("orthogonal", [objectLayer()])));
			const moved = shapeOf(
				makeMap(
					scene("orthogonal", [objectLayer({ offsetx: 37, offsety: -21 })]),
				),
			);
			expect(moved.left - unmoved.left).toBeCloseTo(37, 6);
			expect(moved.top - unmoved.top).toBeCloseTo(-21, 6);
			expect(moved.width).toBeCloseTo(unmoved.width, 6);
		});

		it("an offset written as text, as an XML map gives it, counts the same", () => {
			const unmoved = whereObjectsAre(
				makeMap(scene("orthogonal", [objectLayer()])),
				true,
			);
			const moved = whereObjectsAre(
				makeMap(
					scene("orthogonal", [
						objectLayer({ offsetx: "12.5", offsety: "-4" }),
					]),
				),
				true,
			);
			expect(moved.box.x - unmoved.box.x).toBeCloseTo(12.5, 6);
			expect(moved.box.y - unmoved.box.y).toBeCloseTo(-4, 6);
		});

		it("the objects are made twice from one map: moved once each time", () => {
			const map = makeMap(
				scene("orthogonal", [objectLayer({ offsetx: 37, offsety: -21 })]),
			);
			const places = () => {
				return map.getObjects(true).map((object) => {
					return [object.name, object.pos.x, object.pos.y];
				});
			};
			const first = places();
			expect(first).toHaveLength(NAMES.length);
			expect(places()).toEqual(first);
		});

		it("the map's data is left as it was read", () => {
			const data = scene("orthogonal", [
				objectLayer({ offsetx: 37, offsety: -21 }),
			]);
			const before = JSON.stringify(data.layers[1].objects);
			whereObjectsAre(makeMap(data), true);
			expect(JSON.stringify(data.layers[1].objects)).toBe(before);
		});
	});

	describe("a group layer moves the tile layers inside it", () => {
		const VIEWS = [
			[0, 0],
			[70, 20],
			[-40, -80],
			[230, 110],
		];

		/**
		 * Draw a map with a group, tile by tile and baked, and expect the
		 * picture of the flat map that says the same thing.
		 */
		const asTiled = async (grouped, flat) => {
			let total = 0;
			for (const mode of ["perTile", "prerender"]) {
				const map = makeMap(grouped);
				for (const layer of groupLayers(map)) {
					layer.renderMode = mode;
				}
				show(app, map, mode);
				const layers = app.world.getChildByType(TMXLayer);
				expect(layers).toHaveLength(flat.layers.length);
				for (const [x, y] of VIEWS) {
					app.viewport.moveTo(x, y);
					const { frame } = await drawIn(app, layers, mode);
					const d = diff(reference(flat, x, y, WIDTH, HEIGHT), frame);
					expect(d.different, `${mode}, view (${x}, ${y}): ${d.first}`).toBe(0);
					total += drawn(frame);
				}
			}
			return total;
		};

		for (const orientation of ["orthogonal", "isometric"]) {
			it(`${orientation}: by the group's offset, and by their own on top`, async () => {
				const grouped = scene(orientation, [
					{
						type: "group",
						name: "upstairs",
						offsetx: 48,
						offsety: -16,
						layers: [
							inner(orientation, "floor", 1, { offsetx: 5, offsety: 7 }),
							inner(orientation, "walls", 3),
						],
					},
				]);
				const { cols, rows } = GEOMETRY[orientation];
				const flat = scene(orientation, [
					{ data: filled(cols, rows, 1), offsetx: 53, offsety: -9 },
					{ data: filled(cols, rows, 3), offsetx: 48, offsety: -16 },
				]);
				expect(await asTiled(grouped, flat)).toBeGreaterThan(0);
			});
		}

		it("a group with no offset leaves its layers where they are", async () => {
			const grouped = scene("orthogonal", [
				{
					type: "group",
					name: "upstairs",
					layers: [
						inner("orthogonal", "floor", 1, { offsetx: 5, offsety: 7 }),
						inner("orthogonal", "walls", 3),
					],
				},
			]);
			const flat = scene("orthogonal", [
				{ data: filled(10, 8, 1), offsetx: 5, offsety: 7 },
				{ data: filled(10, 8, 3) },
			]);
			expect(await asTiled(grouped, flat)).toBeGreaterThan(0);
		});

		it("`pos` and `getTile()` follow: a tile is found where it is drawn", () => {
			const map = makeMap(
				scene("orthogonal", [
					{
						type: "group",
						name: "upstairs",
						offsetx: 48,
						offsety: -16,
						layers: [
							inner("orthogonal", "floor", 1, { offsetx: 5, offsety: 7 }),
						],
					},
				]),
			);
			const [floor] = groupLayers(map);
			expect(floor.pos.x).toBe(53);
			expect(floor.pos.y).toBe(-9);
			// the first cell of the layer that holds a tile
			const data = filled(10, 8, 1);
			const index = data.findIndex((gid) => {
				return gid > 0;
			});
			const col = index % 10;
			const row = Math.floor(index / 10);
			const x = col * 32 + 16;
			const y = row * 32 + 16;
			// found where it is drawn
			expect(floor.getTile(x + 53, y - 9)?.tileId).toBe(data[index]);
			// the layer is 320 wide: a point 300 to the left of that tile is
			// in it only if the group's 48 pixels were left out
			expect(floor.getTile(x + 53 - 300, y - 9)).toBeNull();
			expect(floor.getTile(-10, y - 9)).toBeNull();
		});

		it("kept in its container (not flattened), the layers stand in the same place", async () => {
			const grouped = scene("orthogonal", [
				{
					type: "group",
					name: "upstairs",
					offsetx: 48,
					offsety: -16,
					layers: [inner("orthogonal", "walls", 3)],
				},
			]);
			const flat = scene("orthogonal", [
				{ data: filled(10, 8, 3), offsetx: 48, offsety: -16 },
			]);
			const map = makeMap(grouped);
			app.world.reset();
			app.world.pos.set(0, 0, app.world.pos.z);
			app.renderer.backgroundColor.setColor(16, 24, 48);
			map.addTo(app.world, false, false);
			app.world.sortNow(true);
			app.viewport.setBounds(-100000, -100000, 200000, 200000);
			const layers = [...map.getLayers(), ...groupLayers(map)];
			for (const [x, y] of VIEWS) {
				app.viewport.moveTo(x, y);
				const { frame } = await drawIn(app, layers, "perTile");
				const d = diff(reference(flat, x, y, WIDTH, HEIGHT), frame);
				expect(d.different, `view (${x}, ${y}): ${d.first}`).toBe(0);
			}
		});
	});
});
