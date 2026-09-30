import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera3d,
	Container,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * Adversarial cases for `setBasis`, `lookAt(target, up)`, `setPosition` and
 * `Camera3d#reset` — inputs a game will eventually produce by accident and
 * that the happy-path specs do not reach.
 *
 * The bar for each: either the result is correct, or it fails LOUDLY. The
 * outcome worth hunting is the third one, where a camera silently ends up
 * pointing somewhere plausible-looking and nothing says why.
 */
describe("Camera3d orientation — adversarial", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	const cam = () => {
		return new Camera3d(0, 0, 800, 600);
	};
	const fwd = (c) => {
		const f = new Vector3d();
		c.getForward(f);
		return f;
	};

	describe("setBasis with degenerate magnitudes", () => {
		it("resolves a direction whose square overflows", () => {
			// |v|^2 is Infinity for components past ~1e154, so a length taken
			// in the input's own scale divides every component to zero. That
			// yields pitch 0 / yaw 0 with no error at all: the camera quietly
			// looks down +Z, which is the worst of the three outcomes.
			// Aimed straight up on purpose, so the broken answer cannot be
			// mistaken for the right one.
			const c = cam();
			c.setBasis(
				new Vector3d(1e200, 0, 0),
				new Vector3d(0, 0, 1e200),
				new Vector3d(0, -1e200, 0),
			);
			expect(c.pitch).toBeCloseTo(Math.PI / 2, 6);
			expect(fwd(c).y).toBeCloseTo(-1, 6);
		});

		it("accepts finite components whose sum is not finite", () => {
			// checking `Number.isFinite(x + y + z)` conflates an infinite
			// component with three finite ones that overflow when added
			const c = cam();
			c.setBasis(
				new Vector3d(0, 0, -1),
				new Vector3d(-1e308, 1e308, 0),
				new Vector3d(1e308, 1e308, 0),
			);
			const f = fwd(c);
			expect(f.x).toBeCloseTo(Math.SQRT1_2, 5);
			expect(f.y).toBeCloseTo(Math.SQRT1_2, 5);
		});

		it("keeps a huge basis pointing where it was aimed", () => {
			// not just finite: the DIRECTION has to survive the scale
			const c = cam();
			c.setBasis(
				new Vector3d(0, 0, -1e180),
				new Vector3d(0, 1e180, 0),
				new Vector3d(1e180, 0, 0),
			);
			const f = fwd(c);
			expect(f.x).toBeCloseTo(1, 5);
			expect(f.y).toBeCloseTo(0, 5);
			expect(f.z).toBeCloseTo(0, 5);
		});

		it("accepts a legitimately tiny direction", () => {
			// magnitude is meaningless for a direction, so a normalised axis
			// scaled down is still a perfectly good basis
			const c = cam();
			c.setBasis(
				new Vector3d(1e-10, 0, 0),
				new Vector3d(0, 1e-10, 0),
				new Vector3d(0, 0, 1e-10),
			);
			expect(fwd(c).z).toBeCloseTo(1, 6);
		});

		it("accepts a direction right down at the denormal floor", () => {
			// 1e-200 squared is 0, so a length taken in the input's own scale
			// is zero for a vector with no zero component, and the guard
			// cannot tell it from the origin
			const c = cam();
			c.setBasis(
				new Vector3d(1e-200, 0, 0),
				new Vector3d(0, 0, 1e-200),
				new Vector3d(0, -1e-200, 0),
			);
			expect(c.pitch).toBeCloseTo(Math.PI / 2, 6);
		});
	});

	describe("setBasis with malformed frames", () => {
		it("rejects a basis whose axes are all the same vector", () => {
			// right == up == forward determines no rotation about the view
			// axis, and nothing sane can be recovered for the other two
			const c = cam();
			c.roll = 0.3;
			const v = new Vector3d(0, 0, 1);
			c.setBasis(v, v, v);
			// forward still honoured, roll left alone rather than invented
			expect(fwd(c).z).toBeCloseTo(1, 6);
			expect(c.roll).toBe(0.3);
		});

		it("handles a mirrored (left-handed) frame without producing NaN", () => {
			// a cross product taken in the wrong order gives a basis with a
			// negative determinant. The camera stores angles, so it cannot
			// represent a mirror: it must pick a rotation, not break.
			const c = cam();
			c.setBasis(
				new Vector3d(-1, 0, 0),
				new Vector3d(0, 1, 0),
				new Vector3d(0, 0, 1),
			);
			expect(Number.isFinite(c.pitch)).toBe(true);
			expect(Number.isFinite(c.yaw)).toBe(true);
			expect(Number.isFinite(c.roll)).toBe(true);
			expect(fwd(c).z).toBeCloseTo(1, 6);
		});

		it("tolerates the same vector object passed for two arguments", () => {
			// aliasing is easy to do by accident with pooled vectors, and it
			// must not corrupt the caller's data or the result
			const c = cam();
			const shared = new Vector3d(0, 1, 0);
			const forward = new Vector3d(0, 0, 1);
			c.setBasis(shared, shared, forward);
			expect(shared.x).toBe(0);
			expect(shared.y).toBe(1);
			expect(shared.z).toBe(0);
			expect(fwd(c).z).toBeCloseTo(1, 6);
		});

		it("still recovers roll from a right axis at an extreme scale", () => {
			// up parallel to forward hands the decision to `right`, and that
			// path has to be as scale-safe as the forward one: against a fixed
			// epsilon a tiny right is called degenerate and the roll is
			// silently left at whatever it was
			const c = cam();
			c.roll = 0.42;
			c.setBasis(
				new Vector3d(1e-14, 0, 0),
				new Vector3d(0, 0, 1),
				new Vector3d(0, 0, 1),
			);
			// right along +X with forward along +Z is the zero-roll frame
			expect(c.roll).toBeCloseTo(0, 6);
		});

		it("rejects an infinite component rather than deriving from it", () => {
			const c = cam();
			expect(() => {
				c.setBasis(
					new Vector3d(1, 0, 0),
					new Vector3d(0, 1, 0),
					new Vector3d(Number.POSITIVE_INFINITY, 0, 0),
				);
			}).toThrow(/finite/);
		});

		it("leaves the camera untouched when it throws", () => {
			// a rejected call must not half-apply: pitch written, then the
			// throw, would leave a camera in a state nobody asked for
			const c = cam();
			c.pitch = 0.25;
			c.yaw = 0.5;
			c.roll = 0.75;
			expect(() => {
				c.setBasis(
					new Vector3d(1, 0, 0),
					new Vector3d(0, 1, 0),
					new Vector3d(0, 0, 0),
				);
			}).toThrow();
			expect(c.pitch).toBe(0.25);
			expect(c.yaw).toBe(0.5);
			expect(c.roll).toBe(0.75);
		});
	});

	describe("lookAt with hostile arguments", () => {
		it("does not produce NaN when the target IS the camera", () => {
			// zero direction: nothing is determined, and a NaN angle would
			// blank the whole view
			const c = cam();
			c.setPosition(10, 20, 30);
			c.pitch = 0.4;
			c.yaw = 0.5;
			c.lookAt(10, 20, 30);
			expect(Number.isFinite(c.pitch)).toBe(true);
			expect(Number.isFinite(c.yaw)).toBe(true);
		});

		it("still pitches at a target far enough to overflow the horizontal run", () => {
			// sqrt(dx*dx + dz*dz) is Infinity here, and atan2(-dy, Infinity)
			// is zero: the camera levels off instead of looking at the target
			const c = cam();
			c.setPosition(0, 0, 0);
			c.lookAt(1e200, -1e200, 1e200);
			// up and out at 45 degrees horizontally: pitch is atan(1/sqrt(2))
			expect(c.pitch).toBeCloseTo(Math.atan2(1, Math.SQRT2), 6);
			expect(c.yaw).toBeCloseTo(Math.PI / 4, 6);
		});

		it("ignores a zero up rather than rolling to zero", () => {
			const c = cam();
			c.setPosition(0, 0, 0);
			c.roll = 0.9;
			c.lookAt(0, 0, 100, new Vector3d(0, 0, 0));
			expect(c.roll).toBe(0.9);
		});

		it("ignores a NaN up rather than poisoning the roll", () => {
			const c = cam();
			c.setPosition(0, 0, 0);
			c.roll = 0.9;
			c.lookAt(0, 0, 100, new Vector3d(Number.NaN, 0, 0));
			expect(c.roll).toBe(0.9);
		});

		it("keeps the roll from an up far below the epsilon", () => {
			// a fixed epsilon on the projection calls this degenerate and
			// drops the roll silently, leaving whatever was there before
			const c = cam();
			c.setPosition(0, 0, 0);
			c.roll = 0.9;
			c.lookAt(0, 0, 100, new Vector3d(1e-12, 0, 0));
			expect(c.roll).toBeCloseTo(Math.PI / 2, 6);
		});

		it("is unaffected by the magnitude of up", () => {
			// only the direction matters, so a huge or tiny up must give the
			// same roll as a unit one
			const c1 = cam();
			const c2 = cam();
			const c3 = cam();
			for (const c of [c1, c2, c3]) {
				c.setPosition(0, 0, 0);
			}
			c1.lookAt(0, 0, 100, new Vector3d(1, 0, 0));
			c2.lookAt(0, 0, 100, new Vector3d(1e200, 0, 0));
			c3.lookAt(0, 0, 100, new Vector3d(1e-200, 0, 0));
			expect(c2.roll).toBeCloseTo(c1.roll, 9);
			expect(c3.roll).toBeCloseTo(c1.roll, 9);
		});

		it("does not mistake a Vector3d target for an up vector", () => {
			// the object overload takes `up` second; passing only a target
			// must not read it as the up
			const c = cam();
			c.setPosition(0, 0, 0);
			c.roll = 0.6;
			c.lookAt(new Vector3d(0, 0, 100));
			expect(c.roll).toBe(0.6);
		});

		it("treats a renderable target's pos, not the renderable itself", () => {
			const c = cam();
			c.setPosition(0, 0, 0);
			const target = new Renderable(0, 0, 8, 8);
			target.setPosition(0, 0, 100);
			c.lookAt(target, new Vector3d(1, 0, 0));
			expect(c.yaw).toBeCloseTo(0, 6);
			expect(c.roll).toBeCloseTo(Math.PI / 2, 6);
		});
	});

	describe("setPosition with hostile arguments", () => {
		it("does not silently swallow a NaN coordinate", () => {
			// documenting what happens today: NaN propagates into pos. If
			// this ever becomes a guard, this test is the place to say so.
			const r = new Renderable(0, 0, 8, 8);
			r.setPosition(Number.NaN, 0, 0);
			expect(Number.isNaN(r.pos.x)).toBe(true);
		});

		it("treats a NaN z as a number, since typeof NaN is number", () => {
			const r = new Renderable(0, 0, 8, 8);
			r.setPosition(0, 0, 5);
			r.setPosition(1, 2, Number.NaN);
			expect(Number.isNaN(r.depth)).toBe(true);
		});

		it("puts a camera's z into the projection, not just the field", () => {
			// the whole point of routing z through `depth`: the view matrix
			// reads `this.depth`, so a z that only landed on some other field
			// would leave the camera rendering from where it used to be
			const c = cam();
			const point = new Vector3d(50, 0, 0);
			c.setPosition(0, 0, -300);
			const near = c.worldToScreen(point);
			c.setPosition(0, 0, -600);
			const far = c.worldToScreen(point);
			const centre = 800 / 2;
			// twice as far away, so half the offset from screen centre
			expect(near.x - centre).toBeCloseTo((far.x - centre) * 2, 4);
		});

		it("ignores a non-numeric z instead of coercing it", () => {
			// `undefined` is the documented absence; anything else that is
			// not a number must not be coerced into a depth of 0 or NaN
			const r = new Renderable(0, 0, 8, 8);
			r.setPosition(0, 0, 7);
			r.setPosition(1, 2, null);
			expect(r.depth).toBe(7);
		});
	});

	describe("round-tripping a basis through the camera", () => {
		const basis = (c) => {
			const r = new Vector3d();
			const u = new Vector3d();
			const f = new Vector3d();
			c.getBasis(r, u, f);
			return [r, u, f];
		};
		/** largest component-wise difference between two vectors */
		const delta = (a, b) => {
			return Math.max(
				Math.abs(a.x - b.x),
				Math.abs(a.y - b.y),
				Math.abs(a.z - b.z),
			);
		};

		it("takes its own getBasis output back as a no-op", () => {
			// read the basis, write it back: what a game does to nudge one
			// axis, and it has to come out where it went in. Note this does
			// NOT prove the two calls keep their scratch vectors apart —
			// pointing `setBasis`'s scratch at `getBasis`'s passes, because
			// `setBasis` never calls the accessors that use the other pair.
			const c = cam();
			c.pitch = 0.37;
			c.yaw = 1.13;
			c.roll = -0.61;
			const [r, u, f] = basis(c);
			c.setBasis(r, u, f);
			expect(c.pitch).toBeCloseTo(0.37, 6);
			expect(c.yaw).toBeCloseTo(1.13, 6);
			expect(c.roll).toBeCloseTo(-0.61, 6);
		});

		it("does not accumulate drift over a thousand round trips", () => {
			// the transform is a Float32Array, so each trip costs up to an
			// ulp. What matters is that the error does NOT compound: a single
			// ulp is ~6e-8, so linear accumulation over 1000 trips would be
			// ~6e-5 and blow the bound below.
			const c = cam();
			c.pitch = 0.37;
			c.yaw = 1.13;
			c.roll = -0.61;
			const [r0, u0, f0] = basis(c);
			for (let i = 0; i < 1000; i++) {
				const [r, u, f] = basis(c);
				c.setBasis(r, u, f);
			}
			const [r, u, f] = basis(c);
			expect(delta(r, r0)).toBeLessThan(1e-6);
			expect(delta(u, u0)).toBeLessThan(1e-6);
			expect(delta(f, f0)).toBeLessThan(1e-6);
		});

		it("returns an orthonormal frame even from a sheared one", () => {
			// hand-built bases drift out of square. The camera stores three
			// angles, so it cannot hold a sheared frame even if it wanted to,
			// and what comes back out has to be clean.
			const c = cam();
			c.setBasis(
				new Vector3d(1, 0.2, 0),
				new Vector3d(-0.1, 1, 0.3),
				new Vector3d(0.05, 0, 1),
			);
			const [r, u, f] = basis(c);
			expect(r.length()).toBeCloseTo(1, 6);
			expect(u.length()).toBeCloseTo(1, 6);
			expect(f.length()).toBeCloseTo(1, 6);
			expect(r.dot(u)).toBeCloseTo(0, 6);
			expect(r.dot(f)).toBeCloseTo(0, 6);
			expect(u.dot(f)).toBeCloseTo(0, 6);
		});

		it("preserves the frame, not the angles, past the pole", () => {
			// `asin` only returns [-pi/2, pi/2], so a pitch set past the pole
			// by hand comes back as the mirrored triple. That is not a loss:
			// the two triples name the SAME frame, which is what the round
			// trip promises.
			const c = cam();
			c.pitch = 2;
			c.yaw = 0.5;
			c.roll = 0.25;
			const [r0, u0, f0] = basis(c);
			c.setBasis(r0.clone(), u0.clone(), f0.clone());
			const [r, u, f] = basis(c);
			expect(delta(r, r0)).toBeLessThan(1e-6);
			expect(delta(u, u0)).toBeLessThan(1e-6);
			expect(delta(f, f0)).toBeLessThan(1e-6);
			// the mirrored triple, spelled out so the mapping is on record
			expect(c.pitch).toBeCloseTo(Math.PI - 2, 6);
			expect(c.yaw).toBeCloseTo(0.5 - Math.PI, 6);
			expect(c.roll).toBeCloseTo(0.25 - Math.PI, 6);
		});
	});

	describe("reset under adversarial state", () => {
		it("clears an orientation that only setBasis could have produced", () => {
			const c = cam();
			c.setBasis(
				new Vector3d(0, 0, -1),
				new Vector3d(1, 0, 0),
				new Vector3d(0, -1, 0),
			);
			c.reset();
			expect(c.pitch).toBe(0);
			expect(c.yaw).toBe(0);
			expect(c.roll).toBe(0);
		});

		it("is idempotent", () => {
			const c = cam();
			c.setPosition(5, 6, 7);
			c.pitch = 1;
			c.reset();
			c.reset();
			expect(c.pitch).toBe(0);
			expect(c.depth).toBe(0);
		});

		it("survives a NaN orientation", () => {
			// however a NaN got in, reset is the way out
			const c = cam();
			c.pitch = Number.NaN;
			c.yaw = Number.NaN;
			c.reset();
			expect(c.pitch).toBe(0);
			expect(c.yaw).toBe(0);
		});

		it("stops following a target", () => {
			// inherited from Camera2d, and the reason the override has to call
			// super: a reset camera that still had a target would be dragged
			// straight back on the next update
			const c = cam();
			const target = new Renderable(0, 0, 8, 8);
			c.follow(target);
			expect(c.target).not.toBe(null);
			c.reset();
			expect(c.target).toBe(null);
		});

		it("leaves the lens alone", () => {
			// fov, near and far are configuration, not state: a reset that
			// reached them would silently undo the camera's setup
			const c = cam();
			c.fov = 1.1;
			c.near = 5;
			c.far = 900;
			c.reset();
			expect(c.fov).toBeCloseTo(1.1, 6);
			expect(c.near).toBe(5);
			expect(c.far).toBe(900);
		});

		it("leaves the bounds alone", () => {
			const c = cam();
			c.setBounds(0, 0, 4000, 3000);
			c.reset();
			expect(c.bounds.width).toBe(4000);
			expect(c.bounds.height).toBe(3000);
		});
	});

	describe("setPosition against a sorting container", () => {
		/** let the deferred sort that addChild queues actually run */
		const flushSort = () => {
			return new Promise((resolve) => {
				setTimeout(resolve, 0);
			});
		};

		it("does not re-sort the container when the depth changes", async () => {
			// The trap that comes with making depth easy to set. `setPosition`
			// writes through the same accessor as `child.depth = n`, and
			// neither tells the ancestor its order is stale, so a container
			// keeps drawing in the order it last sorted. Call `sort()` after
			// moving something in depth, or pass the depth to `addChild`.
			const container = new Container(0, 0, 800, 600);
			container.autoSort = true;
			const lower = new Renderable(0, 0, 8, 8);
			const higher = new Renderable(0, 0, 8, 8);
			container.addChild(lower, 1);
			container.addChild(higher, 2);
			await flushSort();
			// the default comparator sorts on z, descending
			expect(container.getChildren()[0]).toBe(higher);

			lower.setPosition(0, 0, 99);
			// nothing queued, so the container keeps the order it last sorted
			// even though `lower` now has the highest z of the two
			expect(container.pendingSort).toBe(null);
			expect(container.getChildren()[0]).toBe(higher);

			// and this is the remedy
			container.sort();
			await flushSort();
			expect(container.getChildren()[0]).toBe(lower);
		});

		it("moves a container without touching what is inside it", async () => {
			// children are positioned relative to their container, so moving
			// the container must leave their own pos where it was
			const container = new Container(0, 0, 800, 600);
			const child = new Renderable(10, 20, 8, 8);
			container.addChild(child, 3);
			await flushSort();

			container.setPosition(100, 200, 5);
			expect(container.pos.x).toBe(100);
			expect(container.depth).toBe(5);
			expect(child.pos.x).toBe(10);
			expect(child.pos.y).toBe(20);
			expect(child.depth).toBe(3);
		});
	});
});
