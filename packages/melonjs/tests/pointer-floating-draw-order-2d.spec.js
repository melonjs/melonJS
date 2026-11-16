import { Camera2d, video } from "../src/index.js";
import { describeFloatingDrawOrder } from "./helpers/floating-draw-order.js";

// under a Camera2d the world sorts on z: the HIGHER z draws on top
describeFloatingDrawOrder({
	name: "Camera2d",
	cameraClass: Camera2d,
	renderer: video.CANVAS,
	top: (a, b) => {
		return a > b;
	},
});
