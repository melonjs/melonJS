/**
 * melonJS — Plinko (Planck) example: Peg entity.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 *
 * Static circle body that the ball bounces off. The peg's BASE
 * appearance (cyan halo + core dot + low-intensity hot centre) is
 * pre-rendered into `BakedStatics` once at scene init — see
 * `bakedStatics.ts:bakeBasePegs`. Per-frame, this peg renders ONLY
 * the transient flash overlay (shockwave ring + halo bloom + strobe
 * centre) for ~450 ms after `Peg.flash()` is called from the Ball's
 * `onCollisionStart`. Most frames bail in the first three lines of
 * `draw`, so peg fields stay cheap.
 *
 * Implemented as a `Container` so the visual half is its own
 * `Renderable` child — matches the Slot pattern, which is the
 * combination known to render reliably under both the Canvas and
 * WebGL renderers.
 */

import type { WebGLRenderer } from "melonjs";
import {
	CanvasRenderTarget,
	Container,
	collision,
	Ellipse,
	Renderable,
	type Renderer,
	ShaderEffect,
	timer,
} from "melonjs";
import { playClack } from "../audio";
import {
	BALL_RESTITUTION,
	COLOR_PEG,
	COLOR_PEG_HOT,
	PEG_COLS,
	PEG_FIELD_TOP,
	PEG_RADIUS,
	PEG_ROWS,
	PEG_X_SPACING,
	PEG_Y_SPACING,
	PLAY_LEFT,
	PLAY_RIGHT,
	PLAY_W,
} from "../constants";

/** Pulse duration after a hit (ms). Drives the brighten + radius scale. */
const PEG_FLASH_MS = 450;
/**
 * Outer-most radius the shockwave reaches at end of flash, expressed
 * as a multiple of the peg radius. The ring expands from 1× → this
 * value while its alpha decays, giving the "bullet-time ping" pulse.
 */
const SHOCKWAVE_MAX_R_MULT = 6.5;

/**
 * Bake target sized to fit the halo bloom at its widest (i=4, punch=1
 * → r = PEG_RADIUS + 4*3 + 4*2 = PEG_RADIUS + 20).
 */
const PEG_FLASH_BAKE_RADIUS = PEG_RADIUS + 4 * 3 + 4 * 2;
const PEG_FLASH_BAKE_SIZE = PEG_FLASH_BAKE_RADIUS * 2;

/**
 * Module-level baked bitmap for the peg flash overlay (4-ring halo
 * bloom + hot-white centre at MAX-punch state). Built lazily on first
 * PegVisual.draw and shared across every peg — per-frame cost goes
 * from 5 procedural ellipse fills to a single `drawImage`, eliminating
 * the bulk of the `pointPool` pressure from concurrent peg flashes.
 *
 * The shockwave rings still render procedurally below because they
 * expand outward in radius AND modulate stroke thickness — animating
 * a baked image via scale would distort the stroke. The shockwave
 * rings are the prime candidate if we ever want to write a custom
 * `ShaderEffect` to eliminate the remaining Path2D pool pressure.
 */
let bakedPegFlash: CanvasRenderTarget | null = null;

/**
 * Quad side for the shockwave Renderable — sized so the ring at max
 * wavefront (PEG_RADIUS × SHOCKWAVE_MAX_R_MULT) fits inside.
 */
const PEG_SHOCKWAVE_SIZE = PEG_RADIUS * SHOCKWAVE_MAX_R_MULT * 2;

/**
 * Shared 1×1 opaque-white texture. Used as the carrier image for the
 * shockwave Renderable's `drawImage` quad — the shader effect ignores
 * the sampled colour and procedurally renders the ring per fragment.
 * One pixel uploaded once; the QuadBatcher caches the GL texture
 * across every peg's shockwave.
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
 * GLSL fragment body for the procedural expanding shockwave ring. UV
 * coordinates are `[0, 1] × [0, 1]` across the quad; we centre and
 * remap to `[-1, 1]` so `length(c)` is "0 at quad centre, 1 at quad
 * edge". The wavefront radius (`r`) is interpolated from `1/MAX`
 * (peg-edge in quad-space) at the start of the flash to `1.0` (quad
 * edge) at the end. `smoothstep` paints a soft band of width
 * `thickness` around radius `r`, and the alpha decays with `(1-progress)²`
 * for the same ease-out feel as the original strokeEllipse stack.
 *
 * Two rings stacked at slightly different phases produce the "hot
 * inner + cooler trailing edge" look the original code achieved by
 * drawing two strokeEllipses at innerR / outerR. Inlined as a string
 * so we can substitute `SHOCKWAVE_MAX_R_MULT` into the GLSL constant.
 */
