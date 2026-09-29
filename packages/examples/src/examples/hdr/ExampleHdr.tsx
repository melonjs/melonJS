/**
 * melonJS — HDR: what the `hdr` application setting actually buys.
 *
 * Laid out as a game's settings page, because that is what these controls are
 * for: a preview scene on the right, the knobs on the left, and the scene has
 * to contain something at each end of the range for the knobs to mean
 * anything. A night sky for shadow, a lit skyline for mid-tone, small warm
 * windows just over 1, and a sun at fourteen times display white.
 *
 * Under it, the calibration row: four emitters of the same shape and
 * eightfold different energy, over a plain greyscale ramp. The swatches show
 * what the pipeline does to over-bright content; the ramp shows what it does
 * to ordinary content, which is how you catch a setting that flatters the sun
 * by muddying everything else.
 *
 * Nothing here is hand-rolled. The energy is a built-in
 * `ColorMatrixEffect().brightness()` above 1, the spill is `BloomEffect`, the
 * curve is the `toneMapping` setting. The only thing the controls change is
 * the pipeline underneath.
 *
 * **With `hdr: false`** every render target is 8 bits per channel, so a value
 * above 1 does not survive being written. All four cores arrive at the curve
 * already clamped to 1 and map to the same grey; the bloom threshold cannot
 * tell "bright" from "brighter" because nothing in the frame exceeds 1; and
 * the curve has nothing left to compress, so exposure only darkens a picture
 * that is already display-referred.
 *
 * **With `hdr: true`** the targets are half-float. The sun and the swatches
 * keep their range all the way to the camera, so the curve lands them on
 * different brightnesses, the threshold starts discriminating genuinely
 * over-bright pixels, and the cores shift toward white through their own hue
 * instead of clipping to it.
 *
 * The greyscale ramp is the control. A tone curve that only made the sun look
 * better while crushing everything else would not be a tone curve, it would be
 * a filter, and the ramp is where that shows.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application,
	BloomEffect,
	ColorMatrixEffect,
	Sprite,
	Stage,
	state,
	Text,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const WIDTH = 1024;
const HEIGHT = 576;

/** the emitters: same glow, same size, different energy */
const EMITTERS = [
	{ energy: 1, color: [80, 220, 180] as const, label: "1×" },
	{ energy: 2, color: [240, 200, 90] as const, label: "2×" },
	{ energy: 4, color: [255, 120, 60] as const, label: "4×" },
	{ energy: 8, color: [255, 70, 90] as const, label: "8×" },
];

const ORB_SIZE = 104;
const ORB_Y = 265;
/** the row starts clear of the control panel and runs to the right edge */
const ROW_FROM = 0.4;
const ROW_TO = 0.9;

/**
 * Default exposure, and it is well under 1 for a reason.
 *
 * The curve has to be working in the part of its range where it SEPARATES
 * things. At exposure 1 the ACES shoulder maps 2, 4 and 8 to 0.86, 0.96 and
 * 0.99 — all of them white, so headroom buys a difference too small to see
 * and the example argues against itself. At 0.4 the same four emitters land
 * across the range and read as four different brightnesses.
 *
 * Which is also what makes the comparison sharp: with the targets clamped,
 * every one of those cores arrives at exactly 1 before the curve sees it, so
 * they all map to the SAME value. Four different energies, one grey.
 */
/** the curves this panel offers, and the type the setting takes */
type ToneCurve = "none" | "aces" | "reinhard" | "exponential";
const CURVES: ToneCurve[] = ["none", "aces", "reinhard", "exponential"];

/**
 * The sun, far past anything a display can show, and the window lights barely
 * over it. Two ends of the same idea: the white point is decided by the
 * former, the bloom threshold by the latter.
 */
const SUN_ENERGY = 14;
const WINDOW_ENERGY = 1.6;

/**
 * The curve this page grades with when headroom was granted.
 *
 * `reinhard`, not `aces`, and that is forced rather than taste: this page
 * turns `hdrOutput` on, and the ACES expression clamps to `[0, 1]` inside
 * itself, so everything past its shoulder would collapse to one value before
 * the white point scaled it. Nothing above 1 would ever reach the display.
 * Reinhard approaches 1 asymptotically without clamping, so the white point
 * can lift the brightest emitter past white and the ordering survives.
 */
