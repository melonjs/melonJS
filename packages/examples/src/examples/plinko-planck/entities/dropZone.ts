/**
 * melonJS — Plinko (Planck) example: DropZone (click-to-spawn).
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Wide Renderable at the top of the play field. Uses the engine's
 * `input.registerPointerEvent` so clicks within this renderable's
 * bounds fire the spawn handler with a `Pointer` whose `gameX/gameY`
 * is already in world-viewport coords — no manual DOM-rect / DPR /
 * fit-scale math needed.
 *
 * The bar's bounds intentionally span the whole drop strip (wall-
 * outer-edge to wall-outer-edge × DROP_BAND_H tall), so any click in
 * the visible guide strip lands here.
 */

import type { Container, Pointer, Renderer, WebGLRenderer } from "melonjs";
import {
	CanvasRenderTarget,
	input,
	ParticleEmitter,
	Renderable,
	ShaderEffect,
	timer,
} from "melonjs";
import {
	COLOR_BALL,
	COLOR_HORIZON_HI,
	DROP_BAND_H,
	DROP_BAND_Y,
	MAX_BALLS,
	PLAY_LEFT,
	PLAY_RIGHT,
	PLAY_W,
	SLOT_WALL_TOP,
} from "../constants";
import { gameState, resetGameState } from "../gameState";
import { Ball, hasActiveBalls } from "./ball";
import { ScoreFly } from "./scoreFly";

/** Drop-zone flash duration (ms) — drives the post-click pulse animation. */
const DROP_PULSE_MS = 500;
/** Wall thickness in px (matches WALL_THICKNESS in wall.ts). */
const WALL_T = 6;

/**
 * Quad dimensions for the shader-driven shockwave Renderable. Sized
 * to fit ring2's max horizontal radius (140 px) × the same scaled
 * 0.55 aspect (77 px vertical radius), so the rings touch the quad
 * edge at full expansion.
 */
const SHOCKWAVE_QUAD_W = 280;
const SHOCKWAVE_QUAD_H = 156;

/**
 * Shared 1×1 opaque-white carrier texture for the shockwave
 * Renderable's `drawImage` quad — the shader effect ignores the
 * sampled colour and procedurally renders the two rings per fragment.
 */
let whitePixel: CanvasRenderTarget | null = null;
const getWhitePixel = (): CanvasRenderTarget => {
	if (whitePixel === null) {
		whitePixel = new CanvasRenderTarget(1, 1, {
			context: "2d",
			transparent: false,
		});
		const ctx = whitePixel.context as CanvasRenderingContext2D;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, 1, 1);
	}
	return whitePixel;
};

/**
 * GLSL fragment body for the procedural drop-zone shockwave. Quad UVs
 * are `[0, 1] × [0, 1]`; we remap to `[-1, 1]` and use `length(c)`
 * for elliptical distance — the quad's own 280×156 aspect ratio
 * (= 0.55) gives the squashed-circle look the original
 * `strokeEllipse(cx, cy, r, r * 0.55)` calls produced.
 *
 * Two rings stacked. Ring 1 starts immediately, ring 2 delayed by
 * 25 % of the pulse duration; both grow from a tiny seed radius to
 * the quad edge as `uProgress` goes 0 → 1. Replaces the two
 * `strokeEllipse` calls which were the dominant `pointPool` source
 * (each frame's biggest stroked ring inflated the pool by hundreds
 * of points).
 */
const SHOCKWAVE_FRAGMENT = `
uniform float uProgress;
vec4 apply(vec4 color, vec2 uv) {
    vec2 c = uv * 2.0 - 1.0;
    float d = length(c);

    // Ring 1 — hot inner, fires immediately, decays as it expands.
    float r1 = 0.07 + uProgress * 0.79;
    float t1 = 1.0 - uProgress;
    float thick1 = 0.025 + 0.04 * t1;
    float band1 = smoothstep(thick1, 0.0, abs(d - r1));
    vec3 col1 = vec3(1.0, 0.96, 0.63); // COLOR_BALL
    float a1 = band1 * t1 * 0.95;

    // Ring 2 — cooler trailing edge, delayed 25 %.
    float p2 = max(0.0, (uProgress - 0.25) * (1.0 / 0.75));
    float r2 = 0.07 + p2 * 0.93;
    float t2 = 1.0 - p2;
    float thick2 = 0.02 + 0.03 * t2;
    float band2 = smoothstep(thick2, 0.0, abs(d - r2));
    vec3 col2 = vec3(1.0, 0.06, 0.94); // COLOR_HORIZON_HI
    float a2 = band2 * t2 * 0.7 * step(0.001, p2);

    vec3 rgb = col1 * a1 + col2 * a2;
    return vec4(rgb, a1 + a2);
}
`;

