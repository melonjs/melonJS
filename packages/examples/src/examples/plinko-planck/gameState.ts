/**
 * melonJS — Plinko (Planck) example: shared game state.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Single mutable object shared between entities. Plinko has no level
 * progression — just a running score, a tally of dropped balls, and a
 * credit pool that gates drops — so a singleton beats threading state
 * through entity constructors.
 */

/** Starting credit pool. Each ball drop costs one; high-tier slots refund. */
export const STARTING_CREDITS = 20;

export const gameState = {
	/** Cumulative score across all dropped balls. */
	score: 0,
	/** Total balls released (for the HUD's "balls" counter). */
	dropped: 0,
	/** Remaining drops. Hits zero → game-over (DropZone gates clicks). */
	credits: STARTING_CREDITS,
	/** Most recent slot score, pulsed in the HUD for ~1s after landing. */
	lastSlotScore: 0,
	/** Timestamp (ms) of the last score-fly landing — drives SCORE pulse. */
	lastSlotAt: 0,
	/** Timestamp (ms) of the last credit-fly landing — drives CREDITS pulse. */
	lastCreditAt: 0,
};

/** Reset all counters; called when the PlayScreen mounts and on restart. */
export const resetGameState = (): void => {
	gameState.score = 0;
	gameState.dropped = 0;
	gameState.credits = STARTING_CREDITS;
	gameState.lastSlotScore = 0;
	gameState.lastSlotAt = 0;
	gameState.lastCreditAt = 0;
};

/**
 * Credits refunded when a ball lands in a slot worth `score` points.
 * Tuning is intentionally stingy in the middle — corner slots (100 pts)
 * pay back +2, mid-corners (30 pts) break even, everything else burns
 * a credit. Players have to aim for the edges to keep playing.
 */
export const refundForScore = (score: number): number => {
	if (score >= 100) return 2;
	if (score >= 30) return 1;
	return 0;
};
