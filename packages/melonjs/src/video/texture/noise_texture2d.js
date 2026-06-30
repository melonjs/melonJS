import { Color } from "../../math/color.ts";
import { Noise } from "../../math/noise.ts";
import Renderer from "../renderer.js";
import Texture2d from "./texture2d.ts";

const smoothstep = (t) => {
	const c = t < 0 ? 0 : t > 1 ? 1 : t;
	return c * c * (3 - 2 * c);
};

const lerp = (a, b, t) => {
	return a + (b - a) * t;
};

/**
 * A {@link Texture2d} that bakes a {@link Noise} field into a drawable canvas —
 * usable directly as a sprite image, a normal map, an image layer, or a custom
 * shader sampler.
 *
 * The bake runs on the CPU (renderer-agnostic, works under both the Canvas and
 * WebGL backends) and produces an `HTMLCanvasElement` returned by
 * {@link NoiseTexture2d#getTexture}. Three output modes:
 * - **grayscale** (default) — the noise value mapped to `[0, 255]`.
 * - **colorRamp** — the noise value mapped through a {@link Gradient}.
 * - **asNormalMap** — the noise treated as a height field and encoded as
 *   tangent-space surface normals (RGB), for per-pixel lighting via
 *   {@link Sprite#normalMap} + {@link Light2d}.
 *
 * With `seamless: true` the texture's edges are cross-faded so it tiles with a
 * much-reduced seam (an approximate, not pixel-exact, wrap); `seamlessBlendSkirt`
 * controls how wide that edge blend band is. With `animated: true` the field is
 * sampled in 3D (`getNoise3d`) using an internal `time` as the third axis —
 * call {@link NoiseTexture2d#update} from your update loop to evolve it. Each
 * re-bake bumps a `version` the renderer reads, so the GPU texture re-uploads
 * automatically (and only when it actually changed — the three.js
 * `Texture.needsUpdate` model).
 *
 * Note: live re-upload is currently wired through the lit **normal-map**
 * pipeline ({@link Sprite#normalMap} + {@link Light2d}). An `animated` texture
 * used as a plain color `image` bakes a static snapshot — the color texture
 * cache does not yet honor `version` — so animate normals, not albedos, for now.
 * @augments Texture2d
 * @category Game Objects
 * @example
 * // a seamless water normal map fed to a lit sprite
 * const ripples = new me.NoiseTexture2d({
 *     width: 256, height: 256,
 *     type: "simplex", octaves: 4, frequency: 0.03,
 *     seamless: true, asNormalMap: true, bumpStrength: 2, animated: true, speed: 0.6,
 * });
 * const water = new me.Sprite(x, y, { image: albedo, normalMap: ripples });
 * // drive it yourself from your Stage's update(dt):
 * ripples.update(dt);
 */
class NoiseTexture2d extends Texture2d {
	/**
	 * @param {object} [settings] - configuration; any {@link Noise} setting
	 * (`type`, `seed`, `frequency`/`scale`, `octaves`, `gain`/`persistence`,
	 * `lacunarity`, `fractalType`, domain-warp settings) is forwarded when no
	 * `noise` instance is given.
	 * @param {number} [settings.width=256] - baked texture width in pixels
	 * @param {number} [settings.height=256] - baked texture height in pixels
	 * @param {Noise} [settings.noise] - an existing {@link Noise} to bake; when
	 * omitted one is built from the forwarded settings
	 * @param {boolean} [settings.seamless=false] - tile cleanly in both axes
	 * @param {number} [settings.seamlessBlendSkirt=0.1] - edge blend band width
	 * as a fraction (0..1) of the smaller dimension, when `seamless`
	 * @param {boolean} [settings.invert=false] - invert the noise value (`1 - v`)
	 * @param {boolean} [settings.asNormalMap=false] - encode as a normal map
	 * @param {number} [settings.bumpStrength=1] - normal steepness when `asNormalMap`
	 * @param {Gradient} [settings.colorRamp] - map the noise value to a color
	 * @param {boolean} [settings.animated=false] - sample in 3D (`getNoise3d`)
	 * using an internal `time` as the third axis, advanced by {@link NoiseTexture2d#update}
	 * @param {number} [settings.speed=1] - animation speed in noise z-units per
	 * second (only used while `animated`)
	 */
	constructor(settings = {}) {
		super();

		/** baked texture width in pixels @type {number} */
		this.width = settings.width ?? 256;
		/** baked texture height in pixels @type {number} */
		this.height = settings.height ?? 256;
		/** the noise field baked by this texture @type {Noise} */
		this.noise =
			settings.noise instanceof Noise ? settings.noise : new Noise(settings);
		/** tile cleanly in both axes @type {boolean} */
		this.seamless = settings.seamless ?? false;
		/** edge blend band width (0..1 of the smaller dimension) @type {number} */
		this.seamlessBlendSkirt = Math.min(
			1,
			Math.max(0, settings.seamlessBlendSkirt ?? 0.1),
		);
		/** invert the noise value @type {boolean} */
		this.invert = settings.invert ?? false;
		/** encode the field as a tangent-space normal map @type {boolean} */
		this.asNormalMap = settings.asNormalMap ?? false;
		/** normal steepness when `asNormalMap` @type {number} */
		this.bumpStrength = settings.bumpStrength ?? 1.0;
		/** optional color ramp applied to the noise value @type {Gradient|null} */
		this.colorRamp = settings.colorRamp ?? null;
		/** sample the field in 3D using `time` as the third axis @type {boolean} */
		this.animated = settings.animated ?? false;
		/** animation speed in noise z-units per second @type {number} */
		this.speed = settings.speed ?? 1;
		/** the current animation time (third sampling axis) @type {number} */
		this.time = 0;

		/** the baked output canvas (reused across re-bakes) @type {HTMLCanvasElement|null} @ignore */
		this._canvas = null;
		/** reused ImageData scratch (avoids a per-bake allocation) @type {ImageData|null} @ignore */
		this._imageData = null;
		/** reused height-field scratch (avoids a per-bake allocation) @type {Float32Array|null} @ignore */
		this._heights = null;
		/** content revision, bumped on every bake and stamped on the canvas so
		 * the renderer re-uploads the GPU texture when it changes @type {number} @ignore */
		this._version = 0;

		this.bake();
	}

