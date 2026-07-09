/**
 * melonJS — heat-haze example (renderer.toFrameTexture() over a lit scene).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A grid of normal-mapped tiles lit by a moving `Light2d` (so the engine draws
 * them through the LIT quad batcher), seen through a rising heat-haze that
 * distorts the whole view. The haze surface, drawn last, captures the lit frame
 * with `renderer.toFrameTexture()` and ripples it.
 *
 * This is the scene that stresses the lit-batcher / capture interaction: the
 * lit batcher parks its normal maps in the TOP half of the texture-unit range,
 * and `toFrameTexture` binds its capture to a scratch unit at the very top —
 * the same units. The renderer invalidates that unit across every batcher after
 * the copy, so the next lit frame re-binds the real normal maps; without that,
 * a tile whose normal landed on the scratch unit would sample the captured
 * frame AS its normal map and light up wrong. (See tests/toframetexture.spec.js
 * "invalidates the scratch unit across all batchers ...".)
 */
import { DebugPanelPlugin } from "@melonjs/debug-plugin";
import {
	type Application,
	Light2d,
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

// rising-heat distortion. Samples the captured scene (uScene) with a vertical
// wobble that scrolls upward and is stronger lower on screen. Screen space is
// the quad's own UV, Y-flipped for the Y-up framebuffer capture.
const HAZE_FRAGMENT = `
uniform sampler2D uScene;   // captured lit frame, bound each draw via setTexture
uniform sampler2D uNoise;   // seamless flow map
uniform float uTime;
uniform float uStrength;

vec4 apply(vec4 color, vec2 uv) {
	vec2 s = vec2(uv.x, 1.0 - uv.y);
	float n1 = texture2D(uNoise, vec2(s.x * 2.0, s.y * 1.6 - uTime * 0.18)).r;
	float n2 = texture2D(uNoise, vec2(s.x * 3.3 + 0.5, s.y * 2.2 - uTime * 0.11)).r;
	float wob = (n1 + n2 - 1.0) * uStrength * (1.15 - s.y); // stronger near the floor
	vec2 d = clamp(s + vec2(wob, wob * 0.35), 0.0, 1.0);
	return vec4(texture2D(uScene, d).rgb, 1.0);
}
`;

// an embossed metal-ish tile: a base colour with a bevel highlight/shadow, so
// the normal-mapped relief reads clearly under the moving light
const tileAlbedo = (size: number, hue: number) => {
	const c = document.createElement("canvas");
	c.width = size;
	c.height = size;
	const ctx = c.getContext("2d") as CanvasRenderingContext2D;
	ctx.fillStyle = `hsl(${hue}, 30%, 42%)`;
	ctx.fillRect(0, 0, size, size);
	const b = size * 0.12;
	ctx.fillStyle = "rgba(255,255,255,0.18)";
	ctx.fillRect(b, b, size - 2 * b, size * 0.06); // top bevel
	ctx.fillStyle = "rgba(0,0,0,0.25)";
	ctx.fillRect(b, size - b - size * 0.06, size - 2 * b, size * 0.06); // bottom bevel
	ctx.strokeStyle = "rgba(0,0,0,0.35)";
	ctx.lineWidth = 2;
	ctx.strokeRect(1, 1, size - 2, size - 2);
	return c;
};

// the haze surface: full-viewport, drawn last; captures the lit frame and
// refracts it. framewidth/frameheight = viewport so the quad covers everything.
class HazeSurface extends Sprite {
	private effect: ShaderEffect;

	constructor(
		w: number,
		h: number,
		tex: HTMLCanvasElement,
		effect: ShaderEffect,
	) {
		super(w / 2, h / 2, {
			image: tex,
			framewidth: w,
			frameheight: h,
			anchorPoint: { x: 0.5, y: 0.5 },
		});
		this.effect = effect;
		this.shader = effect;
	}

	draw(renderer: Parameters<Sprite["draw"]>[0], viewport?: object) {
		const scene = renderer.toFrameTexture();
		this.effect.setTexture("uScene", scene);
		// biome-ignore lint/suspicious/noExplicitAny: viewport shape varies by call site
		super.draw(renderer, viewport as any);
	}
}

class PlayScreen extends Stage {
	private elapsed = 0;
	private light!: Light2d;
	private effect!: ShaderEffect;
	private w = 0;
	private h = 0;
	private noiseTextures: NoiseTexture2d[] = [];

	onResetEvent(app: Application) {
		this.w = app.viewport.width;
		this.h = app.viewport.height;
		const w = this.w;
		const h = this.h;

		// neutral ambient floor so unlit tile areas aren't pitch black
		this.ambientLightingColor.setColor(70, 74, 90);

		// a viewport-sized white sheen texture for the haze quad's albedo
		// (ignored by the shader, which samples the captured scene instead).
		// Must match framewidth/frameheight so the quad's UVs span a clean [0,1]
		// — a 1x1 image stretched via framewidth produces degenerate UVs.
		const white = document.createElement("canvas");
		white.width = w;
		white.height = h;
		const wctx = white.getContext("2d") as CanvasRenderingContext2D;
		wctx.fillStyle = "#fff";
		wctx.fillRect(0, 0, w, h);

		// Enough DISTINCT normal-mapped tiles to fill the lit batcher's normal-map
		// units up to the top one — that top unit overlaps the units the capture
		// and the haze effect's samplers bind, so this is the case the
		// invalidation guards. Build each distinct (albedo, normal) ONCE and
		// reuse it across repeated grid cells.
		const maxTextures = app.renderer.maxTextures ?? 16;
		const distinctTiles = Math.min(24, Math.ceil(maxTextures / 2) + 2);
		const albedos: HTMLCanvasElement[] = [];
		const normals: HTMLCanvasElement[] = [];
		for (let v = 0; v < distinctTiles; v++) {
			albedos.push(tileAlbedo(96, (v * 37) % 360));
			const n = new NoiseTexture2d({
				width: 96,
				height: 96,
				type: "simplex",
				seed: 3 + v * 5,
				frequency: 0.06 + (v % 4) * 0.01,
				octaves: 3,
				asNormalMap: true,
				bumpStrength: 2.2,
			});
			this.noiseTextures.push(n);
			normals.push(n.getTexture() as HTMLCanvasElement);
		}

		const cols = 6;
		const rows = 4;
		const tileW = w / cols;
		const tileH = h / rows;
		let k = 0;
		for (let r = 0; r < rows; r++) {
			for (let cx = 0; cx < cols; cx++) {
				const variant = k % distinctTiles;
				const tile = new Sprite(cx * tileW + tileW / 2, r * tileH + tileH / 2, {
					image: albedos[variant],
					normalMap: normals[variant],
					framewidth: 96,
					frameheight: 96,
					anchorPoint: { x: 0.5, y: 0.5 },
				});
				tile.scale((tileW / 96) * 0.98, (tileH / 96) * 0.98);
				app.world.addChild(tile, 1);
				k++;
			}
		}

		// the moving light that reveals the normal-mapped relief
		this.light = new Light2d(w / 2, h / 2, w * 0.55, w * 0.55, "#fff2d8", 2.4);
		this.light.illuminationOnly = true;
		app.world.addChild(this.light, 2);

		// the heat-haze post-pass (z 100, above the lit tiles it distorts)
		const noise = new NoiseTexture2d({
			width: 256,
			height: 256,
			type: "simplex",
			seed: 99,
			frequency: 0.03,
			octaves: 3,
			seamless: true,
		});
		this.noiseTextures.push(noise);
		this.effect = loader.getShader("heatHaze") as ShaderEffect;
		this.effect.setTexture("uNoise", noise, "repeat");
		this.effect.setUniform("uStrength", 0.02);
		app.world.addChild(new HazeSurface(w, h, white, this.effect), 100);
	}

	update(dt: number) {
		this.elapsed += dt / 1000;
		// orbit the light so the normal-mapped relief shifts every frame — makes
		// any normal-map corruption from the capture obvious if the fix regressed
		const t = this.elapsed;
		this.light.pos.set(
			this.w * (0.5 + 0.34 * Math.cos(t * 0.7)),
			this.h * (0.5 + 0.3 * Math.sin(t * 0.9)),
			0,
		);
		this.effect.setTime(this.elapsed);
		super.update(dt);
		return true;
	}

	onDestroyEvent() {
		loader.unload({ name: "heatHaze", type: "shader" });
		// free the baked NoiseTexture2d canvases (tile normals + haze flow map)
		for (const n of this.noiseTextures) {
			n.destroy();
		}
		this.noiseTextures = [];
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scale: "auto",
		// Light2d normal-map lighting + toFrameTexture are WebGL features
		renderer: video.WEBGL,
		antiAlias: true,
		subPixel: true,
	});

	// register the debug plugin (hidden by default; press S to toggle)
	plugin.register(DebugPanelPlugin, "debugPanel");

	state.set(state.PLAY, new PlayScreen());

	loader.preload(
		[{ name: "heatHaze", type: "shader", data: HAZE_FRAGMENT }],
		() => {
			state.change(state.PLAY);
		},
		false,
	);
};

export const ExampleHeatHaze = createExampleComponent(createGame);
