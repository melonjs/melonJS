import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	Bounds,
	boot,
	Container,
	collision,
	event,
	level,
	Rect,
	Renderable,
	video,
} from "../src/index.js";
import {
	isCollisionLayerName,
	markWorldShape,
} from "../src/level/tilemap/collision.js";
import {
	addLevelToContainer,
	populateContainer,
} from "../src/level/tilemap/populate.js";
import {
	bindViewportToLevel,
	releaseViewport,
} from "../src/level/tilemap/viewport.js";

/**
 * What every level format puts a level in the world with: the children
 * added and sorted at once, the container's own settings left as they were,
 * the viewport following the level, a collision layer told by its name and
 * its shapes made walls. A Tiled map and an LDtk level both go through it,
 * so a fault here is a fault in both; an audit found that removing most of
 * it failed no test.
 */
describe("putting a level in a container", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
			consoleHeader: false,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	const child = (name, z) => {
		const made = new Renderable(0, 0, 8, 8);
		made.name = name;
		made.pos.z = z;
		return made;
	};

	const names = (container) => {
		return container.getChildren().map((c) => {
			return c.name;
		});
	};

	describe("populateContainer", () => {
		it("leaves the children in their draw order when it returns: highest first", () => {
			const container = new Container(0, 0, 100, 100);
			populateContainer(container, () => {
				container.addChild(child("ground", 1));
				container.addChild(child("roof", 9));
				container.addChild(child("walls", 5));
			});
			// each child keeps the z it was given
			expect(
				container.getChildren().map((c) => {
					return c.pos.z;
				}),
			).toEqual([9, 5, 1]);
			expect(names(container)).toEqual(["roof", "walls", "ground"]);
		});

		it.each([
			[true, true],
			[true, false],
			[false, true],
			[false, false],
		])(
			"puts auto-sort (%s) and auto-depth (%s) back as they were",
			(sort, depth) => {
				const container = new Container(0, 0, 100, 100);
				container.autoSort = sort;
				container.autoDepth = depth;
				let during;
				populateContainer(container, () => {
					during = [container.autoSort, container.autoDepth];
					container.addChild(child("a", 3));
				});
				// both off while the children are added: each keeps its own z
				expect(during).toEqual([false, false]);
				expect([container.autoSort, container.autoDepth]).toEqual([
					sort,
					depth,
				]);
			},
		);

		it("puts them back when adding fails, and lets the error through", () => {
			const container = new Container(0, 0, 100, 100);
			container.autoSort = true;
			container.autoDepth = true;
			expect(() => {
				populateContainer(container, () => {
					container.addChild(child("a", 1));
					throw new Error("a factory failed");
				});
			}).toThrow("a factory failed");
			expect([container.autoSort, container.autoDepth]).toEqual([true, true]);
		});

		it("leaves the order of a container it holds alone, unless told to sort those too", () => {
			const build = () => {
				const container = new Container(0, 0, 100, 100);
				// the game's own, kept in an order of its own
				const hud = new Container(0, 0, 50, 50);
				hud.name = "hud";
				hud.autoSort = false;
				hud.addChild(child("low", 1), 1);
				hud.addChild(child("high", 5), 5);
				container.addChild(hud, 100);
				return { container, hud };
			};
			const kept = build();
			expect(names(kept.hud)).toEqual(["low", "high"]);
			populateContainer(kept.container, () => {
				kept.container.addChild(child("level", 2));
			});
			expect(names(kept.hud)).toEqual(["low", "high"]);
			expect(names(kept.container)).toEqual(["hud", "level"]);
			// a container the level alone fills: its groups are sorted too
			const filled = build();
			populateContainer(
				filled.container,
				() => {
					filled.container.addChild(child("level", 2));
				},
				true,
			);
			expect(names(filled.hud)).toEqual(["high", "low"]);
		});
	});

	describe("addLevelToContainer", () => {
		it("sets the background, sizes the container and sorts it and its groups", () => {
			const container = new Container(0, 0, 10, 10);
			const group = new Container(0, 0, 10, 10);
			group.pos.z = 4;
			group.addChild(child("low", 1));
			group.addChild(child("high", 5));
			const follow = addLevelToContainer(container, {
				backgroundColor: "#102030",
				add: () => {
					container.addChild(child("ground", 1));
					container.addChild(group);
					container.addChild(child("roof", 9));
				},
				width: 640,
				height: 480,
			});
			expect(container.backgroundColor.toHex()).toBe("#102030");
			expect([container.width, container.height]).toEqual([640, 480]);
			expect(
				container.getChildren().map((c) => {
					return c.pos.z;
				}),
			).toEqual([9, 4, 1]);
			expect(names(group)).toEqual(["high", "low"]);
			// no area to follow was given: the viewport is left alone
			expect(follow).toBeUndefined();
		});

		it("keeps the container's background when the level has none", () => {
			const container = new Container(0, 0, 10, 10);
			container.backgroundColor.parseCSS("#445566");
			addLevelToContainer(container, {
				add: () => {},
				width: 10,
				height: 10,
			});
			expect(container.backgroundColor.toHex()).toBe("#445566");
		});
	});

	describe("the viewport following a level", () => {
		const area = (x, y, w, h) => {
			const bounds = new Bounds();
			bounds.setMinMax(x, y, x + w, y + h);
			return bounds;
		};

		const resize = () => {
			event.emit(
				event.VIEWPORT_ONRESIZE,
				app.viewport.width,
				app.viewport.height,
			);
		};

		const viewportBounds = () => {
			const b = app.viewport.bounds;
			return [b.left, b.top, b.width, b.height];
		};

		it("takes the level's bounds, now and on a resize, and centres a level smaller than the view", () => {
			const follow = bindViewportToLevel(app.world, area(0, 0, 800, 600));
			expect(viewportBounds()).toEqual([0, 0, 800, 600]);
			expect([app.world.pos.x, app.world.pos.y]).toEqual([0, 0]);
			app.viewport.setBounds(0, 0, 10, 10);
			resize();
			expect(viewportBounds()).toEqual([0, 0, 800, 600]);
			releaseViewport(follow);
			// a level narrower than the 320 px view: centred across
			const small = bindViewportToLevel(app.world, area(0, 0, 200, 600));
			expect(app.world.pos.x).toBe(60);
			expect(viewportBounds()).toEqual([0, 0, 320, 600]);
			releaseViewport(small);
			app.world.pos.set(0, 0, app.world.pos.z);
		});

		it("follows one level at a time: the next one takes the previous one's place", () => {
			bindViewportToLevel(app.world, area(0, 0, 800, 600));
			const second = bindViewportToLevel(app.world, area(0, 0, 1600, 1200));
			expect(viewportBounds()).toEqual([0, 0, 1600, 1200]);
			// the second goes: nothing follows the viewport, the first neither
			releaseViewport(second);
			app.viewport.setBounds(0, 0, 4321, 1234);
			resize();
			expect(viewportBounds()).toEqual([0, 0, 4321, 1234]);
		});

		it("level.followViewport follows, and what it returns ends it", () => {
			const stop = level.followViewport(app.world, area(0, 0, 900, 700));
			expect(typeof stop).toBe("function");
			expect(viewportBounds()).toEqual([0, 0, 900, 700]);
			app.viewport.setBounds(0, 0, 10, 10);
			resize();
			expect(viewportBounds()).toEqual([0, 0, 900, 700]);
			stop();
			app.viewport.setBounds(0, 0, 4321, 1234);
			resize();
			expect(viewportBounds()).toEqual([0, 0, 4321, 1234]);
		});
	});

	describe("a level's collision layer", () => {
		it("is told by its name: it contains 'collision', in any case", () => {
			for (const name of ["collision", "Collisions", "world COLLISION 2"]) {
				expect(isCollisionLayerName(name), name).toBe(true);
			}
			for (const name of ["walls", "colision", ""]) {
				expect(isCollisionLayerName(name), name).toBe(false);
			}
		});

		it("makes an object a static wall of the world: by its body definition, or by its body", () => {
			const declared = new Renderable(0, 0, 8, 8);
			declared.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 8, 8)],
				collisionType: collision.types.ENEMY_OBJECT,
			};
			markWorldShape(declared);
			expect(declared.bodyDef.type).toBe("static");
			expect(declared.bodyDef.collisionType).toBe(collision.types.WORLD_SHAPE);
			// an object that carries a body made by hand
			const legacy = {
				body: { collisionType: collision.types.ENEMY_OBJECT, isStatic: false },
			};
			markWorldShape(legacy);
			expect(legacy.body.isStatic).toBe(true);
			expect(legacy.body.collisionType).toBe(collision.types.WORLD_SHAPE);
			// one with neither is left alone
			const plain = {};
			markWorldShape(plain);
			expect(plain).toEqual({});
		});
	});
});
