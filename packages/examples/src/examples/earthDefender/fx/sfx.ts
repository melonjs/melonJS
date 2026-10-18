/**
 * Earth Defender's sound, generated at boot.
 *
 * Two different mechanisms here, and the split is deliberate.
 *
 * **Anything that happens AWAY from the player is a generated clip**, so it
 * can be PLACED. `audio.tone` / `audio.noise` reach a `StereoPanner` at most,
 * so they can be panned but not put somewhere in the world; only a loaded
 * clip goes through the panner node that the listener drives. Rather than
 * ship audio files for that, each clip is synthesised into a mono WAV and
 * handed to the loader as a `data:` URL, which `audio.load` takes as-is. The
 * listener is the camera (see `GameController.initUfo`), so a bomb going off
 * on the far limb arrives from over there, and the dome cracking behind the
 * craft arrives from behind.
 *
 * **Anything that happens AT the craft needs no placing.** The camera rides
 * just behind the ship, so the shield, the boost and the rest are already at
 * the listener; those use `audio.tone` / `audio.noise` directly, as the
 * AfterBurner showcase does. The GUN is the exception: it is a recorded clip,
 * because a blaster is a struck wire and the procedural one read as a toy.
 *
 * The synthesis is deliberately plain: shaped noise plus a swept partial or
 * two. It is a sound bed for a game example, not a synth engine.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 */
import { audio, input, math, type Renderable } from "melonjs";
import {
	HUNTER_LASER_RATE,
	HUNTER_LASER_VOLUME,
	LASER_SOUNDS,
	LASER_VOLUME,
	type Rumble,
} from "../constants";

/**
 * Mono, and 22.05 kHz rather than 44.1: these are noise bursts and low
 * booms with nothing above 10 kHz in them, so the higher rate would double
 * every buffer to encode band that is not there.
 */
const RATE = 22050;

/**
 * Deterministic noise.
 *
 * `Math.random` would give every run a slightly different set of clips,
 * which makes a sound regression impossible to tell from the dice. xorshift32
 * is four lines and repeats far beyond any buffer here.
 */
let _seed = 0x2545f491;
const rand = () => {
	_seed ^= _seed << 13;
	_seed ^= _seed >>> 17;
	_seed ^= _seed << 5;
	_seed |= 0;
	return (_seed >>> 0) / 0x80000000 - 1;
};

/** Run `voice` over `duration` seconds and collect the samples. */
const render = (duration: number, voice: (t: number) => number) => {
	const count = Math.max(1, Math.round(duration * RATE));
	const out = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		out[i] = voice(i / RATE);
	}
	return out;
};

/** 1 at the start, falling to about zero at `duration`. */
const decay = (t: number, duration: number, shape = 5) => {
	return Math.exp((-shape * t) / duration);
};

/** Short ramp in, so a burst starts rather than clicks. */
const onset = (t: number, time = 0.004) => Math.min(1, t / time);

/** Exponential glide from `from` to `to` Hz across `duration`. */
const glide = (t: number, duration: number, from: number, to: number) => {
	return from * (to / from) ** Math.min(1, t / duration);
};

/**
 * Phase accumulator for a swept oscillator.
 *
 * Sampling `sin(2π f(t) t)` is the obvious spelling and it is wrong: the
 * frequency is inside the phase, so a sweep lands an ever growing phase error
 * and the pitch comes out wrong in the second half. Integrating the frequency
 * instead is what makes a glide sound like one.
 */
const sweeper = (from: number, to: number, duration: number) => {
	let phase = 0;
	let last = 0;
	return (t: number) => {
		phase += 2 * Math.PI * glide(t, duration, from, to) * (t - last);
		last = t;
		return phase;
	};
};

/** Brown noise: low and rumbly, which is what a distant blast wants. */
const brown = () => {
	let last = 0;
	return () => {
		last = (last + 0.035 * rand()) / 1.035;
		return last * 6;
	};
};

/** A one-pole lowpass, for taking the fizz off a noise bed. */
const lowpass = (cutoff: number) => {
	const a = Math.min(1, (2 * Math.PI * cutoff) / RATE);
	let last = 0;
	return (sample: number) => {
		last += a * (sample - last);
		return last;
	};
};