const HDR_CURVE: ToneCurve = "reinhard";

const DEFAULT_EXPOSURE = 0.4;

/**
 * The value that comes out as display white.
 *
 * `0` would leave the curve its own shoulder, where nothing reaches 1 and the
 * brightest core is a light grey. At 3 the 8x emitter lands on white while
 * the three below it stay separated, which is the whole point of the row —
 * and under `hdrOutput` it lands just past white, which is the whole point of
 * that.
 */
const DEFAULT_WHITE = 3;

/**
 * One emitter's texture: a white filament fading out through its own colour.
 *
 * White at the centre on purpose. A pure hue has only one channel to give, so
 * it clips to that same hue and there is nothing for a tone curve to separate;
 * a white core surrounded by colour is what lets each channel saturate at its
 * own rate, which is the hue shift a real emitter has and a clipped one does
 * not.
 * @param rgb - the sheath colour, 0..255
 */
const bakeGlow = (rgb: readonly [number, number, number]) => {
	const canvas = document.createElement("canvas");
	canvas.width = ORB_SIZE;
	canvas.height = ORB_SIZE;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const half = ORB_SIZE / 2;
		const g = ctx.createRadialGradient(half, half, 0, half, half, half);
		const [r, gr, b] = rgb;
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(0.14, `rgba(255,255,255,0.96)`);
		g.addColorStop(0.3, `rgba(${r},${gr},${b},0.8)`);
		g.addColorStop(0.62, `rgba(${r},${gr},${b},0.22)`);
		g.addColorStop(1, `rgba(${r},${gr},${b},0)`);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, ORB_SIZE, ORB_SIZE);
	}
	return canvas;
};

/** a small deterministic PRNG, so the preview is the same picture every load */
const seeded = (seed: number) => {
	let s = seed >>> 0;
	return () => {
		s ^= s << 13;
		s >>>= 0;
		s ^= s >> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 4294967296;
	};
};

const SKYLINE_H = 150;

/**
 * The sky: a night gradient with stars, which is the mid-tone the curve is
 * judged against. If a setting makes the sun look better by turning this
 * muddy, that shows here first.
 *
 * Baked at the canvas's own size rather than small and scaled up: a star is
 * one pixel, and stretching a 256px bake to fit turns every one of them into
 * a visible block.
 */
