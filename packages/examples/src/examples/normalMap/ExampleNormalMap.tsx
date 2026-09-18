/**
 * melonJS — normal-map lit sprite demo example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	game,
	input,
	Light2d,
	Renderable,
	Sprite,
	Stage,
	state,
	Text,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

/**
 * Procedurally generate a plastered stone wall: a colour image plus the
 * matching normal map.
 *
 * The orbs alone leave a fair question unanswered — what does this lighting do
 * with geometry that is not a ball? A wall's normals mostly face the screen, so
 * its highlight is a broad soft pool rather than a point, and the pools are
 * what make the two moving lights legible: you see where they ARE, instead of
 * inferring it from a glint.
 *
 * The normal is derived from a height field by central differences, the same
 * way a baking tool would do it: mortar courses cut grooves, each block gets a
 * slight dome, and a little value noise roughens the surface. The alpha channel
 * carries the specular mask — mortar is matte, stone faces take a low sheen.
 * @param {number} w - wall width in pixels
 * @param {number} h - wall height in pixels
 * @returns {object} the colour and normal canvases
 */
function generateWall(w: number, h: number) {
	const BLOCK_W = 96;
	const BLOCK_H = 44;
	const MORTAR = 5;

	// deterministic value noise — no Math.random, so the wall is identical
	// on every run and screenshots stay comparable
	const hash = (x: number, y: number) => {
		let n = (x * 374761393 + y * 668265263) >>> 0;
		n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
		return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
	};
	const smooth = (t: number) => t * t * (3 - 2 * t);
	const noise = (x: number, y: number, period: number) => {
		const xi = Math.floor(x / period);
		const yi = Math.floor(y / period);
		const xf = smooth(x / period - xi);
		const yf = smooth(y / period - yi);
		const a = hash(xi, yi);
		const b = hash(xi + 1, yi);
		const c = hash(xi, yi + 1);
		const d = hash(xi + 1, yi + 1);
		return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
	};

	// which course a row belongs to, and the half-block stagger on odd ones
	const blockAt = (x: number, y: number) => {
		const row = Math.floor(y / BLOCK_H);
		const shift = (row & 1) === 1 ? BLOCK_W / 2 : 0;
		const localX = (x + shift) % BLOCK_W;
		const localY = y - row * BLOCK_H;
		return { row, localX, localY };
	};

	// the surface: 0 in the mortar, domed across each block face
	const height = (x: number, y: number) => {
		const { row, localX, localY } = blockAt(x, y);
		const inMortar =
			localX < MORTAR ||
			localX > BLOCK_W - MORTAR ||
			localY < MORTAR ||
			localY > BLOCK_H - MORTAR;
		if (inMortar) {
			return 0.08 * noise(x, y, 5);
		}
		const u = (localX - MORTAR) / (BLOCK_W - MORTAR * 2);
		const v = (localY - MORTAR) / (BLOCK_H - MORTAR * 2);
		const dome = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
		return (
			0.55 +
			0.3 * dome +
			0.1 * noise(x + row * 37, y, 9) +
			0.05 * noise(x, y, 3)
		);
	};

	const colorCanvas = document.createElement("canvas");
	colorCanvas.width = w;
	colorCanvas.height = h;
	const cctx = colorCanvas.getContext("2d") as CanvasRenderingContext2D;
	const cimg = cctx.createImageData(w, h);

	const normalCanvas = document.createElement("canvas");
	normalCanvas.width = w;
	normalCanvas.height = h;
	const nctx = normalCanvas.getContext("2d") as CanvasRenderingContext2D;
	const nimg = nctx.createImageData(w, h);

	const STRENGTH = 2.6;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			const { localX, localY } = blockAt(x, y);
			const inMortar =
				localX < MORTAR ||
				localX > BLOCK_W - MORTAR ||
				localY < MORTAR ||
				localY > BLOCK_H - MORTAR;

			// colour: cool grey stone, darker mortar, a little per-block
			// variation so the courses do not read as a printed pattern
			const tone = inMortar
				? 0.34 + 0.06 * noise(x, y, 4)
				: 0.62 + 0.14 * noise(x * 0.7, y * 0.7, 26) + 0.05 * noise(x, y, 3);
			cimg.data[i + 0] = Math.round(255 * tone * 0.86);
			cimg.data[i + 1] = Math.round(255 * tone * 0.88);
			cimg.data[i + 2] = Math.round(255 * tone);
			cimg.data[i + 3] = 255;

			// normal from the height field, by central differences
			const l = height((x - 1 + w) % w, y);
			const r = height((x + 1) % w, y);
			const d = height(x, (y - 1 + h) % h);
			const u2 = height(x, (y + 1) % h);
			let nx = (l - r) * STRENGTH;
			// (u2 - d), not (d - u2): image Y grows downward while a normal map
			// encodes Y UP, so the two flip. Get it backwards and the relief
			// reads inside-out — mortar courses become ridges, block faces
			// become hollows, and a light overhead lights the wrong edge of
			// every stone. `generateOrb` gets there by negating dy instead.
			let ny = (u2 - d) * STRENGTH;
			let nz = 1;
			const inv = 1 / Math.hypot(nx, ny, nz);
			nx *= inv;
			ny *= inv;
			nz *= inv;
			nimg.data[i + 0] = Math.round((nx * 0.5 + 0.5) * 255);
			nimg.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
			nimg.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
			// specular mask: mortar is dead matte, stone takes a low sheen
			nimg.data[i + 3] = inMortar ? 10 : Math.round(90 + 60 * noise(x, y, 17));
		}
	}
	cctx.putImageData(cimg, 0, 0);
	nctx.putImageData(nimg, 0, 0);
	return { colorCanvas, normalCanvas };
}

