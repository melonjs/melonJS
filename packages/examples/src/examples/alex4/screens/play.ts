/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { type Application, audio, input, level, Stage, state } from "melonjs";
import { FADE_COLOR, LEVELS } from "../constants";
import { CherryEntity, StarEntity } from "../entities/collectables";
import {
	GameOverMessage,
	HUD,
	LetsGoMessage,
	PauseMessage,
} from "../entities/hud";
import { gameState } from "../gameState";

// gamepad button -> key
const GAMEPAD = [
	[input.GAMEPAD.BUTTONS.LEFT, input.KEY.LEFT],
	[input.GAMEPAD.BUTTONS.RIGHT, input.KEY.RIGHT],
	[input.GAMEPAD.BUTTONS.FACE_1, input.KEY.X],
	[input.GAMEPAD.BUTTONS.FACE_2, input.KEY.Z],
	[input.GAMEPAD.BUTTONS.START, input.KEY.P],
];

/* the in game stuff */
export class PlayScreen extends Stage {
	private app!: Application;
	private hud: HUD | undefined;
	private pauseMessage: PauseMessage | undefined;
	private gameOver = false;
	// to ignore the end of a jingle when something else happened since
	private songId = 0;

	override onResetEvent(app: Application) {
		this.app = app;
		this.gameOver = false;

		// enable the keyboard
		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.X, "jump", true);
		input.bindKey(input.KEY.SPACE, "jump", true);
		input.bindKey(input.KEY.UP, "jump", true);
		input.bindKey(input.KEY.Z, "fire", true);
		input.bindKey(input.KEY.C, "fire", true);
		input.bindKey(input.KEY.ENTER, "fire", true);
		input.bindKey(input.KEY.P, "pause", true);
		input.bindKey(input.KEY.ESC, "quit", true);

		// and the first gamepad
		for (const [button, key] of GAMEPAD) {
			input.bindGamepad(0, { type: "buttons", code: button }, key);
		}

		// add the HUD, it stays when the level reloads
		this.hud = new HUD();
		app.world.addChild(this.hud, 100);

		this.loadLevel(true);
	}

	/** load (or reload) the current level */
	private loadLevel(firstTry: boolean) {
		CherryEntity.count = 0;
		StarEntity.count = 0;
		gameState.cherries = 0;
		gameState.stars = 0;
		gameState.energy = Math.max(gameState.energy, 1);

		level.load(LEVELS[gameState.level], {
			container: this.app.world,
			onLoaded: () => {
				const map = level.getCurrentLevel() as unknown as { label: string };
				if (firstTry) {
					this.app.world.addChild(new LetsGoMessage(map.label), 101);
				}
				this.playLevelSong();
			},
		});
	}

	/** a short jingle, then the level (or boss) song */
	private playLevelSong() {
		const map = level.getCurrentLevel() as unknown as { boss?: number };
		const id = ++this.songId;
		audio.play(map.boss ? "boss_start" : "level_start", false, () => {
			if (id === this.songId && state.isCurrent(state.PLAY)) {
				audio.playTrack(map.boss ? "boss_song" : "level_song");
			}
		});
	}

	override update(dt: number) {
		if (!this.gameOver && input.isKeyPressed("pause")) {
			if (state.isPaused()) {
				state.resume(true);
				if (this.pauseMessage) {
					this.app.world.removeChild(this.pauseMessage);
				}
			} else {
				state.pause(true);
				this.pauseMessage = new PauseMessage();
				this.app.world.addChild(this.pauseMessage, 102);
			}
		}
		if (input.isKeyPressed("quit")) {
			gameState.record();
			state.change(state.MENU);
		}
		return super.update(dt);
	}

	/** Alex just died: some sad music */
	onPlayerDying() {
		this.songId++;
		audio.stopTrack();
		audio.play(gameState.lives > 0 ? "player_dies" : "game_over");
	}

	/** Alex fell out of the screen: try again, or game over */
	onPlayerDeath() {
		const viewport = this.app.viewport;
		if (gameState.lives > 0) {
			viewport.fadeIn(FADE_COLOR, 250, () => {
				this.loadLevel(false);
				viewport.fadeOut(FADE_COLOR, 250);
			});
		} else {
			this.gameOver = true;
			gameState.record();
			this.app.world.addChild(
				new GameOverMessage(() => state.change(state.MENU)),
				101,
			);
		}
	}

	/** exit reached, or guardian defeated */
	onLevelComplete() {
		this.songId++;
		audio.stopTrack();
		state.change(state.READY);
	}

	override onDestroyEvent(app: Application) {
		if (state.isPaused()) {
			state.resume();
		}
		if (this.hud) {
			app.world.removeChild(this.hud);
		}
		this.songId++;
		audio.stopTrack();

		for (const [button] of GAMEPAD) {
			input.unbindGamepad(0, button);
		}
		for (const key of [
			"LEFT",
			"RIGHT",
			"X",
			"SPACE",
			"UP",
			"Z",
			"C",
			"ENTER",
			"P",
			"ESC",
		] as const) {
			input.unbindKey(input.KEY[key]);
		}
	}
}
