import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Container, Renderable } from "../src/index.js";

describe("Renderable", () => {
	describe("bounds updates", () => {
		let renderable;
		beforeEach(() => {
			renderable = new Renderable(50, 50, 100, 100);
			renderable.anchorPoint.set(0, 0);
		});

		it("renderable has correct bounds", () => {
			const bounds = renderable.getBounds();
			expect(bounds.x).toEqual(50);
			expect(bounds.y).toEqual(50);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("renderable has correct bounds when changing anchor point", () => {
			renderable.anchorPoint.set(0.5, 0.5);
			const bounds = renderable.getBounds();
			expect(bounds.x).toEqual(0);
			expect(bounds.y).toEqual(0);
			expect(bounds.width).toEqual(100);
			expect(bounds.height).toEqual(100);
		});

		it("setting x, y position changes bounds pos", () => {
			renderable.anchorPoint.set(0, 0);
			renderable.pos.x = 10;
			expect(renderable.getBounds().x).toEqual(10);
			renderable.pos.y = 120;
			expect(renderable.getBounds().y).toEqual(120);
		});

		it("resizing the renderable changes its bounds width", () => {
			renderable.resize(20, 20);
			expect(renderable.getBounds().width).toEqual(20);
		});

		it("resizing the renderable changes its bounds height", () => {
			renderable.resize(20, 20);
			expect(renderable.getBounds().height).toEqual(20);
		});
	});

	describe("getAbsoluteBounds returns the correct value", () => {
		let rootContainer;
		let childContainer;
		let renderable;
		beforeAll(() => {
			rootContainer = new Container(0, 0, 1000, 1000, true);
			childContainer = new Container(100, 100, 500, 500);
			renderable = new Renderable(50, 50, 50, 50);
			childContainer.anchorPoint.set(0, 0);
			renderable.anchorPoint.set(0, 0);
			childContainer.enableChildBoundsUpdate = true;
		});

		it("create and add a child container to the root container", () => {
			rootContainer.addChild(childContainer);
			expect(childContainer.isAttachedToRoot()).toEqual(true);
		});

		it("renderable should have a correct absolute position once added", () => {
			childContainer.addChild(renderable);
			expect(renderable.getBounds().x).toEqual(150);
			expect(renderable.getBounds().y).toEqual(150);
		});

		it("changing the renderable position, change the absolute pos", () => {
			renderable.pos.set(200, 100, 0);
			expect(renderable.getBounds().x).toEqual(300);
			expect(renderable.getBounds().y).toEqual(200);
		});

		it("changing the parent container position, also change the renderable absolute pos", () => {
			childContainer.shift(200, 300);
			expect(renderable.getBounds().x).toEqual(400); // 200 + 200
			expect(renderable.getBounds().y).toEqual(400); // 100 + 300
		});

		it("renderable in a floating container", () => {
			expect(renderable.isFloating).toEqual(false);
			childContainer.floating = true;
			expect(renderable.isFloating).toEqual(true);
		});

		it("floating renderable in a container", () => {
			childContainer.floating = false;
			renderable.floating = true;
			expect(renderable.isFloating).toEqual(true);
		});
	});
});