const bakeSky = () => {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
		g.addColorStop(0, "#03040a");
		g.addColorStop(0.5, "#0b1430");
		g.addColorStop(0.78, "#1d2445");
		g.addColorStop(1, "#3d2f3f");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, WIDTH, HEIGHT);
		const rnd = seeded(0x9e3779b9);
		for (let i = 0; i < 320; i++) {
			const y = rnd() ** 2 * (HEIGHT - SKYLINE_H);
			const x = rnd() * WIDTH;
			ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.45})`;
			ctx.fillRect(x, y, rnd() < 0.08 ? 2 : 1, 1);
		}
	}
	return canvas;
};

/**
 * The buildings, as geometry rather than pixels.
 *
 * Generated ONCE and handed to both bakes below, because they have to agree:
 * the silhouette and the lit windows were independently random at first, and
 * the windows floated in mid-air beside the towers they belonged to.
 */
const buildings = () => {
	const rnd = seeded(0x2545f491);
	const out: { x: number; w: number; h: number }[] = [];
	for (let x = -20; x < WIDTH; ) {
		const w = 42 + rnd() * 66;
		const h = 46 + rnd() * 96;
		out.push({ x, w, h });
		x += w + 5 + rnd() * 12;
	}
	return out;
};

/**
 * The skyline: a near-black silhouette, so the frame has genuine shadow as
 * well as genuine highlight. A tone curve is judged on both ends.
 */
const bakeSkyline = (towers: { x: number; w: number; h: number }[]) => {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = SKYLINE_H;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#070a13";
		for (const t of towers) {
			ctx.fillRect(t.x, SKYLINE_H - t.h, t.w, t.h);
		}
	}
	return canvas;
};

/**
 * Lit windows, drawn additively over the silhouette and only a little
 * over-bright: these are what the bloom threshold decides about. The sun is
 * the other end of that decision.
 */
const bakeWindows = (towers: { x: number; w: number; h: number }[]) => {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = SKYLINE_H;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const rnd = seeded(0x27d4eb2f);
		for (const t of towers) {
			const top = SKYLINE_H - t.h;
			for (let wy = top + 9; wy < SKYLINE_H - 8; wy += 13) {
				for (let wx = t.x + 7; wx < t.x + t.w - 8; wx += 12) {
					if (rnd() < 0.45) {
						continue;
					}
					ctx.fillStyle = rnd() < 0.25 ? "#cfe4ff" : "#ffc98a";
					ctx.fillRect(wx, wy, 4, 6);
				}
			}
		}
	}
	return canvas;
};

/**
 * The control: an ordinary, entirely in-range gradient from black to white.
 * Whatever the tone curve does to the emitters, it does to this too, and a
 * grade that crushes it is a grade that is wrong.
 */
const bakeReferenceStrip = () => {
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 48;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const g = ctx.createLinearGradient(0, 0, 512, 0);
		for (let i = 0; i <= 10; i++) {
			const v = Math.round((i / 10) * 255);
			g.addColorStop(i / 10, `rgb(${v},${v},${v})`);
		}
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 512, 48);
	}
	return canvas;
};

const createGame = async () => {
	const app = new Application(WIDTH, HEIGHT, {
		parent: "screen",
		renderer: video.AUTO,
		scale: "auto",
		// Half-float render targets, so a value above 1 survives being
		// written instead of clamping at every step. Refused gracefully where
		// the driver cannot do it, so it is safe to ask for unconditionally —
		// `renderer.supportsHDR` reports what was granted, and the panel below
		// prints it.
		hdr: true,
		// Presented in the display's full range rather than clamped to SDR
		// on the way to the screen. WebGPU only, and it changes what you see
		// on an HDR display, so it is a separate opt-in from `hdr`.
		hdrOutput: true,
	});
	await app.init();

	// A programmable pipeline is the whole subject: under the Canvas fallback
	// there are no render targets and no shader effects at all, so say which
	// it is rather than drawing a scene that silently omits the point.
	if (app.renderer.shaderLanguage === null) {
		throw new Error(
			"The HDR example needs WebGL 2 or WebGPU — this browser fell back to Canvas.",
		);
	}

	app.world.backgroundColor.parseCSS("#05070c");

	class HdrScene extends Stage {
		override onResetEvent() {
			// ── the preview scene ────────────────────────────────────────
			// A settings page is judged on a picture, not on swatches: you
			// want deep sky, a lit mid-tone, small warm highlights and one
			// genuinely over-bright source, so a slider that fixes the sun
			// by muddying everything else is visibly a bad trade.
			const sky = new Sprite(WIDTH / 2, HEIGHT / 2, {
				image: bakeSky(),
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			app.world.addChild(sky, 0);

			// The sun: the one thing in frame that is properly over-bright.
			// At 14x it is far past anything a display can show, which is
			// what gives the white point something to land on — with no
			// curve it is simply a white disc, and every curve rolls it off
			// differently.
			const sun = new Sprite(WIDTH * 0.76, HEIGHT * 0.17, {
				image: bakeGlow([255, 214, 170]),
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			sun.scale(1.35, 1.35);
			sun.blendMode = "additive";
			sun.addPostEffect(
				new ColorMatrixEffect(app.renderer).brightness(SUN_ENERGY),
			);
			app.world.addChild(sun, 5);

			// the shadow end of the range
			const towers = buildings();
			const skyline = new Sprite(WIDTH / 2, HEIGHT - SKYLINE_H / 2, {
				image: bakeSkyline(towers),
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			app.world.addChild(skyline, 8);

			// and the small highlights, only a little over-bright: these are
			// what the bloom threshold decides about
			const windows = new Sprite(WIDTH / 2, HEIGHT - SKYLINE_H / 2, {
				image: bakeWindows(towers),
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			windows.blendMode = "additive";
			windows.addPostEffect(
				new ColorMatrixEffect(app.renderer).brightness(WINDOW_ENERGY),
			);
			app.world.addChild(windows, 9);

			// ── the calibration row, over the scene ──────────────────────
			const from = WIDTH * ROW_FROM;
			const span = WIDTH * (ROW_TO - ROW_FROM);

			for (const [i, emitter] of EMITTERS.entries()) {
				const x = from + (span * i) / (EMITTERS.length - 1);
				const orb = new Sprite(x, ORB_Y, {
					image: bakeGlow(emitter.color),
					anchorPoint: { x: 0.5, y: 0.5 },
				});
				// additive, because that is what an emitter does to the frame
				// it is drawn into: it ADDS light rather than replacing what
				// is behind it
				orb.blendMode = "additive";

				// The energy, and the only thing that differs between these
				// four. `brightness()` above 1 scales colour past what a
				// display can show, and the shipped shader is a bare
				// `uColorMatrix * color` with no clamp of its own — so what
				// happens to it next is entirely down to the target it lands
				// in, which is exactly the thing being demonstrated.
				//
				// ONE effect, deliberately. A renderable carrying a single
				// effect takes the renderer's `customShader` fast path and
				// draws straight into the camera's target; a chain of two or
				// more is routed through a pooled intermediate that is kept
				// at 8 bits per channel on purpose, and the energy would be
				// clamped there before it ever reached the camera.
				orb.addPostEffect(
					new ColorMatrixEffect(app.renderer).brightness(emitter.energy),
				);
				app.world.addChild(orb, 10);

				const caption = new Text(x, ORB_Y + ORB_SIZE * 0.56, {
					font: "Arial",
					size: "17px",
					fillStyle: "#cfd8ee",
					textAlign: "center",
					text: emitter.label,
				});
				caption.setOpacity(0.9);
				app.world.addChild(caption, 20);
			}

			const strip = new Sprite(WIDTH * 0.63, HEIGHT - 204, {
				image: bakeReferenceStrip(),
				anchorPoint: { x: 0.5, y: 0.5 },
			});
			app.world.addChild(strip, 20);

			const stripLabel = new Text(WIDTH * 0.63, HEIGHT - 168, {
				font: "Arial",
				size: "13px",
				fillStyle: "#8c97b5",
				textAlign: "center",
				text: "reference: ordinary content, entirely within range",
			});
			app.world.addChild(stripLabel, 20);
		}
	}

	state.set(state.PLAY, new HdrScene());
	state.change(state.PLAY);

	// ── the chain: spread the bright parts, then map the result ─────────────
	// Bloom first so the light it spreads is mapped along with everything
	// else, tone map last so the sum of the two lands inside the display
	// range instead of clipping where they overlap.
	const bloom = new BloomEffect(app.renderer, {
		threshold: 1,
		intensity: 1,
		radius: 4,
	});
	app.viewport.addPostEffect(bloom);

	// The tone curve through the settings API rather than by hand. This is
	// what a game's options screen drives: one call, and the renderer keeps
	// the effect last on the camera. `hdr` does not imply it and it does not
	// imply `hdr` — they are headroom and grade, and this example wants both.
	app.renderer.setToneMapping(HDR_CURVE, {
		exposure: DEFAULT_EXPOSURE,
		white: DEFAULT_WHITE,
	});

	// ── controls ────────────────────────────────────────────────────────────
	const parent = app.renderer.getCanvas().parentElement;
	const panel = document.createElement("div");
	panel.style.cssText =
		"position:absolute;top:16px;left:16px;z-index:1000;padding:12px 14px;" +
		"background:rgba(10,12,20,0.82);color:#cfe0ff;border:1px solid #38406a;" +
		"border-radius:8px;font-family:sans-serif;font-size:12px;width:250px;";

	const row = (label: string) => {
		const wrap = document.createElement("div");
		wrap.style.cssText = "margin-bottom:9px;";
		const text = document.createElement("div");
		text.textContent = label;
		text.style.cssText = "margin-bottom:3px;color:#9fb6e8;";
		wrap.appendChild(text);
		panel.appendChild(wrap);
		return { wrap, text };
	};

	const slider = (
		label: string,
		min: number,
		max: number,
		step: number,
		value: number,
		onInput: (v: number) => void,
	) => {
		const { wrap, text } = row(`${label}: ${value.toFixed(2)}`);
		const input = document.createElement("input");
		input.type = "range";
		input.min = String(min);
		input.max = String(max);
		input.step = String(step);
		input.value = String(value);
		input.style.cssText = "width:100%;";
		input.addEventListener("input", () => {
			const v = Number(input.value);
			text.textContent = `${label}: ${v.toFixed(2)}`;
			onInput(v);
		});
		wrap.appendChild(input);
		return input;
	};

	// what was GRANTED, which is not always what was asked for
	const status = document.createElement("div");
	status.style.cssText =
		"margin:-2px 0 10px;padding:6px 8px;border-radius:5px;font-size:11px;" +
		"line-height:1.45;background:rgba(0,0,0,0.3);";
	/**
	 * What this machine actually granted, stated rather than implied.
	 *
	 * Three separate facts, and a settings screen is exactly where they stop
	 * being interchangeable: the backend decides whether HDR output is
	 * possible at all, the two flags say what was granted, and the DISPLAY
	 * decides whether any of it is visible. A page that showed only the
	 * first would look identical on a machine that can present HDR and one
	 * that cannot.
	 */
	const refreshStatus = () => {
		const hdrOn = app.renderer.supportsHDR;
		const outOn = app.renderer.supportsHDROutput;
		const backend = app.renderer.type;
		const displayHDR = globalThis.matchMedia?.("(dynamic-range: high)").matches;
		const tick = (ok: boolean) => {
			return ok
				? "<span style='color:#8ce8b0'>true</span>"
				: "<span style='color:#f0b45e'>false</span>";
		};

		status.style.color = "#9fb6e8";
		status.innerHTML =
			`<b>${backend}</b><br>` +
			`renderer.supportsHDR = ${tick(hdrOn)}<br>` +
			`<span style='opacity:0.8'>${
				hdrOn
					? "half-float targets: the sun and the swatches keep their range through the chain."
					: "targets clamp at 1: the sun and every swatch arrive at the same white."
			}</span><br><br>` +
			`renderer.supportsHDROutput = ${tick(outOn)}<br>` +
			`<span style='opacity:0.8'>${
				outOn
					? `presented in the display's full range, so values above 1 reach the compositor.${
							displayHDR
								? ""
								: " This display reports SDR, so you will not see the difference here."
						}`
					: backend === "WebGPU"
						? "presented in SDR: the frame still clamps on the final blit."
						: "WebGL2 cannot present in extended range at all; no browser implements the drawing-buffer tone mapping that would allow it."
			}</span>`;
	};

	const hdrRow = document.createElement("label");
	hdrRow.style.cssText =
		"display:flex;align-items:center;gap:8px;margin-bottom:8px;" +
		"font-weight:600;font-size:13px;cursor:pointer;";
	const hdrBox = document.createElement("input");
	hdrBox.type = "checkbox";
	hdrBox.checked = app.renderer.supportsHDR;
	hdrBox.addEventListener("change", () => {
		// live, because the comparison is the example. The pool is emptied
		// when the format changes and the next frame mints its targets in the
		// new one, so this is cheap enough for a toggle — it is not something
		// to drive per frame.
		app.renderer.setHDR(hdrBox.checked);
		// and follow what was granted rather than what was ticked: a driver
		// without either half-float extension refuses
		hdrBox.checked = app.renderer.supportsHDR;

		// Move the GRADE with the pipeline, which is what a real settings
		// screen does and what this page is modelling. A curve needs values
		// above 1 to compress; applied to a chain that clamps it only
		// darkens, and the honest SDR picture is the one with no curve at
		// all. Leaving it on made this page look broken with `hdr` off,
		// which is the same trap the skill warns about.
		mode = hdrBox.checked ? HDR_CURVE : "none";
		curve.value = mode;
		app.renderer.setToneMapping(mode);
		// `hdrOutput` cannot outlive `hdr`: with an 8-bit chain there is
		// nothing above 1 left to present
		refreshOut();
		refreshStatus();
	});
	const hdrText = document.createElement("span");
	hdrText.textContent = "hdr";
	hdrRow.appendChild(hdrBox);
	hdrRow.appendChild(hdrText);
	panel.appendChild(hdrRow);

	// The second, separate opt-in: present in the display's full range
	// instead of clamping to SDR at the last step. WebGPU only, so this row
	// reports what the backend could do rather than pretending.
	const outRow = document.createElement("label");
	outRow.style.cssText =
		"display:flex;align-items:center;gap:8px;margin-bottom:8px;" +
		"font-weight:600;font-size:13px;cursor:pointer;";
	const outBox = document.createElement("input");
	outBox.type = "checkbox";
	outBox.checked = app.renderer.supportsHDROutput;
	const outText = document.createElement("span");
	const refreshOut = () => {
		outBox.checked = app.renderer.supportsHDROutput;
		const canDo = app.renderer.type === "WebGPU";
		outBox.disabled = !canDo;
		outRow.style.opacity = canDo ? "1" : "0.45";
		outText.textContent = canDo ? "hdrOutput" : "hdrOutput (WebGPU only)";
	};
	outBox.addEventListener("change", () => {
		app.renderer.setHDROutput(outBox.checked);
		refreshOut();
		refreshStatus();
	});
	outRow.appendChild(outBox);
	outRow.appendChild(outText);
	panel.appendChild(outRow);
	refreshOut();

	panel.appendChild(status);
	refreshStatus();

	const { wrap: curveWrap } = row("renderer.setToneMapping(mode)");
	const curve = document.createElement("select");
	curve.style.cssText =
		"width:100%;background:#11131c;color:#cfe0ff;border:1px solid #38406a;" +
		"border-radius:4px;padding:3px;";
	// Held as the narrow type the setting takes, rather than read back off
	// `select.value` as a `string` and cast: the list here IS the list of
	// valid modes, so there is nothing to assert.
	let mode: ToneCurve = HDR_CURVE;
	for (const option of CURVES) {
		const element = document.createElement("option");
		element.value = option;
		// say which one cannot feed HDR output rather than letting it be
		// discovered: aces clamps inside itself, so under `hdrOutput` it
		// flattens everything past its shoulder to one value
		element.textContent = option === "aces" ? "aces (SDR only)" : option;
		curve.appendChild(element);
	}
	// show the mode that is actually applied. Adding "none" to the list made
	// it the first option and therefore the selected one, while the renderer
	// had been set to the HDR curve — a control that reported the opposite of
	// what was on screen.
	curve.value = mode;
	curve.addEventListener("change", () => {
		// the mode is baked into the program, so this rebuilds one shader;
		// the sliders below are uniform writes and cost nothing
		mode =
			CURVES.find((name) => {
				return name === curve.value;
			}) ?? "aces";
		app.renderer.setToneMapping(mode);
	});
	curveWrap.appendChild(curve);

	slider("exposure (brightness)", 0.1, 3, 0.05, DEFAULT_EXPOSURE, (v) => {
		app.renderer.setToneMapping(mode, { exposure: v });
	});
	// The white point: the value that comes out as display white. This is the
	// slider a settings screen labels "peak" or "brightness", and without it
	// a curve only approaches 1 asymptotically, so nothing is ever quite
	// white and the only way to brighten is exposure, which drags the
	// midtones up with it.
	slider("white point (peak)", 0, 8, 0.1, DEFAULT_WHITE, (v) => {
		app.renderer.setToneMapping(mode, { white: v });
	});
	slider("BloomEffect.threshold", 0, 2, 0.02, 1, (v) => {
		bloom.setThreshold(v);
	});
	slider("BloomEffect.intensity", 0, 2, 0.05, 1, (v) => {
		bloom.setIntensity(v);
	});

	const hint = document.createElement("div");
	hint.textContent =
		"Turn hdr off: the sun and all four swatches collapse to the same " +
		"white, because each arrives already clamped at 1. Nothing about the " +
		"scene changed, only the target it is drawn into. The curve follows " +
		"the pipeline, as it would in a real settings screen.";
	hint.style.cssText =
		"margin-top:2px;color:#7f8aa8;font-size:11px;line-height:1.45;";
	panel.appendChild(hint);

	if (parent) {
		parent.style.position = "relative";
		parent.appendChild(panel);
	}

	return () => {
		panel.remove();
	};
};

export const ExampleHdr = createExampleComponent(createGame);
