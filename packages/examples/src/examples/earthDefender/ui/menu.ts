/**
 * The title screen's menu and its modal panels.
 *
 * Both are {@link UIPanel}s: an entry and a card are the same thing at
 * different sizes, a rounded fill with a border on it and something written
 * inside, and the panel already knows how to draw that INSIDE its own
 * rectangle and put the renderer's line width back afterwards. Doing it by
 * hand here meant doing both of those wrong.
 *
 * NOT `UITextButton` for the entries, convenient as that would be: it puts a
 * {@link BitmapText} inside itself, and every label in this example is a
 * `Text` on the `FutureEarth` web font, for which there is no BMFont atlas in
 * the repository. Generating one is possible and is the step that would let
 * the entries become plain `UITextButton`s; it is a separate piece of work
 * from this file.
 *
 * Keyboard and pointer drive the same cursor. Hovering an entry MOVES the
 * selection rather than lighting a second one, so the two can never disagree
 * about which entry Enter would pick.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { type Pointer, Text, UIPanel } from "melonjs";
import { HUD_FONT } from "../constants";

/** entry box */
const ITEM_W = 340;
const ITEM_H = 46;
/** gap between entries, centre to centre */
export const ITEM_STEP = 56;
/** the card's width, and the gap between its lines */
const CARD_W = 620;
const LINE_STEP = 32;
/** a stroked corner needs more than one pixel of width to join cleanly */
const BORDER_W = 2;
/**
 * The space kept clear to the left of a line that has an icon beside it.
 *
 * RESERVED rather than hoped for. The lines are centred, so a long one
 * reaches nearly to the card's edge and anything hung off its left edge ends
 * up outside the panel — which is exactly what happened. A line that is
 * going to carry an icon is shifted right by half the gutter instead, so the
 * icon sits in the space that opens on its left and the two together are
 * still centred on the card.
 *
 * It does not make a line FIT: a line wider than the card is still wider
 * than the card, and the answer to that one is fewer words or two lines.
 */
export const MODAL_GUTTER = 56;

/**
 * How a toggle entry spells itself.
 *
 * One place, because a settings pane and a pause menu showing the same switch
 * two different ways is the kind of thing nobody notices until it looks
 * broken.
 * @param name - what the switch controls
 * @param on - whether it is on
 * @returns the label to show
 */
export function toggleLabel(name: string, on: boolean): string {
	return `${name}: ${on ? "ON" : "OFF"}`;
}

const COLOR_IDLE = "#8fd8ff";
const COLOR_ACTIVE = "#ffffff";
const FILL_ACTIVE = "rgba(60, 150, 220, 0.30)";
const EDGE_ACTIVE = "rgba(190, 240, 255, 0.85)";
// OPAQUE. A card with an alpha drew nothing at all here, while the same
// call with a solid colour fills — and a panel that has to be readable
// over a nebula wants to be opaque anyway.
const PANEL_FILL = "#0a1526";
const PANEL_EDGE = "rgba(130, 210, 255, 0.75)";

/**
 * One step per press, for the screens a menu lives on.
 *
 * `isKeyPressed` reports a key as pressed for as long as it is HELD unless it
 * was bound with the lock, and the actions these screens share with the game
 * — `boost` for up, `fire` for select — are deliberately unlocked there so
 * they repeat while flying. Taking the edge here means a menu does not have
 * to rebind them and restore them on the way out.
 *
 * The seeding is the part worth having in one place. The map starts from the
 * keys that are ALREADY down rather than empty, because an empty map says
 * every key was up and so reads a key held across a state change as a fresh
 * press: a player who held space to leave a finished run was bounced
 * straight back into a new game, and one who held it to dismiss the warning
 * panel would have been thrown into the menu's first entry the same way. A
 * key held across a switch has to be released before it counts.
 */
/**
 * One entry.
 *
 * `onOver` moves the cursor instead of lighting itself, so the pointer and the
 * arrow keys share one notion of what is selected.
 */
export class MenuItem extends UIPanel {
	private label: Text;
	/** called with this entry's index when it is chosen */
	private activate: (index: number) => void;
	/** called with this entry's index when the pointer arrives */
	private point: (index: number) => void;
	private index: number;
	private _selected = false;

