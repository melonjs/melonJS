import { describe, expect, it } from "vitest";
import {
	boot,
	Ellipse,
	FadeEffect,
	game,
	MaskEffect,
	Polygon,
	Rect,
	Trigger,
	video,
} from "../src/index.js";

const setup = () => {
	boot();
	video.init(800, 600, {
		parent: "screen",
		scale: "auto",
		renderer: video.CANVAS,
	});
};

describe("Trigger", () => {
	describe("constructor", () => {
		it("should create a trigger with default settings", () => {
			setup();
			const trigger = new Trigger(100, 200, {
				width: 50,
				height: 100,
				to: "map2",
			});
			expect(trigger.pos.x).toEqual(100);
			expect(trigger.pos.y).toEqual(200);
			expect(trigger.width).toEqual(50);
			expect(trigger.height).toEqual(100);
			expect(trigger.name).toEqual("Trigger");
			expect(trigger.gotolevel).toEqual("map2");
		});

		it("should default transition to 'fade'", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				to: "map2",
			});
			expect(trigger.transition).toEqual("fade");
		});

		it("should accept 'mask' transition type", () => {
			setup();
			const shape = new Ellipse(0, 0, 1, 1);
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				transition: "mask",
				shape,
				to: "map2",
			});
			expect(trigger.transition).toEqual("mask");
			expect(trigger.transitionShape).toBe(shape);
		});

		it("should use 'color' property for transition color", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				color: "#000",
				to: "map2",
			});
			expect(trigger.color).toEqual("#000");
		});

		it("should fall back to 'fade' property for backward compatibility", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				fade: "#fff",
				to: "map2",
			});
			expect(trigger.color).toEqual("#fff");
		});

		it("should prefer 'color' over 'fade' when both are set", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				color: "#000",
				fade: "#fff",
				to: "map2",
			});
			expect(trigger.color).toEqual("#000");
		});

		it("should store duration", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				duration: 500,
				to: "map2",
			});
			expect(trigger.duration).toEqual(500);
		});

		it("should initialize fading to false", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				to: "map2",
			});
			expect(trigger.fading).toEqual(false);
		});

		it("should collect trigger settings", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				to: "map2",
				flatten: true,
				setViewportBounds: false,
			});
			expect(trigger.triggerSettings.event).toEqual("level");
			expect(trigger.triggerSettings.to).toEqual("map2");
			expect(trigger.triggerSettings.flatten).toEqual(true);
			expect(trigger.triggerSettings.setViewportBounds).toEqual(false);
		});

		it("should declare a static body definition for collision", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 100,
				to: "map2",
			});
			// the body is constructed when the trigger is added to a world
			// (adapter auto-registration); the bodyDef is set at construction
			expect(trigger.bodyDef).toBeDefined();
			expect(trigger.bodyDef.type).toEqual("static");
		});

		// Triggers are detection-only volumes. Marking the bodyDef as a
		// sensor makes that intent explicit and portable: under the
		// builtin adapter the SAT detector already skipped push-out for
		// triggers (they don't define `onCollision`), but Matter's solver
		// resolves every contact unless `isSensor` is set.
		it("should declare the trigger body as a sensor", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 100,
				to: "map2",
			});
			expect(trigger.bodyDef.isSensor).toEqual(true);
		});

		it("should accept custom shapes for collision", () => {
			setup();
			const rect = new Rect(0, 0, 80, 60);
			const trigger = new Trigger(0, 0, {
				width: 80,
				height: 60,
				shapes: [rect],
				to: "map2",
			});
			expect(trigger.bodyDef).toBeDefined();
			expect(trigger.bodyDef.shapes[0]).toBe(rect);
		});
	});

	describe("mask transition with polygon", () => {
		it("should store polygon shape for mask transition", () => {
			setup();
			const diamond = new Polygon(0, 0, [
				{ x: 0, y: -1 },
				{ x: 1, y: 0 },
				{ x: 0, y: 1 },
				{ x: -1, y: 0 },
			]);
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				transition: "mask",
				shape: diamond,
				color: "#000",
				duration: 300,
				to: "map2",
			});
			expect(trigger.transition).toEqual("mask");
			expect(trigger.transitionShape).toBe(diamond);
			expect(trigger.color).toEqual("#000");
			expect(trigger.duration).toEqual(300);
		});
	});

	describe("mask transition with ellipse", () => {
		it("should store ellipse shape for mask transition", () => {
			setup();
			const iris = new Ellipse(0, 0, 1, 1);
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				transition: "mask",
				shape: iris,
				color: "#000",
				duration: 500,
				to: "map2",
			});
			expect(trigger.transition).toEqual("mask");
			expect(trigger.transitionShape).toBe(iris);
		});
	});

	describe("triggerEvent", () => {
		it("should add a FadeEffect when transition is 'fade'", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				color: "#000",
				duration: 250,
				to: "map2",
			});
			game.world.addChild(trigger);

			trigger.triggerEvent();

			expect(trigger.fading).toEqual(true);
			const effect = game.viewport.getCameraEffect(FadeEffect);
			expect(effect).toBeDefined();

			game.world.removeChild(trigger);
			while (game.viewport.cameraEffects.length > 0) {
				game.viewport.removeCameraEffect(game.viewport.cameraEffects[0]);
			}
		});

		it("should add a MaskEffect when transition is 'mask'", () => {
			setup();
			const iris = new Ellipse(0, 0, 1, 1);
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				transition: "mask",
				shape: iris,
				color: "#000",
				duration: 300,
				to: "map2",
			});
			game.world.addChild(trigger);

			trigger.triggerEvent();

			expect(trigger.fading).toEqual(true);
			const effect = game.viewport.getCameraEffect(MaskEffect);
			expect(effect).toBeDefined();

			game.world.removeChild(trigger);
			while (game.viewport.cameraEffects.length > 0) {
				game.viewport.removeCameraEffect(game.viewport.cameraEffects[0]);
			}
		});

		it("should not trigger twice without force", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				color: "#000",
				duration: 250,
				to: "map2",
			});
			game.world.addChild(trigger);

			trigger.triggerEvent();
			const effectCount = game.viewport.cameraEffects.length;
			trigger.triggerEvent();
			expect(game.viewport.cameraEffects.length).toEqual(effectCount);

			game.world.removeChild(trigger);
			while (game.viewport.cameraEffects.length > 0) {
				game.viewport.removeCameraEffect(game.viewport.cameraEffects[0]);
			}
		});

		it("should default to fade when no transition is specified", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				fade: "#fff",
				duration: 150,
				to: "map2",
			});
			game.world.addChild(trigger);

			expect(trigger.transition).toEqual("fade");
			trigger.triggerEvent();

			const fadeEffect = game.viewport.getCameraEffect(FadeEffect);
			const maskEffect = game.viewport.getCameraEffect(MaskEffect);
			expect(fadeEffect).toBeDefined();
			expect(maskEffect).toBeUndefined();

			game.world.removeChild(trigger);
			while (game.viewport.cameraEffects.length > 0) {
				game.viewport.removeCameraEffect(game.viewport.cameraEffects[0]);
			}
		});
	});

	describe("onCollisionStart", () => {
		it("should call triggerEvent when name is 'Trigger'", () => {
			setup();
			const trigger = new Trigger(0, 0, {
				width: 50,
				height: 50,
				color: "#000",
				duration: 250,
				to: "map2",
			});
			game.world.addChild(trigger);

			expect(trigger.fading).toEqual(false);
			trigger.onCollisionStart();
			expect(trigger.fading).toEqual(true);

			game.world.removeChild(trigger);
			while (game.viewport.cameraEffects.length > 0) {
				game.viewport.removeCameraEffect(game.viewport.cameraEffects[0]);
			}
		});
	});
});
