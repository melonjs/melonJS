import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import {
	Application,
	boot,
	Container,
	event,
	input,
	ProgressBar,
	Renderable,
	TextureAtlas,
	UICheckbox,
	UIFocus,
	UIPanel,
	UISlider,
	UITextButton,
	video,
} from "../src/index.js";
import { SkinDrawer } from "../src/renderable/ui/uiskin.ts";

// The widgets of #1722: the skinned button, the checkbox, the slider, and
// the panel's layout and scrolling, driven through real pointer events.

let app;
const added = [];

/**
 * dispatch a DOM event at GAME coordinates, converted through the canvas
 * bounding rect so the test does not depend on how the canvas was scaled
 */
const at = (gameX, gameY) => {
	const canvas = app.renderer.getCanvas();
	const rect = canvas.getBoundingClientRect();
	return {
		clientX: rect.left + (gameX * rect.width) / canvas.width,
		clientY: rect.top + (gameY * rect.height) / canvas.height,
	};
};

const pointer = (type, gameX, gameY) => {
	app.renderer.getCanvas().dispatchEvent(
		new PointerEvent(type, {
			...at(gameX, gameY),
			pointerId: 1,
			width: 1,
			height: 1,
			isPrimary: true,
			bubbles: true,
		}),
	);
};

const wheel = (gameX, gameY, deltaY, deltaX = 0) => {
	app.renderer.getCanvas().dispatchEvent(
		new WheelEvent("wheel", {
			...at(gameX, gameY),
			deltaY,
			deltaX,
			bubbles: true,
			cancelable: true,
		}),
	);
};

/** what a Text or a BitmapText says */
const textOf = (label) => {
	return [].concat(label._text).join("\n");
};

/** a click: down and up at the same place */
const click = (x, y) => {
	pointer("pointermove", x, y);
	pointer("pointerdown", x, y);
	pointer("pointerup", x, y);
};

/** a drag from one point to another, in steps */
const drag = (x0, y0, x1, y1, steps = 5) => {
	pointer("pointermove", x0, y0);
	pointer("pointerdown", x0, y0);
	for (let i = 1; i <= steps; i++) {
		pointer(
			"pointermove",
			x0 + ((x1 - x0) * i) / steps,
			y0 + ((y1 - y0) * i) / steps,
		);
	}
	pointer("pointerup", x1, y1);
};

const syncBroadphase = () => {
	app.world.broadphase.clear();
	app.world.broadphase.insertContainer(app.world);
};

/** add to the world, and take it out after the test */
const place = (widget) => {
	app.world.addChild(widget);
	added.push(widget);
	syncBroadphase();
	return widget;
};

/** a 64x32 atlas of four 16x16 regions, each a different colour */
const makeAtlas = () => {
	const sheet = document.createElement("canvas");
	sheet.width = 64;
	sheet.height = 32;
	const ctx = sheet.getContext("2d");
	const colours = ["#f00", "#0f0", "#00f", "#ff0"];
	colours.forEach((c, i) => {
		ctx.fillStyle = c;
		ctx.fillRect(i * 16, 0, 16, i === 1 ? 12 : 16);
	});
	const frame = (filename, x, w, h) => {
		return {
			filename,
			frame: { x, y: 0, w, h },
			rotated: false,
			trimmed: false,
			spriteSourceSize: { x: 0, y: 0, w, h },
			sourceSize: { w, h },
			pivot: { x: 0.5, y: 0.5 },
		};
	};
	return new TextureAtlas(
		{
			frames: [
				frame("up", 0, 16, 16),
				// shorter, as pressed art is
				frame("down", 16, 16, 12),
				frame("on", 32, 16, 16),
				frame("off", 48, 16, 16),
			],
			meta: {
				app: "texturepacker",
				image: "ui.png",
				size: { w: 64, h: 32 },
				scale: "1",
			},
		},
		sheet,
	);
};

