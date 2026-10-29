/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	type Application,
	audio,
	event,
	input,
	level,
	Stage,
	state,
	type TMXTileMap,
} from "melonjs";
import { LEVELS } from "../constants";
import { CherryEntity, StarEntity } from "../entities/collectables";
import {
	GameOverMessage,
	HUD,
	LetsGoMessage,
	PauseMessage,
} from "../entities/hud";
import { bindPads, PLAY_PAD, unbindPads } from "../gamepad";
import { gameState } from "../gameState";
import { shaders } from "../shaders";
import { go, pixelate } from "../transition";

// the custom properties of our Tiled maps
export type LevelMap = TMXTileMap & {
	label: string;
	boss?: number;
	win?: number;
};

/* the in game stuff */
export class PlayScreen extends Stage {
	private app!: Application;
	private hud: HUD | undefined;
	private pauseMessage: PauseMessage | undefined;
	/** the banner is up because the window lost the focus, not for P */
	private pausedByBlur = false;
	private gameOver = false;

	override onResetEvent(app: Application) {
		this.app = app;
		this.gameOver = false;
		// a game left while paused took its banner with it
		this.pauseMessage = undefined;
		this.pausedByBlur = false;

		// melonJS pauses the game when the window loses the focus (pauseOnBlur)
		// and resumes it when it comes back: the banner says so, as it did in
		// the original
		event.on(event.BLUR, this.onBlur);
		event.on(event.FOCUS, this.onFocus);

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

		// and the gamepads
		bindPads(PLAY_PAD);

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
		// a reload stops the points on their way: they are in the score already
		gameState.flying = 0;
		gameState.energy = Math.max(gameState.energy, 1);

		level.load(LEVELS[gameState.level], {
			container: this.app.world,
			onLoaded: () => {
				const map = level.getCurrentLevel() as LevelMap;
				shaders.jungle(this.app.world);
				if (firstTry) {
					this.app.world.addChild(new LetsGoMessage(map.label), 101);
				}
				this.playLevelSong();
			},
		});
	}

	/** a short jingle, then the level (or boss) song */
	private playLevelSong() {
		const map = level.getCurrentLevel() as LevelMap;
		// the menu song was the track until now: the jingle plays alone
		audio.stopTrack();
		audio.play(map.boss ? "boss_start" : "level_start", false, () => {
			audio.playTrack(map.boss ? "boss_song" : "level_song");
		});
	}

	/** stop the music (stopping the jingle also cancels the song after it) */
	private stopLevelSong() {
		audio.stop("level_start");
		audio.stop("boss_start");
		audio.stopTrack();
	}

	override update(dt: number) {
		if (!this.gameOver && input.isKeyPressed("pause")) {
			// our own pause, not state.isPaused(): a hit-stop (state.freeze)
			// pauses the game too, for a few frames
			if (this.pauseMessage) {
				state.resume(true);
				this.resumeJingle(true);
				this.hidePause();
			} else {
				// end a hit-stop first, or the pause would do nothing and the
				// end of the hit-stop would resume the game under the panel
				if (state.isPaused()) {
					state.resume();
				}
				state.pause(true);
				this.resumeJingle(false);
				this.showPause("P OR START TO RESUME");
			}
		}
		if (input.isKeyPressed("quit")) {
			gameState.record();
			go(state.MENU);
		}
		return super.update(dt);
	}

	/** Alex just died: some sad music */
	onPlayerDying() {
		this.stopLevelSong();
		audio.play(gameState.lives > 0 ? "player_dies" : "game_over");
	}

	/** Alex fell out of the screen: try again, or game over */
	onPlayerDeath() {
		if (gameState.lives > 0) {
			pixelate(() => this.loadLevel(false));
		} else {
			this.gameOver = true;
			gameState.record();
			this.app.world.addChild(new GameOverMessage(() => go(state.MENU)), 101);
		}
	}

	/** @param hint - what brings the game back */
	private showPause(hint: string) {
		this.pauseMessage = new PauseMessage(hint);
		this.app.world.addChild(this.pauseMessage, 102);
	}

	private hidePause() {
		if (this.pauseMessage) {
			this.app.world.removeChild(this.pauseMessage);
			this.pauseMessage = undefined;
		}
		this.pausedByBlur = false;
	}

	/** the window lost the focus (a tab switch fires this twice) */
	private onBlur = () => {
		if (!this.pauseMessage && !this.gameOver) {
			this.showPause("CLICK TO RESUME");
			this.pausedByBlur = true;
		}
	};

	/** and got it back: the game resumes, unless P paused it */
	private onFocus = () => {
		if (this.pausedByBlur) {
			this.hidePause();
		}
	};

	/**
	 * the jingle before the level song is not the track, which is all that
	 * state.pause(true) pauses: it holds still too (and the song it starts
	 * once over waits)
	 */
	private resumeJingle(resume: boolean) {
		for (const name of ["level_start", "boss_start"]) {
			if (resume) {
				audio.resume(name);
			} else {
				audio.pause(name);
			}
		}
	}

	/** exit reached, or guardian defeated */
	onLevelComplete() {
		this.stopLevelSong();
		// through go(), so that it waits for a death reload behind the pixels
		go(state.READY);
	}

	override onDestroyEvent(app: Application) {
		event.off(event.BLUR, this.onBlur);
		event.off(event.FOCUS, this.onFocus);
		if (state.isPaused()) {
			state.resume();
		}
		if (this.hud) {
			app.world.removeChild(this.hud);
		}
		this.stopLevelSong();

		unbindPads(PLAY_PAD);
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
