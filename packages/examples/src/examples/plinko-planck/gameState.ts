/**
 * melonJS — Plinko (Planck) example: shared game state.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Single mutable object shared between entities. Plinko has no level
 * progression — just a running score, a tally of dropped balls, a
 * credit pool that gates drops, and an optional per-drop wager on a
 * slot prediction (see `BetState`). A singleton beats threading state
 * through entity constructors.
 */

/** Starting credit pool. Each ball drop costs one; high-tier slots refund. */
export const STARTING_CREDITS = 20;

/** Credits paid per bet click. */
export const WAGER_PER_CLICK = 1;
/**
 * Hard cap on the wager stacked on a single slot. Five clicks gives a
 * 6× total payout (base + 5× wager bonus) on the corner 100-slot — a
 * +600 windfall — without letting the player dump their entire pool
 * into a single bet.
 */
export const MAX_BET_WAGER = 5;

export interface BetState {
	/** Slot index (0..SLOT_COUNT-1) the player has wagered on. */
	slotIndex: number;
	/** Stacked wager in credits (1..MAX_BET_WAGER). */
	wager: number;
}

/**
 * A "this just happened" event that drives a transient slot flash —
 * one for wins and one for busts. Bundled (rather than two parallel
 * `at` / `slotIndex` fields per event) so setting or clearing one
 * field without the other is impossible by construction.
 */
export interface BetEvent {
	/** Timestamp (ms) the event fired — drives the flash decay curve. */
	at: number;
	/** Slot index the flash targets (the bet slot, win or bust). */
	slotIndex: number;
}

export const gameState = {
	/** Cumulative score across all dropped balls. */
	score: 0,
	/** Total balls released (for the HUD's "balls" counter). */
	dropped: 0,
	/**
	 * Number of `Ball` entities currently attached to the world.
	 * Incremented in `Ball.onActivateEvent`, decremented in
	 * `onDeactivateEvent` — gives the HUD / slots / DropZone an O(1)
	 * "is the playfield drained?" check (`activeBalls === 0`) without
	 * walking the world's child list each frame.
	 */
	activeBalls: 0,
	/** Remaining drops. Hits zero → game-over (DropZone gates clicks). */
	credits: STARTING_CREDITS,
	/** Most recent slot score, pulsed in the HUD for ~1s after landing. */
	lastSlotScore: 0,
	/** Timestamp (ms) of the last score-fly landing — drives SCORE pulse. */
	lastSlotAt: 0,
	/** Timestamp (ms) of the last credit-fly landing — drives CREDITS pulse. */
	lastCreditAt: 0,
	/**
	 * Active wager on a slot prediction, or `null` if none. Settled on
	 * the FIRST ball landing — see `Slot.collect`. Clicking a different
	 * slot before settlement refunds the prior wager in full.
	 */
	bet: null as BetState | null,
	/**
	 * Most recent bet-loss event ("bust") — drives the red-tinged
	 * failure flash on the bet slot. `null` once the flash has been
	 * shown; never re-cleared explicitly because the consumers compare
	 * `now - at < BET_RESULT_PULSE_MS` and stop drawing on their own.
	 */
	lastBust: null as BetEvent | null,
	/**
	 * Most recent bet-win event — drives the gold celebration flash
	 * on the winning slot. Same shape + lifecycle as `lastBust`.
	 */
	lastWin: null as BetEvent | null,
};

/** Reset all counters; called when the PlayScreen mounts and on restart. */
export const resetGameState = (): void => {
	gameState.score = 0;
	gameState.dropped = 0;
	gameState.activeBalls = 0;
	gameState.credits = STARTING_CREDITS;
	gameState.lastSlotScore = 0;
	gameState.lastSlotAt = 0;
	gameState.lastCreditAt = 0;
	gameState.bet = null;
	gameState.lastBust = null;
	gameState.lastWin = null;
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

/**
 * Apply a click on the given slot to the current wager. Returns the
 * NEW wager amount (1..MAX_BET_WAGER) if the click was accepted, or
 * `null` if rejected (out of credits, or stacking on a slot already
 * at MAX_BET_WAGER). Returning the wager lets the caller skip the
 * `gameState.bet!.wager` read-back — the contract is "the wager that
 * is now active on `slotIndex`."
 *
 * - No existing bet: opens a new wager on `slotIndex` (wager=1).
 * - Existing bet on the SAME slot: increments wager (up to cap).
 * - Existing bet on a DIFFERENT slot: the prior wager is REFUNDED in
 *   full and a fresh wager opens on the new slot. Lets the player
 *   change their mind without burning credits — the only way to lose
 *   wager is to let a ball land on a non-bet slot.
 */
export const placeBetClick = (slotIndex: number): number | null => {
	if (gameState.credits <= 0) return null;
	const existing = gameState.bet;
	let newWager: number;
	if (existing && existing.slotIndex === slotIndex) {
		if (existing.wager >= MAX_BET_WAGER) return null;
		existing.wager += 1;
		newWager = existing.wager;
	} else {
		// Switching slots — refund the prior wager before opening the
		// new one. Net cost of switching is `WAGER_PER_CLICK` (the new
		// bet's first click), not `WAGER_PER_CLICK - existing.wager`.
		if (existing) {
			gameState.credits += existing.wager;
		}
		gameState.bet = { slotIndex, wager: 1 };
		newWager = 1;
	}
	gameState.credits -= WAGER_PER_CLICK;
	return newWager;
};
