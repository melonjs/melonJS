/**
 * melonJS — Isometric Dungeon example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { audio, math } from "melonjs";

export const SFX = {
	steps: [
		"dungeonStep0",
		"dungeonStep1",
		"dungeonStep2",
		"dungeonStep3",
		"dungeonStep4",
	],
	door: "dungeonDoor",
	creak: "dungeonCreak",
	latch: "dungeonLatch",
	coins: "dungeonCoins",
	locked: "dungeonLocked",
	gate: "dungeonGate",
	gateCreak: "dungeonGateCreak",
	ambience: "dungeonAmbience",
};

// The ambience is a 12 s loop. The track loops on a region of exactly that
// length, so it has no gap even where the decoded MP3 is longer: an MP3
// encoder pads the end of its file, and Safari plays that padding
const AMBIENCE: Record<string, [number, number]> = { loop: [0, 12000] };

export function soundResources(base: string) {
	const clips = [
		...SFX.steps,
		SFX.door,
		SFX.creak,
		SFX.latch,
		SFX.coins,
		SFX.locked,
		SFX.gate,
		SFX.gateCreak,
	];
	return [
		...clips.map((name) => {
			return { name, type: "audio" as const, src: base };
		}),
		{ name: SFX.ambience, type: "audio" as const, src: base, sprite: AMBIENCE },
	];
}

// positional sound, see audio.setListener() in PlayStage
export function playAt(name: string, x: number, y: number, volume = 1) {
	return audio.play(name, { at: { x, y }, volume });
}

let lastStep = -1;
// random footstep, never the same one twice in a row
export function footstep() {
	let next = math.random(0, SFX.steps.length);
	if (next === lastStep) {
		next = (next + 1) % SFX.steps.length;
	}
	lastStep = next;
	audio.play(SFX.steps[next], false, null, 0.28);
}
