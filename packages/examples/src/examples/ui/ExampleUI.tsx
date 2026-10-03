/**
 * melonJS — UI widget showcase example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application as App,
	type Application,
	Color,
	ColorLayer,
	Container,
	input,
	loader,
	ProgressBar,
	Stage,
	state,
	Text,
	TextureAtlas,
	UIBaseElement,
	UISpriteElement,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/ui/`;

let texture: TextureAtlas;

class ButtonUI extends UISpriteElement {
	private unclicked_region: object;
	private clicked_region: object;
	label: Text;

	constructor(x: number, y: number, color: string, labelText: string) {
		super(x, y, {
			image: texture,
			region: `${color}_button04`,
		});

		this.unclicked_region = texture.getRegion(`${color}_button04`);
		this.clicked_region = texture.getRegion(`${color}_button05`);
		this.anchorPoint.set(0, 0);
		this.setOpacity(0.5);
		this.floating = false;

		// create label as a sibling — added to the parent by the caller
		this.label = new Text(x + this.width / 2, y + this.height / 2, {
			font: "kenpixel",
			size: 12,
			fillStyle: "black",
			textAlign: "center",
			textBaseline: "middle",
			text: labelText,
		});
	}

	override onOver() {
		this.setOpacity(1.0);
	}

	override onOut() {
		this.setOpacity(0.5);
	}

	override onClick() {
		this.translate(
			0,
			this.height - (this.clicked_region as { height: number }).height,
		);
		this.setRegion(this.clicked_region);
		return false;
	}

	override onRelease() {
		this.setRegion(this.unclicked_region);
		this.translate(
			0,
			-(this.height - (this.clicked_region as { height: number }).height),
		);
		return false;
	}
}

class CheckBoxUI extends UISpriteElement {
	private on_icon_region: object;
	private off_icon_region: object;
	private isSelected: boolean;
	private label_on: string;
	private label_off: string;
	label: Text;

	constructor(
		x: number,
		y: number,
		tex: TextureAtlas,
		onIcon: string,
		offIcon: string,
		onLabel: string,
		offLabel: string,
	) {
		super(x, y, {
			image: tex,
			region: onIcon,
		});

		this.on_icon_region = tex.getRegion(onIcon);
		this.off_icon_region = tex.getRegion(offIcon);
		this.setOpacity(0.5);
		this.isSelected = true;
		this.label_on = onLabel;
		this.label_off = offLabel;
		this.floating = false;

		// create label as a sibling — added to the parent by the caller
		this.label = new Text(x + this.width, y + this.height / 2, {
			font: "kenpixel",
			size: 12,
			fillStyle: "black",
			textAlign: "left",
			textBaseline: "middle",
			text: onLabel,
		});
	}

	override onOver() {
		this.setOpacity(1.0);
	}

	override onOut() {
		this.setOpacity(0.5);
	}

	setSelected(selected: boolean) {
		if (selected) {
			this.setRegion(this.on_icon_region);
			this.isSelected = true;
			this.label.setText(this.label_on);
		} else {
			this.setRegion(this.off_icon_region);
			this.isSelected = false;
			this.label.setText(this.label_off);
		}
	}

	override onClick() {
		this.setSelected(!this.isSelected);
		return false;
	}
}

class UIContainer extends UIBaseElement {
	constructor(
		x: number,
		y: number,
		width: number,
		height: number,
		label: string,
	) {
		super(x, y, width, height);
		this.anchorPoint.set(0, 0);
		this.name = "UIPanel";

		this.addChild(
			texture.createSpriteFromName(
				"grey_panel",
				{
					width: this.width,
					height: this.height,
				},
				true,
			),
		);

		this.addChild(
			new Text(this.width / 2, 16, {
				font: "kenpixel",
				size: 20,
				fillStyle: "black",
				textAlign: "center",
				textBaseline: "top",
				text: label,
			}),
		);

		this.isHoldable = true;
		this.isDraggable = true;
	}

	/**
	 * Bring this panel to the front of whatever holds it.
	 *
	 * Two panels that can be dragged will overlap, and without this the one
	 * you grabbed goes on being drawn under the other: a click would pick up
	 * the panel on top rather than the one being pointed at.
	 *
	 * `moveToTop` is the container's own job, so it is asked of the ancestor
	 * rather than done by writing `depth` here. It reorders the child list AND
	 * sets the depth past its new neighbour, which is what the sort then
	 * reads.
	 *
	 * The `instanceof` is not defensiveness: `ancestor` is typed
	 * `Entity | Container`, and only a container has `moveToTop`. Narrowing is
	 * what makes that safe without a cast.
	 * @returns false, which CONSUMES the click. A panel is opaque, so a click
	 * on it must not also reach whatever it is covering. The sense is the DOM
	 * one and the opposite of what it looks like: `triggerEvent` stops the
	 * walk when a handler returns `false`, so `false` means handled and
	 * anything else lets the event carry on down to whatever is underneath.
	 */
	override onClick() {
		if (this.ancestor instanceof Container) {
			this.ancestor.moveToTop(this);
		}
		return false;
	}

	/**
	 * Hovering an opaque panel must not light up a button it covers.
	 * @returns false, consuming the event in the same sense as
	 * {@link UIContainer#onClick}
	 */
	override onOver() {
		return false;
	}

	/**
	 * `onOver` only runs on the frame the pointer crosses INTO the panel. On
	 * every frame after that the pointer is already inside, so the dispatcher
	 * skips the enter callbacks and reaches the plain `pointermove` ones
	 * instead. Consuming those too is what keeps the panel opaque to hover for
	 * as long as the pointer stays on it.
	 */
	override onActivateEvent() {
		super.onActivateEvent();
		input.registerPointerEvent("pointermove", this, () => false);
	}

	override onDeactivateEvent() {
		input.releasePointerEvent("pointermove", this);
		super.onDeactivateEvent();
	}
}

