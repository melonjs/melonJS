/**
 * melonJS — Earth Defender: the pause menu.
 *
 * The one piece of this game that has to keep running while everything else
 * is stopped, which is the whole reason it is its own file.
 *
 * `state.pause()` sets a flag that `Container.update` consults, so every
 * world child stops stepping while rendering carries on. {@link GameController}
 * is a world child, so the run freezes exactly as wanted; but so would
 * anything built to read the key that unpauses it. This sets
 * `updateWhenPaused`, which is the opt-out `Container.update` honours, and it
 * is therefore the only thing in the scene still listening. The flag covers
 * everything under it, so the card and the labels inside the card follow
 * without being flagged one by one.
 *
 * It IS a {@link UIPanel}, and the panel it is is the VEIL: the whole screen,
 * a fill and nothing else, so the frozen frame stays visible through it. A
 * pause the player can still see reads as a pause; one that replaces the
 * screen reads as having left the game. The card is a second panel, its
 * child, and that nesting is not a tidiness: it is what fixes the order the
 * two are painted in. Two world siblings are ordered by the world's sort,
 * and under a `Camera3d` that sort is by camera distance (see
 * {@link OVERLAY_DEPTH}); a child is painted over its parent whatever the
 * sort does. One depth to get right instead of two, and nothing in the scene
 * can come between them.
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
	PAUSE_VEIL,
} from "../constants";
import { ITEM_STEP, MenuItem, toggleLabel } from "./menu";

/** the card behind the entries */
const CARD_W = 460;
/**
 * Tall enough for the hint to clear the LAST entry: they are `ITEM_STEP`
 * apart and 46 high, so the fourth ends at 306, and the hint sits 32 up from
 * the bottom edge. Grown a step at a time as the two switches joined; at the
 * original 256 the hint sat on top of the entries.
 */
const CARD_H = 368;
/** where the first entry sits inside the card, from its top */
const FIRST_ITEM_Y = 92;
/**
 * How far the card drifts, and how long a full cycle takes.
 *
 * Small and slow. The card is the only thing on screen still moving while the
 * game is frozen behind it, which is the point: a paused screen that is
 * completely static for a few seconds reads as a game that has hung. Three
 * pixels over two and a half seconds is below the threshold where it looks
 * like an animation and above the one where it looks like nothing.
 *
 * It keeps moving while paused because {@link PauseMenu} sets
 * `updateWhenPaused`, and the bob is fed from `update(dt)` like every other
 * animation rather than from a wall clock.
 */
const CARD_BOB = 3;
const CARD_BOB_MS = 2500;
/**
 * Where the overlay sits among the world's floating children.
 *
 * ZERO, not a large number. The world sorts on `"depth"`, as every `Camera3d`
 * scene does, and a floating child is ranked there by `pos.z` SQUARED, with
 * the smaller magnitude drawn on top: the same rule the HUD follows at 1. At
 * 9100, the 2D idiom for "above everything", the overlay was the farthest
 * thing in the scene and drew first; the globe and the HUD then painted over
 * it, and all that survived was the slice of border the planet does not
 * reach. Zero is nearer than anything, the HUD included, which is what a
 * modal wants: the readout dims with the rest of the frozen frame.
 */
const OVERLAY_DEPTH = 0;

/** what the entries do, in the order they are shown */
export interface PauseActions {
	/** carry on with the run */
	resume(): void;
	/**
	 * Toggle fullscreen.
	 *
	 * An action rather than something this menu does itself: the toggle needs
	 * the `Application`, and a menu that reached for one would be the only
	 * part of this screen that did.
	 */
	fullscreen(): void;
	/** whether the game is currently fullscreen */
	isFullscreen(): boolean;
	/** toggle the sound */
	audio(): void;
	/** whether sound is currently audible */
	isAudioOn(): boolean;
	/** abandon it and go back to the title */
	quit(): void;
}

/**
 * The pause overlay: a veil, a card on it, two entries, and the keys that
 * drive them.
 *
 * Built when the player pauses and destroyed when they leave, rather than
 * kept hidden: it is a handful of renderables and a run can go a whole game
 * without one.
 */
export class PauseMenu extends UIPanel {
	private readonly actions: PauseActions;
	private readonly items: MenuItem[] = [];
	/** the bordered card in the middle; the entries and labels are its children */
	private readonly card: UIPanel;
	private cursor = 0;
	/**
	 * The keys held on the frame this opened, treated as already seen.
	 *
	 * The player is holding the pause key at the moment the menu appears, and
	 * `isKeyPressed` reports a key for as long as it is down. Without this the
	 * menu would read that same press as "back", close on the frame it opened
	 * and look like the pause key did nothing.
	 */
	private wasDown: Record<string, boolean> = {};

