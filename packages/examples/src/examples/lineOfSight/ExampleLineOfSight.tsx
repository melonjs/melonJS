import {
	Body,
	Color,
	ColorLayer,
	collision,
	game,
	input,
	Line,
	Renderable,
	Stage,
	state,
	Vector2d,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";

class Square extends Renderable {
	selected: boolean;
	hover: boolean;
	grabOffset: Vector2d;
	color: Color;
	isColliding: boolean;
	body: Body;

	constructor(x: number, y: number, width: number, height: number) {
		super(x, y, width, height);
		this.anchorPoint.set(0, 0);
		const rect = this.getBounds().clone();
		rect.shift(0, 0);
		this.body = new Body(this, rect);
		this.body.setStatic();
		this.selected = false;
		this.hover = false;
		this.grabOffset = new Vector2d(0, 0);
		this.color = new Color(0, 255, 0);
		this.isColliding = false;
	}

	onActivateEvent() {
		input.registerPointerEvent("pointerdown", this, this.onSelect.bind(this));
		input.registerPointerEvent("pointerup", this, this.onRelease.bind(this));
		input.registerPointerEvent(
			"pointercancel",
			this,
			this.onRelease.bind(this),
		);
		input.registerPointerEvent(
			"pointermove",
			this,
			this.pointerMove.bind(this),
		);
	}

	pointerMove(event: { gameX: number; gameY: number }) {
		if (this.selected) {
			game.world.moveUp(this);
			this.pos.set(event.gameX, event.gameY, this.pos.z);
			this.pos.sub(this.grabOffset);
		}
	}

	onSelect(event: { gameX: number; gameY: number }) {
		if (this.selected === false) {
			const x = event.gameX - this.getBounds().x + this.body.getBounds().x;
			const y = event.gameY - this.getBounds().y + this.body.getBounds().y;
			if (this.body.contains(x, y)) {
				this.selected = true;
			}
			if (this.selected) {
				this.grabOffset.set(event.gameX, event.gameY);
				this.grabOffset.sub(this.pos);
			}
		}
		return this.selected;
	}

	onRelease() {
		this.selected = false;
		return false;
	}

	draw(renderer: CanvasRenderingContext2D | any) {
		const lineWidth = 2;
		if (this.isColliding) {
			this.color.setColor(255, 0, 0);
		} else {
			this.color.setColor(0, 255, 0);
		}
		renderer.setGlobalAlpha(0.5);
		renderer.setColor(this.color);
		renderer.translate(this.pos.x, this.pos.y);
		renderer.fillRect(0, 0, this.width, this.height);
		renderer.setGlobalAlpha(1.0);
		renderer.setLineWidth(lineWidth);
		renderer.strokeRect(
			lineWidth,
			lineWidth,
			this.width - lineWidth * 2,
			this.height - lineWidth * 2,
		);
		this.isColliding = false;
	}
}

class RotatingLine extends Renderable {
	line: Line;

	constructor() {
		super(0, 0, 10, 10);
		this.line = new Line(0, 0, [
			new Vector2d(game.viewport.width / 2, game.viewport.height / 2),
			new Vector2d(game.viewport.width, game.viewport.height),
		]);
	}

	update(_dt: number) {
		this.line.rotate(
			0.0125,
			new Vector2d(game.viewport.width / 2, game.viewport.height / 2),
		);
		const result = collision.rayCast(this.line);
		if (result.length > 0) {
			for (let i = 0; i < result.length; i++) {
				(result[i] as Square).isColliding = true;
			}
		}
		return true;
	}

	draw(renderer: CanvasRenderingContext2D | any) {
		renderer.setColor("red");
		renderer.stroke(this.line);
	}
}

class PlayScreen extends Stage {
	onResetEvent() {
		const rectSize = 150;
		game.world.addChild(new ColorLayer("background", "black"), 0);
		game.world.addChild(new Square(50, 50, rectSize, rectSize), 1);
		game.world.addChild(new Square(50, 400, rectSize, rectSize), 1);
		game.world.addChild(new Square(300, 125, rectSize, rectSize), 1);
		game.world.addChild(new Square(300, 350, rectSize, rectSize), 1);
		game.world.addChild(new Square(600, 200, rectSize, rectSize), 1);
		game.world.addChild(new Square(600, 400, rectSize, rectSize), 1);
		game.world.addChild(new RotatingLine(), 10);
	}
}

const createGame = () => {
	if (
		!video.init(800, 600, {
			scale: "auto",
			renderer: video.AUTO,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	state.set(state.PLAY, new PlayScreen());
	state.change(state.PLAY);
};

export const ExampleLineOfSight = createExampleComponent(createGame);
