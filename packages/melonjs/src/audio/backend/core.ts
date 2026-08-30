/**
 * Constructs the singleton engine instance and re-exports the core types.
 *
 * Split from `index.ts` so `voice.ts` and `sound.ts` can reach the singleton
 * without importing the public barrel, which would be a cycle.
 */
import { AudioEngine } from "./engine.ts";
import { Sound } from "./sound.ts";
import type { SpatialAudioEngine } from "./spatial.ts";
import { Voice } from "./voice.ts";

/**
 * The global audio controller singleton.
 *
 * Upstream shipped spatial audio as an opt-in plugin behind a registry. There
 * was only ever one plugin, so the registry was pure indirection: spatial is
 * installed directly by the engine constructor and the singleton is typed
 * `SpatialAudioEngine`.
 */
const audioEngine = new AudioEngine() as SpatialAudioEngine;

export { cache } from "./cache.ts";
export type {
	AudioBufferSourceNodeWithLegacy,
	EventListener,
	GainNodeWithBufferSource,
	HTMLAudioElementWithUnlocked,
	QueueItem,
	SoundOptions,
	WindowWithAudio,
} from "./types.ts";
export { isGainNode, isHTMLAudioElement } from "./types.ts";
export { AudioEngine, audioEngine, Sound, Voice };
