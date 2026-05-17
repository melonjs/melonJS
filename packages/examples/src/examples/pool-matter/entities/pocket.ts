/**
 * melonJS — Pool (Matter) example: Pocket sensors + score popup.
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type CollisionResponse,
	type Container,
	collision,
	Ellipse,
	type PhysicsAdapter,
	Renderable,
	type Renderer,
	Text,
	Tween,
	Vector2d,
} from "melonjs";
import { gameState } from "../gameState";
import { Ball } from "./ball";
import { CUE_SPAWN_X, CUE_SPAWN_Y, CueBall } from "./cue";

/**
 * Spawn a "+1" floating-text pop at the pocket center as a numbered
 * ball is sunk. The text tweens upward and fades out over `POP_MS`
 * then removes itself from its container. Reinforces the scoring
 * event with a visual at the point of impact instead of relying on
 * the player to notice the HUD counter tick.
 */
const POP_MS = 600;
const POP_RISE = 36;
const spawnScorePop = (parent: Container, x: number, y: number): void => {
	const pop = new Text(x, y, {
		font: "bold monospace", // `bold` lives inside the CSS font string
		size: 22,
		fillStyle: "#ffe55c",
		strokeStyle: "#3a2a00",
		lineWidth: 3,
		textAlign: "center",
		textBaseline: "middle",
		text: "+1",
	});
	pop.depth = 10; // above balls + pockets
	parent.addChild(pop);
	new Tween(pop.pos)
		.to({ y: y - POP_RISE }, { duration: POP_MS })
		.easing(Tween.Easing.Quadratic.Out)
		.start();
	new Tween(pop)
		.to({ alpha: 0 }, { duration: POP_MS })
		.onComplete(() => {
			parent.removeChild(pop);
		})
		.start();
};

/**
 * A corner / mid-rail pocket — a static sensor that removes any ball
 * entering its bounds. Cue ball respawns at the head-spot; numbered
 * balls are removed and the score increments.
 *
 * Sensor body = collision events fire but matter doesn't physically
 * push the ball back out. The collision-lifecycle hook
 * `onCollisionStart` fires once when the ball enters — exactly the
 * "sink" event we want.
 */
export class Pocket extends Renderable {
	// cached adapter ref — only needed for `setPosition` (no body method).
	private adapter!: PhysicsAdapter;
	// scratch for `adapter.setPosition(other, v)` (Vector2d-typed input).
	// `body.setVelocity(0, 0)` takes primitives so no zero-velocity scratch.
	private readonly _respawnPos = new Vector2d();
	// scratch for `body.getVelocity(out)` — pocket-entry validation reads
	// the incoming ball's velocity to reject glancing rail rolls.
	private readonly _velScratch = new Vector2d();

	constructor(x: number, y: number, radius: number) {
		// `(x, y)` is the pocket's WORLD CENTER. Top-left-anchored so
		// `pos` is the bounds top-left and `getBounds()` lines up 1:1
		// with the matter body's AABB.
		super(x - radius, y - radius, radius * 2, radius * 2);
		this.anchorPoint.set(0, 0);
		this.name = "pocket";
		this.alwaysUpdate = true;
		this.depth = -5; // above felt, below balls
		this.bodyDef = {
			type: "static",
			shapes: [new Ellipse(radius, radius, radius * 2, radius * 2)],
			collisionType: collision.types.ACTION_OBJECT,
			collisionMask: collision.types.PLAYER_OBJECT,
			isSensor: true,
		};
	}

	override onActivateEvent() {
		this.adapter = this.parentApp.world.adapter;
	}

