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
 * Slots are also the **bet targets**: clicking a slot stakes one
 * credit on the prediction that the next ball will land there.
 * Repeated clicks on the same slot stack the wager (capped at
 * `MAX_BET_WAGER`). When the next ball lands the bet is settled:
 *
 *   - In the bet slot → score += slot_score × (1 + wager). Big win flash.
 *   - In any other slot → wager is lost; bust flash on the bet slot.
 *
 * The bet is also cleared on settlement (one wager per drop window).
 * Clicking a *different* slot before settlement refunds the prior
 * wager in full — the only way to lose wager is to let a ball land
 * on a non-bet slot. See `gameState.placeBetClick`.
 *
 * Implemented as a `Container` so the score `Text` and the dynamic
 * bet/idle/bust labels can sit on top of the painted bin without
 * inheriting transform tricks.
 */

import type { Pointer } from "melonjs";
import {
	Container,
	collision,
	input,
	Rect,
	Renderable,
	type Renderer,
	Text,
	timer,
} from "melonjs";
import { playBetClick, playBust, playChime, playWin } from "../audio";
import {
	BET_RESULT_PULSE_MS,
	COLOR_BALL,
	COLOR_HORIZON_HI,
	IDLE_BREATHE_MS,
	PLAY_LEFT,
	PLAY_RIGHT,
	PLAY_W,
	SLOT_COLORS,
	SLOT_COUNT,
	SLOT_HEIGHT,
	SLOT_PULSE_MS,
	SLOT_SCORES,
	SLOT_TOP,
	tierForScore,
	VIEWPORT_W,
} from "../constants";
import {
	type BetState,
	gameState,
	placeBetClick,
	refundForScore,
} from "../gameState";
import { hasActiveBalls } from "./ball";
import { ScoreFly } from "./scoreFly";
import { spawnSparkBurst } from "./sparkBurst";
import { findWorld } from "./util";
import { WinFlash } from "./winFlash";

/**
 * The painted bin half of a slot. The BASE appearance (vertical fill
 * gradient + tier band + edge highlight) is pre-rendered into
 * `BakedStatics` once at scene init — see `bakedStatics.ts:bakeSlotBins`.
 * Per-frame, this `draw` only renders TRANSIENT state:
 *
 *   - the post-landing pulse overlay (~600 ms after a ball lands),
 *   - the gentle always-on "I'm clickable" breathing glow at the top,
 *   - the bright bet-active outline when this slot carries the wager,
 *   - the bust flash when a ball landed elsewhere with this slot as
 *     the bet target,
 *   - the win flash when a ball landed here AND this slot was bet.
 *
 * All of these are alpha-modulated rects/strokes — cheap, batches well.
 */
class SlotBin extends Renderable {
	private readonly color: string;
	private readonly index: number;
	private readonly pulseAtRef: { value: number };
	/**
	 * Shared "betting locked" flag, written by the parent Slot's
	 * `update()` each frame from its own `hasActiveBalls()` check.
	 * Boxed in a ref so SlotBin sees the latest value without a
	 * back-pointer to the Slot.
	 */
	private readonly lockedRef: { value: boolean };

