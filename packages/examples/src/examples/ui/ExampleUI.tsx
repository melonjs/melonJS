import {
	ColorLayer,
	game,
	loader,
	Stage,
	state,
	Text,
	TextureAtlas,
	UIBaseElement,
	UISpriteElement,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/ui/`;

let texture: TextureAtlas;

class ButtonUI extends UISpriteElement {
	private unclicked_region: object;
	private clicked_region: object;
	private font: Text;
	private label: string;

	constructor(x: number, y: number, color: string, label: string) {
		super(x, y, {
			image: texture,
			region: `${color}_button04`,
		});

		this.unclicked_region = texture.getRegion(`${color}_button04`);
		this.clicked_region = texture.getRegion(`${color}_button05`);
		this.anchorPoint.set(0, 0);
		this.setOpacity(0.5);
		this.label = label;
		this.floating = false;

		this.font = new Text(0, 0, {
			font: "kenpixel",
			size: 12,
			fillStyle: "black",
			textAlign: "center",
			textBaseline: "middle",
			offScreenCanvas: video.renderer.WebGLVersion >= 1,
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

	override draw(renderer: Parameters<UISpriteElement["draw"]>[0]) {
		super.draw(renderer);
		this.font.draw(
			renderer,
			this.label,
			this.pos.x + this.width / 2,
			this.pos.y + this.height / 2,
		);
	}

	override onDestroyEvent() {
		this.font.destroy();
	}
}

class CheckBoxUI extends UISpriteElement {
	private on_icon_region: object;
	private off_icon_region: object;
	private font: Text;
	private isSelected: boolean;
	private label_on: string;
	private label_off: string;

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

		this.font = new Text(0, 0, {
			font: "kenpixel",
			size: 12,
			fillStyle: "black",
			textAlign: "left",
			textBaseline: "middle",
			text: offLabel,
			offScreenCanvas: true,
		});

		this.getBounds().width += this.font.measureText().width;
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
		} else {
			this.setRegion(this.off_icon_region);
			this.isSelected = false;
		}
	}

	override onClick() {
		this.setSelected(!this.isSelected);
		return false;
	}

	override draw(renderer: Parameters<UISpriteElement["draw"]>[0]) {
		super.draw(renderer);
		this.font.draw(
			renderer,
			` ${this.isSelected ? this.label_on : this.label_off}`,
			this.pos.x + this.width,
			this.pos.y + this.height / 2,
		);
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
				bold: true,
				text: label,
			}),
		);

		this.isHoldable = true;
		this.isDraggable = true;
	}
}

class PlayScreen extends Stage {
	override onResetEvent() {
		game.world.addChild(
			new ColorLayer("background", "rgba(248, 194, 40, 1.0)"),
			0,
		);

		const panel = new UIContainer(100, 100, 450, 325, "OPTIONS");

		const cbPanel = new UIBaseElement(125, 75, 100, 100);

		cbPanel.addChild(
			new CheckBoxUI(
				0,
				0,
				texture,
				"green_boxCheckmark",
				"grey_boxCheckmark",
				"Music ON",
				"Music OFF",
			),
		);
		cbPanel.addChild(
			new CheckBoxUI(
				0,
				50,
				texture,
				"green_boxCheckmark",
				"grey_boxCheckmark",
				"Sound FX ON",
				"Sound FX OFF",
			),
		);

		panel.addChild(cbPanel);

		panel.addChild(new ButtonUI(125, 175, "blue", "Video Options"));
		panel.addChild(new ButtonUI(30, 250, "green", "Accept"));
		panel.addChild(new ButtonUI(230, 250, "yellow", "Cancel"));

		game.world.addChild(panel, 1);
	}
}

const createGame = () => {
	if (
		!video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			scaleMethod: "flex-width",
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

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
			src: `url(${base}font/kenvector_future.woff2)`,
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
