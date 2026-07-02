/**
 * melonJS — water refraction example (ShaderEffect.setTexture).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A swimming pool seen at a perspective angle, its tiled floor rippling under
 * the water — built with a single custom `ShaderEffect` that reads TWO textures:
 * - `uSampler` — the sprite's own albedo (the seamless pool tiles), bound by the
 *   engine as usual.
 * - `uNoise` — a *static* seamless `NoiseTexture2d`, bound as an **extra**
 *   sampler via `effect.setTexture("uNoise", noise.getTexture())`.
 *
 * The fragment projects each screen pixel onto a tilted floor plane (a "mode-7"
 * perspective floor receding to a horizon), then distorts the floor UVs with two
 * noise layers scrolled on the GPU (driven by `effect.setTime`). Because the
 * distortion is constant in *floor* space, the ripples are automatically
 * perspective-correct — fine and tight near the horizon, broad up close. A
 * pointer swell, depth fog and animated caustics ride on top. No per-frame CPU
 * noise re-bake, no `Light2d`; `setTexture` is what makes the second sampler a
 * one-liner (see issue #1532).
 *
 * The fragment ships as a preloaded `"shader"` asset: compiled once at load
 * time and retrieved as a shared, loader-owned `ShaderEffect` via
 * `loader.getShader()` — freed with `loader.unload()` on stage teardown.
 */
