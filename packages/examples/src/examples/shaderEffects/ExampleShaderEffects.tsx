import {
	Application,
	BlurEffect,
	ChromaticAberrationEffect,
	ColorLayer,
	DesaturateEffect,
	DissolveEffect,
	DropShadowEffect,
	event,
	FlashEffect,
	GlowEffect,
	loader,
	OutlineEffect,
	PixelateEffect,
	ScanlineEffect,
	Sprite,
	Text,
	TintPulseEffect,
	Vector2d,
} from "melonjs";
import monsterImg from "../sprite/assets/monster.png";
import { createExampleComponent } from "../utils";

const resources = [{ name: "monster", type: "image", src: monsterImg }];

// all effects with their labels
const effectList = [
	{ name: "Original", create: () => undefined },
	{
		name: "Flash",
		create: (r: any) => new FlashEffect(r, { intensity: 0.7 }),
	},
	{
		name: "Outline",
		create: (r: any) => new OutlineEffect(r, { color: [1, 1, 0], width: 2 }),
	},
	{
		name: "Glow",
		create: (r: any) =>
			new GlowEffect(r, { color: [0.3, 0.5, 1], width: 4, intensity: 1.5 }),
	},
	{
		name: "Desaturate",
		create: (r: any) => new DesaturateEffect(r),
	},
	{
		name: "Pixelate",
		create: (r: any) => new PixelateEffect(r, { size: 6 }),
	},
	{
		name: "Blur",
		create: (r: any) => new BlurEffect(r, { strength: 2 }),
	},
	{
		name: "Chromatic",
		create: (r: any) => new ChromaticAberrationEffect(r, { offset: 4 }),
	},
	{
		name: "Dissolve",
		create: (r: any) => new DissolveEffect(r, { progress: 0.5 }),
	},
	{
		name: "Drop Shadow",
		create: (r: any) =>
			new DropShadowEffect(r, { offsetX: 4, offsetY: 4, opacity: 0.6 }),
	},
	{
		name: "Scanlines",
		create: (r: any) => new ScanlineEffect(r, { density: 1, opacity: 0.4 }),
	},
	{
		name: "Tint Pulse",
		create: (r: any) =>
			new TintPulseEffect(r, {
				color: [0, 1, 0],
				speed: 2,
				intensity: 0.4,
			}),
		update: (fx: any, time: number) => fx.setTime(time / 1000),
	},
];

const createGame = () => {
	const app = new Application(1218, 562, {
		parent: "screen",
		scale: "auto",
		backgroundColor: "#202020",
	});

	loader.preload(resources, () => {
		app.world.addChild(new ColorLayer("bg", "#202020"));

		const cols = 4;
		const rows = Math.ceil(effectList.length / cols);
		const cellW = 1218 / cols;
		const cellH = 562 / rows;
		const effects: any[] = [];

		effectList.forEach((entry, i) => {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const cx = cellW * col + cellW / 2;
			const cy = cellH * row + cellH / 2;

			// create sprite
			const sprite = new Sprite(cx, cy - 15, {
				image: "monster",
				anchorPoint: new Vector2d(0.5, 0.5),
			});
			sprite.scale(0.45);

			// apply effect
			const fx = entry.create(app.renderer);
			sprite.shader = fx;

			// set texture size for effects that need it
			if (fx && typeof fx.setTextureSize === "function") {
				fx.setTextureSize(sprite.width * 2, sprite.height * 2);
			}

			app.world.addChild(sprite, 1);
			effects.push({ fx, update: entry.update });

			// add label below the sprite
			app.world.addChild(
				new Text(cx, cy + 55, {
					font: "Arial",
					size: 14,
					fillStyle: "#aaaaaa",
					textAlign: "center",
					textBaseline: "top",
					text: entry.name,
				}),
				2,
			);
		});

		// update animated effects
		event.on(event.GAME_UPDATE, () => {
			const time = globalThis.performance.now();
			effects.forEach((entry) => {
				if (entry.fx && entry.update) {
					entry.update(entry.fx, time);
				}
			});
		});
	});
};

export const ExampleShaderEffects = createExampleComponent(createGame);
