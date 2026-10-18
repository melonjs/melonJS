/**
 * melonJS — Jungle Rabbit: the game-over screen.
 *
 * A stage rather than a banner over the frozen run. The state manager's fade
 * carries the change, the result gets room to be read, and the run's own
 * scenery keeps rendering behind it — which is why the arguments come in
 * through `state.change`: this stage tears the world down and rebuilds it, so
 * it cannot read anything off the one that ended.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	type Camera3d,
	input,
	Stage,
	state,
	Tween,
	Vector3d,
} from "melonjs";
import { getRipples } from "../assets";
import {
	HUD_Z,
	PROMPT_BLINK_MS,
	PROMPT_DIM,
	TITLE_CARROT_BOB,
	TITLE_CARROT_BOB_RATE,
	TITLE_CARROT_SPIN,
	TITLE_CARROT_Y,
	TITLE_DRIFT,
	TITLE_WAVE_AMP,
	TITLE_WAVE_RATE,
	TITLE_WAVE_SPREAD,
	VIEW_H,
	VIEW_W,
} from "../constants";
import { driftWaterPlane } from "../entities/terrain";
import { aimFlare, buildBackdrop } from "../fx/scenery";
import { bestMetres, bestScore, initRecords } from "../lib/records";
import { menuText, waveEffect } from "../ui/menuText";

/** the axis the carrots turn about — Y, so they spin where they float */
const AXIS_Y = new Vector3d(0, 1, 0);

export class GameOverStage extends Stage {
	/** latched once a destination has been chosen — one press, one transition */
	private leaving = false;
	/** the pieces of the backdrop this stage animates */
	private backdrop!: ReturnType<typeof buildBackdrop>;
	/** kept from the reset: `aimFlare` needs it every frame */
	private camera!: Camera3d;
	private elapsed = 0;
	private carrotAngle = 0;

	/**
	 * @param app - the running application
	 * @param score - carrots collected in the run that just ended
	 * @param metres - how far it got
	 * @param beatRecord - whether it improved on the stored best
	 */
	onResetEvent(app: Application, score = 0, metres = 0, beatRecord = false) {
		this.backdrop = buildBackdrop(app);
		this.camera = app.viewport as Camera3d;
		initRecords();
		this.elapsed = 0;
		this.carrotAngle = 0;

		const world = app.world;
		// The heading arrives moving, on the same wave the title rides, so the
		// two screens read as one piece of lettering rather than two.
		//
		// This is the heading the player actually reads: the in-game banner
		// says the same words, but `gameOver` changes state in the same
		// breath, so it only ever shows under the 420ms fade.
		const heading = menuText(
			VIEW_W / 2,
			84,
			"title",
			beatRecord ? "NEW BEST!" : "CAPSIZED!",
		);
		heading.glyphEffect = waveEffect(
			TITLE_WAVE_AMP,
			TITLE_WAVE_RATE,
			TITLE_WAVE_SPREAD,
		);
		world.addChild(heading, HUD_Z);
		world.addChild(
			menuText(VIEW_W / 2, 134, "body", `${score} CARROTS\n${metres}M`),
			HUD_Z,
		);
		// The stats sit still; only the line the player is waiting to act on
		// breathes — pulsing the record alongside it would make the whole
		// panel flicker and read as a fault.
		world.addChild(
			menuText(
				VIEW_W / 2,
				VIEW_H - 55,
				"body",
				`BEST ${bestScore()} CARROTS   ${bestMetres()}M`,
			),
			HUD_Z,
		);
		const prompt = menuText(
			VIEW_W / 2,
			VIEW_H - 27,
			"body",
			"SPACE TO PADDLE AGAIN   ESC FOR MENU",
		);
		world.addChild(prompt, HUD_Z);
		new Tween(prompt)
			.to({ alpha: PROMPT_DIM }, { duration: PROMPT_BLINK_MS / 2 })
			.easing(Tween.Easing.Sinusoidal.InOut)
			.yoyo(true)
			.repeat(Number.POSITIVE_INFINITY)
			.start();

		input.bindKey(input.KEY.SPACE, "again", true);
		input.bindKey(input.KEY.ESC, "menu", true);
		this.leaving = false;
	}

	update(dt: number) {
		super.update(dt);
		aimFlare(this.camera, this.backdrop.sunDisc);
		this.elapsed += dt;
		const t = this.elapsed / 1000;
		// the same live backdrop as the title: the river flows, the crests
		// travel and the pair of carrots turns. A results screen over a frozen
		// photograph reads as the game having crashed rather than ended.
		driftWaterPlane(this.backdrop.waterPlane, t * TITLE_DRIFT);
		getRipples().setTime(t);
		const turned = t * TITLE_CARROT_SPIN;
		for (const [i, carrot] of this.backdrop.carrots.entries()) {
			carrot.rotate((i === 0 ? 1 : -1) * (turned - this.carrotAngle), AXIS_Y);
			carrot.pos.y =
				TITLE_CARROT_Y +
				Math.sin(t * TITLE_CARROT_BOB_RATE + i * Math.PI) * TITLE_CARROT_BOB;
		}
		this.carrotAngle = turned;
		// Latched for the same reason as the title screen: `state.change` under
		// a fade hands over only once the fade is done, and this `update` keeps
		// running until then — so a second tap, or SPACE and ESC together,
		// queues a second change and the target stage is built twice.
		if (this.leaving === true) {
			return true;
		}
		if (input.isKeyPressed("again")) {
			this.leaving = true;
			state.change(state.PLAY);
		} else if (input.isKeyPressed("menu")) {
			this.leaving = true;
			state.change(state.MENU);
		}
		return true;
	}

	onDestroyEvent() {
		input.unbindKey(input.KEY.SPACE);
		input.unbindKey(input.KEY.ESC);
	}
}