class PlayScreen extends Stage {
	override onResetEvent(app: Application) {
		app.world.addChild(
			new ColorLayer("background", "rgba(248, 194, 40, 1.0)"),
			0,
		);

		const panel = new UIContainer(100, 100, 450, 325, "OPTIONS");

		const cbPanel = new UIBaseElement(125, 75, 100, 100);

		const cb1 = new CheckBoxUI(
			0,
			0,
			texture,
			"green_boxCheckmark",
			"grey_boxCheckmark",
			"Music ON",
			"Music OFF",
		);
		cbPanel.addChild(cb1);
		cbPanel.addChild(cb1.label);

		const cb2 = new CheckBoxUI(
			0,
			50,
			texture,
			"green_boxCheckmark",
			"grey_boxCheckmark",
			"Sound FX ON",
			"Sound FX OFF",
		);
		cbPanel.addChild(cb2);
		cbPanel.addChild(cb2.label);

		panel.addChild(cbPanel);

		const btn1 = new ButtonUI(125, 175, "blue", "Video Options");
		panel.addChild(btn1);
		panel.addChild(btn1.label);

		const btn2 = new ButtonUI(30, 250, "green", "Accept");
		panel.addChild(btn2);
		panel.addChild(btn2.label);

		const btn3 = new ButtonUI(230, 250, "yellow", "Cancel");
		panel.addChild(btn3);
		panel.addChild(btn3.label);

		app.world.addChild(panel, 1);
		this.addBars(app);
	}

