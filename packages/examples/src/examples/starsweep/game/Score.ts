/**
 * melonJS — Starsweep: the score, the lives, and what each thing is worth.
 *
 * Points for every panel lit, monster popped or dropped, gem and second
 * under a level's par; the lives, lost to a monster or a fall and won back
 * with a heart; the streak of panels lit in quick succession, whose chime
 * climbs a note at a time; and the best score, kept between visits
 * (`data/score.ts`).
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { loadHiscore, saveHiscore } from "../data/score";

/** lives at the start of a run */
const START_LIVES = 3;
/** the most lives Bolt can have */
export const MAX_LIVES = 6;
/** points for a panel lit, and for a gem */
const PAINT_POINTS = 10;
const GEM_POINTS = 500;
/** points for each second a level is cleared under its par */
const TIME_BONUS = 25;
/** a monster that falls off is worth this many times its score */
const FALL_BONUS = 2;
/** a streak of panels keeps going if the next comes within this, in seconds */
const STREAK_WINDOW = 0.5;

/** The run's score and lives. */
export class Score {
	/** points so far this run */
	points = 0;
	/** the best score, this run's included */
	best = loadHiscore();
	lives = START_LIVES;
	/** panels lit in a row, each within the streak window of the last */
	streak = 0;
	private streakTimer = 0;
	/** seconds spent on this level, for the time bonus */
	private levelTime = 0;

	/** a new run: no points, and a fresh set of lives */
	newRun() {
		this.points = 0;
		this.lives = START_LIVES;
	}

	/** a new level: its clock starts */
	newLevel() {
		this.levelTime = 0;
		this.streak = 0;
	}

	/**
	 * Count a step of play: the level's clock runs, and a streak not kept up
	 * ends.
	 * @param dt - seconds
	 */
	update(dt: number) {
		this.levelTime += dt;
		this.streakTimer -= dt;
		if (this.streakTimer <= 0) {
			this.streak = 0;
		}
	}

	/** add points, and keep the best score */
	add(points: number) {
		this.points += points;
		if (this.points > this.best) {
			this.best = this.points;
			saveHiscore(this.best);
		}
	}

	/** a panel lit: points, and the streak goes on */
	panelLit() {
		this.add(PAINT_POINTS);
		this.streak++;
		this.streakTimer = STREAK_WINDOW;
	}

	/** a monster popped: its points */
	popped(points: number) {
		this.add(points);
	}

	/** a monster fell off: more than popping it */
	fell(points: number) {
		this.add(points * FALL_BONUS);
	}

	/** a gem picked up */
	gem() {
		this.add(GEM_POINTS);
	}

	/** whether a heart may turn up: a life is missing */
	get wantsLife() {
		return this.lives < MAX_LIVES;
	}

	/** a heart picked up: a life back, up to the most */
	gainLife() {
		this.lives = Math.min(MAX_LIVES, this.lives + 1);
	}

	/** Bolt was caught, or fell: a life gone, and the streak with it */
	loseLife() {
		this.lives--;
		this.streak = 0;
	}

	/** whether the run is over */
	get out() {
		return this.lives <= 0;
	}

	/**
	 * A level cleared: points for each second under its par.
	 * @param par - the level's par, in seconds
	 * @returns the bonus
	 */
	levelBonus(par: number) {
		const bonus = Math.max(0, Math.round(par - this.levelTime)) * TIME_BONUS;
		this.add(bonus);
		return bonus;
	}
}
