/**
 * melonJS — particle editor: the built-in particle textures.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */

/**
 * A particle texture: drawn in white, so the emitter's tint colors it, and
 * on a canvas, so the editor ships no image files. Each one can be saved as
 * a PNG to go with the generated code.
 */
export interface Texture {
	id: string;
	label: string;
	/** the image handed to the emitter; undefined for the emitter's own square */
	image: HTMLCanvasElement | HTMLImageElement | undefined;
	/** a sprite sheet: the size of one frame */
	framewidth?: number;
	frameheight?: number;
}

const canvas = (
	w: number,
	h: number,
	paint: (ctx: CanvasRenderingContext2D) => void,
) => {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	const ctx = c.getContext("2d");
	if (ctx) {
		paint(ctx);
	}
	return c;
};

/** a radial falloff from white, `inner` the share of the radius kept solid */
const radial = (size: number, inner: number) => {
	return canvas(size, size, (ctx) => {
		const r = size / 2;
		const g = ctx.createRadialGradient(r, r, r * inner, r, r, r);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	});
};

/** a small seeded generator, so the smoke looks the same on every visit */
const seeded = (seed: number) => {
	let s = seed;
	return () => {
		s = (s * 16807) % 2147483647;
		return s / 2147483647;
	};
};

const smoke = () => {
	return canvas(64, 64, (ctx) => {
		const random = seeded(7);
		// a puff is a cluster of soft blobs, thinner toward the edge
		for (let i = 0; i < 14; i++) {
			const a = random() * Math.PI * 2;
			const d = random() * 14;
			const x = 32 + Math.cos(a) * d;
			const y = 32 + Math.sin(a) * d;
			const r = 10 + random() * 10;
			const g = ctx.createRadialGradient(x, y, 0, x, y, r);
			g.addColorStop(0, "rgba(255,255,255,0.35)");
			g.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 64, 64);
		}
	});
};

const spark = () => {
	// pointing right, as `followTrajectory` expects
	return canvas(32, 8, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 32, 0);
		g.addColorStop(0, "rgba(255,255,255,0)");
		g.addColorStop(0.7, "rgba(255,255,255,0.8)");
		g.addColorStop(1, "rgba(255,255,255,1)");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(16, 4, 16, 3, 0, 0, Math.PI * 2);
		ctx.fill();
	});
};

const drop = () => {
	return canvas(6, 24, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, 24);
		g.addColorStop(0, "rgba(255,255,255,0)");
		g.addColorStop(1, "rgba(255,255,255,0.9)");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(3, 12, 2, 12, 0, 0, Math.PI * 2);
		ctx.fill();
	});
};

const star = () => {
	return canvas(32, 32, (ctx) => {
		// a four-pointed glint over a soft core
		const core = ctx.createRadialGradient(16, 16, 0, 16, 16, 8);
		core.addColorStop(0, "rgba(255,255,255,1)");
		core.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = core;
		ctx.fillRect(0, 0, 32, 32);
		ctx.fillStyle = "#fff";
		ctx.beginPath();
		for (let i = 0; i < 8; i++) {
			const a = (i * Math.PI) / 4;
			const r = i % 2 === 0 ? 16 : 2.5;
			ctx.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
		}
		ctx.closePath();
		ctx.fill();
	});
};

const dot = () => {
	return canvas(16, 16, (ctx) => {
		ctx.fillStyle = "#fff";
		ctx.beginPath();
		ctx.arc(8, 8, 7, 0, Math.PI * 2);
		ctx.fill();
	});
};

const builders: Record<string, [string, () => HTMLCanvasElement | undefined]> =
	{
		square: ["Square (built in)", () => undefined],
		dot: ["Dot", dot],
		glow: ["Glow", () => radial(32, 0)],
		smoke: ["Smoke", smoke],
		spark: ["Spark", spark],
		drop: ["Drop", drop],
		star: ["Star", star],
	};

const cache = new Map<string, Texture>();

/** the built-in textures, in the order the selector lists them */
export const BUILT_IN = Object.keys(builders);

/**
 * A built-in texture, drawn on first use and kept.
 * @param id - one of {@link BUILT_IN}
 * @returns the texture
 */
export const builtIn = (id: string): Texture => {
	let texture = cache.get(id);
	if (!texture) {
		const [label, build] = builders[id] ?? builders.square;
		texture = { id, label, image: build() };
		cache.set(id, texture);
	}
	return texture;
};

/**
 * Read an image file chosen by the player, locally: it is never uploaded.
 * @param file - the chosen file
 * @returns the decoded image
 */
export const loadFile = (file: File): Promise<HTMLImageElement> => {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(`${file.name} is not an image the browser can read`));
		};
		image.src = url;
	});
};

/**
 * Save a built-in texture as a PNG, to go with the generated code.
 * @param texture - the texture to save
 */
export const download = (texture: Texture) => {
	const image = texture.image;
	if (!(image instanceof HTMLCanvasElement)) {
		return;
	}
	image.toBlob((blob) => {
		if (!blob) {
			return;
		}
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${texture.id}.png`;
		a.click();
		setTimeout(() => {
			URL.revokeObjectURL(a.href);
		}, 1000);
	}, "image/png");
};
