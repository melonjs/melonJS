import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Container, Renderable } from "../src/index.js";

describe("Container", () => {
	let container;

	beforeEach(() => {
		container = new Container(0, 0, 100, 100, true);
	});

	describe("isAttachedToRoot", () => {
		let secondContainer;
		beforeAll(() => {
			secondContainer = new Container(0, 0, 100, 100);
		});

		it("should return true", () => {
			expect(container.isAttachedToRoot()).toEqual(true);
		});

		it("a new container should not be root", () => {
			expect(secondContainer.isAttachedToRoot()).toEqual(false);
		});

		it("a new container when attached to game world should find root", () => {
			container.addChild(secondContainer);
			expect(secondContainer.isAttachedToRoot()).toEqual(true);
		});
	});

	describe("object absolute position in containers", () => {
		it("should return 50,50 for renderable container", () => {
			const renderable = new Renderable(50, 50, 100, 100);

			expect(container.getAbsolutePosition().x).toEqual(0);
			expect(container.getAbsolutePosition().y).toEqual(0);

			container.addChild(renderable);

			expect(renderable.getAbsolutePosition().x).toEqual(50);
			expect(renderable.getAbsolutePosition().y).toEqual(50);
		});

		it("should return proper position and bounds for object in nested containers", () => {
			const secondContainer = new Container(10, 10, 100, 100);
			const thirdContainer = new Container(10, 10, 100, 100);
			const renderable = new Renderable(50, 50, 100, 100);

			// enable child bounds update
			secondContainer.enableChildBoundsUpdate = true;
			thirdContainer.enableChildBoundsUpdate = true;

			container.addChild(secondContainer);
			secondContainer.addChild(thirdContainer);
			thirdContainer.addChild(renderable);

			const absPos = renderable.getAbsolutePosition();
			expect(absPos.x).toEqual(70);
			expect(absPos.y).toEqual(70);

			const bounds = renderable.getBounds();
			// 20 because default anchor point is (0.5, 0.5)
			expect(bounds.x).toEqual(20);
			expect(bounds.y).toEqual(20);
		});
	});

	describe("Container bounds test", () => {
		it("Container bounds return default assigned size", () => {
			const bounds = container.getBounds();
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("Container bounds return the union of all child bounds if enabled", () => {
			container.enableChildBoundsUpdate = true;
			container.addChild(new Renderable(50, 50, 100, 100));
			container.addChild(new Renderable(100, 100, 100, 100));

			const bounds = container.getBounds();
			expect(bounds.x).toEqual(0); // because of default 0.5 anchor point
			expect(bounds.y).toEqual(0); // because of default 0.5 anchor point
			expect(bounds.width).toEqual(150); // because of default 0.5 anchor point
			expect(bounds.height).toEqual(150); // because of default 0.5 anchor point
		});
	});

	describe("Container utility function", () => {
		it("forEach iterate through all children", () => {
			let counter = 0;
			container.addChild(new Renderable(50, 50, 100, 100));
			container.addChild(new Renderable(100, 100, 100, 100));
			container.forEach((child) => {
				if (child.ancestor === container) {
					counter++;
				}
			});
			expect(counter).toEqual(2);
		});
		it("onChildChange callback", () => {
			let counter = 0;
			container.onChildChange = function () {
				// just count how many times this one is called
				counter++;
			};
			container.addChild(new Renderable(50, 50, 100, 100));
			container.addChild(new Renderable(100, 100, 100, 100));
			container.removeChildNow(container.getChildAt(0));
			expect(counter).toEqual(3);
		});
	});
});
