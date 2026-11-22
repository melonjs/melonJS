import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	type LDtkEntityInstance,
	LDtkObject,
	type LDtkObjectSettings,
	type LDtkProjectJson,
	loader,
	NineSliceSprite,
	Renderable,
	registerObjectClass,
	Sprite,
	Trigger,
	type video,
} from "../../src/index.js";
import {
	diff,
	enter,
	frame,
	HEIGHT,
	makeApp,
	objectsIn,
	WIDTH,
} from "./ldtk-harness.ts";
import {
	defs,
	layer,
	levelJson,
	tilesetImage,
} from "./ldtk-project-builder.ts";

/**
 * The entities of an LDtk level: where they stand, what they are built by,
 * what they carry, and the tile LDtk shows them with, drawn in each of its
 * fill modes and compared with the same tile drawn with the 2D canvas alone.
 * No sample that comes with LDtk gives an entity a tile of a tileset with an
 * image, so the project is made here.
 * @param renderer - the renderer to ask for
 * @param name - its name
 * @param tolerance - the largest difference of a channel that is not counted
 * @param edge - how many pixels may differ: a tile scaled by a fraction is
 * rounded to the nearest pixel by each renderer its own way along its edges
 * (none on the 2D canvas, which the reference is drawn with)
 */
export function entityChecks(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
	name: string,
	tolerance: number,
	edge: number,
) {
	// the part of the tileset the entities show: two tiles side by side
	const RECT = { tilesetUid: 1, x: 16, y: 0, w: 32, h: 16 };
	const MODES = [
		"Stretch",
		"FitInside",
		"Cover",
		"FullSizeCropped",
		"FullSizeUncropped",
		"Repeat",
	];

	let serial = 0;
	// an entity, as LDtk saves it
	const entity = (
		identifier: string,
		defUid: number,
		box: {
			x: number;
			y: number;
			w: number;
			h: number;
			px?: number;
			py?: number;
		},
		extra: Partial<LDtkEntityInstance> = {},
	): LDtkEntityInstance => {
		return {
			__identifier: identifier,
			iid: `entity-${String(serial++)}`,
			defUid,
			px: [box.x, box.y],
			__pivot: [box.px ?? 0, box.py ?? 0],
			__grid: [0, 0],
			width: box.w,
			height: box.h,
			__tags: [],
			__tile: RECT,
			fieldInstances: [],
			...extra,
		};
	};

	const entityDef = (uid: number, identifier: string, mode: string) => {
		return {
			uid,
			identifier,
			width: 16,
			height: 16,
			color: "#ffffff",
			tags: [],
			tileRenderMode: mode,
			pivotX: 0,
			pivotY: 0,
		};
	};

	const entities = (
		identifier: string,
		list: LDtkEntityInstance[],
		extra = {},
	) => {
		return layer(identifier, "Entities", 16, 20, 15, [], {
			__tilesetDefUid: null,
			entityInstances: list,
			...extra,
		});
	};

	const big = { pxWid: WIDTH, pxHei: HEIGHT };

	const project = (): LDtkProjectJson => {
		const definitions = defs();
		definitions.entities = [
			...MODES.map((mode, i) => {
				return entityDef(10 + i, mode, mode);
			}),
			{
				...entityDef(20, "Framed", "NineSlice"),
				nineSliceBorders: [3, 7, 4, 5],
			},
			entityDef(21, "Unframed", "NineSlice"),
		];
		return {
			jsonVersion: "1.5.3",
			iid: "entities",
			bgColor: "#101010",
			defaultGridSize: 16,
			worldLayout: "Free",
			worldGridWidth: 256,
			worldGridHeight: 256,
			externalLevels: false,
			defs: definitions,
			levels: [
				// each fill mode, in a box wider, taller and smaller than the
				// tile, held by its top left corner, its middle and its
				// bottom right corner
				...MODES.map((mode, i) => {
					return levelJson(
						`Mode_${mode}`,
						[
							entities("Things", [
								entity(mode, 10 + i, { x: 8, y: 8, w: 64, h: 64 }),
								entity(mode, 10 + i, {
									x: 136,
									y: 40,
									w: 64,
									h: 64,
									px: 0.5,
									py: 0.5,
								}),
								entity(mode, 10 + i, {
									x: 300,
									y: 80,
									w: 80,
									h: 40,
									px: 1,
									py: 1,
								}),
								entity(mode, 10 + i, { x: 8, y: 120, w: 20, h: 12 }),
								entity(mode, 10 + i, {
									x: 80,
									y: 130,
									w: 20,
									h: 12,
									px: 0.5,
									py: 0.5,
								}),
								entity(mode, 10 + i, {
									x: 200,
									y: 200,
									w: 24,
									h: 48,
									px: 1,
									py: 1,
								}),
								// wider than the fitted tile: held across by the pivot
								entity(mode, 10 + i, {
									x: 316,
									y: 150,
									w: 80,
									h: 16,
									px: 1,
									py: 0.5,
								}),
							]),
						],
						big,
					);
				}),
				levelJson(
					"Slices",
					[
						entities("Things", [
							entity("Framed", 20, { x: 8, y: 8, w: 96, h: 64 }),
							entity("Unframed", 21, { x: 120, y: 8, w: 64, h: 64 }),
							// a definition that is not in the file
							entity("Lost", 999, { x: 200, y: 8, w: 64, h: 64 }),
						]),
					],
					big,
				),
				levelJson(
					"Placed",
					[
						// a layer moved and faded, an entity taller than wide
						// held by the middle of its bottom edge, and two that
						// overlap: the second one over the first
						entities(
							"Moved",
							[
								entity("Stretch", 10, {
									x: 100,
									y: 120,
									w: 20,
									h: 40,
									px: 0.5,
									py: 1,
								}),
								entity("Stretch", 10, { x: 200, y: 20, w: 32, h: 16 }),
								entity(
									"Stretch",
									10,
									{ x: 216, y: 28, w: 32, h: 16 },
									{
										__tile: { ...RECT, x: 0, y: 16 },
									},
								),
							],
							{ __pxTotalOffsetX: 12, __pxTotalOffsetY: -6, __opacity: 0.5 },
						),
					],
					big,
				),
				levelJson(
					"Named",
					[
						entities("Things", [
							// named like classes of the engine
							...[
								"Sprite",
								"Trigger",
								"Text",
								"Entity",
								"Collectable",
								"shape",
								"Renderable",
								"Light2d",
								"ImageLayer",
							].map((identifier, i) => {
								return entity(
									identifier,
									0,
									{ x: 16 + i * 24, y: 16, w: 16, h: 16 },
									{ __tile: null },
								);
							}),
							// fields named like the settings the engine gives
							entity(
								"Odd",
								0,
								{ x: 16, y: 80, w: 16, h: 16 },
								{
									__tile: null,
									fieldInstances: [
										{
											__identifier: "tile",
											__type: "Tile",
											__value: { tilesetUid: 1, x: 0, y: 0, w: 16, h: 16 },
										},
										{
											__identifier: "tileRect",
											__type: "String",
											__value: "not a tile",
										},
										{
											__identifier: "color",
											__type: "Color",
											__value: "#123456",
										},
										{
											__identifier: "image",
											__type: "String",
											__value: "ldtk-test-tiles",
										},
										{ __identifier: "width", __type: "Int", __value: 999 },
										{ __identifier: "speed", __type: "Float", __value: 2.5 },
									],
								},
							),
							entity(
								"Coin",
								0,
								{ x: 64, y: 80, w: 16, h: 16 },
								{ __tile: null },
							),
							entity(
								"Coin",
								0,
								{ x: 96, y: 80, w: 16, h: 16 },
								{ __tile: null },
							),
							entity("Hero", 10, { x: 160, y: 80, w: 32, h: 16 }),
						]),
					],
					big,
				),
			],
			worlds: [],
		};
	};

	describe(`the entities of an LDtk level, on ${name}`, () => {
		let app: Application;
		let image: HTMLImageElement;

		beforeAll(async () => {
			app = await makeApp(renderer);
			await loader.load({
				name: "ldtk-test-tiles",
				type: "image",
				src: tilesetImage(),
			});
			image = loader.getImage("ldtk-test-tiles") as HTMLImageElement;
			await loader.preload(
				[{ name: "ents", type: "ldtk", data: project() }],
				undefined,
				false,
			);
		});

		afterAll(() => {
			app.destroy();
		});

		// a tile drawn into a box as LDtk does, with the 2D canvas
		const paint = (
			c: CanvasRenderingContext2D,
			mode: string,
			rect: { x: number; y: number; w: number; h: number },
			x: number,
			y: number,
			w: number,
			h: number,
			px: number,
			py: number,
		) => {
			const { w: tw, h: th } = rect;
			if (mode === "FitInside") {
				const s = Math.min(w / tw, h / th);
				c.drawImage(
					image,
					rect.x,
					rect.y,
					tw,
					th,
					x + (w - tw * s) * px,
					y + (h - th * s) * py,
					tw * s,
					th * s,
				);
			} else if (mode === "Cover") {
				const s = Math.max(w / tw, h / th);
				const sw = w / s;
				const sh = h / s;
				c.drawImage(
					image,
					rect.x + (tw - sw) * px,
					rect.y + (th - sh) * py,
					sw,
					sh,
					x,
					y,
					w,
					h,
				);
			} else if (mode === "FullSizeCropped") {
				const sw = Math.min(tw, w);
				const sh = Math.min(th, h);
				c.drawImage(
					image,
					rect.x + (tw - sw) * px,
					rect.y + (th - sh) * py,
					sw,
					sh,
					x + (w - sw) * px,
					y + (h - sh) * py,
					sw,
					sh,
				);
			} else if (mode === "FullSizeUncropped") {
				c.drawImage(
					image,
					rect.x,
					rect.y,
					tw,
					th,
					x + (w - tw) * px,
					y + (h - th) * py,
					tw,
					th,
				);
			} else if (mode === "Repeat") {
				for (let dy = 0; dy < h; dy += th) {
					const sh = Math.min(th, h - dy);
					for (let dx = 0; dx < w; dx += tw) {
						const sw = Math.min(tw, w - dx);
						c.drawImage(image, rect.x, rect.y, sw, sh, x + dx, y + dy, sw, sh);
					}
				}
			} else {
				c.drawImage(image, rect.x, rect.y, tw, th, x, y, w, h);
			}
		};

		/**
		 * the view, as the 2D canvas draws a list of entities
		 * @param list - the entities, in LDtk's order
		 * @param mode - how each fills its box, by its definition
		 * @param offsetX - the layer's offset across
		 * @param offsetY - the layer's offset down
		 * @param opacity - the layer's opacity
		 * @returns the view's pixels
		 */
		const expected = (
			list: LDtkEntityInstance[],
			mode: (entity: LDtkEntityInstance) => string,
			offsetX = 0,
			offsetY = 0,
			opacity = 1,
		) => {
			const canvas = document.createElement("canvas");
			canvas.width = WIDTH;
			canvas.height = HEIGHT;
			const c = canvas.getContext("2d") as CanvasRenderingContext2D;
			c.imageSmoothingEnabled = false;
			c.fillStyle = "#203040";
			c.fillRect(0, 0, WIDTH, HEIGHT);
			c.globalAlpha = opacity;
			for (const e of list) {
				if (e.__tile === null || e.__tile === undefined) {
					continue;
				}
				paint(
					c,
					mode(e),
					e.__tile,
					offsetX + e.px[0] - e.__pivot[0] * e.width,
					offsetY + e.px[1] - e.__pivot[1] * e.height,
					e.width,
					e.height,
					e.__pivot[0],
					e.__pivot[1],
				);
			}
			return c.getImageData(0, 0, WIDTH, HEIGHT).data;
		};

		const entitiesOf = (identifier: string) => {
			const json = loader.getLDtk("ents")?.getLevel(identifier)?.json;
			return (json?.layerInstances ?? []).flatMap((entry) => {
				return entry.entityInstances;
			});
		};

		for (const mode of MODES) {
			it(`shows a tile in "${mode}" mode as LDtk does, in boxes of every shape and pivot`, async () => {
				await enter(app, `ents:Mode_${mode}`);
				app.viewport.moveTo(0, 0);
				const list = entitiesOf(`Mode_${mode}`);
				expect(list).toHaveLength(7);
				const result = diff(
					frame(app),
					expected(list, () => {
						return mode;
					}),
					tolerance,
				);
				expect(
					result.different,
					`${result.first} (worst ${String(result.worst)})`,
				).toBeLessThanOrEqual(edge);
				// each is a sprite of the engine on the tile's region, apart
				// from the repeated one
				for (const built of objectsIn(app.world) as LDtkObject[]) {
					expect(built).toBeInstanceOf(LDtkObject);
					expect(built.tileSprite).toBeDefined();
					expect(built.tileSprite instanceof Sprite).toBe(mode !== "Repeat");
				}
			});
		}

		it("a nine-slice tile is a nine-slice sprite with LDtk's borders; with none, or no definition, the tile is stretched or fitted", async () => {
			await enter(app, "ents:Slices");
			const [framed] = objectsIn(app.world, "Framed") as LDtkObject[];
			expect(framed.tileSprite).toBeInstanceOf(NineSliceSprite);
			const slice = framed.tileSprite as unknown as {
				width: number;
				height: number;
				insetx: number;
				insety: number;
			};
			expect([slice.width, slice.height]).toEqual([96, 64]);
			// left and top, of up 3, right 7, down 4, left 5
			expect([slice.insetx, slice.insety]).toEqual([5, 3]);
			const [unframed] = objectsIn(app.world, "Unframed") as LDtkObject[];
			expect(unframed.tileSprite).toBeInstanceOf(Sprite);
			expect(unframed.tileSprite).not.toBeInstanceOf(NineSliceSprite);
			// the two that are plain sprites, drawn: stretched, and fitted
			// for the entity whose definition is not in the file
			const list = entitiesOf("Slices").filter((e) => {
				return e.__identifier !== "Framed";
			});
			framed.setOpacity(0);
			app.viewport.moveTo(0, 0);
			const result = diff(
				frame(app),
				expected(list, (e) => {
					return e.__identifier === "Lost" ? "FitInside" : "Stretch";
				}),
				tolerance,
			);
			expect(result.different, result.first).toBeLessThanOrEqual(edge);

			// And the framed one, drawn alone. A nine-slice keeps its
			// corners as they are in the tile and stretches what is between
			// them: each corner of the box shows that corner of the tile,
			// pixel for pixel, and the middle is filled.
			framed.setOpacity(1);
			for (const other of objectsIn(app.world)) {
				if (other !== framed) {
					other.setOpacity(0);
				}
			}
			const drawn = frame(app);
			const source = document.createElement("canvas");
			source.width = image.width;
			source.height = image.height;
			const pixels = source.getContext("2d") as CanvasRenderingContext2D;
			pixels.drawImage(image, 0, 0);
			const [left, top] = [slice.insetx, slice.insety];
			const box = { x: 8, y: 8, w: 96, h: 64 };
			let compared = 0;
			for (const [fromX, fromY, toX, toY] of [
				[RECT.x, RECT.y, box.x, box.y],
				[RECT.x + RECT.w - left, RECT.y, box.x + box.w - left, box.y],
				[RECT.x, RECT.y + RECT.h - top, box.x, box.y + box.h - top],
				[
					RECT.x + RECT.w - left,
					RECT.y + RECT.h - top,
					box.x + box.w - left,
					box.y + box.h - top,
				],
			]) {
				const corner = pixels.getImageData(fromX, fromY, left, top).data;
				for (let y = 0; y < top; y++) {
					for (let x = 0; x < left; x++) {
						const at = ((toY + y) * WIDTH + toX + x) * 4;
						for (let channel = 0; channel < 3; channel++) {
							expect(
								Math.abs(
									drawn[at + channel] - corner[(y * left + x) * 4 + channel],
								),
								`corner pixel ${String(toX + x)}, ${String(toY + y)}`,
							).toBeLessThanOrEqual(tolerance);
							compared++;
						}
					}
				}
			}
			expect(compared).toBe(4 * left * top * 3);
			// the middle of the box is the tile's, not the level's background
			const middle = ((box.y + box.h / 2) * WIDTH + box.x + box.w / 2) * 4;
			expect(Array.from(drawn.slice(middle, middle + 3))).not.toEqual([
				0x10, 0x10, 0x10,
			]);
		});

		it("places an entity by its pivot whatever its shape, with its layer's offset and opacity, a later one over an earlier one", async () => {
			await enter(app, "ents:Placed");
			const list = entitiesOf("Placed");
			expect(objectsIn(app.world)).toHaveLength(3);
			// each found by its id in LDtk, in the level's order
			const built = list.map((placed) => {
				return app.world.getChildByProp("id", placed.iid)[0];
			});
			// 20 x 40, held by the middle of its bottom edge at 100, 120,
			// in a layer moved by 12, -6
			expect([built[0].pos.x, built[0].pos.y]).toEqual([
				100 - 10 + 12,
				120 - 40 - 6,
			]);
			expect((built[0] as LDtkObject).source.px).toEqual({ x: 112, y: 114 });
			expect([built[0].width, built[0].height]).toEqual([20, 40]);
			expect(built[0].getOpacity()).toBe(0.5);
			app.viewport.moveTo(0, 0);
			const result = diff(
				frame(app),
				expected(
					list,
					() => {
						return "Stretch";
					},
					12,
					-6,
					0.5,
				),
				Math.max(tolerance, 2),
			);
			expect(
				result.different,
				`${result.first} (worst ${String(result.worst)})`,
			).toBeLessThanOrEqual(edge);
			// the other way round is another picture
			const reversed = diff(
				frame(app),
				expected(
					[...list].reverse(),
					() => {
						return "Stretch";
					},
					12,
					-6,
					0.5,
				),
				Math.max(tolerance, 2),
			);
			expect(reversed.different).toBeGreaterThan(edge + 50);
		});

		it("an entity named like a class of the engine is the designer's, not the engine's", async () => {
			await enter(app, "ents:Named");
			for (const identifier of [
				"Sprite",
				"Trigger",
				"Text",
				"Entity",
				"Collectable",
				"shape",
				"Renderable",
				"Light2d",
				"ImageLayer",
			]) {
				const found = objectsIn(app.world, identifier);
				expect(found, identifier).toHaveLength(1);
				expect(found[0], identifier).toBeInstanceOf(LDtkObject);
				expect(found[0].bodyDef, identifier).toBeUndefined();
				expect(app.world.getChildByName(identifier), identifier).toEqual(found);
			}
		});

		it("a field named like a setting of the engine stays a field, and breaks nothing", async () => {
			await enter(app, "ents:Named");
			const [odd] = objectsIn(app.world, "Odd") as LDtkObject[];
			expect(odd.fields).toEqual({
				tile: { tilesetUid: 1, x: 0, y: 0, w: 16, h: 16 },
				tileRect: "not a tile",
				color: "#123456",
				image: "ldtk-test-tiles",
				width: 999,
				speed: 2.5,
			});
			// the entity has no tile, whatever its fields are called
			expect(odd.tile).toBeUndefined();
			expect(odd.tileSprite).toBeUndefined();
			expect(odd.source.tileRect).toBeUndefined();
			// its box is its own, not the field's
			expect(odd.width).toBe(16);
			expect(odd.source.width).toBe(16);
			// a field whose name is free is on the settings too
			expect(odd.source.speed).toBe(2.5);
			expect(odd.source.image).toBe("ldtk-test-tiles");
			expect(odd.source.tile).toEqual({
				tilesetUid: 1,
				x: 0,
				y: 0,
				w: 16,
				h: 16,
			});
			// and it is drawn without a fault
			app.viewport.moveTo(0, 0);
			expect(() => {
				return frame(app);
			}).not.toThrow();
		});

		it("is found by its name in LDtk, whatever class built it", async () => {
			// a class that does nothing with its settings
			class Coin extends Renderable {
				constructor(x: number, y: number, settings: LDtkObjectSettings) {
					super(x, y, settings.width, settings.height);
				}
			}
			registerObjectClass("Coin", Coin as never);
			await enter(app, "ents:Named");
			const coins = objectsIn(app.world, "Coin");
			expect(coins).toHaveLength(2);
			expect(
				coins.every((coin) => {
					return coin instanceof Coin;
				}),
			).toBe(true);
			expect(app.world.getChildByName("Coin")).toHaveLength(2);
			// and by its id in LDtk, which the class did not take either
			for (const placed of entitiesOf("Named")) {
				const found = app.world.getChildByProp("id", placed.iid);
				expect(found, placed.__identifier).toHaveLength(1);
				expect(found[0].name, placed.__identifier).toBe(placed.__identifier);
				expect(found[0] instanceof Coin, placed.__identifier).toBe(
					placed.__identifier === "Coin",
				);
			}
			expect(
				coins
					.map((coin) => {
						return coin.pos.x;
					})
					.sort((a, b) => {
						return a - b;
					}),
			).toEqual([64, 96]);
			expect(objectsIn(app.world)).toHaveLength(13);
		});

		it("a class of the engine the game registers itself is used, and a Sprite class is given the tile to draw", async () => {
			registerObjectClass("Trigger", Trigger as never);
			class Hero extends Sprite {
				constructor(x: number, y: number, settings: LDtkObjectSettings) {
					// the settings are a sprite's: the tileset as an atlas,
					// and the tile's region
					super(x, y, settings as never);
				}
			}
			registerObjectClass("Hero", Hero as never);
			await enter(app, "ents:Named");
			expect(objectsIn(app.world, "Trigger")[0]).toBeInstanceOf(Trigger);
			const [hero] = objectsIn(app.world, "Hero");
			expect(hero).toBeInstanceOf(Hero);
			expect([hero.width, hero.height]).toEqual([32, 16]);
			// drawn by the sprite itself, where LDtk has it
			for (const other of objectsIn(app.world)) {
				if (other !== hero) {
					other.setOpacity(0);
				}
			}
			app.viewport.moveTo(0, 0);
			const [json] = entitiesOf("Named").filter((e) => {
				return e.__identifier === "Hero";
			});
			const result = diff(
				frame(app),
				expected([json], () => {
					return "Stretch";
				}),
				tolerance,
			);
			expect(result.different, result.first).toBeLessThanOrEqual(edge);
		});
	});
}