	/**
	 * `ProgressBar`, in the shapes it tends to be wanted in.
	 *
	 * In a panel of its own, like the options on the left: a bar is a UI
	 * widget, and showing it loose on the background would say otherwise.
	 *
	 * All of them are drawn with primitives and no artwork. The track and the
	 * fill are `fillRect`; a square border is four more rects, so it lands
	 * exactly inside the bar and keeps its corners; a rounded one goes through
	 * the `RoundRect` shape path instead.
	 * @param app - the application
	 */
	private addBars(app: Application) {
		const panel = new UIContainer(600, 100, 340, 400, "PROGRESS");

		/**
		 * one caption, in the panel's own coordinates
		 * @param x - left edge
		 * @param y - top edge
		 * @param text - what it says
		 * @returns the label
		 */
		const caption = (x: number, y: number, text: string) => {
			return new Text(x, y, {
				font: "kenpixel",
				size: 13,
				fillStyle: "black",
				textAlign: "left",
				textBaseline: "top",
				text,
			});
		};

		// 1. square, bordered, with the built-in percentage label
		panel.addChild(caption(24, 52, "squared + label"));
		panel.addChild(
			new ProgressBar(24, 72, {
				width: 290,
				height: 24,
				value: 0.72,
				trackColor: "#0000001a",
				fillColor: "#4a8fd4",
				borderColor: "black",
				borderWidth: 2,
				padding: 2,
				showLabel: true,
				font: "kenpixel",
				fontSize: 12,
				labelFillStyle: "white",
			}),
		);

		// 2. ROUNDED, which takes the shape path rather than `fillRect`
		panel.addChild(caption(24, 112, "rounded"));
		panel.addChild(
			new ProgressBar(24, 132, {
				width: 290,
				height: 24,
				value: 0.45,
				radius: 12,
				trackColor: "#0000001a",
				fillColor: "#59b25b",
				borderColor: "black",
				borderWidth: 2,
				padding: 3,
			}),
		);

		// 3. vertical, filling upward, with a gradient down its length
		panel.addChild(caption(24, 232, "vertical"));
		const ramp = app.renderer.createLinearGradient(0, 372, 0, 252);
		ramp.addColorStop(0, "#d4553a");
		ramp.addColorStop(0.5, "#e8c84a");
		ramp.addColorStop(1, "#59b25b");
		panel.addChild(
			new ProgressBar(24, 252, {
				width: 30,
				height: 120,
				value: 0.8,
				direction: "bottom-to-top",
				trackColor: "#0000001a",
				fillColor: ramp,
				borderColor: "black",
				borderWidth: 2,
				padding: 3,
				radius: 8,
			}),
		);

		// 4. a value-driven colour. The bar re-reads `fillColor` every frame,
		// so a `Color` the caller keeps and mutates is all an animated one
		// takes; no rule about it lives in the bar.
		panel.addChild(caption(150, 232, "live colour"));
		const hot = new Color().parseCSS("#d4553a");
		const cool = new Color().parseCSS("#4a8fd4");
		const mixed = new Color().copy(cool);
		const pulse = new ProgressBar(150, 252, {
			width: 30,
			height: 120,
			value: 1,
			direction: "bottom-to-top",
			trackColor: "#0000001a",
			fillColor: mixed,
			borderColor: "black",
			borderWidth: 2,
			padding: 3,
		});
		panel.addChild(pulse);

		// 5. right-to-left, which is the mirrored form a second player gets
		panel.addChild(caption(24, 172, "right to left"));
		const mirrored = new ProgressBar(24, 192, {
			width: 290,
			height: 24,
			value: 0.6,
			direction: "right-to-left",
			trackColor: "#0000001a",
			fillColor: "#b25b9b",
			borderColor: "black",
			borderWidth: 2,
			padding: 2,
		});
		panel.addChild(mirrored);

		app.world.addChild(panel, 1);

		let t = 0;
		this.pulseUpdate = (dt: number) => {
			t = (t + dt / 2200) % 1;
			const v = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
			pulse.value = v;
			mixed.copy(hot).lerp(cool, v);
		};
	}

	/** drives the live-colour bar; see {@link PlayScreen.addBars} */
	private pulseUpdate?: (dt: number) => void;

	/**
	 * @param dt - milliseconds since the last frame
	 * @returns true, since the pulsing bar always has something to redraw
	 */
	override update(dt: number) {
		super.update(dt);
		this.pulseUpdate?.(dt);
		return true;
	}
}

const createGame = async () => {
	const app = new App(800, 600, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "flex-width",
	});
	await app.init();

	const resources = [
		{ name: "UI_Assets-0", type: "image", src: `${base}img/UI_Assets-0.png` },
		{ name: "UI_Assets-1", type: "image", src: `${base}img/UI_Assets-1.png` },
		{ name: "UI_Assets-2", type: "image", src: `${base}img/UI_Assets-2.png` },
		{ name: "UI_Assets-0", type: "json", src: `${base}img/UI_Assets-0.json` },
		{ name: "UI_Assets-1", type: "json", src: `${base}img/UI_Assets-1.json` },
		{ name: "UI_Assets-2", type: "json", src: `${base}img/UI_Assets-2.json` },
		{
			name: "kenpixel",
			type: "fontface",
			src: `${base}font/kenvector_future.woff2`,
		},
	];

	loader.preload(resources, () => {
		texture = new TextureAtlas([
			loader.getJSON("UI_Assets-0"),
			loader.getJSON("UI_Assets-1"),
			loader.getJSON("UI_Assets-2"),
		]);

		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY);
	});
};

export const ExampleUI = createExampleComponent(createGame);