const SHOCKWAVE_FRAGMENT = `
uniform float uProgress;
vec4 apply(vec4 color, vec2 uv) {
    vec2 c = uv * 2.0 - 1.0;
    float d = length(c);
    float minR = 1.0 / ${SHOCKWAVE_MAX_R_MULT.toFixed(2)};
    float r1 = minR + uProgress * (1.0 - minR);
    float r2 = r1 + 0.04;
    float t = 1.0 - uProgress;
    float thick1 = 0.025 + 0.05 * t;
    float thick2 = 0.02 + 0.03 * t;
    float band1 = smoothstep(thick1, 0.0, abs(d - r1));
    float band2 = smoothstep(thick2, 0.0, abs(d - r2));
    // hot inner — white
    float a1 = band1 * t * 0.95;
    vec3 c1 = vec3(1.0);
    // cooler outer — cyan, dimmer
    float a2 = band2 * t * 0.65;
    vec3 c2 = vec3(0.0, 1.0, 1.0);
    vec3 rgb = c1 * a1 + c2 * a2;
    float alpha = a1 + a2;
    return vec4(rgb, alpha);
}
`;

class PegShockwaveVisual extends Renderable {
	private readonly flashAtRef: { value: number };
	private shockwaveShader: ShaderEffect | null = null;

	constructor(flashAtRef: { value: number }) {
		// Position offset so the quad centre sits at the peg centre.
		// PegVisual lives at parent (Peg Container) origin with the
		// peg centre at (PEG_RADIUS, PEG_RADIUS). The shockwave quad
		// is `PEG_SHOCKWAVE_SIZE` wide; align its centre to the peg
		// centre by offsetting the top-left by half a quad's width.
		super(
			PEG_RADIUS - PEG_SHOCKWAVE_SIZE / 2,
			PEG_RADIUS - PEG_SHOCKWAVE_SIZE / 2,
			PEG_SHOCKWAVE_SIZE,
			PEG_SHOCKWAVE_SIZE,
		);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.flashAtRef = flashAtRef;
		this.blendMode = "additive";
	}

	override update(_dt: number): boolean {
		const elapsed = timer.getTime() - this.flashAtRef.value;
		const active = elapsed < PEG_FLASH_MS;
		// Lazy-construct the ShaderEffect on the first frame the
		// flash is active. `onActivateEvent` doesn't fire on
		// grand-children added to a Container before that Container
		// is attached to the world (`Container.addChild` only
		// cascades to immediate children, not deeper), so we wait
		// until `parentApp.renderer` is reachable through the chain.
		// The effect is attached ONCE here and stays in postEffects
		// for the lifetime of the peg — we toggle `enabled` instead
		// of add/remove because `removePostEffect` calls `destroy()`
		// on the effect, which would force a costly shader recompile
		// on every subsequent flash. `beginPostEffect` filters out
		// `enabled === false` entries before the FBO-bind path, so a
		// disabled effect costs only the array filter — no GL state.
		if (active && this.shockwaveShader === null) {
			const renderer = this.parentApp?.renderer as WebGLRenderer | undefined;
			if (renderer && "gl" in renderer) {
				this.shockwaveShader = new ShaderEffect(renderer, SHOCKWAVE_FRAGMENT);
				this.addPostEffect(this.shockwaveShader);
			}
		}
		// Enable / disable the shader each frame based on flash state.
		if (this.shockwaveShader) {
			this.shockwaveShader.enabled = active;
		}
		return active;
	}

	override draw(renderer: Renderer): void {
		const elapsed = timer.getTime() - this.flashAtRef.value;
		if (elapsed >= PEG_FLASH_MS) return;
		// Skip the carrier quad if the shader isn't ready (one-frame
		// gap before lazy construction OR Canvas-mode where
		// ShaderEffect can't initialise). Without this the 1×1 white
		// texture would render as a full white box.
		if (!this.shockwaveShader?.enabled) return;
		const progress = Math.min(1, elapsed / PEG_FLASH_MS);
		this.shockwaveShader?.setUniform("uProgress", progress);
		// Anchor 1×1 white texture across the full quad. The shader
		// computes the ring procedurally — every shader invocation is
		// a fragment, no CPU-side Path2D / pointPool involved.
		//
		// `Container.draw` translates to its OWN pos before iterating
		// children, but doesn't translate to each child's pos. So we
		// have to read `this.pos.x/y` here to anchor the quad on the
		// peg centre (the renderable's pos was placed at
		// `PEG_RADIUS - PEG_SHOCKWAVE_SIZE / 2` in the constructor).
		const tex = getWhitePixel();
		renderer.drawImage(
			tex.canvas,
			0,
			0,
			1,
			1,
			this.pos.x,
			this.pos.y,
			PEG_SHOCKWAVE_SIZE,
			PEG_SHOCKWAVE_SIZE,
		);
	}
}

