/**
 * isGrounded and setSensor against the contacts matter really holds.
 *
 * Bugs pinned here (each test names the one it covers):
 *
 * 1. A compound body was never grounded. matter's pairs hold the PARTS of a
 *    compound body, never the parent, and `isGrounded` compared
 *    `pair.bodyA === body`. A hero built from a body shape and a feet shape
 *    (or from a concave outline matter decomposes) could never jump.
 * 2. "Grounded" meant touching any body whose centre is lower. The side of a
 *    tall wall counts once the player's centre is above the wall's, so a
 *    player could climb a wall with repeated jumps; a sensor (a trigger
 *    zone) counted too; and ground whose centre sits higher than the player
 *    (a compound terrain body) did not count. The rule the interface
 *    documents, and the one the builtin adapter applies (only an upward
 *    push-out out of a solid body lands it), is a contact whose normal
 *    points up.
 * 3. `setSensor()` only wrote `body.isSensor`. matter copies that flag into a
 *    pair once, when the pair is created, so toggling it while two bodies
 *    already touch did nothing: a one-way platform could not be dropped
 *    through. It also never reached the parts of a compound body, which are
 *    what matter's pairs read, so neither `setSensor` nor
 *    `bodyDef.isSensor` made a multi-shape body a sensor.
 *
 * The rest are the normal cases these fixes must keep working.
 */

import type * as Matter from "matter-js";
import {
	Application,
	BuiltinAdapter,
	boot,
	Ellipse,
	Line,
	Polygon,
	Rect,
	Renderable,
	Vector2d,
	video,
	World,
} from "melonjs";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MatterAdapter } from "../src/index";

type PolygonPoints = [Vector2d, Vector2d, Vector2d, ...Vector2d[]];

const pts = (...xy: number[]): PolygonPoints => {
	const out: Vector2d[] = [];
	for (let i = 0; i < xy.length; i += 2) {
		out.push(new Vector2d(xy[i], xy[i + 1]));
	}
	return out as PolygonPoints;
};