	constructor(
		w: number,
		h: number,
		color: string,
		pulseAtRef: { value: number },
		index: number,
		lockedRef: { value: boolean },
	) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.color = color;
		this.pulseAtRef = pulseAtRef;
		this.index = index;
		this.lockedRef = lockedRef;
	}

	override draw(renderer: Renderer): void {
		const now = timer.getTime();
		const w = this.width;
		const h = this.height;
		const bet = gameState.bet;
		const isBetSlot = bet?.slotIndex === this.index;
		// Available means "the player CAN place/modify a bet right
		// now" — needs credits AND no balls falling. Idle visuals
		// (breathing top edge, full backdrop) only fire when available.
		const canBet = gameState.credits > 0 && !this.lockedRef.value;

		// 0) Dark backdrop strip behind the top label area — guarantees
		//    the white "TAP" / "BET ×N" text reads regardless of the
		//    tier colour painted under it. Subtle when idle, opaque
		//    when the bet is active so the wager reads as committed.
		if (canBet || isBetSlot) {
			renderer.save();
			renderer.setGlobalAlpha(isBetSlot ? 0.75 : 0.55);
			renderer.setColor("#06061a");
			renderer.fillRect(0, 6, w, 20);
			renderer.restore();
		}
		// And a matching strip for the bottom "WIN +M" label, only
		// when a bet is active here (idle slots show no bottom text).
		if (isBetSlot) {
			renderer.save();
			renderer.setGlobalAlpha(0.75);
			renderer.setColor("#06061a");
			renderer.fillRect(0, h - 22, w, 20);
			renderer.restore();
		}

		// 1) Always-on breathing top-edge glow — signals every slot is
		//    clickable. Fades out when the player has no credits left
		//    (clicking would be a no-op).
		if (canBet && !isBetSlot) {
			const phase = (now % IDLE_BREATHE_MS) / IDLE_BREATHE_MS;
			const breathe = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
			renderer.save();
			renderer.setGlobalAlpha(0.18 + breathe * 0.22);
			renderer.setColor(this.color);
			renderer.fillRect(0, 0, w, 3);
			renderer.restore();
		}

		// 2) Landing pulse — bright white wash + tier-band punch, decays
		//    over SLOT_PULSE_MS. Fires for every slot landing (win or
		//    loss or no-bet).
		const landElapsed = now - this.pulseAtRef.value;
		if (landElapsed < SLOT_PULSE_MS) {
			const t = Math.max(0, 1 - landElapsed / SLOT_PULSE_MS);
			renderer.save();
			renderer.setGlobalAlpha(0.3 * t);
			renderer.setColor("#ffffff");
			renderer.fillRect(0, 0, w, h);
			renderer.restore();
			renderer.save();
			renderer.setGlobalAlpha(0.5 * t);
			renderer.setColor(this.color);
			renderer.fillRect(0, 0, w, 4 + t * 2);
			renderer.restore();
		}

		// 3) Active bet — solid bright outline + filled tier band so the
		//    slot reads as "stakes are here". Drawn under the result
		//    flashes so a win/bust flash plays on top.
		if (isBetSlot) {
			// Breathing alpha on the outline so it pulses with intent.
			const phase = (now % IDLE_BREATHE_MS) / IDLE_BREATHE_MS;
			const breathe = 0.6 + 0.4 * Math.sin(phase * Math.PI * 2);
			renderer.save();
			renderer.setGlobalAlpha(breathe);
			renderer.setColor(COLOR_BALL);
			renderer.lineWidth = 3;
			renderer.strokeRect(1, 1, w - 2, h - 2);
			renderer.restore();
			// Bright tier band overlay.
			renderer.save();
			renderer.setGlobalAlpha(0.9);
			renderer.setColor(this.color);
			renderer.fillRect(0, 0, w, 6);
			renderer.restore();
			renderer.save();
			renderer.setGlobalAlpha(0.9);
			renderer.setColor("#ffffff");
			renderer.fillRect(0, 0, w, 2);
			renderer.restore();
		}

		// 4) Win flash — only on the slot that just paid out. Hot gold +
		//    yellow wash that pulses then settles.
		const lastWin = gameState.lastWin;
		if (lastWin?.slotIndex === this.index) {
			const winElapsed = now - lastWin.at;
			if (winElapsed < BET_RESULT_PULSE_MS) {
				const t = Math.max(0, 1 - winElapsed / BET_RESULT_PULSE_MS);
				renderer.save();
				renderer.setGlobalAlpha(0.6 * t);
				renderer.setColor(COLOR_BALL);
				renderer.fillRect(0, 0, w, h);
				renderer.restore();
				// Pulsing gold ring on top of the bet outline.
				renderer.save();
				renderer.setGlobalAlpha(Math.min(1, t * 1.4));
				renderer.setColor("#ffffff");
				renderer.lineWidth = 4;
				renderer.strokeRect(2, 2, w - 4, h - 4);
				renderer.restore();
			}
		}

		// 5) Bust flash — red wash on the slot the player BET, when a
		//    ball landed elsewhere. Quick fade.
		const lastBust = gameState.lastBust;
		if (lastBust?.slotIndex === this.index) {
			const bustElapsed = now - lastBust.at;
			if (bustElapsed < BET_RESULT_PULSE_MS) {
				const t = Math.max(0, 1 - bustElapsed / BET_RESULT_PULSE_MS);
				renderer.save();
				renderer.setGlobalAlpha(0.55 * t);
				renderer.setColor("#ff3366");
				renderer.fillRect(0, 0, w, h);
				renderer.restore();
				renderer.save();
				renderer.setGlobalAlpha(t);
				renderer.setColor("#ff3366");
				renderer.lineWidth = 3;
				renderer.strokeRect(1, 1, w - 2, h - 2);
				renderer.restore();
			}
		}
	}
}

