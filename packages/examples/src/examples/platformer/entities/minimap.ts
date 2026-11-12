/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Camera2d, event, game, level, VignetteEffect } from "melonjs";

// the minimap's width as a share of the canvas width, so it scales with the
// display and leaves room for the buttons on a narrow (portrait) screen
const MINIMAP_SCALE = 0.18;
// height / width
const MINIMAP_ASPECT = 100 / 180;
const MARGIN = 10;

/**
 * A minimap camera that shows a zoomed-out view of the entire level
 * in the top-right corner of the screen.
 */
export class MinimapCamera extends Camera2d {
	private boundOnResize: (w: number) => void;
	private levelWidth = 0;
	private levelHeight = 0;

	constructor() {
		super(0, 0, 1, 1);
		this.name = "minimap";

		// the canvas resize must not reset this camera: it sizes itself below
		this.autoResize = false;

		const currentLevel = level.getCurrentLevel();
		if (currentLevel) {
			this.levelWidth = currentLevel.cols * currentLevel.tilewidth;
			this.levelHeight = currentLevel.rows * currentLevel.tileheight;
			this.setBounds(0, 0, this.levelWidth, this.levelHeight);
		}

		// size to the canvas now, and again whenever it is resized (a window
		// resize or an orientation change)
		this.fit(game.viewport.width);
		this.boundOnResize = (w: number) => {
			this.fit(w);
		};
		event.on(event.CANVAS_ONRESIZE, this.boundOnResize);

		// apply subtle vignette post-process effect on the minimap
		this.addPostEffect(new VignetteEffect(game.renderer));
	}

	/**
	 * Size the minimap to its share of the canvas width, in the top-right
	 * corner, zoomed to show the whole level.
	 * @param canvasWidth - the canvas width, in pixels
	 */
	private fit(canvasWidth: number) {
		const w = Math.round(canvasWidth * MINIMAP_SCALE);
		const h = Math.round(w * MINIMAP_ASPECT);
		this.setViewport(canvasWidth - w - MARGIN, MARGIN, w, h);
		if (this.levelWidth > 0 && this.levelHeight > 0) {
			this.zoom = Math.min(w / this.levelWidth, h / this.levelHeight);
		}
	}

	/**
	 * Draw minimap overlays: viewport highlight, player marker, and border.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: renderer type varies between WebGL/Canvas
	override postDraw(renderer: any): void {
		const viewport = game.viewport;
		const screenPx = 1 / this.zoom; // 1 screen pixel in world units
		const savedLineWidth = renderer.lineWidth;

		// main camera's visible area in world space
		const view = viewport.worldView;
		renderer.setGlobalAlpha(0.9);
		renderer.setColor("#ffffff");
		renderer.lineWidth = 1.5 * screenPx;
		renderer.strokeRect(view.left, view.top, view.width, view.height);

		// player position marker
		const players = game.world.getChildByProp("name", "mainPlayer");
		if (players.length > 0) {
			const player = players[0];
			const markerSize = 4 * screenPx;
			renderer.setGlobalAlpha(1.0);
			renderer.setColor("#00ff00");
			renderer.fillEllipse(
				player.pos.x + player.width / 2,
				player.pos.y + player.height / 2,
				markerSize,
				markerSize,
			);
		}

		// minimap border
		renderer.setGlobalAlpha(0.8);
		renderer.setColor("#ffffff");
		renderer.lineWidth = 2 * screenPx;
		renderer.strokeRect(0, 0, this.width / this.zoom, this.height / this.zoom);

		// restore lineWidth
		renderer.lineWidth = savedLineWidth;

		// restore the camera context
		super.postDraw(renderer);
	}

	/**
	 * Cleanup event listeners.
	 */
	override destroy(): void {
		event.off(event.CANVAS_ONRESIZE, this.boundOnResize);
		super.destroy();
	}
}