/**
 * Procedurally generate a sphere "orb" sprite paired with a normal map.
 * The color image is a soft radial gradient; the normal map encodes the
 * sphere's surface normals as RGB (R = X, G = Y up, B = Z out of screen),
 * each component shifted from `[-1, 1]` into `[0, 255]`.
 */
function generateOrb(
	size: number,
	tint: { inner: string; mid: string; edge: string } = {
		inner: "#dddddd",
		mid: "#888888",
		edge: "rgba(40, 40, 40, 0)",
	},
	// Write worn patches into the normal map's ALPHA channel. The engine
	// reads that channel as the per-texel SPECULAR MASK, so the scuffs stop
	// reflecting while their diffuse shading stays perfectly smooth — one
	// sprite, shiny in places and matte in others. Nothing else consumes a
	// normal map's alpha (the sprite's own transparency comes from its
	// colour texture), and normal maps upload with premultiply off, so the
	// channel arrives intact.
	scuffed = false,
) {
	const colorCanvas = document.createElement("canvas");
	colorCanvas.width = size;
	colorCanvas.height = size;
	const cctx = colorCanvas.getContext("2d") as CanvasRenderingContext2D;
	const radial = cctx.createRadialGradient(
		size / 2,
		size / 2,
		0,
		size / 2,
		size / 2,
		size / 2,
	);
	radial.addColorStop(0, tint.inner);
	radial.addColorStop(0.955, tint.mid);
	radial.addColorStop(1, tint.edge);
	cctx.fillStyle = radial;
	cctx.fillRect(0, 0, size, size);

	const normalCanvas = document.createElement("canvas");
	normalCanvas.width = size;
	normalCanvas.height = size;
	const nctx = normalCanvas.getContext("2d") as CanvasRenderingContext2D;
	const imgData = nctx.createImageData(size, size);
	const radius = size / 2;
	const cx = size / 2;
	const cy = size / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = (x - cx) / radius;
			// flip screen-Y (down) to normal-map Y (up)
			const dy = -(y - cy) / radius;
			const i = (y * size + x) * 4;
			const len = Math.sqrt(dx * dx + dy * dy);
			if (len >= 1) {
				// outside the orb: leave fully transparent so the cutout
				// doesn't sample arbitrary normals
				imgData.data[i + 0] = 128;
				imgData.data[i + 1] = 128;
				imgData.data[i + 2] = 255;
				imgData.data[i + 3] = 0;
				continue;
			}
			const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
			// Encode each component as `(c + 1) / 2` so the shader's
			// `rgb * 2 - 1` decode round-trips correctly. (Encoding Z
			// as raw `nz * 255` would make the shader read 2*nz - 1,
			// pulling the edges' Z all the way to -1 and turning them
			// into "back-facing" surfaces.)
			imgData.data[i + 0] = Math.round((dx * 0.5 + 0.5) * 255);
			imgData.data[i + 1] = Math.round((dy * 0.5 + 0.5) * 255);
			imgData.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
			// 255 = fully reflective. The band pattern below rubs that down
			// without touching the RGB, so the surface still curves the light
			// the same way — it just stops shining there.
			let gloss = 255;
			if (scuffed) {
				// One half polished, the other rubbed matte, with a soft
				// boundary. Deliberately large and simple: the mask can only
				// show where the highlight actually falls, so a few small
				// patches would be visible for a fraction of the light's
				// orbit and read as noise. Half and half means you always see
				// it — the highlight crosses the seam and dies.
				const t = Math.max(0, Math.min(1, (dx + dy) * 1.6 + 0.5));
				const eased = t * t * (3 - 2 * t);
				gloss = Math.round(20 + eased * 235);
			}
			imgData.data[i + 3] = gloss;
		}
	}
	nctx.putImageData(imgData, 0, 0);

	return { colorCanvas, normalCanvas };
}