export class Slot extends Container {
	readonly score: number;
	/** Tier colour (slot fill + spark tint + score-fly text colour). */
	readonly color: string;
	/** 0-based index across the row of slots. Drives bet ownership. */
	readonly index: number;
	/** Boxed so SlotBin can read the latest value each frame. */
	private readonly pulseAtRef = { value: -Infinity };
	/**
	 * Shared "betting is currently locked" flag. Written by `update()`
	 * each frame from `hasActiveBalls()`; read by SlotBin's `draw()`
	 * to grey out the idle visuals while a ball is falling.
	 */
	private readonly lockedRef = { value: false };
	/** Dynamic top label — "BET ×N" or "BUST" or empty. */
	private readonly topLabel: Text;
	/** Dynamic bottom label — "WIN +M" or "TAP" hint or empty. */
	private readonly bottomLabel: Text;

	constructor(
		x: number,
		y: number,
		w: number,
		h: number,
		score: number,
		index: number,
	) {
		super(x, y, w, h);
		this.anchorPoint.set(0, 0);
		this.score = score;
		this.index = index;
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

		// Visual bin (procedural rectangles + bet overlay).
		this.addChild(
			new SlotBin(w, h, color, this.pulseAtRef, index, this.lockedRef),
		);

		// Score number — engine-native Text renderable. Nudged BELOW
		// dead-centre so it doesn't crowd the top-label backdrop, and
		// the bottom band stays clear for the "WIN +M" preview when a
		// bet is active.
		const fontSize = Math.max(14, Math.min(26, w * 0.32));
		const scoreLabel = new Text(w / 2, h / 2 + 6, {
			font: "Courier New",
			size: fontSize,
			fillStyle: "#ffffff",
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: String(score),
		});
		scoreLabel.depth = 1;
		this.addChild(scoreLabel);

		// Top label — "TAP" idle hint or "BET ×N" / "BUST" when active.
		// White fill so it reads as bright against the dark backdrop
		// strip painted by SlotBin (see `draw()`). No thick stroke —
		// at 13 pt the prior 3 px stroke ate the entire glyph fill and
		// the text rendered effectively black.
		this.topLabel = new Text(w / 2, 11, {
			font: "Courier New",
			size: 13,
			fillStyle: "#ffffff",
			textAlign: "center",
			textBaseline: "top",
			bold: true,
			text: "TAP",
		});
		this.topLabel.depth = 2;
		this.addChild(this.topLabel);

		// Bottom label — "WIN +M" preview while bet is active. Empty
		// otherwise. Same plain-fill rule as the top label.
		this.bottomLabel = new Text(w / 2, h - 8, {
			font: "Courier New",
			size: 12,
			fillStyle: COLOR_BALL,
			textAlign: "center",
			textBaseline: "bottom",
			bold: true,
			text: "",
		});
		this.bottomLabel.depth = 2;
		this.addChild(this.bottomLabel);
	}

	override onActivateEvent(): void {
		// Default Container.isKinematic = false, so pointer events flow
		// to children registered via `registerPointerEvent` without any
		// `isKinematic = false` opt-in needed here.
		input.registerPointerEvent("pointerdown", this, this.onDown.bind(this));
	}

