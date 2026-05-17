/**
 * melonJS — SVG shape parsing + rendering example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type CanvasRenderer,
	game,
	Renderable,
	video,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const createGame = () => {
	// Initialize the video.
	if (
		!video.init(1024, 768, {
			parent: "screen",
			renderer: video.WEBGL,
			preferWebGL1: false,
			blendMode: "normal",
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	class SVGShapes extends Renderable {
		constructor() {
			super(0, 0, game.viewport.width, game.viewport.height);
			this.anchorPoint.set(0, 0);
		}

		override update() {
			return true;
		}

		drawSVGShape(
			renderer: WebGLRenderer | CanvasRenderer,
			svgPath: string,
			x: number,
			y: number,
			strokeColor: string,
			fillColor?: string,
		) {
			renderer.save();
			renderer.translate(x, y);
			renderer.path2D.parseSVGPath(svgPath);
			if (fillColor) {
				renderer.setColor(fillColor);
				renderer.fill();
				// re-parse for stroke since fill consumed the path
				renderer.path2D.parseSVGPath(svgPath);
			}
			renderer.setColor(strokeColor);
			renderer.stroke();
			renderer.restore();
		}

		override draw(renderer: WebGLRenderer | CanvasRenderer) {
			renderer.clearColor("#1a1a2e");
			renderer.setGlobalAlpha(1.0);
			renderer.lineWidth = 4;

			// --- Row 1: Game icons using M/L/Z ---

			// Sword
			this.drawSVGShape(
				renderer,
				"M 40 0 L 45 60 L 55 65 L 55 70 L 45 70 L 45 90 L 50 95 L 50 100 L 30 100 L 30 95 L 35 90 L 35 70 L 25 70 L 25 65 L 35 60 Z",
				70,
				20,
				"#B0BEC5",
				"#78909C",
			);

			// Gem / diamond
			this.drawSVGShape(
				renderer,
				"M 40 0 L 75 10 L 80 30 L 40 80 L 0 30 L 5 10 Z",
				195,
				20,
				"#00BCD4",
				"#006064",
			);

			// Crown
			this.drawSVGShape(
				renderer,
				"M 0 70 L 0 30 L 25 50 L 45 10 L 65 50 L 90 30 L 90 70 Z",
				345,
				25,
				"#FFD600",
				"#F9A825",
			);

			// Potion bottle
			this.drawSVGShape(
				renderer,
				"M 30 0 L 50 0 L 50 15 L 60 30 L 60 75 L 55 80 L 25 80 L 20 75 L 20 30 L 30 15 Z",
				510,
				15,
				"#7B1FA2",
				"#CE93D8",
			);

			// Treasure chest
			this.drawSVGShape(
				renderer,
				"M 0 35 L 10 10 L 80 10 L 90 35 L 90 75 L 0 75 Z",
				655,
				20,
				"#8D6E63",
				"#795548",
			);

			// Shield
			this.drawSVGShape(
				renderer,
				"M 45 0 L 90 15 L 85 55 L 45 90 L 5 55 L 0 15 Z",
				830,
				10,
				"#C62828",
				"#EF5350",
			);

			// --- Row 2: Game elements using Q curves ---

			// Ghost (pac-man style)
			this.drawSVGShape(
				renderer,
				"M 0 80 L 0 35 Q 0 0 40 0 Q 80 0 80 35 L 80 80 Q 70 65 60 80 Q 50 65 40 80 Q 30 65 20 80 Q 10 65 0 80 Z",
				60,
				165,
				"#E91E63",
				"#F48FB1",
			);

			// Mushroom / power-up
			this.drawSVGShape(
				renderer,
				"M 0 45 Q 0 0 50 0 Q 100 0 100 45 L 85 45 L 85 50 L 75 80 L 25 80 L 15 50 L 15 45 Z",
				195,
				165,
				"#D32F2F",
				"#EF9A9A",
			);

			// Key
			this.drawSVGShape(
				renderer,
				"M 25 0 Q 50 0 50 25 Q 50 42 35 48 L 35 70 L 45 70 L 45 78 L 35 78 L 35 90 L 15 90 L 15 48 Q 0 42 0 25 Q 0 0 25 0 Z",
				370,
				155,
				"#FFC107",
				"#FFD54F",
			);

			// Speech bubble
			this.drawSVGShape(
				renderer,
				"M 10 0 L 90 0 Q 100 0 100 10 L 100 50 Q 100 60 90 60 L 40 60 L 20 80 L 25 60 L 10 60 Q 0 60 0 50 L 0 10 Q 0 0 10 0 Z",
				500,
				165,
				"#333333",
				"#FAFAFA",
			);

			// Bomb
			this.drawSVGShape(
				renderer,
				"M 35 10 L 45 10 L 45 25 Q 80 25 80 55 Q 80 85 40 85 Q 0 85 0 55 Q 0 25 35 25 Z",
				665,
				155,
				"#333333",
				"#424242",
			);

			// Lightning bolt
			this.drawSVGShape(
				renderer,
				"M 45 0 L 15 45 L 35 45 L 20 90 L 70 35 L 48 35 L 65 0 Z",
				850,
				155,
				"#FF6F00",
				"#FFB300",
			);

			// --- Row 3: Complex game shapes using C curves ---

			// Dragon wing
			this.drawSVGShape(
				renderer,
				"M 0 80 C 5 40 20 10 60 0 C 45 20 50 35 55 50 C 70 25 85 15 110 10 C 90 30 85 45 80 60 C 100 45 110 40 120 38 C 105 55 90 70 50 85 Z",
				35,
				340,
				"#4A148C",
				"#7E57C2",
			);

			// Flame
			this.drawSVGShape(
				renderer,
				"M 40 90 C 10 70 -5 40 15 10 C 20 30 30 35 40 15 C 50 35 60 30 65 10 C 85 40 70 70 40 90 Z",
				200,
				330,
				"#E65100",
				"#FF9800",
			);

			// Tree
			this.drawSVGShape(
				renderer,
				"M 45 95 L 35 95 L 35 70 C 10 70 0 50 15 35 C 5 30 0 15 20 5 C 30 -5 50 -5 60 5 C 80 15 75 30 65 35 C 80 50 70 70 45 70 Z",
				380,
				320,
				"#1B5E20",
				"#4CAF50",
			);

			// Cloud
			this.drawSVGShape(
				renderer,
				"M 30 60 C 0 60 0 35 15 25 C 5 10 25 0 40 10 C 45 0 70 0 75 15 C 90 5 110 20 100 35 C 115 45 105 65 85 60 Z",
				530,
				340,
				"#546E7A",
				"#ECEFF1",
			);

			// Skull
			this.drawSVGShape(
				renderer,
				"M 40 0 C 0 0 0 35 0 50 C 0 70 15 80 25 80 L 25 90 L 32 90 L 32 80 L 38 80 L 38 90 L 45 90 L 45 80 L 52 80 L 52 90 L 58 90 L 58 80 C 68 80 80 70 80 50 C 80 35 80 0 40 0 Z",
				690,
				320,
				"#F5F5F5",
				"#E0E0E0",
			);

			// Spaceship
			this.drawSVGShape(
				renderer,
				"M 40 0 C 45 10 50 30 50 50 L 65 70 L 65 85 L 50 70 L 50 90 L 40 95 L 30 90 L 30 70 L 15 85 L 15 70 L 30 50 C 30 30 35 10 40 0 Z",
				855,
				315,
				"#00BCD4",
				"#0097A7",
			);

			// --- Row 4: Arcs (A command) - ticket #1198 ---

			renderer.setGlobalAlpha(0.9);

			// Heart from ticket #1198
			this.drawSVGShape(
				renderer,
				"M 10 30 A 20 20 0 0 1 50 30 A 20 20 0 0 1 90 30 Q 90 60 50 90 Q 10 60 10 30 Z",
				60,
				540,
				"#B71C1C",
				"#EF5350",
			);

			// Pac-Man
			this.drawSVGShape(
				renderer,
				"M 50 25 L 85 50 L 50 75 A 35 35 0 1 0 50 25 Z",
				200,
				530,
				"#F57F17",
				"#FFEE58",
			);

			// Coin (elliptical arc)
			this.drawSVGShape(
				renderer,
				"M 0 40 A 50 40 0 0 1 100 40 A 50 40 0 0 1 0 40 Z",
				370,
				545,
				"#F9A825",
				"#FDD835",
			);

			// Rotated ellipse (demonstrates ellipse() rotation bug)
			renderer.save();
			renderer.translate(580, 580);
			renderer.path2D.beginPath();
			renderer.path2D.ellipse(0, 0, 60, 30, Math.PI / 4, 0, Math.PI * 2);
			renderer.setColor("#BA68C8");
			renderer.fill();
			renderer.path2D.ellipse(0, 0, 60, 30, Math.PI / 4, 0, Math.PI * 2);
			renderer.setColor("#4A148C");
			renderer.stroke();
			renderer.restore();

			// Crescent moon
			this.drawSVGShape(
				renderer,
				"M 40 0 A 40 40 0 1 1 40 80 A 30 40 0 1 0 40 0 Z",
				700,
				530,
				"#F9A825",
				"#FFF176",
			);

			// Pill / health capsule
			this.drawSVGShape(
				renderer,
				"M 25 0 L 75 0 A 25 25 0 0 1 75 50 L 25 50 A 25 25 0 0 1 25 0 Z",
				850,
				555,
				"#00695C",
				"#80CBC4",
			);

			renderer.setGlobalAlpha(1.0);

			// --- Row dividers ---
			renderer.setColor("#333355");
			renderer.beginPath();
			renderer.moveTo(20, 140);
			renderer.lineTo(1004, 140);
			renderer.moveTo(20, 310);
			renderer.lineTo(1004, 310);
			renderer.moveTo(20, 500);
			renderer.lineTo(1004, 500);
			renderer.stroke();
		}
	}

	game.world.addChild(new SVGShapes());
};

export const ExampleSVGShapes = createExampleComponent(createGame);
