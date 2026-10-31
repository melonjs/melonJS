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
	UIBaseElement,
	UICheckbox,
	UIPanel,
	UISlider,
	UITextButton,
	video,
} from "../src/index.js";
import { ringVisible } from "../src/renderable/ui/uifocus.ts";
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

const R = [];
describe("PROBE", () => {
	afterAll(() => {
		throw new Error("RESULTS\n" + R.map((r) => JSON.stringify(r)).join("\n"));
	});
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
		for (const w of added.splice(0)) {
			if (w.ancestor !== undefined) app.world.removeChildNow(w);
		}
		pointer("pointerup", 799, 599);
		vi.restoreAllMocks();
	});
	const cancel = (x, y) => {
		app.renderer
			.getCanvas()
			.dispatchEvent(
				new PointerEvent("pointercancel", {
					...at(x, y),
					pointerId: 1,
					isPrimary: true,
					bubbles: true,
				}),
			);
	};
	it("A slider step change keeps stale default format", () => {
		const s = new UISlider(0, 0, {
			showValue: true,
			min: 0,
			max: 10,
			value: 5,
		});
		const before = textOf(s.valueText);
		s.step = 1;
		R.push(["A before", before, "after step=1", textOf(s.valueText)]);
	});
	it("B wheel deltaMode lines", () => {
		const panel = place(
			new UIPanel(100, 100, {
				width: 200,
				height: 100,
				layout: "column",
				gap: 0,
				scroll: "vertical",
			}),
		);
		for (let i = 0; i < 10; i++) {
			const r = new Renderable(0, 0, 100, 40);
			r.anchorPoint.set(0, 0);
			panel.addChild(r);
		}
		syncBroadphase();
		pointer("pointermove", 150, 150);
		app.renderer
			.getCanvas()
			.dispatchEvent(
				new WheelEvent("wheel", {
					...at(150, 150),
					deltaY: 2,
					deltaMode: 1,
					bubbles: true,
					cancelable: true,
				}),
			);
		R.push(["B lines scrollY", panel.scrollY]);
		app.renderer
			.getCanvas()
			.dispatchEvent(
				new WheelEvent("wheel", {
					...at(150, 150),
					deltaY: 1,
					deltaMode: 2,
					bubbles: true,
					cancelable: true,
				}),
			);
		R.push(["B pages scrollY", panel.scrollY]);
	});
	it("C horizontal panel plain wheel", () => {
		const panel = place(
			new UIPanel(100, 100, {
				width: 200,
				height: 100,
				layout: "row",
				gap: 0,
				scroll: "horizontal",
			}),
		);
		for (let i = 0; i < 10; i++) {
			const r = new Renderable(0, 0, 40, 40);
			r.anchorPoint.set(0, 0);
			panel.addChild(r);
		}
		syncBroadphase();
		R.push(["C max", panel.maxScrollX, panel.maxScrollY]);
		pointer("pointermove", 150, 150);
		wheel(150, 150, 30);
		R.push(["C scrollX", panel.scrollX]);
	});
	it("D0 container no clip", () => {
		const box = place(new Container(100, 100, 100, 100));
		const onClick = vi.fn();
		box.addChild(
			new UITextButton(0, 0, { text: "x", width: 100, height: 40, onClick }),
		);
		syncBroadphase();
		click(150, 120);
		R.push(["D0 no clip clicks", onClick.mock.calls.length]);
		const box2 = place(new Container(100, 300, 100, 100));
		box2.floating = true;
		box2.clipping = true;
		const onClick2 = vi.fn();
		box2.addChild(
			new UITextButton(0, 0, {
				text: "x",
				width: 100,
				height: 40,
				onClick: onClick2,
			}),
		);
		syncBroadphase();
		click(150, 320);
		R.push([
			"D1 floating clip container inside clicks",
			onClick2.mock.calls.length,
		]);
		const box3 = place(new Container(400, 100, 100, 100));
		box3.clipping = true;
		const onClick3 = vi.fn();
		const b3 = new UITextButton(0, 0, {
			text: "x",
			width: 100,
			height: 40,
			onClick: onClick3,
		});
		b3.floating = false;
		box3.addChild(b3);
		syncBroadphase();
		click(450, 120);
		R.push([
			"D2 world clip container, non-floating button clicks",
			onClick3.mock.calls.length,
		]);
	});
	it("D3 existing test without clipping", () => {
		const box = place(new Container(100, 100, 100, 100));
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
		R.push([
			"D3 same setup, clipping OFF, clicks",
			onClick.mock.calls.length,
			b.getBounds().left,
			b.getBounds().top,
		]);
		const c = new Container(0, 0, 10, 10);
		c.destroy();
		try {
			c.destroy();
			R.push(["D3 container twice ok"]);
		} catch (e) {
			R.push(["D3 container twice THROW", e.message]);
		}
	});
	it("D clipping container positive", () => {
		const box = place(new Container(100, 100, 100, 100));
		box.clipping = true;
		const onClick = vi.fn();
		box.addChild(
			new UITextButton(0, 0, { text: "x", width: 100, height: 40, onClick }),
		);
		syncBroadphase();
		click(150, 120);
		R.push(["D inside clip clicks", onClick.mock.calls.length]);
	});
	it("E pointercancel on button/checkbox/slider", () => {
		const onClick = vi.fn();
		place(
			new UITextButton(100, 100, {
				text: "x",
				width: 100,
				height: 40,
				onClick,
			}),
		);
		const cb = place(new UICheckbox(300, 100, {}));
		const end = vi.fn();
		const s = place(new UISlider(100, 300, { onChangeEnd: end }));
		syncBroadphase();
		pointer("pointermove", 150, 120);
		pointer("pointerdown", 150, 120);
		cancel(150, 120);
		pointer("pointermove", 310, 110);
		pointer("pointerdown", 310, 110);
		cancel(310, 110);
		pointer("pointermove", 110, 310);
		pointer("pointerdown", 110, 310);
		pointer("pointermove", 200, 310);
		cancel(200, 310);
		R.push([
			"E button clicks",
			onClick.mock.calls.length,
			"cb",
			cb.checked,
			"slider dragging",
			s.dragging,
			"onChangeEnd",
			end.mock.calls.length,
		]);
	});
	it("F shadow under faded parent", () => {
		const r = app.renderer;
		const alphas = [];
		vi.spyOn(r, "fillRect").mockImplementation(() => {
			alphas.push(r.globalAlpha());
		});
		const panel = new UIPanel(0, 0, {
			width: 100,
			height: 50,
			shadowColor: "#00000080",
			shadowBlur: 0,
		});
		r.setGlobalAlpha(0.5);
		panel.draw(r);
		R.push(["F shadow alpha at 0.5 cascade", alphas, "after", r.globalAlpha()]);
		r.setGlobalAlpha(1);
	});
	it("G removeChild while scrolled then re-add", () => {
		const panel = place(
			new UIPanel(0, 0, { width: 200, height: 100, scroll: "vertical" }),
		);
		const rs = [];
		for (let i = 0; i < 10; i++) {
			const r = new Renderable(0, i * 40, 100, 40);
			r.anchorPoint.set(0, 0);
			rs.push(panel.addChild(r));
		}
		panel.scrollTo(0, 120);
		const r5 = rs[5];
		panel.removeChildNow(r5, true);
		R.push(["G removed pos", r5.pos.y]);
		panel.addChild(r5);
		R.push([
			"G readded pos",
			r5.pos.y,
			"max",
			panel.maxScrollY,
			"scroll",
			panel.scrollY,
		]);
	});
	it("H slider disabled mid-drag", () => {
		const end = vi.fn();
		const s = place(new UISlider(100, 100, { onChangeEnd: end }));
		pointer("pointermove", 110, 110);
		pointer("pointerdown", 110, 110);
		pointer("pointermove", 200, 110);
		s.enabled = false;
		pointer("pointermove", 250, 110);
		const v = s.value;
		R.push([
			"H dragging",
			s.dragging,
			"end",
			end.mock.calls.length,
			"value",
			v,
		]);
	});
	it("I destroy twice", () => {
		const atlas = makeAtlas();
		const ws = [
			new UITextButton(0, 0, { text: "x", skin: { atlas, normal: "up" } }),
			new UICheckbox(0, 0, {
				label: "x",
				skin: { atlas, on: "on", off: "off" },
			}),
			new UISlider(0, 0, { label: "x", showValue: true }),
			new UIPanel(0, 0, {
				width: 10,
				height: 10,
				title: "T",
				radius: 4,
				fillColor: "#fff",
				skin: { atlas, region: "up" },
			}),
		];
		for (const w of ws) {
			try {
				w.draw(app.renderer);
			} catch (e) {
				R.push(["I drawthrow", w.constructor.name, e.message]);
			}
		}
		for (const w of ws) {
			try {
				w.destroy();
				R.push(["I once ok", w.constructor.name]);
				w.destroy();
				R.push(["I twice ok", w.constructor.name]);
			} catch (e) {
				R.push(["I THROW", w.constructor.name, e.message]);
			}
		}
	});
	it("J nested clip: scroll panel inside clipping container", () => {
		const box = place(new Container(100, 100, 300, 60));
		box.clipping = true;
		const panel = box.addChild(
			new UIPanel(0, 0, {
				width: 200,
				height: 200,
				layout: "column",
				gap: 0,
				scroll: "vertical",
			}),
		);
		const onClick = vi.fn();
		const bs = [];
		for (let i = 0; i < 8; i++)
			bs.push(
				panel.addChild(
					new UITextButton(0, 0, { text: "x", width: 200, height: 40 }),
				),
			);
		bs[2].onClickCallback = onClick; // at 80..120 in panel → 180..220 screen; container clips at 160
		syncBroadphase();
		click(150, 190);
		R.push(["J clipped by outer container clicks", onClick.mock.calls.length]);
	});
	it("K step setter onNavigate no step on vertical", () => {
		const s = new UISlider(0, 0, { orientation: "vertical", min: 0, max: 1 });
		R.push([
			"K up",
			s.onNavigate("up"),
			s.value,
			"left",
			s.onNavigate("left"),
			s.value,
		]);
	});
	it("L group setter when unchecked & checked leaves old group", () => {
		const a = place(new UICheckbox(0, 0, { group: "x1", checked: true }));
		a.group = undefined;
		R.push(["L checkedIn x1", UICheckbox.checkedIn("x1")]);
	});
	it("M labelOn to empty destroys label", () => {
		const cb = new UICheckbox(0, 0, { label: "abc" });
		cb.labelOn = "";
		cb.labelOff = "";
		R.push(["M label", cb.label, cb.width, cb.height]);
		cb.labelOn = "back";
		R.push(["M label back", cb.label && textOf(cb.label), cb.width]);
	});
});