	override onDeactivateEvent(): void {
		input.releasePointerEvent("pointerdown", this);
	}

	private onDown(_pointer: Pointer): boolean {
		// Out of credits → no-op. (Game-over restart is handled by the
		// DropZone's larger hit region; the slot row sits below it.)
		if (gameState.credits <= 0) return false;
		// Bets must be committed BEFORE the drop. Once a ball is in
		// flight, the wager is locked — no in-flight adjustments.
		if (hasActiveBalls()) return false;
		// Apply the click; play the chip cue only if the wager actually
		// landed (rejected at MAX_BET_WAGER → silent so the cap reads).
		const newWager = placeBetClick(this.index);
		if (newWager === null) return false;
		const pan = ((this.pos.x + this.width / 2 - PLAY_LEFT) / PLAY_W) * 2 - 1;
		playBetClick(newWager, pan);
		// Stop propagation so a click that lands on a slot doesn't ALSO
		// punch through to anything underneath.
		return false;
	}

	override update(dt: number): boolean {
		// Publish the "betting locked" flag for SlotBin's draw() to
		// read — drives the grey-out of idle visuals while balls fall.
		this.lockedRef.value = hasActiveBalls();
		const state = computeLabelState(this.index, this.score, timer.getTime());
		applyLabelState(this.topLabel, state.top);
		applyLabelState(this.bottomLabel, state.bottom);
		super.update(dt);
		return true;
	}

	/**
	 * Called from the Ball when it lands in this slot. Settles any
	 * active bet, then dispatches the audio + visual + UI side-effects
	 * via the per-concern helpers below. The score-fly applies the
	 * score on its landing (not on slot entry) so the counter ticks up
	 * only when the fly visually reaches it.
	 */
	collect(): void {
		this.pulseAtRef.value = timer.getTime();
		const world = findWorld(this);
		if (!world) return;

		const cx = this.pos.x + this.width / 2;
		const cy = this.pos.y + SLOT_HEIGHT / 2;
		const pan = ((cx - PLAY_LEFT) / PLAY_W) * 2 - 1;
		const tier = tierForScore(this.score);
		const outcome = this.settleBet();

		this.playLandingAudio(outcome, pan);
		this.spawnLandingEffects(world, outcome, cx, cy, tier);
		this.spawnScoreFly(world, outcome, cx, cy, tier);
		this.spawnCreditFly(world, outcome, cx, cy, tier);
	}

	/**
	 * Resolve any active bet against this slot and clear `gameState.bet`.
	 * Returns a frozen description of the outcome — every downstream
	 * helper takes this rather than re-reading `gameState.bet` (which
	 * is `null` by the time they run).
	 */
	private settleBet(): BetOutcome {
		const bet = gameState.bet;
		if (!bet) return { isWin: false, multiplier: 1, settled: null };

		const now = timer.getTime();
		if (bet.slotIndex === this.index) {
			// Hit! Total payout multiplier = 1 (base) + wager.
			gameState.lastWin = { at: now, slotIndex: this.index };
			gameState.bet = null;
			return { isWin: true, multiplier: bet.wager + 1, settled: bet };
		}
		// Wrong slot — bust the bet, paint the bet slot red.
		gameState.lastBust = { at: now, slotIndex: bet.slotIndex };
		gameState.bet = null;
		return { isWin: false, multiplier: 1, settled: bet };
	}

	/**
	 * Route the landing audio. Three mutually exclusive paths:
	 *   - win    → fanfare only (suppresses the chime so they don't
	 *              fight for the same frequency band);
	 *   - bust   → chime AT the landing slot + bust cue panned to the
	 *              BET slot (sells "ball went there, you wanted here");
	 *   - normal → chime only.
	 */
	private playLandingAudio(outcome: BetOutcome, landingPan: number): void {
		if (outcome.isWin) {
			playWin(this.score, landingPan);
			return;
		}
		playChime(this.score, landingPan);
		const settled = outcome.settled;
		if (settled) {
			const slotW = this.width;
			const betCx = PLAY_LEFT + settled.slotIndex * slotW + slotW / 2;
			const betPan = ((betCx - PLAY_LEFT) / PLAY_W) * 2 - 1;
			playBust(betPan);
		}
	}

