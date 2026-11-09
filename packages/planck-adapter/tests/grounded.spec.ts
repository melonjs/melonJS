/**
 * isGrounded against the contacts planck really holds.
 *
 * Bug pinned here: "grounded" meant touching any body whose centre is lower.
 * The side of a tall wall counts once the player's centre is above the
 * wall's, so a player could climb a wall with repeated jumps; a sensor (a
 * trigger zone) counted too; and ground whose body centre sits higher than
 * the player (one terrain body carrying a floor and a tall tower) did not
 * count. The rule the interface documents, and the one the builtin adapter
 * applies (only an upward push-out out of a solid body lands it), is a
 * contact whose normal points up.
 *
 * The rest are the normal cases the fix must keep working.
 */

import {
	Application,
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
import type * as planck from "planck";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PlanckAdapter } from "../src/index";

const FRAME_MS = 16.6667;

type PolygonPoints = [Vector2d, Vector2d, Vector2d, ...Vector2d[]];

const pts = (...xy: number[]): PolygonPoints => {
	const out: Vector2d[] = [];
	for (let i = 0; i < xy.length; i += 2) {
		out.push(new Vector2d(xy[i], xy[i + 1]));
	}
	return out as PolygonPoints;
};

describe("PlanckAdapter — isGrounded", () => {
	let adapter: PlanckAdapter;

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
		// default gravity, (0, 320) px/s²
		adapter = new PlanckAdapter();
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
			adapter.step(FRAME_MS);
			adapter.syncFromPhysics();
		}
	};

	// the planck body the adapter built for a renderable
	const native = (r: Renderable): planck.Body => {
		return r.body as unknown as planck.Body;
	};

	// whether planck holds a touching contact between the two renderables
	const touching = (a: Renderable, b: Renderable): boolean => {
		const other = native(b);
		for (let ce = native(a).getContactList(); ce; ce = ce.next) {
			if (ce.other === other && ce.contact.isTouching()) {
				return true;
			}
		}
		return false;
	};

	describe("the contact normal decides, not the other body's centre", () => {
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
				adapter.setVelocity(p, new Vector2d(60, v.y));
				if (touching(p, wall) && p.pos.y + 16 < 300) {
					touchedAboveCentre++;
					if (adapter.isGrounded(p)) groundedWhileTouching++;
				}
			});
			// the scenario is real: the player was against the wall
			expect(touchedAboveCentre).toBeGreaterThan(5);
			expect(groundedWhileTouching).toEqual(0);
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
			// one static terrain body: a tall tower, then a floor on its
			// left. planck places the body's origin at its first shape, so
			// the origin is above the player's centre
			const terrain = make(0, 0, 800, 600);
			adapter.addBody(terrain, {
				type: "static",
				shapes: [new Rect(400, 0, 400, 520), new Rect(0, 500, 400, 20)],
			});
			const p = addPlayer(100, 450);
			run(90);
			expect(p.pos.y).toBeGreaterThan(465);
			expect(p.pos.y).toBeLessThan(470);
			expect(touching(p, terrain)).toEqual(true);
			expect(native(terrain).getPosition().y * 32).toBeLessThan(p.pos.y + 16);
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
			run(90);
			expect(p.pos.y).toBeGreaterThan(360);
			expect(p.pos.y).toBeLessThan(370);
			expect(touching(p, ground)).toEqual(true);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("standing on the TOP of the same tall wall is grounded", () => {
			addStatic(300, 100, 64, 400);
			const p = addPlayer(316, 50);
			run(90);
			expect(p.pos.y).toBeGreaterThan(65);
			expect(p.pos.y).toBeLessThan(70);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("hitting a ceiling is not grounded", () => {
			const ceiling = addStatic(0, 100, 800, 20);
			const p = addPlayer(100, 125);
			let touched = 0;
			let grounded = 0;
			run(10, () => {
				adapter.setVelocity(p, new Vector2d(0, -120));
				if (touching(p, ceiling)) {
					touched++;
					if (adapter.isGrounded(p)) grounded++;
				}
			});
			expect(touched).toBeGreaterThan(0);
			expect(grounded).toEqual(0);
		});

		it("the floor counts when the player is also pressed against a wall", () => {
			const floor = addStatic(0, 200, 800, 20);
			const wall = addStatic(300, 0, 32, 200);
			const p = addPlayer(240, 160);
			// land first: pressed against the wall in the air, planck's
			// friction holds a body up on it
			run(60);
			run(60, () => {
				const v = adapter.getVelocity(p);
				adapter.setVelocity(p, new Vector2d(60, v.y));
			});
			expect(touching(p, wall)).toEqual(true);
			expect(touching(p, floor)).toEqual(true);
			expect(adapter.isGrounded(p)).toEqual(true);
		});
	});

	describe("normal ground stays ground", () => {
		it("a falling player is not grounded, then is once it lands", () => {
			addStatic(0, 200, 800, 20);
			const p = addPlayer(100, 100);
			run(3);
			expect(adapter.isGrounded(p)).toEqual(false);
			run(90);
			expect(adapter.isGrounded(p)).toEqual(true);
			// and a jump leaves the ground
			adapter.setVelocity(p, new Vector2d(0, -300));
			run(4);
			expect(adapter.isGrounded(p)).toEqual(false);
		});

		it("a body + feet hero standing on the floor is grounded", () => {
			addStatic(0, 200, 800, 20);
			const hero = addPlayer(100, 150, [
				new Rect(0, 0, 32, 24),
				new Rect(4, 24, 24, 8),
			]);
			run(90);
			expect(adapter.isGrounded(hero)).toEqual(true);
		});

		for (const deg of [20, 35, 45]) {
			it(`standing on a ${deg}° slope is grounded`, () => {
				// right triangle rising to the right, base on y = 400
				const len = 300;
				const rise = Math.tan((deg * Math.PI) / 180) * len;
				const slope = make(100, 400 - rise, len, rise);
				adapter.addBody(slope, {
					type: "static",
					shapes: [new Polygon(0, 0, pts(0, rise, len, 0, len, rise))],
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
				run(120, () => {
					if (adapter.isGrounded(p)) grounded++;
				});
				expect(touching(p, slope)).toEqual(true);
				expect(adapter.isGrounded(p)).toEqual(true);
				expect(grounded).toBeGreaterThan(30);
			});
		}

		it("standing on top of a dynamic box is grounded, and so is the box", () => {
			addStatic(0, 300, 800, 20);
			const box = make(90, 236, 64, 64);
			adapter.addBody(box, {
				type: "dynamic",
				shapes: [new Rect(0, 0, 64, 64)],
			});
			const p = addPlayer(106, 180);
			run(120);
			expect(touching(p, box)).toEqual(true);
			expect(adapter.isGrounded(p)).toEqual(true);
			expect(adapter.isGrounded(box)).toEqual(true);
		});

		it("riding a kinematic moving platform stays grounded", () => {
			const platform = make(50, 200, 200, 20);
			adapter.addBody(platform, {
				type: "kinematic",
				shapes: [new Rect(0, 0, 200, 20)],
			});
			const p = addPlayer(120, 150);
			run(90);
			expect(adapter.isGrounded(p)).toEqual(true);
			let lost = 0;
			// sideways and up, then sideways and down; the few frames after
			// each change of velocity are left out, the player can leave the
			// platform for a moment there
			adapter.setVelocity(platform, new Vector2d(40, -20));
			run(10);
			run(40, () => {
				if (!adapter.isGrounded(p)) lost++;
			});
			adapter.setVelocity(platform, new Vector2d(-40, 10));
			run(10);
			run(40, () => {
				if (!adapter.isGrounded(p)) lost++;
			});
			// planck lets the player lift off for a frame now and then while
			// the platform moves down (1 frame here, under either rule)
			expect(lost).toBeLessThan(3);
		});

		it("riding a teleported static platform stays grounded", () => {
			const platform = addStatic(50, 200, 200, 20);
			const p = addPlayer(120, 150);
			run(90);
			let x = 50;
			let lost = 0;
			run(60, () => {
				x += 1;
				adapter.setPosition(platform, new Vector2d(x, 200));
				if (!adapter.isGrounded(p)) lost++;
			});
			expect(lost).toBeLessThan(10);
			expect(adapter.isGrounded(p)).toEqual(true);
		});

		it("a ball (circle) resting on the floor is grounded", () => {
			addStatic(0, 200, 800, 20);
			const ball = make(100, 150, 32, 32);
			adapter.addBody(ball, {
				type: "dynamic",
				shapes: [new Ellipse(16, 16, 32, 32)],
				frictionAir: 0.5,
			});
			run(90);
			expect(adapter.isGrounded(ball)).toEqual(true);
		});

		it("standing on Tiled-style polyline ground (Line segments) is grounded", () => {
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
			run(120);
			expect(flat.pos.y).toBeGreaterThan(260);
			expect(flat.pos.y).toBeLessThan(270);
			expect(adapter.isGrounded(flat)).toEqual(true);
			expect(touching(ramp, ground)).toEqual(true);
			expect(adapter.isGrounded(ramp)).toEqual(true);
		});

		it("a player standing on a floor that sleeps stays grounded", () => {
			addStatic(0, 200, 800, 20);
			const p = addPlayer(100, 150);
			// long enough for planck to put the resting body to sleep
			run(240);
			expect(native(p).isAwake()).toEqual(false);
			expect(adapter.isGrounded(p)).toEqual(true);
		});
	});
});
