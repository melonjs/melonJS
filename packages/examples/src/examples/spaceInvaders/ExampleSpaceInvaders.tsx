import {
	Body,
	Container,
	collision,
	game,
	input,
	loader,
	math,
	pool,
	Rect,
	Renderable,
	ScaleMethods,
	Sprite,
	Stage,
	state,
	timer,
	video,
} from "melonjs";
import { createExampleComponent } from "../utils";
import playerImg from "./assets/img/player.png";
import shipsImg from "./assets/img/ships.png";

// ---- Constants ----

const LASER_WIDTH = 5;
const LASER_HEIGHT = 28;

// ---- Resources ----

const resources = [
	{ name: "player", type: "image", src: playerImg },
	{ name: "ships", type: "image", src: shipsImg },
];

// ---- Laser ----

class Laser extends Renderable {
	body: Body;

	constructor(x: number, y: number) {
		super(x, y, LASER_WIDTH, LASER_HEIGHT);

		this.body = new Body(this);
		this.body.addShape(new Rect(0, 0, this.width, this.height));
		this.body.vel.set(0, -7);
		this.body.force.set(0, -3);
		this.body.setMaxVelocity(3, 7);
		this.body.collisionType = collision.types.PROJECTILE_OBJECT;
		this.body.ignoreGravity = true;

		this.alwaysUpdate = true;
	}

	onResetEvent(x: number, y: number) {
		this.pos.set(x, y);
	}

	update(dt: number): boolean {
		if (this.pos.y + this.height <= 0) {
			game.world.removeChild(this);
		}
		return super.update(dt);
	}

	onCollision(_response: object, other: { body: Body }): boolean {
		if (other.body.collisionType === collision.types.ENEMY_OBJECT) {
			game.world.removeChild(this);
			return false;
		}
		return false;
	}

	draw(renderer: {
		getColor: () => string;
		setColor: (c: string) => void;
		fillRect: (x: number, y: number, w: number, h: number) => void;
	}) {
		const color = renderer.getColor();
		renderer.setColor("#5EFF7E");
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
		renderer.setColor(color);
	}
}

// ---- Enemy ----

class EnemyEntity extends Sprite {
	body: Body;

	constructor(x: number, y: number) {
		super(x, y, {
			image: "ships",
			framewidth: 32,
			frameheight: 32,
		});

		this.body = new Body(this);
		this.body.addShape(new Rect(0, 0, this.width, this.height));
		this.body.collisionType = collision.types.ENEMY_OBJECT;
		this.body.ignoreGravity = true;

		this.addAnimation("idle", [math.random(0, 4)], 1);
		this.setCurrentAnimation("idle");
	}

	onCollision(_response: object, other: { body: Body }): boolean {
		if (other.body.collisionType === collision.types.PROJECTILE_OBJECT) {
			(this.ancestor as Container).removeChild(this);
			return false;
		}
		return false;
	}
}

// ---- Enemy Manager ----

class EnemyManager extends Container {
	static COLS = 9;
	static ROWS = 4;

	vel: number;
	timer: number;

	constructor() {
		super(32, 32, EnemyManager.COLS * 64 - 32, EnemyManager.ROWS * 64 - 32);

		this.enableChildBoundsUpdate = true;
		this.vel = 16;
		this.timer = -1;

		this.onChildChange = () => {
			if (this.children.length === 0) {
				(state.current() as PlayScreen).reset();
			}
		};
	}

	createEnemies() {
		for (let i = 0; i < EnemyManager.COLS; i++) {
			for (let j = 0; j < EnemyManager.ROWS; j++) {
				const enemy = new EnemyEntity(i * 64, j * 64);
				this.addChild(enemy);
			}
		}
	}

	onActivateEvent() {
		this.timer = timer.setInterval(() => {
			const bounds = this.getBounds();

			if (
				(this.vel > 0 && bounds.right + this.vel >= game.viewport.width) ||
				(this.vel < 0 && bounds.left + this.vel <= 0)
			) {
				this.vel *= -1;
				this.pos.y += 16;

				if (this.vel > 0) {
					this.vel += 5;
				} else {
					this.vel -= 5;
				}

				const currentState = state.current();
				if (currentState instanceof PlayScreen) {
					currentState.checkIfLoss(bounds.bottom);
				}
			} else {
				this.pos.x += this.vel;
			}
		}, 250);
	}

	onDeactivateEvent() {
		timer.clearInterval(this.timer);
	}
}

// ---- Player ----

class PlayerEntity extends Sprite {
	velx: number;
	maxX: number;

	constructor() {
		const image = loader.getImage("player") as HTMLImageElement;

		super(
			game.viewport.width / 2 - image.width / 2,
			game.viewport.height - image.height - 20,
			{ image: image, width: 32, height: 32 },
		);

		this.velx = 450;
		this.maxX = game.viewport.width - this.width;
	}

	update(dt: number): boolean {
		super.update(dt);

		if (input.isKeyPressed("left")) {
			this.pos.x -= (this.velx * dt) / 1000;
		}

		if (input.isKeyPressed("right")) {
			this.pos.x += (this.velx * dt) / 1000;
		}

		if (input.isKeyPressed("shoot")) {
			game.world.addChild(
				pool.pull(
					"laser",
					this.getBounds().centerX - LASER_WIDTH / 2,
					this.getBounds().top,
				) as Renderable,
			);
		}

		this.pos.x = math.clamp(this.pos.x, 32, this.maxX);

		return true;
	}
}

// ---- Play Screen ----

class PlayScreen extends Stage {
	player!: PlayerEntity;
	enemyManager!: EnemyManager;

	onResetEvent() {
		game.world.backgroundColor.parseCSS("#000000");

		this.player = new PlayerEntity();
		game.world.addChild(this.player, 1);

		this.enemyManager = new EnemyManager();
		this.enemyManager.createEnemies();
		game.world.addChild(this.enemyManager, 2);

		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.SPACE, "shoot", true);
	}

	onDestroyEvent() {
		input.unbindKey(input.KEY.LEFT);
		input.unbindKey(input.KEY.RIGHT);
		input.unbindKey(input.KEY.A);
		input.unbindKey(input.KEY.D);
		input.unbindKey(input.KEY.SPACE);
	}

	checkIfLoss(y: number) {
		if (y >= this.player.pos.y) {
			this.reset();
		}
	}
}

// ---- Game entry point ----

const createGame = () => {
	if (
		!video.init(800, 600, {
			parent: "screen",
			scale: "auto",
			scaleMethod: ScaleMethods.FlexWidth,
			renderer: video.AUTO,
		})
	) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	loader.preload(resources, () => {
		state.set(state.PLAY, new PlayScreen());

		pool.register("laser", Laser, true);

		state.change(state.PLAY);
	});
};

export const ExampleSpaceInvaders = createExampleComponent(createGame);
