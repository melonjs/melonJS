/**
 * melonJS — Alex the Allegator 4 example.
 * Port of "Alex the Allegator 4" (c) 2003 Johan Peitz / Free Lunch Design.
 * Unlike the other examples, this one is GPL-2.0-or-later, as is the original
 * game it is ported from — see `packages/examples/LICENSE.md`.
 */
import {
	audio,
	Bounds,
	type CollisionResponse,
	collision,
	FlashEffect,
	input,
	type PhysicsAdapter,
	Rect,
	type Renderable,
	Sprite,
	state,
	type TMXObject,
	Tween,
	Vector2d,
} from "melonjs";
import { HEIGHT, jumpSpeed, TICK } from "../constants";
import { rumble } from "../gamepad";
import { gameState } from "../gameState";
import type { PlayScreen } from "../screens/play";
import { dust } from "./effects";
import { Breakable, RollBlock } from "./level";
import { EggShot } from "./projectiles";

// the original values (see TICK and jumpSpeed)
const WALK_SPEED = TICK;
const ROLL_SPEED = 2 * TICK;
const JUMP_SPEED = jumpSpeed(16);
// The ball turns 8/256 of a turn per tick, as in the original.
const SPIN = (8 / 256) * Math.PI * 2 * (50 / 60);

/**
 * How Alex touches something, with the boxes of the original game: it
 * checked a different part of him for each thing that could happen.
 */
export type Touch = {
	/** falling, his feet on its top: a stomp */
	above: boolean;
	/** his body, the half away from the snout: what gets hurt */
	body: boolean;
	/** low, right in front of his mouth: what eats */
	mouth: boolean;
	/** his middle: spikes and the exit */
	middle: boolean;
	/** his center: what the bullets hit */
	center: boolean;
};

/** anything that hurts (or can be stomped by) Alex */
export interface Hazard {
	touchPlayer(player: PlayerEntity, touch: Touch): void;
}

/********************************************************************************/
/*                                                                              */
/*      main player                                                             */
/*                                                                              */
/********************************************************************************/

export class PlayerEntity extends Sprite {
	facingLeft: boolean;
	rolling = false;
	eating = false;
	spitting = false;
	dying = false;
	grounded = false;
	/** squash and stretch, eased back to 1 */
	private squash = { y: 1 };
	private squashTween: Tween | undefined;
	/** the angle of the ball when rolling */
	private spin = 0;
	private wasGrounded = true;
	private fallSpeed = 0;
	/** the room ahead of a spinner, to know if we can roll */
	private ahead = new Rect(0, 0, 64, 64);
	private room = new Bounds();
	/** what he touches, and the boxes to test it against */
	private touch: Touch = {
		above: false,
		body: false,
		mouth: false,
		middle: false,
		center: false,
	};
	private area = new Bounds();
	private part = new Bounds();
	private zone = new Bounds();
	/** touched the level from above during the last physics step */
	private standing = false;
	/** still holding the button since the jump started */
	private jumpHeld = false;
	/** let go of the button while going up */
	private jumpCut = false;
	private gone = false;
	private adapter!: PhysicsAdapter;
	private vel = new Vector2d();
	/** what the camera looks at: Alex is in the middle of his frame */
	private focus = new Vector2d();
	/** turns Alex white for a moment when he gets hurt */
	private hit!: FlashEffect;