	constructor(
		index: number,
		x: number,
		y: number,
		text: string,
		activate: (index: number) => void,
		point: (index: number) => void,
	) {
		// A PANEL, because an entry's chrome is a panel's chrome: a rounded
		// fill with a border on it. This used to hand the renderer its own
		// `RoundRect` and repeat the alpha and line-width dance by hand,
		// which quietly carried both of the bugs that dance exists to avoid.
		// The border was stroked on the entry's own rectangle, so half of it
		// fell outside, and `lineWidth` was set and never put back, which
		// `RenderState.save()` does not restore.
		super(x - ITEM_W / 2, y, {
			width: ITEM_W,
			height: ITEM_H,
			radius: 8,
			borderWidth: BORDER_W,
			// Both null until the cursor arrives: an unselected entry is its
			// label and nothing else. `selected` paints them.
			fillColor: null,
			borderColor: null,
			// `onClick` and `onOver` below consume for themselves. Blocking
			// would ALSO consume the release, which an entry never did as a
			// plain element and has no reason to start doing.
			blocking: false,
		});
		this.index = index;
		this.activate = activate;
		this.point = point;
		this.label = new Text(ITEM_W / 2, ITEM_H / 2, {
			font: HUD_FONT,
			size: 26,
			fillStyle: COLOR_IDLE,
			textAlign: "center",
			textBaseline: "middle",
			text,
		});
		this.addChild(this.label);
		// paint the idle colours through the one place that knows them
		this.selected = false;
	}

	/**
	 * Change what the entry says.
	 *
	 * For the entries that are toggles and have to show their own state. The
	 * box does not resize: every entry is `ITEM_W` wide whatever is written
	 * in it, which is what keeps a column of them aligned.
	 * @param text - the new label
	 */
	setLabel(text: string): void {
		this.label.setText(text);
		this.isDirty = true;
	}

	/** whether the cursor is on this entry; NOT the same as `hover` */
	get selected(): boolean {
		return this._selected;
	}

	set selected(on: boolean) {
		this._selected = on;
		this.fillColor = on ? FILL_ACTIVE : null;
		this.borderColor = on ? EDGE_ACTIVE : null;
		this.label.fillStyle.parseCSS(on ? COLOR_ACTIVE : COLOR_IDLE);
		// the entry repaints itself, so callers do not have to remember
		this.isDirty = true;
	}

	/** @ignore */
	override onOver(): boolean {
		this.point(this.index);
		return false;
	}

	/** @ignore */
	override onClick(_event?: Pointer): boolean {
		this.activate(this.index);
		// consumed: nothing behind a menu entry wants this click
		return false;
	}
}

/**
 * A modal panel: a bordered card over the menu.
 *
 * Just the card, no full-screen scrim. It does not need to swallow clicks
 * aimed past it, because the menu refuses to act while a panel is up
 * (`TitleScreen.choose`), so the two cannot both respond to one click.
 */
export class Modal extends UIPanel {
	private dismiss: () => void;
	/** the body lines, kept so `lineAt` can ask where one actually landed */
	private lines: Text[] = [];
	/**
	 * The line along the foot that says how to leave.
	 *
	 * Public because a caller may want to animate it: the warning panel
	 * breathes its prompt to say the screen is waiting for a gesture, and it
	 * has no business re-deriving where the foot of the card is to put its
	 * own label there instead.
	 */
	readonly hint: Text;

