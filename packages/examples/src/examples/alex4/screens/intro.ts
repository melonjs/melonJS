/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { input, Renderable, type Renderer, type Sprite, state } from "melonjs";
import { HEIGHT, PALETTE, WIDTH } from "../constants";
import { Cutscene, SCREEN_W } from "./cutscene";

/** the intro is not one of the states melonJS knows about */
export const INTRO = state.USER;

const CHOPPER = ["chopper1", "chopper2", "chopper3", "chopper4"];

/**
 * the rope the cage hangs from, straight down from the helicopter
 */
class Rope extends Renderable {
	private helicopter: Sprite;
	private cage: Sprite;

	constructor(helicopter: Sprite, cage: Sprite) {
		// as big as the screen, so it is never out of view
		super(0, 0, WIDTH, HEIGHT);
		this.anchorPoint.set(0, 0);
		this.helicopter = helicopter;
		this.cage = cage;
	}

	override draw(renderer: Renderer) {
		// from under the helicopter (35, 10 pixels in, at the original scale)
		const top = this.helicopter.pos.y + 40;
		renderer.setColor(PALETTE[0]);
		renderer.fillRect(
			this.helicopter.pos.x + 140,
			top,
			4,
			this.cage.pos.y - top,
		);
	}
}

/*---------------------------------------------------------------------

	The beginning: Lola is taken away by the humans.
	Same scenes and timing as the original intro script.

  ---------------------------------------------------------------------	*/

export class IntroScreen extends Cutscene {
	constructor() {
		super("a4_intro", "intro_song");
	}

	protected play() {
		this.jungle();
	}

	/** Alex and Lola talk in the jungle, and hear something coming */
	private jungle() {
		this.actor("alex", 48, 64, "right");
		this.actor("lola", 80, 64);

		this.at(300, () =>
			this.speak(
				80,
				60,
				"right",
				["Hey, did you", "hear about", "those kidnapped", "animals?"],
				4000,
			),
		);
		this.at(4300, () =>
			this.speak(
				60,
				60,
				"left",
				["Yeah, terrible.", "I bet it's those", "humans again."],
				3000,
			),
		);
		this.at(7300, () => {
			this.loop("chopper", 0.2);
			this.speak(
				80,
				60,
				"right",
				["Probably... Wait!", "What's that sound?", "It sounds like..."],
				3000,
			);
		});
		this.at(10300, () => this.loop("chopper", 0.5));
		this.cut(10300, () => this.arrival());
	}

	/** a helicopter flies over the treetops, and lowers a cage */
	private arrival() {
		this.treetops();
		this.loop("chopper", 0.8);
		// it comes in from the right edge of our wider screen, in the same time
		const helicopter = this.animated(CHOPPER, 20, SCREEN_W, 30);
		// behind the helicopter, as in the original
		const cage = this.actor("cage_sml1", SCREEN_W + 29, 50, "left", 9);
		this.add(new Rope(helicopter, cage), 8);

		const speed = (SCREEN_W - 60) / 100;
		this.at(300, () => {
			this.move(helicopter, -speed, 0, 100).start();
			this.move(cage, -speed, 0, 100).start();
		});
		this.at(2300, () =>
			this.speak(60, 40, "right", ["Look,", "allegators!"], 2000),
		);
		this.at(4300, () => this.move(cage, 0, 2, 35).start());
		this.cut(5000, () => this.kidnapping());
	}

	/** the cage falls on Lola, and takes her away */
	private kidnapping() {
		this.loop("chopper", 0.5);
		const chain = this.actor("chain", 86, -135, "left", 11);
		const cage = this.actor("cage_big", 80, -38, "left", 11);
		this.actor("alex", 48, 64, "right");
		const lola = this.actor("lola", 80, 64);

		this.at(300, () => {
			this.move(cage, 0, 4, 24).start();
			this.move(chain, 0, 4, 24).start();
		});
		this.at(780, () => {
			this.sound("impact");
			this.speak(80, 50, "right", ["Alex!"], 2000);
		});
		this.at(1780, () => this.speak(60, 60, "left", ["Nooooo!"], 1000));
		this.at(2780, () => {
			for (const actor of [cage, chain, lola]) {
				this.move(actor, 0, -2, 48).start();
			}
		});
		this.cut(3740, () => this.departure());
	}

	/** the helicopter leaves, with Lola in the cage */
	private departure() {
		this.treetops();
		this.loop("chopper", 0.8);
		const helicopter = this.animated(CHOPPER, 20, 60, 30);
		const cage = this.actor("cage_sml2", 89, 122, "left", 9);
		this.add(new Rope(helicopter, cage), 8);

		this.at(300, () => this.move(cage, 0, -1, 60).start());
		this.at(1500, () => this.speak(80, 30, "right", ["*har har har*"], 1000));
		this.at(2500, () => {
			this.move(cage, -1, 0, 130).start();
			this.move(helicopter, -1, 0, 130).start();
		});
		this.cut(5100, () => this.plea());
	}

	/** alone in the dark, Alex asks for help */
	private plea() {
		this.fill(PALETTE[1]);
		this.loop("chopper", 0);
		// centered on our wider screen
		const x = 100 + (SCREEN_W - 160) / 2;
		this.actor("alex", x, 82);

		this.at(300, () =>
			this.speak(
				x,
				80,
				"right",
				["Please! You must", "help me find Lola!"],
				3000,
			),
		);
		this.at(1050, () => this.sound("talk"));
		this.at(3300, () =>
			this.speak(
				x,
				80,
				"right",
				["Let's go before they", "make a pair of", "shoes out of her!"],
				4000,
			),
		);
		this.at(4050, () => this.sound("talk"));
		// and the game begins
		this.at(7300, () => state.change(state.MENU));
	}

	override update(dt: number) {
		// escape skips it, as in the original, and so do enter, jump (space,
		// or a click or a tap), and start or A on a pad
		if (
			input.isKeyPressed("skip") ||
			input.isKeyPressed("start") ||
			input.isKeyPressed("jump")
		) {
			state.change(state.MENU);
		}
		return super.update(dt);
	}
}