/** Pack mono float samples into a 16-bit PCM WAV as a `data:` URL. */
const wav = (samples: Float32Array) => {
	const bytes = new ArrayBuffer(44 + samples.length * 2);
	const view = new DataView(bytes);
	const ascii = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) {
			view.setUint8(offset + i, text.charCodeAt(i));
		}
	};
	ascii(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	ascii(8, "WAVEfmt ");
	view.setUint32(16, 16, true); // PCM header length
	view.setUint16(20, 1, true); // PCM, uncompressed
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, RATE, true);
	view.setUint32(28, RATE * 2, true); // bytes per second
	view.setUint16(32, 2, true); // bytes per frame
	view.setUint16(34, 16, true); // bits per sample
	ascii(36, "data");
	view.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		// clamped: a sum of partials can overshoot, and wrapping an Int16
		// turns a loud moment into a burst of static
		const clamped = math.clamp(samples[i], -1, 1);
		view.setInt16(44 + i * 2, clamped * 0x7fff, true);
	}
	let binary = "";
	const raw = new Uint8Array(bytes);
	for (let i = 0; i < raw.length; i++) {
		binary += String.fromCharCode(raw[i]);
	}
	return `data:audio/wav;base64,${btoa(binary)}`;
};

/**
 * The clips that get placed in the world, by what they are FOR.
 *
 * The value is the loader's key, and it says which kind of clip it is: an
 * `earthDefender*` name is a recorded file from the Kenney pack, an `ed*` one
 * is synthesised below. Call sites only ever name the event, so a sound can
 * move from one to the other without them knowing.
 */
export const SFX = {
	/** a rock hit that did NOT break it */
	hit: "earthDefenderHit",
	/** the last of a rock, blown apart with nothing left behind */
	rockBurst: "earthDefenderRockBurst",
	/** a rock broken into pieces, which carry the moment on themselves */
	rockSplit: "earthDefenderRockSplit",
	/** a drifter shattered by the gun */
	iceShatter: "edIceShatter",
	/** a bomb going off on the dome */
	bombBlast: "edBombBlast",
	/** a bomb shot out of the air before it landed */
	bombDefuse: "edBombDefuse",
	/** a bomb leaving the saucer */
	bombDrop: "edBombDrop",
	/** one more fracture across a pane */
	paneCrack: "edPaneCrack",
	/** the pane letting go, and the run with it */
	paneShatter: "edPaneShatter",
} as const;

/** the ones that are files, for the preload manifest */
export const SFX_FILES = Object.values(SFX).filter((n) => {
	return n.startsWith("earthDefender");
});

/** Synthesis for each placed clip, built once on first use. */
const voices: Record<string, () => Float32Array> = {
	// bright and glassy: the noise is high-passed by subtracting its own
	// lowpass, and three inharmonic partials ring on underneath
	[SFX.iceShatter]: () => {
		const dull = lowpass(900);
		return render(0.45, (t) => {
			const n = rand();
			const crack = (n - dull(n)) * decay(t, 0.12, 9);
			const ring =
				Math.sin(2 * Math.PI * 2400 * t) * 0.5 +
				Math.sin(2 * Math.PI * 3170 * t) * 0.35 +
				Math.sin(2 * Math.PI * 4430 * t) * 0.2;
			return onset(t) * (crack * 0.5 + ring * 0.22 * decay(t, 0.45, 7));
		});
	},
	// the big one: longer, lower, and tailed by a lowpassed rumble so it
	// reads as a blast against the dome rather than a click
	[SFX.bombBlast]: () => {
		const rumble = brown();
		const muffle = lowpass(400);
		const body = sweeper(160, 38, 0.6);
		return render(0.9, (t) => {
			return (
				onset(t, 0.002) *
				(muffle(rumble()) * 0.85 * decay(t, 0.9, 4) +
					Math.sin(body(t)) * 0.45 * decay(t, 0.6, 5))
			);
		});
	},
	// cold and small: it has to land as an event without sounding like the
	// thing the player just prevented
	[SFX.bombDefuse]: () => {
		const dull = lowpass(1200);
		const chirp = sweeper(500, 1400, 0.12);
		return render(0.25, (t) => {
			const n = rand();
			return (
				onset(t, 0.002) *
				((n - dull(n)) * 0.3 * decay(t, 0.1, 10) +
					Math.sin(chirp(t)) * 0.18 * decay(t, 0.12, 6))
			);
		});
	},
	// a release, heard from wherever the saucer is
	[SFX.bombDrop]: () => {
		const fall = sweeper(900, 300, 0.22);
		return render(0.28, (t) => {
			return onset(t, 0.003) * Math.sin(fall(t)) * 0.3 * decay(t, 0.22, 4);
		});
	},
	// a tick with a short ring: one fracture, not a break
	[SFX.paneCrack]: () => {
		const dull = lowpass(1500);
		return render(0.3, (t) => {
			const n = rand();
			return (
				onset(t, 0.001) *
				((n - dull(n)) * 0.45 * decay(t, 0.05, 14) +
					Math.sin(2 * Math.PI * 1850 * t) * 0.2 * decay(t, 0.3, 8))
			);
		});
	},
	// the collapse: the crack sound stretched out, with the partials sliding
	// down as the pane comes apart
	[SFX.paneShatter]: () => {
		const dull = lowpass(700);
		const a = sweeper(2600, 900, 1.1);
		const b = sweeper(3400, 1500, 1.1);
		return render(1.2, (t) => {
			const n = rand();
			return (
				onset(t, 0.001) *
				((n - dull(n)) * 0.5 * decay(t, 1.0, 4) +
					(Math.sin(a(t)) * 0.25 + Math.sin(b(t)) * 0.18) * decay(t, 1.1, 5))
			);
		});
	},
};

