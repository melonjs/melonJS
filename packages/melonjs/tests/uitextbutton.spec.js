import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	boot,
	Container,
	game,
	loader,
	UITextButton,
	video,
} from "../src/index.js";

// Regression coverage for https://github.com/melonjs/melonJS/issues/1499 —
// UITextButton.draw() dropped the viewport argument when chaining to
// Container.draw(), which dereferences `viewport.isDefault` and crashed
// with a TypeError for every UITextButton added to the world.

// Minimal fake camera mimicking the Camera2d surface Container.draw touches.
function makeFakeCamera({ isDefault } = { isDefault: true }) {
	return {
		isDefault,
		screenProjection: { __id: "screenProjection" },
		projectionMatrix: { __id: "projectionMatrix" },
		worldProjection: { __id: "worldProjection" },
		width: 800,
		height: 600,
		pos: { x: 0, y: 0 },
		colorMatrix: {
			isIdentity: () => {
				return true;
			},
		},
		isVisible: () => {
			return true;
		},
	};
}

// Minimal fake renderer covering Container.draw, UITextButton.draw
// (setColor/fill/stroke) and the BitmapText child draw path (drawImage).
function makeFakeRenderer() {
	const noop = () => {};
	return {
		setProjection: vi.fn(),
		save: noop,
		restore: noop,
		resetTransform: noop,
		translate: noop,
		transform: noop,
		clearColor: noop,
		clipRect: noop,
		setColor: noop,
		fill: noop,
		stroke: noop,
		drawImage: noop,
		clearMask: noop,
		setMask: noop,
		setBlendMode: noop,
		getBlendMode: () => {
			return "normal";
		},
		setTint: noop,
		clearTint: noop,
		setDepth: noop,
		setGlobalAlpha: noop,
		globalAlpha: () => {
			return 1;
		},
		getGlobalAlpha: () => {
			return 1;
		},
		setCustomShader: noop,
		clearCustomShader: noop,
		beginPostEffect: noop,
		endPostEffect: noop,
		currentTransform: {
			isIdentity: () => {
				return true;
			},
		},
	};
}

function makeButton() {
	return new UITextButton(50, 50, {
		font: "xolo12",
		text: "Play",
		borderWidth: 200,
		borderHeight: 50,
	});
}

describe("UITextButton", () => {
	beforeAll(async () => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await new Promise((resolve) => {
			loader.preload(
				[
					{
						name: "xolo12",
						type: "image",
						src: "/data/fnt/xolo12.png",
					},
					{
						name: "xolo12",
						type: "binary",
						src: "/data/fnt/xolo12.fnt",
					},
				],
				resolve,
			);
		});
	});

	it("draw() forwards the viewport to Container.draw (#1499)", () => {
		const button = makeButton();
		const cam = makeFakeCamera();
		const superDraw = vi.spyOn(Container.prototype, "draw");

		try {
			button.draw(makeFakeRenderer(), cam);
			expect(superDraw).toHaveBeenCalled();
			const lastCall = superDraw.mock.calls[superDraw.mock.calls.length - 1];
			expect(lastCall[1]).toBe(cam);
		} finally {
			superDraw.mockRestore();
		}
	});

	it("draw() does not throw when called by a parent Container draw pass", () => {
		const parent = new Container(0, 0, 800, 600, true);
		const button = makeButton();
		parent.addChild(button);
		button.inViewport = true;

		expect(() => {
			parent.draw(makeFakeRenderer(), makeFakeCamera());
		}).not.toThrow();

		parent.removeChildNow(button);
	});
});

describe("UITextButton in a real draw pass (#1499 repro)", () => {
	// The exact scenario from the issue: a UITextButton added to
	// game.world, drawn by the real default camera through the real
	// renderer — no fakes anywhere. The earlier unit tests pin the
	// viewport forwarding; this pins the whole production chain
	// (Camera2d.draw → World.draw → UITextButton.draw → Container.draw).
	it("draws through Camera2d → world → button without throwing", () => {
		const button = makeButton();
		game.world.addChild(button);
		// the draw walk skips children that are neither in-viewport nor
		// floating — force visibility so the button genuinely draws and
		// this test cannot pass vacuously
		button.inViewport = true;
		const drawSpy = vi.spyOn(button, "draw");

		try {
			expect(() => {
				game.viewport.draw(video.renderer, game.world);
			}).not.toThrow();

			// prove the button was actually reached by the draw walk...
			expect(drawSpy).toHaveBeenCalled();
			// ...and that the real camera was delivered as its viewport
			expect(drawSpy.mock.calls[0][1]).toBe(game.viewport);
		} finally {
			drawSpy.mockRestore();
			game.world.removeChildNow(button);
		}
	});
});

describe("Container.draw with omitted viewport (legacy super.draw(renderer))", () => {
	// `viewport` is documented optional — subclass overrides written
	// against the pre-multi-camera API chain up with super.draw(renderer).
	it("does not throw without a viewport", () => {
		const c = new Container(0, 0, 800, 600, true);
		const child = new (class extends Container {})(0, 0, 10, 10);
		c.addChild(child);
		child.inViewport = true;

		expect(() => {
			c.draw(makeFakeRenderer());
		}).not.toThrow();
	});

	it("skips the projection swap for floating children without a viewport", () => {
		const c = new Container(0, 0, 800, 600, true);
		const child = new (class extends Container {})(0, 0, 10, 10);
		child.floating = true;
		c.addChild(child);

		const r = makeFakeRenderer();
		expect(() => {
			c.draw(r);
		}).not.toThrow();
		expect(r.setProjection).not.toHaveBeenCalled();
	});
});
