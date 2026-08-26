import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Application, boot, input, Renderable, video } from "../src/index.js";

describe("input", () => {
	let app;
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterAll(() => {
		// release the WebGL context this describe owns — browsers cap
		// live contexts, and a leak surfaces as UNRELATED specs failing
		app?.destroy();
	});

	describe("Pointer Event", () => {
		afterEach(() => {
			// clean up the game world
			app.world.reset();
			app.world.pos.set(0, 0, 0);
			app.world.broadphase.clear();
		});

		it.each([
			{
				name: "vertical world offset used by flex-height",
				worldOffset: [0, 120],
				renderablePosition: [50, 100],
				screenPosition: [70, 240],
				expectedWorldPosition: [70, 120],
			},
			{
				name: "horizontal world offset used by flex-width",
				worldOffset: [120, 0],
				renderablePosition: [100, 50],
				screenPosition: [240, 70],
				expectedWorldPosition: [120, 70],
			},
		])("should trigger pointerdown with a $name", ({
			worldOffset,
			renderablePosition,
			screenPosition,
			expectedWorldPosition,
		}) => {
			const renderable = new Renderable(
				renderablePosition[0],
				renderablePosition[1],
				40,
				40,
			);
			renderable.anchorPoint.set(0, 0);
			renderable.isKinematic = false;

			app.world.addChild(renderable);
			app.world.pos.set(worldOffset[0], worldOffset[1], 0);
			renderable.updateBounds(true);
			app.world.broadphase.clear();
			app.world.broadphase.insertContainer(app.world);

			let receivedPointer;
			input.registerPointerEvent("pointerdown", renderable, (pointer) => {
				receivedPointer = pointer;
			});

			try {
				const canvas = app.renderer.getCanvas();
				const canvasBounds = canvas.getBoundingClientRect();
				canvas.dispatchEvent(
					new PointerEvent("pointerdown", {
						clientX:
							canvasBounds.left +
							(screenPosition[0] * canvasBounds.width) / canvas.width,
						clientY:
							canvasBounds.top +
							(screenPosition[1] * canvasBounds.height) / canvas.height,
						pointerId: 1,
						width: 1,
						height: 1,
						isPrimary: true,
						bubbles: true,
					}),
				);

				expect(receivedPointer).toBeDefined();
				expect(receivedPointer.gameWorldX).toBeCloseTo(
					expectedWorldPosition[0],
				);
				expect(receivedPointer.gameWorldY).toBeCloseTo(
					expectedWorldPosition[1],
				);
			} finally {
				input.releasePointerEvent("pointerdown", renderable);
			}
		});

		it("should register and trigger a pointerdown event", () => {
			return new Promise((resolve) => {
				const renderable = new Renderable(0, 0, 100, 100);
				renderable.anchorPoint.set(0, 0);
				renderable.isKinematic = false;

				// add to game world and broadphase
				app.world.addChild(renderable);
				app.world.broadphase.clear();
				app.world.broadphase.insertContainer(app.world);

				// register the pointer event
				input.registerPointerEvent("pointerdown", renderable, (e) => {
					expect(e).toBeDefined();
					input.releasePointerEvent("pointerdown", renderable);
					resolve();
				});

				// dispatch a pointerdown event on the canvas
				const canvas = app.renderer.getCanvas();
				const event = new PointerEvent("pointerdown", {
					clientX: 10,
					clientY: 10,
					pointerId: 1,
					width: 1,
					height: 1,
					isPrimary: true,
					bubbles: true,
				});
				canvas.dispatchEvent(event);
			});
		});

		it("should not trigger when pointer is outside the region", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			renderable.anchorPoint.set(0, 0);
			renderable.isKinematic = false;

			app.world.addChild(renderable);
			app.world.broadphase.clear();
			app.world.broadphase.insertContainer(app.world);

			let triggered = false;
			input.registerPointerEvent("pointerdown", renderable, () => {
				triggered = true;
			});

			// dispatch event outside the renderable bounds
			const canvas = app.renderer.getCanvas();
			const event = new PointerEvent("pointerdown", {
				clientX: 500,
				clientY: 500,
				pointerId: 1,
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
			});
			canvas.dispatchEvent(event);

			expect(triggered).toEqual(false);
			input.releasePointerEvent("pointerdown", renderable);
		});

		it("should release a pointer event", () => {
			const renderable = new Renderable(0, 0, 100, 100);
			renderable.anchorPoint.set(0, 0);
			renderable.isKinematic = false;

			app.world.addChild(renderable);
			app.world.broadphase.clear();
			app.world.broadphase.insertContainer(app.world);

			let count = 0;
			const callback = () => {
				count++;
			};

			input.registerPointerEvent("pointerdown", renderable, callback);
			input.releasePointerEvent("pointerdown", renderable);

			const canvas = app.renderer.getCanvas();
			const event = new PointerEvent("pointerdown", {
				clientX: 10,
				clientY: 10,
				pointerId: 1,
				width: 1,
				height: 1,
				isPrimary: true,
				bubbles: true,
			});
			canvas.dispatchEvent(event);

			expect(count).toEqual(0);
		});

		it("should throw on invalid event type", () => {
			const renderable = new Renderable(0, 0, 32, 32);
			expect(() => {
				input.registerPointerEvent("invalid", renderable, () => {});
			}).toThrow("invalid event type");
		});

		it("should throw when region is undefined", () => {
			expect(() => {
				input.registerPointerEvent("pointerdown", undefined, () => {});
			}).toThrow("region");
		});
	});
});
