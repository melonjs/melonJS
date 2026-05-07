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
 * `Container` clipping demo / regression guard for #1349.
 *
 * Both scenes clip an overflowing rectangle to a 180×160 region marked
 * by a green outline. The two scenes set up the *same* clip in two
 * different ways:
 *
 * - **Left:** clipping `Container` added directly to the world. Parent
 *   transform at `clipRect` time is identity.
 * - **Right:** clipping `Container` nested inside a non-clipping wrapper
 *   with `pos = (280, 80)`. Parent transform at `clipRect` time has
 *   the wrapper's translate baked in.
 *
 * Both should clip identically. Pre-#1349, the right scene was offset
 * by exactly `(280, 80)` because `Container.draw` was passing
 * world-space `bounds.left/top` to a `clipRect` API that expected
 * coordinates *local to the current transform*, double-counting the
 * wrapper's translate. The fix moves `Container.draw`'s `translate`
 * before `clipRect` and passes local-frame `(0, 0, width, height)`,
 * letting the renderer's own transform stack handle all the math.
 */

class OverflowingRect extends Renderable {
	private color = new Color();

	constructor(colorHex: string) {
		// the renderable's own bounds are intentionally larger than its
		// host clipping container so the rect bleeds out on every side.
		// Drawn at LOCAL (0, 0) inside its parent — Container.draw
		// translates by the parent's pos before iterating children.
		super(0, 0, 500, 280);
		this.anchorPoint.set(0, 0);
		this.color.parseCSS(colorHex);
	}

	draw(renderer: Parameters<Renderable["draw"]>[0]) {
		// fill + a 3px white stroke on the renderable's *own* edge so the
		// natural rect boundary is visible. Anything outside the host
		// clipping container's bounds should be cropped — that's the
		// signal whether clipping is active.
		renderer.setColor(this.color);
		renderer.fillRect(0, 0, this.width, this.height);
		renderer.setColor("#ffffff");
		renderer.setLineWidth(3);
		renderer.strokeRect(0, 0, this.width, this.height);
	}
}

/**
 * A `ColorLayer` that fills only a sub-region of the canvas instead of
 * the whole viewport. Reuses `ColorLayer`'s `clipRect` + `clearColor`
 * approach but with a custom rect, so the example exercises both
 * "full canvas" (built-in `ColorLayer`) and "partial rect" forms of
 * the clip-and-clear pattern.
 */
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
		// Renderable doesn't auto-translate by its own pos (that happens
		// only inside autoTransform when a non-identity matrix is set),
		// so anchor the stroke at this.pos.x/y explicitly.
		renderer.setColor(this.color);
		renderer.setLineWidth(3);
		renderer.strokeRect(this.pos.x, this.pos.y, this.width, this.height);
	}
}

class PlayScreen extends Stage {
	onResetEvent() {
		// Layer 1 (z=0): full-canvas dark backdrop via the engine's
		// built-in `ColorLayer`. Internally calls
		// `clipRect(0, 0, viewport.w, viewport.h) + clearColor(...)` —
		// the canvas-sized clipRect input hits the renderer's
		// "full-canvas = no clip" fast path, so the entire framebuffer
		// gets cleared to this color regardless of any prior scissor
		// state.
		game.world.addChild(new ColorLayer("bg", "#0e1116"), 0);

		// Layer 2 (z=1): a partial colored band rendered via the same
		// `clipRect + clearColor` mechanism, but with a sub-rect input.
		// Anything previously drawn inside the band is replaced; the
		// dark backdrop outside the band stays untouched. This proves
		// `clearColor` honors the active scissor and that the partial-
		// rect path produces the right screen region.
		game.world.addChild(
			new PartialColorLayer("band", "#1f2a3a", 0, 100, 760, 140),
			1,
		);

		// LEFT scene — clipping container directly under the world.
		// Position chosen so it doesn't overlap the right scene's expected
		// or buggy region.
		const leftClip = new Container(40, 80, 180, 160);
		leftClip.clipping = true;
		leftClip.addChild(new OverflowingRect("#3498db"));
		game.world.addChild(leftClip, 2);
		game.world.addChild(new ClipOutline(40, 80, 180, 160), 3);
		game.world.addChild(
			new Text(40, 60, {
				font: "monospace",
				size: 12,
				fillStyle: "#00ff88",
				text: "Direct child of world",
			}),
			4,
		);

		// RIGHT scene — clipping container nested inside a translated
		// wrapper (the regression-prone path for #1349). Should clip
		// identically to the LEFT scene; pre-fix it was offset by
		// `wrapper.pos`.
		const wrapper = new Container(280, 80, 180, 160);
		wrapper.clipping = false;
		const innerClip = new Container(0, 0, 180, 160);
		innerClip.clipping = true;
		innerClip.addChild(new OverflowingRect("#e74c3c"));
		wrapper.addChild(innerClip);
		game.world.addChild(wrapper, 2);
		// expected clip outline (green) — at the inner clip's world rect:
		// wrapper.pos + innerClip.pos = (280, 80) + (0, 0) = (280, 80).
		game.world.addChild(new ClipOutline(280, 80, 180, 160), 3);
		game.world.addChild(
			new Text(280, 60, {
				font: "monospace",
				size: 12,
				fillStyle: "#00ff88",
				text: "Inside translated wrapper (#1349 regression)",
			}),
			4,
		);

		game.world.addChild(
			new Text(game.viewport.width / 2, game.viewport.height - 16, {
				font: "monospace",
				size: 11,
				fillStyle: "#cccccc",
				textAlign: "center",
				text: "Green outline = expected clip rect. Lighter band = partial ColorLayer.",
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
