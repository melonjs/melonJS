/**
 * melonJS — Slingshot: the pull, from a press anywhere on the screen.
 *
 * A pet is a small target under a finger, and a finger on it would hide it,
 * so the whole screen takes the press: this region lies behind the buttons
 * and the end-of-round card, so a press on one of those stops there, as on
 * any UI element, and never reaches it. The pull then follows the pointer,
 * relative to the camera: sideways on screen is sideways to the view, and
 * down on screen is down from the side, back toward the camera from behind.
 * The release is `event.POINTERUP`, heard wherever the pointer comes up,
 * since a pull often ends past the edge of the canvas, where no region of
 * the game is told. A pointer the browser takes away (`event.POINTERCANCEL`)
 * drops the pet back into the pouch rather than launching it.
 *
 * Copyright (C) 2011 - 2026 AltByte Pte Ltd — MIT License.
 * See `packages/examples/LICENSE.md` for full license + asset credits.
 */
import {
	type Camera3d,
	event,
	input,
	type Pointer,
	Renderable,
	Vector2d,
	Vector3d,
} from "melonjs";
import type { OrbitCamera } from "../camera/OrbitCamera";
import { MAX_PULL, POUCH, POWER } from "../constants";

/** what the aim reports to the round */
export interface AimHost {
	// whether a pet is in the pouch, ready to be pulled
	canAim(): boolean;
	// the pet is pulled back to `petAt`; let go now, it leaves at `velocity`
	onPull(petAt: Vector3d, pull: Vector3d, velocity: Vector3d): void;
	// let go
	onRelease(pull: Vector3d, velocity: Vector3d): void;
}

export class AimArea extends Renderable {
	private readonly camera: Camera3d;
	private readonly orbit: OrbitCamera;
	private readonly host: AimHost;
	private aiming = false;
	// where the press was, on screen
	private readonly pressed = new Vector2d();
	// world pixels per screen pixel, at the pouch, for this press
	private perPixel = 1;
	// the pull from the pouch, where it has the pet, and the launch it makes
	private readonly pull = new Vector3d();
	private readonly petAt = new Vector3d();
	private readonly velocity = new Vector3d();
	// scratch, to measure the screen at the pouch
	private readonly beside = new Vector3d();
	private readonly pouchOnScreen = new Vector2d();
	private readonly besideOnScreen = new Vector2d();

	/**
	 * @param camera - the stage's camera, to measure the screen with
	 * @param orbit - where the camera is turned
	 * @param host - the round the pulls go to
	 */
	constructor(camera: Camera3d, orbit: OrbitCamera, host: AimHost) {
		super(0, 0, camera.width, camera.height);
		this.camera = camera;
		this.orbit = orbit;
		this.host = host;
		this.anchorPoint.set(0, 0);
		this.floating = true;
		// a region only gets pointer events when it is not kinematic
		this.isKinematic = false;
	}

	override onActivateEvent() {
		input.registerPointerEvent("pointerdown", this, this.press);
		event.on(event.POINTERMOVE, this.move);
		event.on(event.POINTERUP, this.release);
		event.on(event.POINTERCANCEL, this.cancel);
	}

	override onDeactivateEvent() {
		input.releasePointerEvent("pointerdown", this);
		event.off(event.POINTERMOVE, this.move);
		event.off(event.POINTERUP, this.release);
		event.off(event.POINTERCANCEL, this.cancel);
	}

	/**
	 * Take hold of the pet in the pouch.
	 * @param pointer - the press
	 */
	private readonly press = (pointer: Pointer) => {
		if (!this.host.canAim()) {
			return;
		}
		// how far apart on screen two points 100 pixels apart are, there
		const a = this.camera.worldToScreen(POUCH, this.pouchOnScreen);
		const b = this.camera.worldToScreen(
			this.beside.copy(this.orbit.right).scale(100, 100, 100).add(POUCH),
			this.besideOnScreen,
		);
		this.perPixel = a && b ? 100 / Math.max(a.distance(b), 1) : 1;
		this.pressed.set(pointer.gameScreenX, pointer.gameScreenY);
		this.pull.set(0, 0, 0);
		this.aiming = true;
	};

	/**
	 * Pull the pet back with the pointer.
	 * @param pointer - the move
	 */
	private readonly move = (pointer: Pointer) => {
		if (!this.aiming || !this.host.canAim()) {
			return;
		}
		const { forward, right, behind } = this.orbit;
		const dx = (pointer.gameScreenX - this.pressed.x) * this.perPixel;
		const dy = (pointer.gameScreenY - this.pressed.y) * this.perPixel;
		this.pull.set(
			right.x * dx - forward.x * dy * behind,
			dy * (1 - behind),
			right.z * dx - forward.z * dy * behind,
		);
		const length = this.pull.length();
		if (length > MAX_PULL) {
			// all three: `scale(n)` alone leaves z as it is
			const k = MAX_PULL / length;
			this.pull.scale(k, k, k);
		}
		this.petAt.copy(POUCH).add(this.pull);
		// let go now, it would leave opposite the pull; from behind, a pull
		// straight back is lofted upward too
		this.velocity.set(
			-this.pull.x * POWER,
			-this.pull.y * POWER - behind * this.pull.length() * POWER * 0.45,
			-this.pull.z * POWER,
		);
		this.host.onPull(this.petAt, this.pull, this.velocity);
	};

	/** Let go, wherever the pointer comes up. */
	private readonly release = () => {
		if (!this.aiming) {
			return;
		}
		this.aiming = false;
		if (this.host.canAim()) {
			this.host.onRelease(this.pull, this.velocity);
		}
	};

	/** The browser took the pointer away: no shot, the pet goes back. */
	private readonly cancel = () => {
		this.pull.set(0, 0, 0);
		this.velocity.set(0, 0, 0);
		this.release();
	};
}
