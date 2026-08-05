/**
 * melonJS — WebGPU hello world (experimental backend) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	ColorLayer,
	Container,
	Ellipse,
	Renderable,
	type Renderer,
	Sprite,
	Stage,
	state,
	Text,
	video,
	type WebGPURenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

// procedural sprite source — keeps the example asset-free: a melon-ish
// disc drawn once into a canvas, consumed by the engine like any image
const makeMelonCanvas = () => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 128;
	const ctx = canvas.getContext("2d")!;
	const g = ctx.createRadialGradient(48, 48, 10, 64, 64, 64);
	g.addColorStop(0, "#b6e35f");
	g.addColorStop(0.75, "#57a33d");
	g.addColorStop(1, "#2c5e2e");
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(64, 64, 60, 0, Math.PI * 2);
	ctx.fill();
	// watermelon rind stripes — WITHOUT them the melon is a featureless
	// radial gradient and the spin reads as pointless shimmer instead of
	// rotation
	ctx.save();
	ctx.beginPath();
	ctx.arc(64, 64, 60, 0, Math.PI * 2);
	ctx.clip();
	ctx.strokeStyle = "rgba(29, 58, 32, 0.55)";
	ctx.lineWidth = 9;
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(64, 64);
		// wavy rind stripe from the center out
		ctx.quadraticCurveTo(
			64 + Math.cos(angle + 0.35) * 34,
			64 + Math.sin(angle + 0.35) * 34,
			64 + Math.cos(angle) * 62,
			64 + Math.sin(angle) * 62,
		);
		ctx.stroke();
	}
	ctx.restore();
	ctx.strokeStyle = "#1d3a20";
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.arc(64, 64, 60, 0, Math.PI * 2);
	ctx.stroke();
	return canvas;
};

class SpinningSprite extends Sprite {
	override update(dt: number): boolean {
		this.rotate(dt * 0.001);
		return super.update(dt) || true;
	}
}

// the primitive pipeline: filled/stroked shapes, thick and dashed lines,
// and a raw Path2D — all through the WebGPU primitive batcher
class ShapesDemo extends Renderable {
	constructor() {
		super(0, 0, 1024, 576);
		this.anchorPoint.set(0, 0);
	}

	override draw(renderer: Renderer): void {
		renderer.setColor("#f2b234");
		renderer.fillEllipse(140, 460, 46, 46);

		renderer.setColor("#e2574c");
		renderer.fillRoundRect(230, 415, 110, 90, 18);

		renderer.setColor("#7ad1e8");
		renderer.lineWidth = 8;
		renderer.strokeRect(390, 420, 100, 80);

		renderer.setColor("#c58bdd");
		renderer.lineWidth = 5;
		renderer.strokeLine(540, 500, 660, 420);

		// a bufferless path: triangle through the Path2D API
		renderer.setColor("#9fe88a");
		renderer.lineWidth = 1;
		renderer.beginPath();
		renderer.moveTo(720, 500);
		renderer.lineTo(780, 420);
		renderer.lineTo(840, 500);
		renderer.closePath();
		renderer.fill();
	}
}

class PlayScreen extends Stage {
	override onResetEvent(app: Application) {
		// ColorLayer exercises the mid-frame scissored clear path
		app.world.addChild(new ColorLayer("background", "#1d3a52"), 0);

		// Text is canvas-baked and drawn through the quad pipeline
		app.world.addChild(
			new Text(app.renderer.width / 2, 90, {
				font: "Arial",
				size: 80,
				fillStyle: "#ffffff",
				textBaseline: "middle",
				textAlign: "center",
				text: "Hello WebGPU !",
			}),
			3,
		);

		const melonImage = makeMelonCanvas() as unknown as HTMLImageElement;

		// blend modes are pipeline variants: normal / additive / multiply
		for (const [i, blend] of ["normal", "additive", "multiply"].entries()) {
			const melon = new SpinningSprite(280 + i * 100, 220, {
				image: melonImage,
			});
			melon.blendMode = blend;
			app.world.addChild(melon, 1);
		}

		// a stencil-masked sprite — only the ellipse window is visible
		// (mask coordinates are local to the renderable)
		const masked = new SpinningSprite(650, 220, { image: melonImage });
		masked.mask = new Ellipse(0, 0, 110, 64);
		app.world.addChild(masked, 1);

		// a clipped container: the child sticks out and gets scissored
		const clipped = new Container(760, 170, 140, 100);
		clipped.clipping = true;
		clipped.backgroundColor.parseCSS("#27506e");
		clipped.addChild(
			new SpinningSprite(120, 80, { image: melonImage }) as never,
			1,
		);
		app.world.addChild(clipped, 2);

		app.world.addChild(new ShapesDemo(), 2);
	}
}

export const ExampleWebGPU = createExampleComponent(async () => {
	// status overlay — adapter/device details are DOM-side on purpose
	const status = document.createElement("div");
	status.style.cssText =
		"position:absolute;bottom:16px;left:24px;z-index:1000;color:#9fc3e8;" +
		"font:13px/1.6 monospace;white-space:pre;text-shadow:0 1px 2px #000;";
	status.textContent = "negotiating WebGPU adapter/device…";
	document.getElementById("screen")?.appendChild(status);

	try {
		const app = new Application(1024, 576, {
			parent: "screen",
			scale: "auto",
			// opt-in only — `video.AUTO` never selects the WebGPU backend
			renderer: video.AUTO,
			backgroundColor: "#10212f",
		});
		// a WebGPU device cannot be acquired synchronously — this await is
		// what the Application constructor/init() split exists for
		await app.init();

		const renderer = app.renderer as WebGPURenderer;
		status.textContent =
			`renderer: ${renderer.type}  |  ` +
			`adapter: ${renderer.GPURenderer ?? "(no adapter info)"}  |  ` +
			`format: ${renderer.preferredFormat}`;

		state.set(state.PLAY, new PlayScreen());
		state.change(state.PLAY, true);
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