	/**
	 * Spawn the spark burst(s) and (on a win) the full-viewport flash.
	 * Particle count + speed scale with score tier so a 100-pointer
	 * feels meaningfully bigger than a 2-pointer; a win adds two extra
	 * volleys (white core + gold halo) so it reads as a genuinely
	 * bigger explosion rather than the regular burst recoloured.
	 */
	private spawnLandingEffects(
		world: Container,
		outcome: BetOutcome,
		cx: number,
		cy: number,
		tier: number,
	): void {
		spawnSparkBurst(
			world,
			cx,
			this.pos.y,
			8 + tier * 3, // 8 → 20
			this.color,
			3 + tier * 0.8, // 3 → 6.2
		);
		if (!outcome.isWin) return;
		spawnSparkBurst(world, cx, cy, 40 + tier * 4, "#ffffff", 7 + tier);
		spawnSparkBurst(world, cx, cy, 28 + tier * 3, COLOR_BALL, 5 + tier);
		world.addChild(new WinFlash(cx, cy), 90);
	}

	/**
	 * Spawn the score-fly — a "+N" tween from the slot to the SCORE
	 * counter in the HUD. The fly applies its value to `gameState` on
	 * landing (not at spawn) so the counter visually animates rather
	 * than snapping. Wins get a bigger font + the gold fly colour to
	 * read as the headline event.
	 */
	private spawnScoreFly(
		world: Container,
		outcome: BetOutcome,
		cx: number,
		cy: number,
		tier: number,
	): void {
		const baseFontSize = 22 + tier * 4; // 22 → 38
		const fontSize = outcome.isWin ? baseFontSize + 10 : baseFontSize;
		const color = outcome.isWin ? COLOR_BALL : this.color;
		const value = this.score * outcome.multiplier;
		world.addChild(
			new ScoreFly(cx, cy, PLAY_RIGHT - 70, 24, value, color, fontSize, (v) => {
				gameState.score += v;
				gameState.lastSlotScore = v;
				gameState.lastSlotAt = timer.getTime();
			}),
			200,
		);
	}

	/**
	 * Spawn the credit-fly — only when the landing actually refunds
	 * credits. Refund composes the slot's base tier refund AND (on a
	 * win) the original wager amount; both pieces are amplified by
	 * the multiplier, so winning a low-tier bet still returns more
	 * credits than it cost (otherwise the multiplier would be
	 * invisible on tiers with zero base refund).
	 *
	 * - No bet landing: base refund × 1 (unchanged behaviour).
	 * - Bust: settled is non-null but multiplier is 1 and wager
	 *   contributes 0 → falls back to the no-bet path.
	 * - Win:  (base + wager) × multiplier.
	 */
	private spawnCreditFly(
		world: Container,
		outcome: BetOutcome,
		cx: number,
		cy: number,
		tier: number,
	): void {
		const wagerRefund =
			outcome.isWin && outcome.settled ? outcome.settled.wager : 0;
		const refund =
			(refundForScore(this.score) + wagerRefund) * outcome.multiplier;
		if (refund <= 0) return;
		world.addChild(
			new ScoreFly(
				cx,
				cy,
				VIEWPORT_W / 2,
				24,
				refund,
				COLOR_HORIZON_HI,
				20 + tier * 2, // 20 → 28
				(v) => {
					gameState.credits += v;
					gameState.lastCreditAt = timer.getTime();
				},
			),
			200,
		);
	}
}

/**
 * Frozen description of how a Slot landing resolved a wager (or
 * didn't). Returned by `settleBet()` and threaded through the
 * audio/effects/fly helpers so each one reads from one source of
 * truth instead of re-checking `gameState.bet`.
 */
