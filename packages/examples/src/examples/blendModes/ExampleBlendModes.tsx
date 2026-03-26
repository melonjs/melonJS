import { game, Renderable, Text, video } from "melonjs";
import { createExampleComponent } from "../utils";

const BLEND_MODES = [
	"normal",
	"add",
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	"difference",
	"exclusion",
];

const COLS = 5;
const CELL_W = 180;
const CELL_H = 170;
const CIRCLE_R = 45;

const createGame = () => {
	const rows = Math.ceil(BLEND_MODES.length / COLS);
	const canvasW = COLS * CELL_W;
	const HEADER_H = 40;
	const canvasH = rows * CELL_H + HEADER_H;

	if (
		!video.init(canvasW, canvasH, {
			parent: "screen",
			renderer: video.AUTO,
			preferWebGL1: false,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// detect which modes are actually supported by probing setBlendMode
	const renderer = video.renderer as any;
	const supported: Record<string, boolean> = {};
	for (const mode of BLEND_MODES) {
		const applied = renderer.setBlendMode(mode);
		supported[mode] = applied === mode;
	}
	renderer.setBlendMode("normal");

	// single renderable that draws the entire blend mode grid
	class BlendModeGrid extends Renderable {
		constructor() {
			super(0, 0, canvasW, canvasH);
			this.anchorPoint.set(0, 0);
		}

		override draw(renderer: any) {
			// dark background
			renderer.setBlendMode("normal");
			renderer.setGlobalAlpha(1.0);
			renderer.setColor("#1a1a2e");
			renderer.fillRect(0, 0, canvasW, canvasH);

			for (let i = 0; i < BLEND_MODES.length; i++) {
				const col = i % COLS;
				const row = Math.floor(i / COLS);
				const cx = col * CELL_W + CELL_W / 2;
				const cy = row * CELL_H + CELL_H / 2 - 10 + HEADER_H;
				const mode = BLEND_MODES[i];

				// blue circle (base) — always normal blend
				renderer.setBlendMode("normal");
				renderer.setGlobalAlpha(1.0);
				renderer.setColor("#2266dd");
				renderer.fillEllipse(
					cx - CIRCLE_R * 0.35,
					cy - CIRCLE_R * 0.2,
					CIRCLE_R,
					CIRCLE_R,
				);

				// red circle — apply the test blend mode
				renderer.setBlendMode(mode);
				renderer.setGlobalAlpha(0.85);
				renderer.setColor("#dd4422");
				renderer.fillEllipse(
					cx + CIRCLE_R * 0.35,
					cy + CIRCLE_R * 0.2,
					CIRCLE_R,
					CIRCLE_R,
				);
			}

			// reset
			renderer.setBlendMode("normal");
		}
	}

	game.world.addChild(new BlendModeGrid(), 0);

	// renderer type header
	const header = new Text(canvasW / 2, 8, {
		font: "Arial",
		size: 16,
		fillStyle: "#aaaaaa",
		textAlign: "center",
		text: renderer.type + " Supported Blend Modes",
	});
	header.anchorPoint.set(0, 0);
	header.floating = true;
	game.world.addChild(header, 2);

	// add labels — green if supported, red if not
	for (let i = 0; i < BLEND_MODES.length; i++) {
		const col = i % COLS;
		const row = Math.floor(i / COLS);
		const x = col * CELL_W + CELL_W / 2;
		const y = row * CELL_H + CELL_H - 25 + HEADER_H;
		const mode = BLEND_MODES[i];

		const label = new Text(x, y, {
			font: "Arial",
			size: 14,
			fillStyle: supported[mode] ? "#44dd44" : "#dd4444",
			textAlign: "center",
			text: mode,
		});
		label.anchorPoint.set(0, 0);
		game.world.addChild(label, 1);
	}
};

export const ExampleBlendModes = createExampleComponent(createGame);
