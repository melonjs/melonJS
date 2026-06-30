/**
 * melonJS — procedural water surface example (side view with horizon).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A game-style ocean scene built entirely from procedural noise, with a
 * day↔night slider:
 * - **distant mountains** — `Noise.getNoise2d` sampled on the CPU drives a
 *   silhouette skyline (no texture at all).
 * - **water albedo** — low-frequency simplex through a deep→shallow color ramp,
 *   baked with `NoiseTexture2d`.
 * - **water ripples** — a *live-animated* `NoiseTexture2d` normal map (sampled in
 *   3D, time on the third axis), re-baked + auto re-uploaded every frame so the
 *   ripples actually flow.
 *
 * The water `Sprite` is lit per-pixel through the ripple normal map by a celestial
 * light (sun→moon) plus its shimmering reflection. The slider cross-fades three
 * pre-baked skies and lerps the light colour / ambient / reflection from a bright
 * day, through a warm sunset, to a cool moonlit night.
 */
import {
	type Application,
	Gradient,
	input,
	Light2d,
	Noise,
	NoiseTexture2d,
	Sprite,
	Stage,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

// build a plain canvas filled with a vertical gradient (sky / horizon).
const verticalGradient = (
	width: number,
	height: number,
	stops: Array<[number, string]>,
) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
	const g = ctx.createLinearGradient(0, 0, 0, height);
	for (const [offset, color] of stops) {
		g.addColorStop(offset, color);
	}
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, width, height);
	return canvas;
};

// build a mountain-range silhouette canvas from a 1D CPU noise skyline.
const mountainSilhouette = (
	width: number,
	height: number,
	noise: Noise,
	amplitude: number,
	color: string,
) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(0, height);
	for (let x = 0; x <= width; x++) {
		const n = noise.getNoise1d(x) * 0.5 + 0.5; // 0..1
		ctx.lineTo(x, height - n * amplitude);
	}
	ctx.lineTo(width, height);
	ctx.closePath();
	ctx.fill();
	return canvas;
};

const lerp = (a: number, b: number, t: number) => {
	return a + (b - a) * t;
};

type RGB = [number, number, number];
const lerp3 = (a: RGB, b: RGB, t: number): RGB => {
	return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
};

// time-of-day keyframes (t: 0 = day, 0.5 = sunset, 1 = night)
type DayKey = {
	light: RGB;
	intensity: number;
	ambient: RGB;
	glitter: RGB;
	glitterIntensity: number;
};
const DAY: DayKey = {
	light: [255, 247, 224],
	intensity: 1.3,
	ambient: [140, 150, 165],
	glitter: [255, 240, 210],
	glitterIntensity: 0.5,
};
const SUNSET: DayKey = {
	light: [255, 207, 131],
	intensity: 2.0,
	ambient: [70, 55, 60],
	glitter: [255, 200, 150],
	glitterIntensity: 1.4,
};
const NIGHT: DayKey = {
	light: [231, 238, 255],
	intensity: 1.8,
	ambient: [20, 30, 48],
	glitter: [207, 224, 255],
	glitterIntensity: 1.4,
};

class PlayScreen extends Stage {
	private app!: Application;
	private elapsed = 0;
	private timeOfDay = 0.5;
	private ripples!: NoiseTexture2d;
	private light!: Light2d;
	private glitter!: Light2d;
	private cursor!: Light2d;
	private skyDay!: Sprite;
	private skySunset!: Sprite;
	private skyNight!: Sprite;
	private panel?: HTMLDivElement;

