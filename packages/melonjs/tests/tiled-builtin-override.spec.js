import { describe, expect, it } from "vitest";
import {
	boot,
	Renderable,
	registerTiledObjectClass,
	Trigger,
} from "../src/index.js";
import { createTMXObject } from "../src/level/tiled/TMXObjectFactory.js";

/**
 * A game's own class must beat the built-in of the same name.
 *
 * This needs a spec file of its own: the factory registry initialises LAZILY,
 * on the first `createTMXObject`, and the thing under test is what happens
 * when a game registers BEFORE that. Any spec that has already built a Tiled
 * object has passed the moment this is about, and would instead exercise the
 * documented post-init conflict throw.
 */
describe("a game's class beats the built-in of the same name", () => {
	const tmxObject = (cls) => {
		return createTMXObject(
			{ name: "o", class: cls, x: 0, y: 0, width: 8, height: 8, z: 0 },
			{ tilewidth: 32, tileheight: 32 },
		);
	};

	it("REGRESSION: the registration is not silently discarded at first load", () => {
		// Built-ins are queued at boot and flushed on the first map load,
		// while this call registers immediately. The built-in therefore
		// landed second and replaced the game's class, with no error at the
		// call and none at load: the map just produced the wrong type.
		boot();
		class MyTrigger extends Trigger {}
		registerTiledObjectClass("Trigger", MyTrigger);

		// the flush happens inside this call
		const obj = tmxObject("Trigger");
		expect(obj).toBeInstanceOf(MyTrigger);
	});

	it("a built-in still answers a name the game has not claimed", () => {
		// the other half of "defaults": they must still be there
		const obj = tmxObject("Renderable");
		expect(obj.constructor.name).toEqual("Renderable");
	});

	it("REGRESSION: the `me.` alias of a built-in still resolves", () => {
		// the 1.x spelling, which the engine has always answered to. It used
		// to arrive by side effect: `pool.register` registered a Tiled
		// factory for the prefixed name as well, and the built-ins went
		// through that call. Dropping those registrations turned every `me.X`
		// object into a plain `Renderable`, with nothing said.
		expect(tmxObject("me.Renderable").constructor.name).toEqual("Renderable");
		// and the alias is not collateral damage when the game claims the
		// unprefixed name, as it did in the first test here
		expect(tmxObject("me.Trigger").constructor.name).toEqual("Trigger");
	});

	it("a game can take a built-in name over after the first map load too", () => {
		// a `Stage` registering its classes in `onResetEvent`, with an
		// earlier level already loaded, arrives here. A built-in is a
		// default, so this has to win rather than throw.
		class MyRenderable extends Renderable {}
		registerTiledObjectClass("Renderable", MyRenderable);
		expect(tmxObject("Renderable")).toBeInstanceOf(MyRenderable);
	});

	it("two classes of the game's own for one name is still an error", () => {
		class A extends Renderable {}
		class B extends Renderable {}
		registerTiledObjectClass("Hazard", A);
		expect(() => {
			registerTiledObjectClass("Hazard", B);
		}).toThrow("a different class is already registered");
	});
});
