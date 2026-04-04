import {
	Application as App,
	type Application,
	type CanvasRenderer,
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
 */
class GradientShowcase extends Renderable {
	constructor() {
		super(0, 0, 1024, 768);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	draw(renderer: Renderer) {
		const w = this.width;
		const h = this.height;

		// ---- Sky background (linear gradient, top to bottom) ----
		const sky = renderer.createLinearGradient(0, 0, 0, h * 0.6);
		sky.addColorStop(0, "#0B0B3B");
		sky.addColorStop(0.4, "#1a1a6e");
		sky.addColorStop(0.7, "#4a2080");
		sky.addColorStop(1, "#FF6B35");
		renderer.setColor(sky);
		renderer.fillRect(0, 0, w, h * 0.6);

		// ---- Ground (linear gradient) ----
		const ground = renderer.createLinearGradient(0, h * 0.6, 0, h);
		ground.addColorStop(0, "#2d5016");
		ground.addColorStop(0.5, "#1a3a0a");
		ground.addColorStop(1, "#0d1f05");
		renderer.setColor(ground);
		renderer.fillRect(0, h * 0.6, w, h * 0.4);

		// ---- Sun (radial gradient) ----
		const sunX = w * 0.75;
		const sunY = h * 0.35;
		const sunR = 60;
		const sun = renderer.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
		sun.addColorStop(0, "#FFFFFF");
		sun.addColorStop(0.3, "#FFEE88");
		sun.addColorStop(0.7, "#FFAA33");
		sun.addColorStop(1, "rgba(255, 100, 0, 0)");
		renderer.setColor(sun);
		renderer.fillRect(sunX - sunR, sunY - sunR, sunR * 2, sunR * 2);

		// ---- Sun glow (larger radial gradient) ----
		const glowR = 150;
		const glow = renderer.createRadialGradient(
			sunX,
			sunY,
			sunR * 0.5,
			sunX,
			sunY,
			glowR,
		);
		glow.addColorStop(0, "rgba(255, 200, 100, 0.3)");
		glow.addColorStop(1, "rgba(255, 100, 0, 0)");
		renderer.setColor(glow);
		renderer.fillRect(sunX - glowR, sunY - glowR, glowR * 2, glowR * 2);

		// ---- Health bar background ----
		const barX = 30;
		const barY = 30;
		const barW = 200;
		const barH = 24;
		renderer.setColor("#333333");
		renderer.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

		// ---- Health bar fill (linear gradient, green to yellow to red) ----
		const healthPct = 0.7;
		const health = renderer.createLinearGradient(barX, 0, barX + barW, 0);
		health.addColorStop(0, "#00FF00");
		health.addColorStop(0.5, "#FFFF00");
		health.addColorStop(1, "#FF0000");
		renderer.setColor(health);
		renderer.fillRect(barX, barY, barW * healthPct, barH);

		// ---- Mana bar (blue gradient) ----
		const manaY = barY + barH + 10;
		renderer.setColor("#333333");
		renderer.fillRect(barX - 2, manaY - 2, barW + 4, barH + 4);
		const mana = renderer.createLinearGradient(barX, 0, barX + barW, 0);
		mana.addColorStop(0, "#0044FF");
		mana.addColorStop(0.5, "#00BBFF");
		mana.addColorStop(1, "#00FFFF");
		renderer.setColor(mana);
		renderer.fillRect(barX, manaY, barW * 0.5, barH);

		// ---- Metallic button (vertical linear gradient) ----
		const btnX = 30;
		const btnY = 110;
		const btnW = 160;
		const btnH = 40;
		const btn = renderer.createLinearGradient(0, btnY, 0, btnY + btnH);
		btn.addColorStop(0, "#EEEEEE");
		btn.addColorStop(0.5, "#AAAAAA");
		btn.addColorStop(0.51, "#888888");
		btn.addColorStop(1, "#CCCCCC");
		renderer.setColor(btn);
		renderer.fillRect(btnX, btnY, btnW, btnH);

		// button border
		renderer.setColor("#666666");
		renderer.strokeRect(btnX, btnY, btnW, btnH);

		// ---- Gradient on shapes ----

		// gradient-filled circle
		const circleGrad = renderer.createRadialGradient(65, 190, 0, 65, 190, 25);
		circleGrad.addColorStop(0, "#FF6600");
		circleGrad.addColorStop(1, "#CC0000");
		renderer.setColor(circleGrad);
		renderer.fillEllipse(65, 190, 25, 25);

		// gradient-filled rounded rect (pill)
		const pillGrad = renderer.createLinearGradient(110, 0, 270, 0);
		pillGrad.addColorStop(0, "#00CC88");
		pillGrad.addColorStop(1, "#0066FF");
		renderer.setColor(pillGrad);
		renderer.fillRoundRect(110, 175, 160, 30, 15);

		// ---- Rainbow star (gradient on polygon) ----
		const starCx = 330;
		const starCy = 190;
		const outerR = 45;
		const innerR = 20;
		const points = 5;
		const starVerts: { x: number; y: number }[] = [];
		for (let i = 0; i < points * 2; i++) {
			const angle = (i * Math.PI) / points - Math.PI / 2;
			const r = i % 2 === 0 ? outerR : innerR;
			starVerts.push({
				x: Math.cos(angle) * r,
				y: Math.sin(angle) * r,
			});
		}
		// gradient coords are relative to the polygon's pos since
		// fillPolygon translates the context by poly.pos
		const rainbow = renderer.createRadialGradient(0, 0, 0, 0, 0, outerR);
		rainbow.addColorStop(0, "#FF0000");
		rainbow.addColorStop(0.2, "#FF8800");
		rainbow.addColorStop(0.4, "#FFFF00");
		rainbow.addColorStop(0.6, "#00FF00");
		rainbow.addColorStop(0.8, "#0088FF");
		rainbow.addColorStop(1, "#8800FF");
		renderer.setColor(rainbow);
		renderer.fill(new Polygon(starCx, starCy, starVerts));

		// ---- Spotlight / vignette effect (large radial gradient) ----
		const vigR = Math.max(w, h) * 0.7;
		const vig = renderer.createRadialGradient(
			w / 2,
			h / 2,
			vigR * 0.3,
			w / 2,
			h / 2,
			vigR,
		);
		vig.addColorStop(0, "rgba(0, 0, 0, 0)");
		vig.addColorStop(1, "rgba(0, 0, 0, 0.5)");
		renderer.setColor(vig);
		renderer.fillRect(0, 0, w, h);

		// ---- Labels ----
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
