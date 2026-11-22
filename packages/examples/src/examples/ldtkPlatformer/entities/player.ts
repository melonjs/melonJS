/**
 * melonJS — LDtk platformer example.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	Color,
	collision,
	type LDtkFoundObject,
	type LDtkObjectSettings,
	Rect,
	type Renderable,
	Sprite,
	SquishEffect,
	Tween,
	Vector2d,
} from "melonjs";
import { SPRITES, TILE } from "../config";
import { type Controls, readControls } from "../controls";
import { particles } from "../effects/particles";
import { sounds } from "../effects/sounds";
import { gameState } from "../gameState";
import { groundAt, trackRoom } from "../world/rooms";
import { Item } from "./item";
import { Ladder } from "./ladder";
import { Teleport } from "./teleport";

// speeds, in pixels per frame
const WALK = 2;
const JUMP = 7.4;
const CLIMB = 1;
const SINK = 0.8;
// the push of a stroke under water
const STROKE = 3.3;
// what a held key adds to the speed each frame, and what the ground takes
// off it: the player gets up to speed, and comes to a stop, over a few frames
const PUSH = 0.45;
const DRAG = 0.25;
// a lighter gravity than the world's: a jump of nearly four tiles, long
// enough to clear a gap of three
const GRAVITY = 0.45;
const WATER_GRAVITY = 0.2;

// frames out of every room before the player is put back where it stood
const LOST_AFTER = 45;
// a fall from higher than this shakes the screen on landing, in pixels
const HARD_LANDING = 4.5 * TILE;

const DRY = new Color(255, 255, 255);
const WET = new Color(150, 200, 255);

/**
 * whether a ladder goes through a wall: their boxes share more than an edge
 * @param ladder - the ladder
 * @param wall - the wall
 * @returns true if it does
 */
function goesThrough(ladder: Renderable, wall: Renderable): boolean {
	const a = ladder.getBounds();
	const b = wall.getBounds();
	return (
		a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
	);
}

/** where the player is in the water: out of it, head out, or under */
type Water = "none" | "surface" | "under";

/**
 * The "Player" entity of the LDtk world: LDtk places one in the first room,
 * and the class registered under its name is what it becomes.
 */
export class Player extends Sprite {
	/** what the player touched during the last step: set by `onCollision`, read by `update` */
	ladder: Ladder | undefined;
	teleport: Teleport | undefined;

	climbing = false;
	/** the ladder being climbed: it goes through the floor it is set in */
	climbed: Ladder | undefined;
	swimming = false;
	/** between two teleports: the screen is closed */
	travelling = false;
	/** the up key, last frame: a teleport is taken on a press, not a hold */
	wasUp = false;

	/** the last place the player stood on the ground, in a room */
	safe = new Vector2d();
	/** the frames spent out of every room */
	lost = 0;

	/** in the air, and how high the player was at the top of it */
	airborne = false;
	highest = 0;

	/** squash and stretch: the player's height, as a share of its own */
	stretch = { scaleY: 1 };
	stretching: Tween | undefined;
	squish: SquishEffect | undefined;

