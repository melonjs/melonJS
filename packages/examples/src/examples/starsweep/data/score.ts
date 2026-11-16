/**
 * melonJS — Starsweep: the best score, kept between visits.
 *
 * Stored with the engine's `save` (in `localStorage`), through the typed
 * handle `save.add()` returns, so it reads back as a number.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { save } from "melonjs";

let store: { starsweepHiscore: number } | null = null;

/** the saved scores, registered the first time they are needed */
const saved = () => {
	store ??= save.add({ starsweepHiscore: 0 });
	return store;
};

/** the best score so far */
export const loadHiscore = () => saved().starsweepHiscore;

/** keep a new best score */
export const saveHiscore = (score: number) => {
	saved().starsweepHiscore = score;
};

/** a score as the game shows it: six digits */
export const formatScore = (score: number) => score.toString().padStart(6, "0");
