/**
 * Draws the sprite artwork for the `physicsShapes` example, straight from
 * the shape file the physics itself loads.
 *
 * The point is the shared source. The example exists to show one shape file
 * driving three solvers, and it used to draw ONLY the collision outlines
 * each adapter reports — which looks right by construction, because the
 * outline IS the visual. Nothing was on screen for it to be measured
 * against, so an adapter that placed a body slightly off drew a slightly
 * off outline and looked perfectly fine. That is exactly how the matter
 * adapter shipped a polygon-placement bug (fixed in 1.4.1): a traced
 * outline drifted by tens of pixels, and only artwork underneath it could
 * have shown that.
 *
 * So the art is generated from the same JSON, in the same coordinate
 * space, with image pixel (0, 0) at the body's local origin. Draw the
 * sprite at `pos` and the reported shapes at `pos`, and any disagreement
 * between the two is a real bug you can see.
 *
 * Run: node scripts/generate-physics-shape-sprites.mjs
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "public", "assets", "physicsShapes");

/** Body colours, matching the palette the example labels each body with. */
const PALETTE = {
	star: "#ffd166",
	hook: "#06d6a0",
	cog: "#ef476f",
	crate: "#118ab2",
};

/** Supersampling factor per axis; 4 means 16 coverage samples per pixel. */
const SS = 4;
/** Outline thickness in pixels, drawn INSIDE the silhouette so it never clips. */
const OUTLINE = 2;

/**
 * Collects every polygon and circle in a body definition, whatever shape
 * the exporter wrote it in. The file deliberately carries four different
 * layouts, so this walks rather than assumes.
 * @param {unknown} node - a body definition, or any part of one
 * @param {{polys: {x: number, y: number}[][], circles: {x: number, y: number, r: number}[]}} out - accumulator
 */
const collect = (node, out) => {
	if (Array.isArray(node)) {
		for (const item of node) collect(item, out);
		return;
	}
	if (node === null || typeof node !== "object") return;

	// `shape`: a flat [x, y, x, y, ...] outline
	if (Array.isArray(node.shape) && typeof node.shape[0] === "number") {
		const pts = [];
		for (let i = 0; i + 1 < node.shape.length; i += 2) {
			pts.push({ x: node.shape[i], y: node.shape[i + 1] });
		}
		if (pts.length >= 3) out.polys.push(pts);
	}
	// `circle`: {x, y, radius}
	if (node.circle && typeof node.circle.radius === "number") {
		out.circles.push({
			x: node.circle.x,
			y: node.circle.y,
			r: node.circle.radius,
		});
	}
	// `vertices`: an array of outlines, each an array of {x, y}
	if (Array.isArray(node.vertices)) {
		for (const ring of node.vertices) {
			if (
				Array.isArray(ring) &&
				ring.length >= 3 &&
				typeof ring[0]?.x === "number"
			) {
				out.polys.push(ring.map((p) => ({ x: p.x, y: p.y })));
			}
		}
	}
	for (const [key, value] of Object.entries(node)) {
		if (key !== "shape" && key !== "circle" && key !== "vertices") {
			collect(value, out);
		}
	}
};

/**
 * @param {{x: number, y: number}[]} poly - outline to test against
 * @param {number} x - sample point
 * @param {number} y - sample point
 * @returns {boolean} true when the point is inside (even-odd rule)
 */
const inPoly = (poly, x, y) => {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i];
		const b = poly[j];
		if (
			a.y > y !== b.y > y &&
			x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
		) {
			inside = !inside;
		}
	}
	return inside;
};

/** @param {string} hex - "#rrggbb" @returns {[number, number, number]} rgb */
const rgb = (hex) => [
	Number.parseInt(hex.slice(1, 3), 16),
	Number.parseInt(hex.slice(3, 5), 16),
	Number.parseInt(hex.slice(5, 7), 16),
];

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const CRC_TABLE = (() => {
	const t = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c;
	}
	return t;
})();

/** @param {Buffer} buf - bytes to sum @returns {number} CRC-32 */
const crc32 = (buf) => {
	let c = -1;
	for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
};

