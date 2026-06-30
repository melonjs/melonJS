import { beforeAll, describe, expect, it } from "vitest";
import {
	boot,
	Gradient,
	NoiseTexture2d,
	Sprite,
	Texture2d,
	video,
} from "../src/index.js";

const pixels = (tex) => {
	const canvas = tex.getTexture();
	const ctx = canvas.getContext("2d");
	return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
};

// average absolute difference between the left and right edge columns (red
// channel) — a proxy for the horizontal tiling seam.
const edgeSeam = (tex) => {
	const canvas = tex.getTexture();
	const w = canvas.width;
	const h = canvas.height;
	const data = pixels(tex);
	let sum = 0;
	for (let y = 0; y < h; y++) {
		const left = data[(y * w + 0) * 4];
		const right = data[(y * w + (w - 1)) * 4];
		sum += Math.abs(left - right);
	}
	return sum / h;
};

describe("NoiseTexture2d", () => {
	beforeAll(() => {
		boot();
		video.init(320, 240, { parent: "screen", renderer: video.CANVAS });
	});

	it("is a Texture2d and bakes a canvas of the requested size", () => {
		const tex = new NoiseTexture2d({ width: 64, height: 48, seed: 1 });
		expect(tex instanceof Texture2d).toBe(true);
		const canvas = tex.getTexture();
		expect(canvas.width).toBe(64);
		expect(canvas.height).toBe(48);
	});

	it("grayscale mode writes equal RGB channels, opaque", () => {
		const tex = new NoiseTexture2d({ width: 32, height: 32, seed: 2 });
		const data = pixels(tex);
		for (let i = 0; i < data.length; i += 4) {
			expect(data[i]).toBe(data[i + 1]);
			expect(data[i + 1]).toBe(data[i + 2]);
			expect(data[i + 3]).toBe(255);
		}
	});

	it("colorRamp mode maps the field through the gradient (not gray)", () => {
		const ramp = new Gradient("linear", [0, 0, 1, 0]);
		ramp.addColorStop(0, "#ff0000");
		ramp.addColorStop(1, "#0000ff");
		const tex = new NoiseTexture2d({
			width: 48,
			height: 48,
			seed: 3,
			colorRamp: ramp,
		});
		const data = pixels(tex);
		let nonGray = 0;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i] !== data[i + 2]) {
				nonGray++;
			}
		}
		// most pixels lie somewhere on the red↔blue ramp, so R ≠ B
		expect(nonGray).toBeGreaterThan(0);
	});

	it("asNormalMap mode encodes outward-facing normals (blue-dominant), opaque", () => {
		const tex = new NoiseTexture2d({
			width: 48,
			height: 48,
			seed: 4,
			asNormalMap: true,
			bumpStrength: 1,
		});
		const data = pixels(tex);
		let blueSum = 0;
		let count = 0;
		for (let i = 0; i < data.length; i += 4) {
			blueSum += data[i + 2];
			count++;
			expect(data[i + 3]).toBe(255);
		}
		// nz dominates a gentle height field, so the encoded blue (≈128..255) is
		// on average well above the neutral 128 midpoint.
		expect(blueSum / count).toBeGreaterThan(128);
	});

	it("seamless tiling reduces the edge seam vs. a non-seamless bake", () => {
		const common = { width: 64, height: 64, seed: 5, frequency: 0.08 };
		const plain = new NoiseTexture2d({ ...common, seamless: false });
		const tiled = new NoiseTexture2d({ ...common, seamless: true });
		expect(edgeSeam(tiled)).toBeLessThan(edgeSeam(plain));
	});

	it("is accepted directly as a Sprite image and normalMap", () => {
		const albedo = new NoiseTexture2d({ width: 32, height: 32, seed: 6 });
		const normal = new NoiseTexture2d({
			width: 32,
			height: 32,
			seed: 6,
			asNormalMap: true,
		});
		const sprite = new Sprite(0, 0, {
			image: albedo,
			normalMap: normal,
			anchorPoint: { x: 0, y: 0 },
		});
		expect(sprite.image).toBe(albedo.getTexture());
		expect(sprite.normalMap).toBe(normal.getTexture());
	});

	it("destroy() releases the baked canvas", () => {
		const tex = new NoiseTexture2d({ width: 16, height: 16, seed: 7 });
		expect(tex.getTexture()).not.toBeNull();
		tex.destroy();
		expect(tex.getTexture()).toBeNull();
	});

	it("seamlessBlendSkirt is clamped to [0,1]", () => {
		expect(
			new NoiseTexture2d({ seamlessBlendSkirt: 5 }).seamlessBlendSkirt,
		).toBe(1);
		expect(
			new NoiseTexture2d({ seamlessBlendSkirt: -2 }).seamlessBlendSkirt,
		).toBe(0);
	});

	it("animated update(dt) re-bakes the field into the same canvas + bumps version", () => {
		const tex = new NoiseTexture2d({
			width: 32,
			height: 32,
			seed: 8,
			animated: true,
		});
		const canvas = tex.getTexture();
		const before = pixels(tex);
		const v0 = canvas.version;
		tex.update(1000); // advance 1s, re-bake
		// the canvas reference is stable across re-bakes (so re-upload replaces it)
		expect(tex.getTexture()).toBe(canvas);
		// the version bumped so the renderer knows to re-upload
		expect(canvas.version).toBeGreaterThan(v0);
		const after = pixels(tex);
		let changed = 0;
		for (let i = 0; i < after.length; i++) {
			if (after[i] !== before[i]) {
				changed++;
			}
		}
		expect(changed).toBeGreaterThan(0);
	});

	it("update(dt) is a no-op for a non-animated texture", () => {
		const tex = new NoiseTexture2d({ width: 16, height: 16, seed: 1 });
		const before = tex.getTexture().version;
		tex.update(1000);
		expect(tex.getTexture().version).toBe(before);
	});
});
