import {
	Color,
	ColorLayer,
	Container,
	game,
	Renderable,
	Stage,
	state,
	Text,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

/**
 * `Container` clipping demo over a `ColorLayer` backdrop.
 *
 * Left: three nested clipping containers form concentric color rings.
 * Right: a wrapper with a sinusoidal scale animates a clipping
 * container; the overflowing fill stays cropped to the scaled bounds.
 */

class OverflowingRect extends Renderable {
	private color = new Color();

	constructor(colorHex: string) {
		// bounds are intentionally larger than the host clipping
		// container so the rect bleeds out on every side.
		super(0, 0, 500, 280);
		this.anchorPoint.set(0, 0);
		this.color.parseCSS(colorHex);
	}

	draw(renderer: Parameters<Renderable["draw"]>[0]) {
		renderer.setColor(this.color);
		renderer.fillRect(0, 0, this.width, this.height);
		renderer.setColor("#ffffff");
		renderer.setLineWidth(3);
		renderer.strokeRect(0, 0, this.width, this.height);
	}
}

/** A `ColorLayer` that fills only a sub-region of the canvas. */
class PartialColorLayer extends ColorLayer {
	private rectX: number;
	private rectY: number;
	private rectW: number;
	private rectH: number;

	constructor(
		name: string,
		color: string,
		x: number,
		y: number,
		w: number,
		h: number,
		z?: number,
	) {
		super(name, color, z);
		this.rectX = x;
		this.rectY = y;
		this.rectW = w;
		this.rectH = h;
	}

	draw(
		renderer: Parameters<ColorLayer["draw"]>[0],
		_viewport: Parameters<ColorLayer["draw"]>[1],
	) {
		renderer.save();
		// `ColorLayer` inherits `Renderable(0, 0, Infinity, Infinity)`
		// with the default 0.5 anchor, so `Renderable.preDraw` has
		// translated by (-Infinity, -Infinity) by the time we get here.
		// Reset to identity so `clipRect` runs under a finite
		// transform on both Canvas and WebGL.
		renderer.resetTransform();
		renderer.clipRect(this.rectX, this.rectY, this.rectW, this.rectH);
		renderer.clearColor(this.color);
		renderer.restore();
	}
}

class ClipOutline extends Renderable {
	private color = new Color();

	constructor(x: number, y: number, w: number, h: number) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.color.parseCSS("#00ff88");
	}

	draw(renderer: Parameters<Renderable["draw"]>[0]) {
		renderer.setColor(this.color);
		renderer.setLineWidth(3);
		renderer.strokeRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

class PlayScreen extends Stage {
	onResetEvent() {
		// full-canvas backdrop + a partial colored band
		game.world.addChild(new ColorLayer("bg", "#0e1116"), 0);
		game.world.addChild(
			new PartialColorLayer("band", "#1f2a3a", 0, 100, 760, 140),
			1,
		);

		// LEFT — three concentric clipping containers, each with its
		// own overflowing fill. Each color is only visible in the ring
		// between its own clip and the next inner one.
		const A = new Container(40, 80, 180, 160);
		A.clipping = true;
		A.addChild(new OverflowingRect("#3498db")); // outer ring: blue

		const B = new Container(15, 15, 150, 130);
		B.clipping = true;
		B.addChild(new OverflowingRect("#2ecc71")); // middle ring: green

		const C = new Container(15, 15, 120, 100);
		C.clipping = true;
		C.addChild(new OverflowingRect("#f39c12")); // inner: orange

		B.addChild(C);
		A.addChild(B);
		game.world.addChild(A, 2);

		// outlines mark each clip level
		game.world.addChild(new ClipOutline(40, 80, 180, 160), 3);
		game.world.addChild(new ClipOutline(40 + 15, 80 + 15, 150, 130), 3);
		game.world.addChild(
			new ClipOutline(40 + 15 + 15, 80 + 15 + 15, 120, 100),
			3,
		);
		game.world.addChild(
			new Text(40, 60, {
				font: "monospace",
				size: 12,
				fillStyle: "#00ff88",
				text: "Triple-nested clipping",
			}),
			4,
		);

		// RIGHT — wrapper centered on its pos, with a clipping
		// container offset back to the top-left. The wrapper's
		// `currentTransform` gets a sinusoidal scale each frame, so
		// the inner clip pulses around the wrapper's center.
		const RIGHT_CENTER_X = 370;
		const RIGHT_CENTER_Y = 160;
		const RIGHT_W = 180;
		const RIGHT_H = 160;
		const wrapper = new Container(
			RIGHT_CENTER_X,
			RIGHT_CENTER_Y,
			RIGHT_W,
			RIGHT_H,
		);
		wrapper.clipping = false;
		const innerClip = new Container(
			-RIGHT_W / 2,
			-RIGHT_H / 2,
			RIGHT_W,
			RIGHT_H,
		);
		innerClip.clipping = true;
		innerClip.addChild(new OverflowingRect("#e74c3c"));
		wrapper.addChild(innerClip);

		// keep `update` ticking even when the scaled wrapper bounds
		// momentarily fall off-viewport.
		wrapper.alwaysUpdate = true;
		let t = 0;
		const baseUpdate = wrapper.update.bind(wrapper);
		wrapper.update = function (dt: number) {
			t += dt;
			this.currentTransform.identity();
			const s = 1 + 0.25 * Math.sin(t * 0.0025);
			this.currentTransform.scale(s, s);
			return baseUpdate(dt) || true;
		};
		game.world.addChild(wrapper, 2);
		game.world.addChild(
			new Text(280, 60, {
				font: "monospace",
				size: 12,
				fillStyle: "#00ff88",
				text: "Pulsing wrapper",
			}),
			4,
		);

		game.world.addChild(
			new Text(game.viewport.width / 2, game.viewport.height - 16, {
				font: "monospace",
				size: 11,
				fillStyle: "#cccccc",
				textAlign: "center",
				text: "Green outlines = static clip bounds. Lighter band = partial ColorLayer.",
			}),
			4,
		);
	}
}

const createGame = () => {
	video.init(760, 320, {
		parent: "screen",
		scaleMethod: "flex",
		renderer: video.AUTO,
	});

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleClipping = createExampleComponent(createGame);
