import { game, input, Light2d, Sprite, Stage, state, video } from "melonjs";
import { createExampleComponent } from "../utils";

/**
 * Procedurally generate a sphere "orb" sprite paired with a normal map.
 * The color image is a soft radial gradient; the normal map encodes the
 * sphere's surface normals as RGB (the standard SpriteIlluminator
 * convention: R = X, G = Y (up), B = Z (out of screen), each shifted
 * from `[-1, 1]` into `[0, 255]`).
 */
function generateOrb(size: number) {
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
	radial.addColorStop(0, "#dddddd");
	radial.addColorStop(0.85, "#888888");
	radial.addColorStop(1, "rgba(40, 40, 40, 0)");
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
			imgData.data[i + 0] = Math.round((dx * 0.5 + 0.5) * 255);
			imgData.data[i + 1] = Math.round((dy * 0.5 + 0.5) * 255);
			imgData.data[i + 2] = Math.round(nz * 255);
			imgData.data[i + 3] = 255;
		}
	}
	nctx.putImageData(imgData, 0, 0);

	return { colorCanvas, normalCanvas };
}

class PlayScreen extends Stage {
	onResetEvent() {
		const orbSize = 192;
		const { colorCanvas, normalCanvas } = generateOrb(orbSize);

		// place three orbs side by side. Each one carries the same
		// normal-map — they'll all react to the same Light2d but at their
		// own positions, demonstrating that lit sprites batch together
		// through the augmented quad batcher.
		const yMid = game.viewport.height / 2;
		const positions = [
			game.viewport.width * 0.25,
			game.viewport.width * 0.5,
			game.viewport.width * 0.75,
		];
		for (const x of positions) {
			const orb = new Sprite(x, yMid, {
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
		// from `Stage._activeLights`.
		const cursor = new Light2d(
			game.viewport.width / 2,
			game.viewport.height / 2,
			260,
			260,
			"#ffffff",
			1.5,
		);
		game.world.addChild(cursor);

		input.registerPointerEvent("pointermove", game.viewport, (event) => {
			cursor.centerOn(event.gameX, event.gameY);
		});
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