	constructor(
		centreX: number,
		centreY: number,
		title: string,
		lines: string[],
		dismiss: () => void,
		/** indices of the lines that have an icon to the left of them */
		iconLines: readonly number[] = [],
		/** what the foot of the card says; the default is a panel over the menu */
		hintText = "ESC, SPACE OR B TO GO BACK",
	) {
		const w = CARD_W;
		const h = 104 + lines.length * LINE_STEP + 58;
		super(centreX - w / 2, centreY - h / 2, {
			width: w,
			height: h,
			fillColor: PANEL_FILL,
			borderColor: PANEL_EDGE,
			borderWidth: BORDER_W,
			radius: 14,
		});
		this.dismiss = dismiss;

		const heading = new Text(w / 2, 30, {
			font: HUD_FONT,
			size: 32,
			fillStyle: "#ffffff",
			textAlign: "center",
			textBaseline: "top",
			text: title,
		});
		this.addChild(heading);

		lines.forEach((text, i) => {
			// Three kinds of line, marked in the text itself so the panel
			// stays a list of strings: `# ` is a group heading, two leading
			// spaces an aside, anything else an ordinary line.
			const heading = text.startsWith("# ");
			const aside = text.startsWith("  ");
			// shifted right to open the icon's gutter, when this is one of
			// the lines that has one
			const indent = iconLines.includes(i) ? MODAL_GUTTER / 2 : 0;
			const line = new Text(w / 2 + indent, 92 + i * LINE_STEP, {
				font: HUD_FONT,
				size: heading ? 17 : 19,
				fillStyle: heading ? "#ffd98a" : aside ? "#8fb6d8" : "#bfe6ff",
				textAlign: "center",
				textBaseline: "top",
				text: text.replace(/^# /, "").trim(),
			});
			this.addChild(line);
			this.lines.push(line);
		});

		this.hint = new Text(w / 2, h - 36, {
			font: HUD_FONT,
			size: 17,
			fillStyle: "#ffd98a",
			textAlign: "center",
			textBaseline: "top",
			text: hintText,
		});
		this.addChild(this.hint);
	}

	/**
	 * Where a given body line sits on screen.
	 *
	 * The panel owns its own layout, so anything that wants to sit BESIDE a
	 * line asks rather than recomputing the arithmetic and drifting from it.
	 * @param index - the line's index in the list the panel was built with
	 * @returns the line's centre, in screen pixels
	 */
	lineAt(index: number): { left: number; middle: number } {
		// ASKED, not recomputed. Repeating the layout arithmetic here got it
		// wrong by the container's anchor, and would drift again the next
		// time the panel's spacing changed; the label knows where it is.
		//
		// Its LEFT EDGE and its vertical MIDDLE, which is what anything
		// sitting beside it actually wants. The centre is no use: these lines
		// are centred and so have different left edges, and a fixed offset
		// from the centre put an icon inside the longer one. The position
		// alone is no use either, because `textBaseline` is `top`.
		const box = this.lines[index].getBounds();
		return { left: box.x, middle: box.y + box.height / 2 };
	}

	/** @ignore */
	override onClick(_event?: Pointer): boolean {
		this.dismiss();
		return false;
	}
}

/**
 * What the Instructions panel says.
 *
 * Broken into short lines by hand. Nothing here wraps: a string in this
 * array is a line on the panel, however wide it comes out, and a long one
 * runs to the card's border or past it. The tagline reached within nine
 * pixels of the edge and each rock line was wide enough to push its icon
 * clean off the card, so both are two lines now. The second half of a pair
 * is the one without the icon.
 *
 * The gamepad shares the three control rows rather than getting rows of its
 * own. Rows cannot be added freely: {@link INSTRUCTION_ROCKS} addresses this
 * array by INDEX, so anything inserted above line 7 moves the rock icons off
 * their sentences, and the card has no room for four more lines anyway.
 */
export const INSTRUCTIONS = [
	"Hold the dome.",
	"Shoot the rocks. Shoot the bombs.",
	"",
	"LEFT / RIGHT, A / D or STICK      turn",
	"UP / W / SHIFT or RT      boost, it overheats",
	"SPACE, A or RB      fire",
	"",
	"  Fly through ice to cool the boost,",
	"  more of it the bigger the block.",
	"  Shoot radioactive rocks for a big score,",
	"  plus a temporary weapon upgrade,",
	"  a shield, or a score multiplier.",
];

/**
 * The INSTRUCTIONS lines that get a spinning rock beside them, and the kind
 * of rock each one is about. Indices into the array above, kept next to it so
 * they cannot drift apart unnoticed.
 *
 * The FIRST line of each pair, so the icon sits level with where its
 * sentence starts rather than halfway down it.
 */
export const INSTRUCTION_ROCKS: { line: number; kind: "ice" | "bonus" }[] = [
	{ line: 7, kind: "ice" },
	{ line: 9, kind: "bonus" },
];

/** what the Credits panel says, grouped by what kind of asset it is */
export const CREDITS = [
	"# ENGINE",
	"melonJS      melonjs.org",
	"# MODELS",
	"saucer by RayB2      CC0",
	"bomb by Kay Lousberg      CC0",
	"# MUSIC",
	"menu theme by legoluft      CC0",
	"battle theme by Matthew Pablo      CC BY 3.0",
	"# SOUND",
	"laser and saucer drone by Kenney      CC0",
	"# FONT",
	'"Future Earth" by V. Sarela      CC BY-ND 3.0',
];

/**
 * What the photosensitivity notice says.
 *
 * The standard notice every game of this kind opens with, in our own words,
 * and it is here rather than invented because this one has earned it: the
 * explosions, the bolts and the red pulse that closes in as the shield goes
 * are all flashing imagery.
 *
 * Hand-wrapped like the panels above, to the same 46-character ceiling the
 * card's width allows. Nothing here wraps on its own.
 */
export const WARNING = [
	"A small number of people may have a seizure",
	"when exposed to flashing lights or patterns,",
	"even with no history of seizures or epilepsy.",
	"",
	"# STOP PLAYING AND SEE A DOCTOR IF YOU FEEL",
	"dizziness, altered vision, a twitching eye or",
	"face, a jerking limb, confusion or a blackout.",
	"",
	"  This game flashes: bolts, explosions, and a",
	"  red pulse on screen when the dome is struck.",
];
