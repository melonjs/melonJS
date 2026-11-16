import { Camera3d, video } from "../src/index.js";
import { describeFloatingDrawOrder } from "./helpers/floating-draw-order.js";

// under a Camera3d the world sorts on "depth": the SMALLER depth draws on top
describeFloatingDrawOrder({
	name: "Camera3d",
	cameraClass: Camera3d,
	renderer: video.WEBGL,
	top: (a, b) => {
		return a < b;
	},
});
