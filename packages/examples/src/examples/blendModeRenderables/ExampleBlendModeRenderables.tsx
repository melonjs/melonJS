/**
 * melonJS — blend modes across every renderable type.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	event,
	game,
	ImageLayer,
	loader,
	ParticleEmitter,
	Renderable,
	Sprite,
	state,
	Text,
	timer,
	Vector2d,
	video,
} from "melonjs";
import galaxyImg from "../sprite/assets/galaxy.png";
import monsterImg from "../sprite/assets/monster.png";
import { createExampleComponent } from "../utils";

const resources = [
	{ name: "monster", type: "image", src: monsterImg },
	{ name: "galaxy", type: "image", src: galaxyImg },
];

// the six that need the shader path, plus "normal" as a reference frame —
// seeing the unblended version between modes is what makes the rest legible
const MODES = [
	"normal",
	"overlay",
	"hard-light",
	"color-dodge",
	"color-burn",
	"soft-light",
	"difference",
];

const WIDTH = 1100;
const HEIGHT = 620;
const CYCLE_MS = 2200;

// Bands spanning dark to light: most of these modes branch on the BACKDROP's
// luminance, so a flat background would show only one side of each formula.
// The ramp still has to cross both thresholds these formulas branch on —
// 0.5 for overlay and hard-light, 0.25 for soft-light's curve — but it starts
// well above black: a very dark first band swallowed the sprite and the text
// sitting on it, which is the opposite of what the example is for.
const BANDS = [
	"#4a3f6b",
	"#6a4f8a",
	"#8c5f9e",
	"#ad74a6",
	"#cd90ad",
	"#e6b0b4",
	"#f5d8c6",
];

// row the specimen labels sit on, darkened behind them so light text reads
// against every band
const HEADER_H = 92;
const LABEL_ROW_Y = 452;
const LABEL_ROW_H = 34;

/** the blend target: a luminance ramp, drawn through the primitive batcher */
class Backdrop extends Renderable {
	constructor() {
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
	}

	// biome-ignore lint/suspicious/noExplicitAny: renderer type varies by backend
	override draw(renderer: any) {
		const bandWidth = WIDTH / BANDS.length;
		for (let i = 0; i < BANDS.length; i++) {
			renderer.setColor(BANDS[i]);
			renderer.fillRect(
				this.pos.x + i * bandWidth,
				this.pos.y,
				bandWidth,
				HEIGHT,
			);
		}
		// strips behind the text so one colour reads across the whole ramp
		// instead of vanishing at one end or the other
		renderer.setColor("rgba(10, 10, 20, 0.55)");
		renderer.fillRect(this.pos.x, this.pos.y, WIDTH, HEADER_H);
		renderer.fillRect(this.pos.x, this.pos.y + LABEL_ROW_Y, WIDTH, LABEL_ROW_H);
		renderer.fillRect(this.pos.x, this.pos.y + HEIGHT - 46, WIDTH, 46);
	}
}

/** a shape fill — the primitive batcher's path, no texture involved */
class BlendedShape extends Renderable {
	constructor(x: number, y: number) {
		super(x, y, 190, 190);
		this.anchorPoint.set(0, 0);
	}

	// biome-ignore lint/suspicious/noExplicitAny: renderer type varies by backend
	override draw(renderer: any) {
		// a custom draw() receives the renderer positioned for the CONTAINER,
		// so it has to place itself from `pos` rather than drawing at 0,0
		const x = this.pos.x;
		const y = this.pos.y;
		renderer.setColor("#ffcc33");
		renderer.fillEllipse(x + 70, y + 70, 58, 58);
		renderer.setColor("#33ddaa");
		renderer.fillRect(x + 30, y + 95, 130, 70);
	}
}

