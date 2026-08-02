/**
 * melonJS — WebGPU hello world (experimental backend bootstrap) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Application, video, type WebGPURenderer } from "melonjs";
import { createExampleComponent } from "../utils";

export const ExampleWebGPU = createExampleComponent(async () => {
	// The experimental WebGPU backend performs its asynchronous bootstrap
	// (adapter/device negotiation) plus a real per-frame clear pass — text
	// rendering does not exist on it yet, so status goes in a DOM overlay.
	const status = document.createElement("div");
	status.style.cssText =
		"position:absolute;top:60px;left:24px;z-index:1000;color:#ffffff;" +
		"font:16px/1.6 monospace;white-space:pre;text-shadow:0 1px 2px #000;";
	status.textContent = "negotiating WebGPU adapter/device…";
	document.getElementById("screen")?.appendChild(status);

	try {
		const app = new Application(1218, 562, {
			parent: "screen",
			scale: "auto",
			// opt-in only — `video.AUTO` never selects the WebGPU backend
			renderer: video.WEBGPU,
			// the frame below is cleared to this color by a genuine WebGPU
			// render pass — the backend's one visible act so far
			backgroundColor: "#1d3a52",
		});
		// a WebGPU device cannot be acquired synchronously — this await is
		// what the Application constructor/init() split exists for
		await app.init();

		const renderer = app.renderer as WebGPURenderer;
		status.textContent = [
			"Hello WebGPU !",
			"",
			`renderer : ${renderer.type}`,
			`adapter  : ${renderer.GPURenderer ?? "(no adapter info)"}`,
			`format   : ${renderer.preferredFormat}`,
			"",
			"the canvas is cleared by a real WebGPU render pass —",
			"everything else is still under construction",
		].join("\n");
	} catch (err) {
		status.textContent =
			"WebGPU is not available in this browser:\n" +
			`${String(err)}\n\n` +
			"try a recent Chromium/Edge (or Safari/Firefox with WebGPU enabled)";
	}

	// teardown — remove the DOM overlay when navigating away
	return () => {
		status.remove();
	};
});
