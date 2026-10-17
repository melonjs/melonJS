/**
 * melonJS — Earth Defender: the settings pane.
 *
 * Two switches and a way out, on a card over the title screen. It is built
 * like {@link PauseMenu} rather than like {@link Modal}: a modal is a slab of
 * text with one way to dismiss it, and these rows have to be moved between
 * and taken, which is a menu.
 *
 * Both switches are also reachable without opening this, by key and from the
 * pause menu, because a player who wants the sound off wants it off NOW. This
 * is the discoverable copy of them, not the only one.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, input, Text, UIPanel } from "melonjs";
import {
	HUD_FONT,
	PAUSE_CARD_EDGE,
	PAUSE_CARD_FILL,
	PAUSE_HINT_COLOR,
	PAUSE_TITLE_COLOR,
} from "../constants";
import { ITEM_STEP, MenuItem, toggleLabel } from "./menu";

/** the card */
const CARD_W = 460;
/**
 * Tall enough for the hint to clear the last of three rows: they are
 * `ITEM_STEP` apart and 46 high, so the third ends at 250, and the hint sits
 * 32 up from the bottom edge.
 */
const CARD_H = 312;
/** where the first row sits inside the card, from its top */
const FIRST_ROW_Y = 92;

/** what the pane reads and writes */
export interface SettingsActions {
	/** whether the game is currently fullscreen */
	isFullscreen(): boolean;
	/** turn fullscreen on or off */
	toggleFullscreen(): void;
	/** whether sound is currently audible */
	isAudioOn(): boolean;
	/** turn the sound on or off */
	toggleAudio(): void;
	/** close the pane and give the menu back */
	close(): void;
}

/**
 * The settings card: fullscreen, sound, and back.
 */
export class SettingsPanel extends UIPanel {
	private readonly actions: SettingsActions;
	private readonly rows: MenuItem[] = [];
	private cursor = 0;
	/**
	 * The keys held on the frame this opened, treated as already seen, so the
	 * press that OPENED the pane is not read again as a press inside it.
	 */
	private wasDown: Record<string, boolean> = {};

	/**
	 * @param app - the application
	 * @param actions - see {@link SettingsActions}
	 */
	constructor(app: Application, actions: SettingsActions) {
		super(
			app.renderer.width / 2 - CARD_W / 2,
			app.renderer.height / 2 - CARD_H / 2,
			{
				width: CARD_W,
				height: CARD_H,
				fillColor: PAUSE_CARD_FILL,
				borderColor: PAUSE_CARD_EDGE,
				borderWidth: 2,
				radius: 14,
			},
		);
		this.actions = actions;

		const heading = new Text(CARD_W / 2, 26, {
			font: HUD_FONT,
			size: 30,
			fillStyle: PAUSE_TITLE_COLOR,
			textAlign: "center",
			textBaseline: "top",
			text: "SETTINGS",
		});
		this.addChild(heading);

		const hint = new Text(CARD_W / 2, CARD_H - 32, {
			font: HUD_FONT,
			size: 14,
			fillStyle: PAUSE_HINT_COLOR,
			textAlign: "center",
			textBaseline: "top",
			text: "F FULLSCREEN, M SOUND, ESC TO GO BACK",
		});
		hint.setOpacity(0.75);
		this.addChild(hint);

		["", "", "BACK"].forEach((text, i) => {
			const row = new MenuItem(
				i,
				CARD_W / 2,
				FIRST_ROW_Y + i * ITEM_STEP,
				text,
				(index) => {
					this.choose(index);
				},
				(index) => {
					this.moveTo(index);
				},
			);
			this.addChild(row);
			this.rows.push(row);
		});
		// the two switches say what they are only once they have been asked
		this.refresh();
		this.moveTo(0);

		for (const action of [
			"boost",
			"menuDown",
			"fire",
			"menuSelect",
			"menuBack",
		]) {
			this.wasDown[action] = input.isKeyPressed(action);
		}
	}

	/**
	 * Write both switches from what they actually are.
	 *
	 * Read back rather than remembered: `F` and `M` work while this pane is
	 * open, and the browser can drop out of fullscreen on its own (Escape at
	 * the OS level), so a cached flag would start lying.
	 */
	refresh(): void {
		this.rows[0]?.setLabel(
			toggleLabel("FULLSCREEN", this.actions.isFullscreen()),
		);
		this.rows[1]?.setLabel(toggleLabel("SOUND", this.actions.isAudioOn()));
	}

	/**
	 * Put the pane on screen.
	 * @param app - the application
	 * @param depth - where it sits among the world's floating children
	 */
	open(app: Application, depth: number): void {
		app.world.addChild(this, depth);
	}

	/**
	 * Take it off again.
	 * @param app - the application
	 */
	close(app: Application): void {
		this.rows.length = 0;
		app.world.removeChild(this);
	}

	/**
	 * One step per press.
	 * @param action - the bound action name
	 * @returns true on the frame the key goes down
	 */
	private pressed(action: string): boolean {
		const down = input.isKeyPressed(action);
		const edge = down && this.wasDown[action] !== true;
		this.wasDown[action] = down;
		return edge;
	}

	/**
	 * Put the cursor on a row.
	 * @param index - which one, wrapped into range
	 */
	private moveTo(index: number): void {
		this.cursor = (index + this.rows.length) % this.rows.length;
		this.rows.forEach((row, i) => {
			row.selected = i === this.cursor;
		});
	}

	/**
	 * Take the row under the cursor.
	 * @param index - which one was chosen
	 */
	private choose(index: number): void {
		if (index === 0) {
			this.actions.toggleFullscreen();
		} else if (index === 1) {
			this.actions.toggleAudio();
		} else {
			this.actions.close();
			return;
		}
		// Straight after the switch, so the row shows what it just became
		// rather than what it was.
		this.refresh();
	}

	/** @ignore */
	override update(dt: number): boolean {
		super.update(dt);
		const up = this.pressed("boost");
		const down = this.pressed("menuDown");
		const select = this.pressed("fire") || this.pressed("menuSelect");
		const back = this.pressed("menuBack");
		if (up) {
			this.moveTo(this.cursor - 1);
		}
		if (down) {
			this.moveTo(this.cursor + 1);
		}
		if (back) {
			this.actions.close();
			return true;
		}
		if (select) {
			this.choose(this.cursor);
		}
		// The keys work from anywhere, this pane included, so what the rows
		// say has to follow them rather than only follow this menu.
		this.refresh();
		return true;
	}
}