describe("UI widgets", () => {
	beforeAll(async () => {
		boot();
		app = new Application(800, 600, {
			parent: "screen",
			scale: "auto",
			renderer: video.CANVAS,
		});
		await app.init();
	});

	afterEach(() => {
		for (const widget of added.splice(0)) {
			if (widget.ancestor !== undefined) {
				app.world.removeChildNow(widget);
			}
		}
		// let go of anything a failed test left held
		pointer("pointerup", 799, 599);
		vi.restoreAllMocks();
	});

	describe("UICheckbox", () => {
		it("a click toggles it and calls onChange once", () => {
			const onChange = vi.fn();
			const cb = place(new UICheckbox(100, 100, { label: "Music", onChange }));
			click(110, 110);
			expect(cb.checked).toBe(true);
			expect(onChange).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenCalledWith(true, cb);
			click(110, 110);
			expect(cb.checked).toBe(false);
			expect(onChange).toHaveBeenCalledTimes(2);
		});

		it("a tap with no hover before it still toggles it", () => {
			const cb = place(new UICheckbox(100, 100, {}));
			pointer("pointerdown", 110, 110);
			pointer("pointerup", 110, 110);
			expect(cb.checked).toBe(true);
		});

		it("setting checked from code, or toggle(), does not call onChange", () => {
			const onChange = vi.fn();
			const cb = place(new UICheckbox(100, 100, { onChange }));
			cb.checked = true;
			expect(cb.checked).toBe(true);
			expect(cb.toggle()).toBe(false);
			expect(onChange).not.toHaveBeenCalled();
		});

		it("clicking the label toggles it too", () => {
			const cb = place(
				new UICheckbox(100, 100, { label: "A long label", boxSize: 20 }),
			);
			expect(cb.width).toBeGreaterThan(60);
			click(100 + cb.width - 4, 110);
			expect(cb.checked).toBe(true);
		});

		it("swaps the label between labelOn and labelOff, at a fixed width", () => {
			const cb = place(
				new UICheckbox(100, 100, {
					labelOn: "Music ON",
					labelOff: "Music OFF",
				}),
			);
			const width = cb.width;
			expect(textOf(cb.label)).toBe("Music OFF");
			click(110, 110);
			expect(textOf(cb.label)).toBe("Music ON");
			expect(cb.width).toBe(width);
		});

		it("ignores input while disabled", () => {
			const onChange = vi.fn();
			const cb = place(new UICheckbox(100, 100, { enabled: false, onChange }));
			click(110, 110);
			expect(cb.checked).toBe(false);
			expect(onChange).not.toHaveBeenCalled();
			cb.enabled = true;
			click(110, 110);
			expect(cb.checked).toBe(true);
		});

		it("a press dragged off before the release does not toggle", () => {
			const cb = place(new UICheckbox(100, 100, {}));
			pointer("pointermove", 110, 110);
			pointer("pointerdown", 110, 110);
			pointer("pointermove", 400, 400);
			pointer("pointerup", 400, 400);
			expect(cb.checked).toBe(false);
		});

		it("a radio group keeps exactly one checked", () => {
			const onChange = vi.fn();
			const a = place(
				new UICheckbox(100, 100, { group: "g1", checked: true, onChange }),
			);
			const b = place(new UICheckbox(100, 150, { group: "g1", onChange }));
			const c = place(new UICheckbox(100, 200, { group: "g1", onChange }));
			expect(UICheckbox.checkedIn("g1")).toBe(a);
			click(110, 160);
			expect([a.checked, b.checked, c.checked]).toEqual([false, true, false]);
			// only the one picked is told
			expect(onChange).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenCalledWith(true, b);
			// clicking the checked one leaves it checked
			click(110, 160);
			expect(b.checked).toBe(true);
			expect(onChange).toHaveBeenCalledTimes(1);
			// from code, silently, still one at a time
			c.checked = true;
			expect([a.checked, b.checked, c.checked]).toEqual([false, false, true]);
			expect(UICheckbox.checkedIn("g1")).toBe(c);
		});

		it("leaves its group when removed from the scene", () => {
			const a = place(new UICheckbox(100, 100, { group: "g2", checked: true }));
			const b = place(new UICheckbox(100, 150, { group: "g2" }));
			app.world.removeChildNow(a);
			b.checked = true;
			// a is gone from the group, so it was not unchecked
			expect(a.checked).toBe(true);
			expect(UICheckbox.checkedIn("g2")).toBe(b);
		});

		it("draws the skin's on and off regions", () => {
			const atlas = makeAtlas();
			const spy = vi.spyOn(SkinDrawer.prototype, "draw");
			const cb = place(
				new UICheckbox(100, 100, { skin: { atlas, on: "on", off: "off" } }),
			);
			expect(cb.boxSize).toBe(16);
			cb.draw(app.renderer);
			expect(spy.mock.calls.at(-1)[1]).toBe("off");
			cb.checked = true;
			cb.draw(app.renderer);
			expect(spy.mock.calls.at(-1)[1]).toBe("on");
		});

		it("names a missing skin region when it is built", () => {
			const atlas = makeAtlas();
			expect(() => {
				return new UICheckbox(0, 0, { skin: { atlas, on: "on", off: "nope" } });
			}).toThrow(/nope/);
		});
	});

	describe("UISlider", () => {
		// 200 long with a 20 thumb: the thumb's centre travels 10..190
		const make = (settings = {}) => {
			return place(new UISlider(100, 100, settings));
		};

		it("a click on the track jumps there and calls onChange", () => {
			const onChange = vi.fn();
			const s = make({ onChange });
			click(100 + 100, 110);
			expect(s.value).toBeCloseTo(0.5, 2);
			expect(onChange).toHaveBeenCalledTimes(1);
		});

		it("drags the thumb, calling onChangeEnd once on release", () => {
			const onChange = vi.fn();
			const onChangeEnd = vi.fn();
			const s = make({ onChange, onChangeEnd });
			drag(110, 110, 160, 110);
			expect(s.value).toBeCloseTo(50 / 180, 2);
			expect(onChange.mock.calls.length).toBeGreaterThan(1);
			expect(onChangeEnd).toHaveBeenCalledTimes(1);
			expect(onChangeEnd).toHaveBeenCalledWith(s.value, s);
			expect(s.dragging).toBe(false);
		});

		it("keeps following the pointer once it leaves the track", () => {
			const s = make();
			drag(110, 110, 600, 400);
			expect(s.value).toBe(1);
		});

		it("does not jump when the thumb is grabbed off centre", () => {
			const s = make({ value: 0.5 });
			// the thumb's centre is at 200; grab it 6 pixels right of that
			pointer("pointermove", 206, 110);
			pointer("pointerdown", 206, 110);
			expect(s.value).toBe(0.5);
			pointer("pointerup", 206, 110);
		});

		it("snaps to the step and clamps to the range", () => {
			const s = make({ min: 0, max: 10, step: 2 });
			s.value = 3.2;
			expect(s.value).toBe(4);
			s.value = 99;
			expect(s.value).toBe(10);
			s.value = -5;
			expect(s.value).toBe(0);
			const fine = make({ min: 0, max: 1, step: 0.1 });
			fine.value = 0.30000000000000004;
			expect(fine.value).toBe(0.3);
		});

		it("setting value from code does not call onChange", () => {
			const onChange = vi.fn();
			const onChangeEnd = vi.fn();
			const s = make({ onChange, onChangeEnd });
			s.value = 0.7;
			expect(s.value).toBeCloseTo(0.7);
			expect(onChange).not.toHaveBeenCalled();
			expect(onChangeEnd).not.toHaveBeenCalled();
		});

		it("a vertical slider has its highest value at the top", () => {
			const s = make({ orientation: "vertical", length: 100 });
			expect(s.height).toBe(100);
			// the thumb travels 10..90 down the slider
			click(110, 100 + 10);
			expect(s.value).toBe(1);
			click(110, 100 + 90);
			expect(s.value).toBe(0);
		});

		it("the wheel moves it one step, and is consumed", () => {
			const onChange = vi.fn();
			const onChangeEnd = vi.fn();
			const s = make({
				min: 0,
				max: 10,
				step: 1,
				value: 5,
				onChange,
				onChangeEnd,
			});
			pointer("pointermove", 150, 110);
			wheel(150, 110, -100);
			expect(s.value).toBe(6);
			wheel(150, 110, 100);
			wheel(150, 110, 100);
			expect(s.value).toBe(4);
			expect(onChange).toHaveBeenCalledTimes(3);
			expect(onChangeEnd).toHaveBeenCalledTimes(3);
		});

		it("ignores input while disabled", () => {
			const s = make({ enabled: false });
			click(200, 110);
			wheel(200, 110, -100);
			expect(s.value).toBe(0);
		});

		it("a press on the caption does not move it", () => {
			const s = make({ label: "Volume", fontSize: 16 });
			// the caption row is above the track
			click(130, 108);
			expect(s.value).toBe(0);
		});

		it("writes its value with format", () => {
			const s = make({
				showValue: true,
				valueFormat: (v) => {
					return Math.round(v * 100) + "%";
				},
				value: 0.25,
			});
			expect(textOf(s.valueText)).toBe("25%");
		});
	});

	describe("UITextButton", () => {
		it("calls the onClick setting on a completed click", () => {
			const onClick = vi.fn();
			const b = place(
				new UITextButton(100, 100, {
					text: "OK",
					borderWidth: 100,
					borderHeight: 40,
					onClick,
				}),
			);
			click(150, 120);
			expect(onClick).toHaveBeenCalledTimes(1);
			expect(onClick).toHaveBeenCalledWith(b);
		});

		it("does not call it for a press dragged off, or while disabled", () => {
			const onClick = vi.fn();
			const b = place(
				new UITextButton(100, 100, {
					text: "OK",
					borderWidth: 100,
					borderHeight: 40,
					onClick,
				}),
			);
			pointer("pointermove", 150, 120);
			pointer("pointerdown", 150, 120);
			pointer("pointermove", 500, 500);
			pointer("pointerup", 500, 500);
			expect(onClick).not.toHaveBeenCalled();
			b.enabled = false;
			click(150, 120);
			expect(onClick).not.toHaveBeenCalled();
		});

		it("calls it for its bindKey, on the key's release", () => {
			const onClick = vi.fn();
			place(
				new UITextButton(100, 100, {
					text: "OK",
					bindKey: input.KEY.ENTER,
					onClick,
				}),
			);
			event.emit(event.KEYDOWN, undefined, input.KEY.ENTER);
			expect(onClick).not.toHaveBeenCalled();
			event.emit(event.KEYUP, undefined, input.KEY.ENTER);
			expect(onClick).toHaveBeenCalledTimes(1);
		});

		it("draws the pressed region lowered, and the label with it", () => {
			const atlas = makeAtlas();
			const spy = vi.spyOn(SkinDrawer.prototype, "draw");
			const b = place(
				new UITextButton(100, 100, {
					text: "OK",
					borderWidth: 80,
					skin: { atlas, normal: "up", pressed: "down" },
				}),
			);
			// the height comes from the normal region
			expect(b.height).toBe(16);
			b.draw(app.renderer);
			expect(spy.mock.calls.at(-1).slice(1)).toEqual(["up", 100, 100, 80, 16]);
			const labelY = b.label.pos.y;
			pointer("pointermove", 120, 108);
			pointer("pointerdown", 120, 108);
			b.draw(app.renderer);
			// 16 tall at rest, 12 pressed: lowered by 4
			expect(spy.mock.calls.at(-1).slice(1)).toEqual([
				"down",
				100,
				104,
				80,
				12,
			]);
			expect(b.label.pos.y).toBe(labelY + 4);
			pointer("pointerup", 120, 108);
			b.draw(app.renderer);
			expect(b.label.pos.y).toBe(labelY);
		});

		it("keeps its background on the button when it moves", () => {
			const b = new UITextButton(10, 10, { text: "OK", borderWidth: 60 });
			b.pos.set(200, 300);
			b.draw(app.renderer);
			expect(b.border.pos.x).toBe(200);
			expect(b.border.pos.y).toBe(300);
		});

		it("resize keeps the label centred", () => {
			const b = new UITextButton(0, 0, { text: "OK", borderWidth: 60 });
			b.resize(200, 50);
			expect(b.label.pos.x).toBe(100);
			expect(b.label.pos.y).toBe(25);
			expect(b.border.width).toBe(200);
		});
	});

	describe("UIPanel layout", () => {
		/** a plain 40x20 renderable, placed by its top left corner */
		const box = (w = 40, h = 20) => {
			const r = new Renderable(0, 0, w, h);
			r.anchorPoint.set(0, 0);
			return r;
		};

		it("stacks a column with padding and gap", () => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 200,
					height: 200,
					layout: "column",
					padding: 10,
					gap: 5,
				}),
			);
			const a = panel.addChild(box());
			const b = panel.addChild(box());
			const c = panel.addChild(box());
			expect([a.pos.x, a.pos.y]).toEqual([10, 10]);
			expect([b.pos.x, b.pos.y]).toEqual([10, 35]);
			expect([c.pos.x, c.pos.y]).toEqual([10, 60]);
		});

		it("lines a row up, centred across", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 300,
					height: 100,
					layout: "row",
					padding: 10,
					gap: 10,
					align: "center",
				}),
			);
			const a = panel.addChild(box(40, 20));
			const b = panel.addChild(box(40, 40));
			expect([a.pos.x, a.pos.y]).toEqual([10, 40]);
			expect([b.pos.x, b.pos.y]).toEqual([60, 30]);
		});

		it("fills a grid row by row, in equal cells", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 230,
					height: 200,
					layout: "grid",
					columns: 3,
					padding: 10,
					gap: 10,
				}),
			);
			const cells = [];
			for (let i = 0; i < 5; i++) {
				cells.push(panel.addChild(box(30, 20)));
			}
			// cell width (210 - 20) / 3
			const w = 190 / 3;
			expect(
				cells.map((c) => {
					return [c.pos.x, c.pos.y];
				}),
			).toEqual([
				[10, 10],
				[10 + w + 10, 10],
				[10 + 2 * (w + 10), 10],
				[10, 40],
				[10 + w + 10, 40],
			]);
		});

		it("lays out below the title and inside the border", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 200,
					height: 200,
					title: "OPTIONS",
					titleFontSize: 20,
					borderColor: "#000",
					borderWidth: 2,
					layout: "column",
					padding: 4,
				}),
			);
			const a = panel.addChild(box());
			// 2 border + 32 title + 4 padding
			expect([a.pos.x, a.pos.y]).toEqual([6, 38]);
		});

		it("stretches buttons to the column", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 220,
					height: 300,
					layout: "column",
					padding: 10,
					align: "stretch",
				}),
			);
			const b = panel.addChild(new UITextButton(0, 0, { text: "OK" }));
			expect(b.width).toBe(200);
			expect(b.label.pos.x).toBe(100);
		});

		it("autoSize fits the panel, skin included, to the content", () => {
			const atlas = makeAtlas();
			const spy = vi.spyOn(SkinDrawer.prototype, "draw");
			const panel = place(
				new UIPanel(0, 0, {
					width: 10,
					height: 10,
					layout: "column",
					padding: 5,
					gap: 5,
					autoSize: true,
					skin: { atlas, region: "up", insetx: 3, insety: 3 },
				}),
			);
			panel.addChild(box(40, 20));
			panel.addChild(box(60, 20));
			// 3 + 5 + content + 5 + 3
			expect(panel.width).toBe(76);
			expect(panel.height).toBe(16 + 45);
			panel.draw(app.renderer);
			const call = spy.mock.calls.find((c) => {
				return c[1] === "up";
			});
			expect(call.slice(4)).toEqual([76, 61]);
		});

		it("lays out again when a child is removed", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 200,
					height: 200,
					layout: "column",
					gap: 0,
				}),
			);
			const a = panel.addChild(box());
			const b = panel.addChild(box());
			expect(b.pos.y).toBe(20);
			panel.removeChildNow(a);
			expect(b.pos.y).toBe(0);
		});

		it("leaves manual placement alone by default", () => {
			const panel = place(new UIPanel(0, 0, { width: 200, height: 200 }));
			const a = box();
			a.pos.set(33, 44);
			panel.addChild(a);
			expect([a.pos.x, a.pos.y]).toEqual([33, 44]);
		});
	});

	describe("UIPanel scrolling", () => {
		/** a scrolling list: 10 buttons of 40, in a 100 tall view */
		const makeList = (settings = {}) => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 200,
					height: 100,
					layout: "column",
					gap: 0,
					scroll: "vertical",
					...settings,
				}),
			);
			const buttons = [];
			for (let i = 0; i < 10; i++) {
				buttons.push(
					panel.addChild(
						new UITextButton(0, 0, {
							text: `Level ${i + 1}`,
							borderWidth: 200,
							borderHeight: 40,
						}),
					),
				);
			}
			syncBroadphase();
			return { panel, buttons };
		};

		it("works out how far the content scrolls", () => {
			const { panel } = makeList();
			expect(panel.maxScrollY).toBe(300);
			expect(panel.maxScrollX).toBe(0);
		});

		it("scrollTo moves the children and clamps", () => {
			const onScroll = vi.fn();
			const { panel, buttons } = makeList({ onScroll });
			panel.scrollTo(0, 120);
			expect(panel.scrollY).toBe(120);
			expect(buttons[0].pos.y).toBe(-120);
			expect(buttons[3].pos.y).toBe(0);
			expect(onScroll).toHaveBeenCalledWith(0, 120, panel);
			panel.scrollY = 9999;
			expect(panel.scrollY).toBe(300);
			panel.scrollY = -5;
			expect(panel.scrollY).toBe(0);
		});

		it("scrollToChild brings a child into view", () => {
			const { panel, buttons } = makeList();
			panel.scrollToChild(buttons[5]);
			// its bottom at the bottom of the view
			expect(panel.scrollY).toBe(140);
			panel.scrollToChild(buttons[1]);
			expect(panel.scrollY).toBe(40);
		});

		it("scrolls with the wheel over it", () => {
			const { panel } = makeList();
			pointer("pointermove", 150, 150);
			wheel(150, 150, 50);
			expect(panel.scrollY).toBe(50);
		});

		it("does not let a child scrolled out of view be clicked", () => {
			const { panel, buttons } = makeList();
			const below = vi.fn();
			const hidden = vi.fn();
			buttons[3].onClickCallback = hidden;
			// button 3 sits at 120..160, under the panel's bottom edge at 200
			// in screen terms: 100 + 120 = 220
			const under = place(
				new UITextButton(100, 210, {
					text: "below",
					borderWidth: 200,
					borderHeight: 40,
					onClick: below,
				}),
			);
			app.world.moveToBottom?.(under);
			syncBroadphase();
			click(150, 230);
			expect(hidden).not.toHaveBeenCalled();
			expect(below).toHaveBeenCalledTimes(1);
			void panel;
		});

		it("a drag that starts on a button scrolls and cancels the press", () => {
			const { panel, buttons } = makeList();
			const onClick = vi.fn();
			// the third button, 80..120 in the panel: 180..220 on screen
			buttons[2].onClickCallback = onClick;
			const onCancel = vi.spyOn(buttons[2], "onCancel");
			drag(150, 190, 150, 130);
			expect(panel.scrollY).toBe(60);
			expect(onClick).not.toHaveBeenCalled();
			expect(onCancel).toHaveBeenCalledTimes(1);
		});

		it("a short press on a button in the list still clicks it", () => {
			const { buttons } = makeList();
			const onClick = vi.fn();
			buttons[1].onClickCallback = onClick;
			drag(150, 160, 150, 157, 1);
			expect(onClick).toHaveBeenCalledTimes(1);
		});

		it("a fling carries on and slows down", () => {
			const { panel } = makeList();
			const now = vi.spyOn(performance, "now");
			let t = 1000;
			now.mockImplementation(() => {
				return t;
			});
			pointer("pointermove", 150, 190);
			pointer("pointerdown", 150, 190);
			for (let i = 1; i <= 4; i++) {
				t += 16;
				pointer("pointermove", 150, 190 - i * 15);
			}
			pointer("pointerup", 150, 130);
			const released = panel.scrollY;
			panel.update(16);
			const after = panel.scrollY;
			expect(after).toBeGreaterThan(released);
			for (let i = 0; i < 200; i++) {
				panel.update(16);
			}
			const settled = panel.scrollY;
			panel.update(16);
			expect(panel.scrollY).toBe(settled);
		});

		it("a slider drag inside a scrolling panel moves the slider, not the panel", () => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 220,
					height: 100,
					layout: "column",
					scroll: "vertical",
				}),
			);
			const slider = panel.addChild(new UISlider(0, 0, {}));
			for (let i = 0; i < 6; i++) {
				panel.addChild(
					new UITextButton(0, 0, {
						text: "x",
						borderWidth: 200,
						borderHeight: 40,
					}),
				);
			}
			syncBroadphase();
			expect(panel.maxScrollY).toBeGreaterThan(0);
			drag(110, 110, 210, 150);
			expect(slider.value).toBeGreaterThan(0.4);
			expect(panel.scrollY).toBe(0);
		});

		it("a clipping container hides its cropped children from the pointer", () => {
			const box = place(new Container(100, 100, 100, 100));
			box.clipping = true;
			const b = new UITextButton(0, 150, {
				text: "x",
				borderWidth: 100,
				borderHeight: 40,
			});
			const onClick = vi.fn();
			b.onClickCallback = onClick;
			box.addChild(b);
			syncBroadphase();
			click(150, 270);
			expect(onClick).not.toHaveBeenCalled();
		});
	});

	describe("edge cases", () => {
		it("a draggable panel tapped with no hover first moves by touch", () => {
			const panel = place(
				new UIPanel(100, 100, { width: 200, height: 150, draggable: true }),
			);
			expect(() => {
				pointer("pointerdown", 150, 110);
			}).not.toThrow();
			pointer("pointermove", 170, 130);
			pointer("pointerup", 170, 130);
			expect(panel.pos.x).toBeCloseTo(120, 6);
			expect(panel.pos.y).toBeCloseTo(120, 6);
		});

		it("dragging a draggable panel by a button neither moves it nor clicks", () => {
			const panel = place(
				new UIPanel(100, 100, { width: 300, height: 200, draggable: true }),
			);
			const onClick = vi.fn();
			panel.addChild(
				new UITextButton(20, 20, {
					text: "x",
					borderWidth: 100,
					borderHeight: 40,
					onClick,
				}),
			);
			syncBroadphase();
			drag(150, 140, 200, 190);
			expect([panel.pos.x, panel.pos.y]).toEqual([100, 100]);
			expect(onClick).not.toHaveBeenCalled();
		});

		it("does not fling while the pointer is still down", () => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 200,
					height: 100,
					layout: "column",
					scroll: "vertical",
				}),
			);
			for (let i = 0; i < 10; i++) {
				const r = new Renderable(0, 0, 100, 40);
				r.anchorPoint.set(0, 0);
				panel.addChild(r);
			}
			syncBroadphase();
			pointer("pointermove", 150, 190);
			pointer("pointerdown", 150, 190);
			for (let i = 1; i <= 4; i++) {
				pointer("pointermove", 150, 190 - i * 15);
			}
			const held = panel.scrollY;
			for (let i = 0; i < 30; i++) {
				panel.update(16);
			}
			expect(panel.scrollY).toBe(held);
			pointer("pointerup", 150, 130);
		});

		it("autoSize counts the title and frame from a zero height", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 200,
					height: 0,
					title: "T",
					titleFontSize: 20,
					layout: "column",
					autoSize: true,
					align: "stretch",
				}),
			);
			const r = new Renderable(0, 0, 100, 40);
			r.anchorPoint.set(0, 0);
			panel.addChild(r);
			expect(panel.height).toBe(32 + 40);
		});

		it("a checkbox is as wide as its longer label, whichever it is", () => {
			const a = new UICheckbox(0, 0, {
				labelOn: "A much much longer label",
				labelOff: "Off",
			});
			const b = new UICheckbox(0, 0, {
				labelOn: "Off",
				labelOff: "A much much longer label",
			});
			expect(a.width).toBe(b.width);
			expect(a.width).toBeGreaterThan(100);
		});

		it("a scrolling panel inside another scrolls alone", () => {
			const outer = place(
				new UIPanel(100, 100, {
					width: 300,
					height: 200,
					layout: "column",
					scroll: "vertical",
				}),
			);
			const inner = outer.addChild(
				new UIPanel(0, 0, {
					width: 280,
					height: 100,
					layout: "column",
					scroll: "vertical",
				}),
			);
			for (let i = 0; i < 6; i++) {
				const r = new Renderable(0, 0, 100, 40);
				r.anchorPoint.set(0, 0);
				inner.addChild(r);
				const s = new Renderable(0, 0, 100, 40);
				s.anchorPoint.set(0, 0);
				outer.addChild(s);
			}
			outer.relayout();
			syncBroadphase();
			drag(150, 180, 150, 140);
			expect(inner.scrollY).toBe(40);
			expect(outer.scrollY).toBe(0);
		});

		it("emptying a scrolled panel does not report scrolls", () => {
			const onScroll = vi.fn();
			const panel = place(
				new UIPanel(0, 0, {
					width: 200,
					height: 100,
					layout: "column",
					scroll: "vertical",
					onScroll,
				}),
			);
			for (let i = 0; i < 10; i++) {
				const r = new Renderable(0, 0, 100, 40);
				r.anchorPoint.set(0, 0);
				panel.addChild(r);
			}
			panel.scrollTo(0, 250);
			onScroll.mockClear();
			// removed without keepalive: destroyed, which empties it
			app.world.removeChildNow(panel);
			expect(onScroll).not.toHaveBeenCalled();
		});

		it("a held button keeps its hover colour unless given a pressed one", () => {
			const b = new UITextButton(0, 0, { text: "x", hoverOnColor: "#123456" });
			// left undefined, so the held button follows hoverOnColor
			expect(b.pressedColor).toBeUndefined();
			const label = b.label;
			b.bitmapText = label;
			expect(b.label).toBe(label);
		});

		it("the wheel to the right raises a slider", () => {
			const s = place(new UISlider(100, 100, { value: 0.5, step: 0.1 }));
			pointer("pointermove", 150, 110);
			wheel(150, 110, 0, 100);
			expect(s.value).toBeCloseTo(0.6);
		});

		it("a drag ends on a release outside the canvas", () => {
			const onChangeEnd = vi.fn();
			const s = place(new UISlider(100, 100, { onChangeEnd }));
			pointer("pointermove", 110, 110);
			pointer("pointerdown", 110, 110);
			pointer("pointermove", 200, 110);
			window.dispatchEvent(
				new PointerEvent("pointerup", { pointerId: 1, bubbles: true }),
			);
			expect(s.dragging).toBe(false);
			expect(onChangeEnd).toHaveBeenCalledTimes(1);
		});

		it("another pointer, or another finger, lifting does not end a drag", () => {
			const s = place(new UISlider(100, 100, {}));
			pointer("pointermove", 110, 110);
			pointer("pointerdown", 110, 110);
			window.dispatchEvent(
				new PointerEvent("pointerup", { pointerId: 2, bubbles: true }),
			);
			window.dispatchEvent(new Event("touchend"));
			window.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
			expect(s.dragging).toBe(true);
			pointer("pointerup", 110, 110);
			expect(s.dragging).toBe(false);
		});

		it("stretch resizes buttons and panels, and leaves other widgets alone", () => {
			const panel = place(
				new UIPanel(0, 0, {
					width: 300,
					height: 300,
					layout: "column",
					align: "stretch",
				}),
			);
			const cb = panel.addChild(new UICheckbox(0, 0, { label: "x" }));
			const width = cb.width;
			const inner = panel.addChild(
				new UIPanel(0, 0, { width: 10, height: 20 }),
			);
			expect(cb.width).toBe(width);
			expect(inner.width).toBe(300);
		});

		it("a non-blocking scrolling panel inside another still scrolls alone", () => {
			const outer = place(
				new UIPanel(100, 100, {
					width: 300,
					height: 200,
					layout: "column",
					scroll: "vertical",
				}),
			);
			const inner = outer.addChild(
				new UIPanel(0, 0, {
					width: 280,
					height: 100,
					layout: "column",
					scroll: "vertical",
					blocking: false,
				}),
			);
			for (let i = 0; i < 6; i++) {
				for (const p of [inner, outer]) {
					const r = new Renderable(0, 0, 100, 40);
					r.anchorPoint.set(0, 0);
					p.addChild(r);
				}
			}
			syncBroadphase();
			drag(150, 180, 150, 140);
			expect(inner.scrollY).toBe(40);
			expect(outer.scrollY).toBe(0);
		});

		it("a draggable panel is not moved through a widget inside a container", () => {
			const panel = place(
				new UIPanel(100, 100, { width: 300, height: 200, draggable: true }),
			);
			const group = panel.addChild(new Container(20, 20, 200, 100));
			const onClick = vi.fn();
			group.addChild(
				new UITextButton(0, 0, {
					text: "x",
					width: 100,
					height: 40,
					onClick,
				}),
			);
			syncBroadphase();
			drag(150, 140, 200, 190);
			expect([panel.pos.x, panel.pos.y]).toEqual([100, 100]);
			expect(onClick).not.toHaveBeenCalled();
		});
	});

	describe("drop shadow", () => {
		it("draws under a panel, and hands the skin the full alpha", () => {
			const atlas = makeAtlas();
			const renderer = app.renderer;
			const fills = [];
			const rect = vi.spyOn(renderer, "fillRect").mockImplementation((...a) => {
				fills.push(a);
			});
			let alphaAtSkin;
			vi.spyOn(SkinDrawer.prototype, "draw").mockImplementation(() => {
				alphaAtSkin = renderer.globalAlpha();
			});
			const panel = new UIPanel(10, 20, {
				width: 100,
				height: 50,
				skin: { atlas, region: "up" },
				shadowColor: "#00000080",
				shadowOffsetX: 2,
				shadowOffsetY: 6,
				shadowBlur: 0,
			});
			renderer.setGlobalAlpha(1);
			panel.draw(renderer);
			// one sharp layer, offset, before the skin
			expect(fills[0]).toEqual([12, 26, 100, 50]);
			expect(alphaAtSkin).toBe(1);
			rect.mockRestore();
		});

		it("softens its edge over several layers with a blur", () => {
			const renderer = app.renderer;
			const rounded = [];
			vi.spyOn(renderer, "fill").mockImplementation((shape) => {
				rounded.push([shape.pos.x, shape.pos.y, shape.width, shape.height]);
			});
			const sharp = [];
			vi.spyOn(renderer, "fillRect").mockImplementation((...a) => {
				sharp.push(a);
			});
			const bar = new ProgressBar(0, 0, {
				width: 100,
				height: 10,
				trackColor: null,
				shadowColor: "#000000",
				shadowOffsetY: 0,
				shadowBlur: 8,
			});
			bar.draw(renderer);
			// rounded layers from 8 pixels out, then the bar's own outline
			expect(rounded[0]).toEqual([-8, -8, 116, 26]);
			expect(rounded.length).toBeGreaterThan(1);
			expect(sharp[0]).toEqual([0, 0, 100, 10]);
		});
	});

	describe("juice", () => {
		it("eases to hoverScale under the pointer and pressScale held", () => {
			const b = place(
				new UITextButton(100, 100, {
					text: "OK",
					width: 100,
					height: 40,
					hoverScale: 1.1,
					pressScale: 0.9,
				}),
			);
			const scale = vi.spyOn(app.renderer, "scale");
			b.preDraw(app.renderer);
			b.postDraw(app.renderer);
			expect(scale).not.toHaveBeenCalled();
			pointer("pointermove", 150, 120);
			for (let i = 0; i < 60; i++) {
				b.update(16);
			}
			b.preDraw(app.renderer);
			b.postDraw(app.renderer);
			expect(scale.mock.calls.at(-1)[0]).toBeCloseTo(1.1, 2);
			pointer("pointerdown", 150, 120);
			for (let i = 0; i < 60; i++) {
				b.update(16);
			}
			b.preDraw(app.renderer);
			b.postDraw(app.renderer);
			expect(scale.mock.calls.at(-1)[0]).toBeCloseTo(0.9, 2);
			pointer("pointerup", 150, 120);
		});

		it("scales only the drawing: the hit area stays", () => {
			const b = place(
				new UITextButton(100, 100, {
					text: "OK",
					width: 100,
					height: 40,
					hoverScale: 1.5,
				}),
			);
			const before = b.getBounds().width;
			pointer("pointermove", 150, 120);
			for (let i = 0; i < 60; i++) {
				b.update(16);
			}
			expect(b.getBounds().width).toBe(before);
		});
	});

	describe("UIFocus", () => {
		const key = (code, up = false) => {
			event.emit(up ? event.KEYUP : event.KEYDOWN, undefined, code);
		};
		const press = (code) => {
			key(code);
			key(code, true);
		};
		const column = () => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 220,
					height: 300,
					layout: "column",
					padding: 10,
				}),
			);
			const a = panel.addChild(
				new UITextButton(0, 0, { text: "A", width: 200 }),
			);
			const b = panel.addChild(
				new UITextButton(0, 0, { text: "B", width: 200 }),
			);
			const c = panel.addChild(new UICheckbox(0, 0, { label: "C" }));
			const d = panel.addChild(
				new UISlider(0, 0, { min: 0, max: 10, step: 1 }),
			);
			return { panel, a, b, c, d };
		};

		beforeAll(() => {
			UIFocus.enable();
		});
		afterAll(() => {
			UIFocus.disable();
		});
		afterEach(() => {
			UIFocus.focus(undefined);
		});

		it("the first arrow focuses the first widget, the next ones move", () => {
			const { a, b, c } = column();
			press(input.KEY.DOWN);
			expect(UIFocus.focused).toBe(a);
			expect(a.focused).toBe(true);
			press(input.KEY.DOWN);
			expect(UIFocus.focused).toBe(b);
			press(input.KEY.DOWN);
			expect(UIFocus.focused).toBe(c);
			press(input.KEY.UP);
			expect(UIFocus.focused).toBe(b);
			// nothing to the right: the focus stays
			press(input.KEY.RIGHT);
			expect(UIFocus.focused).toBe(b);
		});

		it("accept clicks a button and toggles a checkbox", () => {
			const { a, c } = column();
			const onClick = vi.fn();
			a.onClickCallback = onClick;
			const onChange = vi.fn();
			c.onChange = onChange;
			UIFocus.focus(a);
			key(input.KEY.ENTER);
			// down while held, as under a pointer
			expect(a.released).toBe(false);
			expect(onClick).not.toHaveBeenCalled();
			key(input.KEY.ENTER, true);
			expect(onClick).toHaveBeenCalledTimes(1);
			UIFocus.focus(c);
			press(input.KEY.SPACE);
			expect(c.checked).toBe(true);
			expect(onChange).toHaveBeenCalledWith(true, c);
		});

		it("left and right step a slider, which keeps the focus", () => {
			const { d } = column();
			const onChange = vi.fn();
			const onChangeEnd = vi.fn();
			d.onChange = onChange;
			d.onChangeEnd = onChangeEnd;
			UIFocus.focus(d);
			press(input.KEY.RIGHT);
			press(input.KEY.RIGHT);
			expect(d.value).toBe(2);
			press(input.KEY.LEFT);
			expect(d.value).toBe(1);
			expect(UIFocus.focused).toBe(d);
			expect(onChange).toHaveBeenCalledTimes(3);
			expect(onChangeEnd).toHaveBeenCalledTimes(3);
		});

		it("skips disabled widgets", () => {
			const { a, b, c } = column();
			b.enabled = false;
			UIFocus.focus(a);
			press(input.KEY.DOWN);
			expect(UIFocus.focused).toBe(c);
		});

		it("shows the ring after a key, and hides it when the mouse moves", () => {
			const { a } = column();
			UIFocus.focus(a);
			press(input.KEY.DOWN);
			expect(UIFocus.ringVisible).toBe(true);
			pointer("pointermove", 700, 500);
			expect(UIFocus.ringVisible).toBe(false);
		});

		it("scrolls a focused widget into view", () => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 200,
					height: 100,
					layout: "column",
					gap: 0,
					scroll: "vertical",
				}),
			);
			const buttons = [];
			for (let i = 0; i < 8; i++) {
				buttons.push(
					panel.addChild(
						new UITextButton(0, 0, { text: `${i}`, width: 200, height: 40 }),
					),
				);
			}
			UIFocus.focus(buttons[0]);
			for (let i = 0; i < 5; i++) {
				press(input.KEY.DOWN);
			}
			expect(UIFocus.focused).toBe(buttons[5]);
			// its bottom, plus room for the ring, at the bottom of the view
			expect(panel.scrollY).toBe(150);
		});

		it("a gamepad's D-pad moves the focus and A clicks", () => {
			const { a, b } = column();
			const onClick = vi.fn();
			b.onClickCallback = onClick;
			const buttons = [];
			for (let i = 0; i < 17; i++) {
				buttons.push({ pressed: false, value: 0 });
			}
			const pad = { id: "test pad", buttons, axes: [0, 0, 0, 0] };
			input.addVirtualGamepad(pad, 0);
			try {
				UIFocus.focus(a);
				let t = 1000;
				const frame = () => {
					t += 16;
					event.emit(event.GAME_BEFORE_UPDATE, t);
				};
				buttons[input.GAMEPAD.BUTTONS.DOWN].pressed = true;
				frame();
				buttons[input.GAMEPAD.BUTTONS.DOWN].pressed = false;
				frame();
				expect(UIFocus.focused).toBe(b);
				buttons[input.GAMEPAD.BUTTONS.FACE_1].pressed = true;
				frame();
				buttons[input.GAMEPAD.BUTTONS.FACE_1].pressed = false;
				frame();
				expect(onClick).toHaveBeenCalledTimes(1);
			} finally {
				input.removeVirtualGamepad(pad);
			}
		});

		it("starts on the left of a row, even if a widget on the right sits higher", () => {
			const left = place(new UITextButton(20, 110, { text: "L" }));
			const right = place(new UITextButton(500, 100, { text: "R" }));
			press(input.KEY.DOWN);
			expect(UIFocus.focused).toBe(left);
			void right;
		});

		it("is off until enabled, and drops the focus when disabled", () => {
			const { a } = column();
			UIFocus.focus(a);
			UIFocus.disable();
			expect(UIFocus.focused).toBeUndefined();
			press(input.KEY.DOWN);
			expect(UIFocus.focused).toBeUndefined();
			UIFocus.enable();
		});
	});

	describe("API", () => {
		it("enabled is shared by every widget, the panel included", () => {
			const panel = new UIPanel(0, 0, { width: 10, height: 10 });
			expect(panel.enabled).toBe(true);
			panel.enabled = false;
			expect(panel.isClickable).toBe(false);
			const s = new UISlider(0, 0, {});
			s.enabled = false;
			expect(s.isClickable).toBe(false);
		});

		it("a button takes width, height, fontSize and labelFillStyle", () => {
			const settings = {
				text: "OK",
				width: 120,
				height: 30,
				fontSize: 20,
				labelFillStyle: "#ff0000",
			};
			const b = new UITextButton(0, 0, settings);
			expect([b.width, b.height]).toEqual([120, 30]);
			expect(b.label.fontSize ?? b.label.font).toBeDefined();
			// the settings are read, not written back
			expect(Object.keys(settings)).toEqual([
				"text",
				"width",
				"height",
				"fontSize",
				"labelFillStyle",
			]);
			// one object, two buttons of their own sizes
			const shared = { text: "A" };
			const one = new UITextButton(0, 0, shared);
			const two = new UITextButton(0, 0, {
				...shared,
				text: "A much longer one",
			});
			expect(two.width).toBeGreaterThan(one.width);
			expect(shared).toEqual({ text: "A" });
		});

		it("slider min, max and step can change, silently re-clamping", () => {
			const onChange = vi.fn();
			const s = new UISlider(0, 0, { min: 0, max: 10, value: 8, onChange });
			expect(s.ratio).toBeCloseTo(0.8);
			s.max = 5;
			expect(s.value).toBe(5);
			s.step = 2;
			expect(s.value).toBe(4);
			s.min = 4.5;
			expect(s.value).toBe(4.5);
			expect(onChange).not.toHaveBeenCalled();
		});

		it("valueFormat gets the ratio, and setting it rewrites the text", () => {
			const s = new UISlider(0, 0, {
				showValue: true,
				min: 0,
				max: 200,
				value: 50,
			});
			s.valueFormat = (v, ratio) => {
				return `${v}/${Math.round(ratio * 100)}%`;
			};
			expect(textOf(s.valueText)).toBe("50/25%");
		});

		it("a tiny step keeps its decimals", () => {
			const s = new UISlider(0, 0, { min: 0, max: 1e-6, step: 1e-7 });
			s.value = 3e-7;
			expect(s.value).toBeCloseTo(3e-7, 12);
		});

		it("checkbox labels can change, and the widget refits", () => {
			const cb = new UICheckbox(0, 0, { label: "x" });
			const narrow = cb.width;
			cb.labelOff = "A much longer label";
			expect(cb.width).toBeGreaterThan(narrow);
			expect(textOf(cb.label)).toBe("A much longer label");
		});

		it("changing a checkbox's group moves it there at once", () => {
			const a = place(new UICheckbox(0, 0, { group: "ga", checked: true }));
			const b = place(new UICheckbox(0, 40, { group: "gb", checked: true }));
			a.group = "gb";
			expect(UICheckbox.checkedIn("ga")).toBeUndefined();
			// a joined checked, so it is the one left checked in gb
			expect(a.checked).toBe(true);
			expect(b.checked).toBe(false);
		});

		it("a disabled skinned checkbox shows whether it is checked", () => {
			const atlas = makeAtlas();
			const spy = vi.spyOn(SkinDrawer.prototype, "draw");
			const cb = new UICheckbox(0, 0, {
				skin: {
					atlas,
					on: "on",
					off: "off",
					disabledOn: "up",
					disabledOff: "down",
				},
				checked: true,
				enabled: false,
			});
			cb.draw(app.renderer);
			expect(spy.mock.calls.at(-1)[1]).toBe("up");
			cb.checked = false;
			cb.draw(app.renderer);
			expect(spy.mock.calls.at(-1)[1]).toBe("down");
		});
	});

	describe("UIPanel dragging", () => {
		it("moves by its title, and comes to the front", () => {
			const back = place(
				new UIPanel(100, 100, {
					width: 200,
					height: 150,
					draggable: true,
					title: "A",
				}),
			);
			const front = place(new UIPanel(400, 100, { width: 200, height: 150 }));
			syncBroadphase();
			const moveToTop = vi.spyOn(app.world, "moveToTop");
			drag(150, 110, 250, 210);
			expect(back.pos.x).toBeCloseTo(200, 6);
			expect(back.pos.y).toBeCloseTo(200, 6);
			expect(moveToTop).toHaveBeenCalledWith(back);
			void front;
		});

		it("a scrolling one scrolls from its content instead of moving", () => {
			const panel = place(
				new UIPanel(100, 100, {
					width: 200,
					height: 100,
					draggable: true,
					layout: "column",
					scroll: "vertical",
				}),
			);
			for (let i = 0; i < 6; i++) {
				const r = new Renderable(0, 0, 100, 40);
				r.anchorPoint.set(0, 0);
				panel.addChild(r);
			}
			syncBroadphase();
			drag(150, 180, 150, 140);
			expect([panel.pos.x, panel.pos.y]).toEqual([100, 100]);
			expect(panel.scrollY).toBe(40);
		});
	});
});

