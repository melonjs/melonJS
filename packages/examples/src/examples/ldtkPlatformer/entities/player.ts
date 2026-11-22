/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Application,
	collision,
	input,
	type LDtkEntitySettings,
	type LDtkProject,
	loader,
	Rect,
	type Renderable,
	Sprite,
	Vector2d,
} from "melonjs";
import { gameState } from "../gameState";
import { ldtkWorld, trackRoom } from "../rooms";
import { Item } from "./item";
import { Ladder, Teleport } from "./zones";

// in pixels per frame
const WALK = 2.5;
const JUMP = 8;
const CLIMB = 1.5;
const SINK = 1;
// a lighter gravity than the world's, for a jump of three tiles and a half
const GRAVITY = 0.6;
const WATER_GRAVITY = 0.2;
// frames out of every room before the player is put back where it stood
const LOST_AFTER = 45;

const SIZE = 16;

/**
 * The "Player" entity of the LDtk world: LDtk places one in the first room,
 * and the class registered under its name is what it becomes.
 */
export class Player extends Sprite {
	/** what the player touched during the last step */
	ladder: Ladder | undefined;
	teleport: Teleport | undefined;
	climbing = false;
	swimming = false;
	/** between two teleports: the screen is fading */
	travelling = false;
	/** the up key, last frame: a teleport is taken on a press, not a hold */
	wasUp = false;
	/** the last place the player stood on the ground, in a room */
	safe = new Vector2d();
	lost = 0;

	constructor(x: number, y: number, settings: LDtkEntitySettings) {
		// standing on the bottom of the entity's box, in its middle
		super(x + (settings.width - SIZE) / 2, y + settings.height - SIZE, {
			image: "ldtk-platformer-sprites",
			framewidth: SIZE,
			frameheight: SIZE,
			anchorPoint: { x: 0, y: 0 },
		});
		this.addAnimation("idle", [0]);
		this.addAnimation("walk", [1, 0, 2, 0], 110);
		this.addAnimation("jump", [3]);
		this.addAnimation("climb", [4, 5], 160);
		this.addAnimation("hang", [4]);
		this.setCurrentAnimation("idle");
		this.bodyDef = {
			type: "dynamic",
			// a little narrower than the tile, to pass a gap one tile wide
			shapes: [new Rect(4, 2, SIZE - 8, SIZE - 2)],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE |
				collision.types.COLLECTABLE_OBJECT |
				collision.types.ACTION_OBJECT,
			maxVelocity: { x: WALK, y: JUMP },
			frictionAir: { x: 0.5, y: 0 },
			gravityScale: GRAVITY,
		};
		// the player leaves the view while the screen fades between rooms
		this.alwaysUpdate = true;
		this.safe.set(this.pos.x, this.pos.y);

		input.bindKey(input.KEY.LEFT, "left");
		input.bindKey(input.KEY.RIGHT, "right");
		input.bindKey(input.KEY.UP, "up");
		input.bindKey(input.KEY.DOWN, "down");
		input.bindKey(input.KEY.A, "left");
		input.bindKey(input.KEY.D, "right");
		input.bindKey(input.KEY.W, "up");
		input.bindKey(input.KEY.S, "down");
		input.bindKey(input.KEY.SPACE, "jump", true);
		input.bindKey(input.KEY.X, "jump", true);
		// a gamepad, and the on-screen stick and button on a touch screen
		const pad = (
			code: number,
			key: number,
			type = "buttons",
			threshold = 0,
		) => {
			input.bindGamepad(
				0,
				type === "axes"
					? { type: "axes", code, threshold }
					: { type: "buttons", code },
				key,
			);
		};
		pad(input.GAMEPAD.BUTTONS.FACE_1, input.KEY.SPACE);
		pad(input.GAMEPAD.BUTTONS.LEFT, input.KEY.LEFT);
		pad(input.GAMEPAD.BUTTONS.RIGHT, input.KEY.RIGHT);
		pad(input.GAMEPAD.BUTTONS.UP, input.KEY.UP);
		pad(input.GAMEPAD.BUTTONS.DOWN, input.KEY.DOWN);
		pad(input.GAMEPAD.AXES.LX, input.KEY.LEFT, "axes", -0.5);
		pad(input.GAMEPAD.AXES.LX, input.KEY.RIGHT, "axes", 0.5);
		pad(input.GAMEPAD.AXES.LY, input.KEY.UP, "axes", -0.5);
		pad(input.GAMEPAD.AXES.LY, input.KEY.DOWN, "axes", 0.5);
	}

	override onActivateEvent() {
		const app = this.parentApp;
		app.viewport.follow(this, app.viewport.AXIS.BOTH, 0.2);
	}

	/** the middle of the player, in the world */
	get centre() {
		return { x: this.pos.x + this.width / 2, y: this.pos.y + this.height / 2 };
	}