/**
 * The placed clips, as loader entries.
 *
 * Generated here rather than shipped: the loader treats a `data:` URL as the
 * source verbatim, so these join the preload manifest like any other asset
 * and the loading bar covers them.
 */
export function sfxAssets() {
	return Object.keys(voices).map((name) => {
		return { name, type: "audio" as const, src: wav(voices[name]()) };
	});
}

/**
 * THE MIX, in one table.
 *
 * Every placed clip used to play at full scale, which was fine while the
 * distance falloff was swallowing them and far too loud once it was not. The
 * ordering is the point rather than the absolute numbers: a hit happens
 * several times a second and has to sit under everything, a rock coming apart
 * is the common reward, and the dome being breached is the loudest thing in
 * the game because it only ever happens once.
 *
 * Tune here. These are multiplied by the distance falloff, so a value is what
 * the sound is worth AT the listener, not what will be heard.
 */
const VOLUME: Record<string, number> = {
	[SFX.hit]: 0.26,
	[SFX.bombDrop]: 0.36,
	[SFX.bombDefuse]: 0.46,
	[SFX.iceShatter]: 0.48,
	[SFX.rockSplit]: 0.5,
	[SFX.paneCrack]: 0.6,
	[SFX.rockBurst]: 0.66,
	[SFX.bombBlast]: 0.84,
	[SFX.paneShatter]: 0.95,
};

/** Play a placed clip at a fixed point in the world. */
export function playAt(name: string, x: number, y: number, z: number): void {
	audio.play(name, { at: { x, y, z } }, null, VOLUME[name] ?? 0.5);
}

/**
 * Play a placed clip on something that moves, and stop it if that thing is
 * destroyed first.
 */
export function playOn(name: string, target: Renderable): void {
	audio.play(
		name,
		{ follow: target, stopWithTarget: true },
		null,
		VOLUME[name] ?? 0.5,
	);
}

// ── At the craft, where the listener already is ──────────────────────────

/**
 * The gun.
 *
 * A clip, not `audio.tone`: the synthesised one read as a toy, because a
 * blaster is a struck wire rather than a swept oscillator and the primitives
 * have no delay line to make one with. Five takes, and never the same one
 * twice in a row — an immediate repeat is the thing the ear catches.
 */
let _lastLaser = -1;
/** and the hunter's own, so the two guns do not pull from one another */
let _lastHunterLaser = -1;
export function playFire(): void {
	let pick = Math.floor(Math.random() * LASER_SOUNDS.length);
	if (pick === _lastLaser) {
		pick = (pick + 1) % LASER_SOUNDS.length;
	}
	_lastLaser = pick;
	audio.play(LASER_SOUNDS[pick], false, null, LASER_VOLUME);
}

