/**
 * melonJS — aquarium example (renderer.toFrameTexture()).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Fish swim across a planted tank; a full-screen water surface then refracts
 * the LIVE scene rendered behind it. The surface renderable, drawn last, calls
 * `renderer.toFrameTexture()` in its `draw()` to grab everything painted so far
 * (background + fish + bubbles) as a GPU-resident `Texture2d`, hands it to a
 * custom `ShaderEffect` as an extra sampler (`uScene`), and distorts it with a
 * scrolling `NoiseTexture2d` flow map — so the fish shimmer as if seen through
 * moving water, per-frame, with no `readPixels` round-trip.
 *
 * This is the industry-standard "screen texture" pattern (Godot
 * `hint_screen_texture` / Unity `_CameraOpaqueTexture` / Three.js
 * `copyFramebufferToTexture`): capture the opaque scene, sample it from the
 * refracting surface. `toFrameTexture()` returns the public `Texture2d`, so it
 * plugs straight into `setTexture()` and is re-captured every frame into the
 * same shared slot — the shader samples the latest frame with no re-bind.
 */
import {
	type Application,
	loader,
	NoiseTexture2d,
	type ShaderEffect,
	Sprite,
	Stage,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

// The refraction fragment (GLSL ES 1.00). It ignores the surface quad's own
// texture and re-samples the CAPTURED scene (uScene) in screen space, offset by
// a scrolling noise flow field — plus a caustic shimmer and a faint underwater
// tint. Sampling in screen space (gl_FragCoord / uResolution) matches the
// capture's coordinate system regardless of the quad's own UVs.
const WATER_FRAGMENT = `
uniform sampler2D uScene;   // the captured frame, bound each draw via setTexture
uniform sampler2D uNoise;   // static seamless flow map
uniform float uTime;        // seconds (setTime)
uniform vec2  uResolution;  // framebuffer size in pixels
uniform float uStrength;    // ripple strength (slider)

vec4 apply(vec4 color, vec2 uv) {
	vec2 s = gl_FragCoord.xy / uResolution;

	// two noise layers scrolling in different directions → a living flow field
	vec2 f1 = texture2D(uNoise, s * 1.6 + vec2(uTime * 0.03, uTime * 0.05)).rg;
	vec2 f2 = texture2D(uNoise, s * 2.7 - vec2(uTime * 0.04, uTime * 0.02)).rg;
	vec2 flow = (f1 + f2 - 1.0);

	// refract the captured scene: sample it at the displaced screen coord
	vec2 rUV = clamp(s + flow * uStrength, 0.0, 1.0);
	vec3 scene = texture2D(uScene, rUV).rgb;

	// caustic sparkle where the flow layers pinch together, brighter up top
	float caustic = pow(max(f1.r * f2.g, 0.0), 3.0) * (1.0 - s.y) * 1.5;
	scene += vec3(0.10, 0.22, 0.26) * caustic;

	// gentle underwater colour grade
	scene = mix(scene, scene * vec3(0.82, 0.96, 1.06), 0.35);
	return vec4(scene, 1.0);
}
`;

type Rgb = [number, number, number];

// paint a small side-on fish: an elliptical body, a tail fin and an eye
const fishCanvas = (w: number, h: number, body: Rgb, fin: Rgb) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
	const [br, bg, bb] = body;
	const [fr, fg, fb] = fin;

	// tail fin (triangle at the back / left)
	ctx.fillStyle = `rgb(${fr}, ${fg}, ${fb})`;
	ctx.beginPath();
	ctx.moveTo(2, h / 2);
	ctx.lineTo(w * 0.34, h * 0.2);
	ctx.lineTo(w * 0.34, h * 0.8);
	ctx.closePath();
	ctx.fill();

	// body (ellipse), facing right
	ctx.fillStyle = `rgb(${br}, ${bg}, ${bb})`;
	ctx.beginPath();
	ctx.ellipse(w * 0.6, h / 2, w * 0.34, h * 0.32, 0, 0, Math.PI * 2);
	ctx.fill();

	// top fin
	ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, 0.9)`;
	ctx.beginPath();
	ctx.moveTo(w * 0.5, h * 0.2);
	ctx.lineTo(w * 0.72, h * 0.06);
	ctx.lineTo(w * 0.72, h * 0.42);
	ctx.closePath();
	ctx.fill();

	// belly highlight
	ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
	ctx.beginPath();
	ctx.ellipse(w * 0.62, h * 0.62, w * 0.24, h * 0.12, 0, 0, Math.PI * 2);
	ctx.fill();

	// eye
	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.arc(w * 0.82, h * 0.42, Math.max(2, w * 0.05), 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#111";
	ctx.beginPath();
	ctx.arc(w * 0.84, h * 0.42, Math.max(1, w * 0.025), 0, Math.PI * 2);
	ctx.fill();
	return canvas;
};

// the tank backdrop: a vertical water gradient, a sandy bottom, and a few
// simple plant fronds — a static, opaque scene for the surface to refract
const tankCanvas = (w: number, h: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

	const grad = ctx.createLinearGradient(0, 0, 0, h);
	grad.addColorStop(0, "#0a6b86");
	grad.addColorStop(0.6, "#064b63");
	grad.addColorStop(1, "#04303f");
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, w, h);

	// soft light shafts from the top
	ctx.globalAlpha = 0.08;
	ctx.fillStyle = "#bfefff";
	for (let i = 0; i < 5; i++) {
		const x = (i + 0.5) * (w / 5);
		ctx.beginPath();
		ctx.moveTo(x - 10, 0);
		ctx.lineTo(x + 10, 0);
		ctx.lineTo(x + 60, h);
		ctx.lineTo(x + 30, h);
		ctx.closePath();
		ctx.fill();
	}
	ctx.globalAlpha = 1;

	// plants (wavy fronds) rooted in the sand
	const plant = (px: number, ph: number, hue: string) => {
		ctx.strokeStyle = hue;
		ctx.lineWidth = 5;
		ctx.lineCap = "round";
		for (let b = -1; b <= 1; b++) {
			ctx.beginPath();
			ctx.moveTo(px, h - 24);
			ctx.quadraticCurveTo(
				px + b * 22 + 14,
				h - 24 - ph * 0.5,
				px + b * 10,
				h - 24 - ph,
			);
			ctx.stroke();
		}
	};
	plant(w * 0.12, h * 0.42, "#0c8a4a");
	plant(w * 0.2, h * 0.3, "#0aa15a");
	plant(w * 0.8, h * 0.5, "#0c8a4a");
	plant(w * 0.9, h * 0.34, "#0aa15a");

	// sandy bottom
	const sand = ctx.createLinearGradient(0, h - 28, 0, h);
	sand.addColorStop(0, "#c9a86a");
	sand.addColorStop(1, "#a8874c");
	ctx.fillStyle = sand;
	ctx.beginPath();
	ctx.moveTo(0, h - 20);
	for (let x = 0; x <= w; x += 24) {
		ctx.lineTo(x, h - 20 - Math.sin(x * 0.05) * 4);
	}
	ctx.lineTo(w, h);
	ctx.lineTo(0, h);
	ctx.closePath();
	ctx.fill();
	return canvas;
};

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
		image: HTMLCanvasElement,
		speed: number,
		bounds: { min: number; max: number },
	) {
		super(x, y, { image, framewidth: image.width, frameheight: image.height });
		this.speed = speed;
		this.minX = bounds.min;
		this.maxX = bounds.max;
		this.baseY = y;
		this.bobPhase = x * 0.05;
		this.bobAmp = 6 + Math.abs(speed) * 0.2;
		this.flipX(speed < 0);
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
			this.flipX(false);
		} else if (this.pos.x > this.maxX) {
			this.pos.x = this.maxX;
			this.speed = -Math.abs(this.speed);
			this.flipX(true);
		}
		return true;
	}
}

// the water surface: drawn LAST, it captures the frame rendered so far and
// re-draws it refracted. A full-viewport renderable whose draw() grabs the
// backdrop via toFrameTexture(), binds it to the shader (uScene), and blits a
// full-screen quad through that shader.
class WaterSurface extends Sprite {
	private effect: ShaderEffect;

	constructor(
		x: number,
		y: number,
		w: number,
		h: number,
		effect: ShaderEffect,
	) {
		// a 1x1 white image stretched to the viewport — the shader ignores it
		// (it samples the captured scene instead), it just supplies the quad
		const white = document.createElement("canvas");
		white.width = 1;
		white.height = 1;
		const ctx = white.getContext("2d") as CanvasRenderingContext2D;
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, 1, 1);
		super(x, y, {
			image: white,
			framewidth: 1,
			frameheight: 1,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		// stretch the 1x1 quad to fill the whole viewport
		this.scale(w, h);
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

	onResetEvent(app: Application) {
		const w = app.viewport.width;
		const h = app.viewport.height;

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

		// the refraction effect, preloaded as a "shader" asset
		this.effect = loader.getShader("aquariumWater") as ShaderEffect;
		this.effect.setTexture("uNoise", noise.getTexture(), "repeat");
		this.effect.setUniform("uResolution", new Float32Array([w, h]));
		this.effect.setUniform("uStrength", 0.02);

		// backdrop (z 0)
		const tank = new Sprite(w / 2, h / 2, {
			image: tankCanvas(w, h),
			framewidth: w,
			frameheight: h,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		app.world.addChild(tank, 0);

		// a school of fish (z 1..) swimming at various depths and speeds
		const palette: Array<{ body: Rgb; fin: Rgb; size: number }> = [
			{ body: [244, 148, 42], fin: [214, 92, 20], size: 54 }, // clownfish
			{ body: [86, 170, 220], fin: [40, 120, 190], size: 44 }, // blue tang
			{ body: [230, 210, 90], fin: [200, 160, 40], size: 40 }, // yellow
			{ body: [220, 90, 120], fin: [170, 50, 90], size: 48 }, // pink
			{ body: [150, 210, 150], fin: [90, 160, 100], size: 36 }, // green
		];
		for (let i = 0; i < 7; i++) {
			const p = palette[i % palette.length];
			const img = fishCanvas(p.size, p.size * 0.66, p.body, p.fin);
			const dir = i % 2 === 0 ? 1 : -1;
			const speed = dir * (36 + (i % 3) * 22);
			const y = 70 + ((i * 47) % (h - 150));
			const x = 60 + ((i * 97) % (w - 120));
			app.world.addChild(
				new Fish(x, y, img, speed, { min: 40, max: w - 40 }),
				1 + i,
			);
		}

		// the water surface post-pass (z 100, above everything it refracts)
		app.world.addChild(new WaterSurface(w / 2, h / 2, w, h, this.effect), 100);

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
		slider.value = "0.02";
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
		this.panel?.remove();
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		// toFrameTexture + ShaderEffect are WebGL features
		renderer: video.WEBGL,
		antiAlias: true,
	});

	state.set(state.PLAY, new PlayScreen());

	// preload the refraction shader (compiled once at load time)
	loader.preload(
		[{ name: "aquariumWater", type: "shader", data: WATER_FRAGMENT }],
		() => {
			state.change(state.PLAY);
		},
		false,
	);
};

export const ExampleAquarium = createExampleComponent(createGame);