import {
	type Application,
	input,
	loader,
	NoiseTexture2d,
	type ShaderEffect,
	Sprite,
	Stage,
	state,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

// A GLSL ES 1.00 fragment (what ShaderEffect wraps). `apply(color, uv)` receives
// the pre-sampled/tinted sprite color and its texture coords; we ignore the flat
// color and re-sample `uSampler` at perspective-projected, refracted coords.
const REFRACTION_FRAGMENT = `
uniform sampler2D uNoise;   // extra texture, bound via setTexture
uniform float uTime;        // seconds, fed via setTime
uniform float uAmount;      // ripple strength (slider)
uniform float uCaustic;     // caustic sparkle intensity
uniform vec2  uMouse;       // pointer position in screen uv
uniform float uMouseStr;    // decaying pointer impulse

const float HORIZON = 0.30; // screen height of the far water edge
const float DEPTH   = 0.22; // how fast the floor recedes past the horizon
const float TILES   = 1.6;  // pool-tile repeats per unit of floor depth

vec4 apply(vec4 color, vec2 uv) {
	// a radial swell that follows the pointer and fades over ~1s (screen space)
	vec2 toMouse = uv - uMouse;
	float md = length(toMouse);
	float swell = uMouseStr * exp(-md * 11.0) * sin(md * 42.0 - uTime * 7.0);
	vec2 suv = uv + (md > 0.001 ? toMouse / md : vec2(0.0)) * swell * 0.02;

	// above the waterline: distant water fading up to a faint horizon glow
	if (suv.y <= HORIZON) {
		float t = suv.y / HORIZON; // 0 at top .. 1 at the horizon
		vec3 sky = mix(vec3(0.02, 0.10, 0.16), vec3(0.06, 0.30, 0.38), t);
		sky += vec3(0.10, 0.16, 0.18) * pow(t, 6.0);
		return vec4(sky, 1.0);
	}

	// project the pixel onto the tilted floor plane (perspective / mode-7)
	float depth = DEPTH / (suv.y - HORIZON);           // grows toward the horizon
	vec2 floorUV = vec2((suv.x - 0.5) * depth * 2.0, depth);

	// two noise layers scrolling in different directions refract the floor.
	// a CONSTANT offset in floor space is what makes the ripples shrink with
	// distance — no extra perspective math needed.
	vec2 n1 = texture2D(uNoise, floorUV * 0.16 + vec2(uTime * 0.03, uTime * 0.06)).rg;
	vec2 n2 = texture2D(uNoise, floorUV * 0.26 - vec2(uTime * 0.02, uTime * 0.05)).rg;
	vec2 flow = n1 + n2 - 1.0;

	vec2 tileUV = floorUV * TILES + flow * uAmount;
	vec4 base = texture2D(uSampler, fract(tileUV));    // seamless tiles → fract wraps

	// depth fog: fade toward the horizon into deep teal
	float near = clamp((suv.y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0); // 0 far .. 1 near
	base.rgb = mix(vec3(0.03, 0.15, 0.20), base.rgb, near * 0.8 + 0.2);

	// caustics where the two flow layers overlap, brighter near the camera
	float caustic = pow(max(n1.r * n2.g, 0.0), 3.0) * uCaustic * (near * 0.7 + 0.3);
	return vec4(base.rgb + vec3(caustic), 1.0);
}
`;

// paint a seamless swimming-pool tile texture: grout-coloured base with inset
// tiles, so the outer border is grout on all four edges → tiles cleanly under
// the shader's fract() wrapping.
const poolTiles = (size: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

	// grout base (also the seamless edge colour)
	ctx.fillStyle = "#063a47";
	ctx.fillRect(0, 0, size, size);

	const tile = size / 4; // 4×4 tiles
	for (let ry = 0; ry < 4; ry++) {
		for (let rx = 0; rx < 4; rx++) {
			ctx.fillStyle = (rx + ry) % 2 === 0 ? "#0d7086" : "#0a6076";
			ctx.fillRect(rx * tile + 3, ry * tile + 3, tile - 6, tile - 6);
			// a soft top-left highlight on each tile for a wet, glossy read
			ctx.fillStyle = "rgba(180, 230, 240, 0.06)";
			ctx.fillRect(rx * tile + 3, ry * tile + 3, tile - 6, 4);
		}
	}
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

		// the refraction effect, preloaded as a "shader" asset — compiled once
		// during loading; getShader returns the SHARED, loader-owned instance
		this.effect = loader.getShader("refraction") as ShaderEffect;
		// bind the noise as an extra sampler — "repeat" so the projected/scrolled
		// floor UVs wrap seamlessly toward the horizon
		this.effect.setTexture("uNoise", noise.getTexture(), "repeat");
		this.effect.setUniform("uAmount", 0.06);
		this.effect.setUniform("uCaustic", 0.5);
		this.effect.setUniform("uMouse", new Float32Array([0.5, 0.7]));
		this.effect.setUniform("uMouseStr", 0);

		// a full-viewport sprite whose albedo is the pool tiles; the effect
		// projects + refracts that texture into a perspective pool floor
		const floor = new Sprite(w / 2, h / 2, {
			image: poolTiles(256),
			framewidth: w,
			frameheight: h,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		floor.shader = this.effect;
		app.world.addChild(floor, 0);

		// touch the water → a swell that follows the pointer and decays
		const setMouse = (gx: number, gy: number) => {
			this.effect.setUniform("uMouse", new Float32Array([gx / w, gy / h]));
		};
		input.registerPointerEvent("pointermove", app.viewport, (event) => {
			setMouse(event.gameX, event.gameY);
			this.mouseStr = Math.min(1, this.mouseStr + 0.35);
		});
		input.registerPointerEvent("pointerdown", app.viewport, (event) => {
			setMouse(event.gameX, event.gameY);
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
		slider.max = "0.15";
		slider.step = "0.005";
		slider.value = "0.06";
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
		// the loader owns the shared shader — unloading is what frees it
		// (the floor sprite's own cleanup skips it, since `shared` is true).
		// NOTE: this example is single-stage, so its onDestroyEvent only fires
		// on final teardown. In a multi-stage game, unload in your GAME's
		// teardown instead — onDestroyEvent fires on every stage switch, and
		// a re-entered stage would then getShader() a name that's gone.
		loader.unload({ name: "refraction", type: "shader" });
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

	// ship the refraction shader as a preloaded "shader" asset: compiled once
	// at load time (inline GLSL via `data` here — a `.frag` URL via `src`
	// works the same) and retrieved ready-made with loader.getShader()
	loader.preload(
		[{ name: "refraction", type: "shader", data: REFRACTION_FRAGMENT }],
		() => {
			state.change(state.PLAY);
		},
		false,
	);
};

export const ExampleWaterRefraction = createExampleComponent(createGame);