/**
 * When the effect now playing ends, and how big it was.
 *
 * A rumble PREEMPTS whatever is already running on the pad, which is right
 * for a run of distinct hits and wrong when two events land in the same
 * instant. A bomb on the dome is both: it blows up AND cracks the pane it
 * landed on, three milliseconds apart. The blast asked for 260ms at 0.85 and
 * the crack replaced it with 110ms at 0.30, so the biggest event in the game
 * was felt as a weak buzz and the blast itself never played.
 *
 * So the bigger one wins. Size is magnitude times duration, which is near
 * enough to how much the hands feel.
 */
let rumbleEndsAt = 0;
let rumbleSize = 0;

/**
 * Send one effect to the pad, unless something bigger is still playing.
 * @param strong - heavy motor, 0 to 1
 * @param weak - light motor, 0 to 1
 * @param ms - duration
 */
function playRumble(strong: number, weak: number, ms: number): void {
	const now = globalThis.performance.now();
	const size = (strong + weak) * ms;
	// Only while the other one is still running: once it has finished there
	// is nothing to protect, and a small event after a big one should be felt.
	if (now < rumbleEndsAt && size < rumbleSize) {
		return;
	}
	rumbleEndsAt = now + ms;
	rumbleSize = size;
	void input.vibrateGamepad(input.activeGamepad(), {
		duration: Math.round(ms),
		strongMagnitude: strong,
		weakMagnitude: weak,
	});
}

/**
 * Shake the controller.
 *
 * One entry point for every rumble in the game, so the magnitudes all sit
 * together in {@link constants} and the call sites read as events rather than
 * as numbers.
 *
 * Sent to `input.activeGamepad()` rather than to slot 0. Slots are handed out
 * in plug order, so the pad the player is holding is whichever one they have
 * been pressing, and rumbling the wrong one is both useless and invisible in
 * testing.
 *
 * No check for a pad anywhere in the game: `vibrateGamepad` is a no-op with
 * nothing plugged in, on a pad without motors, and in a browser with no
 * Gamepad API at all. The promise is dropped deliberately: it reports whether
 * the effect finished, and nothing here would do anything different if it had
 * not.
 * @param effect - a {@link Rumble} triple from the constants
 * @param scale - 0 to 1, for an event whose size varies
 */
export function rumble(effect: Rumble, scale = 1): void {
	const [strong, weak, ms] = effect;
	playRumble(strong * scale, weak * scale, ms * scale);
}

/**
 * Rumble for something whose size varies, between two of the triples above.
 * @param small - the effect at `t` of 0
 * @param big - the effect at `t` of 1
 * @param t - 0 to 1
 */
export function rumbleBetween(small: Rumble, big: Rumble, t: number): void {
	const k = math.clamp(t, 0, 1);
	playRumble(
		small[0] + (big[0] - small[0]) * k,
		small[1] + (big[1] - small[1]) * k,
		small[2] + (big[2] - small[2]) * k,
	);
}

/** The shield taking one. Hard front, short metallic tail. */
export function playShieldHit(): void {
	audio.noise({
		type: "white",
		duration: 0.08,
		gain: 0.19,
		attack: 0.001,
		filter: { type: "bandpass", frequency: 900, Q: 0.8 },
		filterSweep: 0.4,
	});
	audio.tone({
		freq: [320, 470],
		duration: 0.3,
		wave: "triangle",
		gain: 0.12,
		pitchSlide: 0.7,
	});
}

/**
 * The hunter's gun: the player's own samples, pitched down.
 *
 * Same five files rather than a sound of its own, because they are the only
 * two guns in the game and they should be the same KIND of thing. The rate is
 * what separates them, and it has to, since the hunter fires far more often
 * than the player and its shots arrive from off screen: see
 * {@link HUNTER_LASER_RATE}.
 *
 * The rate is set on the returned voice rather than on the sound, which would
 * pitch the player's own gun down with it.
 */
export function playHunterFire(): void {
	let pick = Math.floor(Math.random() * LASER_SOUNDS.length);
	if (pick === _lastHunterLaser) {
		pick = (pick + 1) % LASER_SOUNDS.length;
	}
	_lastHunterLaser = pick;
	const name = LASER_SOUNDS[pick];
	const id = audio.play(name, false, null, LASER_VOLUME * HUNTER_LASER_VOLUME);
	if (typeof id === "number") {
		audio.rate(name, HUNTER_LASER_RATE, id);
	}
}

