import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	boot,
	Container,
	Matrix3d,
	Renderable,
	Vector3d,
	video,
} from "../src/index.js";

/**
 * Every renderable draws from the settings its parent left on the renderer,
 * never from what the one drawn before it changed.
 *
 * `preDraw()` saves the renderer's color, tint, opacity and transform, and
 * `postDraw()` copies them back. These cases draw a renderable that changes
 * all of them the ways games do (a tinted, faded card turned in 3D, whose
 * `draw()` sets its own color and opacity and transforms the renderer) between
 * two plain ones, then check that the second plain one sees exactly what the
 * first one saw, every number of it. The card's last transform has all
 * sixteen entries set, and the case checks that the card really changed every
 * value, so a copy that misses one of them cannot go unseen.
 */
describe("a renderable leaves the renderer as it found it", () => {
	let app;
	let order;

	beforeAll(async () => {
		boot();
		app = new Application(200, 150, {
			parent: "screen",
			renderer: video.WEBGL,
			scale: "1.0",
			failIfMajorPerformanceCaveat: false,
		});
		await app.init();
	});
	afterEach(() => {
		app.world.reset();
	});
	afterAll(() => {
		return app?.destroy();
	});

	/** everything the renderer would hand the next draw, copied out */
	const settings = (renderer) => {
		return {
			transform: Array.from(renderer.currentTransform.val),
			color: Array.from(renderer.getColor().toArray()),
			tint: Array.from(renderer.currentTint.toArray()),
			alpha: renderer.globalAlpha(),
		};
	};

	/** draws nothing, records what it was given */
	class Probe extends Renderable {
		constructor(name) {
			super(20, 20, 16, 16);
			this.name = name;
			this.seen = null;
		}
		draw(renderer) {
			order.push(this.name);
			this.seen = settings(renderer);
		}
	}

	// every entry set, the perspective row included
	const everyEntry = new Matrix3d(
		1.1,
		0.2,
		0.3,
		0.004,
		0.5,
		1.2,
		0.6,
		0.007,
		0.8,
		0.9,
		1.3,
		0.01,
		4,
		5,
		6,
		1.02,
	);

	/** a tinted, faded card, turned around its vertical axis */
	class Card extends Renderable {
		constructor() {
			super(60, 40, 20, 30);
			this.tint.setColor(200, 64, 32);
			this.alpha = 0.5;
			this.rotate(0.6, new Vector3d(0, 1, 0));
			this.leftBehind = null;
		}
		draw(renderer) {
			order.push("card");
			renderer.setColor("rgba(10, 200, 90, 0.25)");
			renderer.fillRect(0, 0, this.width, this.height);
			renderer.setGlobalAlpha(0.2);
			renderer.translate(5, 7);
			renderer.rotate(0.3);
			renderer.scale(2, 3);
			renderer.transform(everyEntry);
			this.leftBehind = settings(renderer);
		}
	}

	// one game frame: the children in depth order, updated, then drawn
	const frame = () => {
		order = [];
		app.world.sortNow(true);
		app.world.update(16);
		app.repaint();
		app.draw();
	};

	// the card changed each number, or a missed copy of it could not show
	const expectChangedEverything = (card, before) => {
		for (const key of ["transform", "color", "tint"]) {
			card[key].forEach((value, i) => {
				expect(value, `${key}[${i}]`).not.toBe(before[key][i]);
			});
		}
		expect(card.alpha).not.toBe(before.alpha);
	};

	it("the sprite drawn after the card sees what the one before it saw", () => {
		const before = new Probe("before");
		const card = new Card();
		const after = new Probe("after");
		app.world.addChild(before, 1);
		app.world.addChild(card, 2);
		app.world.addChild(after, 3);

		frame();

		expect(order).toEqual(["before", "card", "after"]);
		expectChangedEverything(card.leftBehind, before.seen);
		expect(after.seen).toEqual(before.seen);
	});

	it("inside a faded, tinted group, and after it", () => {
		const group = new Container(10, 10, 150, 100);
		group.alpha = 0.6;
		group.tint.setColor(128, 255, 200);
		const first = new Probe("first");
		const card = new Card();
		const second = new Probe("second");
		group.addChild(first, 1);
		group.addChild(card, 2);
		group.addChild(second, 3);
		const outside = new Probe("outside before");
		const outsideAfter = new Probe("outside after");
		app.world.addChild(outside, 1);
		app.world.addChild(group, 2);
		app.world.addChild(outsideAfter, 3);

		frame();

		expect(order).toEqual([
			"outside before",
			"first",
			"card",
			"second",
			"outside after",
		]);
		expectChangedEverything(card.leftBehind, first.seen);
		expect(second.seen).toEqual(first.seen);
		expect(outsideAfter.seen).toEqual(outside.seen);
	});

	it("frame after frame, the same settings every time", () => {
		const before = new Probe("before");
		const card = new Card();
		const after = new Probe("after");
		app.world.addChild(before, 1);
		app.world.addChild(card, 2);
		app.world.addChild(after, 3);

		frame();
		const first = before.seen;
		for (let n = 0; n < 10; n++) {
			card.rotate(0.1, new Vector3d(0, 1, 0));
			frame();
			expect(before.seen).toEqual(first);
			expect(after.seen).toEqual(first);
		}
	});
});
