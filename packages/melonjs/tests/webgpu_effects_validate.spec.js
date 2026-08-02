import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	Application,
	BlurEffect,
	ChromaticAberrationEffect,
	ColorMatrixEffect,
	DesaturateEffect,
	DissolveEffect,
	DropShadowEffect,
	FlashEffect,
	GlowEffect,
	HologramEffect,
	InvertEffect,
	OutlineEffect,
	PixelateEffect,
	ScanlineEffect,
	SepiaEffect,
	ShineEffect,
	TintPulseEffect,
	VignetteEffect,
	video,
	WaveEffect,
} from "../src/index.js";

/**
 * Device-gated validation of every built-in effect's WGSL twin: each body
 * must parse into an enabled effect on the WebGPU renderer, and its
 * scaffolded module must compile with ZERO errors on the real device
 * (`getCompilationInfo` — WGSL validation issues never throw, they only
 * surface here or as silent draw failures). CI runners without WebGPU
 * skip visibly; run locally against a real adapter.
 */
describe("built-in effect WGSL twins compile on the device", () => {
	const EFFECTS = {
		BlurEffect,
		ChromaticAberrationEffect,
		ColorMatrixEffect,
		DesaturateEffect,
		DissolveEffect,
		DropShadowEffect,
		FlashEffect,
		GlowEffect,
		HologramEffect,
		InvertEffect,
		OutlineEffect,
		PixelateEffect,
		ScanlineEffect,
		SepiaEffect,
		ShineEffect,
		TintPulseEffect,
		VignetteEffect,
		WaveEffect,
	};

	let app;
	let webgpuReady = false;

	beforeAll(async () => {
		try {
			app = new Application(64, 64, { renderer: video.WEBGPU });
			await app.init();
			webgpuReady = true;
		} catch {
			webgpuReady = false;
		}
	});

	afterAll(() => {
		if (webgpuReady) {
			app.destroy();
		}
	});

	it("every effect parses enabled and its module compiles clean", async (ctx) => {
		if (!webgpuReady) {
			ctx.skip("WebGPU not available in this environment");
			return;
		}
		const renderer = app.renderer;
		const failures = [];
		for (const [name, EffectClass] of Object.entries(EFFECTS)) {
			const effect = new EffectClass(renderer);
			if (effect.enabled !== true || !effect.wgslRealization?.valid) {
				failures.push(
					`${name}: did not realize (${effect.wgslRealization?.error ?? "no realization"})`,
				);
				continue;
			}
			const module = renderer.device.createShaderModule({
				code: effect.wgslRealization.code,
			});
			const info = await module.getCompilationInfo();
			for (const message of info.messages) {
				if (message.type === "error") {
					failures.push(
						`${name}: ${message.message} (line ${message.lineNum})`,
					);
				}
			}
			effect.destroy();
		}
		expect(failures).toEqual([]);
	});
});