	constructor(x: number, y: number, settings: LDtkObjectSettings) {
		// standing on the bottom of the entity's box, in its middle
		super(x + (settings.width - TILE) / 2, y + settings.height - TILE, {
			image: SPRITES,
			framewidth: TILE,
			frameheight: TILE,
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
			shapes: [new Rect(4, 2, TILE - 8, TILE - 2)],
			collisionType: collision.types.PLAYER_OBJECT,
			collisionMask:
				collision.types.WORLD_SHAPE |
				collision.types.COLLECTABLE_OBJECT |
				collision.types.ACTION_OBJECT,
			maxVelocity: { x: WALK, y: JUMP },
			frictionAir: { x: DRAG, y: 0 },
			gravityScale: GRAVITY,
		};

		// The player is an object of the room it starts in, and walks out of
		// it: persistent, it stays when that room is taken out of the game,
		// and is not built again when the room comes back.
		this.isPersistent = true;
		// the player leaves the view while the screen closes between rooms
		this.alwaysUpdate = true;
		this.safe.set(this.pos.x, this.pos.y);
	}

	override onActivateEvent() {
		const app = this.parentApp;
		app.viewport.follow(this, app.viewport.AXIS.BOTH, 0.2);
		// the bulge that keeps a squashed or stretched player's volume is a
		// shader effect: on the Canvas renderer it does nothing
		if (this.squish === undefined) {
			this.squish = new SquishEffect(app.renderer);
			this.addPostEffect(this.squish);
		}
	}

	/** the middle of the player, in the world */
	get centre() {
		return { x: this.pos.x + this.width / 2, y: this.pos.y + this.height / 2 };
	}

	/** the player's feet, in the world */
	get feet() {
		return { x: this.pos.x + this.width / 2, y: this.pos.y + this.height };
	}

	override update(dt: number) {
		// what was touched during the last step, for this frame only
		const ladder = this.ladder;
		const teleport = this.teleport;
		this.ladder = undefined;
		this.teleport = undefined;

		// behind the closed screen of a teleport, nothing moves
		if (this.travelling) {
			return super.update(dt);
		}

		const keys = readControls();
		this.stayInTheWorld();
		const water = this.enterOrLeaveWater();
		this.walk(keys, ladder);
		const onLadderTop = this.climb(ladder, keys);
		this.climbed = this.climbing ? ladder : undefined;
		const grounded =
			onLadderTop || this.parentApp.world.adapter.isGrounded(this);
		this.fall(water, onLadderTop);
		const canJump = grounded || this.climbing || this.swimming;
		// (not from inside the floor a ladder goes through)
		if (keys.jump && canJump && !this.inFloor()) {
			this.jump(water, grounded);
		}
		// a teleport is taken by pressing up in front of it
		if (teleport !== undefined && keys.up && !this.wasUp && !this.climbing) {
			teleport.triggerEvent(this);
		}
		this.wasUp = keys.up;

		this.land(grounded);
		this.showPose(grounded, keys);
		this.applyStretch();
		super.update(dt);
		return true;
	}

	/**
	 * Keep the camera and the world on the room the player is in. Out of
	 * every room for a while (fallen out of the world), the player is put
	 * back where it last stood.
	 */
	stayInTheWorld() {
		const app = this.parentApp;
		const { x, y } = this.centre;
		if (trackRoom(app, x, y)) {
			this.lost = 0;
		} else if (++this.lost > LOST_AFTER) {
			this.moveTo(this.safe.x, this.safe.y);
			this.lost = 0;
		}
	}

	/**
	 * Read the water where the player is, and splash going in or out of it.
	 * @returns where the player is in the water
	 */
	enterOrLeaveWater(): Water {
		const { x } = this.centre;
		// under water, or with the head out of it: at the surface
		const under = groundAt(x, this.pos.y + 3) === "water";
		const surface =
			!under && groundAt(x, this.pos.y + this.height - 2) === "water";
		const swimming = under || surface;
		if (swimming !== this.swimming) {
			particles.burst("splash", x, this.feet.y - 2);
			sounds.splash();
		}
		this.swimming = swimming;
		this.tint.copy(swimming ? WET : DRY);
		return under ? "under" : surface ? "surface" : "none";
	}

	/**
	 * Whether the player is in a wall: it is, climbing a ladder through
	 * the floor the ladder is set in. Read from the room's IntGrid layer.
	 * @returns true inside a wall
	 */
	inFloor(): boolean {
		const { x } = this.centre;
		return (
			groundAt(x, this.pos.y + 2) === "walls" ||
			groundAt(x, this.pos.y + this.height - 1) === "walls"
		);
	}

	/**
	 * Left and right: a push, which the body's friction slows down again.
	 * In the floor a ladder goes through there is no room to the sides: the
	 * player stays on the ladder.
	 * @param keys - what is asked for
	 * @param ladder - the ladder the player is in, if any
	 */
	walk(keys: Controls, ladder: Ladder | undefined) {
		if (this.climbing && ladder !== undefined && this.inFloor()) {
			this.pos.x = ladder.pos.x + (ladder.width - this.width) / 2;
			this.body.vel.x = 0;
			return;
		}
		if (keys.left) {
			this.body.force.x = -PUSH;
			this.flipX(true);
		} else if (keys.right) {
			this.body.force.x = PUSH;
			this.flipX(false);
		}
	}

	/**
	 * On a ladder, up and down climb; off it, or up at its top, the player
	 * is on its feet again. The top of a ladder is stood on, unless the
	 * player goes down it.
	 * @param ladder - the ladder the player is in, if any
	 * @param keys - what is asked for
	 * @returns true when the player stands on the ladder's top
	 */
	climb(ladder: Ladder | undefined, keys: Controls): boolean {
		const body = this.body;
		const bottom = this.pos.y + this.height;
		const top = ladder?.pos.y ?? 0;

		if (ladder === undefined || (keys.up && bottom <= top)) {
			this.climbing = false;
		} else if (keys.down || (keys.up && bottom > top + 1)) {
			this.climbing = true;
		}
		if (this.climbing) {
			body.vel.y = keys.up ? -CLIMB : keys.down ? CLIMB : 0;
			return false;
		}

		const onTop =
			ladder !== undefined &&
			!keys.down &&
			body.vel.y >= 0 &&
			bottom >= top - 1 &&
			bottom <= top + 4;
		if (onTop) {
			this.pos.y = top - this.height;
			body.vel.y = 0;
		}
		return onTop;
	}

	/**
	 * How the player falls: not at all on a ladder, slowly in water, and
	 * under the game's gravity anywhere else.
	 * @param water - where the player is in the water
	 * @param onLadderTop - the player stands on a ladder's top
	 */
	fall(water: Water, onLadderTop: boolean) {
		const body = this.body;
		// leaving the water upwards after a stroke at the surface is a jump
		const jumpingOut = water === "surface" && body.vel.y <= -STROKE - 0.2;
		if (this.climbing || onLadderTop) {
			body.gravityScale = 0;
		} else if (water !== "none" && !jumpingOut) {
			body.gravityScale = WATER_GRAVITY;
			body.vel.y = Math.min(body.vel.y, SINK);
		} else {
			body.gravityScale = GRAVITY;
		}
	}

	/**
	 * A jump from the ground or off a ladder; a stroke in the water. Under
	 * water a stroke is a small push; from the surface, as from the ground,
	 * it is a jump, out of the water.
	 * @param water - where the player is in the water
	 * @param grounded - the player is on the ground
	 */
	jump(water: Water, grounded: boolean) {
		const body = this.body;
		const under = water === "under";
		this.climbing = false;
		body.gravityScale = under ? WATER_GRAVITY : GRAVITY;
		body.vel.y = 0;
		body.force.y = under ? -STROKE : -body.maxVel.y;
		body.jumping = true;

		if (under) {
			particles.burst("bubbles", this.centre.x, this.pos.y);
			sounds.stroke();
			return;
		}
		this.stretchTo(1.25);
		sounds.jump();
		if (grounded) {
			particles.burst("dust", this.feet.x, this.feet.y);
		}
	}

	/**
	 * Tell a landing from the frames before it: a squash, dust, and a shake
	 * of the screen after a long fall. The ground is also where the player
	 * is put back if it falls out of the world.
	 * @param grounded - the player is on the ground
	 */
	land(grounded: boolean) {
		const inTheAir = !grounded && !this.climbing && !this.swimming;
		if (inTheAir) {
			this.highest = this.airborne
				? Math.min(this.highest, this.pos.y)
				: this.pos.y;
		} else if (grounded && this.airborne) {
			this.stretchTo(0.75);
			particles.burst("dust", this.feet.x, this.feet.y);
			sounds.land();
			if (this.pos.y - this.highest > HARD_LANDING) {
				this.parentApp.viewport.shake(2, 150);
			}
		}
		this.airborne = inTheAir;

		if (grounded && gameState.room !== undefined) {
			this.safe.set(this.pos.x, this.pos.y);
		}
	}

	/**
	 * the animation that shows what the player is doing
	 * @param grounded - the player is on the ground
	 * @param keys - what is asked for
	 */
	showPose(grounded: boolean, keys: Controls) {
		let pose = "idle";
		if (this.climbing) {
			pose = keys.up || keys.down ? "climb" : "hang";
		} else if (!grounded) {
			pose = "jump";
		} else if (Math.abs(this.body.vel.x) > 0.2) {
			pose = "walk";
		}
		if (!this.isCurrentAnimation(pose)) {
			this.setCurrentAnimation(pose);
		}
	}

	/**
	 * Stretch (above 1) or squash (below 1) the player to `scaleY` of its
	 * height, then ease back to rest with one small overshoot.
	 * @param scaleY - the share of its height the player starts from
	 */
	stretchTo(scaleY: number) {
		this.stretching?.stop();
		this.stretch.scaleY = scaleY;
		this.stretching = new Tween(this.stretch)
			.to({ scaleY: 1 }, { duration: 300, easing: Tween.Easing.Back.Out })
			.start();
	}

	/**
	 * Scale the player's height about its feet, and bulge it the other way
	 * so it keeps its volume: pinched in when stretched, bulging out when
	 * squashed. From `update()`, after the physics step.
	 */
	applyStretch() {
		const { scaleY } = this.stretch;
		const feet = this.height * (1 - this.anchorPoint.y);
		this.currentTransform
			.identity()
			.translate(0, feet)
			.scale(1, scaleY)
			.translate(0, -feet);
		this.updateBounds();
		this.squish?.setBulge(1 - scaleY);
	}

	/**
	 * put the player somewhere, still
	 * @param x - the left of the player, in the world
	 * @param y - the top of the player, in the world
	 */
	moveTo(x: number, y: number) {
		this.parentApp.world.adapter.setPosition(this, new Vector2d(x, y));
		this.body.setVelocity(0, 0);
		this.airborne = false;
	}

	/**
	 * Arrive where a teleport leads: on the entity it refers to, in a room
	 * that may be on the world's other depth.
	 * @param target - the entity, its room and its place, as the project found them
	 */
	arrive(target: LDtkFoundObject) {
		// the rooms of the depth left go, the ones of the depth reached come
		gameState.depth = target.level.depth;
		gameState.room = undefined;
		this.moveTo(
			target.x + (target.width - this.width) / 2,
			target.y + target.height - this.height,
		);
		const { x, y } = this.centre;
		trackRoom(this.parentApp, x, y);
		this.safe.set(this.pos.x, this.pos.y);
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
		// The walls built from the IntGrid layer are solid, but for the
		// ones a ladder goes through, to a player climbing it: LDtk's
		// floor runs over the top of a ladder set in it.
		return (
			other.body.collisionType === collision.types.WORLD_SHAPE &&
			!(this.climbed !== undefined && goesThrough(this.climbed, other))
		);
	}
}
