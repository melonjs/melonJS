/**
 * melonJS — Plinko (Planck) example: scoring slot sensor + visual.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Each slot at the bottom of the play field is one big rectangular
 * **sensor** body — collisions fire `onCollisionStart` but the body
 * doesn't push the ball away, so the ball just falls in. The sensor
 * scores the ball, marks it for removal, and pulses its own visual
 * to confirm the landing.
 *
 * Slots are implemented as a `Container` so the score number is its
 * own `Text` child renderable — no raw Canvas2D context calls anywhere.
 */

import {
	Container,
	collision,
	Rect,
	Renderable,
	type Renderer,
	Text,
	timer,
} from "melonjs";
import { playChime } from "../audio";
import {
	COLOR_HORIZON_HI,
	PLAY_LEFT,
	PLAY_RIGHT,
	PLAY_W,
	SLOT_COLORS,
	SLOT_COUNT,
	SLOT_HEIGHT,
	SLOT_SCORES,
	SLOT_TOP,
	VIEWPORT_W,
} from "../constants";
import { gameState, refundForScore } from "../gameState";
import { ScoreFly } from "./scoreFly";
import { spawnSparkBurst } from "./sparkBurst";

/** Pulse duration after a ball lands (ms). Drives the brighten + score popup. */
const SLOT_PULSE_MS = 600;

/**
 * Map a slot's `score` value to the colour-tier index used in `SLOT_COLORS`.
 * Higher scores get hotter colours — magenta → orange → yellow → white.
 * @param score the slot's point value
 */
const tierForScore = (score: number): number => {
	if (score >= 100) return 4;
	if (score >= 30) return 3;
	if (score >= 10) return 2;
	if (score >= 5) return 1;
	return 0;
};

/**
 * The painted bin half of a slot — gradient fill (built via the
 * renderer's native `createLinearGradient`) + top stripe + edge
 * highlight. Lives as a child of `Slot` (which carries the body) so
 * the `Text` label can sit on top without inheriting transform tricks.
 *
 * The gradient is created lazily on first draw because the renderer
 * isn't available at constructor time (it lives on `video.renderer`
 * after `video.init`, which the example bootstrap calls *before* the
 * state machine spins up the PlayScreen — but constructors run during
 * `state.set`, which is the same call that starts the boot). Lazy
 * construction sidesteps the ordering question entirely.
 */
/**
 * The painted bin half of a slot. The BASE appearance (vertical fill
 * gradient + tier band + edge highlight) is pre-rendered into
 * `BakedStatics` once at scene init — see `bakedStatics.ts:bakeSlotBins`.
 * Per-frame, this `draw` only renders the TRANSIENT pulse overlay (a
 * single white rect with animated alpha) for ~600 ms after a ball
 * lands. Most frames bail in the first 3 lines, paying ~zero per-slot
 * cost (was 3 fillRects × 9 slots = 27 draws/frame).
 */
class SlotBin extends Renderable {
	private readonly color: string;
	private readonly pulseAtRef: { value: number };

	constructor(
		w: number,
		h: number,
		color: string,
		pulseAtRef: { value: number },
	) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.color = color;
		this.pulseAtRef = pulseAtRef;
	}

	override draw(renderer: Renderer): void {
		const elapsed = timer.getTime() - this.pulseAtRef.value;
		if (elapsed >= SLOT_PULSE_MS) return;
		const w = this.width;
		const h = this.height;
		const t = Math.max(0, 1 - elapsed / SLOT_PULSE_MS);

		// Pulse-only overlay — bright white wash that fades back to
		// the baked appearance over SLOT_PULSE_MS. Single rect,
		// alpha-modulated. Tier-band and edge highlight pulse via the
		// same overlay since it covers the whole bin.
		renderer.save();
		renderer.setGlobalAlpha(0.3 * t);
		renderer.setColor("#ffffff");
		renderer.fillRect(0, 0, w, h);
		renderer.restore();

		// Hot edge punch — same idea but concentrated at the top so
		// the tier band brightens during the pulse.
		renderer.save();
		renderer.setGlobalAlpha(0.5 * t);
		renderer.setColor(this.color);
		renderer.fillRect(0, 0, w, 4 + t * 2);
		renderer.restore();
	}
}

export class Slot extends Container {
	readonly score: number;
	/** Tier colour (slot fill + spark tint + score-fly text colour). */
	readonly color: string;
	/** Boxed so SlotBin can read the latest value each frame. */
	private readonly pulseAtRef = { value: -Infinity };

	constructor(x: number, y: number, w: number, h: number, score: number) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.score = score;
		this.color = SLOT_COLORS[tierForScore(score)];
		const color = this.color;

