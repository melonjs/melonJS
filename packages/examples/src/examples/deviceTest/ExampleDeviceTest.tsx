/**
 * melonJS — device + capability detection report example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	type CanvasRenderer,
	ColorLayer,
	device,
	game,
	input,
	math,
	Renderable,
	Text,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

class DeviceInfo extends Renderable {
	font: Text;

	constructor() {
		super(0, 0, 100, 200);
		this.font = new Text(0, 0, {
			font: "Arial",
			size: "24px",
			fillStyle: "#FFFFFF",
			// so a line's `y` is the top of its box: without this the first
			// readout at y = 0 sits mostly above the canvas and never shows
			textBaseline: "top",
		});
		this.anchorPoint.set(0, 0);
	}

	override update() {
		return true;
	}

	/**
	 * Draw one readout line.
	 *
	 * `Text` is a renderable, not the old `Font` blitter: `draw()` takes the
	 * renderer and nothing else, and the label goes where its `pos` says. The
	 * former `font.draw(renderer, text, x, y)` shape silently dropped the last
	 * three arguments, so every call here drew the same empty label at (0, 0)
	 * and the example rendered no text at all.
	 */
	private line(
		renderer: WebGLRenderer | CanvasRenderer,
		text: string,
		x: number,
		y: number,
	) {
		// per component: `pos.set(x, y)` is the 2-argument form and zeroes z,
		// which is `depth`
		this.font.pos.x = x;
		this.font.pos.y = y;
		this.font.setText(text);
		this.font.draw(renderer);
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		// current device orientation ("portrait" or "landscape")
		const orientation = device.getScreenOrientation();

		// write down device information
		renderer.setColor("#ffffff");

		if (device.hasDeviceOrientation) {
			this.line(
				renderer,
				"Touch to enable motion detection",
				10,
				game.viewport.height - 40,
			);
		} else {
			this.line(
				renderer,
				"Motion detection not supported",
				10,
				game.viewport.height - 40,
			);
		}

		this.line(renderer, `Gamma: ${device.gamma}`, 10, 30);
		this.line(renderer, `Beta: ${device.beta}`, 10, 60);
		this.line(renderer, `Alpha: ${device.alpha}`, 10, 90);
		this.line(renderer, `X: ${device.accelerationX}`, 10, 120);
		this.line(renderer, `Y: ${device.accelerationY}`, 10, 150);
		this.line(renderer, `Z: ${device.accelerationZ}`, 10, 180);
		this.line(renderer, `orientation: ${orientation}`, 10, 210);

		// draw a red circle based on the device motion and orientation
		const deltaX =
			(orientation === "portrait" ? device.gamma : device.beta) * 10;
		const deltaY =
			(orientation === "portrait" ? device.beta : device.gamma) * 10;
		const originX = math.clamp(
			game.viewport.width / 2 + deltaX,
			0,
			game.viewport.width,
		);
		const originY = math.clamp(
			game.viewport.height / 2 + deltaY,
			0,
			game.viewport.height,
		);

		renderer.setColor("#ff000080");
		renderer.fillEllipse(originX, originY, 30, 30);
	}
}

const createGame = async () => {
	try {
		const app = new Application(480, 320, {
			// see ExampleBenchmark — without `parent: "screen"` the
			// engine falls back to `document.body`, whose dev-mode
			// transient height collapses and shrinks the Flex-scaled
			// canvas down to a horizontal banner.
			parent: "screen",
			scaleMethod: "flex",
			renderer: video.AUTO,
		});
		await app.init();
	} catch {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// enable deviceorientation
	input.registerPointerEvent("pointerleave", game.viewport, () => {
		if (device.watchDeviceOrientation() || device.watchAccelerometer()) {
			input.releasePointerEvent("pointerleave", game.viewport);
		}
	});

	// reset/empty the game world
	game.world.reset();

	// clear the background
	game.world.addChild(new ColorLayer("background", "#000000"), 0);

	// renderable to display device information
	game.world.addChild(new DeviceInfo(), 1);
};

export const ExampleDeviceTest = createExampleComponent(createGame);