	/**
	 * The current content revision, bumped on every {@link NoiseTexture2d#bake}.
	 * Also stamped on the baked canvas (`getTexture().version`) so the renderer
	 * re-uploads the GPU texture only when it actually changed.
	 * @returns {number}
	 */
	get version() {
		return this._version;
	}

	/**
	 * (Re)bake the texture from the current settings into the (reused) output
	 * canvas. Called once on construction; {@link NoiseTexture2d#update} calls it
	 * again per frame for animated textures.
	 * @returns {NoiseTexture2d} this texture for chaining
	 */
	bake() {
		const w = this.width;
		const h = this.height;
		// reuse the same canvas so the texture reference stays stable across
		// re-bakes (so an in-place re-upload can replace its GPU texture)
		if (this._canvas === null) {
			this._canvas = Renderer.createCanvas(w, h);
		}
		const ctx = this._canvas.getContext("2d");
		// reuse the ImageData scratch across re-bakes (animated textures re-bake
		// every frame — avoid the per-frame allocation)
		if (this._imageData === null) {
			this._imageData = ctx.createImageData(w, h);
		}
		const img = this._imageData;

		const heights = this._buildHeightField();
		if (this.asNormalMap) {
			this._writeNormalMap(img.data, heights);
		} else if (this.colorRamp) {
			this._writeColorRamp(img.data, heights);
		} else {
			this._writeGrayscale(img.data, heights);
		}

		ctx.putImageData(img, 0, 0);
		// bump the content revision and stamp it on the canvas; the renderer
		// reads `canvas.version` and re-uploads the GPU texture when it changes.
		this._version++;
		this._canvas.version = this._version;
		return this;
	}

	/**
	 * Advance an animated texture by `dt` milliseconds and re-bake it. The
	 * re-bake bumps the texture's `version`, so the renderer re-uploads the GPU
	 * texture automatically on the next draw — no renderer/app handle needed.
	 *
	 * This is NOT auto-called by the engine; drive it from your own update loop
	 * (e.g. {@link Stage#update}) for animated textures. No-op when not `animated`.
	 * @param {number} dt - elapsed time since the last update, in milliseconds
	 * @returns {NoiseTexture2d} this texture for chaining
	 */
	update(dt) {
		if (this.animated) {
			this.time += (dt / 1000) * this.speed;
			this.bake();
		}
		return this;
	}

	/**
	 * Raw noise sample at a texture pixel (2D, or 3D when animated). The time
	 * axis is divided by the noise frequency so that, after `getNoise3d` scales
	 * all coords by frequency, the field evolves at `speed` noise-units/second —
	 * decoupled from the spatial frequency (otherwise low-frequency textures
	 * would animate imperceptibly slowly).
	 * @ignore
	 */
	_rawNoise(x, y) {
		if (!this.animated) {
			return this.noise.getNoise2d(x, y);
		}
		const z = this.time / (this.noise.frequency || 1);
		return this.noise.getNoise3d(x, y, z);
	}

