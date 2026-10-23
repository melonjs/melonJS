import { describe, expectTypeOf, it } from "vitest";
import {
	Renderable,
	registerTiledObjectClass,
	registerTiledObjectFactory,
	type Tile,
	type TMXObject,
	type TMXTileMap,
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
				expectTypeOf(settings).toEqualTypeOf<TMXObject>();
				expectTypeOf(map).toEqualTypeOf<TMXTileMap>();
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