	constructor(x: number, y: number, settings: TMXObject & { facing?: string }) {
		// the frames are 192x160: Alex stands in the middle column, feet 96px down
		super(x - 64, y + settings.height - 96, {
			...gameState.atlas.getAnimationSettings([
				"alex_walk0",
				"alex_walk1",
				"alex_walk2",
				"alex_walk3",
				"alex_full_walk0",
				"alex_full_walk1",
				"alex_full_walk2",
				"alex_full_walk3",
				"alex_jump",
				"alex_full_jump",
				"alex_spit",
				"alex_jump_spit",
				"alex_eat",
				"alex_ball0",
				"alex_ball1",
				"alex_ball2",
				"alex_ball3",
			]),
			anchorPoint: { x: 0, y: 0 },
		});
		this.name = "alex";

		// The feet stand on the level, while a trigger (it never pushes, so it
		// can overlap the floor) reports everything else, which is then sorted
		// with the boxes of the original (see touching()): it covers them all,
		// from in front of the mouth to below the feet.
		const feet = new Rect(76, 36, 40, 60);
		feet.collisionMask = collision.types.WORLD_SHAPE;
		const hitbox = new Rect(32, 32, 128, 80);
		hitbox.collisionMask =
			collision.types.ALL_OBJECT & ~collision.types.WORLD_SHAPE;
		hitbox.isTrigger = true;
		this.bodyDef = {
			type: "dynamic",
			shapes: [feet, hitbox],
			collisionType: collision.types.PLAYER_OBJECT,
			maxVelocity: { x: ROLL_SPEED, y: 24 },
		};

		// keep updating when jumping out of the screen
		this.alwaysUpdate = true;

		this.addAnimation("stand", ["alex_walk0"]);
		this.addAnimation(
			"walk",
			["alex_walk0", "alex_walk1", "alex_walk2", "alex_walk3"],
			80,
		);
		this.addAnimation("full_stand", ["alex_full_walk0"]);
		this.addAnimation(
			"full_walk",
			[
				"alex_full_walk0",
				"alex_full_walk1",
				"alex_full_walk2",
				"alex_full_walk3",
			],
			80,
		);
		this.addAnimation("jump", ["alex_jump"]);
		this.addAnimation("full_jump", ["alex_full_jump"]);
		// shown twice, a single frame animation never completes
		this.addAnimation("spit", ["alex_spit", "alex_spit"], 80);
		this.addAnimation("jump_spit", ["alex_jump_spit", "alex_jump_spit"], 80);
		this.addAnimation("eat", ["alex_eat", "alex_eat"], 80);
		// turned smoothly in update(), at the speed of the original
		this.addAnimation("roll", ["alex_ball0"]);
		this.setCurrentAnimation("stand");

		// the original sprites look to the left
		this.facingLeft = settings.facing === "left";
		this.flipX(!this.facingLeft);
	}

	override onActivateEvent() {
		const app = this.parentApp;
		this.adapter = app.world.adapter;
		this.hit = new FlashEffect(app.renderer);
		this.addPostEffect(this.hit);
		this.updateFocus();
		app.viewport.follow(this.focus, app.viewport.AXIS.HORIZONTAL, 0.1);
		app.viewport.setDeadzone(app.viewport.width / 5, app.viewport.height);
		// the sounds placed in the level are heard from where Alex is
		audio.setListener(this);
	}

	private updateFocus() {
		this.focus.set(this.pos.x + this.width / 2, this.pos.y + this.height / 2);
	}

	override update(dt: number) {
		this.updateFocus();
		if (this.dying) {
			// once out of the screen, let the play screen decide what's next
			if (!this.gone && this.pos.y > HEIGHT) {
				this.gone = true;
				(state.current() as PlayScreen).onPlayerDeath();
			}
			return super.update(dt);
		}

		const vel = this.body.getVelocity(this.vel);
		this.grounded = this.standing;
		this.standing = false;

		// just landed: a little squash, the harder the more
		if (this.grounded && !this.wasGrounded) {
			this.land(this.fallSpeed);
		}
		this.wasGrounded = this.grounded;
		if (!this.grounded) {
			this.fallSpeed = vel.y;
		}

		if (this.rolling) {
			vel.x = this.facingLeft ? -ROLL_SPEED : ROLL_SPEED;
		} else if (input.isKeyPressed("left")) {
			vel.x = -WALK_SPEED;
			this.face(true);
		} else if (input.isKeyPressed("right")) {
			vel.x = WALK_SPEED;
			this.face(false);
		} else {
			vel.x = 0;
		}

		if (input.isKeyPressed("jump") && this.grounded) {
			vel.y = -JUMP_SPEED;
			this.jumpHeld = true;
			this.jumpCut = false;
			this.squashTo(1.12, 250, Tween.Easing.Quadratic.Out);
			audio.play("jump");
		} else if (this.jumpHeld && !input.keyStatus("jump")) {
			this.jumpHeld = false;
			this.jumpCut = true;
		}
		// let go of the button for a shorter jump: as in the original, the
		// speed up is halved on every step until Alex falls again
		if (this.jumpCut) {
			if (vel.y < 0) {
				vel.y /= 2;
			} else {
				this.jumpCut = false;
			}
		}
		this.body.setVelocity(vel.x, vel.y);

		if (input.isKeyPressed("fire")) {
			this.spit();
		}

		// fell in a hole
		if (this.pos.y > HEIGHT - 96) {
			this.die();
		}

		this.updateAnimation(vel.x);
		this.shape();
		super.update(dt);
		return true;
	}

