/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { type Application, audio, level, Stage, state } from "melonjs";
import { LEVELS } from "../constants";
import { justPressed, syncControls } from "../controls";
import { gameState, saveProgress } from "../gameState";
import { PlayField } from "../play/field";
import { GameOverSign, HUD, LetsGo } from "../play/overlays";
import { resetSpawns, takeSpawns } from "../play/spawns";
import { playMusic, stopMusic } from "./music";

const FIELD_Z = 50;
const HUD_Z = 100;

export class PlayScreen extends Stage {
	private app: Application | undefined;
	private field: PlayField | undefined;
	private hud: HUD | undefined;
	private gameOver = false;

	override onResetEvent(app: Application) {
		this.app = app;
		this.gameOver = false;
		syncControls();
		this.loadLevel(true);
	}

	/** (re)load the current level */
	private loadLevel(showLetsGo: boolean) {
		const app = this.app;
		if (!app) return;
		resetSpawns();
		const name = LEVELS[gameState.level];
		level.load(name, {
			onLoaded: () => {
				const spawns = takeSpawns(app.world);
				const field = new PlayField(spawns);
				this.field = field;
				field.onAlexDies = () => this.onAlexDies();
				field.onDiedFallOver = () => this.onDiedFallOver();
				field.onLevelDone = () => this.onLevelDone();
				app.world.addChild(field, FIELD_Z);
				// draw the first frame from the right place
				app.viewport.moveTo(field.offsetX * 4, 0);

				this.hud = new HUD();
				app.world.addChild(this.hud, HUD_Z);

				const map = level.getCurrentLevel() as unknown as {
					label?: string;
					boss?: number;
				};
				if (showLetsGo) {
					app.world.addChild(new LetsGo(map.label ?? ""), HUD_Z + 1);
				}
				playMusic(map.boss ? "boss" : "level");
			},
		});
	}

	override update(dt: number) {
		const field = this.field;
		if (field && !this.gameOver) {
			if (justPressed("pause") && field.status === "playing") {
				field.paused = !field.paused;
				if (this.hud) this.hud.paused = field.paused;
			}
			if (justPressed("escape")) {
				stopMusic();
				saveProgress();
				state.change(state.MENU, false);
			}
		}
		return super.update(dt);
	}

	private onAlexDies() {
		stopMusic();
		audio.play(gameState.lives > 0 ? "player_dies" : "game_over");
	}

	private onDiedFallOver() {
		const app = this.app;
		if (!app) return;
		if (gameState.lives > 0) {
			// try again
			app.viewport.fadeIn("#dfedd2", 250, () => {
				gameState.ammo = 0;
				this.loadLevel(false);
				app.viewport.fadeOut("#dfedd2", 250);
			});
		} else {
			this.gameOver = true;
			saveProgress();
			app.world.addChild(
				new GameOverSign(() => {
					state.change(state.MENU, false);
				}),
				HUD_Z + 1,
			);
		}
	}

	private onLevelDone() {
		stopMusic();
		state.change(state.READY, false);
	}

	override onDestroyEvent() {
		this.field = undefined;
		this.hud = undefined;
		stopMusic();
	}
}
