/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import { LEVELS } from "./constants";

const SAVE_KEY = "melonjs.alex4.progress";

/** the player data that lives across levels */
export const gameState = {
	score: 0,
	lives: 2,
	health: 1,
	ammo: 0,
	/** index of the current level in LEVELS */
	level: 0,
	/** highest level reached, unlocks the level select */
	maxLevel: 0,
	/** per level pickup stats, for the level complete screen */
	cherries: 0,
	cherriesTotal: 0,
	stars: 0,
	starsTotal: 0,
	/** best score this session */
	hiscore: 0,
};

/** reset the player data for a new game starting at the given level */
export function newGame(level = 0) {
	gameState.score = 0;
	gameState.lives = 2;
	gameState.health = 1;
	gameState.ammo = 0;
	gameState.level = level;
}

/** load the saved progress (browser storage may be unavailable) */
export function loadProgress() {
	try {
		const saved = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY) ?? "{}");
		if (typeof saved.maxLevel === "number") {
			gameState.maxLevel = Math.min(saved.maxLevel, LEVELS.length - 1);
		}
		if (typeof saved.hiscore === "number") {
			gameState.hiscore = saved.hiscore;
		}
	} catch {
		// private mode or blocked storage: progress is just not remembered
	}
}

/** remember the level reached and the best score */
export function saveProgress() {
	gameState.maxLevel = Math.max(
		gameState.maxLevel,
		Math.min(gameState.level, LEVELS.length - 1),
	);
	gameState.hiscore = Math.max(gameState.hiscore, gameState.score);
	try {
		globalThis.localStorage.setItem(
			SAVE_KEY,
			JSON.stringify({
				maxLevel: gameState.maxLevel,
				hiscore: gameState.hiscore,
			}),
		);
	} catch {
		// ignore
	}
}
