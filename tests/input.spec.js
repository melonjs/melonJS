import { beforeAll, describe, expect, it } from "vitest";
import { Renderable, game, input, video } from "../src/index.js";

describe("input", () => {
	let renderable;
	let evenType;
	beforeAll(() => {
		renderable = new Renderable(0, 0, 32, 32);
		renderable.isKinematic = false;
	});

	describe("Pointer Event", () => {
		// skipping this one for now as it needs total rewrite to work with Puppeteer
		it.skip("PointerDown event triggering", (done) => {
			// Add renderable to the world
			game.world.addChild(renderable);

			// clear the quadtree
			game.world.broadphase.clear();

			// insert the world container (children) into the quadtree
			game.world.broadphase.insertContainer(game.world);

			// register on pointer down
			input.registerPointerEvent("pointerdown", renderable, () => {
				// Cleanup
				input.releasePointerEvent("pointerdown", renderable);
				game.world.removeChildNow(renderable);
				game.world.broadphase.clear();

				// Assure Jasmine that everything is alright
				expect(true).toBe(true);
				done();
			});

			// Create the event.
			const event = new CustomEvent(evenType);

			// configure the event
			event.pointerId = 1;
			event.clientX = event.pageX = 10;
			event.clientY = event.pageY = 10;
			event.width = 1;
			event.height = 1;
			event.isPrimary = true;
			event.timeStamp = undefined;

			// dispatch the event
			video.renderer.getCanvas().dispatchEvent(event);
		});
	});
});
