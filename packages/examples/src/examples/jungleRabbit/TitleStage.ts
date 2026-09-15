/**
 * melonJS — Jungle Rabbit: the title screen.
 *
 * A separate `Stage`, not an overlay on the game one. That is what lets the
 * state manager's own fade carry the change: `state.transition("fade", …)`
 * applies to every switch, so the title dissolving into the run costs one line
 * rather than a hand-rolled alpha ramp.
 *
 * It reuses the river's own scenery — the same textures and geometry the run
 * builds — so the title is a view OF the game rather than a picture beside it.
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
import { getRipples } from "./assets";
import {
	HUD_Z,
	PROMPT_BLINK_MS,
	PROMPT_DIM,
	TITLE_CARROT_BOB,
	TITLE_CARROT_BOB_RATE,
	TITLE_CARROT_SPIN,
	TITLE_CARROT_Y,
	TITLE_DRIFT,
	VIEW_H,
	VIEW_W,
} from "./constants";
import { menuLines, menuText } from "./menuText";
import { bestMetres, bestScore, initRecords } from "./records";
import { aimFlare, buildBackdrop } from "./scenery";
import { driftWaterPlane } from "./terrain";

/** the axis the carrots turn about — Y, so they spin where they float */
const AXIS_Y = new Vector3d(0, 1, 0);

export class TitleStage extends Stage {
	/** latched once the run has been asked for, so one press is one transition */
	private leaving = false;
	/** the pieces of the backdrop this stage animates */
	private backdrop!: ReturnType<typeof buildBackdrop>;
	/** kept from the reset: `aimFlare` needs it every frame */
	private camera!: Camera3d;
	private elapsed = 0;
	private carrotAngle = 0;

	onResetEvent(app: Application) {
		this.backdrop = buildBackdrop(app);
		this.camera = app.viewport as Camera3d;
		this.elapsed = 0;
		this.carrotAngle = 0;
		initRecords();

		const world = app.world;
		world.addChild(menuText(VIEW_W / 2, 93, 34, "JUNGLE RABBIT"), HUD_Z);
		// The prompt breathes rather than sitting dead on the screen — the
		// arcade idiom, and the one element the player is waiting to act on.
		// It dips to `PROMPT_DIM` and back rather than blinking to nothing:
		// a prompt that vanishes reads as a glitch at this size, and the
		// controls line underneath it has to stay legible throughout.
		const promptLines = menuLines(
			VIEW_W / 2,
			VIEW_H - 90,
			15,
			"PRESS SPACE TO PADDLE\nARROWS STEER   SPACE JUMPS",
		);
		for (const line of promptLines) {
			world.addChild(line, HUD_Z);
		}
		// every line blinks, not just the first — one tween each, started
		// together so they stay in step
		for (const line of promptLines) {
			new Tween(line)
				.to({ alpha: PROMPT_DIM }, { duration: PROMPT_BLINK_MS / 2 })
				.easing(Tween.Easing.Sinusoidal.InOut)
				.yoyo(true)
				.repeat(Number.POSITIVE_INFINITY)
				.start();
		}
		// Credits, small and out of the way along the bottom. The music is
		// Pixabay-licensed and asks for attribution, so this is not decoration
		// — it is the condition of using the track.
		for (const line of menuLines(
			VIEW_W / 2,
			VIEW_H - 29,
			9,
			"MADE WITH MELONJS   ASSETS MODELLED IN BLENDER\nMUSIC BY VLAD KROTOV - PIXABAY",
			"center",
			0.35,
		)) {
			world.addChild(line, HUD_Z);
		}

		// only once there is a record — a first run should not be greeted by
		// a row of zeroes
		if (bestScore() > 0 || bestMetres() > 0) {
			for (const line of menuLines(
				VIEW_W - 10,
				21,
				13,
				`BEST\n${bestScore()}\n${bestMetres()}M`,
				"right",
			)) {
				world.addChild(line, HUD_Z);
			}
		}

		input.bindKey(input.KEY.SPACE, "start", true);
		this.leaving = false;
	}

	update(dt: number) {
		super.update(dt);
		aimFlare(this.camera, this.backdrop.sunDisc);
		this.elapsed += dt;
		const t = this.elapsed / 1000;

		// The menu is a live scene, not a screenshot. Nothing here travels, so
		// each piece of motion has to be driven by hand: the river's texture is
		// baked (its flow IS the UV scroll), the crest effect has no clock of
		// its own, and a `Mesh` does not spin unless something turns it.
		// UVs only: the menu's plane must not move, or it sails away up
		// the river and leaves the shot showing the bare riverbed
		driftWaterPlane(this.backdrop.waterPlane, t * TITLE_DRIFT);
		getRipples().setTime(t);

		// `rotate` is relative, so the turn is fed as a delta — handing it the
		// absolute angle would wind the carrots up a full turn every frame
		const turned = t * TITLE_CARROT_SPIN;
		for (const [i, carrot] of this.backdrop.carrots.entries()) {
			// opposite directions, so the pair reads as two objects rather
			// than one mechanism
			const sign = i === 0 ? 1 : -1;
			carrot.rotate(sign * (turned - this.carrotAngle), AXIS_Y);
			// and a slow bob, out of phase with each other
			carrot.pos.y =
				TITLE_CARROT_Y +
				Math.sin(t * TITLE_CARROT_BOB_RATE + i * Math.PI) * TITLE_CARROT_BOB;
		}
		this.carrotAngle = turned;

		// One press, one transition. `state.change` under a fade does not switch
		// immediately — it hands over when the fade completes — and a Stage's
		// own `update` keeps running for that whole window, so a second tap
		// inside it queues a SECOND change. The stage is then built, destroyed
		// and rebuilt: a visible hitch, and `GameStage.onDestroyEvent` stops
		// the music, which can land after the rebuild has started it and leave
		// the run silent. `bindKey(..., true)` locks the key per press, so it
		// is genuinely two presses that get through — this latches the intent.
		if (this.leaving === false && input.isKeyPressed("start")) {
			this.leaving = true;
			state.change(state.PLAY);
		}
		return true;
	}

	onDestroyEvent() {
		input.unbindKey(input.KEY.SPACE);
	}
}
