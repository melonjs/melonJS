import { Camera2d, event, game, level } from "melonjs";

const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 100;

/**
 * A minimap camera that shows a zoomed-out view of the entire level
 * in the top-right corner of the screen.
 */
export class MinimapCamera extends Camera2d {
	private boundOnResize: (w: number) => void;

	constructor() {
		super(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);
		this.name = "minimap";
		this.screenX = game.viewport.width - MINIMAP_WIDTH - 10;
		this.screenY = 10;

		// prevent canvas resize from resetting this camera's dimensions/bounds
		this.autoResize = false;

		// reposition on canvas resize (keep anchored to top-right)
		this.boundOnResize = (w: number) => {
			this.screenX = w - MINIMAP_WIDTH - 10;
		};
		event.on(event.CANVAS_ONRESIZE, this.boundOnResize);

		const currentLevel = level.getCurrentLevel();
		if (currentLevel) {
			const lw = currentLevel.cols * currentLevel.tilewidth;
			const lh = currentLevel.rows * currentLevel.tileheight;
			this.setBounds(0, 0, lw, lh);
			this.zoom = Math.min(MINIMAP_WIDTH / lw, MINIMAP_HEIGHT / lh);
		}
	}

	/**
	 * Draw minimap overlays: viewport highlight, player marker, and border.
	 */
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
		renderer.strokeRect(
			0,
			0,
			MINIMAP_WIDTH / this.zoom,
			MINIMAP_HEIGHT / this.zoom,
		);

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