const bakePegFlashTexture = (): CanvasRenderTarget => {
	const target = new CanvasRenderTarget(
		PEG_FLASH_BAKE_SIZE,
		PEG_FLASH_BAKE_SIZE,
		{ context: "2d", transparent: true, antiAlias: true },
	);
	const ctx = target.context as CanvasRenderingContext2D;
	const cx = PEG_FLASH_BAKE_RADIUS;
	const cy = PEG_FLASH_BAKE_RADIUS;

	// 4 halo bloom rings at MAX punch state (punch = 1). At runtime
	// we modulate this image's alpha by `punch` — visually close to
	// the procedural per-frame ring stack since the radius growth at
	// punch=1 → punch=0.5 is only a few pixels.
	for (let i = 4; i >= 1; i--) {
		const a = 0.22 * (1 - (i - 1) / 4) * 1.8;
		const r = PEG_RADIUS + i * 3 + i * 2; // punch = 1
		ctx.fillStyle = `rgba(0, 255, 255, ${a})`; // COLOR_PEG cyan
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
	}

	// Hot-white centre punch at max state.
	const hotR = PEG_RADIUS * 0.5 + PEG_RADIUS * 1.2;
	ctx.fillStyle = `rgba(255, 255, 255, 0.9)`;
	ctx.beginPath();
	ctx.arc(cx, cy, hotR, 0, Math.PI * 2);
	ctx.fill();

	return target;
};

/**
 * Visual half of the peg — concentric glow rings + hot centre dot
 * + expanding shockwave ring on hit. Doesn't carry a body; the parent
 * `Peg` Container does.
 */
class PegVisual extends Renderable {
	private readonly flashAtRef: { value: number };

	constructor(size: number, flashAtRef: { value: number }) {
		super(0, 0, size, size);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
		this.flashAtRef = flashAtRef;
	}

	override draw(renderer: Renderer): void {
		// Base appearance (cyan disc + outer glow halo + low-intensity
		// hot centre) is pre-rendered once into `BakedStatics`. The
		// shockwave is rendered by a sibling `PegShockwaveVisual` via
		// a custom ShaderEffect (no Path2D / pointPool pressure).
		// This `draw` only handles the halo bloom + hot-centre flash
		// overlay during the brief PEG_FLASH_MS window after a hit.
		// Most frames bail in the first 3 lines, paying ~zero cost.
		const elapsed = timer.getTime() - this.flashAtRef.value;
		if (elapsed >= PEG_FLASH_MS) return;
		const cx = PEG_RADIUS;
		const cy = PEG_RADIUS;
		const t = Math.max(0, 1 - elapsed / PEG_FLASH_MS);
		const punch = t * t;

		// Halo bloom + hot-white centre — baked once at max-punch
		// state and blitted with alpha = punch.
		if (bakedPegFlash === null) {
			bakedPegFlash = bakePegFlashTexture();
		}
		renderer.save();
		renderer.setGlobalAlpha(punch);
		const dx = cx - PEG_FLASH_BAKE_RADIUS;
		const dy = cy - PEG_FLASH_BAKE_RADIUS;
		renderer.drawImage(
			bakedPegFlash.canvas,
			0,
			0,
			PEG_FLASH_BAKE_SIZE,
			PEG_FLASH_BAKE_SIZE,
			dx,
			dy,
			PEG_FLASH_BAKE_SIZE,
			PEG_FLASH_BAKE_SIZE,
		);
		renderer.restore();
		// Unused-import guards — kept around for color palette docs.
		void COLOR_PEG;
		void COLOR_PEG_HOT;
	}
}

export class Peg extends Container {
	/** Wall-clock ms at the last hit, used to drive the flash animation. */
	private readonly flashAtRef = { value: -Infinity };
	/**
	 * Row index normalised to `[0, 1]` — top row 0, bottom row 1.
	 * Passed to `playClack` so the bounce arpeggio descends as the ball
	 * falls through the field.
	 */
	private readonly rowHint: number;

