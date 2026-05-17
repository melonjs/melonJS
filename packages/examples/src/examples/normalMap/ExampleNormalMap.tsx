/**
 * melonJS — normal-map lit sprite demo example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { game, input, Light2d, Sprite, Stage, state, video } from "melonjs";
import { createExampleComponent } from "../utils";

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
	radial.addColorStop(0.85, tint.mid);
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
			imgData.data[i + 3] = 255;
		}
	}
	nctx.putImageData(imgData, 0, 0);

	return { colorCanvas, normalCanvas };
}

class PlayScreen extends Stage {
	onResetEvent() {
		const orbSize = 192;

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
		const yMid = game.viewport.height / 2;
		const xs = [
			game.viewport.width * 0.25,
			game.viewport.width * 0.5,
			game.viewport.width * 0.75,
		];
		for (let i = 0; i < xs.length; i++) {
			const { colorCanvas, normalCanvas } = generateOrb(orbSize, palette[i]);
			const orb = new Sprite(xs[i], yMid, {
				image: colorCanvas,
				framewidth: orbSize,
				frameheight: orbSize,
				normalMap: normalCanvas,
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			game.world.addChild(orb);
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
	}

	onDestroyEvent() {
		// release the pointer handler so re-entering the stage doesn't
		// accumulate listeners
		input.releasePointerEvent("pointermove", game.viewport);
	}
}

const createGame = () => {
	video.init(728, 410, {
		parent: "screen",
		scaleMethod: "flex",
		// Normal-map lighting needs the WebGL renderer's lit pipeline.
		// Under `video.AUTO`, a Canvas fallback would render the orbs
		// as flat sprites and emit a one-shot console warning.
		renderer: video.WEBGL,
	});

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleNormalMap = createExampleComponent(createGame);
