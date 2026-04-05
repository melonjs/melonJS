import {
	Application,
	type CanvasRenderer,
	Color,
	Ellipse,
	Matrix2d,
	Polygon,
	Renderable,
	RoundRect,
	Tween,
	type WebGLRenderer,
} from "melonjs";
import { createExampleComponent } from "../utils";

const createGame = () => {
	const _app = new Application(1024, 768, {
		parent: "screen",
	});

	class Graphics extends Renderable {
		starMask: Polygon;
		polymask: Polygon;
		circleMask: Ellipse;
		stripe1: Polygon;
		stripe2: Polygon;
		stripe3: Polygon;
		stripe4: Polygon;
		stripe5: Polygon;
		roundRect1: RoundRect;
		roundRect2: RoundRect;
		rrect1Tween: Tween;
		rrect2Tween: Tween;
		color: Color;
		filledEllipse: Ellipse;
		ellipseTime: number;
		arcAngle: number;
		starAngle: number;
		transformMatrix: Matrix2d;
		// constructor
		constructor() {
			super(0, 0, 1024, 768);

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

			this.circleMask = new Ellipse(630 + 50, 560 + 50, 200, 200);

			// Commodore rainbow stripes
			const bw = 20;
			this.stripe1 = new Polygon(0, 0, [
				{ x: 0, y: bw },
				{ x: 0, y: 0 },
				{ x: bw, y: 0 },
			]);
			this.stripe2 = new Polygon(0, 0, [
				{ x: 0, y: bw },
				{ x: bw, y: 0 },
				{ x: bw * 2, y: 0 },
				{ x: 0, y: bw * 2 },
			]);
			this.stripe3 = new Polygon(0, 0, [
				{ x: 0, y: bw * 2 },
				{ x: bw * 2, y: 0 },
				{ x: bw * 3, y: 0 },
				{ x: 0, y: bw * 3 },
			]);
			this.stripe4 = new Polygon(0, 0, [
				{ x: 0, y: bw * 3 },
				{ x: bw * 3, y: 0 },
				{ x: bw * 4, y: 0 },
				{ x: 0, y: bw * 4 },
			]);
			this.stripe5 = new Polygon(0, 0, [
				{ x: 0, y: bw * 4 },
				{ x: bw * 4, y: 0 },
				{ x: bw * 5, y: 0 },
				{ x: 0, y: bw * 5 },
			]);

			this.roundRect1 = new RoundRect(100, 530, 400, 180, 4);
			this.roundRect2 = new RoundRect(105, 535, 390, 170, 4);

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

			// rotating + transformed ellipse
			this.filledEllipse = new Ellipse(860, 460, 200, 100);
			this.transformMatrix = new Matrix2d();
			this.ellipseTime = 0;
			this.arcAngle = 0;
			this.starAngle = 0;

			// a temporary color object
			this.color = new Color();

			this.anchorPoint.set(0, 0);
		}

		override update(dt: number) {
			this.ellipseTime += dt;
			// reset and apply rotation + oscillating scale transform
			this.filledEllipse.setShape(860, 460, 200, 100);
			this.filledEllipse.rotate(this.ellipseTime / 1000);
			this.transformMatrix.identity();
			this.transformMatrix.scale(
				0.7 + 0.3 * Math.sin(this.ellipseTime / 800),
				0.7 + 0.3 * Math.cos(this.ellipseTime / 600),
			);
			this.filledEllipse.transform(this.transformMatrix);
			this.arcAngle += 0.01;
			this.starAngle += dt / 1000;
			return true;
		}

		// draw function
		override draw(renderer: WebGLRenderer | CanvasRenderer) {
			renderer.clearColor("#FFFFFF");

			renderer.setGlobalAlpha(1.0);

			renderer.lineWidth = 3;

			// draw Commodore rainbow stripes (red, orange, yellow, green, blue)
			renderer.setColor("#e02020");
			renderer.fill(this.stripe1);
			renderer.setColor("#e07020");
			renderer.fill(this.stripe2);
			renderer.setColor("#e0c020");
			renderer.fill(this.stripe3);
			renderer.setColor("#40a040");
			renderer.fill(this.stripe4);
			renderer.setColor("#40a0e0");
			renderer.fill(this.stripe5);

			renderer.setColor("#ffcc00");
			renderer.setGlobalAlpha(0.375);
			this.polymask.rotate(0.05, this.polymask.getBounds().center);
			renderer.setMask(this.polymask);
			renderer.fill(this.polymask.getBounds());
			renderer.clearMask();

			// star bounding box with solid color
			renderer.setColor("#55aa00");
			renderer.setGlobalAlpha(0.5);
			renderer.fill(this.starMask.getBounds());
			renderer.setGlobalAlpha(1.0);
			renderer.stroke(this.starMask.getBounds());

			// animated star with rotating gradient
			const starBounds = this.starMask.getBounds();
			// gradient coords are relative to polygon pos (fill translates by pos)
			const scx = starBounds.x - this.starMask.pos.x + starBounds.width / 2;
			const scy = starBounds.y - this.starMask.pos.y + starBounds.height / 2;
			const sr = Math.max(starBounds.width, starBounds.height) / 2;
			const cos = Math.cos(this.starAngle);
			const sin = Math.sin(this.starAngle);
			const starGrad = renderer.createLinearGradient(
				scx + cos * sr,
				scy + sin * sr,
				scx - cos * sr,
				scy - sin * sr,
			);
			starGrad.addColorStop(0, "#55aa00");
			starGrad.addColorStop(0.5, "#88cc33");
			starGrad.addColorStop(1, "#337700");
			renderer.setColor(starGrad);
			renderer.fill(this.starMask);
			renderer.setGlobalAlpha(0.5);
			renderer.setColor("#336600");
			renderer.stroke(this.starMask);
			renderer.setGlobalAlpha(1.0);

			renderer.setGlobalAlpha(0.5);

			renderer.setColor("#e15d55");
			renderer.save();
			renderer.translate(740, 260);
			renderer.rotate(this.arcAngle);
			renderer.strokeArc(0, 0, 110, Math.PI, 0);
			renderer.fillArc(0, 0, 110, 0, Math.PI);
			renderer.restore();

			renderer.setColor("#00aa88");
			renderer.translate(25, 0);
			renderer.setMask(this.circleMask);
			renderer.fillRect(580, 510, 200, 200);
			renderer.strokeEllipse(630 + 50, 560 + 50, 70, 70);
			renderer.strokeRect(600, 530, 160, 160);
			renderer.clearMask();

			renderer.beginPath();
			renderer.setColor("blue");

			renderer.moveTo(540, 30);
			renderer.lineTo(640, 55);
			renderer.lineTo(740, 30);
			renderer.lineTo(840, 55);
			renderer.lineTo(940, 30);

			renderer.stroke();

			// dashed zigzag line
			renderer.setLineDash([10, 6]);
			renderer.beginPath();
			renderer.moveTo(540, 50);
			renderer.lineTo(640, 75);
			renderer.lineTo(740, 50);
			renderer.lineTo(840, 75);
			renderer.lineTo(940, 50);
			renderer.stroke();
			renderer.setLineDash([]);

			// animated cubic bezier curve
			const wave = Math.sin(this.ellipseTime / 500) * 50;
			renderer.beginPath();
			renderer.setColor("#10b981");
			renderer.moveTo(540, 100);
			renderer.bezierCurveTo(640, 30 - wave, 840, 170 + wave, 940, 100);
			renderer.stroke();

			// animated dashed quadratic bezier curve (inverted)
			renderer.setLineDash([8, 4]);
			renderer.beginPath();
			renderer.setColor("#f59e0b");
			renderer.moveTo(540, 100);
			renderer.quadraticCurveTo(740, 130 - wave, 940, 100);
			renderer.stroke();
			renderer.setLineDash([]);

			renderer.setColor("#ff69b4");
			renderer.fill(this.roundRect1);
			renderer.setColor("#ff1493");
			renderer.stroke(this.roundRect2);

			// rotating ellipse (filled + stroked border)
			renderer.setGlobalAlpha(0.6);
			renderer.setColor("#6366f1");
			renderer.fill(this.filledEllipse);
			renderer.setGlobalAlpha(1.0);
			renderer.setColor("#4f46e5");
			renderer.stroke(this.filledEllipse);
		}
	}

	_app.world.addChild(new Graphics());
};
export const ExampleGraphics = createExampleComponent(createGame);