	/**
	 * x-axis seamless blend: in the right skirt band, cross-fade toward the
	 * wrapped (period-shifted) sample so the left and right edges meet.
	 * @ignore
	 */
	_blendX(x, y, w, sk) {
		const base = this._rawNoise(x, y);
		if (x <= w - sk) {
			return base;
		}
		const t = smoothstep((x - (w - sk)) / sk);
		return lerp(base, this._rawNoise(x - w, y), t);
	}

	/**
	 * Sample the noise into a `[0, 1]` height field. When `seamless`, a skirt
	 * cross-fade near the far edges blends opposite edges so the texture tiles
	 * with a much-reduced seam.
	 * @returns {Float32Array} the per-pixel height field (length `width*height`)
	 * @ignore
	 */
	_buildHeightField() {
		const w = this.width;
		const h = this.height;
		// reused across re-bakes (animated textures re-bake every frame)
		if (this._heights === null) {
			this._heights = new Float32Array(w * h);
		}
		const heights = this._heights;
		const sk = Math.max(
			1,
			Math.round(this.seamlessBlendSkirt * Math.min(w, h)),
		);
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				let n;
				if (this.seamless) {
					const top = this._blendX(x, y, w, sk);
					if (y <= h - sk) {
						n = top;
					} else {
						const ty = smoothstep((y - (h - sk)) / sk);
						n = lerp(top, this._blendX(x, y - h, w, sk), ty);
					}
				} else {
					n = this._rawNoise(x, y);
				}
				// map [-1,1] → [0,1], clamp, optional invert
				let v = n * 0.5 + 0.5;
				if (v < 0) {
					v = 0;
				} else if (v > 1) {
					v = 1;
				}
				if (this.invert) {
					v = 1 - v;
				}
				heights[y * w + x] = v;
			}
		}
		return heights;
	}

	/** @ignore */
	_writeGrayscale(data, heights) {
		for (let i = 0; i < heights.length; i++) {
			const c = Math.round(heights[i] * 255);
			const o = i * 4;
			data[o] = c;
			data[o + 1] = c;
			data[o + 2] = c;
			data[o + 3] = 255;
		}
	}

	/** @ignore */
	_writeColorRamp(data, heights) {
		const ramp = this.colorRamp;
		const color = new Color();
		for (let i = 0; i < heights.length; i++) {
			ramp.getColorAt(heights[i], color);
			const o = i * 4;
			data[o] = Math.round(color.r);
			data[o + 1] = Math.round(color.g);
			data[o + 2] = Math.round(color.b);
			data[o + 3] = Math.round(color.alpha * 255);
		}
	}

	/**
	 * Encode the height field as a tangent-space normal map (RGB), with screen-Y
	 * flipped to normal-map Y-up so it round-trips through the lit shader's
	 * `rgb * 2 - 1` decode. Neighbor samples wrap when `seamless`.
	 * @ignore
	 */
	_writeNormalMap(data, heights) {
		const w = this.width;
		const h = this.height;
		const strength = this.bumpStrength;
		const seamless = this.seamless;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const xl = seamless ? (x - 1 + w) % w : Math.max(0, x - 1);
				const xr = seamless ? (x + 1) % w : Math.min(w - 1, x + 1);
				const yu = seamless ? (y - 1 + h) % h : Math.max(0, y - 1);
				const yd = seamless ? (y + 1) % h : Math.min(h - 1, y + 1);
				const hl = heights[y * w + xl];
				const hr = heights[y * w + xr];
				const hu = heights[yu * w + x];
				const hd = heights[yd * w + x];
				let nx = (hl - hr) * strength;
				// hd is the row below (larger screen-y); (hd - hu) flips screen-down
				// into normal-map Y-up.
				let ny = (hd - hu) * strength;
				let nz = 1;
				const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
				nx /= len;
				ny /= len;
				nz /= len;
				const o = (y * w + x) * 4;
				data[o] = Math.round((nx * 0.5 + 0.5) * 255);
				data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
				data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
				data[o + 3] = 255;
			}
		}
	}

	/**
	 * @returns {HTMLCanvasElement} the baked texture canvas
	 */
	getTexture() {
		return this._canvas;
	}

	/**
	 * Release the baked canvas. The texture must not be used after destroy.
	 */
	destroy() {
		this._canvas = null;
		this._imageData = null;
		this._heights = null;
	}
}

export default NoiseTexture2d;