describe("MatterAdapter — isGrounded and setSensor", () => {
	let adapter: MatterAdapter;

	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	beforeEach(() => {
		adapter = new MatterAdapter({ gravity: { x: 0, y: 1 } });
		new World(0, 0, 800, 600, adapter);
	});

	// anchor (0, 0) throughout, so `pos` is the top-left corner of the body
	const make = (x: number, y: number, w: number, h: number): Renderable => {
		const r = new Renderable(x, y, w, h);
		r.anchorPoint.set(0, 0);
		return r;
	};

	const addStatic = (
		x: number,
		y: number,
		w: number,
		h: number,
		extra: Record<string, unknown> = {},
	): Renderable => {
		const r = make(x, y, w, h);
		adapter.addBody(r, {
			type: "static",
			shapes: [new Rect(0, 0, w, h)],
			...extra,
		});
		return r;
	};

	const addPlayer = (
		x: number,
		y: number,
		shapes = [new Rect(0, 0, 32, 32)],
	): Renderable => {
		const r = make(x, y, 32, 32);
		adapter.addBody(r, { type: "dynamic", shapes, fixedRotation: true });
		return r;
	};

	const run = (n: number, each?: () => void) => {
		for (let i = 0; i < n; i++) {
			each?.();
			adapter.step(16);
		}
	};

	// the matter body the adapter built for a renderable
	const native = (r: Renderable): Matter.Body => {
		return r.body as unknown as Matter.Body;
	};

	// whether matter holds an active pair between the two renderables
	const touching = (a: Renderable, b: Renderable): boolean => {
		const ba = native(a);
		const bb = native(b);
		return adapter.engine.pairs.list.some((p: Matter.Pair) => {
			const pa = p.bodyA.parent;
			const pb = p.bodyB.parent;
			return (
				p.isActive && ((pa === ba && pb === bb) || (pa === bb && pb === ba))
			);
		});
	};

	describe("compound bodies (bug 1)", () => {
		it("a body + feet hero standing on the floor is grounded", () => {
			addStatic(0, 200, 800, 20);
			const hero = addPlayer(100, 150, [
				new Rect(0, 0, 32, 24),
				new Rect(4, 24, 24, 8),
			]);
			run(60);
			// it really is resting on the floor
			expect(hero.pos.y).toBeGreaterThan(160);
			expect(hero.pos.y).toBeLessThan(170);
			expect(adapter.isGrounded(hero)).toEqual(true);
		});

		it("a concave (decomposed) hero standing on the floor is grounded", () => {
			addStatic(0, 200, 800, 20);
			// a U shape: matter decomposes it into convex parts
			const hero = make(100, 150, 32, 32);
			adapter.addBody(hero, {
				type: "dynamic",
				shapes: [
					new Polygon(
						0,
						0,
						pts(0, 0, 8, 0, 8, 24, 24, 24, 24, 0, 32, 0, 32, 32, 0, 32),
					),
				],
				fixedRotation: true,
			});
			expect(native(hero).parts.length).toBeGreaterThan(1);
			run(60);
			expect(adapter.isGrounded(hero)).toEqual(true);
		});

		it("a compound hero in mid-air is not grounded", () => {
			const hero = addPlayer(100, 50, [
				new Rect(0, 0, 32, 24),
				new Rect(4, 24, 24, 8),
			]);
			run(5);
			expect(adapter.isGrounded(hero)).toEqual(false);
		});
	});

	describe("the contact normal decides, not the other body's centre (bug 2)", () => {
		it("touching the side of a tall wall above its centre is not grounded", () => {
			// wall 32x400, centre y = 300
			const wall = addStatic(300, 100, 32, 400);
			// player beside the wall, its centre well above the wall's
			const p = addPlayer(266, 120);
			let touchedAboveCentre = 0;
			let groundedWhileTouching = 0;
			run(20, () => {
				// keep pressing into the wall, as a player holding "right"
				const v = adapter.getVelocity(p);
				adapter.setVelocity(p, new Vector2d(2, v.y));
				if (touching(p, wall) && p.pos.y + 16 < 300) {
					touchedAboveCentre++;
					if (adapter.isGrounded(p)) groundedWhileTouching++;
				}
			});
			// the scenario is real: the player was against the wall
			expect(touchedAboveCentre).toBeGreaterThan(5);
			expect(groundedWhileTouching).toEqual(0);
		});

		it("the builtin adapter does not ground a player against a wall either", () => {
			// the reference behaviour the matter adapter matches
			const builtin = new BuiltinAdapter({ gravity: new Vector2d(0, 1) });
			const world = new World(0, 0, 800, 600, builtin);
			const wall = new Renderable(300, 100, 32, 400);
			wall.alwaysUpdate = true;
			wall.bodyDef = { type: "static", shapes: [new Rect(0, 0, 32, 400)] };
			world.addChild(wall);
			const p = new Renderable(266, 120, 32, 32);
			p.alwaysUpdate = true;
			p.bodyDef = { type: "dynamic", shapes: [new Rect(0, 0, 32, 32)] };
			world.addChild(p);
			let grounded = 0;
			for (let i = 0; i < 10; i++) {
				builtin.setVelocity(p, new Vector2d(2, builtin.getVelocity(p).y));
				world.update(16);
				if (builtin.isGrounded(p)) grounded++;
			}
			// it really did reach the wall and was stopped by it
			expect(p.pos.x).toBeLessThan(270);
			expect(p.pos.x).toBeGreaterThan(266);
			expect(grounded).toEqual(0);
		});

		it("overlapping a sensor zone whose centre is lower is not grounded", () => {
			// a trigger area the player falls through
			const zone = addStatic(0, 100, 800, 300, { isSensor: true });
			const p = addPlayer(100, 120);
			run(3);
			expect(touching(p, zone)).toEqual(true);
			expect(adapter.isGrounded(p)).toEqual(false);
		});

		it("standing on terrain whose centre is higher than the player is grounded", () => {
			// one static terrain body: a floor and a tall tower on its right,
			// the tower pulls the body's centre above the player's centre
			const terrain = make(0, 0, 800, 600);
			adapter.addBody(terrain, {
				type: "static",
				shapes: [new Rect(0, 500, 400, 20), new Rect(400, 0, 400, 520)],
			});
			const p = addPlayer(100, 450);
			run(60);
			expect(p.pos.y).toBeGreaterThan(460);
			expect(p.pos.y).toBeLessThan(470);
			expect(native(terrain).position.y).toBeLessThan(p.pos.y + 16);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("standing low on a polyline that starts high is grounded", () => {
			// a Tiled polyline: a ledge at y = 100 dropping to a floor at
			// y = 400, one static body with one Line per segment
			const ground = make(0, 0, 800, 600);
			adapter.addBody(ground, {
				type: "static",
				shapes: [
					new Line(0, 0, [new Vector2d(0, 100), new Vector2d(200, 100)]),
					new Line(0, 0, [new Vector2d(200, 100), new Vector2d(200, 400)]),
					new Line(0, 0, [new Vector2d(200, 400), new Vector2d(800, 400)]),
				],
			});
			const p = addPlayer(400, 330);
			run(60);
			expect(p.pos.y).toBeGreaterThan(360);
			expect(p.pos.y).toBeLessThan(370);
			expect(touching(p, ground)).toEqual(true);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("standing on the TOP of the same tall wall is grounded", () => {
			addStatic(300, 100, 64, 400);
			const p = addPlayer(316, 50);
			run(60);
			expect(p.pos.y).toBeGreaterThan(60);
			expect(p.pos.y).toBeLessThan(70);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("hitting a ceiling is not grounded", () => {
			addStatic(0, 100, 800, 20);
			const p = addPlayer(100, 125);
			let touched = 0;
			let grounded = 0;
			run(10, () => {
				adapter.setVelocity(p, new Vector2d(0, -3));
				if (adapter.engine.pairs.list.some((x: Matter.Pair) => x.isActive)) {
					touched++;
					if (adapter.isGrounded(p)) grounded++;
				}
			});
			expect(touched).toBeGreaterThan(0);
			expect(grounded).toEqual(0);
		});

		it("the floor counts when the player is also pressed against a wall", () => {
			addStatic(0, 200, 800, 20);
			addStatic(300, 0, 32, 200);
			const p = addPlayer(260, 160);
			run(60, () => {
				const v = adapter.getVelocity(p);
				adapter.setVelocity(p, new Vector2d(2, v.y));
			});
			expect(adapter.isGrounded(p)).toEqual(true);
		});
	});

	describe("normal ground stays ground", () => {
		it("a falling player is not grounded, then is once it lands", () => {
			addStatic(0, 200, 800, 20);
			const p = addPlayer(100, 100);
			run(3);
			expect(adapter.isGrounded(p)).toEqual(false);
			run(60);
			expect(adapter.isGrounded(p)).toEqual(true);
			// and a jump leaves the ground
			adapter.setVelocity(p, new Vector2d(0, -8));
			run(4);
			expect(adapter.isGrounded(p)).toEqual(false);
		});

		for (const deg of [20, 35, 45]) {
			it(`standing on a ${deg}° slope is grounded`, () => {
				// right triangle rising to the right, base on y = 400
				const run_ = 300;
				const rise = Math.tan((deg * Math.PI) / 180) * run_;
				const slope = make(100, 400 - rise, run_, rise);
				adapter.addBody(slope, {
					type: "static",
					shapes: [new Polygon(0, 0, pts(0, rise, run_, 0, run_, rise))],
					friction: 1,
				});
				// drop the player onto the middle of the slope
				const midY = 400 - rise / 2;
				const p = make(234, midY - 60, 32, 32);
				adapter.addBody(p, {
					type: "dynamic",
					shapes: [new Rect(0, 0, 32, 32)],
					fixedRotation: true,
					friction: 1,
				});
				let grounded = 0;
				run(90, () => {
					if (adapter.isGrounded(p)) grounded++;
				});
				expect(touching(p, slope)).toEqual(true);
				expect(adapter.isGrounded(p)).toEqual(true);
				expect(grounded).toBeGreaterThan(30);
			});
		}

		it("standing on top of a dynamic box is grounded", () => {
			addStatic(0, 300, 800, 20);
			const box = make(90, 236, 64, 64);
			adapter.addBody(box, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)],
			});
			const p = addPlayer(106, 180);
			run(90);
			expect(touching(p, box)).toEqual(true);
			expect(adapter.isGrounded(p)).toEqual(true);
			expect(adapter.isGrounded(box)).toEqual(true);
		});

		it("the box under a standing player is grounded too, the player is what is on top", () => {
			addStatic(0, 300, 800, 20);
			const box = make(90, 236, 64, 64);
			adapter.addBody(box, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)],
			});
			addPlayer(106, 180);
			run(90);
			// the box is pushed down by the player, but stands on the floor
			expect(adapter.isGrounded(box)).toEqual(true);
		});

		it("riding a moving platform stays grounded", () => {
			const platform = addStatic(50, 200, 200, 20);
			const p = addPlayer(120, 150);
			run(60);
			expect(adapter.isGrounded(p)).toEqual(true);
			let x = 50;
			let y = 200;
			let lost = 0;
			run(60, () => {
				// sideways, then up
				x += 1;
				y -= 0.5;
				adapter.setPosition(platform, new Vector2d(x, y));
				if (!adapter.isGrounded(p)) lost++;
			});
			// a teleported static body drops its pairs for a step now and
			// then; the player must be grounded on the large majority
			expect(lost).toBeLessThan(10);
			adapter.step(16);
			adapter.step(16);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("a ball (circle) resting on the floor is grounded", () => {
			addStatic(0, 200, 800, 20);
			const ball = make(100, 150, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Ellipse(16, 16, 32, 32)],
				frictionAir: 0.05,
			});
			run(60);
			expect(adapter.isGrounded(ball)).toEqual(true);
		});

		it("standing on Tiled-style polyline ground (Line segments) is grounded", () => {
			// one static body, a flat segment then a gentle ramp, as a Tiled
			// polyline arrives
			const ground = make(0, 0, 800, 600);
			adapter.addBody(ground, {
				type: "static",
				shapes: [
					new Line(0, 0, [new Vector2d(0, 300), new Vector2d(300, 300)]),
					new Line(0, 0, [new Vector2d(300, 300), new Vector2d(700, 200)]),
				],
				friction: 1,
			});
			const flat = addPlayer(100, 240);
			const ramp = make(480, 180, 32, 32);
			adapter.addBody(ramp, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 32)],
				fixedRotation: true,
				friction: 1,
			});
			run(90);
			expect(flat.pos.y).toBeGreaterThan(260);
			expect(flat.pos.y).toBeLessThan(270);
			expect(adapter.isGrounded(flat)).toEqual(true);
			expect(touching(ramp, ground)).toEqual(true);
			expect(adapter.isGrounded(ramp)).toEqual(true);
		});
	});

	describe("setSensor while touching (bug 3)", () => {
		it("a platform turned into a sensor under a standing player lets it drop through", () => {
			const platform = addStatic(0, 200, 800, 20);
			const p = addPlayer(100, 150);
			run(60);
			expect(p.pos.y).toBeLessThan(170);
			expect(touching(p, platform)).toEqual(true);
			adapter.setSensor(platform, true);
			run(60);
			expect(p.pos.y).toBeGreaterThan(220);
		});

		it("body.setSensor(true) on the platform does the same", () => {
			const platform = addStatic(0, 200, 800, 20);
			const p = addPlayer(100, 150);
			run(60);
			(platform.body as unknown as { setSensor(v?: boolean): void }).setSensor(
				true,
			);
			run(60);
			expect(p.pos.y).toBeGreaterThan(220);
		});

		it("a sensor overlapping a body that turns solid pushes it out", () => {
			// player resting inside a sensor slab: it falls through it onto
			// the floor below, still overlapping the slab
			addStatic(0, 300, 800, 20);
			const slab = addStatic(0, 260, 800, 40, { isSensor: true });
			const p = addPlayer(100, 250);
			run(60);
			expect(touching(p, slab)).toEqual(true);
			const before = p.pos.y;
			adapter.setSensor(slab, false);
			run(30);
			// the slab is solid again: the player is pushed out of it
			expect(Math.abs(p.pos.y - before)).toBeGreaterThan(4);
		});

		it("setSensor reaches every part of a compound body", () => {
			addStatic(0, 200, 800, 20);
			const hero = addPlayer(100, 150, [
				new Rect(0, 0, 32, 24),
				new Rect(4, 24, 24, 8),
			]);
			adapter.setSensor(hero, true);
			run(60);
			// a sensor falls through the floor
			expect(hero.pos.y).toBeGreaterThan(220);
		});

		it("bodyDef.isSensor makes a compound body a sensor", () => {
			addStatic(0, 200, 800, 20);
			const hero = make(100, 150, 32, 32);
			adapter.addBody(hero, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 32, 24), new Rect(4, 24, 24, 8)],
				isSensor: true,
			});
			run(60);
			expect(hero.pos.y).toBeGreaterThan(220);
		});

		it("a sensor still fires collision events after the toggle", () => {
			const platform = addStatic(0, 200, 800, 20);
			const p = addPlayer(100, 150);
			let active = 0;
			(p as unknown as { onCollisionActive: () => void }).onCollisionActive =
				() => {
					active++;
				};
			run(60);
			adapter.setSensor(platform, true);
			active = 0;
			run(2);
			expect(active).toBeGreaterThan(0);
		});

		it("toggling back to solid after the drop lands the player again", () => {
			const platform = addStatic(0, 200, 800, 20);
			addStatic(0, 400, 800, 20);
			const p = addPlayer(100, 150);
			run(60);
			adapter.setSensor(platform, true);
			run(30);
			adapter.setSensor(platform, false);
			run(60);
			// went through the platform, rests on the lower floor
			expect(p.pos.y).toBeGreaterThan(360);
			expect(p.pos.y).toBeLessThan(370);
			expect(adapter.isGrounded(p)).toEqual(true);
		});
	});
});