/**
 * Shader-driven shockwave Renderable. Lives in the world alongside
 * `DropZone`; `trigger(x, y)` re-anchors the quad to the click
 * position and restarts the animation timer. Zero `pointPool`
 * pressure — the rings are computed per fragment in GLSL, not via
 * `strokeEllipse` → `path2D` → `pointPool.get()`.
 */
class DropZoneShockwave extends Renderable {
	private pulseAt = Number.NEGATIVE_INFINITY;
	private shockwaveShader: ShaderEffect | null = null;

	constructor() {
		super(0, 0, SHOCKWAVE_QUAD_W, SHOCKWAVE_QUAD_H);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// `additive` matches the original draw's
		// `setGlobalAlpha + setColor` look — the rings glow over the
		// pegs they cross instead of obscuring them.
		this.blendMode = "additive";
		// Draw above the playfield but below the HUD (depth 100).
		this.depth = 50;
	}

	override onActivateEvent(): void {
		const renderer = this.parentApp?.renderer as WebGLRenderer | undefined;
		if (!renderer || !("gl" in renderer)) return;
		// Shader is constructed once and attached for the lifetime
		// of this Renderable. We toggle `enabled` per frame — see
		// PegShockwaveVisual for the rationale (removePostEffect
		// calls effect.destroy() which would force a recompile).
		this.shockwaveShader = new ShaderEffect(renderer, SHOCKWAVE_FRAGMENT);
		this.addPostEffect(this.shockwaveShader);
		this.shockwaveShader.enabled = false;
	}

	override update(_dt: number): boolean {
		const elapsed = timer.getTime() - this.pulseAt;
		const active = elapsed < DROP_PULSE_MS;
		if (this.shockwaveShader) {
			this.shockwaveShader.enabled = active;
		}
		return active;
	}

	/** Restart the ring animation centred on the given world coords. */
	trigger(x: number, y: number): void {
		this.pos.set(x - SHOCKWAVE_QUAD_W / 2, y - SHOCKWAVE_QUAD_H / 2);
		this.pulseAt = timer.getTime();
	}

	override draw(renderer: Renderer): void {
		const elapsed = timer.getTime() - this.pulseAt;
		if (elapsed >= DROP_PULSE_MS) return;
		// Skip the carrier quad if the shader isn't ready or is
		// disabled (Canvas-mode). Without this the 1×1 white texture
		// would render as a full 280×156 white box centred on the click.
		if (!this.shockwaveShader?.enabled) return;
		const progress = Math.min(1, elapsed / DROP_PULSE_MS);
		this.shockwaveShader?.setUniform("uProgress", progress);
		// `Container.draw` translates to its OWN pos before iterating
		// children, but doesn't translate to each child's pos — so we
		// pass `this.pos.x/y` explicitly to anchor the quad.
		const tex = getWhitePixel();
		renderer.drawImage(
			tex.canvas,
			0,
			0,
			1,
			1,
			this.pos.x,
			this.pos.y,
			SHOCKWAVE_QUAD_W,
			SHOCKWAVE_QUAD_H,
		);
	}
}

export class DropZone extends Renderable {
	private worldRef: Container | null = null;
	/** ms timestamp of the last drop; -Infinity means "no recent drop". */
	private pulseAt = -Infinity;
	/** Local X (relative to this renderable's pos) of the most recent drop. */
	private pulseX = 0;
	/**
	 * Shader-driven shockwave Renderable. Held here, attached to the
	 * world as a sibling of this DropZone in `onActivateEvent`. Reused
	 * across clicks — `trigger(x, y)` re-anchors and restarts.
	 */
	private shockwave: DropZoneShockwave | null = null;

	constructor() {
		// HIT region spans the entire playfield (wall-outer to
		// wall-outer × top-of-drop-band to top-of-slot-wall) so the
		// player can click anywhere on the field to drop a ball — not
		// just the narrow magenta strip at the top. The VISUAL pulse
		// stays anchored at the drop-band centreline in `draw()` by
		// computing `cyWorld` from `DROP_BAND_Y` directly instead of
		// `this.pos.y + this.height / 2`.
		super(
			PLAY_LEFT - WALL_T,
			DROP_BAND_Y - DROP_BAND_H / 2,
			PLAY_W + WALL_T * 2,
			SLOT_WALL_TOP - (DROP_BAND_Y - DROP_BAND_H / 2),
		);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		// CRITICAL: pointerevent.ts:340-343 skips any candidate whose
		// `isKinematic !== true` check fails — i.e. the default
		// `Renderable.isKinematic = true` silently drops the renderable
		// from the pointer pipeline. Container (and UIBaseElement) get
		// pointer events for free because their default is `false`.
		this.isKinematic = false;
	}