/**
 * A bolt landing on the hunter.
 *
 * Its own sound, and deliberately not {@link playShieldHit}, which is the
 * player's. The two happen in the same fight and often in the same second, so
 * the one piece of information the ear needs is whose shield just took it:
 * this one sits an octave up and ends clean, where the player's drops into a
 * low tail.
 *
 * Positional would be better in principle and worse in practice. The hunter
 * is a long way off across the globe, and the spatial path rolls a source
 * that far away down to almost nothing, which is how the previous one got
 * lost. A hit the player scored is feedback about THEIR input, so it belongs
 * at the front of the mix like the gun does.
 * @param shielded - true while the shell is still up, false on the bare hull
 */
export function playHunterHit(shielded: boolean): void {
	if (shielded) {
		// bright and glassy: energy stopping a bolt
		audio.noise({
			type: "white",
			duration: 0.07,
			gain: 0.17,
			attack: 0.001,
			filter: { type: "bandpass", frequency: 2600, Q: 1.4 },
			filterSweep: 1.8,
		});
		audio.tone({
			freq: [880, 1320],
			duration: 0.16,
			wave: "triangle",
			gain: 0.1,
			pitchSlide: 0.6,
		});
		return;
	}
	// the shell is down and this is metal: harder, lower, no ring
	audio.noise({
		type: "white",
		duration: 0.05,
		gain: 0.2,
		attack: 0.001,
		filter: { type: "bandpass", frequency: 1400, Q: 0.9 },
		filterSweep: 0.35,
	});
	audio.tone({
		freq: [240, 170],
		duration: 0.12,
		wave: "square",
		gain: 0.09,
		pitchSlide: 0.5,
	});
}

/** Boost lighting up: a rising breath, no pitch to fight the engine drone. */
export function playBoost(): void {
	audio.noise({
		type: "pink",
		duration: 0.45,
		gain: 0.12,
		attack: 0.12,
		filter: { type: "lowpass", frequency: 700, Q: 0.5 },
		filterSweep: 2.4,
	});
}

/** Heat about to cut the boost out. Two short pips, on the audio clock. */
export function playOverheat(): void {
	audio.tone({ freq: 880, duration: 0.07, wave: "square", gain: 0.07 });
	audio.tone({
		freq: 660,
		duration: 0.09,
		wave: "square",
		gain: 0.07,
		delay: 0.1,
	});
}

/**
 * The spread gun arriving.
 *
 * A rising three-note arpeggio on a square wave: the one bright, musical
 * thing in a game otherwise made of impacts and noise, so a prize cannot be
 * mistaken for something going wrong. Scheduled on the audio clock through
 * `delay` rather than with timers, so the three land evenly however busy the
 * frame is.
 */
export function playUpgrade(): void {
	[523.25, 659.25, 880].forEach((freq, i) => {
		audio.tone({
			freq,
			duration: i === 2 ? 0.3 : 0.1,
			wave: "square",
			gain: 0.075,
			delay: i * 0.075,
		});
	});
}

/** The other prize. The same idea, two notes and lower: a smaller event. */
export function playMultiplierUp(): void {
	audio.tone({ freq: 392, duration: 0.09, wave: "triangle", gain: 0.1 });
	audio.tone({
		freq: 587.33,
		duration: 0.22,
		wave: "triangle",
		gain: 0.1,
		delay: 0.085,
	});
}

/** The saucer arriving. A warning, not a hit: slow, low, and two-note. */
export function playRaidWarning(): void {
	audio.tone({ freq: 196, duration: 0.5, wave: "sawtooth", gain: 0.08 });
	audio.tone({
		freq: 165,
		duration: 0.7,
		wave: "sawtooth",
		gain: 0.08,
		delay: 0.42,
	});
}

/** The end of the run. Long, falling, and the last thing heard. */
export function playGameOver(): void {
	audio.tone({
		freq: [220, 110],
		duration: 1.6,
		wave: "sawtooth",
		gain: 0.14,
		pitchSlide: 0.35,
	});
	audio.noise({
		type: "brown",
		duration: 1.8,
		gain: 0.12,
		attack: 0.02,
		filter: { type: "lowpass", frequency: 500, Q: 0.4 },
		filterSweep: 0.3,
	});
}
