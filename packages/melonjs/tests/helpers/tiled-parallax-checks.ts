import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type Application,
	loader,
	type Renderable,
	TMXTileMap,
	video,
} from "../../src/index.js";
import { diff, frame, makeApp } from "./ldtk-harness.ts";
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

		const VIEWS: [number, number][] = [
			[0, 0],
			[40, 20],
			[-30, 10],
			[37, 13],
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

		// a tile layer and an image layer with the same settings are drawn
		// alike at every view
		const expectAlike = (
			tiles: TMXTileMap,
			picture: TMXTileMap,
			what: string,
		) => {
			const a = frames(tiles);
			const b = frames(picture);
			for (const [i, [x, y]] of VIEWS.entries()) {
				const result = diff(a[i], b[i], tolerance);
				expect(
					result.different,
					`${what}, from ${String(x)}, ${String(y)}: ${result.first}`,
				).toBe(0);
			}
			return a;
		};

		it("a layer with no factor, or a factor of 1, scrolls with the map", () => {
			expect(parallaxOf(tiledMap([tileLayer()])).parallax).toBeUndefined();
			expect(
				parallaxOf(tiledMap([tileLayer({ parallaxx: 1, parallaxy: 1 })]))
					.parallax,
			).toBeUndefined();
			expectAlike(
				tiledMap([tileLayer({ offsetx: 24, offsety: 16 })]),
				tiledMap([imageLayer({ offsetx: 24, offsety: 16 })]),
				"no factor",
			);
		});

		it("a factor moves the layer as it moves an image layer", () => {
			const settings = {
				offsetx: 24,
				offsety: 16,
				parallaxx: 0.5,
				parallaxy: 0.25,
			};
			const moving = expectAlike(
				tiledMap([tileLayer(settings)]),
				tiledMap([imageLayer(settings)]),
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
			expect(parallaxOf(tiledMap([tileLayer(settings)])).parallax).toEqual({
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
			expectAlike(
				tiledMap([tileLayer({ parallaxx: 0.25 })]),
				tiledMap([imageLayer({ parallaxx: 0.25 })]),
				"a factor across",
			);
			expectAlike(
				tiledMap([tileLayer({ parallaxy: 0 })]),
				tiledMap([imageLayer({ parallaxy: 0 })]),
				"fixed to the camera, down",
			);
		});

		it("a factor above 1 moves the layer faster than the map", () => {
			expectAlike(
				tiledMap([tileLayer({ parallaxx: 1.5, parallaxy: 2 })]),
				tiledMap([imageLayer({ parallaxx: 1.5, parallaxy: 2 })]),
				"a foreground",
			);
		});

		it("the map's parallax origin moves the layer as it moves an image layer", () => {
			const settings = { offsetx: 8, parallaxx: 0.5, parallaxy: 0.25 };
			const origin = { parallaxoriginx: 100, parallaxoriginy: 60 };
			const withOrigin = expectAlike(
				tiledMap([tileLayer(settings)], origin),
				tiledMap([imageLayer(settings)], origin),
				"a parallax origin",
			);
			// and it does move it
			const without = frames(tiledMap([tileLayer(settings)]));
			expect(
				diff(withOrigin[0], without[0], tolerance).different,
			).toBeGreaterThan(500);
		});

		it("a layer in a group follows by the group's factor times its own", () => {
			const grouped = tiledMap([
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
			expect(parallaxOf(grouped).parallax).toMatchObject({ x: 0.75, y: 0.5 });
			expectAlike(
				grouped,
				tiledMap([
					imageLayer({
						offsetx: 24,
						offsety: 16,
						parallaxx: 0.25,
						parallaxy: 0.5,
					}),
				]),
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
