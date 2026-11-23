import { describe, expectTypeOf, it } from "vitest";
import {
	ColorLayer,
	type HexagonalRenderer,
	type IsometricRenderer,
	type OrthogonalRenderer,
	Renderable,
	registerObjectClass,
	registerTiledObjectClass,
	registerTiledObjectFactory,
	type StaggeredRenderer,
	type Tile,
	type TileMap,
	type TileMapRenderer,
	type TilesetGroup,
	type TMXHexagonalRenderer,
	type TMXIsometricRenderer,
	type TMXObject,
	type TMXOrthogonalRenderer,
	type TMXRenderer,
	type TMXStaggeredRenderer,
	type TMXTileMap,
	type TMXTilesetGroup,
} from "../src/index.js";

// type-level only, checked by `tsc` (pnpm test:types): the registrations sit
// in functions that are never called, so a call that stops compiling fails
// the type check without registering anything at runtime

describe("TMXObject", () => {
	it("types the object a registered class receives", () => {
		expectTypeOf<TMXObject["tile"]>().toEqualTypeOf<Tile | undefined>();
		expectTypeOf<TMXObject["gid"]>().toEqualTypeOf<number | null>();
		expectTypeOf<TMXObject["class"]>().toEqualTypeOf<string>();
		expectTypeOf<TMXObject["resolvedProperty"]>()
			.parameter(0)
			.toEqualTypeOf<string>();
		expectTypeOf<ReturnType<TMXObject["resolvedProperties"]>>().toEqualTypeOf<
			Record<string, any>
		>();
	});
});

describe("registerTiledObjectClass", () => {
	it("accepts a class taking a TMXObject", () => {
		class Chest extends Renderable {
			constructor(x: number, y: number, settings: TMXObject) {
				super(x, y, settings.width, settings.height);
			}
		}
		const register = () => {
			registerTiledObjectClass("Chest", Chest);
		};
		expectTypeOf(register).toBeFunction();
	});

	it("accepts a class whose settings extend TMXObject with custom properties", () => {
		interface DoorSettings extends TMXObject {
			facing?: "N" | "W";
		}
		class Door extends Renderable {
			constructor(x: number, y: number, settings: DoorSettings) {
				super(x, y, settings.width, settings.height);
			}
		}
		const register = () => {
			registerTiledObjectClass("Door", Door);
		};
		expectTypeOf(register).toBeFunction();
	});

	it("still accepts a class typed with its own settings, as before", () => {
		// written before TMXObject was public: it must keep compiling
		class Legacy extends Renderable {
			constructor(
				x: number,
				y: number,
				settings: { width: number; height: number; image: string },
			) {
				super(x, y, settings.width, settings.height);
			}
		}
		const register = () => {
			registerTiledObjectClass("Legacy", Legacy);
		};
		expectTypeOf(register).toBeFunction();
	});

	it("refuses what is not a class", () => {
		const register = () => {
			// @ts-expect-error a function is not a constructor
			registerTiledObjectClass("NotAClass", () => {
				return new Renderable(0, 0, 1, 1);
			});
		};
		expectTypeOf(register).toBeFunction();
	});
});

describe("registerTiledObjectFactory", () => {
	it("types an unannotated factory's arguments", () => {
		const register = () => {
			registerTiledObjectFactory("Typed", (settings, map) => {
				// (an argument typed `any` would pass any of these: say it is not)
				expectTypeOf(settings).not.toBeAny();
				expectTypeOf(map).not.toBeAny();
				expectTypeOf(settings).toEqualTypeOf<TMXObject>();
				expectTypeOf(map).toEqualTypeOf<TileMap>();
				return new Renderable(settings.x, settings.y, 1, 1);
			});
		};
		expectTypeOf(register).toBeFunction();
	});

	it("still accepts a factory typed with its own settings, as before", () => {
		const register = () => {
			registerTiledObjectFactory(
				"Spine",
				(settings: { atlasFile: string; jsonFile: string }) => {
					return new Renderable(0, 0, settings.atlasFile.length, 1);
				},
			);
		};
		expectTypeOf(register).toBeFunction();
	});
});

describe("the map renderers' older names", () => {
	it("are the same types as the new ones", () => {
		expectTypeOf<TMXTileMap>().toEqualTypeOf<TileMap>();
		expectTypeOf<TMXTilesetGroup>().toEqualTypeOf<TilesetGroup>();
		expectTypeOf<TMXRenderer>().toEqualTypeOf<TileMapRenderer>();
		expectTypeOf<TMXOrthogonalRenderer>().toEqualTypeOf<OrthogonalRenderer>();
		expectTypeOf<TMXIsometricRenderer>().toEqualTypeOf<IsometricRenderer>();
		expectTypeOf<TMXHexagonalRenderer>().toEqualTypeOf<HexagonalRenderer>();
		expectTypeOf<TMXStaggeredRenderer>().toEqualTypeOf<StaggeredRenderer>();
		// and still name what a map hands out
		expectTypeOf<ReturnType<TileMap["getRenderer"]>>().toExtend<TMXRenderer>();
	});
});

describe("ColorLayer, as a class a level names", () => {
	it("is taken by the registry, and built with an object's rectangle", () => {
		const register = () => {
			registerObjectClass("Zone", ColorLayer);
			return new ColorLayer(16, 32, { color: "#ff0000", width: 8, height: 8 });
		};
		expectTypeOf(register).returns.toEqualTypeOf<ColorLayer>();
		// and still the way it always was
		expectTypeOf(ColorLayer).toBeConstructibleWith("background", "#202020", 0);
	});
});
