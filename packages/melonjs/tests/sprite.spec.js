import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Container, Sprite, boot, video } from "../src/index.js";

describe("Sprite", () => {
	let container;
	let sprite;

	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});

		container = new Container(50, 50, 150, 150);
		sprite = new Sprite(0, 0, {
			framewidth: 32,
			frameheight: 32,
			image: video.createCanvas(64, 64),
			anchorPoint: { x: 0, y: 0 },
		});

		// add to a parent container
		container.addChild(sprite);
	});

	afterAll(() => {
		container.removeChild(sprite);
	});

	describe("isAttachedToRoot", () => {
		it("Sprite bounds return the visible part of the sprite", async () => {
			const bounds = sprite.getBounds();
			expect(
				bounds.x === 50 &&
					bounds.y === 50 &&
					bounds.width === 32 &&
					bounds.height === 32,
			).toEqual(true);
		});

		it("Sprite bounds should be updated when the sprite is scaled", async () => {
			let bounds = sprite.getBounds();
			sprite.scale(2.0);
			expect(
				bounds.x === 50 &&
					bounds.y === 50 &&
					bounds.width === 64 &&
					bounds.height === 64,
			).toEqual(true);

			bounds = sprite.getBounds();
			// scale back to original size
			sprite.scale(0.5);
			expect(
				bounds.x === 50 &&
					bounds.y === 50 &&
					bounds.width === 32 &&
					bounds.height === 32 &&
					bounds.width === 32 &&
					bounds.height === 32,
			).toEqual(true);
		});

		it("Sprite bounds should be updated when the anchor is changed", async () => {
			let bounds = sprite.getBounds();
			sprite.anchorPoint.set(0, 1);
			expect(
				// container pos + 0, container pos - sprite size
				bounds.x === 50 + 0 && bounds.y === 50 - 32,
			).toEqual(true);

			bounds = sprite.getBounds();
			sprite.anchorPoint.set(0.5, 0.5);
			expect(
				// container pos - half sprite size, container pos - half sprite size
				bounds.x === 50 - 16 && bounds.y === 50 - 16,
			).toEqual(true);

			bounds = sprite.getBounds();
			sprite.anchorPoint.set(1, 0);
			expect(
				// container pos - sprite size, container pos + 0
				bounds.x === 50 - 32 && bounds.y === 50 + 0,
			).toEqual(true);

			bounds = sprite.getBounds();
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				bounds.x === 50 - 32 && bounds.y === 50 - 32,
			).toEqual(true);
		});

		it("Sprite addAnimation should return the correct amount of frame", async () => {
			expect(sprite.addAnimation("test", [0, 1])).toEqual(2);
			expect(sprite.addAnimation("test2", [0, 1, 0, 1, 0])).toEqual(5);
		});

		it("Sprite reverseAnimation should return the correct amount of frame", async () => {
			sprite.setCurrentAnimation("test");
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				sprite.anim["test"].frames[0].name === 0 &&
					sprite.anim["test"].frames[1].name === 1,
			).toEqual(true);

			sprite.reverseAnimation("test");
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				sprite.anim["test"].frames[0].name === 1 &&
					sprite.anim["test"].frames[1].name === 0,
			).toEqual(true);

			sprite.reverseAnimation();
			sprite.anchorPoint.set(1, 1);
			expect(
				// container pos - sprite size, container pos - sprite size
				sprite.anim["test"].frames[0].name === 0 &&
					sprite.anim["test"].frames[1].name === 1,
			).toEqual(true);
		});

		it("Sprite isCurrentAnimation allows to verify which animation is set", async () => {
			expect(sprite.addAnimation("yoyo", [1, 0, 1, 0], 60)).toEqual(4);

			sprite.setCurrentAnimation("test");
			expect(sprite.isCurrentAnimation("test")).toEqual(true);

			sprite.setCurrentAnimation("yoyo", "test");
			expect(
				sprite.isCurrentAnimation("test") === false &&
					sprite.isCurrentAnimation("yoyo") === true,
			).toEqual(true);

			for (let i = -1; i < 8; i++) {
				sprite.update(16);
			}
			expect(sprite.isCurrentAnimation("yoyo")).toEqual(true);

			for (let j = -1; j < 8; j++) {
				sprite.update(16);
			}
			expect(
				sprite.isCurrentAnimation("test") === true &&
					sprite.isCurrentAnimation("yoyo") === false,
			).toEqual(true);
		});
	});
});
