import {
	Application as App,
	type Application,
	ColorLayer,
	loader,
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
	}
}

const createGame = () => {
	new App(800, 600, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "flex-width",
	});

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
