import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
	Application,
	boot,
	Container,
	Text,
	UIBaseElement,
	UISpriteElement,
	UITextButton,
	video,
} from "../src/index.js";
import Renderer from "../src/video/renderer.js";

describe("UI", () => {
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

	// ─── UIBaseElement ───────────────────────────────────────────────────────────

	describe("UIBaseElement", () => {
		describe("class existence", () => {
			it("UIBaseElement should be exported", () => {
				expect(UIBaseElement).toBeDefined();
				expect(typeof UIBaseElement).toBe("function");
			});
		});

		describe("inheritance", () => {
			it("UIBaseElement should extend Container", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el).toBeInstanceOf(Container);
			});
		});

		describe("constructor defaults", () => {
			let el;

			beforeAll(() => {
				el = new UIBaseElement(10, 20, 100, 50);
			});

			it("should be constructable", () => {
				expect(el).toBeDefined();
			});

			it("floating should default to true", () => {
				expect(el.floating).toBe(true);
			});

			it("isKinematic should be false (event detection enabled)", () => {
				expect(el.isKinematic).toBe(false);
			});

			it("isClickable should default to true", () => {
				expect(el.isClickable).toBe(true);
			});

			it("isDraggable should default to false", () => {
				expect(el.isDraggable).toBe(false);
			});

			it("holdThreshold should default to 250", () => {
				expect(el.holdThreshold).toBe(250);
			});

			it("isHoldable should default to false", () => {
				expect(el.isHoldable).toBe(false);
			});

			it("hover should default to false", () => {
				expect(el.hover).toBe(false);
			});

			it("released should default to true", () => {
				expect(el.released).toBe(true);
			});

			it("enableChildBoundsUpdate should be true", () => {
				expect(el.enableChildBoundsUpdate).toBe(true);
			});
		});

		describe("hover state management", () => {
			it("enter() should set hover to true", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.hover).toBe(false);
				// pass a minimal fake event — enter() only calls onOver, no field access
				el.enter({});
				expect(el.hover).toBe(true);
			});

			it("leave() should set hover to false", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				el.hover = true;
				el.leave({});
				expect(el.hover).toBe(false);
			});
		});

		describe("click state management", () => {
			it("clicked() with button 0 should set released to false", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.released).toBe(true);
				el.clicked({ button: 0 });
				expect(el.released).toBe(false);
			});

			it("clicked() with button 1 should not change released", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.released).toBe(true);
				el.clicked({ button: 1 });
				expect(el.released).toBe(true);
			});

			it("release() should set released back to true", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				el.clicked({ button: 0 });
				expect(el.released).toBe(false);
				el.release({});
				expect(el.released).toBe(true);
			});

			it("onClick() should return false by default, stopping the press", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.onClick()).toBe(false);
			});

			it("onRelease() should return false by default, stopping the release", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.onRelease()).toBe(false);
			});
		});
	});

	// ─── UISpriteElement ─────────────────────────────────────────────────────────

	describe("UISpriteElement", () => {
		describe("class existence", () => {
			it("UISpriteElement should be exported", () => {
				expect(UISpriteElement).toBeDefined();
				expect(typeof UISpriteElement).toBe("function");
			});
		});

		describe("constructor defaults", () => {
			let el;

			beforeAll(() => {
				// UISpriteElement requires a valid image — use a canvas as a stand-in
				const canvas = Renderer.createCanvas(32, 32);
				el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
			});

			it("should be constructable with an image setting", () => {
				expect(el).toBeDefined();
			});

			it("floating should default to true", () => {
				expect(el.floating).toBe(true);
			});

			it("isKinematic should be false (event detection enabled)", () => {
				expect(el.isKinematic).toBe(false);
			});

			it("isClickable should default to true", () => {
				expect(el.isClickable).toBe(true);
			});

			it("holdThreshold should default to 250", () => {
				expect(el.holdThreshold).toBe(250);
			});

			it("isHoldable should default to false", () => {
				expect(el.isHoldable).toBe(false);
			});

			it("hover should default to false", () => {
				expect(el.hover).toBe(false);
			});

			it("released should default to true", () => {
				expect(el.released).toBe(true);
			});
		});

		describe("hover state management", () => {
			it("enter() should set hover to true", () => {
				const canvas = Renderer.createCanvas(32, 32);
				const el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
				el.enter({});
				expect(el.hover).toBe(true);
			});

			it("leave() should set hover to false", () => {
				const canvas = Renderer.createCanvas(32, 32);
				const el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
				el.hover = true;
				el.leave({});
				expect(el.hover).toBe(false);
			});
		});

		describe("click callbacks", () => {
			it("onClick() should return false by default", () => {
				const canvas = Renderer.createCanvas(32, 32);
				const el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
				expect(el.onClick()).toBe(false);
			});

			it("onRelease() should return false by default", () => {
				const canvas = Renderer.createCanvas(32, 32);
				const el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
				expect(el.onRelease()).toBe(false);
			});
		});
	});

	// ─── UITextButton ─────────────────────────────────────────────────────────────

	describe("UITextButton", () => {
		// UITextButton embeds a BitmapText which requires pre-loaded font binary
		// data from the asset loader.  In the test environment no assets are
		// loaded, so construction always throws:
		//   "File containing font data was empty, cannot load the bitmap font."
		// We therefore verify the public API by testing:
		//   1. Class-level identity (export, prototype chain) without instantiation.
		//   2. Property-wiring logic via a thin subclass that stubs out the
		//      BitmapText creation so the rest of the constructor can run.

		describe("class existence", () => {
			it("UITextButton should be exported", () => {
				expect(UITextButton).toBeDefined();
				expect(typeof UITextButton).toBe("function");
			});

			it("UITextButton prototype chain includes UIBaseElement", () => {
				expect(UITextButton.prototype).toBeInstanceOf(UIBaseElement);
			});
		});

		describe("property wiring", () => {
			// the real class: it builds without a bitmap font, as a CSS one
			const make = (settings = {}) => {
				return new UITextButton(0, 0, { text: "OK", ...settings });
			};

			it("has its documented defaults", () => {
				const btn = make();
				expect(btn.hoverOffColor).toBe("#00aa0080");
				expect(btn.hoverOnColor).toBe("#00ff00ff");
				expect(btn.borderStrokeColor).toBe("#000000");
				expect(btn.textAlign).toBe("center");
				expect(btn.textBaseline).toBe("middle");
				expect(btn.bindKey).toBe(-1);
				expect(btn.pressedColor).toBeUndefined();
				expect(btn.floating).toBe(true);
				expect(btn.isKinematic).toBe(false);
				expect(btn.focusable).toBe(true);
			});

			it("applies custom colours", () => {
				const btn = make({
					hoverOffColor: "#11111180",
					hoverOnColor: "#222222ff",
					borderStrokeColor: "#333333",
					pressedColor: "#444444",
				});
				expect(btn.hoverOffColor).toBe("#11111180");
				expect(btn.hoverOnColor).toBe("#222222ff");
				expect(btn.borderStrokeColor).toBe("#333333");
				expect(btn.pressedColor).toBe("#444444");
			});

			it("takes borderColor over the older borderStrokeColor", () => {
				const btn = make({
					borderColor: "#aa0000",
					borderStrokeColor: "#00aa00",
				});
				expect(btn.borderStrokeColor).toBe("#aa0000");
			});

			it("keeps a bindKey of 0, a valid key code", () => {
				expect(make({ bindKey: 0 }).bindKey).toBe(0);
				expect(make({ bindKey: "jump" }).bindKey).toBe("jump");
			});
		});

		describe("construction without bitmap font data", () => {
			// Before 20.13 this threw: the label was always a BitmapText. A
			// font that is not a loaded bitmap font is now a CSS font.
			it("draws the label with a CSS font", () => {
				const btn = new UITextButton(0, 0, {
					font: "nonexistent-font",
					text: "Test",
				});
				expect(btn.label).toBeInstanceOf(Text);
				expect(btn.bitmapText).toBe(btn.label);
			});
		});
	});

	// ─── Real draw pass ──────────────────────────────────────────────────────────
	// Structural tests alone let UITextButton ship broken for months (#1499) —
	// these run each widget through the actual production draw chain
	// (Camera2d.draw → World.draw → widget.draw) with the real renderer.

	describe("real draw pass", () => {
		const drawPass = (widget) => {
			app.world.addChild(widget);
			widget.inViewport = true;
			const drawSpy = vi.spyOn(widget, "draw");
			try {
				expect(() => {
					app.viewport.draw(app.renderer, app.world);
				}).not.toThrow();
				// the widget must actually be reached by the draw walk,
				// and receive the camera as its viewport
				expect(drawSpy).toHaveBeenCalled();
				expect(drawSpy.mock.calls[0][1]).toBe(app.viewport);
			} finally {
				drawSpy.mockRestore();
				app.world.removeChildNow(widget);
			}
		};

		it("UIBaseElement draws through the production chain", () => {
			drawPass(new UIBaseElement(50, 50, 100, 100));
		});

		it("UISpriteElement draws through the production chain", () => {
			drawPass(
				new UISpriteElement(50, 50, {
					image: Renderer.createCanvas(32, 32),
					framewidth: 32,
					frameheight: 32,
				}),
			);
		});
	});
});