	/** the ball turning, or squash and stretch about the feet */
	private shape() {
		const transform = this.currentTransform.identity();
		if (this.rolling) {
			// counting down: the flip makes it turn the way Alex rolls
			this.spin -= SPIN;
			transform.translate(96, 64).rotate(this.spin).translate(-96, -64);
		} else if (this.squash.y !== 1) {
			// as much wider as it is shorter
			const s = this.squash.y;
			transform
				.translate(96, 96)
				.scale(1 / s, s)
				.translate(-96, -96);
		}
	}

	/** squash (below 1) or stretch (above 1), and back */
	private squashTo(
		y: number,
		duration: number,
		easing = Tween.Easing.Back.Out,
	) {
		this.squashTween?.stop();
		this.squash.y = y;
		this.squashTween = new Tween(this.squash)
			.to({ y: 1 }, { duration, easing })
			.start();
	}

	private land(speed: number) {
		if (speed < 4) {
			return;
		}
		this.squashTo(1 - Math.min(speed / 60, 0.3), 220);
		if (speed > 16) {
			dust(this.parentApp.world, this.pos.x + 96, this.pos.y + 96);
		}
	}

	private face(left: boolean) {
		this.facingLeft = left;
		this.flipX(!left);
	}

	private updateAnimation(vx: number) {
		if (this.eating) {
			return;
		}
		const full = gameState.eggs > 0 ? "full_" : "";
		if (this.rolling) {
			this.setCurrentAnimation("roll");
		} else if (this.spitting) {
			this.setCurrentAnimation(this.grounded ? "spit" : "jump_spit", {
				loop: false,
				onComplete: () => {
					this.spitting = false;
				},
			});
		} else if (!this.grounded) {
			this.setCurrentAnimation(`${full}jump`);
		} else if (vx !== 0) {
			this.setCurrentAnimation(`${full}walk`);
		} else {
			this.setCurrentAnimation(`${full}stand`);
		}
	}

	/** chew whatever was just picked up */
	eat() {
		if (this.rolling || this.dying) {
			return;
		}
		this.eating = true;
		this.spitting = false;
		// in the air Alex keeps his jumping pose, mouth open
		this.setCurrentAnimation(this.grounded ? "eat" : "jump_spit", {
			loop: false,
			onComplete: () => {
				this.eating = false;
			},
		});
	}

	/** spit an egg, if we have one */
	private spit() {
		if (this.rolling || this.spitting || gameState.eggs === 0) {
			return;
		}
		gameState.eggs--;
		this.spitting = true;
		this.eating = false;
		const x = this.facingLeft ? this.pos.x + 36 : this.pos.x + 128;
		this.parentApp.world.addChild(
			new EggShot(x, this.pos.y + 40, this.facingLeft),
			this.depth,
		);
		audio.play("spit");
	}

	/**
	 * on a spinner: turn into a ball and roll until we hit a wall. As in the
	 * original, the middle of Alex has to be over it, and the way ahead, just
	 * above it, has to be free.
	 */
	startRoll(spinner: RollBlock) {
		if (this.rolling || !this.grounded || this.dying) {
			return;
		}
		const middle = this.pos.x + this.width / 2;
		if (middle < spinner.pos.x || middle >= spinner.pos.x + spinner.width) {
			return;
		}
		// the tile beside the spinner, one row up
		const x =
			spinner.pos.x + (this.facingLeft ? -spinner.width : spinner.width);
		const y = spinner.pos.y - spinner.height;
		this.ahead.pos.set(x, y);
		this.room.setMinMax(
			x + 1,
			y + 1,
			x + spinner.width - 1,
			y + spinner.height - 1,
		);
		const blocked = this.adapter
			.queryAABB(this.ahead)
			.some(
				(other) =>
					other.body?.collisionType === collision.types.WORLD_SHAPE &&
					this.areaOf(other).overlaps(this.room),
			);
		if (blocked) {
			return;
		}
		this.rolling = true;
		this.eating = this.spitting = false;
		audio.play("turn");
	}

	private stopRoll() {
		this.rolling = false;
		this.body.setVelocity(0, this.body.getVelocity(this.vel).y);
		audio.play("hit");
	}

	/**
	 * jump off something we landed on, `dy` in the original's quarter pixels
	 * per tick: 20 when holding jump as in the original, which otherwise only
	 * gave a tiny hop (5), a bit more here so the bounce shows
	 */
	bounce(dy = input.keyStatus("jump") ? 20 : 9) {
		this.jumpHeld = input.keyStatus("jump");
		this.jumpCut = false;
		this.body.setVelocity(this.body.getVelocity(this.vel).x, -jumpSpeed(dy));
		this.squashTo(1.12, 250, Tween.Easing.Quadratic.Out);
		rumble(80, 0.2, 0.6);
	}

