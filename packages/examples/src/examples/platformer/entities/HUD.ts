/**
 * melonJS — Platformer (built-in SAT physics) example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	audio,
	BitmapText,
	Container,
	device,
	event,
	game,
	loader,
	UISpriteElement,
	Vector2d,
} from "melonjs";
import { gameState } from "../gameState";
import { resources } from "../resources";

/**
 * a basic control to toggle fullscreen on/off
 */
class FSControl extends UISpriteElement {
	/**
	 * constructor
	 */
	constructor(x, y) {
		super(x, y, {
			image: gameState.texture,
			region: "shadedDark30.png",
		});
		this.setOpacity(0.5);
		this.floating = false;
	}

	/**
	 * function called when the pointer is over the object
	 */
	onOver(/* event */) {
		this.setOpacity(1.0);
	}

	/**
	 * function called when the pointer is leaving the object area
	 */
	onOut(/* event */) {
		this.setOpacity(0.5);
	}

	/**
	 * function called when the object is clicked on
	 */
	onClick(/* event */) {
		if (!game.isFullscreen()) {
			game.requestFullscreen();
		} else {
			game.exitFullscreen();
		}
		return false;
	}
}

/**
 * a basic control to toggle fullscreen on/off
 */
class AudioControl extends UISpriteElement {
	/**
	 * constructor
	 */
	constructor(x, y) {
		super(x, y, {
			image: gameState.texture,
			region: "shadedDark13.png", // ON by default
		});
		this.setOpacity(0.5);
		this.isMute = false;
		this.floating = false;
	}

	/**
	 * function called when the pointer is over the object
	 */
	onOver(/* event */) {
		this.setOpacity(1.0);
	}

	/**
	 * function called when the pointer is leaving the object area
	 */
	onOut(/* event */) {
		this.setOpacity(0.5);
	}

	/**
	 * function called when the object is clicked on
	 */
	onClick(/* event */) {
		if (this.isMute) {
			audio.unmuteAll();
			this.setRegion(gameState.texture.getRegion("shadedDark13.png"));
			this.isMute = false;
		} else {
			audio.muteAll();
			this.setRegion(gameState.texture.getRegion("shadedDark15.png"));
			this.isMute = true;
		}
		return false;
	}
}

/**
 * a basic HUD item to display score
 */
class ScoreItem extends BitmapText {
	/**
	 * constructor
	 */
	constructor(x, y) {
		// call the super constructor
		super(game.viewport.width + x, game.viewport.height + y, {
			font: "PressStart2P",
			textAlign: "right",
			textBaseline: "bottom",
			text: "0",
		});

		this.relative = new Vector2d(x, y);

		this.floating = false;

		// local copy of the global score
		this.score = -1;

		// recalculate the object position if the canvas is resize
		event.on(
			event.CANVAS_ONRESIZE,
			function (w, h) {
				this.pos.set(w, h, 0).add(this.relative);
			}.bind(this),
		);
	}

	/**
	 * update function
	 */
	update(dt) {
		if (this.score !== gameState.data.score) {
			this.score = gameState.data.score;
			this.setText(this.score);
			this.isDirty = true;
		}
		return super.update(dt);
	}
}

/**
 * a small readout of the asset bundles in memory: all of them after the boot
 * preload, then `common` and the map being played, the map left behind being
 * unloaded once the next level is in
 */
class BundleReadout extends BitmapText {
	/** where it sits, relative to the bottom-left corner */
	private relative: Vector2d;
	/** the text on show, to set it only when it changes */
	private shown = "";

	constructor(x: number, y: number) {
		super(x, game.viewport.height + y, {
			font: "PressStart2P",
			size: 0.5,
			textAlign: "left",
			textBaseline: "bottom",
			text: "",
		});
		this.relative = new Vector2d(x, y);
		this.floating = false;

		// stay at the bottom of the screen if the canvas is resized
		event.on(event.CANVAS_ONRESIZE, (_w: number, h: number) => {
			this.pos.set(this.relative.x, h + this.relative.y);
		});
	}

	override update(dt: number) {
		const loaded = Object.keys(resources).filter((id) => {
			return loader.isLoaded(id);
		});
		const text = `bundles: ${loaded.join(" ")}`;
		if (text !== this.shown) {
			this.shown = text;
			this.setText(text);
			this.isDirty = true;
		}
		return super.update(dt);
	}
}

/**
 * a HUD container and child items
 */
class UIContainer extends Container {
	constructor() {
		// call the constructor
		super();

		// persistent across level change
		this.isPersistent = true;

		// Use screen coordinates
		this.floating = true;

		// Draw order comes from the `addChild(child, z)` in `play.ts`.
		// `renderable.z` is not a property — the accessor is `depth`, an alias
		// for `pos.z` — so assigning it here only ever made an expando that
		// nothing read, and the container was ordered by `autoDepth` instead.

		// give a name
		this.name = "HUD";

		// add our child score object at position
		this.addChild(new ScoreItem(-10, -30));

		// which asset bundles are in memory
		this.addChild(new BundleReadout(10, -10));

		// add our audio control object
		this.addChild(new AudioControl(36, 56));

		if (!device.isMobile) {
			// add our fullscreen control object
			this.addChild(new FSControl(36 + 10 + 48, 56));
		}
	}
}

export default UIContainer;