/** @param {string} type - chunk name @param {Buffer} data - payload @returns {Buffer} a PNG chunk */
const chunk = (type, data) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
};

/**
 * @param {number} w - width
 * @param {number} h - height
 * @param {Buffer} rgba - w*h*4 bytes
 * @returns {Buffer} a complete PNG file
 */
const encodePng = (w, h, rgba) => {
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (w * 4 + 1)] = 0; // filter: none
		rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
};

const shapes = JSON.parse(readFileSync(join(ASSETS, "shapes.json"), "utf8"));

for (const [name, colour] of Object.entries(PALETTE)) {
	const parts = { polys: [], circles: [] };
	collect(shapes[name], parts);

	// The image spans the body's own local space starting at the origin, so
	// image pixel (x, y) IS local (x, y) and the example needs no offset.
	let maxX = 0;
	let maxY = 0;
	for (const poly of parts.polys) {
		for (const p of poly) {
			maxX = Math.max(maxX, p.x);
			maxY = Math.max(maxY, p.y);
		}
	}
	for (const c of parts.circles) {
		maxX = Math.max(maxX, c.x + c.r);
		maxY = Math.max(maxY, c.y + c.r);
	}
	const w = Math.ceil(maxX);
	const h = Math.ceil(maxY);

	// coverage, by union: a body is one silhouette, not a stack of parts,
	// so overlapping pieces must not darken where they meet
	const cov = new Float32Array(w * h);
	const step = 1 / SS;
	for (let py = 0; py < h; py++) {
		for (let px = 0; px < w; px++) {
			let hits = 0;
			for (let sy = 0; sy < SS; sy++) {
				for (let sx = 0; sx < SS; sx++) {
					const x = px + (sx + 0.5) * step;
					const y = py + (sy + 0.5) * step;
					let inside = false;
					for (const c of parts.circles) {
						if ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r) {
							inside = true;
							break;
						}
					}
					if (!inside) {
						for (const poly of parts.polys) {
							if (inPoly(poly, x, y)) {
								inside = true;
								break;
							}
						}
					}
					if (inside) hits++;
				}
			}
			cov[py * w + px] = hits / (SS * SS);
		}
	}

	// the outline is eroded INWARD, so it can never be clipped by the edge
	// of the image even where a shape runs flush to it (the crate does)
	const solid = (x, y) =>
		x >= 0 && y >= 0 && x < w && y < h && cov[y * w + x] > 0.5;
	const base = rgb(colour);
	const dark = mix(base, [0, 0, 0], 0.55);
	const light = mix(base, [255, 255, 255], 0.4);

	const rgba = Buffer.alloc(w * h * 4);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const a = cov[y * w + x];
			if (a <= 0) continue;
			let edge = false;
			for (let dy = -OUTLINE; dy <= OUTLINE && !edge; dy++) {
				for (let dx = -OUTLINE; dx <= OUTLINE; dx++) {
					if (
						dx * dx + dy * dy <= OUTLINE * OUTLINE &&
						!solid(x + dx, y + dy)
					) {
						edge = true;
						break;
					}
				}
			}
			// a soft vertical ramp so the flat fill reads as volume
			const colourAt = edge
				? dark
				: mix(light, base, Math.min(1, y / Math.max(1, h)));
			const i = (y * w + x) * 4;
			rgba[i] = colourAt[0];
			rgba[i + 1] = colourAt[1];
			rgba[i + 2] = colourAt[2];
			rgba[i + 3] = Math.round(a * 255);
		}
	}

	const png = encodePng(w, h, rgba);
	const file = join(ASSETS, `${name}.png`);
	writeFileSync(file, png);
	console.log(
		`${name.padEnd(6)} ${String(w).padStart(3)}x${String(h).padStart(3)}  ` +
			`${parts.polys.length} poly, ${parts.circles.length} circle  ` +
			`${String(png.length).padStart(5)} bytes  ` +
			`sha=${createHash("sha256").update(png).digest("hex").slice(0, 8)}`,
	);
}
