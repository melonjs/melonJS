/**
 * melonJS — linear + radial gradient fills example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Application as App,
	type Application,
	type CanvasRenderer,
	type Gradient,
	Polygon,
	Renderable,
	Stage,
	state,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

type Renderer = CanvasRenderer | WebGLRenderer;

/**
 * A renderable that showcases linear and radial gradients.
 * Gradients are created once and reused across frames.
 */
class GradientShowcase extends Renderable {
	private sky!: Gradient;
	private ground!: Gradient;
	private sun!: Gradient;
	private glow!: Gradient;
	private health!: Gradient;
	private mana!: Gradient;
	private btn!: Gradient;
	private circleGrad!: Gradient;
	private pillGrad!: Gradient;
	private rainbow!: Gradient;
	private vig!: Gradient;
	private star!: Polygon;

	constructor() {
		super(0, 0, 1024, 768);
		this.anchorPoint.set(0, 0);
	}

	onActivateEvent() {
		const w = this.width;
		const h = this.height;
		const renderer = this.parentApp.renderer;

		// sky
		this.sky = renderer.createLinearGradient(0, 0, 0, h * 0.6);
		this.sky.addColorStop(0, "#0B0B3B");
		this.sky.addColorStop(0.4, "#1a1a6e");
		this.sky.addColorStop(0.7, "#4a2080");
		this.sky.addColorStop(1, "#FF6B35");

		// ground
		this.ground = renderer.createLinearGradient(0, h * 0.6, 0, h);
		this.ground.addColorStop(0, "#2d5016");
		this.ground.addColorStop(0.5, "#1a3a0a");
		this.ground.addColorStop(1, "#0d1f05");

		// sun
		const sunX = w * 0.75;
		const sunY = h * 0.35;
		const sunR = 60;
		this.sun = renderer.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
		this.sun.addColorStop(0, "#FFFFFF");
		this.sun.addColorStop(0.3, "#FFEE88");
		this.sun.addColorStop(0.7, "#FFAA33");
		this.sun.addColorStop(1, "rgba(255, 100, 0, 0)");

		// sun glow
		const glowR = 150;
		this.glow = renderer.createRadialGradient(
			sunX,
			sunY,
			sunR * 0.5,
			sunX,
			sunY,
			glowR,
		);
		this.glow.addColorStop(0, "rgba(255, 200, 100, 0.3)");
		this.glow.addColorStop(1, "rgba(255, 100, 0, 0)");

		// health bar
		const barX = 30;
		const barW = 200;
		this.health = renderer.createLinearGradient(barX, 0, barX + barW, 0);
		this.health.addColorStop(0, "#00FF00");
		this.health.addColorStop(0.5, "#FFFF00");
		this.health.addColorStop(1, "#FF0000");

		// mana bar
		this.mana = renderer.createLinearGradient(barX, 0, barX + barW, 0);
		this.mana.addColorStop(0, "#0044FF");
		this.mana.addColorStop(0.5, "#00BBFF");
		this.mana.addColorStop(1, "#00FFFF");

		// metallic button
		const btnY = 110;
		const btnH = 40;
		this.btn = renderer.createLinearGradient(0, btnY, 0, btnY + btnH);
		this.btn.addColorStop(0, "#EEEEEE");
		this.btn.addColorStop(0.5, "#AAAAAA");
		this.btn.addColorStop(0.51, "#888888");
		this.btn.addColorStop(1, "#CCCCCC");

		// circle
		this.circleGrad = renderer.createRadialGradient(65, 190, 0, 65, 190, 25);
		this.circleGrad.addColorStop(0, "#FF6600");
		this.circleGrad.addColorStop(1, "#CC0000");

		// pill
		this.pillGrad = renderer.createLinearGradient(110, 0, 270, 0);
		this.pillGrad.addColorStop(0, "#00CC88");
		this.pillGrad.addColorStop(1, "#0066FF");

		// rainbow star
		const outerR = 45;
		const innerR = 20;
		const points = 5;
		const starVerts: { x: number; y: number }[] = [];
		for (let i = 0; i < points * 2; i++) {
			const angle = (i * Math.PI) / points - Math.PI / 2;
			const r = i % 2 === 0 ? outerR : innerR;
			starVerts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
		}
		this.star = new Polygon(330, 190, starVerts);
		this.rainbow = renderer.createRadialGradient(0, 0, 0, 0, 0, outerR);
		this.rainbow.addColorStop(0, "#FF0000");
		this.rainbow.addColorStop(0.2, "#FF8800");
		this.rainbow.addColorStop(0.4, "#FFFF00");
		this.rainbow.addColorStop(0.6, "#00FF00");
		this.rainbow.addColorStop(0.8, "#0088FF");
		this.rainbow.addColorStop(1, "#8800FF");

		// vignette
		const vigR = Math.max(w, h) * 0.7;
		this.vig = renderer.createRadialGradient(
			w / 2,
			h / 2,
			vigR * 0.3,
			w / 2,
			h / 2,
			vigR,
		);
		this.vig.addColorStop(0, "rgba(0, 0, 0, 0)");
		this.vig.addColorStop(1, "rgba(0, 0, 0, 0.5)");
	}

	draw(renderer: Renderer) {
		const w = this.width;
		const h = this.height;
		const sunX = w * 0.75;
		const sunY = h * 0.35;
		const sunR = 60;
		const glowR = 150;
		const barX = 30;
		const barY = 30;
		const barW = 200;
		const barH = 24;
		const healthPct = 0.7;
		const manaY = barY + barH + 10;

		// sky
		renderer.setColor(this.sky);
		renderer.fillRect(0, 0, w, h * 0.6);

		// ground
		renderer.setColor(this.ground);
		renderer.fillRect(0, h * 0.6, w, h * 0.4);

		// sun
		renderer.setColor(this.sun);
		renderer.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

		// sun glow
		renderer.setColor(this.glow);
		renderer.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);

		// health bar
		renderer.setColor("#333333");
		renderer.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
		renderer.setColor(this.health);
		renderer.fillRect(barX, barY, barW * healthPct, barH);

		// mana bar
		renderer.setColor("#333333");
		renderer.fillRect(barX - 2, manaY - 2, barW + 4, barH + 4);
		renderer.setColor(this.mana);
		renderer.fillRect(barX, manaY, barW * 0.5, barH);

		// metallic button
		renderer.setColor(this.btn);
		renderer.fillRect(30, 110, 160, 40);
		renderer.setColor("#666666");
		renderer.strokeRect(30, 110, 160, 40);

		// gradient shapes
		renderer.setColor(this.circleGrad);
		renderer.fillEllipse(65, 190, 25, 25);

		renderer.setColor(this.pillGrad);
		renderer.fillRoundRect(110, 175, 160, 30, 15);

		renderer.setColor(this.rainbow);
		renderer.fill(this.star);

		// vignette
		renderer.setColor(this.vig);
		renderer.fillRect(0, 0, w, h);

		renderer.setColor("#FFFFFF");
	}
}

class GradientScreen extends Stage {
	override onResetEvent(app: Application) {
		app.world.backgroundColor.parseCSS("#000000");
		app.world.addChild(new GradientShowcase());
	}
}

const createGame = () => {
	const _app = new App(1024, 768, {
		parent: "screen",
		scale: "auto",
		scaleMethod: "flex-width",
	});

	state.set(state.PLAY, new GradientScreen());
	state.change(state.PLAY);
};

export const ExampleGradients = createExampleComponent(createGame);