	constructor(app: Application, actions: PauseActions) {
		const w = app.renderer.width;
		const h = app.renderer.height;
		// The veil: a fill, no border, no corner. As a panel it also takes
		// the clicks that miss the card, which is what stops a pointer
		// reaching the frozen game underneath.
		super(0, 0, {
			width: w,
			height: h,
			fillColor: PAUSE_VEIL,
			borderColor: null,
		});
		this.actions = actions;
		// THE point of this class: `Container.update` skips a child without
		// it while the state is paused, which is every other thing on screen.
		// Set once, here: it reaches the card and everything in the card.
		this.updateWhenPaused = true;

		this.card = new UIPanel(w / 2 - CARD_W / 2, h / 2 - CARD_H / 2, {
			width: CARD_W,
			height: CARD_H,
			fillColor: PAUSE_CARD_FILL,
			borderColor: PAUSE_CARD_EDGE,
			borderWidth: 2,
			radius: 14,
			bobAmplitude: CARD_BOB,
			bobPeriod: CARD_BOB_MS,
		});
		this.addChild(this.card);

		const heading = new Text(CARD_W / 2, 26, {
			font: HUD_FONT,
			size: 30,
			fillStyle: PAUSE_TITLE_COLOR,
			textAlign: "center",
			textBaseline: "top",
			text: "PAUSED",
		});
		this.card.addChild(heading);

		const hint = new Text(CARD_W / 2, CARD_H - 32, {
			font: HUD_FONT,
			size: 14,
			fillStyle: PAUSE_HINT_COLOR,
			textAlign: "center",
			textBaseline: "top",
			text: "F FULLSCREEN, M SOUND, ESC TO RESUME",
		});
		hint.setOpacity(0.75);
		this.card.addChild(hint);

		// Children of the card, so they are placed in its space and leave
		// with it. `MenuItem` positions its own box from
		// `getAbsolutePosition`, which is what lets it be nested at all.
		["RESUME GAME", "", "", "TITLE SCREEN"].forEach((text, i) => {
			const item = new MenuItem(
				i,
				CARD_W / 2,
				FIRST_ITEM_Y + i * ITEM_STEP,
				text,
				(index) => {
					this.choose(index);
				},
				(index) => {
					this.moveTo(index);
				},
			);
			this.card.addChild(item);
			this.items.push(item);
		});
		// the two switches say what they are only once they have been asked
		this.refresh();
		this.moveTo(0);

		// Every action the menu reads, sampled as already held. `boost` and
		// `fire` are the same keys the craft flies with, so the player is very
		// likely holding one of them at the moment they pause.
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
	 * Put the overlay into the world.
	 * @param app - the application
	 */
	open(app: Application): void {
		app.world.addChild(this, OVERLAY_DEPTH);
	}

	/**
	 * Take it out again.
	 * @param app - the application
	 */
	close(app: Application): void {
		// the card and its entries are this panel's children, so they go
		// with it
		this.items.length = 0;
		app.world.removeChild(this);
	}

	/**
	 * One step per press.
	 *
	 * The same edge the title screen takes, and for the same reason: the two
	 * actions this shares with the game are deliberately unlocked so they
	 * repeat while flying, and a menu reading them at level would run away.
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
	 * Put the cursor on an entry.
	 * @param index - which one, wrapped into range
	 */
	private moveTo(index: number): void {
		this.cursor = (index + this.items.length) % this.items.length;
		this.items.forEach((item, i) => {
			item.selected = i === this.cursor;
		});
	}

	/**
	 * Take the entry under the cursor.
	 * @param index - which one was chosen
	 */
	private choose(index: number): void {
		if (index === 0) {
			this.actions.resume();
			return;
		}
		if (index === 3) {
			this.actions.quit();
			return;
		}
		// The menu stays up for a switch: a player toggling one is settling
		// in to carry on, not asking to be dropped back into the run, and a
		// switch is worth being able to undo in place.
		if (index === 1) {
			this.actions.fullscreen();
		} else {
			this.actions.audio();
		}
		// straight after, so the row shows what it just became
		this.refresh();
	}

	/**
	 * Write both switches from what they actually are.
	 *
	 * Read back rather than remembered: the keys work while this menu is up,
	 * and the browser can leave fullscreen on its own, so a cached flag would
	 * start lying.
	 */
	private refresh(): void {
		this.items[1]?.setLabel(
			toggleLabel("FULLSCREEN", this.actions.isFullscreen()),
		);
		this.items[2]?.setLabel(toggleLabel("SOUND", this.actions.isAudioOn()));
	}

	/** @ignore */
	override update(dt: number): boolean {
		super.update(dt);
		// Every action is read every frame, chosen or not, so an edge is never
		// left looking fresh for the next menu to find.
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
			// Back is RESUME, not quit. Dismissing a pause should put the
			// player back where they were; abandoning a run is a thing to
			// choose, not a thing to fall out of.
			this.actions.resume();
			return true;
		}
		if (select) {
			this.choose(this.cursor);
		}
		// The keys work from anywhere, this menu included, so what the rows
		// say has to follow them rather than only follow this menu.
		this.refresh();
		return true;
	}
}
