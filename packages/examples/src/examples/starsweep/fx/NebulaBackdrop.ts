/**
 * melonJS — Starsweep: the animated space behind the station.
 *
 * A custom `ShaderEffect` (see `nebulaShader.ts`) on a blank full-screen
 * quad paints drifting space clouds and twinkling stars every frame,
 * tinted to the level. It needs a GPU renderer: on Canvas, `supported` is
 * false and the screens draw the sky themselves instead.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { Color, game, math, ShaderEffect, Sprite } from "melonjs";
import type { Theme } from "../rules/levels";
import { nebulaGlsl, nebulaWgsl } from "./nebulaShader";

/** a CSS colour as the shader's vec3: red, green and blue from 0 to 1 */
const rgb = (css: string) => new Color().parseCSS(css).toArray().slice(0, 3);

const blankQuad = (size: number) => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, size, size);
	}
	return canvas;
};

/**
 * The animated space backdrop: a screen-sized quad whose pixels come
 * entirely from the nebula shader.
 */
export class NebulaBackdrop extends Sprite {
	readonly fx: ShaderEffect;
	private time = math.randomFloat(0, 100);

	constructor(width: number, height: number) {
		const QUAD = 16;
		super(0, 0, { image: blankQuad(QUAD) });
		this.anchorPoint.set(0, 0);
		this.floating = true;
		this.alwaysUpdate = true;
		this.scale(width / QUAD, height / QUAD);
		this.fx = new ShaderEffect(game.renderer, {
			glsl: nebulaGlsl,
			wgsl: nebulaWgsl,
		});
		this.fx.setUniform("uAspect", width / height);
		this.addPostEffect(this.fx);
	}

	/** false on renderers that cannot run the shader (Canvas) */
	get supported() {
		return this.fx.enabled;
	}

	/**
	 * the sky's colours
	 * @param sky - the background
	 * @param a - the first layer of clouds
	 * @param b - the second layer of clouds
	 */
	setTheme(sky: string, a: string, b: string) {
		this.fx.setUniform("uSky", rgb(sky));
		this.fx.setUniform("uColorA", rgb(a));
		this.fx.setUniform("uColorB", rgb(b));
	}

	/** take on a level's colours */
	setLevelTheme(theme: Theme) {
		this.setTheme(theme.sky, theme.litSide, theme.wallSide);
	}

	override update(dt: number) {
		this.time += dt / 1000;
		this.fx.setUniform("uTime", this.time);
		super.update(dt);
		return true;
	}
}
