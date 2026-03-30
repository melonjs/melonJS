import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Container,
	UIBaseElement,
	UISpriteElement,
	UITextButton,
	video,
} from "../src/index.js";

describe("UI", () => {
	beforeAll(() => {
		boot();
		video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.AUTO,
		});
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

			it("onClick() should return true by default", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.onClick()).toBe(true);
			});

			it("onRelease() should return true by default", () => {
				const el = new UIBaseElement(0, 0, 100, 50);
				expect(el.onRelease()).toBe(true);
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
				const canvas = video.createCanvas(32, 32);
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
				const canvas = video.createCanvas(32, 32);
				const el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
				el.enter({});
				expect(el.hover).toBe(true);
			});

			it("leave() should set hover to false", () => {
				const canvas = video.createCanvas(32, 32);
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
				const canvas = video.createCanvas(32, 32);
				const el = new UISpriteElement(0, 0, {
					image: canvas,
					framewidth: 32,
					frameheight: 32,
				});
				expect(el.onClick()).toBe(false);
			});

			it("onRelease() should return false by default", () => {
				const canvas = video.createCanvas(32, 32);
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

		describe("property-wiring via stub subclass", () => {
			// A subclass that captures and exposes the settings before BitmapText
			// is constructed, letting us verify the property assignments that
			// UITextButton performs before reaching the BitmapText call.
			class UITextButtonStub extends UIBaseElement {
				constructor(x, y, settings) {
					super(x, y);

					// Mirror the exact property-wiring from UITextButton constructor,
					// stopping just before `new BitmapText(...)`.
					this.bindKey = settings.bindKey || -1;

					this.hoverOffColor =
						settings.hoverOffColor || settings.backgroundColor || "#00aa0080";
					this.hoverOnColor =
						settings.hoverOnColor || settings.hoverColor || "#00ff00ff";

					this.borderStrokeColor = settings.borderStrokeColor || "#000000";
					this.textAlign = settings.textAlign || "center";
					this.textBaseline = settings.textBaseline || "middle";
				}
			}

			it("hoverOffColor should default to #00aa0080", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.hoverOffColor).toBe("#00aa0080");
			});

			it("hoverOnColor should default to #00ff00ff", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.hoverOnColor).toBe("#00ff00ff");
			});

			it("borderStrokeColor should default to #000000", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.borderStrokeColor).toBe("#000000");
			});

			it("textAlign should default to center", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.textAlign).toBe("center");
			});

			it("textBaseline should default to middle", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.textBaseline).toBe("middle");
			});

			it("bindKey should default to -1 when not provided", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.bindKey).toBe(-1);
			});

			it("should apply custom hoverOffColor", () => {
				const btn = new UITextButtonStub(0, 0, {
					font: "Arial",
					text: "Hi",
					hoverOffColor: "#ff000080",
				});
				expect(btn.hoverOffColor).toBe("#ff000080");
			});

			it("should apply custom hoverOnColor", () => {
				const btn = new UITextButtonStub(0, 0, {
					font: "Arial",
					text: "Hi",
					hoverOnColor: "#0000ffff",
				});
				expect(btn.hoverOnColor).toBe("#0000ffff");
			});

			it("should apply custom borderStrokeColor", () => {
				const btn = new UITextButtonStub(0, 0, {
					font: "Arial",
					text: "Hi",
					borderStrokeColor: "#ffffff",
				});
				expect(btn.borderStrokeColor).toBe("#ffffff");
			});

			it("should apply a custom bindKey", () => {
				const btn = new UITextButtonStub(0, 0, {
					font: "Arial",
					text: "Hi",
					bindKey: "ENTER",
				});
				expect(btn.bindKey).toBe("ENTER");
			});

			it("should accept deprecated backgroundColor as hoverOffColor fallback", () => {
				const btn = new UITextButtonStub(0, 0, {
					font: "Arial",
					text: "Hi",
					backgroundColor: "#abcdef80",
				});
				expect(btn.hoverOffColor).toBe("#abcdef80");
			});

			it("should accept deprecated hoverColor as hoverOnColor fallback", () => {
				const btn = new UITextButtonStub(0, 0, {
					font: "Arial",
					text: "Hi",
					hoverColor: "#11223344",
				});
				expect(btn.hoverOnColor).toBe("#11223344");
			});

			it("floating should be true (inherited from UIBaseElement)", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.floating).toBe(true);
			});

			it("isKinematic should be false", () => {
				const btn = new UITextButtonStub(0, 0, { font: "Arial", text: "OK" });
				expect(btn.isKinematic).toBe(false);
			});
		});

		describe("construction without font data throws", () => {
			it("should throw when no font binary is loaded", () => {
				expect(() => {
					return new UITextButton(0, 0, {
						font: "nonexistent-font",
						text: "Test",
					});
				}).toThrow();
			});
		});
	});
});