	onResetEvent(app: Application) {
		this.app = app;
		const w = app.viewport.width;
		const h = app.viewport.height;
		const horizonY = Math.round(h * 0.42);
		const bandH = h - horizonY;

		// ── three pre-baked skies, cross-faded by the slider (no re-upload) ──
		const mkSky = (stops: Array<[number, string]>) => {
			return new Sprite(w / 2, horizonY / 2, {
				image: verticalGradient(w, horizonY, stops),
				framewidth: w,
				frameheight: horizonY,
				anchorPoint: { x: 0.5, y: 0.5 },
			});
		};
		this.skyDay = mkSky([
			[0.0, "#2e6fc0"],
			[0.55, "#6ba3da"],
			[1.0, "#bfe0f2"],
		]);
		this.skySunset = mkSky([
			[0.0, "#172a4d"],
			[0.45, "#4a3a6a"],
			[0.75, "#b05a3c"],
			[1.0, "#f4b266"],
		]);
		this.skyNight = mkSky([
			[0.0, "#05091a"],
			[0.55, "#0e1a33"],
			[0.85, "#1c2f4e"],
			[1.0, "#33507a"],
		]);
		app.world.addChild(this.skyDay, 0);
		app.world.addChild(this.skySunset, 0);
		app.world.addChild(this.skyNight, 0);

		// ── distant mountains: two ridgelines from CPU-sampled Noise ──
		const far = new Sprite(w / 2, horizonY - 35, {
			image: mountainSilhouette(
				w,
				70,
				new Noise({ seed: 21, frequency: 0.012, octaves: 3 }),
				46,
				"#26324a",
			),
			framewidth: w,
			frameheight: 70,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		const near = new Sprite(w / 2, horizonY - 40, {
			image: mountainSilhouette(
				w,
				80,
				new Noise({ seed: 7, frequency: 0.02, octaves: 4 }),
				70,
				"#161d30",
			),
			framewidth: w,
			frameheight: 80,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		app.world.addChild(far, 1);
		app.world.addChild(near, 2);

		// ── albedo: deep→shallow water color from low-frequency simplex ──
		const ramp = new Gradient("linear", [0, 0, 1, 0]);
		ramp.addColorStop(0.0, "#04243f");
		ramp.addColorStop(0.55, "#0a4a6e");
		ramp.addColorStop(1.0, "#13708c");
		const albedo = new NoiseTexture2d({
			width: 384,
			height: 384,
			type: "simplex",
			seed: 1,
			frequency: 0.012,
			octaves: 4,
			colorRamp: ramp,
		});

		// ── ripples: a LIVE-ANIMATED fBm normal map (3D, time on the z axis) ──
		this.ripples = new NoiseTexture2d({
			width: 160,
			height: 160,
			type: "simplex",
			seed: 1,
			frequency: 0.05,
			octaves: 4,
			gain: 0.55,
			// domain warp gives the ripples an organic, flowing-water character
			// rather than plain blobby noise
			domainWarp: true,
			domainWarpAmp: 8,
			domainWarpFrequency: 0.04,
			seamless: true,
			asNormalMap: true,
			bumpStrength: 2.0,
			animated: true,
			speed: 0.5,
		});

		const water = new Sprite(w / 2, horizonY + bandH / 2, {
			image: albedo,
			normalMap: this.ripples,
			framewidth: 384,
			frameheight: 384,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		water.scale(w / 384, bandH / 384);
		app.world.addChild(water, 3);

		// the celestial light (sun↔moon): a compact glow above the peaks.
		// (Light2d renders in the camera post-pass, on top of the world, so it
		// can't be occluded by the mountains — keep it clear of them.)
		this.light = new Light2d(w / 2, horizonY - 105, 48, 48, "#ffcf83", 2.0);
		app.world.addChild(this.light, 4);

		// its reflection: a tall, narrow light shimmering down the ripples.
		this.glitter = new Light2d(
			w / 2,
			horizonY + bandH * 0.45,
			120,
			bandH * 0.9,
			"#ffcf9a",
			1.4,
		);
		this.glitter.illuminationOnly = true;
		app.world.addChild(this.glitter, 5);

		// a pointer-controlled light to sweep the surface
		this.cursor = new Light2d(
			w / 2,
			horizonY + bandH / 2,
			220,
			160,
			"#bcd8ff",
			1.2,
		);
		this.cursor.illuminationOnly = true;
		app.world.addChild(this.cursor, 6);

		input.registerPointerEvent("pointermove", app.viewport, (event) => {
			this.cursor.centerOn(event.gameX, event.gameY);
		});

		this.buildSlider(app);
		this.applyTimeOfDay();
	}

	// cross-fade the three skies and lerp the lighting for the current time.
	private applyTimeOfDay() {
		const t = this.timeOfDay;
		let a: DayKey;
		let b: DayKey;
		let f: number;
		if (t < 0.5) {
			a = DAY;
			b = SUNSET;
			f = t / 0.5;
			this.skyDay.alpha = 1 - f;
			this.skySunset.alpha = f;
			this.skyNight.alpha = 0;
		} else {
			a = SUNSET;
			b = NIGHT;
			f = (t - 0.5) / 0.5;
			this.skyDay.alpha = 0;
			this.skySunset.alpha = 1 - f;
			this.skyNight.alpha = f;
		}
		const light = lerp3(a.light, b.light, f);
		this.light.color.setColor(light[0], light[1], light[2]);
		this.light.intensity = lerp(a.intensity, b.intensity, f);
		const amb = lerp3(a.ambient, b.ambient, f);
		this.ambientLightingColor.setColor(amb[0], amb[1], amb[2]);
		const g = lerp3(a.glitter, b.glitter, f);
		this.glitter.color.setColor(g[0], g[1], g[2]);
		this.glitter.intensity = lerp(a.glitterIntensity, b.glitterIntensity, f);
	}

	private buildSlider(app: Application) {
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;z-index:1000;font-family:sans-serif;" +
			"color:#e8e8e8;background:rgba(0,0,0,0.45);padding:8px 12px;border-radius:6px;";
		const label = document.createElement("div");
		label.textContent = "☀️  Day — Night  🌙";
		label.style.cssText = "font-size:12px;margin-bottom:6px;";
		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = "1";
		slider.step = "0.01";
		slider.value = String(this.timeOfDay);
		slider.style.cssText = "width:190px;display:block;";
		slider.addEventListener("input", () => {
			this.timeOfDay = Number.parseFloat(slider.value);
			this.applyTimeOfDay();
		});
		panel.appendChild(label);
		panel.appendChild(slider);
		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			parent.appendChild(panel);
		}
		this.panel = panel;
	}

	update(dt: number) {
		this.elapsed += dt / 1000;
		// evolve the ripple normal map (the live-animated noise); the re-bake
		// bumps its version so the renderer re-uploads it automatically.
		this.ripples.update(dt);
		// sway the reflection column so it shimmers
		const w = this.app.viewport.width;
		this.glitter.centerOn(
			w / 2 + Math.sin(this.elapsed * 1.3) * 26,
			this.glitter.pos.y,
		);
		super.update(dt);
		// keep redrawing so the ripples + reflection animate
		return true;
	}

	onDestroyEvent() {
		input.releasePointerEvent("pointermove", this.app.viewport);
		this.panel?.remove();
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		// normal-map lighting needs the WebGL lit pipeline; under video.AUTO a
		// Canvas fallback would draw the flat albedo with no shimmer.
		renderer: video.WEBGL,
		// LINEAR texture filtering — the ripple normal map is small (128²) and
		// stretched over the whole band; without this it upscales blocky.
		antiAlias: true,
	});

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleWater = createExampleComponent(createGame);
