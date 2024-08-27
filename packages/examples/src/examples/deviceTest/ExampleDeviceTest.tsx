import {
	type CanvasRenderer,
	ColorLayer,
	Renderable,
	Text,
	type WebGLRenderer,
	device,
	game,
	input,
	math,
	video,
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
		});
		this.anchorPoint.set(0, 0);
	}

	override update() {
		return true;
	}

	override draw(renderer: WebGLRenderer | CanvasRenderer) {
		// current device orientation ("portrait" or "landscape")
		const orientation = device.getScreenOrientation();

		// write down device information
		renderer.setColor("#ffffff");

		if (device.hasDeviceOrientation) {
			this.font.draw(
				renderer,
				"Touch to enable motion detection",
				10,
				game.viewport.height - 30,
			);
		} else {
			this.font.draw(
				renderer,
				"Motion detection not supported",
				10,
				game.viewport.height - 30,
			);
		}

		this.font.draw(renderer, `Gamma: ${device.gamma}`, 10, 0);
		this.font.draw(renderer, `Beta: ${device.beta}`, 10, 30);
		this.font.draw(renderer, `Alpha: ${device.alpha}`, 10, 60);
		this.font.draw(renderer, `X: ${device.accelerationX}`, 10, 90);
		this.font.draw(renderer, `Y: ${device.accelerationY}`, 10, 120);
		this.font.draw(renderer, `Z: ${device.accelerationZ}`, 10, 150);
		this.font.draw(renderer, `orientation: ${orientation}`, 10, 180);

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

const createGame = () => {
	if (!video.init(480, 320, { scaleMethod: "flex", renderer: video.CANVAS })) {
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