class PlayScreen extends Stage {
	onResetEvent() {
		// The orb's WORLD size, and the resolution its texture is generated
		// at. The canvas is 728 wide but displays around 1280, so everything
		// is upscaled ~1.8x — baking the orb at 2x and drawing it back down
		// keeps the silhouette crisp instead of magnifying 192 source pixels.
		const orbSize = 192;
		const ORB_SUPERSAMPLE = 2;

		// Three orbs with different base colors. Each generation creates
		// its own color canvas (per-orb tint) but they all share the same
		// normal map (per-orb shape encoding) — demonstrating that the
		// normal-map controls *shape* / *shading direction*, while the
		// color texture controls the orb's base hue. The lit shader
		// multiplies them together: `baseColor * (ambient + light × NdotL)`.
		const palette = [
			{
				inner: "#ff7070",
				mid: "#aa3030",
				edge: "rgba(60, 0, 0, 0)",
			},
			{
				inner: "#70ff70",
				mid: "#30aa30",
				edge: "rgba(0, 60, 0, 0)",
			},
			{
				inner: "#7090ff",
				mid: "#3050aa",
				edge: "rgba(0, 10, 60, 0)",
			},
		];
		// The wall goes in FIRST so it sits behind the orbs. It is a lit
		// sprite like any other — same `normalMap` setting, same two lights —
		// which is the point: nothing about this lighting is specific to the
		// orbs. Its `shininess` is low, because plaster is not polished; the
		// mortar is masked out entirely by the normal map's alpha.
		const wall = generateWall(game.viewport.width, game.viewport.height);
		const backdrop = new Sprite(
			game.viewport.width / 2,
			game.viewport.height / 2,
			{
				image: wall.colorCanvas,
				normalMap: wall.normalCanvas,
				shininess: 12,
				anchorPoint: { x: 0.5, y: 0.5 },
			},
		);
		game.world.addChild(backdrop);

		const yMid = game.viewport.height / 2;
		const xs = [
			game.viewport.width * 0.25,
			game.viewport.width * 0.5,
			game.viewport.width * 0.75,
		];
		// The normal map gives every orb its SHAPE — brightness following the
		// surface angle — and `shininess` decides how it SHINES. Three points
		// on the exponent's range: a broad wash, a polished sheen, a pinpoint
		// glint. Watch them as the light orbits — each highlight slides across
		// its surface, because it only appears where a texel happens to
		// reflect the light back at the screen, and the tighter the exponent
		// the further it travels for the same movement. That is what separates
		// specular from plain diffuse, which merely brightens and dims.
		// `shininess` defaults to 0 (matte), so a sprite that never sets it is
		// unaffected.
		const shininess = [16, 64, 200];
		const labels = ["broad wash", "polished, scuffed", "mirror glint"];
		for (let i = 0; i < xs.length; i++) {
			const texSize = orbSize * ORB_SUPERSAMPLE;
			const { colorCanvas, normalCanvas } = generateOrb(
				texSize,
				palette[i],
				i === 1,
			);
			const orb = new Sprite(xs[i], yMid, {
				image: colorCanvas,
				framewidth: texSize,
				frameheight: texSize,
				normalMap: normalCanvas,
				shininess: shininess[i],
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			// drawn back down to the world size — the extra pixels buy edge
			// quality, not a bigger orb
			orb.scale(1 / ORB_SUPERSAMPLE);
			game.world.addChild(orb);

			const caption = new Text(xs[i], yMid + orbSize * 0.62, {
				font: "Arial",
				size: "15px",
				fillStyle: "#e8e8f0",
				textAlign: "center",
				text: `${labels[i]}\nshininess: ${shininess[i]}`,
			});
			caption.setOpacity(0.85);
			game.world.addChild(caption);
		}

		// ambient floor — without it the unlit hemispheres of each orb
		// would be pure black.
		this.ambientLightingColor.setColor(60, 60, 70);

		// single moving light. Same `Light2d` API as the Lights example —
		// the lit sprite pipeline samples its position/color/intensity
		// from `Stage._activeLights`. `illuminationOnly = true` skips the
		// light's own gradient texture so only its effect on the
		// normal-mapped orbs is visible — a logical light source, not a
		// glowing spot.
		// Radius generous enough to reach all three orbs from any cursor
		// position in the 728×410 viewport (worst case ~ √(width² + height²)).
		const cursor = new Light2d(
			game.viewport.width / 2,
			game.viewport.height / 2,
			900,
			900,
			"#ffffff",
			1.5,
		);
		cursor.illuminationOnly = true;
		game.world.addChild(cursor);

		input.registerPointerEvent("pointermove", game.viewport, (event) => {
			cursor.centerOn(event.gameX, event.gameY);
		});

		// A second light, warm and on its own orbit. Specular accumulates PER
		// LIGHT and takes each light's own colour, so every orb carries two
		// highlights at once — one white, one amber — sliding independently as
		// the two sources move. It is also what keeps the scene alive before
		// the pointer is touched.
		const lamp = new Light2d(
			game.viewport.width / 2,
			game.viewport.height / 2,
			620,
			620,
			"#ffb266",
			1.2,
		);
		lamp.illuminationOnly = true;
		game.world.addChild(lamp);

		// A renderable that draws nothing and only advances the lamp — the
		// same shape the 3D examples use for their turntables.
		class LampOrbit extends Renderable {
			elapsed = 0;

			constructor() {
				super(0, 0, 1, 1);
				this.alwaysUpdate = true;
			}

			override update(dt: number) {
				this.elapsed += dt;
				const t = this.elapsed * 0.0009;
				lamp.centerOn(
					game.viewport.width / 2 + Math.cos(t) * game.viewport.width * 0.36,
					game.viewport.height / 2 +
						Math.sin(t * 1.3) * game.viewport.height * 0.3,
				);
				return true;
			}
		}
		game.world.addChild(new LampOrbit());
	}

	onDestroyEvent() {
		// release the pointer handler so re-entering the stage doesn't
		// accumulate listeners
		input.releasePointerEvent("pointermove", game.viewport);
	}
}

const createGame = async () => {
	const app = new Application(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		// Normal-map lighting needs the WebGL renderer's lit pipeline.
		// Under `video.AUTO`, a Canvas fallback would render the orbs
		// as flat sprites and emit a one-shot console warning.
		renderer: video.AUTO,
	});
	await app.init();

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleNormalMap = createExampleComponent(createGame);
