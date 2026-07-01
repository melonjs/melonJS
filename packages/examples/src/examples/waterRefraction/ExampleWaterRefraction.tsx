/**
 * melonJS — water refraction example (ShaderEffect.setTexture).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A swimming-pool floor seen through rippling water, built with a single custom
 * `ShaderEffect` that reads TWO textures:
 * - `uSampler` — the sprite's own albedo (the tiled pool floor), bound by the
 *   engine as usual.
 * - `uNoise` — a *static* seamless `NoiseTexture2d`, bound as an **extra**
 *   sampler via `effect.setTexture("uNoise", noise.getTexture())`.
 *
 * The fragment scrolls two noise layers over time (driven by `effect.setTime`)
 * and uses them to distort the pool-floor UVs — cheap, GPU-only UV-refraction,
 * with no per-frame CPU noise re-bake and no Light2d. A pointer swell and
 * animated caustics ride on top. This is the same technique commercial water
 * shaders use; `setTexture` is what makes the second sampler a one-liner
 * (see issue #1532).
 */
import {
	type Application,
	input,
	NoiseTexture2d,
	ShaderEffect,
	Sprite,
	Stage,
	state,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

// A GLSL ES 1.00 fragment (what ShaderEffect wraps). `apply(color, uv)` receives
// the pre-sampled/tinted sprite color and its texture coords; we re-sample the
// sprite (`uSampler`) at *distorted* coords to refract the pool floor.
const REFRACTION_FRAGMENT = `
uniform sampler2D uNoise;   // extra texture, bound via setTexture
uniform float uTime;        // seconds, fed via setTime
uniform float uAmount;      // base ripple strength (slider)
uniform float uCaustic;     // caustic sparkle intensity
uniform vec2  uMouse;       // pointer position in uv space
uniform float uMouseStr;    // decaying pointer impulse

vec4 apply(vec4 color, vec2 uv) {
	// two noise layers scrolling in different directions read like flowing water
	vec2 n1 = texture2D(uNoise, uv + vec2(uTime * 0.03, uTime * 0.02)).rg;
	vec2 n2 = texture2D(uNoise, uv * 1.4 - vec2(uTime * 0.025, uTime * 0.02)).rg;
	vec2 flow = n1 + n2 - 1.0; // ~[-1, 1]

	// a radial swell that follows the pointer and fades over ~1s
	vec2 toMouse = uv - uMouse;
	float d = length(toMouse);
	float swell = uMouseStr * exp(-d * 12.0) * sin(d * 45.0 - uTime * 7.0);
	vec2 swellDir = d > 0.001 ? toMouse / d : vec2(0.0);

	vec2 offset = flow * uAmount + swellDir * swell * 0.05;
	vec4 base = texture2D(uSampler, uv + offset);

	// caustics: bright where the two flow layers overlap → shimmering light
	float caustic = pow(max(n1.r * n2.g, 0.0), 3.0) * uCaustic;
	// keep the added light premultiplied (only where the floor is opaque)
	return base + vec4(vec3(caustic) * base.a, 0.0);
}
`;

// paint a tiled swimming-pool floor with a sunk "melonJS" watermark and a
// depth vignette — high contrast so the refraction is easy to read.
const poolFloor = (width: number, height: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

	// dark base shows through the tile gaps as grout
	ctx.fillStyle = "#053642";
	ctx.fillRect(0, 0, width, height);

	const tile = 46;
	for (let y = 0, ry = 0; y < height; y += tile, ry++) {
		for (let x = 0, rx = 0; x < width; x += tile, rx++) {
			ctx.fillStyle = (rx + ry) % 2 === 0 ? "#0c6d84" : "#0a5f74";
			ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
		}
	}

	// a watermark sunk into the floor makes the ripple distortion obvious
	ctx.fillStyle = "rgba(200, 240, 250, 0.16)";
	ctx.font = "bold 96px sans-serif";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("melonJS", width / 2, height / 2);

	// deeper = darker toward the edges
	const vignette = ctx.createRadialGradient(
		width / 2,
		height / 2,
		height * 0.2,
		width / 2,
		height / 2,
		height * 0.75,
	);
	vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
	vignette.addColorStop(1, "rgba(2, 20, 30, 0.55)");
	ctx.fillStyle = vignette;
	ctx.fillRect(0, 0, width, height);

	return canvas;
};

class PlayScreen extends Stage {
	private app!: Application;
	private elapsed = 0;
	private mouseStr = 0;
	private effect!: ShaderEffect;
	private panel?: HTMLDivElement;

	onResetEvent(app: Application) {
		this.app = app;
		const w = app.viewport.width;
		const h = app.viewport.height;

		// the extra texture: a STATIC seamless noise field — baked once, never
		// re-baked per frame (the shader scrolls it on the GPU instead)
		const noise = new NoiseTexture2d({
			width: 256,
			height: 256,
			type: "simplex",
			seed: 7,
			frequency: 0.03,
			octaves: 4,
			gain: 0.55,
			domainWarp: true,
			domainWarpAmp: 6,
			seamless: true,
		});

		// the refraction effect: one custom fragment, two textures
		this.effect = new ShaderEffect(
			app.renderer as WebGLRenderer,
			REFRACTION_FRAGMENT,
		);
		// bind the noise as an extra sampler — "repeat" so the scrolled UVs wrap
		this.effect.setTexture("uNoise", noise.getTexture(), "repeat");
		this.effect.setUniform("uAmount", 0.035);
		this.effect.setUniform("uCaustic", 0.5);
		this.effect.setUniform("uMouse", new Float32Array([0.5, 0.5]));
		this.effect.setUniform("uMouseStr", 0);

		// a full-viewport sprite whose albedo is the pool floor; the effect
		// refracts its OWN texture (uSampler), exactly like a water surface
		const floor = new Sprite(w / 2, h / 2, {
			image: poolFloor(w, h),
			framewidth: w,
			frameheight: h,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		floor.shader = this.effect;
		app.world.addChild(floor, 0);

		// touch the water → a swell that follows the pointer and decays
		input.registerPointerEvent("pointermove", app.viewport, (event) => {
			this.effect.setUniform(
				"uMouse",
				new Float32Array([event.gameX / w, event.gameY / h]),
			);
			this.mouseStr = Math.min(1, this.mouseStr + 0.35);
		});
		input.registerPointerEvent("pointerdown", app.viewport, (event) => {
			this.effect.setUniform(
				"uMouse",
				new Float32Array([event.gameX / w, event.gameY / h]),
			);
			this.mouseStr = 1;
		});

		this.buildSlider(app);
	}

	// a live "ripple strength" slider — writes the uAmount uniform directly
	private buildSlider(app: Application) {
		const panel = document.createElement("div");
		panel.style.cssText =
			"position:absolute;top:60px;left:16px;z-index:1000;font-family:sans-serif;" +
			"color:#e8f6fa;background:rgba(0,0,0,0.45);padding:8px 12px;border-radius:6px;";
		const label = document.createElement("div");
		label.textContent = "🌊  Ripple strength";
		label.style.cssText = "font-size:12px;margin-bottom:6px;";
		const slider = document.createElement("input");
		slider.type = "range";
		slider.min = "0";
		slider.max = "0.08";
		slider.step = "0.001";
		slider.value = "0.035";
		slider.style.cssText = "width:190px;display:block;";
		slider.addEventListener("input", () => {
			this.effect.setUniform("uAmount", Number.parseFloat(slider.value));
		});
		const hint = document.createElement("div");
		hint.textContent = "move / click the pool to make waves";
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
		// drive the shader clock — this is what animates the refraction,
		// NOT a per-frame CPU noise re-bake
		this.effect.setTime(this.elapsed);
		// decay the pointer swell
		this.mouseStr = Math.max(0, this.mouseStr - (dt / 1000) * 1.5);
		this.effect.setUniform("uMouseStr", this.mouseStr);
		super.update(dt);
		// keep redrawing so the water animates every frame
		return true;
	}

	onDestroyEvent() {
		input.releasePointerEvent("pointermove", this.app.viewport);
		input.releasePointerEvent("pointerdown", this.app.viewport);
		this.effect.destroy();
		this.panel?.remove();
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		// ShaderEffect is a WebGL-only feature; under a Canvas fallback the
		// custom shader is a no-op and the floor would render undistorted.
		renderer: video.WEBGL,
		// LINEAR filtering so the refracted floor + noise sample smoothly
		antiAlias: true,
	});

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleWaterRefraction = createExampleComponent(createGame);