		// Slot itself carries the body — sensor rectangle covering
		// the whole slot footprint.
		this.bodyDef = {
			type: "static",
			shapes: [new Rect(0, 0, w, h)],
			collisionType: collision.types.WORLD_SHAPE,
			collisionMask: collision.types.ALL_OBJECT,
			isSensor: true,
		};

		// Visual bin (procedural rectangles).
		this.addChild(new SlotBin(w, h, color, this.pulseAtRef));

		// Score number — engine-native Text renderable. Centered in
		// the bin. Font size scales with slot width so all 9 slots
		// read at similar weight regardless of viewport scaling.
		const fontSize = Math.max(14, Math.min(28, w * 0.35));
		const label = new Text(w / 2, h / 2 + 4, {
			font: "Courier New",
			size: fontSize,
			fillStyle: "#ffffff",
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: String(score),
		});
		label.depth = 1;
		this.addChild(label);
	}

	/**
	 * Called from the Ball when it lands in this slot. Spawns the
	 * spark burst + flying score popup; the popup applies the score
	 * to `gameState` on landing (so the counter increments only when
	 * the fly visually reaches it, not on slot entry).
	 */
	collect(): void {
		this.pulseAtRef.value = timer.getTime();

		// Walk up to find the world container — both effects attach
		// there so they aren't transformed by this slot's frame and
		// can travel into the HUD's coordinate space.
		let world: Container | null = this.ancestor as Container | null;
		while (world?.ancestor) {
			world = world.ancestor as Container;
		}
		if (!world) return;

		// Slot centre + slightly-above-top in world coords.
		const slotW = PLAY_W / SLOT_COUNT;
		const cx = this.pos.x + slotW / 2;
		const cy = this.pos.y + SLOT_HEIGHT / 2;

		// Slot centre x → pan in [-1, 1] across the play area; left
		// slots ring on the left, right slots on the right.
		playChime(this.score, ((cx - PLAY_LEFT) / PLAY_W) * 2 - 1);

		// Spark burst at the slot top. Particle count + speed scale
		// with score tier so a 100-pointer feels meaningfully bigger
		// than a 2-pointer. Tint matches the slot's tier colour for
		// visual unity.
		const tier = tierForScore(this.score);
		const sparkCount = 8 + tier * 3; // 8 → 20
		const sparkSpeed = 3 + tier * 0.8; // 3 → 6.2
		spawnSparkBurst(world, cx, this.pos.y, sparkCount, this.color, sparkSpeed);

		// Score-fly target = approximate centre of the HUD's "SCORE N"
		// text (top-right corner of the HUD band). HUD is floating so
		// it renders in screen space, but the playfield uses no camera
		// scroll → world == screen for this example.
		const scoreTargetX = PLAY_RIGHT - 70;
		const scoreTargetY = 24;
		// Bigger font for bigger scores — sells the payout.
		const scoreFontSize = 22 + tier * 4; // 22 → 38
		world.addChild(
			new ScoreFly(
				cx,
				cy,
				scoreTargetX,
				scoreTargetY,
				this.score,
				this.color,
				scoreFontSize,
				(value) => {
					gameState.score += value;
					gameState.lastSlotScore = value;
					gameState.lastSlotAt = timer.getTime();
				},
			),
			200,
		);

		// Credit-fly — only when the slot actually refunds (tiers 3+).
		// Targets the centred CREDITS counter (`VIEWPORT_W / 2, 24`)
		// in magenta so it visually belongs to the magenta counter it
		// lands on. Smaller font than the score-fly because refunds
		// are small numbers (+1 / +2).
		const refund = refundForScore(this.score);
		if (refund > 0) {
			world.addChild(
				new ScoreFly(
					cx,
					cy,
					VIEWPORT_W / 2,
					24,
					refund,
					COLOR_HORIZON_HI,
					20 + tier * 2, // 20 → 28
					(value) => {
						gameState.credits += value;
						gameState.lastCreditAt = timer.getTime();
					},
				),
				200,
			);
		}
	}
}

/**
 * Build the row of scoring slots at the bottom of the play field.
 * One sensor body per slot, scores from `SLOT_SCORES`. Slots evenly
 * partition the horizontal play area; if `SLOT_SCORES.length` doesn't
 * match `SLOT_COUNT`, the array is sampled with wrap-around.
 */
export const buildSlots = (): Slot[] => {
	const slots: Slot[] = [];
	const slotWidth = (PLAY_RIGHT - PLAY_LEFT) / SLOT_COUNT;
	for (let i = 0; i < SLOT_COUNT; i++) {
		const x = PLAY_LEFT + i * slotWidth;
		const score = SLOT_SCORES[i % SLOT_SCORES.length];
		slots.push(new Slot(x, SLOT_TOP, slotWidth, SLOT_HEIGHT, score));
	}
	return slots;
};
