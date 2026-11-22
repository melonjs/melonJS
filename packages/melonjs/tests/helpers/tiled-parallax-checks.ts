import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	loader,
	type Renderable,
	TMXTileMap,
	video,
} from "../../src/index.js";
import { diff, frame, HEIGHT, makeApp, WIDTH } from "./ldtk-harness.ts";
import { tilesetImage } from "./ldtk-project-builder.ts";

const BACKGROUND = "#101830";

/**
 * A Tiled tile layer's parallax factor. The engine's image layers follow
 * Tiled's factor already, so the rule a tile layer is held to is theirs: a
 * tile layer showing a picture, and an image layer of that picture with the
 * same offset and factor, are drawn on the same pixels wherever the camera
 * is.
 * @param renderer - the renderer to ask for
 * @param name - its name
 * @param tolerance - the largest difference of a channel that is not counted
 */
export function tiledParallaxChecks(
	renderer: typeof video.CANVAS | typeof video.WEBGL,
	name: string,
	tolerance: number,
) {
	describe(`a Tiled tile layer's parallax factor, on ${name}`, () => {
		let app: Application;

		beforeAll(async () => {
			app = await makeApp(renderer);
			// eight 16 px tiles, four across: the tileset's image, and the
			// picture the image layers show
			await loader.load({
				name: "ldtk-test-tiles",
				type: "image",
				src: tilesetImage(),
			});
		});

		afterAll(() => {
			app.destroy();
		});

		let serial = 0;
		// a Tiled map of 4 x 2 tiles, as Tiled saves it
		const tiledMap = (
			layers: Record<string, unknown>[],
			extra: Record<string, unknown> = {},
		) => {
			return new TMXTileMap(`parallax-map-${String(serial++)}`, {
				type: "map",
				version: "1.10",
				tiledversion: "1.10.2",
				orientation: "orthogonal",
				renderorder: "right-down",
				infinite: false,
				width: 4,
				height: 2,
				tilewidth: 16,
				tileheight: 16,
				tilesets: [
					{
						firstgid: 1,
						name: "tiles",
						image: "ldtk-test-tiles.png",
						imagewidth: 64,
						imageheight: 32,
						tilewidth: 16,
						tileheight: 16,
						tilecount: 8,
						columns: 4,
						margin: 0,
						spacing: 0,
					},
				],
				layers,
				...extra,
			});
		};

		// a tile layer holding the tileset's tiles in their order: it shows
		// the tileset's image
		const tileLayer = (extra: Record<string, unknown> = {}) => {
			return {
				type: "tilelayer",
				name: "tiles",
				width: 4,
				height: 2,
				visible: true,
				opacity: 1,
				x: 0,
				y: 0,
				data: [1, 2, 3, 4, 5, 6, 7, 8],
				...extra,
			};
		};

		// an image layer of that image
		const imageLayer = (extra: Record<string, unknown> = {}) => {
			return {
				type: "imagelayer",
				name: "picture",
				image: "ldtk-test-tiles",
				visible: true,
				opacity: 1,
				// once, as a tile layer shows it: an image layer is repeated
				// over the view unless told not to
				properties: { repeat: "no-repeat" },
				...extra,
			};
		};

		const show = (map: TMXTileMap) => {
			app.world.reset();
			app.world.pos.set(0, 0);
			app.world.backgroundColor.parseCSS(BACKGROUND);
			map.addTo(app.world, true, false);
			app.world.sortNow(true);
			app.viewport.setBounds(-4000, -4000, 8000, 8000);
		};

		const look = (x: number, y: number) => {
			app.viewport.moveTo(x, y);
			return frame(app);
		};

		// (whole pixels for every factor under test: at half a pixel an image
		// layer and a tile layer round their own way)
		const VIEWS: [number, number][] = [
			[0, 0],
			[40, 20],
			[-32, 12],
			[36, 16],
			[-120, -64],
		];

		// the frames a map gives at each view
		const frames = (map: TMXTileMap) => {
			show(map);
			return VIEWS.map(([x, y]) => {
				return look(x, y);
			});
		};

		// the tile layer in the world, and how it follows the camera
		const parallaxOf = (map: TMXTileMap) => {
			show(map);
			const [found] = app.world.getChildByName("tiles") as (Renderable & {
				parallax?: Record<string, number>;
				renderMode?: string;
			})[];
			return found;
		};

		/** what places a layer in Tiled: its offset and its parallax factor */
		interface Placing {
			offsetx?: number;
			offsety?: number;
			parallaxx?: number;
			parallaxy?: number;
		}

		// The picture where the engine's image layers put it: on the screen
		// at its offset, plus the map's parallax origin times the factor,
		// minus the camera's position times the factor.
		const painted = (
			placing: Placing,
			origin: { parallaxoriginx?: number; parallaxoriginy?: number },
			viewX: number,
			viewY: number,
		) => {
			const canvas = document.createElement("canvas");
			canvas.width = WIDTH;
			canvas.height = HEIGHT;
			const c = canvas.getContext("2d") as CanvasRenderingContext2D;
			c.fillStyle = BACKGROUND;
			c.fillRect(0, 0, WIDTH, HEIGHT);
			const factorX = placing.parallaxx ?? 1;
			const factorY = placing.parallaxy ?? 1;
			c.drawImage(
				loader.getImage("ldtk-test-tiles") as HTMLImageElement,
				Math.round(
					(placing.offsetx ?? 0) +
						factorX * (origin.parallaxoriginx ?? 0) -
						factorX * viewX,
				),
				Math.round(
					(placing.offsety ?? 0) +
						factorY * (origin.parallaxoriginy ?? 0) -
						factorY * viewY,
				),
			);
			return c.getImageData(0, 0, WIDTH, HEIGHT).data;
		};

		// A tile layer is where an image layer of the same picture, offset
		// and factor is, at every view: by the image layers' rule, painted
		// here, and against an image layer itself where one draws its
		// picture once (on WebGL it spreads the picture's edges over the
		// view, which is not this test's to tell).
		const expectAsAnImageLayer = (
			tiles: TMXTileMap,
			placing: Placing,
			what: string,
			origin: { parallaxoriginx?: number; parallaxoriginy?: number } = {},
		) => {
			const got = frames(tiles);
			for (const [i, [x, y]] of VIEWS.entries()) {
				const result = diff(got[i], painted(placing, origin, x, y), tolerance);
				expect(
					result.different,
					`${what}, from ${String(x)}, ${String(y)}: ${result.first}`,
				).toBe(0);
			}
			if (renderer === video.CANVAS) {
				const picture = frames(tiledMap([imageLayer({ ...placing })], origin));
				for (const [i, [x, y]] of VIEWS.entries()) {
					const result = diff(got[i], picture[i], tolerance);
					expect(
						result.different,
						`${what}, against an image layer, from ${String(x)}, ${String(y)}: ${result.first}`,
					).toBe(0);
				}
			}
			return got;
		};

		it("a layer with no factor, or a factor of 1, scrolls with the map", () => {
			expect(parallaxOf(tiledMap([tileLayer()])).parallax).toBeUndefined();
			expect(
				parallaxOf(tiledMap([tileLayer({ parallaxx: 1, parallaxy: 1 })]))
					.parallax,
			).toBeUndefined();
			const placing = { offsetx: 24, offsety: 16 };
			expectAsAnImageLayer(
				tiledMap([tileLayer(placing)]),
				placing,
				"no factor",
			);
		});

		it("a factor moves the layer as it moves an image layer", () => {
			const placing = {
				offsetx: 24,
				offsety: 16,
				parallaxx: 0.5,
				parallaxy: 0.25,
			};
			const moving = expectAsAnImageLayer(
				tiledMap([tileLayer(placing)]),
				placing,
				"a factor on both axes",
			);
			// and not as a layer with no factor does, once the camera moves
			const still = frames(tiledMap([tileLayer({ offsetx: 24, offsety: 16 })]));
			expect(diff(moving[0], still[0], tolerance).different).toBe(0);
			expect(diff(moving[1], still[1], tolerance).different).toBeGreaterThan(
				500,
			);
			// read from the map: the share of the camera's movement the layer
			// follows is what Tiled's factor leaves, from the camera's corner
			expect(parallaxOf(tiledMap([tileLayer(placing)])).parallax).toEqual({
				x: 0.5,
				y: 0.75,
				originX: 0,
				originY: 0,
				anchorX: 0,
				anchorY: 0,
				scale: 1,
			});
		});

		it("a factor on one axis leaves the other alone", () => {
			expectAsAnImageLayer(
				tiledMap([tileLayer({ parallaxx: 0.25 })]),
				{ parallaxx: 0.25 },
				"a factor across",
			);
			expectAsAnImageLayer(
				tiledMap([tileLayer({ parallaxy: 0 })]),
				{ parallaxy: 0 },
				"fixed to the camera, down",
			);
		});

		it("a factor above 1 moves the layer faster than the map", () => {
			const placing = { parallaxx: 1.5, parallaxy: 2 };
			expectAsAnImageLayer(
				tiledMap([tileLayer(placing)]),
				placing,
				"a foreground",
			);
		});

		it("the map's parallax origin moves the layer as it moves an image layer", () => {
			const placing = { offsetx: 8, parallaxx: 0.5, parallaxy: 0.25 };
			const origin = { parallaxoriginx: 100, parallaxoriginy: 60 };
			const withOrigin = expectAsAnImageLayer(
				tiledMap([tileLayer(placing)], origin),
				placing,
				"a parallax origin",
				origin,
			);
			// and it does move it
			const without = frames(tiledMap([tileLayer(placing)]));
			expect(
				diff(withOrigin[0], without[0], tolerance).different,
			).toBeGreaterThan(500);
		});

		it("a layer in a group follows by the group's factor times its own", () => {
			// (a map is shown once: its layers go with the world they were in)
			const grouped = () => {
				return tiledMap([
					{
						type: "group",
						name: "far",
						visible: true,
						opacity: 1,
						offsetx: 24,
						parallaxx: 0.5,
						parallaxy: 0.5,
						layers: [tileLayer({ offsety: 16, parallaxx: 0.5 })],
					},
				]);
			};
			expect(parallaxOf(grouped()).parallax).toMatchObject({ x: 0.75, y: 0.5 });
			expectAsAnImageLayer(
				grouped(),
				{ offsetx: 24, offsety: 16, parallaxx: 0.25, parallaxy: 0.5 },
				"a group's factor",
			);
		});

		it.runIf(renderer === video.WEBGL)(
			"a layer with a factor is still drawn by the GPU",
			() => {
				const found = parallaxOf(
					tiledMap([tileLayer({ parallaxx: 0.5, parallaxy: 0.5 })]),
				);
				look(40, 20);
				expect(found.renderMode).toBe("shader");
			},
		);
	});
}