interface BetOutcome {
	/** True iff the landing slot was the bet slot. */
	isWin: boolean;
	/** Score / credit multiplier — `wager + 1` on win, 1 otherwise. */
	multiplier: number;
	/**
	 * The bet that was just settled (won OR lost), or `null` if no
	 * bet was active. Held for downstream consumers that need the
	 * original wager amount (credit-fly refund math) or bet slot
	 * index (bust audio pan).
	 */
	settled: BetState | null;
}

/**
 * Render state for a single text label on the slot — what to show,
 * what colour, and how visible. Used as the output of
 * `computeLabelState` and consumed by `applyLabelState` so the
 * state-machine logic stays separate from the render-mutation logic.
 */
interface SlotLabelLook {
	text: string;
	/** CSS colour string. Ignored when `opacity === 0`. */
	color: string;
	/** 0..1 alpha applied via `Text.setOpacity`. */
	opacity: number;
}

interface SlotLabelState {
	top: SlotLabelLook;
	bottom: SlotLabelLook;
}

/**
 * Shared sentinel for "no label here." Reused rather than allocated
 * per frame — values are read, never written.
 */
const HIDDEN_LABEL: SlotLabelLook = Object.freeze({
	text: "",
	color: "#ffffff",
	opacity: 0,
});

/**
 * Pure projection from `gameState` + the slot's identity to the
 * label render state. Five mutually-exclusive cases, in priority
 * order:
 *
 *   1. Bust flash on this slot — overrides everything for ~800 ms.
 *   2. This slot carries the active bet — show "BET ×N" + "+M".
 *   3. Idle and playable — breathing "TAP" hint at full strength.
 *   4. Idle but balls in flight — greyed "TAP" (locked).
 *   5. Out of credits — both labels hidden.
 *
 * Keeping this side-effect-free makes the state-machine readable in
 * isolation and trivially testable.
 */
const computeLabelState = (
	slotIndex: number,
	slotScore: number,
	now: number,
): SlotLabelState => {
	const lastBust = gameState.lastBust;
	const bustOnMe =
		lastBust?.slotIndex === slotIndex &&
		now - lastBust.at < BET_RESULT_PULSE_MS;
	if (bustOnMe) {
		const t = Math.max(0, 1 - (now - lastBust.at) / BET_RESULT_PULSE_MS);
		return {
			top: { text: "BUST", color: "#ff5577", opacity: t },
			bottom: HIDDEN_LABEL,
		};
	}

	const bet = gameState.bet;
	if (bet?.slotIndex === slotIndex) {
		// Displayed multiplier is `wager + 1` — the TOTAL payout
		// multiplier, not the wager count. A first click reads as ×2
		// so it matches the +M preview math below.
		const win = slotScore * (bet.wager + 1);
		return {
			top: { text: `BET x${bet.wager + 1}`, color: COLOR_BALL, opacity: 1 },
			bottom: { text: `+${win}`, color: COLOR_BALL, opacity: 1 },
		};
	}

	const hasCredits = gameState.credits > 0;
	if (!hasCredits) return { top: HIDDEN_LABEL, bottom: HIDDEN_LABEL };

	const ballsInFlight = hasActiveBalls();
	if (ballsInFlight) {
		// Locked — show "TAP" greyed-out so the user reads it as
		// "currently disabled" rather than "missing".
		return {
			top: { text: "TAP", color: "#5a5a78", opacity: 0.6 },
			bottom: HIDDEN_LABEL,
		};
	}

	// Idle and clickable — breathing "TAP" (0.55 → 1.0) that stays
	// well above 0 so it never reads as "gone".
	const phase = (now % IDLE_BREATHE_MS) / IDLE_BREATHE_MS;
	const breathe = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
	return {
		top: { text: "TAP", color: "#ffffff", opacity: 0.55 + breathe * 0.45 },
		bottom: HIDDEN_LABEL,
	};
};

/** Apply a single label's render state to its Text renderable. */
const applyLabelState = (label: Text, look: SlotLabelLook): void => {
	label.setText(look.text);
	label.fillStyle.parseCSS(look.color);
	label.setOpacity(look.opacity);
};

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
		slots.push(new Slot(x, SLOT_TOP, slotWidth, SLOT_HEIGHT, score, i));
	}
	return slots;
};