	override onActivateEvent(): void {
		// Walk up to the world container — Ball children attach there
		// to participate in physics.
		let anc: Container | null = this.ancestor as Container | null;
		while (anc?.ancestor) {
			anc = anc.ancestor as Container;
		}
		this.worldRef = anc;
		// Use the engine's region-based pointer API. The Pointer's
		// `gameX/gameY` is already in viewport coords — engine
		// accounts for `scaleMethod: "fit"`, device pixel ratio, and
		// the canvas bounding rect.
		input.registerPointerEvent("pointerdown", this, this.onDown.bind(this));
		// Attach the shader-driven shockwave Renderable as a sibling
		// in the world. It owns its own ShaderEffect and animation
		// timer; `trigger(x, y)` in `onDown` restarts the pulse.
		if (this.worldRef && !this.shockwave) {
			this.shockwave = new DropZoneShockwave();
			this.worldRef.addChild(this.shockwave);
		}
	}

	override onDeactivateEvent(): void {
		input.releasePointerEvent("pointerdown", this);
		if (this.shockwave && this.worldRef) {
			this.worldRef.removeChild(this.shockwave);
		}
		this.shockwave = null;
		this.worldRef = null;
	}

	private onDown(pointer: Pointer): boolean {
		const world = this.worldRef;
		if (!world) return false;

		// Game-over path: out of credits AND the playfield has fully
		// drained. Click anywhere to restart — wipe in-flight effects
		// (none expected here, but ScoreFlies / spark emitters live in
		// the world) and reset the counters. Drops resume from the
		// next click.
		if (gameState.credits <= 0 && !hasActiveBalls(world)) {
			this.restart(world);
			return false;
		}

		// Out of credits but balls still in play — wait for them to
		// settle. Click is a no-op so the player can't sneak in extras.
		if (gameState.credits <= 0) {
			return false;
		}

		this.reapOldestBallsIfNeeded(world);

		// Tiny X jitter so rapid clicks at the same X don't stack
		// balls on top of each other before the bottom one clears.
		const jitter = (Math.random() - 0.5) * 8;
		const x = Math.max(
			PLAY_LEFT + 12,
			Math.min(PLAY_RIGHT - 12, pointer.gameX + jitter),
		);
		const y = DROP_BAND_Y + 10;
		world.addChild(new Ball(x - 10, y));
		gameState.dropped += 1;
		gameState.credits -= 1;
		this.pulseAt = timer.getTime();
		this.pulseX = x - this.pos.x;
		// Restart the shader-driven shockwave at the click position.
		this.shockwave?.trigger(x, DROP_BAND_Y);
		// Returning `false` stops propagation — the DropZone covers the
		// whole playfield and is the only thing that should react to a
		// click there. The earlier `return false` paths above do the
		// same on purpose (game-over restart, no-credits no-op).
		return false;
	}

	/**
	 * Wipe any leftover world-attached effects (score-flies, spark
	 * emitters that haven't auto-destroyed yet) and reset the score /
	 * credit counters. Pegs, walls, slots, the HUD, and this DropZone
	 * itself are static fixtures — left in place.
	 */
	private restart(world: Container): void {
		const children = world.getChildren();
		for (let i = children.length - 1; i >= 0; i--) {
			const c = children[i];
			// Sweep only known-transient classes — Ball (any stragglers
			// the reaper missed), ScoreFly (mid-animation flies), and
			// ParticleEmitter (live spark bursts). Everything else is a
			// static fixture and stays put.
			if (
				c instanceof Ball ||
				c instanceof ScoreFly ||
				c instanceof ParticleEmitter
			) {
				world.removeChild(c);
			}
		}
		resetGameState();
	}

	private reapOldestBallsIfNeeded(world: Container): void {
		const children = world.getChildren();
		let balls = 0;
		for (const c of children) {
			if (c instanceof Ball) balls++;
		}
		if (balls < MAX_BALLS) return;
		for (const c of children) {
			if (balls < MAX_BALLS) break;
			if (c instanceof Ball) {
				world.removeChild(c);
				balls--;
			}
		}
	}

