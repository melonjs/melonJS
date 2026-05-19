/**
 * melonJS — Plinko (Planck) example: animated counter-flight popup.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * A "+N" floating text that spawns at a slot landing and tweens
 * up-and-over to one of the HUD counters, then commits its value via
 * the `onLand` callback. Used for BOTH the score-fly (lands on SCORE)
 * and the credit-fly (lands on CREDITS) — same flight code, different
 * target / colour / commit logic.
 *
 * Visual idea: the counter doesn't just tick — the new value
 * physically travels from the scoring slot to the readout. Combined
 * with the spark burst spawned alongside it (see `sparkBurst.ts`),
 * each landing reads as a deliberate event with clear cause and effect.
 *
 * Implemented as a Container (not a custom Renderable) because the
 * engine's draw walk relies on container.draw translating to its own
 * pos before iterating children — without that translation, a Text
 * child renders at its baked-in metrics offset relative to the parent,
 * which for our purposes is the world origin. With Container as the
 * Tween target, animating `pos.x` / `pos.y` moves the text correctly.
 */

import type { Container as ContainerType } from "melonjs";
import { Container, Text, Tween } from "melonjs";

/** Total flight duration (ms). Tuned so the trip feels deliberate but not slow. */
const FLY_MS = 800;
/**
 * Sideways arc — the popup eases up and OVER toward the counter, not
 * a straight line. Adds a slight parabola for organic flight.
 */
const ARC_HEIGHT = 80;

export class ScoreFly extends Container {
	/** Tween-driven 0 → 1 lerp factor. */
	private t = 0;
	private readonly startX: number;
	private readonly startY: number;
	private readonly targetX: number;
	private readonly targetY: number;
	private readonly value: number;
	private readonly label: Text;
	private readonly onLand: (value: number) => void;

	constructor(
		startX: number,
		startY: number,
		targetX: number,
		targetY: number,
		value: number,
		color: string,
		fontSize: number,
		onLand: (value: number) => void,
	) {
		super(startX, startY, 1, 1);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// Float so the fly renders in screen space (matches the HUD's
		// coordinate frame — the play area uses no camera scroll, so
		// world == screen, but flagging floating is the explicit
		// signal that this UI travels into the HUD area).
		this.floating = true;
		// Draw on top of nearly everything.
		this.depth = 200;

		this.startX = startX;
		this.startY = startY;
		this.targetX = targetX;
		this.targetY = targetY;
		this.value = value;
		this.onLand = onLand;

		// Text is centred at this container's local (0, 0). Container.draw
		// translates to `this.pos` before drawing children, so the Text
		// appears at (this.pos.x, this.pos.y) in world space.
		this.label = new Text(0, 0, {
			font: "Courier New",
			size: fontSize,
			fillStyle: color,
			textAlign: "center",
			textBaseline: "middle",
			bold: true,
			text: `+${value}`,
		});
		this.addChild(this.label);
	}

	override onActivateEvent(): void {
		// Tween a private `t` from 0 → 1 over FLY_MS, ease-out so the
		// fly accelerates near the slot and decelerates as it lands
		// on the counter — feels like "magnetised by the score".
		new Tween(this)
			.to({ t: 1 }, { duration: FLY_MS })
			.easing(Tween.Easing.Quadratic.Out)
			.onComplete(() => {
				// Caller-supplied commit — applies the value to the
				// relevant gameState counter and triggers that
				// counter's HUD pulse. Keeps this class agnostic to
				// whether it's flying score or credits.
				this.onLand(this.value);
				const parent = this.ancestor as ContainerType | null;
				parent?.removeChild(this);
			})
			.start();
	}

	override update(dt: number): boolean {
		// Quadratic Bezier interpolation: straight line from
		// (startX, startY) → (targetX, targetY), with a control point
		// lifted ARC_HEIGHT above the midpoint to bend the path into
		// a gentle parabola.
		const t = this.t;
		const oneMinusT = 1 - t;
		const midX = (this.startX + this.targetX) / 2;
		const midY = (this.startY + this.targetY) / 2 - ARC_HEIGHT;
		const x =
			oneMinusT * oneMinusT * this.startX +
			2 * oneMinusT * t * midX +
			t * t * this.targetX;
		const y =
			oneMinusT * oneMinusT * this.startY +
			2 * oneMinusT * t * midY +
			t * t * this.targetY;
		// Use `pos.set(x, y)` (2-arg form defaults z=0). The engine's
		// `World._sortReverseZ` reads `pos.z` and crashes on undefined;
		// stacking order is driven by `this.depth` (set in the ctor),
		// not by stuffing a depth into `pos.z`.
		this.pos.set(x, y);

		// Scale: pop up briefly (1 → 1.3 in the first 20% of flight),
		// then settle back to 1.0 by 60%. Sells "ejected from the slot".
		// `currentTransform.scale` MULTIPLIES the current matrix — reset
		// to identity each frame before applying the new scale.
		const popPhase = Math.min(1, t / 0.2);
		const settlePhase = Math.max(0, Math.min(1, (t - 0.2) / 0.4));
		const scale = 1 + popPhase * 0.3 - settlePhase * 0.3;
		this.label.currentTransform.identity();
		this.label.currentTransform.scale(scale, scale);

		// Alpha: full opacity until 75%, fade out in the final 25% so
		// the fly dissolves into the counter rather than abruptly
		// vanishing.
		const alpha = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
		this.label.setOpacity(alpha);
		super.update(dt);
		return true;
	}
}