	/**
	 * Trigger the sink as soon as the ball enters the sensor area —
	 * `onCollisionStart` fires once per (ball, pocket) pair entry, so
	 * even a fast-moving glancing ball that's only inside the sensor
	 * for one frame still gets captured. The "instant disappear on
	 * touch" jarring-ness is now handled by the Ball's `startSink`
	 * fade animation, not by a geometric pre-filter — we capture any
	 * ball that crosses the sensor edge, then play the drop animation
	 * on it. Without this, hard break shots could blow balls past the
	 * pockets off the table edge entirely.
	 */
	onCollisionStart(_response: CollisionResponse, other: Renderable): void {
		if (!(other instanceof Ball)) return;
		if (other.isSinking()) return;

		// Pocket-entry validation: only sink balls whose velocity has a
		// positive component pointed AT the pocket center. Without this,
		// a ball rolling along the rail can clip the corner pocket's
		// sensor radius from outside and get sucked in even though it
		// was heading away — reads as a magnet vacuum to the player.
		// `vel · (pocketCenter - ballCenter) > 0` means the ball is
		// actually closing on the pocket. Cue ball is exempt because
		// the scratch penalty should fire on any contact, including
		// drifting into a pocket at near-zero speed.
		if (!(other instanceof CueBall)) {
			const pocketCenterX = this.pos.x + this.width / 2;
			const pocketCenterY = this.pos.y + this.height / 2;
			const ballCenterX = other.pos.x + other.width / 2;
			const ballCenterY = other.pos.y + other.height / 2;
			const toPocketX = pocketCenterX - ballCenterX;
			const toPocketY = pocketCenterY - ballCenterY;
			const vel = other.body.getVelocity(this._velScratch);
			const closing = vel.x * toPocketX + vel.y * toPocketY;
			if (closing <= 0) return;
		}

		if (other instanceof CueBall) {
			// respawn cue at head-spot, zero velocity. `setPosition` is an
			// adapter call (no body-level equivalent); `setVelocity` is on
			// the body and takes primitives, no scratch needed.
			this._respawnPos.set(CUE_SPAWN_X, CUE_SPAWN_Y);
			this.adapter.setPosition(other, this._respawnPos);
			other.body.setVelocity(0, 0);
			// TODO: scratch penalty (subtract from score). For now the
			// cue ball just respawns — no in-game consequence.
			return;
		}

		// Numbered ball — score immediately, then hand off to the ball's
		// own sink animation. Score updates HERE (not after the fade) so
		// the HUD reacts at the moment of "drop confirmed," not after
		// the 8-frame fade — feels snappier even though the ball is
		// still visually disappearing.
		gameState.score += 1;
		gameState.ballsRemaining -= 1;
		if (other.ballNumber === 8) {
			gameState.gameOver = true;
		}
		// Pocket center in world coords (anchor is (0, 0), so pos is the
		// top-left of the bounds rect with width = height = 2 * radius).
		const centerX = this.pos.x + this.width / 2;
		const centerY = this.pos.y + this.height / 2;
		other.startSink(this.adapter, centerX, centerY);
		// "+1" pop at the pocket — visible feedback for the score tick.
		const parent = this.ancestor as Container | undefined;
		if (parent) {
			spawnScorePop(parent, centerX, centerY);
		}
	}

	override draw(_renderer: Renderer): void {
		// intentionally empty — the table sprite already paints the
		// pocket "hole" visually. We're only the sensor.
	}
}

/**
 * The 6 pool pocket positions, tuned ONE BY ONE against the painted
 * holes in `table.png`. Each row is `[centerX, centerY, radius]` in
 * viewport coordinates. The corners and mid pockets can have different
 * radii — corners are visibly larger on the sprite. Tune interactively
 * against the debug overlay (press `S` to toggle).
 *
 * No derived constants here. If a pocket looks off, edit the row for
 * THAT pocket — the rail layout in `buildTable` is also a hand-tuned
 * table, so adjusting one pocket won't shift any other geometry.
 */
const POCKET_POSITIONS: ReadonlyArray<readonly [number, number, number]> = [
	// 4 corner pockets — [centerX, centerY, radius]
	[56, 60, 34], // top-left
	[1216, 60, 34], // top-right
	[56, 660, 34], // bottom-left
	[1216, 664, 34], // bottom-right
	// 2 mid-rail pockets
	[634, 36, 34], // top-mid
	[634, 688, 34], // bottom-mid
];

export const buildPockets = (): Pocket[] => {
	return POCKET_POSITIONS.map(([x, y, r]) => new Pocket(x, y, r));
};