	constructor(x: number, y: number, row: number) {
		const size = PEG_RADIUS * 2;
		// pos = top-left; the body's local-space Ellipse is centered at
		// (PEG_RADIUS, PEG_RADIUS) so the body ends up at (x + PEG_RADIUS,
		// y + PEG_RADIUS) in world space.
		super(x, y, size, size);
		this.rowHint = PEG_ROWS > 1 ? row / (PEG_ROWS - 1) : 0;
		this.anchorPoint.set(0, 0);
		this.bodyDef = {
			type: "static",
			shapes: [new Ellipse(PEG_RADIUS, PEG_RADIUS, size, size)],
			collisionType: collision.types.WORLD_SHAPE,
			collisionMask: collision.types.ALL_OBJECT,
			restitution: BALL_RESTITUTION,
		};
		// Glow halo extends a bit outside the body footprint; floating
		// children draw at full halo radius without being culled by
		// the container's own viewport check.
		this.addChild(new PegVisual(size, this.flashAtRef));
		// Shockwave ring rendered procedurally via a custom
		// ShaderEffect — replaces the two strokeEllipse calls that
		// were the dominant `pointPool` source (each frame's biggest
		// stroked ring was inflating the pool by hundreds of points
		// even at idle). Quad spans `PEG_SHOCKWAVE_SIZE` so the ring
		// can expand outward up to `SHOCKWAVE_MAX_R_MULT × PEG_RADIUS`.
		this.addChild(new PegShockwaveVisual(this.flashAtRef));
	}

	/**
	 * Called from the Ball's `onCollisionStart` when it hits this peg.
	 * Resets the pulse timer; the next draw frame picks up the new value
	 * and renders a hot, slightly expanded ring that decays back to base.
	 */
	flash(): void {
		this.flashAtRef.value = timer.getTime();
		// Centre of this peg in world coords → pan in [-1, 1] across the
		// play area.
		const cx = this.pos.x + this.width / 2;
		const pan = ((cx - PLAY_LEFT) / PLAY_W) * 2 - 1;
		playClack(pan, this.rowHint);
	}
}

/**
 * Build the triangular peg field. Each row alternates a half-step
 * horizontal offset so the pegs form a proper triangular packing
 * — every ball that drops between two pegs lands on a single peg
 * in the row below, not in the gap, which is the whole point of
 * plinko.
 *
 * Centred horizontally in the play area; PEG_FIELD_TOP positions
 * the top row vertically. PEG_ROWS / PEG_COLS / PEG_X_SPACING /
 * PEG_Y_SPACING in constants.ts control the field's dimensions.
 */
export const buildPegField = (): Peg[] => {
	const pegs: Peg[] = [];
	const fieldW = (PEG_COLS - 1) * PEG_X_SPACING;
	const baseX = PLAY_LEFT + (PLAY_W - fieldW) / 2;
	// Wall-adjacent peg columns sit one peg-radius inside each wall so a
	// ball dropped at the very rim hits something on every row instead
	// of sluicing straight down the centring-gutter channel between the
	// wall and the outermost normal column.
	const wallLeftCx = PLAY_LEFT + PEG_RADIUS;
	const wallRightCx = PLAY_RIGHT - PEG_RADIUS;
	for (let row = 0; row < PEG_ROWS; row++) {
		// Alternate rows shifted by half spacing for triangular packing.
		// Odd rows have one fewer peg so the field stays inside `fieldW`.
		const isOdd = row % 2 === 1;
		const colsThisRow = isOdd ? PEG_COLS - 1 : PEG_COLS;
		const xOffset = isOdd ? PEG_X_SPACING / 2 : 0;
		const y = PEG_FIELD_TOP + row * PEG_Y_SPACING;
		for (let col = 0; col < colsThisRow; col++) {
			const x = baseX + xOffset + col * PEG_X_SPACING;
			pegs.push(new Peg(x - PEG_RADIUS, y - PEG_RADIUS, row));
		}
		// Wall-adjacent gutter pegs — only on odd rows. Even rows
		// already have a peg at `baseX` (40 px from the wall); odd
		// rows have a wider 70 px gap (half-spacing offset + gutter),
		// which is the channel a rim-dropped ball actually exploits.
		if (isOdd) {
			pegs.push(new Peg(wallLeftCx - PEG_RADIUS, y - PEG_RADIUS, row));
			pegs.push(new Peg(wallRightCx - PEG_RADIUS, y - PEG_RADIUS, row));
		}
	}
	return pegs;
};
