/**
 * melonJS — Plinko (Planck) example: procedural sound effects.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Tiny WebAudio synth — no asset files, no loaders, no licensing.
 * Two cues:
 *   - peg clack: short percussive impulse with pitched variation per hit
 *     (heard 5-10× per drop, so the variation matters a lot — without it
 *     a flurry of pegs all sound like one continuous buzz)
 *   - score chime: tonal note whose pitch climbs with the slot tier so
 *     a 100-pointer reads louder/higher than a 2-pointer
 *
 * The AudioContext is created lazily on first use — browsers refuse to
 * play audio before a user gesture, and `createGameFn` runs at React
 * mount which is *not* a gesture. The first click on the DropZone is.
 */

let ctx: AudioContext | null = null;

const getCtx = (): AudioContext | null => {
	if (ctx) return ctx;
	const AudioCtor =
		globalThis.AudioContext ??
		(globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioCtor) return null;
	ctx = new AudioCtor();
	return ctx;
};

/**
 * Throttle so a single ball pinging two contacts in the same physics
 * tick doesn't double-trigger and clip — peg clacks within this window
 * are merged.
 */
const CLACK_THROTTLE_MS = 16;
let lastClackAt = 0;

/**
 * Short percussive impulse for peg hits. Sine carrier modulated by a
 * 5 ms exponential decay envelope.
 *
 * @param pan stereo position in `[-1, 1]` — left wall to right wall.
 *   Cones the clack across the soundfield so a flurry of hits also
 *   describes a path through the playfield, not just a smear of clicks.
 * @param pitchHint `0..1` from top row (0) to bottom row (1). When
 *   present the clack is pitched on a descending scale (top-row
 *   bounces ring high, bottom-row bounces ring low) so a single ball
 *   dropping through the field literally plays an arpeggio downward.
 *   Without the hint we fall back to small random jitter so multiple
 *   balls don't fuse into one continuous buzz.
 */
export const playClack = (pan = 0, pitchHint?: number): void => {
	const c = getCtx();
	if (!c) return;

	const now = c.currentTime * 1000;
	if (now - lastClackAt < CLACK_THROTTLE_MS) return;
	lastClackAt = now;

	const t = c.currentTime;
	// Top row (hint = 0) rings at 1400 Hz; bottom row (hint = 1) at
	// 700 Hz. No hint → random jitter in the same range.
	const freq =
		pitchHint !== undefined
			? 1400 - pitchHint * 700
			: 700 + Math.random() * 700;

	const osc = c.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(freq, t);
	// Slight downward pitch slide gives the clack a "wood block" feel
	// vs. a flat sine pulse.
	osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.08);

	const gain = c.createGain();
	gain.gain.setValueAtTime(0.08, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

	const panner = c.createStereoPanner();
	panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);

	osc.connect(gain).connect(panner).connect(c.destination);
	osc.start(t);
	osc.stop(t + 0.1);
};

/**
 * Tonal chime for slot landings. Two stacked sine partials (a fifth
 * apart) with longer decay; base pitch follows an A-minor pentatonic
 * ladder keyed on the slot's score, so the five slot tiers ring out
 * as `A4 / C5 / E5 / A5 / E6` — recognisable as a musical scale rather
 * than an arbitrary pitch table.
 *
 * @param score the slot's point value (drives base pitch)
 * @param pan stereo position in `[-1, 1]` — left slot pans left.
 */
export const playChime = (score: number, pan = 0): void => {
	const c = getCtx();
	if (!c) return;

	const t = c.currentTime;
	// Tier-based pitch on A-minor pentatonic: 2 → A4, 5 → C5,
	// 10 → E5, 30 → A5, 100 → E6.
	const base =
		score >= 100
			? 1320
			: score >= 30
				? 880
				: score >= 10
					? 659
					: score >= 5
						? 523
						: 440;

	// Fundamental.
	const osc1 = c.createOscillator();
	osc1.type = "sine";
	osc1.frequency.setValueAtTime(base, t);

	// Perfect fifth above for a richer "ping" rather than a flat sine.
	const osc2 = c.createOscillator();
	osc2.type = "sine";
	osc2.frequency.setValueAtTime(base * 1.5, t);

	const gain = c.createGain();
	gain.gain.setValueAtTime(0.18, t);
	gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

	const panner = c.createStereoPanner();
	panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);

	osc1.connect(gain);
	osc2.connect(gain);
	gain.connect(panner).connect(c.destination);

	osc1.start(t);
	osc2.start(t);
	osc1.stop(t + 0.4);
	osc2.stop(t + 0.4);
};
