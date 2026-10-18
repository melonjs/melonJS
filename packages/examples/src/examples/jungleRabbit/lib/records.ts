/**
 * melonJS — Jungle Rabbit: the persisted best run.
 *
 * `save.add()` hands back the namespace typed with the keys it just
 * registered, so the records are read and written without a cast.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { save } from "melonjs";

/** the typed handle, set by `initRecords` */
let store: ReturnType<typeof register> | undefined;

const register = () => {
	return save.add({ jungleRabbitBestScore: 0, jungleRabbitBestMetres: 0 });
};

/** register the keys; existing values survive, missing ones take the default */
export const initRecords = () => {
	store ??= register();
};

export const bestScore = () => store?.jungleRabbitBestScore ?? 0;
export const bestMetres = () => store?.jungleRabbitBestMetres ?? 0;

/**
 * Fold a finished run into the record.
 * @param score - carrots collected this run
 * @param metres - distance travelled this run
 * @returns true when either half is a new best, so the caller can say so
 */
export const submitRun = (score: number, metres: number) => {
	const s = store ?? register();
	const beat =
		score > s.jungleRabbitBestScore || metres > s.jungleRabbitBestMetres;
	// each half stands alone: a short run with a lot of carrots should not
	// erase a long one, and vice versa
	s.jungleRabbitBestScore = Math.max(s.jungleRabbitBestScore, score);
	s.jungleRabbitBestMetres = Math.max(s.jungleRabbitBestMetres, metres);
	return beat;
};