	override draw(renderer: Renderer): void {
		// Renderable.draw isn't auto-translated to this.pos by the
		// engine — Container.draw only does that for its children, and
		// the world Container translates to its own (0, 0) pos, not
		// ours. So all draw calls below render in WORLD coords by
		// adding `this.pos.x/y` explicitly.
		//
		// `this.width / this.height` now span the whole playfield (so
		// clicks land anywhere); the magenta pulse rail itself is
		// anchored at `DROP_BAND_Y` directly so the visual stays put
		// at the top of the field regardless of the hit region.
		const px = this.pos.x;
		const w = this.width;
		const elapsed = timer.getTime() - this.pulseAt;
		const pulse = Math.max(0, 1 - elapsed / DROP_PULSE_MS);
		const punch = pulse * pulse;
		const cyWorld = DROP_BAND_Y;

		// Vertical halo wash behind the bar during the pulse.
		if (punch > 0) {
			for (let i = 2; i >= 1; i--) {
				renderer.save();
				renderer.setGlobalAlpha(punch * 0.25 * (1 - (i - 1) / 2));
				renderer.setColor(COLOR_HORIZON_HI);
				const haloH = 8 + i * 10 + punch * 14;
				renderer.fillRect(px, cyWorld - haloH / 2, w, haloH);
				renderer.restore();
			}
		}

		// Base magenta strip — alpha + height both boost during pulse.
		renderer.save();
		renderer.setGlobalAlpha(0.22 + punch * 0.78);
		renderer.setColor(COLOR_HORIZON_HI);
		const stripH = 2 + punch * 6;
		renderer.fillRect(px, cyWorld - stripH / 2, w, stripH);
		renderer.restore();
		// Hot inner stripe — pure white during punch.
		if (punch > 0) {
			renderer.save();
			renderer.setGlobalAlpha(punch);
			renderer.setColor(COLOR_BALL);
			renderer.fillRect(px, cyWorld - 1, w, 1 + punch * 2);
			renderer.restore();
		}

		// Hot cap dots at each end, aligned with the side-wall centres.
		const capR = 4 + punch * 5;
		if (punch > 0) {
			renderer.save();
			renderer.setGlobalAlpha(punch * 0.55);
			renderer.setColor(COLOR_BALL);
			const haloR = capR + 6 + punch * 6;
			renderer.fillEllipse(px + WALL_T / 2, cyWorld, haloR, haloR);
			renderer.fillEllipse(px + w - WALL_T / 2, cyWorld, haloR, haloR);
			renderer.restore();
		}
		renderer.save();
		renderer.setGlobalAlpha(0.9);
		renderer.setColor(COLOR_BALL);
		renderer.fillEllipse(px + WALL_T / 2, cyWorld, capR, capR);
		renderer.fillEllipse(px + w - WALL_T / 2, cyWorld, capR, capR);
		renderer.restore();

		// Per-click flash effect.
		if (punch > 0) {
			const cxWorld = px + this.pulseX;
			const hotR = 6 + punch * 14;

			// Soft halo + bright core + white-hot centre.
			renderer.save();
			renderer.setGlobalAlpha(punch * 0.7);
			renderer.setColor(COLOR_HORIZON_HI);
			renderer.fillEllipse(cxWorld, cyWorld, hotR * 1.6, hotR * 1.6);
			renderer.restore();
			renderer.save();
			renderer.setGlobalAlpha(Math.min(1, punch * 1.4));
			renderer.setColor(COLOR_BALL);
			renderer.fillEllipse(cxWorld, cyWorld, hotR, hotR);
			renderer.restore();
			renderer.save();
			renderer.setGlobalAlpha(Math.min(1, punch * 1.4));
			renderer.setColor("#ffffff");
			renderer.fillEllipse(cxWorld, cyWorld, hotR * 0.5, hotR * 0.5);
			renderer.restore();

			// Expanding shockwave rings are rendered by the sibling
			// `DropZoneShockwave` Renderable (custom ShaderEffect, zero
			// pointPool pressure) — see top of file. We just keep the
			// click-position hot-spot + trajectory hint here.

			// Downward trajectory hint.
			renderer.save();
			renderer.setGlobalAlpha(punch);
			renderer.setColor(COLOR_BALL);
			renderer.lineWidth = 2 + punch * 3;
			renderer.strokeLine(
				cxWorld,
				cyWorld + 4,
				cxWorld,
				cyWorld + 30 + punch * 24,
			);
			renderer.restore();
		}
	}
}
