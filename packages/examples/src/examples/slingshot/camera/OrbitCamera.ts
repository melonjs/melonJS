/**
 * melonJS — Slingshot: the camera that orbits the field.
 *
 * At a yaw of 0 it looks at the field side on; a quarter turn puts it
 * behind the slingshot. It eases to where it is asked to be with
 * `math.damp`. The turn buttons and the arrow keys ask it to turn, and
 * `Camera3d#orbit` puts the camera where the yaw says.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import { type Camera3d, input, math, Vector3d } from "melonjs";
import {
	ORBIT_BEHIND,
	ORBIT_EASE,
	ORBIT_SIDE,
	ORBIT_SPEED,
	ORBIT_STEP,
	PIVOT,
} from "../constants";

const KEYS = {
	turnLeft: [input.KEY.LEFT, input.KEY.A],
	turnRight: [input.KEY.RIGHT, input.KEY.D],
};

export class OrbitCamera {
	// the camera's forward and right, along the ground
	readonly forward = new Vector3d();
	readonly right = new Vector3d();
	private readonly camera: Camera3d;
	// where it is turned, and where it is easing to
	private yaw = 0;
	private targetYaw = 0;

	/**
	 * Take over the stage's camera, on the side view.
	 * @param camera - the stage's `Camera3d`
	 */
	constructor(camera: Camera3d) {
		this.camera = camera;
		camera.setClipPlanes(10, 10000);
		this.place();
	}

	/**
	 * How far round behind the slingshot the camera is.
	 * @returns 0 side on, 1 from straight behind
	 */
	get behind() {
		return Math.abs(Math.sin(this.yaw));
	}

	/** One step to the left, as the ◀ button asks. */
	stepLeft() {
		this.targetYaw += ORBIT_STEP;
	}

	/** One step to the right, as the ▶ button asks. */
	stepRight() {
		this.targetYaw -= ORBIT_STEP;
	}

	/** Swap between the side view and the view from behind the slingshot. */
	toggleView() {
		const behindNow = Math.abs(Math.sin(this.targetYaw)) > 0.5;
		this.targetYaw = behindNow ? 0 : Math.PI / 2;
	}

	/** Let the arrow keys (and A / D) turn the camera. */
	bindKeys() {
		for (const [action, keys] of Object.entries(KEYS)) {
			for (const key of keys) {
				input.bindKey(key, action);
			}
		}
	}

	/** Give the keys back. */
	unbindKeys() {
		for (const key of Object.values(KEYS).flat()) {
			input.unbindKey(key);
		}
	}

	/**
	 * Turn with any held key, and ease toward where the camera is asked to be.
	 * @param dt - the time since the last frame, in milliseconds
	 */
	update(dt: number) {
		if (input.isKeyPressed("turnLeft")) {
			this.targetYaw += (ORBIT_SPEED * dt) / 1000;
		}
		if (input.isKeyPressed("turnRight")) {
			this.targetYaw -= (ORBIT_SPEED * dt) / 1000;
		}
		if (Math.abs(this.targetYaw - this.yaw) > 1e-4) {
			this.yaw = math.damp(this.yaw, this.targetYaw, ORBIT_EASE, dt / 1000);
			this.place();
		}
	}

	/** Put the camera where the yaw says, looking at the middle of the field. */
	private place() {
		this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
		this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
		const behind = this.behind;
		this.camera.orbit(
			PIVOT,
			this.yaw,
			math.lerp(ORBIT_SIDE.pitch, ORBIT_BEHIND.pitch, behind),
			math.lerp(ORBIT_SIDE.distance, ORBIT_BEHIND.distance, behind),
		);
	}
}
