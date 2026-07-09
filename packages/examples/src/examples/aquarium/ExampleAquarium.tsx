/**
 * melonJS — aquarium example (renderer.toFrameTexture()).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A user-contributed aquarium adapted to the 19.9 API: a seabed scene with
 * swimming fish, seen through a rippling water surface. The surface renderable,
 * drawn last, calls `renderer.toFrameTexture()` in its `draw()` to grab the
 * frame rendered so far (seabed + fish) as a GPU-resident `Texture2d`, binds it
 * to a custom `ShaderEffect` as an extra sampler (`uScene`), and refracts it
 * through a scrolling `NoiseTexture2d` flow map — replacing the original's
 * `readPixels` screen-capture with a zero-stall GPU copy.
 *
 * This is the industry-standard "screen texture" pattern (Godot
 * `hint_screen_texture` / Unity `_CameraOpaqueTexture` / Three.js
 * `copyFramebufferToTexture`). `toFrameTexture()` returns the public
 * `Texture2d`, so it plugs straight into `setTexture()` and is re-captured every
 * frame into the same shared slot — the shader samples the latest frame with no
 * re-bind.
 *
 * Assets: TexturePacker atlas contributed with the original demo — a top-down
 * seabed background, a 4-frame fish swim sheet, and a water texture.
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	type Application,
	loader,
	NoiseTexture2d,
	plugin,
	type ShaderEffect,
	Sprite,
	Stage,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const base = `${import.meta.env.BASE_URL}assets/aquarium/`;

// Atlas region rects (TexturePacker frames in aquarium.webp, 1024²).
const REGION = {
	poolWater: { x: 1, y: 1, w: 740, h: 494 },
	seabed: { x: 1, y: 497, w: 720, h: 480 },
	swim: { x: 873, y: 228, w: 128, h: 128 }, // 2×2 grid of 64px frames
};

// crop a sub-region of the atlas image into its own canvas, optionally scaled
// to a target size (so a full-viewport sprite's framewidth matches its image
// exactly → clean [0,1] UVs)
const crop = (
	img: CanvasImageSource,
	r: { x: number; y: number; w: number; h: number },
	dw = r.w,
	dh = r.h,
) => {
	const c = document.createElement("canvas");
	c.width = dw;
	c.height = dh;
	const ctx = c.getContext("2d") as CanvasRenderingContext2D;
	ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, dw, dh);
	return c;
};

// The refraction fragment (GLSL ES 1.00). The surface quad fills the viewport,
// so its UV (top-left origin) spans the screen. We re-sample the CAPTURED scene
// (uScene) at that UV, displaced by a scrolling noise flow field, then modulate
// it with the water texture (uSampler) for a wet, caustic sheen. The capture is
// a framebuffer copy (Y-up), so Y is flipped once into `s`.
const WATER_FRAGMENT = `
uniform sampler2D uScene;   // captured frame, bound each draw via setTexture
uniform sampler2D uNoise;   // static seamless flow map
uniform float uTime;        // seconds (setTime)
uniform float uStrength;    // ripple strength (slider)

vec4 apply(vec4 color, vec2 uv) {
	vec2 s = vec2(uv.x, 1.0 - uv.y);

	// two noise layers scrolling apart → a living flow field
	vec2 f1 = texture2D(uNoise, s * 1.6 + vec2(uTime * 0.03, uTime * 0.05)).rg;
	vec2 f2 = texture2D(uNoise, s * 2.7 - vec2(uTime * 0.04, uTime * 0.02)).rg;
	vec2 flow = f1 + f2 - 1.0;

	// refract the captured scene at the displaced screen coord
	vec3 scene = texture2D(uScene, clamp(s + flow * uStrength, 0.0, 1.0)).rgb;

	// the water texture (uSampler), gently scrolled, as a wet sheen over it
	vec3 water = texture2D(uSampler, uv * 0.6 + flow * 0.02).rgb;
	vec3 outc = scene * (0.75 + 0.5 * water);

	// caustic sparkle where the flow layers pinch together
	float caustic = pow(max(f1.r * f2.g, 0.0), 3.0) * 1.2;
	outc += vec3(0.10, 0.20, 0.24) * caustic;
	return vec4(outc, 1.0);
}
`;

// a fish that swims horizontally and turns around at the tank edges
class Fish extends Sprite {
	private speed: number;
	private minX: number;
	private maxX: number;
	private bobPhase: number;
	private bobAmp: number;
	private baseY: number;

	constructor(
		x: number,
		y: number,
		sheet: HTMLCanvasElement,
		speed: number,
		scale: number,
		bounds: { min: number; max: number },
	) {
		super(x, y, { image: sheet, framewidth: 64, frameheight: 64 });
		this.addAnimation("swim", [0, 1, 2, 3], 120);
		this.setCurrentAnimation("swim");
		this.scale(scale, scale);
		this.speed = speed;
		this.minX = bounds.min;
		this.maxX = bounds.max;
		this.baseY = y;
		this.bobPhase = x * 0.05;
		this.bobAmp = 5 + Math.abs(speed) * 0.15;
		// art faces left; flip when swimming right
		this.flipX(speed > 0);
	}

	update(dt: number) {
		super.update(dt);
		const s = dt / 1000;
		this.pos.x += this.speed * s;
		this.bobPhase += s * 2;
		this.pos.y = this.baseY + Math.sin(this.bobPhase) * this.bobAmp;
		if (this.pos.x < this.minX) {
			this.pos.x = this.minX;
			this.speed = Math.abs(this.speed);
			this.flipX(true);
		} else if (this.pos.x > this.maxX) {
			this.pos.x = this.maxX;
			this.speed = -Math.abs(this.speed);
			this.flipX(false);
		}
		return true;
	}
}

// the water surface: drawn LAST, it captures the frame rendered so far and
// re-draws it refracted. A full-viewport sprite (framewidth/frameheight = the
// viewport, so it covers every pixel) whose draw() grabs the backdrop via
// toFrameTexture() and hands it to the shader as uScene.
class WaterSurface extends Sprite {
	private effect: ShaderEffect;

	constructor(
		w: number,
		h: number,
		waterTex: HTMLCanvasElement,
		effect: ShaderEffect,
	) {
		// the water texture stretched over the whole viewport is the quad's
		// albedo (uSampler); the shader multiplies the captured scene by it
		super(w / 2, h / 2, {
			image: waterTex,
			framewidth: w,
			frameheight: h,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		this.effect = effect;
		this.shader = effect;
	}

	draw(renderer: Parameters<Sprite["draw"]>[0], viewport?: object) {
		// capture everything drawn so far this frame — the opaque aquarium —
		// as a GPU-resident texture, and hand it to the refraction shader.
		// Re-captured every frame into the shared slot: the live-bound sampler
		// picks up the latest frame with no re-bind.
		const scene = renderer.toFrameTexture();
		this.effect.setTexture("uScene", scene);
		// biome-ignore lint/suspicious/noExplicitAny: viewport shape varies by call site
		super.draw(renderer, viewport as any);
	}
}

class PlayScreen extends Stage {
	private elapsed = 0;
	private effect!: ShaderEffect;
	private panel?: HTMLDivElement;
	private noise?: NoiseTexture2d;

	onResetEvent(app: Application) {
		const w = app.viewport.width;
		const h = app.viewport.height;

		const atlas = loader.getImage("aquariumAtlas") as HTMLImageElement;
		// seabed + water pre-scaled to the viewport so a full-screen sprite's
		// framewidth/frameheight matches its image (clean UVs, exact cover)
		const seabed = crop(atlas, REGION.seabed, w, h);
		const water = crop(atlas, REGION.poolWater, w, h);
		const swimSheet = crop(atlas, REGION.swim); // natural 128×128 (2×2 of 64)

		// static seamless noise flow map (baked once; scrolled on the GPU)
		const noise = new NoiseTexture2d({
			width: 256,
			height: 256,
			type: "simplex",
			seed: 11,
			frequency: 0.035,
			octaves: 4,
			gain: 0.5,
			domainWarp: true,
			domainWarpAmp: 8,
			seamless: true,
		});
		this.noise = noise;

		// the refraction effect, preloaded as a "shader" asset
		this.effect = loader.getShader("aquariumWater") as ShaderEffect;
		// pass the NoiseTexture2d asset directly — setTexture resolves it (19.9)
		this.effect.setTexture("uNoise", noise, "repeat");
		this.effect.setUniform("uStrength", 0.013);

		// seabed backdrop (z 0), stretched to the viewport
		const bg = new Sprite(w / 2, h / 2, {
			image: seabed,
			framewidth: w,
			frameheight: h,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		app.world.addChild(bg, 0);

		// a school of fish (z 1..) swimming at various depths and speeds
		for (let i = 0; i < 6; i++) {
			const dir = i % 2 === 0 ? 1 : -1;
			const speed = dir * (34 + (i % 3) * 20);
			const scale = 0.7 + (i % 3) * 0.25;
			const y = 60 + ((i * 53) % (h - 130));
			const x = 60 + ((i * 101) % (w - 120));
			app.world.addChild(
				new Fish(x, y, swimSheet, speed, scale, { min: 40, max: w - 40 }),
				1 + i,
			);
		}

		// the water surface post-pass (z 100, above everything it refracts)
		app.world.addChild(new WaterSurface(w, h, water, this.effect), 100);

		this.buildSlider(app);
	}

	private buildSlider(app: Application) {
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;z-index:1000;font-family:sans-serif;" +
			"color:#e8f6fa;background:rgba(0,0,0,0.45);padding:8px 12px;border-radius:6px;";
		const label = document.createElement("div");
		label.textContent = "🐟  Water ripple";
		label.style.cssText = "font-size:12px;margin-bottom:6px;";
		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = "0.06";
		slider.step = "0.002";
		slider.value = "0.013";
		slider.style.cssText = "width:190px;display:block;";
		slider.addEventListener("input", () => {
			this.effect.setUniform("uStrength", Number.parseFloat(slider.value));
		});
		const hint = document.createElement("div");
		hint.textContent = "the fish are refracted through the captured frame";
		hint.style.cssText = "font-size:10px;margin-top:6px;opacity:0.7;";
		panel.appendChild(label);
		panel.appendChild(slider);
		panel.appendChild(hint);
		const parent = app.renderer.getCanvas().parentElement;
		if (parent) {
			parent.style.position = "relative";
			parent.appendChild(panel);
		}
		this.panel = panel;
	}

	update(dt: number) {
		this.elapsed += dt / 1000;
		this.effect.setTime(this.elapsed);
		super.update(dt);
		return true; // keep animating every frame
	}

	onDestroyEvent() {
		loader.unload({ name: "aquariumWater", type: "shader" });
		// free the baked NoiseTexture2d canvas (engine texture asset)
		this.noise?.destroy();
		this.noise = undefined;
		this.panel?.remove();
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		// fixed internal resolution scaled to fit (keeps viewport 728×410, so
		// full-screen renderables cover it regardless of the container size)
		scale: "auto",
		// toFrameTexture + ShaderEffect are WebGL features
		renderer: video.WEBGL,
		antiAlias: true,
		// render at sub-pixel positions so the slow-swimming fish glide smoothly
		// instead of snapping pixel-to-pixel (default floors dx/dy to integers)
		subPixel: true,
	});

	// register the debug plugin (hidden by default; press S to toggle)
	plugin.register(DebugPanelPlugin, "debugPanel");

	state.set(state.PLAY, new PlayScreen());

	loader.preload(
		[
			{ name: "aquariumAtlas", type: "image", src: `${base}aquarium.webp` },
			{ name: "aquariumWater", type: "shader", data: WATER_FRAGMENT },
		],
		() => {
			state.change(state.PLAY);
		},
		false,
	);
};

export const ExampleAquarium = createExampleComponent(createGame);