	override update(dt: number) {
		const app = this.parentApp;
		const body = this.body;
		const { x, y } = this.centre;

		// what was touched during the last step, for this frame only
		const ladder = this.ladder;
		const teleport = this.teleport;
		this.ladder = undefined;
		this.teleport = undefined;

		if (this.travelling) {
			return super.update(dt);
		}

		// the room the player is in: the camera is held to it, and the world
		// keeps it and its neighbours
		if (trackRoom(app, x, y)) {
			this.lost = 0;
		} else if (++this.lost > LOST_AFTER) {
			// out of the world: back to where the player last stood
			this.moveTo(app, this.safe.x, this.safe.y);
			this.lost = 0;
		}

		// water is a value of the room's IntGrid layer, read where the player is
		const room = gameState.room;
		const grid =
			room === undefined
				? undefined
				: ldtkWorld().getIntGrid(room.identifier, "Collisions");
		const wet = (py: number) => {
			return grid?.names.get(grid.valueAtPixel(x, py)) === "water";
		};
		// in the water up to the waist, or only the feet: at the surface
		const under = wet(y);
		const surface = !under && wet(this.pos.y + this.height - 2);
		this.swimming = under || surface;
		this.tint.setColor(
			...((this.swimming ? [150, 200, 255] : [255, 255, 255]) as [
				number,
				number,
				number,
			]),
		);

		const up = input.isKeyPressed("up");
		const down = input.isKeyPressed("down");
		if (input.isKeyPressed("left")) {
			body.force.x = -body.maxVel.x;
			this.flipX(true);
		} else if (input.isKeyPressed("right")) {
			body.force.x = body.maxVel.x;
			this.flipX(false);
		}

		// on a ladder, up and down climb; off it, or up at its top, the
		// player is on its feet again
		if (
			ladder === undefined ||
			(up && this.pos.y + this.height <= ladder.pos.y)
		) {
			this.climbing = false;
		} else if (down || (up && this.pos.y + this.height > ladder.pos.y + 1)) {
			this.climbing = true;
		}
		// the top of a ladder is stood on, unless the player goes down it
		const top = ladder?.pos.y ?? 0;
		const bottom = this.pos.y + this.height;
		const onTop =
			ladder !== undefined &&
			!down &&
			!this.climbing &&
			body.vel.y >= 0 &&
			bottom >= top - 1 &&
			bottom <= top + 4;
		if (onTop) {
			this.pos.y = top - this.height;
			body.vel.y = 0;
		}
		const grounded = onTop || app.world.adapter.isGrounded(this);
		if (this.climbing) {
			body.gravityScale = 0;
			body.vel.y = up ? -CLIMB : down ? CLIMB : 0;
		} else if (onTop) {
			body.gravityScale = 0;
		} else if (under) {
			body.gravityScale = WATER_GRAVITY;
			body.vel.y = Math.min(body.vel.y, SINK);
		} else {
			body.gravityScale = GRAVITY;
		}

		// a jump from the ground or off a ladder; a stroke in the water
		if (
			input.isKeyPressed("jump") &&
			(grounded || this.climbing || this.swimming)
		) {
			this.climbing = false;
			// under water a stroke is a small push; from the surface, as from
			// the ground, it is a jump, out of the water
			body.gravityScale = under ? WATER_GRAVITY : GRAVITY;
			body.vel.y = 0;
			body.force.y = -body.maxVel.y * (under ? 0.45 : 1);
			body.jumping = true;
		}

		// a teleport is taken by pressing up in front of it
		if (teleport !== undefined && up && !this.wasUp && !this.climbing) {
			this.travel(app, teleport);
		}
		this.wasUp = up;

		if (grounded && room !== undefined) {
			this.safe.set(this.pos.x, this.pos.y);
		}

		// what the player is doing, shown
		const moving = Math.abs(body.vel.x) > 0.2;
		const pose = this.climbing
			? up || down
				? "climb"
				: "hang"
			: !grounded
				? "jump"
				: moving
					? "walk"
					: "idle";
		if (!this.isCurrentAnimation(pose)) {
			this.setCurrentAnimation(pose);
		}

		super.update(dt);
		return true;
	}

	/** put the player somewhere, still */
	moveTo(app: Application, x: number, y: number) {
		app.world.adapter.setPosition(this, new Vector2d(x, y));
		this.body.setVelocity(0, 0);
	}

	/**
	 * Take a teleport. Its `destination` field is a reference to another
	 * entity, in a room that may not be in the game: the project finds it,
	 * with its room and its place, and the room is loaded on the way.
	 */
	travel(app: Application, teleport: Teleport) {
		const project = loader.getLDtk("gridvania") as LDtkProject;
		const target = project.findEntity(teleport.destination);
		if (target === undefined) {
			return;
		}
		this.travelling = true;
		this.body.setVelocity(0, 0);
		app.viewport.fadeIn("#000000", 200, () => {
			// the rooms of the depth left go, the ones of the depth reached come
			gameState.depth = target.level.depth;
			gameState.room = undefined;
			this.moveTo(
				app,
				target.x + (target.width - this.width) / 2,
				target.y + target.height - this.height,
			);
			const { x, y } = this.centre;
			trackRoom(app, x, y);
			this.safe.set(this.pos.x, this.pos.y);
			app.viewport.fadeOut("#000000", 200, () => {
				this.travelling = false;
			});
		});
	}

	onCollision(_response: unknown, other: Renderable) {
		if (other instanceof Ladder) {
			this.ladder = other;
			return false;
		}
		if (other instanceof Teleport) {
			this.teleport = other;
			return false;
		}
		if (other instanceof Item) {
			other.collect();
			return false;
		}
		// the walls built from the IntGrid layer are solid
		return other.body.collisionType === collision.types.WORLD_SHAPE;
	}
}
