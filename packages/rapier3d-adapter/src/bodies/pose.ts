/**
 * Writing a body's place and turn back onto its renderable: its position to
 * `pos` / `depth`, its turn onto `currentTransform`, from the transform the
 * renderable had when the body was made.
 */
import type * as RAPIER from "@dimforge/rapier3d-compat";
import { type Matrix3d, Mesh, Quaternion, type Renderable } from "melonjs";
import type { Units } from "../math/units";

/**
 * How a renderable draws its `currentTransform`, so the body's turn can be
 * written onto it: `bridge` is the sign of each axis between the space the
 * transform turns in and the engine's (a {@link Mesh} turns in its source's
 * Y-up space), and `base` the transform it had when the body was made.
 */
export interface Pose {
	base: Matrix3d;
	bridge: [number, number, number];
}

// the body's turn, carried into the space the renderable turns in
const _turn = new Quaternion();

/**
 * A renderable's pose as it stands, to turn from.
 * @param renderable - the renderable a body is made for
 * @returns its pose
 */
export function poseOf(renderable: Renderable): Pose {
	return {
		base: renderable.currentTransform.clone(),
		bridge:
			renderable instanceof Mesh
				? // a mesh turns in its source's Y-up space (see Mesh)
					[1, -1, renderable.rightHanded ? -1 : 1]
				: [1, 1, 1],
	};
}

/**
 * Write a body's position onto its renderable's `pos` / `depth` and, given a
 * pose, its turn onto its `currentTransform`.
 * @param renderable - the renderable
 * @param body - its body
 * @param pose - its pose, or undefined to write the position only
 * @param units - the scale between pixels and meters
 */
export function writePose(
	renderable: Renderable,
	body: RAPIER.RigidBody,
	pose: Pose | undefined,
	units: Units,
): void {
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard: pos is typed non-null but the pool releases it on recycle
	if (!renderable.pos) {
		return;
	}
	const p = body.translation();
	// one batched write: the position's change callback (a bounds update)
	// runs once, where assigning `pos.x`, `pos.y` and `depth` ran it three
	// times
	renderable.setPosition(
		units.toPixels(p.x),
		units.toPixels(p.y),
		units.toPixels(p.z),
	);
	renderable.isDirty = true;
	if (pose === undefined) {
		return;
	}
	const { x, y, z, w } = body.rotation();
	// carried into the space the transform turns in: D · R · D, with the
	// bridge D its own inverse. On a quaternion, each axis part takes its
	// axis's sign, and the sign of det(D) when D mirrors the space
	const [d0, d1, d2] = pose.bridge;
	const det = d0 * d1 * d2;
	_turn.set(det * d0 * x, det * d1 * y, det * d2 * z, w);
	// currentTransform = R' · base
	renderable.currentTransform.identity().rotate(_turn).multiply(pose.base);
	renderable.isDirty = true;
}
