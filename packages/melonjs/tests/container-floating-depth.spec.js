/**
 * A floating child must draw on top under a `Camera3d`.
 *
 * `floating` opts a renderable out of the perspective projection — it is drawn
 * in screen space — but it was still taking part in the depth sort, which
 * orders children by distance from the camera. A HUD's `pos` is not a place in
 * the world, so that distance is meaningless: parked at a large z to mean
 * "in front", a score sorted to the FAR end of the scene and every tree in the
 * level drew over it. There is no error; the HUD is simply behind the game.
 */
import { describe, expect, it } from "vitest";
import { Container, Renderable } from "../src/index.js";

/**
 * Children are drawn back to front by walking the array in reverse, so index 0
 * is drawn LAST — that is what "on top" means here.
 * @param container - the container to inspect
 * @returns child names in draw order, first drawn first
 */
const drawOrder = (container) => {
	return container
		.getChildren()
		.map((child) => {
			return child.name;
		})
		.reverse();
};

const child = (name, z, floating = false) => {
	const renderable = new Renderable(0, 0, 10, 10);
	renderable.name = name;
	renderable.pos.z = z;
	renderable.floating = floating;
	return renderable;
};

describe("depth sort with floating children", () => {
	const build = () => {
		const world = new Container(0, 0, 800, 600);
		world.autoDepth = false;
		world.sortOn = "depth";
		return world;
	};

	it("draws a floating child last however far away its z puts it", () => {
		const world = build();
		world.addChild(child("hud", 10000, true));
		world.addChild(child("tree", 400));
		world.addChild(child("rock", 80));
		world.sortNow();

		// the HUD's z would otherwise sort it to the far end of the valley,
		// behind everything
		expect(drawOrder(world).at(-1)).toBe("hud");
	});

	it("draws it last even when its z is nearer than everything", () => {
		const world = build();
		world.addChild(child("hud", -50, true));
		world.addChild(child("tree", 400));
		world.sortNow();
		expect(drawOrder(world).at(-1)).toBe("hud");
	});

	it("keeps every floating child above every world child", () => {
		const world = build();
		world.addChild(child("hud", 10000, true));
		world.addChild(child("banner", 5, true));
		world.addChild(child("tree", 400));
		world.addChild(child("rock", 80));
		world.sortNow();

		const order = drawOrder(world);
		const lastWorld = Math.max(order.indexOf("tree"), order.indexOf("rock"));
		const firstFloating = Math.min(
			order.indexOf("hud"),
			order.indexOf("banner"),
		);
		expect(firstFloating).toBeGreaterThan(lastWorld);
	});

	it("leaves the order of non-floating children untouched", () => {
		// asserted as an invariant rather than an absolute order: the depth
		// comparator measures distance from a module-level camera cache, so
		// the concrete sequence depends on engine state a bare harness does
		// not control. What must hold is that adding a floating sibling does
		// not reshuffle the world.
		const withoutHud = build();
		for (const [name, z] of [
			["far", 900],
			["near", 100],
			["mid", 500],
		]) {
			withoutHud.addChild(child(name, z));
		}
		withoutHud.sortNow();
		const before = drawOrder(withoutHud);

		const withHud = build();
		for (const [name, z] of [
			["far", 900],
			["near", 100],
			["mid", 500],
		]) {
			withHud.addChild(child(name, z));
		}
		withHud.addChild(child("hud", 10000, true));
		withHud.sortNow();
		const after = drawOrder(withHud).filter((name) => {
			return name !== "hud";
		});

		expect(after).toEqual(before);
	});
});

describe("the 2D sorts are unaffected", () => {
	// Only `_sortDepth` changed. The z/x/y comparators are what a 2D game
	// uses, and there a floating child is ordered by z like anything else — a
	// floating backdrop at a low z belongs BEHIND the sprites. Forcing
	// floating on top in 2D would be a silent regression for every HUD-behind
	// -something layout that works today.
	const build = (sortOn) => {
		const world = new Container(0, 0, 800, 600);
		world.autoDepth = false;
		world.sortOn = sortOn;
		return world;
	};

	it("still orders a floating child by z under sortOn: z", () => {
		const world = build("z");
		world.addChild(child("backdrop", 0, true));
		world.addChild(child("sprite", 10));
		world.sortNow();

		// higher z draws later, floating or not
		expect(drawOrder(world)).toEqual(["backdrop", "sprite"]);
	});

	it("puts a high-z floating child on top under sortOn: z", () => {
		const world = build("z");
		world.addChild(child("hud", 100, true));
		world.addChild(child("sprite", 10));
		world.sortNow();
		expect(drawOrder(world)).toEqual(["sprite", "hud"]);
	});

	it("leaves sortOn: y ordering alone", () => {
		const world = build("y");
		const near = child("near", 0, true);
		near.pos.y = 500;
		const far = child("far", 0);
		far.pos.y = 100;
		world.addChild(near);
		world.addChild(far);
		world.sortNow();
		expect(drawOrder(world)).toEqual(["far", "near"]);
	});
});
