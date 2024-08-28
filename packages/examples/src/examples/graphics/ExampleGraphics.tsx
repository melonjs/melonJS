import {
	type CanvasRenderer,
	Color,
	Ellipse,
	Polygon,
	Renderable,
	RoundRect,
	Tween,
	type WebGLRenderer,
	game,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

const createGame = () => {
	// Initialize the video.
	if (
		!video.init(1024, 768, {
			parent: "screen",
			renderer: video.AUTO,
			preferWebGL1: false,
			blendMode: "normal",
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	class Graphics extends Renderable {
		starMask: Polygon;
		polymask: Polygon;
		circleMask: Ellipse;
		stripe1: Polygon;
		stripe2: Polygon;
		stripe3: Polygon;
		roundRect1: RoundRect;
		roundRect2: RoundRect;
		rrect1Tween: Tween;
		rrect2Tween: Tween;
		color: Color;
		// constructor
		constructor() {
			super(0, 0, game.viewport.width, game.viewport.height);

			this.starMask = new Polygon(300, 70, [
				// draw a star
				{ x: 0, y: 0 },
				{ x: 14, y: 30 },
				{ x: 47, y: 35 },
				{ x: 23, y: 57 },
				{ x: 44, y: 90 },
				{ x: 0, y: 62 },
				{ x: -44, y: 90 },
				{ x: -23, y: 57 },
				{ x: -47, y: 35 },
				{ x: -14, y: 30 },
			]);

			this.polymask = new Polygon(0, 0, [
				{ x: 155, y: 77 },
				{ x: 105, y: 77 },
				{ x: 80, y: 120 },
				{ x: 105, y: 163 },
				{ x: 155, y: 163 },
				{ x: 180, y: 120 },
			]);

			this.starMask.scale(4.0);
			this.polymask.scale(4.0);

			this.circleMask = new Ellipse(630 + 50, 520 + 50, 200, 200);

			this.stripe1 = new Polygon(0, 0, [
				{ x: 0, y: 40 },
				{ x: 0, y: 0 },
				{ x: 40, y: 0 },
			]);
			this.stripe2 = new Polygon(0, 0, [
				{ x: 0, y: 40 },
				{ x: 40, y: 0 },
				{ x: 60, y: 0 },
				{ x: 0, y: 60 },
			]);
			this.stripe3 = new Polygon(0, 0, [
				{ x: 0, y: 60 },
				{ x: 60, y: 0 },
				{ x: 80, y: 0 },
				{ x: 0, y: 80 },
			]);

			this.roundRect1 = new RoundRect(100, 500, 400, 220, 4);
			this.roundRect2 = new RoundRect(105, 505, 390, 210, 4);

			this.rrect1Tween = new Tween(this.roundRect1).to(
				{ radius: 100 },
				{
					duration: 1000,
					easing: Tween.Easing.Linear.None,
					yoyo: true,
					repeat: Number.POSITIVE_INFINITY,
					autoStart: true,
				},
			);
			this.rrect2Tween = new Tween(this.roundRect2).to(
				{ radius: 100 },
				{
					duration: 1000,
					easing: Tween.Easing.Linear.None,
					yoyo: true,
					repeat: Number.POSITIVE_INFINITY,
					autoStart: true,
				},
			);

			// a temporary color object
			this.color = new Color();

			this.anchorPoint.set(0, 0);
		}

		override update() {
			return true;
		}

		// draw function
		override draw(renderer: WebGLRenderer | CanvasRenderer) {
			renderer.clearColor("#FFFFFF");

			renderer.setGlobalAlpha(1.0);

			// draw 3 stripes
			this.color.parseHex("#55aa00");
			renderer.setColor(this.color);
			renderer.fill(this.stripe1);
			renderer.setColor("#ffcc00");
			// lerp from the the starting color and the current renderer one
			renderer.setColor(this.color.lerp(renderer.getColor(), 0.5));
			renderer.fill(this.stripe2);
			renderer.setColor("#ffcc00");
			renderer.fill(this.stripe3);

			renderer.setColor("#ffcc00");
			renderer.setGlobalAlpha(0.375);
			this.polymask.rotate(0.05, this.polymask.getBounds().center);
			renderer.setMask(this.polymask);
			renderer.fill(this.polymask.getBounds());
			renderer.clearMask();

			renderer.setColor("#55aa00");
			renderer.fill(this.starMask);
			renderer.setGlobalAlpha(0.5);
			renderer.stroke(this.starMask);
			renderer.fill(this.starMask.getBounds());
			renderer.setGlobalAlpha(1.0);
			renderer.stroke(this.starMask.getBounds());

			renderer.setGlobalAlpha(0.5);

			renderer.setColor("#e15d55");
			renderer.strokeArc(740, 200, 110, Math.PI, 0);
			renderer.fillArc(740, 200, 110, 0, Math.PI);

			renderer.setColor("#00aa88");
			renderer.translate(25, 0);
			renderer.setMask(this.circleMask);
			renderer.fillRect(580, 470, 200, 200);
			renderer.strokeEllipse(630 + 50, 520 + 50, 70, 70);
			renderer.strokeRect(600, 490, 160, 160);
			renderer.clearMask();

			renderer.beginPath();
			renderer.setColor("blue");

			renderer.moveTo(865, 200);
			renderer.lineTo(915, 300);
			renderer.lineTo(865, 400);
			renderer.lineTo(915, 500);
			renderer.lineTo(865, 600);

			renderer.moveTo(900, 200);
			renderer.lineTo(950, 300);
			renderer.lineTo(900, 400);
			renderer.lineTo(950, 500);
			renderer.lineTo(900, 600);
			renderer.stroke();

			renderer.setColor("#ff69b4");
			renderer.fill(this.roundRect1);
			renderer.setColor("#ff1493");
			renderer.stroke(this.roundRect2);
		}
	}

	game.world.addChild(new Graphics());
};
export const ExampleGraphics = createExampleComponent(createGame);
