/**
 * `Sprite#flicker`'s callback runs as a method of the sprite, after the
 * flicker has stopped.
 *
 * The callback was called as `this._flicker.callback()`, a method of the
 * internal settings object, so `this` inside a `function` callback was that
 * object and not the sprite: the TSDoc's own example,
 * `this.flicker(1000, function () { world.removeChild(this); })`, threw
 * "Child is not mine". And the flicker was stopped AFTER the callback
 * returned, so a callback that chained another flicker (blink, then blink
 * again faster) had it cancelled at once.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, Container, Sprite, video } from "../src/index.js";
import Renderer from "../src/video/renderer.js";

/** the next tick, where a deferred `removeChild` runs */
const nextTick = () => {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
};

describe("Sprite.flicker callback", () => {
	let app;

	beforeAll(async () => {
		boot();
		app = new Application(320, 240, {
			parent: "screen",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		app?.destroy();
	});

	const makeSprite = () => {
		return new Sprite(0, 0, {
			framewidth: 16,
			frameheight: 16,
			image: Renderer.createCanvas(32, 32),
		});
	};

	it("calls a function() callback with `this` set to the sprite", () => {
		const sprite = makeSprite();
		// what `this` was, on each call
		const seen = [];
		sprite.flicker(100, function () {
			seen.push(this);
		});
		sprite.update(50);
		expect(seen.length).toEqual(0);
		sprite.update(60);
		expect(seen.length).toEqual(1);
		expect(seen[0]).toBe(sprite);
		// and only once
		sprite.update(200);
		expect(seen.length).toEqual(1);
	});

	it("the flicker has stopped by the time the callback runs", () => {
		const sprite = makeSprite();
		let flickering;
		sprite.flicker(100, function () {
			flickering = this.isFlickering();
		});
		sprite.update(150);
		expect(flickering).toEqual(false);
		expect(sprite.isFlickering()).toEqual(false);
	});

	it("the TSDoc example removes the sprite from its container", async () => {
		const container = new Container(0, 0, 100, 100);
		app.world.addChild(container);
		const sprite = makeSprite();
		container.addChild(sprite);
		sprite.flicker(100, function () {
			this.ancestor.removeChild(this);
		});
		expect(() => {
			sprite.update(150);
		}).not.toThrow();
		await nextTick();
		expect(container.hasChild(sprite)).toEqual(false);
		app.world.removeChildNow(container);
	});

	it("a callback that starts a new flicker keeps it running", () => {
		const sprite = makeSprite();
		let second = 0;
		sprite.flicker(100, function () {
			this.flicker(200, () => {
				second++;
			});
		});
		sprite.update(150);
		expect(sprite.isFlickering()).toEqual(true);

		// the chained flicker runs its full course and calls its own callback
		sprite.update(150);
		expect(sprite.isFlickering()).toEqual(true);
		expect(second).toEqual(0);
		sprite.update(60);
		expect(sprite.isFlickering()).toEqual(false);
		expect(second).toEqual(1);
	});

	it("an arrow callback that chains a flicker is not cancelled when it returns", () => {
		const sprite = makeSprite();
		sprite.flicker(100, () => {
			sprite.flicker(200);
		});
		sprite.update(150);
		expect(sprite.isFlickering()).toEqual(true);
	});

	it("an arrow callback still works, and a flicker without one still ends", () => {
		const sprite = makeSprite();
		let called = false;
		sprite.flicker(100, () => {
			called = true;
		});
		sprite.update(150);
		expect(called).toEqual(true);

		sprite.flicker(100);
		sprite.update(150);
		expect(sprite.isFlickering()).toEqual(false);
	});
});
