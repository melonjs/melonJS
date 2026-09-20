import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	Body,
	boot,
	Ellipse,
	Entity,
	loader,
	Polygon,
	Rect,
	Renderable,
	Sprite,
	Vector2d,
	video,
} from "../src/index.js";
import { jsonList } from "../src/loader/cache.js";

/**
 * Loading a physics-shape editor's export onto a body, portably (#1685).
 *
 * The format is a map of body name to a list of entries, each carrying a flat
 * vertex list plus the material it was authored with. It used to reach only
 * the builtin solver, through `Body#fromJSON`; it now arrives through
 * `bodyDef.shapes`, which every backend already consumes, resolved once in the
 * container before any adapter sees it.
 *
 * The load-bearing test in this file is the ownership one: a body takes
 * ownership of its shapes and `Body#rotate` mutates them in place, so two
 * bodies built from one definition must never share instances.
 */
describe("exported shape lists", () => {
	let app;

	// the shape a real export takes, per the project's own guide: a map of body
	// name to entries carrying a flat vertex list, the material it was authored
	// with, and Box2D's collision `filter`
	const FILE = {
		banana: [
			{
				density: 2,
				friction: 0.5,
				bounce: 0.3,
				filter: { categoryBits: 4, maskBits: 65535 },
				shape: [0, 0, 32, 0, 32, 32],
			},
		],
		pineapple: [
			{ shape: [0, 0, 20, 0, 20, 20] },
			{ shape: [20, 0, 40, 0, 40, 20] },
		],
		// a circle fixture: the editor exports these with a radius and centre
		// instead of a vertex list
		wheel: [{ radius: 12, center: { x: 16, y: 16 }, density: 1 }],
		// the other template in the wild: fixtures under a `fixtures` key, a
		// circle nested under `circle`, and polygons as point objects grouped
		// into the convex pieces a concave outline decomposed into
		cog: {
			fixtures: [
				{
					circle: { x: 8, y: 9, radius: 6 },
					density: 3,
					restitution: 0.25,
					collisionFilter: { category: 2, mask: 6 },
				},
				{
					vertices: [
						[
							{ x: 0, y: 0 },
							{ x: 10, y: 0 },
							{ x: 10, y: 10 },
						],
						[
							{ x: 10, y: 0 },
							{ x: 20, y: 0 },
							{ x: 20, y: 10 },
						],
					],
				},
			],
		},
		// a third template writes the body as one fixture directly, with its
		// outlines already decomposed and its own values beside them
		shinobi: {
			type: "fromVerts",
			label: "shinobi",
			density: 5,
			friction: 0.2,
			vertices: [
				[
					{ x: 0, y: 0 },
					{ x: 12, y: 0 },
					{ x: 12, y: 12 },
				],
				[
					{ x: 12, y: 0 },
					{ x: 24, y: 0 },
					{ x: 24, y: 12 },
				],
			],
		},
		disagreeing: [
			{ shape: [0, 0, 10, 0, 10, 10], density: 1 },
			{ shape: [0, 0, 10, 0, 10, 10], density: 9 },
		],
	};

	beforeAll(async () => {
		boot();
		app = new Application(400, 300, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		// seed the cache a preload would have filled — the file's content is
		// what matters here, not how it got there
		jsonList.shapesdef = FILE;
	});

	afterEach(() => {
		// `addChild` pushes the child before registering its body, so every
		// test that asserts a throw leaves one behind. The app is built once
		// for the file, so without this they accumulate across it.
		for (const child of app.world.getChildren().slice()) {
			app.world.removeChildNow(child);
		}
		vi.restoreAllMocks();
	});

	/**
	 * @param {object} bodyDef - the definition under test
	 * @returns {Renderable} a renderable already added to the world
	 */
	const spawn = (bodyDef) => {
		const r = new Renderable(100, 100, 32, 32);
		r.name = "probe";
		r.bodyDef = bodyDef;
		app.world.addChild(r);
		return r;
	};

	/**
	 * Spy on the adapter and hand back the definition it was given.
	 *
	 * The feature's whole claim is that resolution happens BEFORE any adapter
	 * sees the definition, so every adapter gets real shapes. Observed through
	 * `r.body` instead, that claim is untestable: the builtin is the only
	 * backend under test, and moving the resolution into it would keep every
	 * assertion green while matter and planck received a bare string.
	 * @returns {Function} call it for the definition `addBody` received
	 */
	const captureAddBody = () => {
		const spy = vi.spyOn(app.world.adapter, "addBody");
		return () => {
			expect(spy).toHaveBeenCalled();
			return spy.mock.calls.at(-1)[1];
		};
	};

	describe("a loader key naming a body in the file", () => {
		it("builds the shapes the file describes", () => {
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "banana" });
			expect(r.body.shapes).toHaveLength(1);
			const poly = r.body.shapes[0];
			expect(poly).toBeInstanceOf(Polygon);
			expect(poly.points).toHaveLength(3);
			app.world.removeChildNow(r);
		});

		it("builds every shape of a multi-shape body", () => {
			const r = spawn({
				type: "dynamic",
				shapes: "shapesdef",
				id: "pineapple",
			});
			expect(r.body.shapes).toHaveLength(2);
			app.world.removeChildNow(r);
		});

		it("puts the offset in the points, with pos at the origin", () => {
			// the representation the builtin's own setVertices produces, so a
			// body built either way holds the same thing
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "banana" });
			const poly = r.body.shapes[0];
			expect(poly.pos.x).toBe(0);
			expect(poly.pos.y).toBe(0);
			expect(
				poly.points.map((p) => {
					return [p.x, p.y];
				}),
			).toEqual([
				[0, 0],
				[32, 0],
				[32, 32],
			]);
			app.world.removeChildNow(r);
		});
	});

	describe("entries passed directly", () => {
		it("accepts the array the loader hands back", () => {
			const r = spawn({
				type: "dynamic",
				shapes: loader.getJSON("shapesdef").pineapple,
			});
			expect(r.body.shapes).toHaveLength(2);
			app.world.removeChildNow(r);
		});

		it("mixes authored shapes and imported entries in one list", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [
					new Rect(0, 0, 8, 8),
					...loader.getJSON("shapesdef").pineapple,
					new Ellipse(4, 4, 6, 6),
				],
			});
			expect(r.body.shapes).toHaveLength(4);
			app.world.removeChildNow(r);
		});
	});

	describe("plain shapes are untouched", () => {
		it("passes an ordinary shape array straight through", () => {
			const rect = new Rect(0, 0, 32, 32);
			const r = spawn({ type: "dynamic", shapes: [rect] });
			expect(r.body.shapes).toHaveLength(1);
			app.world.removeChildNow(r);
		});

		it("does not copy a definition that needs no resolution", () => {
			// the fast path: the overwhelmingly common case must not allocate.
			// Asserted on what the ADAPTER received — `r.bodyDef` is the
			// caller's literal either way, since the container resolves into a
			// local and never writes back, so reading it back proves nothing.
			const def = { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] };
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = def;
			const seen = captureAddBody();
			app.world.addChild(r);
			expect(seen()).toBe(def);
			app.world.removeChildNow(r);
		});
	});

	describe("what the adapter is handed", () => {
		it("gets real collision shapes, never the loader key", () => {
			// resolution happens in the container, before any adapter is
			// involved, which is why matter and planck needed no change
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "banana" };
			const seen = captureAddBody();
			app.world.addChild(r);
			const def = seen();
			expect(Array.isArray(def.shapes)).toBe(true);
			expect(def.shapes[0]).toBeInstanceOf(Polygon);
			app.world.removeChildNow(r);
		});

		it("gets the file's friction, which only some backends consume", () => {
			// the builtin ignores contact friction by design, so this value is
			// invisible to `r.body` — and matter and planck both read it
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "banana" };
			const seen = captureAddBody();
			app.world.addChild(r);
			expect(seen().friction).toBe(0.5);
			app.world.removeChildNow(r);
		});

		it("gets a body-level friction from the fixtures template", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "shinobi" };
			const seen = captureAddBody();
			app.world.addChild(r);
			expect(seen().friction).toBe(0.2);
			app.world.removeChildNow(r);
		});

		it("gets a body-level isSensor and bounce", () => {
			jsonList.shapesdef = {
				ghost: {
					isSensor: true,
					bounce: 0.75,
					fixtures: [{ shape: [0, 0, 8, 0, 8, 8] }],
				},
			};
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "ghost" };
			const seen = captureAddBody();
			app.world.addChild(r);
			expect(seen().isSensor).toBe(true);
			expect(seen().restitution).toBe(0.75);
			app.world.removeChildNow(r);
		});
	});

	describe("ownership", () => {
		it("gives every body its OWN shape instances", () => {
			// a body takes ownership and `Body#rotate` mutates in place, so two
			// sprites sharing one definition must not share polygons — one
			// rotating would otherwise rotate the other's hitbox
			const def = { type: "dynamic", shapes: "shapesdef", id: "banana" };
			const a = spawn(def);
			const b = spawn(def);
			expect(a.body.shapes[0]).not.toBe(b.body.shapes[0]);
			expect(a.body.shapes[0].points[1]).not.toBe(b.body.shapes[0].points[1]);

			a.body.rotate(Math.PI / 2);
			// the invariant only bites while rotation really does mutate in
			// place, so pin that it moved before pinning that b's did not
			expect(a.body.shapes[0].points[1].y).not.toBe(0);
			expect(
				b.body.shapes[0].points.map((p) => {
					return [p.x, p.y];
				}),
			).toEqual([
				[0, 0],
				[32, 0],
				[32, 32],
			]);
			app.world.removeChildNow(a);
			app.world.removeChildNow(b);
		});

		it("leaves the caller's definition unmutated", () => {
			// writing resolved shapes back would hand the SECOND body built
			// from a shared literal the first body's polygons
			const def = { type: "dynamic", shapes: "shapesdef", id: "banana" };
			spawn(def);
			expect(def.shapes).toBe("shapesdef");
		});
	});

	describe("the fixtures / point-object template", () => {
		it("reads a body written as an object holding a fixtures list", () => {
			// the material values are custom parameters the exporter template
			// declares, so the field names differ between templates; both
			// spellings land on the same body values
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "cog" });
			expect(r.body.shapes).toHaveLength(3);
			expect(r.body.mass).toBe(3);
			expect(r.body.bounce).toBe(0.25);
			app.world.removeChildNow(r);
		});

		it("builds the circle from its nested centre and radius", () => {
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "cog" });
			const ellipse = r.body.shapes[0];
			expect(ellipse).toBeInstanceOf(Ellipse);
			expect(ellipse.pos.x).toBe(8);
			expect(ellipse.pos.y).toBe(9);
			expect(ellipse.radiusV.x).toBe(6);
			app.world.removeChildNow(r);
		});

		it("yields one polygon per convex piece of a decomposed outline", () => {
			// a concave outline is exported already decomposed, so one fixture
			// carries several vertex sets
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "cog" });
			expect(r.body.shapes[1]).toBeInstanceOf(Polygon);
			expect(r.body.shapes[2]).toBeInstanceOf(Polygon);
			expect(r.body.shapes[1].points[1].x).toBe(10);
			expect(r.body.shapes[2].points[1].x).toBe(20);
			app.world.removeChildNow(r);
		});

		it("reads a single outline written directly under vertices", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [
					{
						vertices: [
							{ x: 0, y: 0 },
							{ x: 4, y: 0 },
							{ x: 4, y: 4 },
						],
					},
				],
			});
			expect(r.body.shapes).toHaveLength(1);
			expect(r.body.shapes[0].points).toHaveLength(3);
			app.world.removeChildNow(r);
		});

		it("throws on an outline of fewer than three points", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [
					{
						vertices: [
							[
								{ x: 0, y: 0 },
								{ x: 4, y: 0 },
							],
						],
					},
				],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/at least three vertices/);
		});
	});

	describe("a body written as one fixture", () => {
		it("reads its outlines and its body-level material", () => {
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "shinobi" });
			expect(r.body.shapes).toHaveLength(2);
			expect(r.body.mass).toBe(5);
			app.world.removeChildNow(r);
		});

		it("lets a fixture value state more specifically than the body", () => {
			jsonList.shapesdef = {
				mixed: {
					density: 5,
					fixtures: [{ shape: [0, 0, 8, 0, 8, 8], density: 2 }],
				},
			};
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "mixed" });
			expect(r.body.mass).toBe(2);
			app.world.removeChildNow(r);
		});

		it("still lets the definition win over both", () => {
			const r = spawn({
				type: "dynamic",
				shapes: "shapesdef",
				id: "shinobi",
				density: 1,
			});
			expect(r.body.mass).toBe(1);
			app.world.removeChildNow(r);
		});
	});

	describe("degenerate outlines", () => {
		it("throws on collinear vertices rather than letting a backend guess", () => {
			// three points in a line pass a count check and then degenerate
			// differently per backend, so the file is named instead
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [{ shape: [0, 0, 5, 5, 10, 10] }],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/encloses no area/);
		});

		it("throws on a repeated vertex outline", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [
					{
						vertices: [
							[
								{ x: 3, y: 3 },
								{ x: 3, y: 3 },
								{ x: 3, y: 3 },
							],
						],
					},
				],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/encloses no area/);
		});

		it("accepts a real triangle", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [{ shape: [0, 0, 6, 0, 0, 6] }],
			});
			expect(r.body.shapes).toHaveLength(1);
			app.world.removeChildNow(r);
		});
	});

	describe("circle fixtures", () => {
		it("builds an Ellipse from a radius and centre", () => {
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "wheel" });
			expect(r.body.shapes).toHaveLength(1);
			const ellipse = r.body.shapes[0];
			expect(ellipse).toBeInstanceOf(Ellipse);
			expect(ellipse.pos.x).toBe(16);
			expect(ellipse.pos.y).toBe(16);
			expect(ellipse.radiusV.x).toBe(12);
			expect(ellipse.radiusV.y).toBe(12);
			app.world.removeChildNow(r);
		});

		it("accepts the flatter x / y spelling for the centre", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [{ radius: 4, x: 2, y: 3 }],
			});
			expect(r.body.shapes[0].pos.x).toBe(2);
			expect(r.body.shapes[0].pos.y).toBe(3);
			app.world.removeChildNow(r);
		});

		it("throws on a radius that is not positive", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: [{ radius: 0 }] };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/radius is 0/);
		});

		it("does not mistake an authored Ellipse for an exported circle", () => {
			// `Ellipse` carries a numeric `radius` of its own, so sniffing an
			// entry on its fields alone reads a real shape as an export
			const ellipse = new Ellipse(4, 4, 8, 8);
			const r = spawn({ type: "dynamic", shapes: [ellipse] });
			expect(r.body.shapes[0]).toBe(ellipse);
			app.world.removeChildNow(r);
		});

		it("mixes circles and polygons on one body", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [
					{ shape: [0, 0, 8, 0, 8, 8] },
					{ radius: 5, center: { x: 4, y: 4 } },
				],
			});
			expect(r.body.shapes).toHaveLength(2);
			expect(r.body.shapes[1]).toBeInstanceOf(Ellipse);
			app.world.removeChildNow(r);
		});
	});

	describe("collision filtering", () => {
		it("ignores the exporting tool's filter block entirely", () => {
			// `categoryBits` / `maskBits` live in the exporting tool's number
			// space, not melonJS's. A template writes Box2D's defaults
			// (categoryBits 1, maskBits 65535) for every fixture whether or not
			// the author set anything, and 1 is PLAYER_OBJECT here — reading
			// them would silently tag an imported shape as a player and stop it
			// colliding, with no way to override it from the definition.
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "banana" });
			expect(r.body.shapes[0].collisionType).toBeUndefined();
			expect(r.body.shapes[0].collisionMask).toBeUndefined();
			app.world.removeChildNow(r);
		});

		it("ignores it in every spelling a template emits", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [
					{
						shape: [0, 0, 8, 0, 8, 8],
						filter_categoryBits: 8,
						filter_maskBits: 3,
						collisionFilter: { category: 16, mask: 7 },
					},
				],
			});
			expect(r.body.shapes[0].collisionType).toBeUndefined();
			expect(r.body.shapes[0].collisionMask).toBeUndefined();
			app.world.removeChildNow(r);
		});

		it("leaves the body's own filtering in charge of an imported shape", () => {
			// the narrowphase prefers a shape's type over its body's, so a
			// shape that acquired one from the file would override what the
			// caller asked for. Nothing is written, so the body's wins.
			const r = spawn({
				type: "dynamic",
				shapes: "shapesdef",
				id: "banana",
				collisionType: 4,
				collisionMask: 12,
			});
			expect(r.body.collisionType).toBe(4);
			expect(r.body.collisionMask).toBe(12);
			expect("collisionType" in r.body.shapes[0]).toBe(false);
			app.world.removeChildNow(r);
		});

		it("reads melonJS's own names, for a hand-written file", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [
					{ shape: [0, 0, 8, 0, 8, 8], collisionType: 2, collisionMask: 6 },
				],
			});
			expect(r.body.shapes[0].collisionType).toBe(2);
			expect(r.body.shapes[0].collisionMask).toBe(6);
			app.world.removeChildNow(r);
		});

		it("takes precedence from melonJS's names when both are present", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [
					{
						shape: [0, 0, 8, 0, 8, 8],
						collisionType: 2,
						filter: { categoryBits: 1, maskBits: 65535 },
					},
				],
			});
			expect(r.body.shapes[0].collisionType).toBe(2);
			app.world.removeChildNow(r);
		});

		it("carries isSensor onto the shape as isTrigger", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [{ shape: [0, 0, 8, 0, 8, 8], isSensor: true }],
			});
			expect(r.body.shapes[0].isTrigger).toBe(true);
			app.world.removeChildNow(r);
		});

		it("accepts isTrigger, the shape-level spelling of the same idea", () => {
			const r = spawn({
				type: "dynamic",
				shapes: [{ shape: [0, 0, 8, 0, 8, 8], isTrigger: true }],
			});
			expect(r.body.shapes[0].isTrigger).toBe(true);
			app.world.removeChildNow(r);
		});

		it("writes nothing when the entry carries neither", () => {
			// an entry with no filter must not acquire an invented one, nor an
			// explicit `undefined` that would shadow the body's own value
			const r = spawn({
				type: "dynamic",
				shapes: "shapesdef",
				id: "pineapple",
			});
			expect("collisionType" in r.body.shapes[0]).toBe(false);
			expect("collisionMask" in r.body.shapes[0]).toBe(false);
			app.world.removeChildNow(r);
		});
	});

	describe("more failure modes", () => {
		it("names a circle whose radius is spelled another way", () => {
			// recognised as a circle, so it must not fall through to the
			// vertex reader and die on an undefined dereference
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [{ circle: { x: 4, y: 4, r: 6 } }],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/circle with no numeric radius/);
		});

		it("names a body whose fixture list is empty", () => {
			jsonList.shapesdef = { hollow: { fixtures: [] } };
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "hollow" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/carries no fixtures/);
		});

		it("names an id whose value is not a fixture list", () => {
			// it IS in the file, so saying it is not would misdirect
			jsonList.shapesdef = { odd: { density: 2 } };
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "odd" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(
				/names something in 'shapesdef' that is not a list of fixtures/,
			);
		});

		it("rejects an odd-length flat coordinate list", () => {
			// a trailing lone coordinate would otherwise invent a vertex at
			// y = 0, since Vector2d defaults an absent y
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [{ shape: [0, 0, 8, 0, 8, 8, 4] }],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/even count of six or more/);
		});

		it("rejects coordinates that are not finite numbers", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [{ shape: [0, 0, "8", 0, 8, 8] }],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/not a finite number/);
		});

		it("rejects a vertices list holding something other than points", () => {
			// a flat list nested under `vertices` is a format mix-up, and
			// blaming the geometry for it sends the reader the wrong way
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [{ vertices: [[0, 0, 8, 0, 8, 8]] }],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/not an { x, y } point pair/);
		});

		it("rejects a negative radius as well as a zero one", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: [{ radius: -3 }] };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/radius is -3/);
		});

		it("does not mistake a prototype key for a loaded asset", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "constructor", id: "x" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/is not loaded/);
		});

		it("names the renderable the game gave a name to", () => {
			// the owner prefix is the half of the message that says WHERE
			const r = new Renderable(0, 0, 32, 32);
			r.name = "hotdog";
			r.bodyDef = { type: "dynamic", shapes: "missingdef", id: "x" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/Renderable 'hotdog' —/);
		});

		it("falls back to the class name when it has none", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "missingdef", id: "x" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/melonJS: Renderable —/);
		});
	});

	describe("single-body files and repeat registration", () => {
		it("reads a file that is one body's fixture list, with no id", () => {
			jsonList.solo = [{ shape: [0, 0, 12, 0, 12, 12], density: 3 }];
			const r = spawn({ type: "dynamic", shapes: "solo" });
			expect(r.body.shapes).toHaveLength(1);
			expect(r.body.mass).toBe(3);
			app.world.removeChildNow(r);
		});

		it("mints fresh shapes when a recycled renderable is re-added", () => {
			// no cache: a pooled renderable added, removed and added again must
			// not get the first body's polygons back
			const def = { type: "dynamic", shapes: "shapesdef", id: "banana" };
			const r = spawn(def);
			const first = r.body.shapes[0];
			// keepalive: the default destroys the child, and a destroyed
			// renderable cannot be re-added
			app.world.removeChildNow(r, true);
			app.world.addChild(r);
			expect(r.body.shapes[0]).not.toBe(first);
			app.world.removeChildNow(r);
		});

		it("places a circle at the origin when it carries no centre", () => {
			const r = spawn({ type: "dynamic", shapes: [{ radius: 5 }] });
			expect(r.body.shapes[0].pos.x).toBe(0);
			expect(r.body.shapes[0].pos.y).toBe(0);
			app.world.removeChildNow(r);
		});

		it("warns across the two spellings of bounce, not within one fixture", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			// one fixture carrying both is not a disagreement with itself
			spawn({
				type: "dynamic",
				shapes: [{ shape: [0, 0, 8, 0, 8, 8], bounce: 0.3, restitution: 0.3 }],
			});
			expect(warn).not.toHaveBeenCalled();
			// two fixtures that really differ do warn
			spawn({
				type: "dynamic",
				shapes: [
					{ shape: [0, 0, 8, 0, 8, 8], bounce: 0.3 },
					{ shape: [0, 0, 8, 0, 8, 8], restitution: 0.9 },
				],
			});
			expect(warn.mock.calls.join(" ")).toContain("restitution");
		});
	});

	describe("material values", () => {
		it("reduce onto the body definition", () => {
			const r = spawn({ type: "dynamic", shapes: "shapesdef", id: "banana" });
			// density -> mass and bounce -> restitution are both mapped by the
			// builtin adapter
			expect(r.body.mass).toBe(2);
			expect(r.body.bounce).toBe(0.3);
			app.world.removeChildNow(r);
		});

		it("an explicit definition value wins over the file", () => {
			const r = spawn({
				type: "dynamic",
				shapes: "shapesdef",
				id: "banana",
				restitution: 0.9,
			});
			expect(r.body.bounce).toBe(0.9);
			app.world.removeChildNow(r);
		});

		it("warn when the file disagrees with itself, and use the first", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const r = spawn({
				type: "dynamic",
				shapes: "shapesdef",
				id: "disagreeing",
			});
			expect(warn.mock.calls.join(" ")).toContain("density");
			expect(r.body.mass).toBe(1);
			app.world.removeChildNow(r);
		});
	});

	describe("failures name the asset", () => {
		it("throws when the key was never preloaded", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "nope", id: "banana" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/'nope' is not loaded/);
		});

		it("throws, listing the ids, when the id is wrong", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef", id: "bananna" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/banana, pineapple/);
		});

		it("throws when a key is given with no id", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: "shapesdef" };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/bodyDef.id must name a body/);
		});

		it("throws, naming the index, on an entry that is neither", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = {
				type: "dynamic",
				shapes: [new Rect(0, 0, 8, 8), { nonsense: true }],
			};
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/shapes\[1\]/);
		});

		it("throws, naming the count, on a malformed vertex list", () => {
			const r = new Renderable(0, 0, 32, 32);
			r.bodyDef = { type: "dynamic", shapes: [{ shape: [0, 0, 1, 1] }] };
			expect(() => {
				return app.world.addChild(r);
			}).toThrow(/4 coordinates/);
		});
	});

	describe("settings.bodyDef", () => {
		it("is honoured by the Sprite constructor", () => {
			// without this the portable path is a post-construction ritual and
			// the natural spelling silently does nothing
			const image = document.createElement("canvas");
			image.width = image.height = 8;
			const s = new Sprite(0, 0, {
				image,
				bodyDef: { type: "dynamic", shapes: "shapesdef", id: "banana" },
			});
			expect(s.bodyDef).toBeDefined();
			app.world.addChild(s);
			expect(s.body.shapes).toHaveLength(1);
			app.world.removeChildNow(s);
		});
		it("reaches the same path from an Entity's settings", () => {
			// Entity builds a default body in its constructor, so the file's
			// shapes must REPLACE that rather than join it
			vi.spyOn(console, "warn").mockImplementation(() => {});
			vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
			const e = new Entity(0, 0, {
				width: 32,
				height: 32,
				bodyDef: { type: "dynamic", shapes: "shapesdef", id: "pineapple" },
			});
			app.world.addChild(e);
			expect(e.body.shapes).toHaveLength(2);
			expect(e.body.shapes[0]).toBeInstanceOf(Polygon);
			app.world.removeChildNow(e);
		});
	});

	describe("the deprecated imperative path", () => {
		it("Body#fromJSON is still reachable after being moved out of Body", () => {
			// it lives on the prototype from `lang/deprecated.js` now, which is
			// loaded for its side effect. If that import were dropped, or its
			// order changed back, the method would simply be undefined here.
			vi.spyOn(console, "warn").mockImplementation(() => {});
			vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
			const body = new Body(new Renderable(0, 0, 32, 32), []);
			expect(typeof body.fromJSON).toBe("function");
			expect(body.fromJSON(FILE, "banana")).toBe(1);
			expect(body.shapes).toHaveLength(1);
		});

		it("Body#fromJSON warns with the name, version and replacement", () => {
			// the whole point of a deprecation is that the message says what to
			// do instead, so pin the three parts rather than the word
			// "deprecated" on its own
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const group = vi
				.spyOn(console, "groupCollapsed")
				.mockImplementation(() => {});
			const body = new Body(new Renderable(0, 0, 32, 32), []);
			body.fromJSON(FILE, "banana");

			const said = warn.mock.calls.concat(group.mock.calls).flat().join(" ");
			expect(said).toContain("is deprecated since version");
			expect(said).toContain("Body#fromJSON");
			expect(said).toContain("20.7.0");
			expect(said).toContain("renderable.bodyDef");
			expect(said).toContain("shapes: <loader key>");
			expect(said).toContain("id: <body name>");
			// and it names every backend the replacement reaches
			expect(said).toContain("builtin, matter and planck");
		});

		it("Body#fromJSON throws, listing ids, when the id is omitted", () => {
			// used to read `.length` off the map, get undefined, and add nothing
			vi.spyOn(console, "warn").mockImplementation(() => {});
			vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
			const body = new Body(new Renderable(0, 0, 32, 32), []);
			expect(() => {
				return body.fromJSON(FILE);
			}).toThrow(/banana, pineapple/);
		});

		it("new Body(r, entries) throws instead of building nothing", () => {
			// it silently produced a body with zero shapes, on the default
			// backend, for the most natural spelling
			expect(() => {
				return new Body(new Renderable(0, 0, 32, 32), FILE.banana);
			}).toThrow(/cannot take an exported shape list/);
		});

		it("new Body(r, shapes) catches an entry anywhere in the list", () => {
			// the guard used to inspect only the first element, so a real
			// shape in front of an entry let it through to a confusing throw
			expect(() => {
				return new Body(new Renderable(0, 0, 32, 32), [
					new Rect(0, 0, 8, 8),
					FILE.banana[0],
				]);
			}).toThrow(/cannot take an exported shape list/);
		});

		it("new Body(r, loaderKey) names the portable path", () => {
			// a string used to be iterated one CHARACTER at a time, each
			// reaching fromJSON and listing the character indices as body ids
			expect(() => {
				return new Body(new Renderable(0, 0, 32, 32), "shapesdef");
			}).toThrow(/cannot take a loader key/);
		});

		it("Body#addShape with one fixture says it is a fixture", () => {
			// listing its own field names as candidate body ids sends the
			// reader somewhere there is nothing to find
			vi.spyOn(console, "warn").mockImplementation(() => {});
			vi.spyOn(console, "groupCollapsed").mockImplementation(() => {});
			const body = new Body(new Renderable(0, 0, 32, 32), []);
			expect(() => {
				return body.addShape(FILE.banana[0]);
			}).toThrow(/a single exported fixture, not a list of them/);
		});

		it("Body#addShape with an exported list still works, and warns", () => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const group = vi
				.spyOn(console, "groupCollapsed")
				.mockImplementation(() => {});
			const body = new Body(new Renderable(0, 0, 32, 32), []);
			body.addShape(FILE.banana);
			expect(body.shapes).toHaveLength(1);
			expect(warn.mock.calls.concat(group.mock.calls).join(" ")).toContain(
				"deprecated",
			);
		});

		it("new Body(r, shapes) with real shapes is untouched", () => {
			const body = new Body(new Renderable(0, 0, 32, 32), [
				new Rect(0, 0, 8, 8),
				new Polygon(0, 0, [
					new Vector2d(0, 0),
					new Vector2d(4, 0),
					new Vector2d(4, 4),
				]),
			]);
			expect(body.shapes).toHaveLength(2);
		});
	});
});
