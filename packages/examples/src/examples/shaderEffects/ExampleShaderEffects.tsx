import {
	Application,
	BlurEffect,
	ChromaticAberrationEffect,
	DesaturateEffect,
	DissolveEffect,
	DropShadowEffect,
	event,
	FlashEffect,
	GlowEffect,
	HologramEffect,
	InvertEffect,
	loader,
	OutlineEffect,
	PixelateEffect,
	ScanlineEffect,
	SepiaEffect,
	Sprite,
	Text,
	TintPulseEffect,
	VignetteEffect,
	WaveEffect,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";
import monsterImg from "./assets/monster.png";

const createGame = () => {
	const app = new Application(1218, 562, {
		parent: "screen",
		scale: "auto",
		backgroundColor: "#202020",
	});

	// apply subtle vignette post-process effect on the camera
	app.viewport.shader = new VignetteEffect(app.renderer as WebGLRenderer);

	loader.preload([{ name: "monster", type: "image", src: monsterImg }], () => {
		const r = app.renderer;
		const img = loader.getImage("monster")!;
		const tw = img.width;
		const th = img.height;

		const names = [
			"Original",
			"Flash",
			"Outline",
			"Glow",
			"Desaturate",
			"Pixelate",
			"Blur",
			"Chromatic",
			"Dissolve",
			"Drop Shadow",
			"CRT",
			"Tint Pulse",
			"Wave",
			"Invert",
			"Sepia",
			"Hologram",
		];

		const cols = 4;
		const rows = Math.ceil(names.length / cols);
		const cellW = 1218 / cols;
		const cellH = 562 / rows;
		let flashEffect: FlashEffect | null = null;
		let glowEffect: GlowEffect | null = null;
		let dissolveEffect: DissolveEffect | null = null;
		let pulseEffect: TintPulseEffect | null = null;
		let waveEffect: WaveEffect | null = null;
		let hologramEffect: HologramEffect | null = null;

		for (let i = 0; i < names.length; i++) {
			const col = i % cols;
			const row = Math.floor(i / cols);
			const cx = cellW * col + cellW / 2;
			const cy = cellH * row + cellH / 2;

			const sprite = new Sprite(cx, cy - 10, { image: "monster" });
			sprite.scale(0.25);
			app.world.addChild(sprite);

			// apply effect based on index
			switch (i) {
				case 1:
					flashEffect = new FlashEffect(r, { intensity: 0 });
					sprite.shader = flashEffect;
					break;
				case 2:
					sprite.shader = new OutlineEffect(r, {
						color: [1, 1, 0],
						width: 2,
					});
					(sprite.shader as OutlineEffect).setTextureSize(tw, th);
					break;
				case 3:
					glowEffect = new GlowEffect(r, {
						color: [0.3, 0.6, 1],
						width: 10,
						intensity: 2.5,
						textureSize: [tw, th],
					});
					sprite.shader = glowEffect;
					break;
				case 4:
					sprite.shader = new DesaturateEffect(r);
					break;
				case 5:
					sprite.shader = new PixelateEffect(r, {
						size: 6,
						textureSize: [tw, th],
					});
					break;
				case 6:
					sprite.shader = new BlurEffect(r, {
						strength: 5,
						textureSize: [tw, th],
					});
					break;
				case 7:
					sprite.shader = new ChromaticAberrationEffect(r, {
						offset: 5,
						textureSize: [tw, th],
					});
					break;
				case 8:
					dissolveEffect = new DissolveEffect(r, { progress: 0 });
					sprite.shader = dissolveEffect;
					break;
				case 9:
					sprite.shader = new DropShadowEffect(r, {
						offsetX: 6,
						offsetY: 6,
						opacity: 0.7,
						textureSize: [tw, th],
					});
					break;
				case 10:
					sprite.shader = new ScanlineEffect(r, {
						opacity: 0.4,
						curvature: 0.03,
						vignetteStrength: 0.3,
					});
					break;
				case 11:
					pulseEffect = new TintPulseEffect(r, {
						color: [0, 1, 0],
						speed: 2,
						intensity: 0.4,
					});
					sprite.shader = pulseEffect;
					break;
				case 12:
					waveEffect = new WaveEffect(r, {
						amplitude: 0.008,
						frequency: 15.0,
						speed: 3.0,
					});
					sprite.shader = waveEffect;
					break;
				case 13:
					sprite.shader = new InvertEffect(r);
					break;
				case 14:
					sprite.shader = new SepiaEffect(r);
					break;
				case 15:
					hologramEffect = new HologramEffect(r);
					sprite.shader = hologramEffect;
					break;
			}

			app.world.addChild(
				new Text(cx, cy + 45, {
					font: "Arial",
					size: 14,
					fillStyle: "#aaaaaa",
					textAlign: "center",
					textBaseline: "top",
					text: names[i],
				}),
			);
		}

		// animate effects
		event.on(event.GAME_UPDATE, () => {
			const t = globalThis.performance.now() / 1000;
			if (flashEffect) {
				// periodic flash: quick burst every 2 seconds
				const cycle = t % 2;
				flashEffect.setIntensity(cycle < 0.15 ? 1.0 - cycle / 0.15 : 0);
			}
			if (glowEffect) {
				// pulsing glow intensity
				glowEffect.setIntensity(2.0 + Math.sin(t * 3) * 1.5);
			}
			if (dissolveEffect) {
				// hold at 0 (1s), 0→1 (2s), 1→0 (2s) = 5s cycle
				const cycle = t % 5;
				if (cycle < 1) {
					dissolveEffect.setProgress(0);
				} else if (cycle < 3) {
					dissolveEffect.setProgress((cycle - 1) / 2);
				} else {
					dissolveEffect.setProgress(1 - (cycle - 3) / 2);
				}
			}
			if (pulseEffect) {
				pulseEffect.setTime(t);
			}
			if (waveEffect) {
				waveEffect.setTime(t);
			}
			if (hologramEffect) {
				hologramEffect.setTime(t);
			}
		});
	});
};

export const ExampleShaderEffects = createExampleComponent(createGame);