for (const backend of [video.CANVAS, video.WEBGL]) {
	describe(`UI widgets draw (${backend === video.CANVAS ? "Canvas" : "WebGL"})`, () => {
		let local;
		beforeAll(async () => {
			boot();
			local = new Application(320, 240, {
				parent: "screen",
				renderer: backend,
				failIfMajorPerformanceCaveat: false,
			});
			await local.init();
		});

		it("all four draw, drawn and skinned, without throwing", () => {
			const atlas = makeAtlas();
			const panel = new UIPanel(0, 0, {
				width: 300,
				height: 120,
				title: "T",
				fillColor: "#123",
				borderColor: "#fff",
				borderWidth: 2,
				radius: 6,
				layout: "column",
				scroll: "vertical",
				padding: 4,
			});
			panel.addChild(new UITextButton(0, 0, { text: "drawn" }));
			panel.addChild(
				new UITextButton(0, 0, {
					text: "skinned",
					skin: { atlas, normal: "up", pressed: "down" },
				}),
			);
			panel.addChild(new UICheckbox(0, 0, { label: "box", checked: true }));
			panel.addChild(new UICheckbox(0, 0, { label: "radio", group: "draw" }));
			panel.addChild(
				new UICheckbox(0, 0, { skin: { atlas, on: "on", off: "off" } }),
			);
			panel.addChild(
				new UISlider(0, 0, { label: "drawn", showValue: true, value: 0.3 }),
			);
			panel.addChild(
				new UISlider(0, 0, {
					orientation: "vertical",
					length: 60,
					skin: { atlas, track: "up", fill: "on", thumb: "off" },
				}),
			);
			local.world.addChild(panel);
			// the whole chain a frame runs on the panel: its background, the
			// title, the clip, each widget, the scrollbar
			const frame = () => {
				const renderer = local.renderer;
				renderer.clear();
				panel.preDraw(renderer);
				panel.draw(renderer);
				panel.postDraw(renderer);
				renderer.flush();
			};
			expect(frame).not.toThrow();
			panel.scrollTo(0, 50);
			expect(panel.scrollY).toBe(50);
			expect(frame).not.toThrow();
			local.world.removeChildNow(panel);
		});
	});
}
