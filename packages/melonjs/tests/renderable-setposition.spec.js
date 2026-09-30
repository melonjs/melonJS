import { beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Camera2d,
	Camera3d,
	ColorLayer,
	Mesh,
	Renderable,
	Sprite,
	Text,
	video,
} from "../src/index.js";

/**
 * `Renderable#setPosition(x, y, z?)`.
 *
 * `pos` holds an `ObservableVector3d`, but the geometry `Renderable` inherits
 * from declares it as a 2D vector. From TypeScript that makes `pos.set(x, y)`
 * a two-argument call that silently writes a zero z, dropping anything with a
 * depth onto the near plane. The workaround was a double cast, or assigning
 * `pos.x`, `pos.y` and `depth` by hand, which the examples do dozens of times.
 *
 * The load-bearing behaviour is the one that differs from `pos.set(x, y)`:
 * **omitting `z` must leave the depth alone**, not zero it. Every 2D caller
 * depends on that, and it is what makes the method safe to call without
 * knowing whether the thing you are moving has a depth.
 *
 * Exercised across several subclasses rather than on `Renderable` alone,
 * because the method is only useful if it survives whatever each of them does
 * to `pos` (observable callbacks, anchor handling, a camera's bounds).
 */
describe("Renderable#setPosition", () => {
	beforeAll(async () => {
		boot();
		const app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	/** one instance of each class worth checking, built without assets */
	const subjects = () => {
		return [
			["Renderable", new Renderable(0, 0, 32, 32)],
			["Camera2d", new Camera2d(0, 0, 800, 600)],
			["Camera3d", new Camera3d(0, 0, 800, 600)],
			["ColorLayer", new ColorLayer("test", "#112233")],
			[
				"Text",
				new Text(0, 0, {
					font: "Arial",
					size: 12,
					text: "x",
					fillStyle: "#fff",
				}),
			],
			[
				"Mesh",
				new Mesh(0, 0, {
					vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
					uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
					indices: new Uint32Array([0, 1, 2]),
					width: 1,
					height: 1,
				}),
			],
		];
	};

	it("writes all three components on every subclass", () => {
		for (const [name, r] of subjects()) {
			r.setPosition(10, -20, 30);
			expect(r.pos.x, `${name}.pos.x`).toBe(10);
			expect(r.pos.y, `${name}.pos.y`).toBe(-20);
			// the vector itself, not just the accessor: checking `depth`
			// alone would pass even if it were a field the position never
			// reached
			expect(r.pos.z, `${name}.pos.z`).toBe(30);
			expect(r.depth, `${name}.depth`).toBe(30);
		}
	});

	it("leaves the depth ALONE when z is omitted", () => {
		// the whole reason this method exists. `pos.set(x, y)` would zero
		// the depth here and drop a 2D sprite that sits at a depth onto the
		// near plane.
		for (const [name, r] of subjects()) {
			r.setPosition(0, 0, 42);
			r.setPosition(5, 6);
			expect(r.pos.x, `${name}.pos.x`).toBe(5);
			expect(r.pos.y, `${name}.pos.y`).toBe(6);
			expect(r.depth, `${name}.depth`).toBe(42);
		}
	});

	it("accepts an explicit zero rather than treating it as absent", () => {
		// `if (z)` instead of a type check would skip this and leave 42
		for (const [name, r] of subjects()) {
			r.setPosition(0, 0, 42);
			r.setPosition(1, 2, 0);
			expect(r.depth, `${name}.depth`).toBe(0);
		}
	});

	it("returns this, so it chains", () => {
		for (const [name, r] of subjects()) {
			expect(r.setPosition(1, 2, 3), name).toBe(r);
		}
	});

	it("flags the renderable dirty when the depth moves", () => {
		// Part of the contract callers rely on, though note it does not
		// discriminate HOW the depth is written: `pos` sets `isDirty` from
		// its own observer, so going through the accessor and assigning
		// `pos.z` behave identically here.
		const r = new Renderable(0, 0, 32, 32);
		r.setPosition(0, 0, 0);
		r.isDirty = false;
		r.setPosition(0, 0, 10);
		expect(r.isDirty).toBe(true);
	});

	it("recomputes the bounds ONCE, however many components it writes", () => {
		// `pos` is a proxied observable and every component write fires its
		// callback, which runs `updateBounds()`. Written as three assignments
		// this method cost three bounds recomputes per call, which is worse
		// than the two-line workaround it replaces and lands on per-frame
		// paths: a glTF model's world transform, a camera following a target,
		// every projected object in a 3D scene.
		const measure = (fn) => {
			const r = new Renderable(0, 0, 32, 32);
			let calls = 0;
			const real = r.updateBounds.bind(r);
			r.updateBounds = (...args) => {
				calls++;
				return real(...args);
			};
			fn(r);
			return calls;
		};
		expect(
			measure((r) => {
				r.setPosition(1, 2, 3);
			}),
		).toBe(1);
		expect(
			measure((r) => {
				r.setPosition(1, 2);
			}),
		).toBe(1);
		// the batched write it has to match, and does
		expect(
			measure((r) => {
				r.pos.set(1, 2, 3);
			}),
		).toBe(1);
	});

	it("works on a Sprite, whose pos runs through observable callbacks", () => {
		// a Sprite's pos carries an onChange that updates its bounds, so
		// this is the case where writing components individually could
		// plausibly behave differently from a bulk set
		const canvas = document.createElement("canvas");
		canvas.width = 8;
		canvas.height = 8;
		const sprite = new Sprite(0, 0, { image: canvas });
		sprite.setPosition(64, 48, 12);
		expect(sprite.pos.x).toBe(64);
		expect(sprite.pos.y).toBe(48);
		expect(sprite.depth).toBe(12);

		sprite.setPosition(1, 2);
		expect(sprite.depth).toBe(12);
	});

	it("does not clamp a camera to its bounds", () => {
		// deliberately unlike `Camera2d#moveTo`, which clamps: this is a
		// placement primitive, and a camera that silently refused to go
		// where it was put would be the more surprising of the two
		const cam = new Camera2d(0, 0, 800, 600);
		cam.setBounds(0, 0, 100, 100);
		cam.setPosition(-500, -500);
		expect(cam.pos.x).toBe(-500);
		expect(cam.pos.y).toBe(-500);
	});

	it("moves a Camera3d in depth, which pos.set cannot express", () => {
		const cam = new Camera3d(0, 0, 800, 600);
		cam.setPosition(0, 0, -300);
		expect(cam.depth).toBe(-300);
		expect(cam.pos.z).toBe(-300);
	});
});
