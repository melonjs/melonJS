/**
 * melonJS — Earth Defender: the raid warning.
 *
 * The word WARNING crossing the screen between two rules, the moment the
 * saucer commits to a bombing run and before the first bomb is laid. The raid
 * already gave the player half a lap of notice, but that notice is a shape in
 * the sky the player has to be looking at; this one is unmissable and says
 * what is about to happen.
 *
 * Built out of {@link UIPanel}s rather than drawn by hand: the band and the
 * two rules are rectangles with a fill, which is the widget's whole job, and
 * the one part worth owning here is the sweep.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Application, Container, Text, UIPanel } from "melonjs";
import { HUD_FONT } from "../constants";

/**
 * How long the word takes to cross, end to end.
 *
 * The raid's transfer runs 2600ms, and the sweep has to finish inside it or
 * the warning is still on screen when the thing it warns about arrives. Well
 * inside it, at this length: the word is gone with a second to spare, so the
 * screen is clear before the saucer is overhead.
 */
const SWEEP_MS = 1200;
/** the word, at the title's size */
const TEXT_SIZE = 92;
/** how tall the band is, and how thick the rules that close it */
const BAND_H = 132;
const RULE_H = 4;
/**
 * Where the band sits, as a fraction of the screen: dead centre.
 *
 * The band is translucent enough to fly behind, so the craft stays readable
 * through it and the warning lands where the player is already looking.
 */
const BAND_Y = 0.5;
/** white, as the word is */
const RULE_COLOR = "#ffffff";
/**
 * A dark band under the word.
 *
 * Not decoration: white on the lit limb of the Earth is white on white. It is
 * translucent, so the sky and anything flying through it still read.
 */
const BAND_FILL = "rgba(4, 8, 16, 0.38)";

/**
 * A single pass of the word across the screen, which removes itself when the
 * word has gone.
 */
export class WarningBanner extends UIPanel {
	private readonly label: Text;
	/** how far through the sweep, in milliseconds */
	private sweepMs = 0;
	/** the distance the word covers: off one edge to off the other */
	private readonly travel: number;
	/** where the word starts, which is just off the right edge */
	private readonly startX: number;

	/**
	 * @param app - the application, for the screen size
	 */
	constructor(app: Application) {
		const w = app.renderer.width;
		super(0, Math.round(app.renderer.height * BAND_Y - BAND_H / 2), {
			width: w,
			height: BAND_H,
			fillColor: BAND_FILL,
			borderColor: null,
			// A warning is not a dialog: the game underneath is still being
			// played, and a band across it must not eat a click.
			blocking: false,
		});

		// The two rules, as panels. A border on THIS panel would box the word
		// in on all four sides; the look wants only the top and the bottom.
		for (const y of [0, BAND_H - RULE_H]) {
			this.addChild(
				new UIPanel(0, y, {
					width: w,
					height: RULE_H,
					fillColor: RULE_COLOR,
					borderColor: null,
					blocking: false,
				}),
			);
		}

		this.label = new Text(w, BAND_H / 2, {
			font: HUD_FONT,
			size: TEXT_SIZE,
			fillStyle: RULE_COLOR,
			// LEFT, so `pos.x` is the word's left edge and the sweep is one
			// subtraction. Centred would put the anchor in the middle of the
			// word and make both ends of the travel depend on its width.
			textAlign: "left",
			textBaseline: "middle",
			text: "WARNING",
		});
		this.addChild(this.label);

		// Measured, not guessed: the word has to leave the screen completely,
		// and how wide it is depends on the face and the size.
		this.startX = w;
		this.travel = w + this.label.getBounds().width;
	}

	/** whether the word has left the screen */
	get finished(): boolean {
		return this.sweepMs >= SWEEP_MS;
	}

	/** @ignore */
	override update(dt: number): boolean {
		super.update(dt);
		this.sweepMs += dt;
		const t = Math.min(1, this.sweepMs / SWEEP_MS);
		// Linear, deliberately. An eased sweep reads as the word slowing down
		// to be read, which is the opposite of the urgency this is for.
		this.label.pos.x = Math.round(this.startX - t * this.travel);
		// Takes itself away: a banner is one pass and nothing outside has a
		// reason to watch for the end of it. `removeChild` is deferred, so
		// this is safe from inside an update.
		//
		// `ancestor` is typed `Container | Entity` and only a container can
		// remove a child, so it is narrowed rather than asserted.
		if (this.finished && this.ancestor instanceof Container) {
			this.ancestor.removeChild(this);
		}
		return true;
	}
}