const createGame = async () => {
	try {
		const app = new Application(WIDTH, HEIGHT, {
			parent: "screen",
			scaleMethod: "fit",
			renderer: video.AUTO,
		});
		await app.init();
	} catch {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	loader.preload(resources, () => {
		state.change(state.DEFAULT, true);

		const renderer = game.renderer;
		const world = game.world;

		world.addChild(new Backdrop(), 0);

		// ---- one specimen per renderable type, all sharing the same mode ----

		// ImageLayer covers the viewport by definition, so it sits UNDER the
		// rest: it blends against the backdrop, and the others then blend
		// against the result — which is exactly the stacking a real scene has
		const layer = new ImageLayer(0, 0, {
			image: "galaxy",
			name: "layer",
			ratio: 0.4,
			repeat: "repeat",
		});
		layer.alpha = 0.5;
		world.addChild(layer, 1);

		const TOP = 250;

		const sprite = new Sprite(150, TOP + 80, {
			image: "monster",
			anchorPoint: new Vector2d(0.5, 0.5),
		});
		sprite.scale(0.42);
		world.addChild(sprite, 2);

		const text = new Text(295, TOP + 45, {
			font: "Arial",
			size: 54,
			bold: true,
			fillStyle: "#ff5f6d",
			text: "Text",
		});
		world.addChild(text, 2);

		const shape = new BlendedShape(510, TOP);
		world.addChild(shape, 2);

		// particles are the highest-volume caller of `blendMode` in the
		// engine — every particle carries its own
		const emitter = new ParticleEmitter(860, TOP + 80, {
			width: 24,
			height: 24,
			totalParticles: 260,
			maxParticles: 70,
			angle: Math.PI / 2,
			angleVariation: Math.PI,
			minLife: 900,
			maxLife: 1700,
			speed: 1.7,
			speedVariation: 1,
			minStartScale: 0.8,
			maxStartScale: 2.2,
			tint: "#7fd8ff",
			framesToSkip: 0,
		});
		world.addChild(emitter, 2);
		emitter.streamParticles();

		const blended = [layer, sprite, text, shape, emitter];

		// ---- labels ---------------------------------------------------------
		const heading = new Text(WIDTH / 2, 26, {
			font: "Arial",
			size: 24,
			bold: true,
			fillStyle: "#ffffff",
			textAlign: "center",
			text: "",
		});
		heading.floating = true;
		world.addChild(heading, 10);

		const caption = new Text(WIDTH / 2, 60, {
			font: "Arial",
			size: 14,
			fillStyle: "#f2e9e4",
			textAlign: "center",
			text: "one blend mode, five renderable types — over a dark-to-light backdrop",
		});
		caption.floating = true;
		world.addChild(caption, 10);

		const labels: [string, number][] = [
			["Sprite", 110],
			["Text", 300],
			["shape fill", 545],
			["particles", 820],
		];
		for (const [label, x] of labels) {
			const t = new Text(x, LABEL_ROW_Y + 8, {
				font: "Arial",
				size: 15,
				bold: true,
				fillStyle: "#f2e9e4",
				text: label,
			});
			t.floating = true;
			world.addChild(t, 10);
		}
		const layerLabel = new Text(20, HEIGHT - 34, {
			font: "Arial",
			size: 15,
			bold: true,
			fillStyle: "#f2e9e4",
			text: "ImageLayer (full viewport, blended under the rest)",
		});
		layerLabel.floating = true;
		world.addChild(layerLabel, 10);

		// ---- cycle the mode -------------------------------------------------
		let index = 0;
		const apply = () => {
			const mode = MODES[index];
			for (const item of blended) {
				item.blendMode = mode;
			}
			// `setBlendMode` reports what it actually applied, so comparing the
			// result against the request is how a game detects an unsupported
			// mode — the same probe the Blend Modes example is built on
			const applied = renderer.setBlendMode(mode);
			renderer.setBlendMode("normal");
			const supported = applied === mode;
			heading.setText(
				`${mode}  —  ${renderer.type}${supported ? "" : "  (unsupported, falling back to normal)"}`,
			);
		};
		apply();

		const cycle = timer.setInterval(() => {
			index = (index + 1) % MODES.length;
			apply();
		}, CYCLE_MS);

		event.on(event.GAME_UPDATE, () => {
			sprite.rotate(0.008);
		});

		return () => {
			timer.clearInterval(cycle);
		};
	});
};

export const ExampleBlendModeRenderables = createExampleComponent(createGame);
