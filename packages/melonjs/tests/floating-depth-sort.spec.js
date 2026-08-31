/**
 * How a `floating` child is ordered by the `"depth"` sort.
 *
 * `Container.draw` gives a floating child `resetTransform()` plus the camera's
 * screen projection, so its `pos.x/y` are pixels on the canvas — not a place in
 * the world. `_sortDepth` nevertheless fed those pixels to a world-space
 * distance and subtracted the camera position, with two visible consequences:
 *
 *   - a HUD's layering depended on where it sat on the SCREEN. A corner score
 *     at (20, 16) scored 656 and floated on top; the same text centred at
 *     (512, 200) scored 302144 and sank behind the scenery.
 *   - it drifted as the camera travelled, because of the `(z - camZ)²` term.
 *     A HUD correct at the start of a level was buried by the end of it.
 *
 * Both screen-space idioms have to survive: an OVERLAY at a negative depth
 * stays in front of the world, and a BACKDROP at a large positive depth stays
 * behind it (the Instanced Forest example parks a floating sky at z = 100000).
 * A fix that simply forces floating children to the front breaks the backdrop —
 * that mistake blanked three shipped examples, so it is pinned here too.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Renderable,
	video,
} from "../src/index.js";

describe("floating children in a depth-sorted container", () => {
	let app;
	let world;
	let camera;

	beforeAll(async () => {
		boot();
		app = new Application(1024, 576, {
			parent: "screen",
			scale: "auto",
			// no GPU needed: this exercises the comparator, not rasterization
			renderer: video.CANVAS,
			cameraClass: Camera3d,
		});
		await app.init();
		world = app.world;
		camera = app.viewport;
		world.sortOn = "depth";
		// keep the explicit depths we pass; `autoDepth` would overwrite
		// `pos.z` with the child index
		world.autoDepth = false;
	});

	afterAll(() => {
		app?.destroy();
	});

	/** a plain world-space child */
	const solid = (name, x, y, z) => {
		const r = new Renderable(x, y, 8, 8);
		r.name = name;
		r.pos.z = z;
		return r;
	};

	/** a screen-space child: `x`/`y` are canvas pixels */
	const overlay = (name, x, y, z) => {
		const r = solid(name, x, y, z);
		r.floating = true;
		return r;
	};

	/**
	 * Draw order, topmost first.
	 *
	 * `sortNow` leaves the array ascending by distance (nearest at index 0)
	 * and `draw` walks it BACKWARDS, so index 0 is drawn last — on top.
	 * `sort()` defers, which would read back in insertion order and make
	 * every assertion below vacuous.
	 */
	const order = (...children) => {
		for (const c of world.getChildren().slice()) {
			world.removeChildNow(c);
		}
		for (const c of children) {
			world.addChild(c, c.pos.z);
		}
		world.sortNow();
		return world.getChildren().map((c) => {
			return c.name;
		});
	};

	const at = (x, y, z) => {
		camera.pos.set(x, y, z);
	};

	describe("the reported bug: screen position decided the layering", () => {
		it("keeps a centred HUD on top, where a corner HUD already was", () => {
			at(0, 0, 0);
			// identical depth, different screen position. The old key gave the
			// centred one 512² + 200² = 302144 against the scene's 40000, so
			// the terrain drew straight over the game-over banner while the
			// score in the corner stayed visible.
			expect(
				order(
					solid("terrain", 0, 0, 200),
					overlay("banner", 512, 200, -150),
					overlay("score", 20, 16, -150),
				),
			).toEqual(["banner", "score", "terrain"]);
		});

		it("orders two overlays by depth alone, whatever their screen position", () => {
			at(0, 0, 0);
			// opposite corners of the screen, so under the old key the corner
			// one won regardless of depth. Only the depth counts now, and the
			// shallower one is nearer.
			expect(
				order(overlay("deep", 4, 4, -300), overlay("shallow", 1000, 560, -10)),
			).toEqual(["shallow", "deep"]);
		});
	});

	describe("an overlay stays in front of the world", () => {
		it("at the origin", () => {
			at(0, 0, 0);
			expect(
				order(solid("world", 0, 0, 300), overlay("hud", 20, 16, -150))[0],
			).toBe("hud");
		});

		it("after the camera has travelled far down the level", () => {
			// the drift: the old key grew as (z - camZ)², so a HUD that was on
			// top at the start of a run was buried by the end of it
			at(0, 0, 8000);
			expect(
				order(solid("world", 0, 0, 8300), overlay("hud", 20, 16, -150))[0],
			).toBe("hud");
		});

		it("from a camera at a large offset in x and y as well as z", () => {
			// the old key subtracted the camera position from screen pixels,
			// so a camera far off the origin in ANY axis pushed the HUD back
			at(-4000, 2500, 8000);
			expect(
				order(
					solid("world", -4000, 2500, 8300),
					overlay("hud", 20, 16, -150),
				)[0],
			).toBe("hud");
		});
	});

	describe("a backdrop stays behind the world", () => {
		it("at the origin", () => {
			at(0, 0, 0);
			const names = order(
				overlay("sky", 0, 0, 100000),
				solid("tree", 0, 0, 400),
			);
			expect(names[names.length - 1]).toBe("sky");
		});

		it("when the camera has travelled onto the backdrop's own depth", () => {
			// the case that would break a naive "measure floating from the
			// camera too" fix: the old key scored the sky at (100000-100000)² =
			// 0, the nearest thing in the world, and it covered the scene
			at(0, 0, 100000);
			const names = order(
				overlay("sky", 0, 0, 100000),
				solid("tree", 0, 0, 100400),
			);
			expect(names[names.length - 1]).toBe("sky");
		});

		it("behind a world child that is itself extremely far away", () => {
			at(0, 0, 0);
			const names = order(
				overlay("sky", 0, 0, 100000),
				solid("distant", 0, 0, 90000),
			);
			expect(names[names.length - 1]).toBe("sky");
		});
	});

	describe("it is the magnitude of the depth that places a floating child", () => {
		it("keeps a backdrop parked at a large NEGATIVE depth behind the world", () => {
			// the glTF Scene, glTF Animated Model, Billboard and Night City
			// examples all add their floating sky at z = -10000. The old key
			// squared the difference from the camera, so the sign never
			// mattered and -10000 read as "far". A key that treats a negative
			// depth as "nearest" pulls all four skies over their own scene and
			// leaves nothing but a gradient — which is exactly what happened.
			at(0, 0, 0);
			const names = order(
				overlay("sky", 0, 0, -10000),
				solid("model", 0, 0, 400),
			);
			expect(names[names.length - 1]).toBe("sky");
		});

		it("treats equal magnitudes of either sign as the same distance", () => {
			at(0, 0, 0);
			const negative = overlay("negative", 0, 0, -10000);
			const positive = overlay("positive", 700, 400, 10000);
			expect(world._sortDepth(negative, positive)).toBe(0);
		});

		it("puts a shallow overlay in front of the world and a deep one behind it", () => {
			// both negative, and only the magnitude separates them: this is
			// the afterBurner HUD (-150) and the glTF sky (-10000) in one world
			at(0, 0, 0);
			expect(
				order(
					overlay("sky", 0, 0, -10000),
					solid("model", 0, 0, 400),
					overlay("hud", 20, 16, -150),
				),
			).toEqual(["hud", "model", "sky"]);
		});
	});

	it("layers an overlay above the world above a backdrop, in one pass", () => {
		at(0, 0, 0);
		expect(
			order(
				solid("mid", 0, 0, 500),
				overlay("sky", 0, 0, 100000),
				overlay("hud", 512, 300, -150),
			),
		).toEqual(["hud", "mid", "sky"]);
	});

	describe("camera independence", () => {
		it("gives floating children the same order from every camera position", () => {
			const run = (x, y, z) => {
				at(x, y, z);
				return order(
					overlay("sky", 0, 0, 100000),
					overlay("hud", 512, 300, -150),
					overlay("subtitle", 512, 500, -50),
				);
			};
			const baseline = run(0, 0, 0);
			// ordered by |depth|: the subtitle at -50 sits in front of the HUD
			// at -150, and the sky at 100000 behind both
			expect(baseline).toEqual(["subtitle", "hud", "sky"]);
			for (const [x, y, z] of [
				[0, 0, 5000],
				[-3000, 900, 12000],
				[0, 0, 100000],
				[1e6, -1e6, -4000],
			]) {
				expect(run(x, y, z)).toEqual(baseline);
			}
		});
	});

	describe("the world path is untouched", () => {
		it("still orders world children by true distance from the camera", () => {
			at(0, 0, 0);
			expect(
				order(
					solid("far", 0, 0, 300),
					solid("near", 0, 0, 100),
					solid("mid", 0, 0, 200),
				),
			).toEqual(["near", "mid", "far"]);
		});

		it("still reorders world children as the camera moves past them", () => {
			at(0, 0, 400);
			expect(order(solid("a", 0, 0, 100), solid("b", 0, 0, 300))[0]).toBe("b");
		});

		it("still counts x and y for world children", () => {
			at(0, 0, 0);
			expect(
				order(solid("offAxis", 900, 0, 10), solid("onAxis", 0, 0, 50))[0],
			).toBe("onAxis");
		});
	});

	describe("adversarial", () => {
		it("treats a floating child at depth 0 as nearer than any world child", () => {
			at(0, 0, 0);
			expect(
				order(solid("world", 0, 0, 1), overlay("flat", 700, 400, 0))[0],
			).toBe("flat");
		});

		it("does not let a container's world offset leak into a floating key", () => {
			// a floating child is in screen space, so the ancestor offset the
			// world path applies must not apply to it
			at(0, 0, 0);
			const names = order(
				overlay("hud", 20, 16, -150),
				solid("tree", 0, 0, 400),
			);
			expect(names[0]).toBe("hud");
			world.pos.z = 7000;
			try {
				world.sortNow();
				expect(
					world.getChildren().map((c) => {
						return c.name;
					}),
				).toEqual(names);
			} finally {
				world.pos.z = 0;
			}
		});

		it("treats a child with no floating flag as a world child", () => {
			at(0, 0, 0);
			// identical coordinates, and ONLY the flag differs. The world
			// child scores 512² + 200² + 150²; the screen-space one scores
			// -(150²), so it must sort nearer.
			const plain = solid("plain", 512, 200, -150);
			const floats = overlay("floats", 512, 200, -150);
			expect(plain.floating).not.toBe(true);
			expect(world._sortDepth(plain, floats)).toBeGreaterThan(0);
		});

		it("produces a finite ordering for extreme depths", () => {
			at(0, 0, 0);
			const ref = solid("ref", 0, 0, 100);
			for (const z of [-1e7, -1, 0, 1, 1e7]) {
				expect(
					Number.isFinite(world._sortDepth(overlay("x", 0, 0, z), ref)),
				).toBe(true);
			}
		});

		it("is a consistent comparator: a<b implies b>a, and equals tie", () => {
			at(0, 0, 3000);
			const hud = overlay("hud", 20, 16, -150);
			const sky = overlay("sky", 0, 0, 100000);
			const tree = solid("tree", 0, 0, 3200);
			for (const [p, q] of [
				[hud, sky],
				[hud, tree],
				[tree, sky],
			]) {
				expect(Math.sign(world._sortDepth(p, q))).toBe(
					-Math.sign(world._sortDepth(q, p)),
				);
			}
			expect(world._sortDepth(hud, hud)).toBe(0);
		});
	});
});