	/** ouch */
	hurt() {
		if (this.dying || this.isFlickering()) {
			return;
		}
		gameState.energy--;
		if (gameState.energy <= 0) {
			this.die();
		} else {
			audio.play("hurt");
			rumble(200, 0.6, 0.9);
			this.flicker(2000);
			this.hit.setIntensity(1);
			new Tween(this.hit)
				.to({ intensity: 0 }, { duration: 400 })
				.onUpdate(() => this.hit.setIntensity(this.hit.intensity))
				.start();
		}
	}

	/** so sad... */
	die() {
		if (this.dying) {
			return;
		}
		this.dying = true;
		this.rolling = false;
		gameState.lives--;
		gameState.energy = 0;
		gameState.eggs = 0;

		// flip upside down, jump and fall through everything
		this.currentTransform.identity();
		this.flipY(true);
		this.setCurrentAnimation("jump");
		this.body.setCollisionMask(collision.types.NO_OBJECT);
		this.body.setVelocity(0, -15);

		audio.play("die");
		rumble(400, 1, 1);
		(state.current() as PlayScreen).onPlayerDying();
	}

	/**
	 * a box of the original, in its pixels from the top left of Alex's 16x16
	 * sprite (`y` up from his feet), in the world
	 */
	private box(x: number, y: number, w: number, h: number) {
		const left = this.pos.x + 64 + x * 4;
		const top = this.pos.y + 96 + y * 4;
		this.part.setMinMax(left, top, left + w * 4, top + h * 4);
		return this.part;
	}

	/** his middle, in the world, where the original checked spikes and exits */
	middleIn(bounds: Bounds) {
		return bounds.contains(this.pos.x + 64 + 7 * 4, this.pos.y + 96 - 7 * 4);
	}

	/** his mouth, in the world, where the original picked things up */
	mouthIn(bounds: Bounds) {
		const x = this.pos.x + 64 + (this.facingLeft ? 6 : 10) * 4;
		return bounds.contains(x, this.pos.y + 96 - 10 * 4);
	}

	/**
	 * the area of something in the world: its last shape, the one the enemies
	 * are hit by (shapes are relative to their renderable)
	 */
	private areaOf(other: Renderable) {
		const shapes = this.adapter.getBodyShapes(other);
		const shape = shapes[shapes.length - 1].getBounds();
		this.area.setMinMax(
			other.pos.x + shape.left,
			other.pos.y + shape.top,
			other.pos.x + shape.right,
			other.pos.y + shape.bottom,
		);
		return this.area;
	}

	/** how Alex touches something, as the original checked it */
	private touching(other: Renderable): Touch {
		const area = this.areaOf(other);
		const right = !this.facingLeft;
		const touch = this.touch;
		const falling = !this.grounded && this.body.getVelocity(this.vel).y >= 0;

		// the top 4 pixels of it, under a 12x8 box at his feet
		this.zone.setMinMax(area.left, area.top, area.right, area.top + 16);
		touch.above = falling && this.box(2, -4, 12, 8).overlaps(this.zone);
		// the back half of his sprite
		touch.body = this.box(right ? 0 : 8, -16, 8, 16).overlaps(area);
		// in front of his mouth, against the lower half of it
		this.zone.setMinMax(area.left, area.bottom - 32, area.right, area.bottom);
		touch.mouth = this.box(right ? 16 : -8, -16, 8, 16).overlaps(this.zone);
		touch.middle = this.middleIn(area);
		touch.center = this.box(4, -16, 8, 16).overlaps(area);
		return touch;
	}

	onCollisionStart(_response: CollisionResponse, other: Renderable) {
		if (this.dying) {
			return;
		}
		if (other instanceof Breakable && this.rolling) {
			other.shatter();
		}
	}

	onCollisionActive(response: CollisionResponse, other: Renderable) {
		if (this.dying) {
			return;
		}
		switch (other.body.collisionType) {
			case collision.types.WORLD_SHAPE:
				// standing on it
				if (response.normal.y < -0.7) {
					this.standing = true;
				}
				// rolled into a wall
				if (
					this.rolling &&
					!(other instanceof Breakable) &&
					Math.abs(response.normal.x) > 0.7
				) {
					this.stopRoll();
				}
				break;

			case collision.types.ACTION_OBJECT:
				// standing on a spinner (checked every step, as we might land on it)
				if (other instanceof RollBlock) {
					this.startRoll(other);
				}
				break;

			case collision.types.ENEMY_OBJECT:
				(other as Renderable & Hazard).touchPlayer(this, this.touching(other));
				break;
		}
	}
}
